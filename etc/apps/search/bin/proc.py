# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.0
import sys, time, logging, os, StringIO
import splunk.Intersplunk as si
import splunk.auth as auth
import splunk.scripting as scripting

def log(msg):
    # f = open("/tmp/run","a"); f.write('%s\n' % msg); f.close()
    return;

    
TESTING = True
CAN_STREAM_RESULTS_ANY_TIME = False

# remove newlines from msgs that must be single line
def normalizeMsg(txt):
    return str(txt).replace('\r\n',' ').replace('\n',' ')

def execute():
    
    results = []
    try:
        results, dummyresults, settings = si.getOrganizedResults()

        keywords, options = si.getKeywordsAndOptions()
        settings.update(options)

        sessionKey = settings.get("sessionKey", None)
        if TESTING and sessionKey == None:
            sessionKey = auth.getSessionKey('admin', 'changeme')
        owner      = settings.get("owner", None)
        namespace  = settings.get("namespace", "search")
        scriptname = settings.get("script", None)
        prerun_str = settings.get("prerun", "True").lower()
        prerun     = prerun_str.startswith('t') or prerun_str.startswith('y') or prerun_str.startswith('1')

        log("sessionKey %s owner %s namespace %s script %s prerun %s" % (sessionKey, owner, namespace, scriptname, prerun))
        
        if scriptname == None:
            raise Exception('"script" value required')
        if ".." in scriptname or "/" in scriptname or "\\" in scriptname:
            raise Exception('pathname cannot contain cannot contain "..", "/", or "\\".')
        home = si.splunkHome()
        localpath = os.path.join('etc', 'apps', namespace, 'scripts', scriptname + ".ss")
        pathname = os.path.join(home, localpath)
        if not os.path.exists(pathname):
            raise Exception('script path does not exist: "%s"' % os.path.join("SPLUNK_HOME", localpath))

        log("pathname %s" % (pathname))

        real_stdout = sys.stdout          
        if CAN_STREAM_RESULTS_ANY_TIME:
            # output results immediately to stdout            
            result_stream = sys.stdout  
        else:
            # output results once all done
            result_stream = StringIO.StringIO()

        # capture debugging stdout to StringIO, but have real stdout used for outputting results as streamed
        sys.stdout = StringIO.StringIO()
        
        script = scripting.Script(sessionKey, owner, namespace, path=pathname, prerunfix=prerun, outputstream=result_stream)
        side_effects = script.run()

        
        log("side_effects %s" % (side_effects))

        # output non-results -- variables and print statements from scripts
        sys.stdout.flush()
        messages = {}
        si.addInfoMessage(messages, "Variable values: %s" % side_effects)
        si.addInfoMessage(messages, "Standard output: %s" % sys.stdout.getvalue())

        # reset stdout
        sys.stdout = real_stdout
        OUTPUT_MSGS = True
        if OUTPUT_MSGS:
            # si.outputResults(None, messages)
            for level, messages in messages.items():
                for msg in messages:
                    print "%s=%s" % (level, normalizeMsg(msg))
            print

        # we haven't output results yet.  do it now.
        if not CAN_STREAM_RESULTS_ANY_TIME:
            result_stream.flush()
            print result_stream.getvalue()


    except Exception, e:
        sys.stdout = real_stdout        
        import traceback
        msg = "%s. Traceback: %s" % (e, traceback.format_exc())
        log("error %s" % msg)
        si.generateErrorResults(msg)
        
if __name__ == '__main__':
    execute()
