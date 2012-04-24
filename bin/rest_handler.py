#!/usr/bin/python

#
# Python binding for HTTP REST server script dispatch
#
# REST endpoints that have been assigned a python script handler will invoke
# this script by default, unless otherwise specified in the restmap.conf
# file.
#
# This handler is invoked as a standard program:
#
#   python rest_handler.py <handlerClassName> <requestXml> <authInfo>
#
# handlerClassName: The name of the python class to dispatch. This is generally
#                   of the form: <module_name>.<class_name>
#
# requestInfo: String version of request XML document; see splunk/rest/selftest.py
#
# sessionKey: The current session key used by the client
#
#
# This script must be run in the Splunk python context (python2.5, PYTHONPATH)

import os, sys
import splunk
import splunk.rest
import logging
import traceback

#SPL-18630
import __main__

#
# setup logging
#

# logging settings
BASE_LOG_PATH = os.path.join('var', 'log', 'splunk')
PYTHON_LOG_FILENAME = 'python.log'
#PYTHON_LOG_LEVEL = logging.INFO
PYTHON_LOG_LEVEL = logging.ERROR
LOGGING_DEFAULT_CONFIG_FILE = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'log.cfg')
LOGGING_LOCAL_CONFIG_FILE = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'log-local.cfg')
LOGGING_STANZA_NAME = 'python'
LOGGING_FORMAT = "%(asctime)s %(levelname)-s\t%(module)s:%(lineno)d - %(message)s"

# logger instance
logger = logging.getLogger('splunk')
logger.setLevel(PYTHON_LOG_LEVEL)
handler = logging.FileHandler(os.path.join(os.environ['SPLUNK_HOME'], BASE_LOG_PATH, PYTHON_LOG_FILENAME))
handler.setFormatter(logging.Formatter(LOGGING_FORMAT))
logger.addHandler(handler)

# read in logging config
splunk.setupSplunkLogger(logger, LOGGING_DEFAULT_CONFIG_FILE, LOGGING_LOCAL_CONFIG_FILE, LOGGING_STANZA_NAME, verbose=True)


#
# read in argv's
#

#assert(len(sys.argv) > 2)
assert(len(sys.argv) > 1)

handlerClassName = sys.argv[1]
#SPL-18630
#make this backwards comp.
try:
    sessionKey = getattr(__main__, "___sessionKey")
except AttributeError:
    #fall back to the old behaviour
    assert(len(sys.argv) > 2)
    sessionKey = sys.argv[2]

request = sys.stdin.read()

params = {
    'handlerClassName': handlerClassName,
    'requestInfo': request,
    'sessionKey': sessionKey
}

try:
    print splunk.rest.dispatch(**params)
except Exception, e:
    logger.exception(e)
    print traceback.format_exc(e)



