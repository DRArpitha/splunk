import glob
import logging, logging.handlers
import math
import os
import sys
import tempfile
import time

from multiprocessing import Process

import splunk
import splunk.auth as auth
import splunk.search as search
import splunk.util as util

SPLUNK_HOME = os.environ['SPLUNK_HOME']

logger = logging.getLogger('dm_backfiller')
logger.setLevel(logging.DEBUG)
logfile = os.path.join(SPLUNK_HOME, 'var', 'log', 'splunk', 'dm_backfiller.log')
handler = logging.handlers.RotatingFileHandler(logfile, 
                                               maxBytes=5240000,
                                               backupCount=5)
g = logging.Formatter("%(asctime)s %(levelname)s - %(message)s")
handler.setFormatter(g)
handler.setLevel(logging.INFO)
logger.addHandler(handler)

def searchFactory(maxjobs, params, time_list, uuid):
    spawned = 1
    completed = 0
    time_len = len(time_list)
    if maxjobs == 1:
        try:
            while time_list:
                    st = time_list.pop()
                    logger.info('uuid=%s Dispatching job %s for time %s (%s)' \
                                 % (uuid, spawned, st, time.ctime(int(st))))
                    job = search.dispatchSavedSearch(params['ss_name'], 
                                                 sessionKey=params['sessionKey'], 
                                                 namespace=params['namespace'],
                                                 owner=params['owner'], 
                                                 triggerActions=True, 
                                                 now=st,
						 ttl='120') 
                    spawned = spawned + 1
                    while not job.isDone:
                        time.sleep(.5)
                    completed = completed + 1
                    logger.info('uuid=%s Job %d of %d completed' \
                                 % (uuid, completed, time_len))
            logger.info('uuid=%s All jobs completed' % uuid)
            return
        except Exception, ex:
            logger.exception(ex)
            raise
    else:
        curjobs = []
        compjobs = []
        while 1:
            try:
                while (len(curjobs) >= maxjobs):
                    (curjobs, compjobs) = updateJobList(curjobs)
                    for j in compjobs:
                        logger.info('uuid=%s Job %d of %d completed (id: %s)' \
                                     %(uuid, completed, time_len, j.id))
                        completed = completed + 1
                st = time_list.pop()
                logger.info('uuid=%s Dispatching job %s for time %s (%s)' \
                             % (uuid, spawned, st, time.ctime(int(st))))
                job = search.dispatchSavedSearch(params['ss_name'], 
                                                 sessionKey=params['sessionKey'], 
                                                 namespace=params['namespace'],
                                                 owner=params['owner'], 
                                                 triggerActions=True, 
                                                 now=st,
						 ttl='120') 
                spawned = spawned + 1
                curjobs.append(job)
                (curjobs, compjobs) = updateJobList(curjobs)
                for j in compjobs:
                    logger.info('uuid=%s Job %d of %d completed (id: %s)' \
                                 %(uuid, completed, time_len, j.id))
                    completed = completed + 1
                for j in curjobs:
                    logger.info('uuid=%s Job %s still running' % (uuid, j.id))
                if not time_list:
                    logger.info('uuid=%s Encountered empty time list' % uuid)
                    break
            except:
                logger.info('uuid=%s Unhandled Exception' % uuid)
                raise
        logger.info('uuid=%s All jobs completed' % uuid)

def updateJobList(curjobs):
    newjobs = []
    compjobs = []
    for j in curjobs:
            if j.isDone:
                compjobs.append(j)
            else:
                newjobs.append(j)
    curjobs = newjobs
    return (curjobs, compjobs)

class Backfiller(object):

    def __init__(self, bf, sessionKey, owner, uuid=None):

        self.bf = bf

        if uuid:
            self.uuid     = uuid
            logger.info('recieved uuid %s' % uuid)
        else:
            self.uuid     = self.createUUID()        

        self.BASE_DEDUP   = 'search splunk_server=local index=$index$ $namefield$="$name$" \
                             earliest=$et$ latest=$lt$ | stats count by $timefield$'
        self.curjobs      = []
        self.dedup_search = ''
        self.name_field   = 'source'
        self.owner        = owner
        self.p            = None
        self.sessionKey   = sessionKey
        self.time_field   = 'search_now'
        self.time_list    = []

        self.ss_info    = self.getSavedSearch()
        self.index      = self.getIndex(self.bf.index)
        self.getScheduledTimes()
        if self.bf.dedup:
            self.dedup_search = self.updateDedup()
            self.time_list = self.findNonDupes()
        self.time_len = self.getTotalJobs()

    def executeBackfill(self):
        logger.info('uuid=%s ssname="%s"' % (self.uuid, self.bf.saved_search))
        if not self.time_list:
            logger.error('No Scheduled Times')
            return False
        logger.info('uuid=%s Spawning total_searches=%d ( max_concurrent=%d, \
                     earliest_period=%s latest_period=%s )' % (self.uuid, \
                     self.time_len, self.bf.maxjobs, self.time_list[0], self.time_list[-1]))
        params = {'sessionKey': self.sessionKey,
                  'ss_name': self.bf.saved_search,
                  'namespace': self.bf.namespace,
                  'owner': self.owner}
        maxjobs = self.bf.maxjobs
        time_list = self.time_list
        self.p = Process(target=searchFactory, args=(self.bf.maxjobs, params, time_list, self.uuid, ))
        self.p.daemon = True
        self.p.start()
        logger.info('uuid=%s spawned pid=%s' % (self.uuid, self.p.pid))

    def createUUID(self):
        return util.uuid4()

    def findNonDupes(self):
        try:
            cdjob = search.dispatch(self.dedup_search, sessionKey=self.sessionKey, 
                                    namespace=self.bf.namespace, owner=self.owner)
        except:
            raise
        existmap = {}
        while not cdjob.isDone:
            time.sleep(1)
        for r in cdjob.results:
            if self.time_field in r:
                existmap[str(math.trunc(float(str(r[self.time_field]))))] = 1 
        not_skipping = []
        for st in self.time_list:
            if str(math.trunc(float(st))) not in existmap:
                not_skipping.append(st)
        return not_skipping

    def getSavedSearch(self):
        try:
            return search.getSavedSearchWithTimes(self.bf.saved_search, self.bf.earliest, 
                                                  self.bf.latest, namespace = self.bf.namespace,
                                                  sessionKey = self.sessionKey, owner = self.owner)
        except:
            raise
        
    def getScheduledTimes(self):
        try:
            if 'scheduled_times' in self.ss_info:
                for st in self.ss_info['scheduled_times']:
                    self.time_list.append(st)
                if not self.bf.reverse:
                    self.time_list.reverse()
        except (IndexError, KeyError):
            raise

    def getIndex(self, index=None):
        if not index:
            try:
                return self.ss_info['action.summary_index._name']
            except (KeyError, IndexError):
               return 'summary' 
        return index

    def updateDedup(self):
        newsearch = self.BASE_DEDUP.replace("$namefield$", self.name_field)
        newsearch = newsearch.replace("$timefield$", self.time_field)
        newsearch = newsearch.replace("$index$", self.index)
        newsearch = newsearch.replace("$name$", self.bf.saved_search)
        newsearch = newsearch.replace("$et$", str(self.bf.earliest)) 
        newsearch = newsearch.replace("$lt$", str(self.bf.latest)) 
        return newsearch

    def getTotalJobs(self):
        return len(self.time_list)

    def isComplete(self):
        return not self.p.is_alive()

    def handleShutdown(self):
        self.p.join()


