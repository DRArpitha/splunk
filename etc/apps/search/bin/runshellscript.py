# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.0
import os, re, sys, urllib
import splunk.Intersplunk, splunk.mining.dcutils as dcu
import subprocess
from subprocess import PIPE, STDOUT

logger    = dcu.getLogger()
mswindows = (sys.platform == "win32")

results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()

# These values will be sent to the shell script:
# $0 = scriptname
# $1 = number of events returned
# $2 = search terms
# $3 = fully qualified query string
# $4 = name of saved splunk
# $5 = trigger reason (i.e. "The number of events was greater than 1")
# $6 = link to saved search
# $7 = DEPRECATED - empty string argument
# $8 = file where the results for this search are stored(contains raw results)

# 5 corresponds to the 6th arg passed to this python script which includes the
# name of this script and the path where the user's script is located

# The script will also receive args via stdin - currently only the session
# key which it can use to communicate back to splunkd is sent via stdin. 
# The format for stdin args is as follows:
# <url-encoded-name>=<url-encoded-value>\n
# e.g.
# sessionKey=0729f8e0d4edf7ae18327da6a9976596
# otherArg=123456
# <eof> 


if len(sys.argv) < 10:
    splunk.Intersplunk.generateErrorResults("Missing arguments to operator 'runshellscript', expected at least 10, got %i." % len(sys.argv))
    exit(1)

filepath = sys.argv[5]
script   = sys.argv[1]

if len(script) == 0:
    splunk.Intersplunk.generateErrorResults("Empty string is not a valid script name")
    exit(2)
    
if filepath[0] == "'" and filepath[-1] == "'":
    filepath = filepath[1:-1]
if script[0] == "'" and script[-1] == "'":
    script = script[1:-1]

sharedStorage = settings.get('sharedStorage', splunk.Intersplunk.splunkHome())

if len(sys.argv) > 10:
   path = sys.argv[10]   # the tenth arg is going to be the file 
else:
   baseStorage   = os.path.join(sharedStorage, 'var', 'run', 'splunk')
   path          = os.path.join(baseStorage, 'dispatch', sys.argv[9], 'results.csv.gz')


# ensure nothing dangerous
if ".." in filepath or "/" in filepath or "\\" in filepath:
    results = splunk.Intersplunk.generateErrorResults('Path location cannot contain "..", "/", or "\\"')
elif ".." in script or "/" in script or "\\" in script:
    results = splunk.Intersplunk.generateErrorResults('Script location cannot contain "..", "/", or "\\"')
else:
    
    # look for scripts first in the app's bin/scripts/ dir, if that fails try SPLUNK_HOME/bin/scripts
    namespace  = settings.get("namespace", None)
    sessionKey = settings.get("sessionKey", None)
    scriptName = script
    if not namespace == None :
        script = os.path.join(sharedStorage,"etc","apps",namespace,"bin","scripts",scriptName)
    
    # if we fail to find script in SPLUNK_HOME/etc/apps/<app>/bin/scripts - look in SPLUNK_HOME/bin/scripts
    if namespace == None or not os.path.exists(script):
        script = os.path.join(splunk.Intersplunk.splunkHome(),"bin","scripts",scriptName)
        
    if not os.path.exists(script):
        results = splunk.Intersplunk.generateErrorResults('Cannot find script at ' + script)
    else:
        stdin_data = ''
        cmd_args = sys.argv[1:]

        # make sure cmd_args has length of 9
        cmd_args    = cmd_args[:9]
        for i in xrange(9-len(cmd_args)):
           cmd_args.append("")
        cmd_args[0] = script
        cmd_args[8] = path

        stdin_data = "sessionKey=" + urllib.quote(sessionKey) + "\n"

        # strip any single/double quoting         
        for i in xrange(len(cmd_args)):
            if len(cmd_args[i]) > 2 and ((cmd_args[i][0] == '"' and cmd_args[i][-1] == '"') or (cmd_args[i][0] == "'" and cmd_args[i][-1] == "'")):
                 cmd_args[i] = cmd_args[i][1:-1]

        logger.info(str(cmd_args))

        # python's call(..., shell=True,...)  - is broken so we emulate it ourselves
        shell_cmd   = ["/bin/sh"]
        if(mswindows):
            shell_cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c"]
        # try to read the interpreter from the first line of the file
        try:
            f = open(script)
            line = f.readline().rstrip("\r\n")
            f.close()
            if line.startswith("#!"):
                # Emulate UNIX rules for "#!" lines:
                # 1. Any whitespace (just space and tab, actually) after
                #    the "!" is ignored.  Also whitespace at the end of
                #    the line is dropped
                # 2. Anything up to the next whitespace is the interpreter
                # 3. If there is anything after this whitespace it's
                #    considered to be the argument to pass to the interpreter.
                #    Note that this parsing is very simple -- no quoting
                #    is interpreted and only one argument is parsed.  This
                #    is to match
                line = line[2:].strip(" \t")
                if line != "":
                    arg_loc = line.replace("\t", " ").find(" ")
                    if arg_loc == -1:
                        shell_cmd = [ line ]
                    else:
                        shell_cmd = [ line[0:arg_loc], line[arg_loc + 1:].lstrip(" \t") ]
        except Exception, e:
            pass

        # pass args as env variables too - this is to ensure that args are properly passed in windows
        for i in xrange(len(cmd_args)):
            os.environ['SPLUNK_ARG_' + str(i)] = cmd_args[i]

        try:
            p = None
            if mswindows and os.path.split(shell_cmd[0])[1].lower() == "cmd.exe":
                # python seems to get argument escaping for windows wrong too - so we have to fix it ourselves yet again
                # in windows if args to cmd contain spaces the entire sting should be quoted for example:
                # cmd.exe /c " "c:\dir with spaces\foo.bar" "arg with spaces" "more args with space or special chars" "
                # for more info read cmd.exe /? (the section about quoting and arg processing)

                for i in xrange(0, len(cmd_args)):
                    if not (cmd_args[i].startswith('"') and cmd_args[i].endswith('"')):
                         cmd_args[i] = '"' + cmd_args[i] + '"'

                cmd2run      = shell_cmd[0]+' '+shell_cmd[1]+' " '+ ' '.join(cmd_args) + ' "'
                logger.info("runshellscript: " + cmd2run)
                p = subprocess.Popen(cmd2run, stdin=PIPE, stdout=PIPE, stderr=STDOUT, shell=False)
            else:     
                logger.info("runshellscript: " + str(shell_cmd + cmd_args))
                if  mswindows:  # windows doesn't support close_fds param
                    p = subprocess.Popen(shell_cmd + cmd_args, stdin=PIPE, stdout=PIPE, stderr=STDOUT, shell=False)
                else:
                    p = subprocess.Popen(shell_cmd + cmd_args, stdin=PIPE, stdout=PIPE, stderr=STDOUT, close_fds=True, shell=False)

            if p != None: 
               p.communicate(input=stdin_data)
        except OSError, e:
            results = splunk.Intersplunk.generateErrorResults('Error while executing script ' + str(e))
splunk.Intersplunk.outputResults( results )
