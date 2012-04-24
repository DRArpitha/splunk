# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# This file contains the set of attributes and values you can use to configure server options
# in server.conf.
#
# There is a server.conf in $SPLUNK_HOME/etc/system/default/.  To set custom configurations, 
# place a server.conf in $SPLUNK_HOME/etc/system/local/.  For examples, see server.conf.example.
# You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles


##########################################################################################
# General Server Configuration
##########################################################################################
[general]
serverName = <ascii string>
    * The name used to identify this Splunk instance for features such as distributed search.
    * Defaults to <hostname>-<user running splunk>.
    * May not be an empty string
    * May contain environment variables
    * After any environment variables have been expanded, the server name (if not an IPv6
      address) can only contain letters, numbers, underscores, dots, and dashes; and
      it must start with a letter, number, or an underscore.  

sessionTimeout = <time range string>
    * The amount of time before a user session times out, expressed as a search-like time range
    * Examples include '24h' (24 hours), '3d' (3 days), '7200s' (7200 seconds, or two hours)
    * Defaults to '1h' (1 hour)

trustedIP = <ip address>
    * All logins from this IP address are trusted, meaning password is no longer required
    * Only set this if you are using Single Sign On (SSO)

allowRemoteLogin = <always | never | requireSetPassword>
    * Controls remote management by restricting general login. Note that this does not apply to trusted
      SSO logins from trustedIP.
    * If 'always', enables authentication so that all remote login attempts are allowed.
    * If 'never', only local logins to splunkd will be allowed. Note that this will still allow
      remote management through splunkweb if splunkweb is on the same server.
    * If 'requireSetPassword' (default):
         * In the free license, remote login is disabled.
         * In the pro license, remote login is only disabled for the admin user that has not changed their default password.

pass4SymmKey = <password string>
    * This is prepended to the splunk symmetric key to generate the final key which is used to
      sign all traffic between master/slave licenser

listenOnIPv6 = <no | yes | only>
    * By default, splunkd will listen for incoming connections (both REST
      and TCP inputs) using IPv4 only
    * To enable IPv6 support in splunkd, set this to 'yes'.  splunkd will simultaneously
      listen for connections on both IPv4 and IPv6
    * To disable IPv4 entirely, set this to 'only', which will cause splunkd
      to exclusively accept connections over IPv6.  You will probably also
      need to change mgmtHostPort in web.conf (use '[::1]' instead of '127.0.0.1')
    * Note that any setting of SPLUNK_BINDIP in your environment or splunk-launch.conf
      will override this value.  In that case splunkd will listen on the exact address
      specified.

connectUsingIpVersion = <auto | 4-first | 6-first | 4-only | 6-only>
    * When making outbound TCP connections (for forwarding eventdata, making
      distributed search requests, etc) this controls whether the connections will
      be made via IPv4 or IPv6.
    * If a host is available over both IPv4 and IPv6 and this is set to '4-first' then
      we will connect over IPv4 first and fallback to IPv6 if the connection fails
    * If it is set to '6-first' then splunkd will try IPv6 first and fallback to IPv4 on failure
    * If this is set to '4-only' then splunkd will only attempt to make connections over IPv4
    * Likewise, if this is set to '6-only' will only attempt to connect to the IPv6 address
    * The default value of 'auto' will select a reasonable value based on listenOnIPv6's setting
      If that value is set to 'no' it will act like '4-only'.  If it is set to 'yes' it will
      act like '6-first' and if it is set to 'only' it will act like '6-only'
    * Note that connections to literal addresses are unaffected by this.  For example,
      if a forwarder is configured to connect to "10.1.2.3" the connection will be made over
      IPv4 regardless of this setting

guid = <globally unique identifier for this instance>

useHTTPServerCompression = <bool>
    * Whether Splunkd's HTTP server should support gzip content encoding. For more info on how 
    * content encoding works see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html (section 14.3)
      
useHTTPClientCompression = <bool>|< on-http | on-https>
    * Whether gzip compression should be supported when Splunkd acts as a client (including distributed searches). Note that  
    * in order for the content to be compressed the HTTP server that the client is connecting to should also support compression.
    * If the connection is being made over https and useClientSSLCompression=true (see below) then setting this 
    * option to true would result in double compression work without much compression gain. It is recommended that this
    * value be set to on-http or (true and set useClientSSLCompression=false).

##########################################################################################
# SSL Configuration details
##########################################################################################

[sslConfig]
	* Set SSL for communications on Splunk's back-end under this stanza name.
		* NOTE: To set SSL (eg HTTPS) for Splunk Web and the browser, use web.conf.
	* Follow this stanza name with any number of the following attribute/value pairs.  
	* If you do not specify an entry for each attribute, Splunk will use the default value.

enableSplunkdSSL = [true|false]
	* Enables/disables SSL on the splunkd management port (8089).
    * Defaults to true.

useClientSSLCompression = [true|false]
    * Turns on HTTP client compression. 
    * Server-side compression is turned on by default; setting this on the client side enables 
    * compression between server and client.  
    * Enabling this potentially gives you much faster distributed searches across multiple Splunk instances.
    * Defaults to true.
    
 useSplunkdClientSSLCompression = [true|false]
    * Controls whether SSL compression would be used when splunkd is acting as an HTTP client,
    * usually during certificate exchange, bundle replication, remote calls etc. 
    * NOTE: this setting is effective if and only if useClientSSLCompression is set to true
    * NOTE: splunkd is not involved in data transfer in distributed search, the search in a separate process is.
    * Defaults to false
 
supportSSLV3Only = [true|false]
        * If true, tells the HTTP server to only accept connections
        * from SSLv3 clients.
        * Default is false.

sslVerifyServerCert = [true|false]
        * Used by distributed search:  When making a search request to another
        server in the search cluster.
        * Used by distributed deployment clients:  When polling a deployment
        server.
        * If true, make sure that the server that is being connected to 
        is a valid one (authenticated).  Both the common name and the alternate name
        of the server are then checked for a match if they are specified in this
        configuration file.
        * Default is false

sslCommonNameToCheck = <commonName>
        * The common name to check when 'sslVerifyServerCert' is set to true
        * This feature does not work with the deployment server and client communication over SSL.
        * Optional.  Defaults to no common name checking.

sslAltNameToCheck = <alternateName>
        * The alternate name to check when 'sslVerifyServerCert' is set to true
        * This feature does not work with the deployment server and client communication over SSL.
        * Optional.  Defaults to no alternate name checking

requireClientCert = [true|false]
        * Requires that any HTTPS client that connects to splunkds internal HTTPS server
        has a certificate that was signed by our certificate authority.
        * Used by distributed search: Splunk indexing instances must be authenticated
        to connect to another splunk indexing instance.
        * Used by distributed deployment: The deployment server requires that 
        deployment clients are authenticated before allowing them to poll for new
        configurations/applications.
        * If true, a client can connect ONLY if a certificate created by our
        certificate authority was used on that client.
        * Default is false

cipherSuite = <cipher suite string>
        * If set, uses the specified cipher string for the HTTP server.
         If not set, uses the default cipher string
         provided by OpenSSL.  This is used to ensure that the server does not
         accept connections using weak encryption protocols.
          
sslKeysfile = <filename>
        * Server certificate file. 
        * Certificates are auto-generated by splunkd upon starting Splunk.
        * You may replace the default cert with your own PEM format file.
        * Certs are stored in caPath (see below).
        * Default is server.pem.
        
sslKeysfilePassword = <password>
        * Server certificate password.
        * Default is password.

caCertFile = <filename>
        * Public key of the signing authority.
        * Default is cacert.pem.

caPath = <path>
        * path where all these certs are stored.
        * Default is $SPLUNK_HOME/etc/auth.
        
certCreateScript = <script name>
        * Creation script for generating certs on startup 
          of Splunk.

##########################################################################################
# Splunkd HTTP server configuration
##########################################################################################

[httpServer]
	* Set stand-alone HTTP settings for Splunk under this stanza name.
	* Follow this stanza name with any number of the following attribute/value pairs.  
	* If you do not specify an entry for each attribute, Splunk uses the default value.

atomFeedStylesheet = <string>
    * Defines the stylesheet relative URL to apply to default Atom feeds.
    * Set to 'none' to stop writing out xsl-stylesheet directive.  
    * Defaults to /static/atom.xsl.

max-age = <int>
    * Set the maximum time (in seconds) to cache a static asset served off of the '/static' directory.
    * This value is passed along in the 'Cache-Control' HTTP header.
    * Defaults to 3600.
          
follow-symlinks = [true|false]
    * Toggle whether static file handler (serving the '/static' directory) follow filesystem 
      symlinks when serving files.  
    * Defaults to false.
          
disableDefaultPort = [true|false]
        * If true, turns off listening on the splunkd management port (8089 by default)
        * Default value is 'false'.

streamInWriteTimeout = <int>
        * When uploading data to http server, if http server is unable to write data to
        * receiver for configured streamInWriteTimeout seconds, it aborts write operation.
        * Defaults to 5 second.

##########################################################################################
# Splunkd HTTPServer listener configuration
#########################################################################################

[httpServerListener:<ip>:<port>]
        * Enable the splunkd http server to listen on a network interface (NIC) specified by
        <ip> and a port number specified by <port>.  If you leave <ip> blank (but still include the ':'),
        splunkd will listen on the kernel picked NIC using port <port>.

ssl = [true|false]
        * Toggle whether this listening ip:port will use SSL or not.
        * Default value is 'true'.
          
listenOnIPv6 = <no | yes | only>
        * Toggle whether this listening ip:port will listen on IPv4, IPv6, or both
        * If not present, the setting in the [general] stanza will be used



##########################################################################################
# Static file handler MIME-type map
##########################################################################################

[mimetype-extension-map]
	* Map filename extensions to MIME type for files served from the static file handler under
	this stanza name.
	
<file-extension> = <MIME-type>
    * Instructs the HTTP static file server to mark any files ending in 'file-extension' 
         with a header of 'Content-Type: <MIME-type>'.
    * Defaults to:
    
    [mimetype-extension-map]
	gif = image/gif
	htm = text/html
	jpg = image/jpg
	png = image/png
	txt = text/plain
	xml = text/xml
	xsl = text/xml
  	
##########################################################################################
# Remote applications configuration (e.g. SplunkBase)
##########################################################################################

[applicationsManagement]
	* Set remote applications settings for Splunk under this stanza name.
	* Follow this stanza name with any number of the following attribute/value pairs.  
	* If you do not specify an entry for each attribute, Splunk uses the default value.

allowInternetAccess = <bool>
	* Allow Splunk to access the remote applications repository.

url = <URL>
	* Applications repository.
	* Defaults to https://splunkbase.splunk.com/api/apps

loginUrl = <URL>
	* Applications repository login.
	* Defaults to https://splunkbase.splunk.com/api/account:login/

detailsUrl = <URL>
	* Base URL for application information, keyed off of app ID.
	* Defaults to https://splunkbase.splunk.com/apps/id

useragent = <splunk-version>-<splunk-build-num>-<platform>
	* User-agent string to use when contacting applications repository.
	* <platform> includes information like operating system and CPU architecture.

updateHost = <URL>
	* Host section of URL to check for app updates, e.g. https://splunkbase.splunk.com

updatePath = <URL>
	* Path section of URL to check for app updates, e.g. /api/apps:resolve/checkforupgrade

updateTimeout = <time range string>
	* The minimum amount of time Splunk will wait between checks for app updates
	* Examples include '24h' (24 hours), '3d' (3 days), '7200s' (7200 seconds, or two hours)
	* Defaults to '24h'

##########################################################################################
# Misc. configuration
##########################################################################################

[scripts]

initialNumberOfScriptProcesses = <num>
        * The number of pre-forked script processes that are launched
        when the system comes up.  These scripts are reused when script REST endpoints *and*
        search scripts are executed.  The idea is to eliminate the performance
        overhead of launching the script interpreter every time it is invoked.  These
        processes are put in a pool.  If the pool is completely busy when a script gets
        invoked, a new processes is fired up to handle the new invocation - but it 
        disappears when that invocation is finished.


##########################################################################################
# Disk usage settings (for the indexer, not for Splunk log files)
##########################################################################################

[diskUsage]

minFreeSpace = <num>
        * Specified in megabytes.
        * The default setting is 2000 (approx 2GB)
        * Specifies a safe amount of space that must exist for splunkd to continue operating.
        * Note that this affects search and indexing
        * This is how the searching is affected:
        * For search:
            * Before attempting to launch a search, splunk will require this
              amount of free space on the filesystem where the dispatch
              directory is stored, $SPLUNK_HOME/var/run/splunk/dispatch
            * Applied similarly to the search quota values in
              authorize.conf and limits.conf.
        * For indexing: 
            * Periodically, the indexer will check space on all partitions
              that contain splunk indexes as specified by indexes.conf.  Indexing
              will be paused and a ui banner + splunkd warning posted to indicate
              need to clear more disk space.

pollingFrequency = <num>
        * After every pollingFrequency events indexed, the disk usage is checked.
        * The default frequency is every 100000 events.

pollingTimerFrequency = <num>
        * After every pollingTimerFrequency seconds, the disk usage is checked
        * The default value is 10 seconds

##########################################################################################
# Queue settings
##########################################################################################
[queue]
maxSize = [<integer>|<integer>[KB|MB|GB]]
        * Specifies default capacity of a queue.
        * If specified as a lone integer (for example, maxSize=1000), maxSize indicates the maximum number of events allowed
          in the queue.
        * If specified as an integer followed by KB, MB, or GB (for example, maxSize=100MB), it indicates the maximum
          RAM allocated for queue.
        * The default is 500KB.

[queue=<queueName>]
maxSize = [<integer>|<integer>[KB|MB|GB]]
        * Specifies the capacity of a queue. It overrides the default capacity specified in [queue].
        * If specified as a lone integer (for example, maxSize=1000), maxSize indicates the maximum number of events allowed
          in the queue.
        * If specified as an integer followed by KB, MB, or GB (for example, maxSize=100MB), it indicates the maximum
          RAM allocated for queue.
        * The default is inherited from maxSize value specified in [queue]

##########################################################################################
# PubSub server settings for the http endpoint.
##########################################################################################

[pubsubsvr-http]

disabled = [true|false]
    * If disabled, then http endpoint is not registered. Set this value to 'false' to 
        expose PubSub server on http.
    * Defaults to 'true'

stateIntervalInSecs = <seconds>
    * The number of seconds before a connection is flushed due to inactivity. The connection is not
        closed, only messages for that connection are flushed.
    * Defaults to 300 seconds (5 minutes).

##########################################################################################
# General file input settings.
##########################################################################################

[fileInput]

outputQueue = <queue name>
    * The queue that input methods should send their data to.  Most users will not need to
      change this value.
    * Defaults to parsingQueue.

##########################################################################################
# Settings controlling the behavior of 'splunk diag', the dignostic tool
##########################################################################################

[diag]

EXCLUDE-<class> = <glob expression>
    * Specifies a glob / shell pattern to be excluded from diags generated on this instance. 
    * Example: */etc/secret_app/local/*.conf

##########################################################################################
# License manager settings for configuring the license pool(s)
##########################################################################################

[license]
master_uri = [self|<uri>] 
    * An example of <uri>: <scheme>://<hostname>:<port>
active_group = Enterprise | Trial | Forwarder | Free
# these timeouts only matter if you have a master_uri set to remote master
connection_timeout = 30
    * Maximum time (in seconds) to wait before connection to master times out
send_timeout = 30
    * Maximum time (in seconds) to wait before sending data to master times out
receive_timeout = 30
    * Maximum time (in seconds) to wait before receiving data from master times out
squash_threshold = 1000
    * Advanced setting.  Periodically the indexer must report to license manager the
    data indexed broken down by source,sourcetype,host.  If the number of distinct
    source,sourcetype/host tuples grows over the squash_threshold, we squash the
    host/source values and only report a breakdown by sourcetype.  This is to
    prevent explosions in memory + license_usage.log lines.  Set this with care or 
    after consulting a Splunk Support engineer, it is an advanced parameter.

[lmpool:auto_generated_pool_forwarder]
    * This is the auto generated pool for the forwarder stack

description = <textual description of this license pool>
quota = MAX|<maximum amount allowed by this license>
    * MAX indicates the total capacity of the license. You may have only 1 pool with MAX size in a stack
    * The quota can also be specified as a specific size eg. 20MB, 1GB etc
slaves = *|<slave list>
    * An asterix(*) indicates that any slave can connect to this pool
    * You can also specifiy a comma separated slave guid list
stack_id = forwarder
    * the stack to which this pool belongs

[lmpool:auto_generated_pool_free]
    * This is the auto generated pool for the free stack
    * field descriptions are the same as that for the "lmpool:auto_generated_pool_forwarder"

[lmpool:auto_generated_pool_enterprise]
    * This is the auto generated pool for the enterprise stack
    * field descriptions are the same as that for the "lmpool:auto_generated_pool_forwarder"

[lmpool:auto_generated_pool_fixed-sourcetype_<sha256 hash of srctypes>]
    * This is the auto generated pool for the enterprise fixed srctype stack
    * field descriptions are the same as that for the "lmpool:auto_generated_pool_forwarder"

[lmpool:auto_generated_pool_download_trial]
    * This is the auto generated pool for the download trial stack
    * field descriptions are the same as that for the "lmpool:auto_generated_pool_forwarder"

#########################################################################################
# Search head pooling configuration
##########################################################################################

[pooling]

state = [enabled|disabled]
    * Enables or disables search head pooling.
    * Defaults to disabled.

storage = <path to shared storage>
    * All members of a search head pool must have access to shared storage.
    * Splunk will store configurations and search artifacts here.
    * On *NIX, this should be an NFS mount.
    * On Windows, this should be a UNC path to a Samba/CIFS share.

lock.timeout = <time range string>
    * Timeout for acquiring file-based locks on configuration files.
    * Splunk will wait up to this amount of time before aborting a configuration write.
    * Defaults to '10s' (10 seconds).

lock.logging = [true|false]
    * When acquiring a file-based lock, log information into the locked file.
    * This information typically includes:
        * Which host is acquiring the lock
        * What that host intends to do while holding the lock
    * There is no maximum filesize or rolling policy for this logging. If you
      enable this setting, you must periodically truncate the locked file
      yourself to prevent unbounded growth.
    * The information logged to the locked file is intended for debugging
      purposes only. Splunk makes no guarantees regarding the contents of the
      file. It may, for example, write padding NULs to the file or truncate the
      file at any time.
    * Defaults to false.

poll.interval.rebuild = <time range string>
    * Rebuild or refresh in-memory configuration data structures at most this often.
    * Defaults to '1s' (1 second).

poll.interval.check = <time range string>
    * Check on-disk configuration files for changes at most this often.
    * Defaults to '30s' (30 seconds).

poll.blacklist.<name> = <regex>
    * Do not check configuration files for changes if they match this regular expression.
    * Example: Do not check vim swap files for changes -- .swp$
