"""
This script is called by splunkd's ScriptRunner.

The following args will be checked for:
  <script> <communication token> <args for script>

If argv1 is prefixed with CommToken:, it will be used to find the input data on
the filesystem instead of stdin, and will write to the filesystem instead of
stdout.

The following input data is expected, possibly via stdin:
  ScriptPath: <path to script to exec>
  SessionKey: <splunkd session key>
  <actual stdin data>

SessionKey will be parsed out and set as the global "___sessionKey".  Once
ScriptName is read in, the provided string is called via execfile(), allowing
the remaining stdin to still be handled by the script being called.
"""

import os, sys
import logging

#SPL-28166
logging.basicConfig(level=("UNIT_TEST_EXTRA_LOGGING" in os.environ) and logging.INFO or logging.ERROR,
                   format='%(asctime)s %(levelname)s %(message)s',
                   filename=os.environ['SPLUNK_HOME'] + '/var/log/splunk/python.log',
                   filemode='a')


TOKEN_PREFIX = "CommToken:"

def makeCommFilePath(token):
  return os.path.join(os.environ["SPLUNK_HOME"],
      "var", "run", "splunk", "comm", "py-%s" % token)

# get our in/out files if comm token is specified.
if len(sys.argv) > 1:
  if sys.argv[1].startswith(TOKEN_PREFIX):
    commToken = sys.argv.pop(1)
    commToken = commToken.replace(TOKEN_PREFIX, "", 1)
    sys.stdin  = open(makeCommFilePath(commToken) + ".in",  "r")
    sys.stdout = open(makeCommFilePath(commToken) + ".out", "w")
    sys.stderr = sys.stdout # yes, this is also how we use pipes.
  
# read in first line, script name.
tmpStr = sys.stdin.readline()
if not tmpStr.startswith("ScriptPath:"):
  raise Exception, "Expected script path line (got: %s)." % tmpStr
tmpStr = tmpStr.replace("ScriptPath:", "", 1)
REAL_SCRIPT_NAME = tmpStr.strip()
# empty script name is invalid.
if (len(REAL_SCRIPT_NAME) == 0):
  raise Exception, "Script path is empty."

# read in second line, session key.
tmpStr = sys.stdin.readline()
if not tmpStr.startswith("SessionKey:"):
  raise Exception, "Expected session key line (got: %s)." % tmpStr
tmpStr = tmpStr.replace("SessionKey:", "", 1)
# empty session key is not invalid.
___sessionKey = tmpStr.strip()

scriptDir = os.path.dirname(REAL_SCRIPT_NAME)
sys.path.append(scriptDir)
os.chdir(scriptDir)

# the rest of stdin is preserved - exec the real script now.
__file__ = REAL_SCRIPT_NAME
execfile(REAL_SCRIPT_NAME)
