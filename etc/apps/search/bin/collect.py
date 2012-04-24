# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.0
#
# stash - verb  to put by or away as for safekeeping or future use, usually in a secret place 
#               (usually fol. by away): The squirrel stashes away nuts for winter.

# This search processor will output search results to a file that can be reindexed by splunk.
# The current usecase for this script is summary indexing - a processes in which a large report
# is broken into smaller chunks and each chunk is saved separately and reused later.



# usage: <some search> | collect <collect options>
#   <collect options>
#       file=[filename]   - default is <random_number>_events.stash, you can use $timestamp$ or $random$ placeholders 
#                           in the name of your file to be replaced with timestamp and a random number respectively        
#       path=[path]       - default is $SPLUNK_HOME/var/spool/splunk
#       index=[indexname] - which index to target for results. If index does not exist error is thrown.
#       marker=[string]   - this is just a token or k=v used to mark the results for version or other delination or to defeat crc caching
#       addtime           - if true this will prepend time to events (one of the following): _time, info_min_time, or now_time. The time 
#                           will only be prepended to events which do NOT have a raw field. (info_min_time is added by addinfo command)
#       debug             - if debug then will just out args to screen

# following example will put in var/spool/splunk a file named foo without timestamp, marked with erik=nextrun", and targed to index cache
# index::_internal "group=pipeline" | timechart avg(executes) | collect file="foo" notimestamp marker="erik=nextrun" index="cache"



import sys,os,time,random,splunk.Intersplunk
import splunk.clilib.cli_common as cli_common

try:

    #write out a file that looks like k=v, k=v, k=v, etc.
    def writeEventCache(filename, events):

        # check if there is a _raw field in the first event - if so we'll
        # save: '_raw, marker', otherwise we'll save: 'KV pair list, marker' 
        raw_mode = "_raw" in events[0]
        now_time = time.localtime()       
        
        try:
            if not testmode:
                f = open(filename, 'w')
    
                # if an index is supplied use header processor to route
                if not index == "":
                    f.write("***SPLUNK*** index=" + index + "\n")

            # write the events out
            for event in events:
                line = ""

                if   '_time'         in event: event_time = time.localtime(float(event["_time"]))
                elif 'info_min_time' in event: event_time = time.localtime(float(event["info_min_time"]))
                else:                          event_time = now_time

                # write out all visible kv pairs
                if not raw_mode:
                   if addtime: 
                      line += time.strftime('%m/%d/%Y %H:%M:%S', event_time)

                   for key, val in event.items():
                       if not val == '' and not key.startswith('_'):
                          if not line == '' : line += ','
                          val   = val.replace('"', "") #"\\\"")
                          if key in rename_fields : key = rename_fields[key]
                          line += ' %s="%s"' % (key, val)
                else:
                    line += event['_raw']
                
                # add the marker to non-empty lines
                if not marker == '' and not line == '': line += ", " + marker

                if not testmode: 
                    # do not write out empty lines
                    if not line == '':  f.write(line + '\n');
                else:
                    event.clear()
                    event["_raw"] = line
                
            if not testmode:
                f.close()
            
        except Exception, e:
            #if there are errors instead of returning the results - return an error
            events = splunk.Intersplunk.generateErrorResults(str(e))
        
        # just return what was given to use if there no errors
        return events


    # helper function for building filename where to write cache
    def getFilename(f, p, ts):
        tmp = f
        tmp = tmp.replace("$timestamp$", "".join(map(str, time.localtime()[0:6])))
        tmp = tmp.replace("$random$"   , str(random.randint(1, 0xFFFFFFFF)))
        if not p.endswith("/"):
            p += '/'

        filename = p + tmp
        return filename


    # defaults
    # default path is spool directory - just for cachine
    path       = os.environ["SPLUNK_HOME"] + "/var/spool/splunk/"
    file       = "$random$_events.stash"  #name of file to writeout
    index      = ""       # custom index control - you can set which index you want to target when creating the cache
    marker     = ""       # this is just an extra key that gets indexed. for example, it can be version number, hame of cache, etc.
    format     = "splunk" # choices are 'splunk' for indexings or 'csv'
    addtime    = True     # should we append current time as the timestamp - this is useful when doing searches that dont have time in them
    testmode   = False    # whether to write the data to the file or return them as results of command
    debug      = False
    results    = ""

    # set of fields to rename 
    rename_fields = {"host"     :"orig_host",  
                    "source"    :"orig_source", 
                    "sourcetype":"orig_sourcetype"}


    # poor mans opt
    if len(sys.argv) >1:
        for a in sys.argv:
            if a.startswith("file="):
                where = a.find('=')
                file = a[where+1:len(a)]

            elif a.startswith("path="):
                where = a.find('=')
                path = a[where+1:len(a)]

            elif a.startswith("index="):
                where = a.find('=')
                index = a[where+1:len(a)]

            elif a.startswith("format="):
                where = a.find('=')
                format = a[where+1:len(a)]

            elif a.startswith("marker="):
                where  = a.find('=')
                marker = a[where+1:len(a)]

            elif a.startswith("addtime="):
                where   = a.find('=')
                addtime = a[where+1:len(a)].lower().startswith('t')

            elif a.startswith("testmode="):
                where    = a.find('=')
                testmode = a[where+1:len(a)].lower().startswith('t')

            elif a.startswith("debug"):
                debug = True

    error = False
    # check that everthing is ok...
    if index == "" and not testmode:
        results =  splunk.Intersplunk.generateErrorResults("Error: you need to supply a valid index name. It is suggested you not use your main index and create a special cache index")

    if debug:
        results =  splunk.Intersplunk.generateErrorResults("DEBUG: file=%s, path=%s, index=%s, format=%s, marker=%s" % (file, path, index, format, marker) )

    # if no error do the work 
    if results == "":
        results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()
        
        config = cli_common.getMergedConf('indexes')
        if not index in config:
            error   = True
            results = splunk.Intersplunk.generateErrorResults("index='" + index + "' does not exist.")
            
        
        
	if not error and len(results) > 0 :
            results = writeEventCache(getFilename(file, path, False), results)
            
except Exception, e:
    results = splunk.Intersplunk.generateErrorResults(str(e))
    
splunk.Intersplunk.outputResults(results)

