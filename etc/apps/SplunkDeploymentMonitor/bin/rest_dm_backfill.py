import logging 
import os
import splunk.admin as admin
import splunk.entity as en

logger = logging.getLogger('splunk')

required_args = ['saved_search', 'latest', 'earliest']
optional_args = ['index', 'reverse', 'namespace', 'dedup', 'description', 
                 'seed', 'maxjobs', 'status', 'totaljobs', 'disabled']

ENDPOINT = 'admin/conf-dm_backfill'

class DMBackfillHandler(admin.MConfigHandler):

    def setup(self):

        if self.requestedAction in [admin.ACTION_CREATE, admin.ACTION_EDIT]:
            
            for arg in required_args:
                self.supportedArgs.addReqArg(arg)

            for arg in optional_args:
                self.supportedArgs.addOptArg(arg)

    def handleList(self, confInfo):

        backfill = en.getEntities(ENDPOINT,
                                  namespace=self.appName,
                                  owner=self.userName,
                                  sessionKey=self.getSessionKey())

        for name, obj in backfill.items():
            confItem = confInfo[name]
            for key, val in obj.items():
                confItem[key] = str(val)
            acl = {}
            for k, v in obj[admin.EAI_ENTRY_ACL].items():
                if None != v:
                    acl[k] = v
            confItem.setMetadata(admin.EAI_ENTRY_ACL, acl)

    def handleEdit(self, confInfo):

        name = self.callerArgs.id

        ent = en.getEntity(ENDPOINT, name,
                              namespace=self.appName,
                              owner=self.userName,
                              sessionKey=self.getSessionKey())
                              
        for arg in required_args:
            try:
                ent[arg] = self.callerArgs[arg]
            except:
                pass

        for arg in optional_args:
            if arg in ['disabled']:
                next
            try:
                ent[arg] = self.callerArgs[arg]
            except:
                pass

        en.setEntity(ent, sessionKey=self.getSessionKey())

    def handleCreate(self, confInfo):

        name = self.callerArgs.id
        logger.info('DEBUG %s' % name)
       
        new = en.Entity(ENDPOINT, name, 
                        namespace=self.appName, owner=self.userName) 

        for arg in required_args:
            new[arg] = self.callerArgs[arg] 

        for arg in optional_args:
            if arg in ['disabled']:
                next
            try:
                new[arg] = self.callerArgs[arg]
            except:
                pass
        
        en.setEntity(new, sessionKey = self.getSessionKey())

    def handleRemove(self, confInfo):

        name = self.callerArgs.id

        en.deleteEntity(ENDPOINT, name,
                        namespace=self.appName,
                        owner=self.userName,
                        sessionKey = self.getSessionKey())

admin.init(DMBackfillHandler, admin.CONTEXT_APP_ONLY)

