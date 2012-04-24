from splunk.models.base import SplunkRESTModel, SplunkAppObjModel
from splunk.models.field import Field, BoolField, IntField, ListField
import splunk.rest as rest
import logging

logger = logging.getLogger('splunk.module.model')

'''
Provides object mapping for input objects
'''

class Input(SplunkRESTModel):
    
    resource              = 'data/inputs'
    disabled              = BoolField(is_mutable=False)
    host                  = Field() 
    index                 = Field()
    queue                 = Field()
    rcvbuf                = IntField(api_name='_rcvbuf',is_mutable=False)
    source                = Field()
    sourcetype            = Field()

    def _reload(self):
        path = '/'.join([self.id.rsplit('/', 1)[0], '_reload'])
        response, content = rest.simpleRequest(path,
                                 method='POST')
        if response.status == 200:
            return True
        return False

class ScriptedInput(Input):
    
    resource              = 'data/inputs/script'
    interval              = IntField()
    pass_auth             = Field(api_name='passAuth')

class MonitorInput(Input):

    resource               = 'data/inputs/monitor'
    always_open_file       = BoolField()
    blacklist              = Field()
    crc_salt               = Field(api_name='crcSalt')
    file_count             = IntField(api_name='filecount', is_mutable=False)
    follow_symlink         = BoolField(api_name='followSymlink')
    follow_tail            = BoolField()
    host_regex             = Field()
    host_segment           = Field()
    # TODO : cast to TimeField()
    ignore_older_than      = Field()
    move_policy            = Field()
    recursive              = BoolField()
    time_before_close      = IntField()
    whitelist              = Field()

class WinEventLogInput(Input):

    resource               = 'data/inputs/win-event-log-collections'
    checkpoint_interval    = IntField(api_name='checkpointInterval')
    current_only           = BoolField()
    evt_dc_name            = Field()
    evt_dns_name           = Field()
    evt_resolve_ad_obj     = BoolField()
    logs                   = ListField()
    start_from             = Field()
    

class WinPerfmonInput(Input):

    resource               = 'data/inputs/win-perfmon'

class WinWMIInput(Input):

    resource               = 'data/inputs/win-wmi-collections'

class WinADInput(Input):

    resource               = 'data/inputs/ad'

class WinRegistryInput(Input):
  
    resource               = 'data/inputs/registry'

class SocketInput(Input):

    # TODO : cast to QueueField()
    group                  = Field(is_mutable=False)
    persistent_queue_size  = Field(api_name='persistentQueueSize')
    queue_size             = Field(api_name='queueSize')

class CookedTCPInput(SocketInput):

    resource               = 'data/inputs/tcp/cooked'
    compressed             = BoolField()
    enable_s2s_heartbeat   = BoolField()
    input_shutdown_timeout = IntField()
    # TODO: cast to RouteField()
    route                  = Field()
    s2s_heartbeat_timeout  = IntField()

class RawTCPInput(SocketInput):

    resource               = 'data/inputs/tcp/raw'
    connection_host        = Field()
    group                  = Field(is_mutable=False)
    restrict_to_host       = Field(api_name='restrictToHost')

class SSL(SplunkAppObjModel):

    resource               = 'data/inputs/tpc/ssl'
    cipher_suite           = Field(api_name='cipherSuite')
    require_client_cert    = BoolField(api_name='requireClientCert')
    root_ca                = Field(api_name='rootCA')
    server_cert            = Field(api_name='serverCert')
    server_cert_password   = Field(api_name='password')
    support_sslv3_only     = BoolField(api_name='supportSSLVOnly')

class UDPInput(Input):

    resource               = 'data/inputs/udp'
    connection_host        = Field()
    no_appending_timestamp = BoolField()
    no_priority_stripping  = BoolField()
    
