#
# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved. Version 4.0
# 
# This tool is to be used to add and remove databases when splunkd is stopped.
# 

from splunk.clilib.dbmanipulator_lib import *

if __name__ == "__main__":
    try:
        runFromCommandLine()
    except Exception,e:
        if str(e) == "0" or str(e) == "-1" :
            print "!!"
            sys.exit(int(str(e)))
        print "ERROR ::",e

        sys.exit(1)


