import logging
import logging.handlers
from optparse import OptionParser
import os
import sys
import time

import splunk
import splunk.entity as entity

APP_NAME = 'SplunkDeploymentMonitor'
local_path = os.path.join(os.environ.get('SPLUNK_HOME'),
                          'etc', 'apps', APP_NAME, 'bin')
if not local_path in sys.path:
    sys.path.append(local_path)

from deployment_monitor.backfiller import bfsum
from deployment_monitor.models.dm_backfill import Backfill

ENTITY_PATH = 'backfill/dm_backfill'
LOG_FILENAME = os.path.join(os.environ.get('SPLUNK_HOME'),
                            'var','log','splunk', 
                            'dm_backfill_factory.log')
logger = logging.getLogger('Logger')
logger.setLevel(logging.DEBUG)
handler = logging.handlers.RotatingFileHandler(LOG_FILENAME, 
                                               maxBytes=5124800, 
                                               backupCount=4)
f = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
handler.setFormatter(f)
handler.setLevel(logging.INFO)
logger.addHandler(handler)

def execute(job, token):
    ''' execute the backfill job '''   

    # set status to 'in progress'
    set_status([job['name']], 1, token) 
    logger.info('attempting to execute job %s' % job['name'])

    try:
        bf_job = Backfill(APP_NAME, 'nobody', job['name'], entity=job['entity'])
        bf_job.from_entity(bf_job.entity)

        bf = bfsum.Backfiller(bf_job, token, 'nobody', uuid=bf_job.name)
        bf.executeBackfill()

        while not bf.isComplete():
            time.sleep(1)
    except Exception, ex:
        logger.debug(ex)
        logger.error('backfill job %s failed' % job['name'])
        set_status([job['name']], 0, token)
        sys.exit()
    
    logger.info('backfill job %s completed successfully' % job['name'])
    # set status to 'done'
    set_status([job['name']], 2, token) 

def next(token):
    ''' get the next job (and reap if necessary) '''

    next_job = None
    to_reap = []

    # find any 'in progress' jobs 
    en = search(token, srch='status=1')

    if en:
        logger.error('Another job appears to be in progress - deferring')
        sys.exit()

    # find any 'completed' jobs
    en = search(token, srch='status=2')
    finished_jobs = [e for e in en]

    if len(finished_jobs) > 10:
        reap(finished_jobs[10:], token)

    # find all the 'new' jobs - implicit sort by 'seed'
    en = search(token, srch='status=0')
    jobs = [e for e in en] 

    if len(jobs) == 0:
        logger.info('Found no new jobs in queue')
        sys.exit()

    for i, j in enumerate(jobs):
        if not en[jobs[i]].get('seed'):
            # something is broken if the job's 'seed' wasn't populate
            logger.warn('adding job %s to reaping queue' % jobs[i])
            to_reap.append(jobs.pop(i))
            next
        if not next_job:
            next_job = {'name': jobs[i], 'entity': en[jobs[i]]}
            logger.info('adding job %s to execution queue' % jobs[i])

    # set status to 'done' - we won't reap them if not set as such
    set_status(to_reap, 2, token)
    reap(to_reap, token)
    execute(next_job, token)

def reap(reap_list, token):
    ''' reap all jobs in given list '''

    if not reap_list:
        return
    
    logger.info('attempting to reap %i job(s)' % len(reap_list))

    for job in reap_list:
        en = entity.getEntity(ENTITY_PATH, job, namespace=APP_NAME,
                              owner='nobody', sessionKey=token)
        if en['status'] and en['status'] != 2:
            logger.warning('job %s cannot be reaped - status is %s' % (job, en['status']))
            next
        entity.deleteEntity(ENTITY_PATH, job, APP_NAME, 'nobody', sessionKey=token)
        logger.info('successfully reaped job %s' % job)

def search(token, srch=None, sort='seed'):

    if srch:
        return entity.getEntities(ENTITY_PATH, namespace=APP_NAME,
                                  owner='nobody', sessionKey=token, 
                                  sort_key=sort, search=srch)
    else:
        return entity.getEntities(ENTITY_PATH, namespace=APP_NAME,
                                  owner='nobody', sessionKey=token,
                                  sort_key=sort) 

def set_status(job_list, status, token):

    if job_list and (len(job_list) < 1 or not isinstance(job_list, list)):
        return

    try:
        status = int(status)
    except:
        logger.error('set_status will only accept status integers')
        sys.exit()

    if status < 0 or status > 2:
        logger.error('set_status will only accept status integers between 0 and 2')

    for job in job_list:
        en = entity.getEntity(ENTITY_PATH, job, namespace=APP_NAME,
                              owner='nobody', sessionKey=token)
        en['status'] = status
        entity.setEntity(en, sessionKey=token)
 
if __name__ == '__main__':

    try:
        token = sys.stdin.readlines()[0]
    except Exception, ex:
        logger.debug(ex)
        logger.exception('unable to read token from stdin')
        raise
 
    token = token.strip()
    next(token)

