#
# RelaxNG validator utility
#
# This script will validate every XML file found inside of the current Splunk
# instance's /etc/apps directory
#
# See README.txt for setup information
#

import lxml.etree as et
import os, re
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

f = open('all.rng', 'r')
schema = et.parse(f)
relaxng = et.RelaxNG(schema)
f.close()

ui_rex = re.compile(r'\bui\b')

for root, dirs, files in os.walk(make_splunkhome_path(['etc', 'apps']), topdown=False):
    for name in files:
        if name.endswith('.xml') and ui_rex.search(root):
            f = open(os.path.join(root, name), 'r')
            rootNode = et.parse(f)
            isValid = relaxng.validate(rootNode)
            if not isValid:
                print '=' * 80
                print "Validation error: %s" % os.path.join(root, name)
                print relaxng.error_log
                print ''
            f.close()
