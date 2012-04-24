import splunk
import splunk.admin as admin
import os
import sys
from splunk.appserver.mrsparkle.lib.i18n import *
import splunk.clilib.bundle_paths as bp

ALLOW_FOLDER_SELECTION = "allowFolderSelection"
ALLOW_FILE_SELECTION   = "allowFileSelection"
CAP_EDIT_MONITOR       = "edit_monitor"

class FileBrowserHandler(admin.MConfigHandler):
    def setup(self):
        self.supportedArgs.addOptArg(ALLOW_FOLDER_SELECTION)
        self.supportedArgs.addOptArg(ALLOW_FILE_SELECTION)
        
        self.setReadCapability(CAP_EDIT_MONITOR)
        self.setWriteCapability(CAP_EDIT_MONITOR)
        
    '''
    Lists files
    '''
    def handleList(self, confInfo):
        args = self.callerArgs.data
        path = self.callerArgs.id
        names = []
        allowFolders = allowFiles = True

        if ALLOW_FOLDER_SELECTION in args:
            allowFolders = bp.parse_boolean(args[ALLOW_FOLDER_SELECTION][0])
        if ALLOW_FILE_SELECTION in args:
            allowFiles = bp.parse_boolean(args[ALLOW_FILE_SELECTION][0])
            
        if not path:
            if sys.platform.startswith('win'):
                import win32api
                names = [drive for drive in win32api.GetLogicalDriveStrings().split('\000') if drive]
                path = ''
            else:
                path = '/'
                try:
                    names = sorted(os.listdir(path))
                except Exception, e:
                    raise admin.ArgValidationException(e)
        else:
            if path.endswith(':'):
                path += '\\'
            if not os.path.exists(path):
                raise admin.ArgValidationException(_('Path not found'))
            if not os.path.isdir(path):
                path = os.path.dirname(path)
                if not os.path.exists(path):
                    raise admin.ArgValidationException(_('Path not found'))
            
            try:
                names = sorted(os.listdir(unicode(path)))
            except Exception, e:
                raise admin.ArgValidationException(e)
            
        files = []
        cnt = 0
        for name in names:
            fullpath = os.path.join(path, name)
            if name.startswith('.') or not os.access(fullpath, os.R_OK):
                # don't show unreadable and hidden linux files
                continue
            if not os.path.isdir(fullpath):
                files.append(name)
                continue
            confInfo[fullpath].append('hasSubNodes', '1')
            confInfo[fullpath].append('name', name)
            confInfo[fullpath].append('selectable', '1' if allowFolders else '0')
            confInfo[fullpath].append('order', str(cnt))
            cnt += 1
            
        for f in files:
            fullpath = os.path.join(path, f)
            confInfo[fullpath].append('hasSubNodes', '0')
            confInfo[fullpath].append('name', f)
            confInfo[fullpath].append('selectable', '1' if allowFiles else '0')
            confInfo[fullpath].append('order', str(cnt))
            cnt += 1
            
        self.didFilter = True
            
#admin.init(FileBrowserHandler, admin.CONTEXT_APP_ONLY)
