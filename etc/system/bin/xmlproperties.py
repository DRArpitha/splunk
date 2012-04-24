
#
# This REST handler is responsible for converting a layered configuration bundle into an XML format.
# 

import splunk.rest
import logging as logger
import splunk.bundle as bundle

XML_MANIFEST    = '<?xml version="1.0" encoding="UTF-8" ?>'

class List (splunk.rest.BaseRestHandler):
   
    def handle_GET(self):
    
        if len(self.pathParts) == 3:
            confName = self.pathParts[2]
            logger.debug("getConf for confName %s" % confName)
            conf = bundle.getConf(confName, sessionKey=self.sessionKey)
        else:
            namespaceName = self.pathParts[2]
            confName = self.pathParts[3]
            logger.debug("getConf for confName %s and namespaceName %s" % (confName, namespaceName))
            conf = bundle.getConf(confName, sessionKey=self.sessionKey, namespace=namespaceName)
            
        output=[XML_MANIFEST]
        stanzas = conf.findStanzas('*')
        for stanzaname in stanzas:
            splits = []
            splits = stanzaname.split(':')
            logger.debug("splits is: %s" % splits)
            if len(splits) == 1:
                output.append('\n<%s ' % stanzaname)
            else:
                id = splits[1]
                output.append('\n<%s id="%s" ' % (splits[0], splits[1]))
            
            keys = {}
            stanza = conf[stanzaname]
            keys = stanza.findKeys('*')

            for (value, key) in enumerate(keys):
                # skip _raw
                if key != "_raw":
                    output.append('\n\t%s="%s" ' % (key, value))
                 
            output.append('/>' )

        self.response.write(''.join(output))

