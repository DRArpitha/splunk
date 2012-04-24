# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 

# This file contains possible attributes and values you can use to configure inputs,
# distributed inputs such as forwarders, and file system monitoring in inputs.conf.
#
# There is an inputs.conf in $SPLUNK_HOME/etc/system/default/.  To set custom configurations, 
# place an inputs.conf in $SPLUNK_HOME/etc/system/local/.  For examples, see inputs.conf.example.
# You must restart Splunk to enable new configurations.
#
# To learn more about configuration files (including precedence), see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles
#

#*******
# GENERAL SETTINGS:
# The following attribute/value pairs are valid for all input types (except file system change monitor,
# which is described in a separate section in this file).
# You must first enter a stanza header in square brackets, specifying the input type. See further down 
# in this file for examples.   
# Then, use any of the following attribute/value pairs.
#*******

host = <string>
* Sets the host key/field to a static value for this stanza.
* Primarily used to control the host field, which will be used for events coming in
  via this input stanza.
* Detail: Sets the host key's initial value. The key is used during parsing/indexing, 
  in particular to set the host field. It is also the host field used at search time.
* As a convenience, the chosen string is prepended with 'host::'.
* If not set explicitly, this defaults to the IP address or fully qualified
  domain name of the host where the data originated.

index = <string>
* Sets the index to store events from this input.
* Primarily used to specify the index to store events coming in via this input stanza.
* Detail: Sets the index key's initial value. The key is used when selecting an
  index to store the events.
* Defaults to "main" (or whatever you have set as your default index).

source = <string>
* Sets the source key/field for events from this input.
* NOTE: Overriding the source key is generally not recommended.  Typically, the
  input layer will provide a more accurate string to aid in problem
  analysis and investigation, accurately recording the file from which the data
  was retreived.  Please consider use of source types, tagging, and search
  wildcards before overriding this value.
* Detail: Sets the source key's initial value. The key is used during
  parsing/indexing, in particular to set the source field during
  indexing.  It is also the source field used at search time.
* As a convenience, the chosen string is prepended with 'source::'.
* Defaults to the input file path.

sourcetype = <string>
* Sets the sourcetype key/field for events from this input.
* Primarily used to explicitly declare the source type for this data, as opposed
  to allowing it to be determined via automated methods.  This is typically
  important both for searchability and for applying the relevant configuration for this
  type of data during parsing and indexing.
* Detail: Sets the sourcetype key's initial value. The key is used during
  parsing/indexing, in particular to set the source type field during
  indexing. It is also the source type field used at search time.
* As a convenience, the chosen string is prepended with 'sourcetype::'.
* If unset, Splunk picks a source type based on various aspects of the data.
  There is no hard-coded default.

queue = [parsingQueue|indexQueue]
* Specifies where the input processor should deposit the events it reads.
* Set queue to "parsingQueue" to apply props.conf and other parsing rules to your data. For more 
information about props.conf and rules for timestamping and linebreaking, refer to props.conf and the 
online documentation at http://docs.splunk.com/Documentation.
* Set queue to "indexQueue" to send your data directly into the index.
* Defaults to parsingQueue.

# ***********
# This section contains options for routing data using inputs.conf rather than outputs.conf. 
# Note concerning routing via inputs.conf:
# This is a simplified set of routing options you can use as data is coming in. 
# For more flexible options or details on configuring required or optional settings, refer to 
# outputs.conf.spec.

_TCP_ROUTING = <tcpout_group_name>,<tcpout_group_name>,<tcpout_group_name>, ...
* Comma-separated list of tcpout group names.
* Using this, you can selectively forward the data to specific indexer(s).
* Specify the tcpout group the forwarder should use when forwarding the data.
  The tcpout group names are defined in outputs.conf with [tcpout:<tcpout_group_name>].
* Defaults to groups specified in "defaultGroup" in [tcpout] stanza in outputs.conf.
* To forward data from the "_internal" index, _TCP_ROUTING must explicitly be set to either "*" or
  a specific splunktcp target group.

_SYSLOG_ROUTING = <syslog_group_name>,<syslog_group_name>,<syslog_group_name>, ...
* Comma-separated list of syslog group names. 
* Using this, you can selectively forward the data to specific destinations as syslog events.
* Specify the syslog group to use when forwarding the data.
  The syslog group names are defined in outputs.conf with [syslog:<syslog_group_name>].
* Defaults to groups present in "defaultGroup" in [syslog] stanza in outputs.conf.
* The destination host must be configured in outputs.conf, using "server=[<ip>|<servername>]:<port>".


#*******
# Valid input types follow, along with their input-specific attributes:
#*******


#*******
# MONITOR:
#*******

[monitor://<path>]
* This directs Splunk to watch all files in <path>. 
* <path> can be an entire directory or just a single file.
* You must specify the input type and then the path, so put three slashes in your path if you're starting 
at the root (to include the slash that goes before the root directory).

# Additional attributes:

host_regex = <regular expression>
* If specified, <regular expression> extracts host from the path to the file for each input file. 
    * Detail: This feature examines the source key, so if source is set
      explicitly in the stanza, that string will be matched, not the original filename.
* Specifically, the first group of the regex is used as the host. 
* If the regex fails to match, the default "host =" attribute is used.
* If host_regex and host_segment are both set, host_regex will be ignored.
* Defaults to unset.

host_segment = <integer>
* If specified, the "/" separated segment of the path is set as host. If host_segment=3, for example, 
  the third segment is used.
* If the value is not an integer or is less than 1, the default "host =" attribute is used.
* Defaults to unset.

whitelist = <regular expression>
* If set, files from this path are monitored only if they match the specified regex.
* Takes precedence over the deprecated _whitelist attribute, which functions the same way.

blacklist = <regular expression>
* If set, files from this path are NOT monitored if they match the specified regex.
* Takes precedence over the deprecated _blacklist attribute, which functions the same way.

Note concerning wildcards and monitor:
* You can use wildcards to specify your input path for monitored input. Use "..." for recursive directory 
  matching and "*" for wildcard matching in a single directory segment.
* "..." recurses through directories. This means that /foo/.../bar will match foo/bar, foo/1/bar, 
  foo/1/2/bar, etc. 
* You can use multiple "..." specifications in a single input path. For example: /foo/.../bar/...
* The asterisk (*) matches anything in a single path segment; unlike "...", it does not recurse.  For example, 
  /foo/*/bar matches the files /foo/bar, /foo/1/bar, /foo/2/bar, etc. However, it does not match /foo/1/2/bar . 
  A second example: /foo/m*r/bar matches /foo/bar, /foo/mr/bar,   /foo/mir/bar, /foo/moor/bar, etc. 
* You can combine "*" and "..." as required: foo/.../bar/* matches any file in the bar directory within the 
  specified path.

crcSalt = <string>
* Use this setting to force Splunk to consume files that have matching CRCs (cyclic redundancy checks). (Splunk only 
  performs CRC checks against the first few lines of a file. This behavior prevents Splunk from indexing the same 
  file twice, even though you may have renamed it -- as, for example, with rolling log files. However, because the 
  CRC is based on only the first few lines of the file, it is possible for legitimately different files to have 
  matching CRCs, particularly if they have identical headers.)
* If set, <string> is added to the CRC.
* If set to the literal string <SOURCE> (including the angle brackets), the full directory path to the source file 
  is added to the CRC. This ensures that each file being monitored has a unique CRC.   When crcSalt is invoked, 
  it is usually set to <SOURCE>.
* Be cautious about using this attribute with rolling log files; it could lead to the log file being re-indexed 
  after it has rolled. 
* Defaults to empty. 

ignoreOlderThan = <time window>
* Causes the monitored input to stop checking files for updates if their modtime has passed this threshold.
  This improves the speed of file tracking operations when monitoring directory hierarchies with large numbers
  of historical files (for example, when active log files are colocated with old files that are no longer
  being written to).
  * As a result, do not select a cutoff that could ever occur for a file
    you wish to index.  Take downtime into account!  
    Suggested value: 14d , which means 2 weeks
* A file whose modtime falls outside this time window when seen for the first time will not be indexed at all.
* Value must be: <number><unit> (e.g., 7d is one week).  Valid units are d (days), m (minutes), and s (seconds).
* Default: disabled.
	
followTail = [0|1]
* Determines whether to start monitoring at the beginning of a file or at the end (and then index all events 
  that come in after that). 
* If set to 1, monitoring begins at the end of the file (like tail -f).
* If set to 0, Splunk will always start at the beginning of the file. 
* This only applies to files the first time Splunk sees them. After that, Splunk's internal file position 
  records keep track of the file. 
* Defaults to 0.
 
alwaysOpenFile = [0|1]
* Opens a file to check whether it has already been indexed.
* Only useful for files that don't update modtime.
* Only needed when monitoring files on Windows, mostly for IIS logs.
* This flag should only be used as a last resort, as it increases load and slows down indexing.
* Defaults to 0.

time_before_close = <integer>
* Modtime delta required before Splunk can close a file on EOF.
* Tells the system not to close files that have been updated in past <integer> seconds.
* Defaults to 3.

recursive = [true|false]
* If false, Splunk will not monitor subdirectories found within a monitored directory.
* Defaults to true.

followSymlink = [true|false]
* If false, Splunk will ignore symbolic links found within a monitored directory.
* Defaults to true. 

_whitelist = ...
* This setting is deprecated.  It is still honored, unless "whitelist" attribute also exists.

_blacklist = ...
* This setting is deprecated.  It is still honored, unless "blacklist" attribute also exists.

dedicatedFD = ...
* This setting has been removed.  It is no longer needed.

  
#****************************************
# BATCH  ("Upload a file" in Splunk Web):
#****************************************

NOTE: Batch should only be used for large archives of historic data. If you want to continuously monitor a directory 
or index small archives, use monitor (see above). Batch reads in the file and indexes it, and then deletes the file 
from the Splunk instance. 

[batch://<path>]
* One time, destructive input of files in <path>.
* For continuous, non-destructive inputs of files, use monitor instead.

# Additional attributes:

move_policy = sinkhole
* IMPORTANT: This attribute/value pair is required. You *must* include "move_policy = sinkhole" when defining batch 
  inputs.
* This loads the file destructively.  
* Do not use the batch input type for files you do not want to consume destructively.

host_regex = see MONITOR, above.
host_segment = see MONITOR, above.
crcSalt = see MONITOR, above.

# IMPORTANT: The following attribute is not used by batch:
# source = <string>

followSymlink = [true|false]
* Works similarly to monitor, but will not delete files after following a symlink out of the monitored directory.

# The following settings work identically as for [monitor::] stanzas, documented above
host_regex = <regular expression>
host_segment = <integer>
crcSalt = <string>
recursive = [true|false]
whitelist = <regular expression>
blacklist = <regular expression>

#*******
# TCP: 
#*******

[tcp://<remote server>:<port>]
* Configure Splunk to listen on a specific port. 
* If a connection is made from <remote server>, this stanza is used to configure the input.
* If <remote server> is empty, this stanza matches all connections on the specified port.
* Will generate events with source set to tcp:portnumber,  for example: tcp:514
* If sourcetype is unspecified, will generate events with set sourcetype to tcp-raw.

# Additional attributes:

connection_host = [ip|dns|none]
* "ip" sets the host to the IP address of the system sending the data. 
* "dns" sets the host to the reverse DNS entry for IP address of the system sending the data.
* "none" leaves the host as specified in inputs.conf, typically the splunk system hostname.
* Defaults to "dns".

queueSize = <integer>[KB|MB|GB]
* Maximum size of the in-memory input queue. 
* Defaults to 500KB.

persistentQueueSize = <integer>[KB|MB|GB|TB]
* Maximum size of the persistent queue file.
* Defaults to 0 (no persistent queue).
* Persistent queues can help prevent loss of transient data. For information on persistent queues and how the 
  queueSize and persistentQueueSize settings interact, see the online documentation.

requireHeader = <bool>
* Require a header be present at the beginning of every stream.
* This header may be used to override indexing settings.
* Defaults to false.

listenOnIPv6 = <no | yes | only>
* Toggle whether this listening port will listen on IPv4, IPv6, or both
* If not present, the setting in the [general] stanza of server.conf will be used

rawTcpDoneTimeout = <seconds>
* Specifies timeout value for sending Done-key.
* If a connection over this port remains idle after receiving data for specified seconds,
  it adds a Done-key, implying the last event has been completely received.
* Defaults to 10 second.

#*******
# Data distribution:
#*******

# Global settings for splunktcp. Used on the receiving side for data forwarded from a forwarder.

[splunktcp]
route = [has_key|absent_key:<key>:<queueName>;...]
* Settings for the light forwarder.
* Splunk sets these parameters automatically -- you DO NOT need to set them.
* The property route is composed of rules delimited by ';'.
* Splunk checks each incoming data payload via cooked tcp port against the route rules. 
* If a matching rule is found, Splunk sends the payload to the specified <queueName>.
* If no matching rule is found, Splunk sends the payload to the default queue
  specified by any queue= for this stanza. If no queue= key is set in
  the stanza or globally, the events will be sent to the parsingQueue. 

compressed = [true|false]
* Specifies whether receiving compressed data.
* If set to true, the forwarder port(s) should also have compression turned on; otherwise, the receiver will 
  reject the connection.
* Defaults to false.

enableS2SHeartbeat = [true|false]
* This specifies the global keepalive setting for all splunktcp ports.
* This option is used to detect forwarders which may have become unavailable due to network, firewall, etc., problems.
* Splunk will monitor each connection for presence of heartbeat, and if the heartbeat is not seen for 
  s2sHeartbeatTimeout seconds, it will close the connection.
* Defaults to true (heartbeat monitoring enabled).


s2sHeartbeatTimeout = <seconds>
* This specifies the global timeout value for monitoring heartbeats.
* Splunk will will close a forwarder connection if heartbeat is not seen for s2sHeartbeatTimeout seconds.
* Defaults to 600 seconds (10 minutes).

inputShutdownTimeout = <seconds>
* Used during shutdown to minimize data loss when forwarders are connected to a receiver. 
  During shutdown, the tcp input processor waits for the specified number of seconds and then 
  closes any remaining open connections. If, however, all connections close before the end of 
  the timeout period, shutdown proceeds immediately, without waiting for the timeout.

# Forwarder-specific settings for splunktcp. 

[splunktcp://[<remote server>]:<port>]
* This input stanza is used with Splunk instances receiving data from forwarders ("receivers"). See the topic 
  http://docs.splunk.com/Documentation/Splunk/latest/deploy/Aboutforwardingandreceivingdata for more information.
* This is the same as TCP, except the remote server is assumed to be a Splunk instance, most likely a forwarder. 
* <remote server> is optional.  If specified, will only listen for data from <remote server>.

connection_host = [ip|dns|none]
* For splunktcp, the host or connection_host will be used if the remote Splunk instance does not set a host, 
  or if the host is set to "<host>::<localhost>".
* "ip" sets the host to the IP address of the system sending the data. 
* "dns" sets the host to the reverse DNS entry for IP address of the system sending the data.
* "none" leaves the host as specified in inputs.conf, typically the splunk system hostname.
* Defaults to "ip".

enableS2SHeartbeat = [true|false]
* This specifies the keepalive setting for the splunktcp port.
* This option is used to detect forwarders which may have become unavailable due to network, firewall, etc., problems.
* Splunk will monitor the connection for presence of heartbeat, and if the heartbeat is not seen for 
  s2sHeartbeatTimeout seconds, it will close the connection.
* This overrides the default value specified at the global [splunktcp] stanza.
* Defaults to true (heartbeat monitoring enabled).

s2sHeartbeatTimeout = <seconds>
* This specifies the timeout value for monitoring heartbeats.
* Splunk will will close the forwarder connection if heartbeat is not seen for s2sHeartbeatTimeout seconds.
* This overrides the default value specified at global [splunktcp] stanza.
* Defaults to 600 seconds (10 minutes).

queueSize = <integer>[KB|MB|GB]
* Maximum size of the in-memory input queue.
* Defaults to 500KB.

listenOnIPv6 = <no | yes | only>
* Toggle whether this listening port will listen on IPv4, IPv6, or both
* If not present, the setting in the [general] stanza of server.conf will be used

# SSL settings for data distribution:

[splunktcp-ssl:<port>]
* Use this stanza type if you are receiving encrypted, parsed data from a forwarder.
* Set <port> to the port on which the forwarder is sending the encrypted data.
* Forwarder settings are set in outputs.conf on the forwarder.

connection_host = [ip|dns|none]
* For SplunkTCP, the host or connection_host will be used if the remote Splunk instance does not set a host, 
  or if the host is set to "<host>::<localhost>".
* "ip" sets the host to the IP address of the system sending the data. 
* "dns" sets the host to the reverse DNS entry for IP address of the system sending the data.
* "none" leaves the host as specified in inputs.conf, typically the splunk system hostname.
* Defaults to "ip".

enableS2SHeartbeat = true|false
* See comments for [splunktcp:<port>].

s2sHeartbeatTimeout = <seconds>
* See comments for [splunktcp:<port>].

compressed = [true|false]
* Specifies whether receiving compressed data.
* If set to true, the forwarder port must also have compression turned on.
* Defaults to false.

listenOnIPv6 = <no | yes | only>
* Toggle whether this listening port will listen on IPv4, IPv6, or both
* If not present, the setting in the [general] stanza of server.conf will be used

[tcp-ssl:<port>]
* Use this stanza type if you are receiving encrypted, unparsed data from a forwarder or third-party system.
* Set <port> to the port on which the forwarder/third-party system is sending unparsed, encrypted data.
	
listenOnIPv6 = <no | yes | only>
* Toggle whether this listening port will listen on IPv4, IPv6, or both
* If not present, the setting in the [general] stanza of server.conf will be used

[SSL]
* Set the following specifications for SSL underneath this stanza name:

serverCert = <path>
* Full path to the server certificate.
	
password = <string>
* Server certificate password, if any.

rootCA = <string>
* Certificate authority list (root file).

requireClientCert = [true|false]
* Determines whether a client must authenticate.
* Defaults to false.

supportSSLV3Only = [true|false]
* If true, tells the inputproc to accept connections only from SSLv3 clients.
* Defaults to false.

cipherSuite = <cipher suite string>
* If set, uses the specified cipher string for the input processors.
* If not set, the default cipher string is used.
* Provided by OpenSSL. This is used to ensure that the server does not
  accept connections using weak encryption protocols.


#*******
# UDP:
#*******

[udp://<remote server>:<port>]
* Similar to TCP, except that it listens on a UDP port.
* Only one stanza per port number is currently supported.
* Configure Splunk to listen on a specific port. 
* If <remote server> is specified, the specified port will only accept data from that server.
* If <remote server> is empty - [udp://<port>] - the port will accept data sent from any server.
* Will generate events with source set to udp:portnumber, for example: udp:514
* If sourcetype is unspecified, will generate events with set sourcetype to udp:portnumber .

# Additional attributes:

connection_host = [ip|dns|none]
* "ip" sets the host to the IP address of the system sending the data. 
* "dns" sets the host to the reverse DNS entry for IP address of the system sending the data.
* "none" leaves the host as specified in inputs.conf, typically the splunk system hostname.
* Defaults to "ip".

_rcvbuf = <integer>
* Specifies the receive buffer for the UDP port (in bytes).  
* If the value is 0 or negative, it is ignored.  
* Defaults to 1,572,864.
* Note: If the default value is too large for an OS, Splunk will try to set the value to 1572864/2. If that value also fails, 
  Splunk will retry with 1572864/(2*2). It will continue to retry by halving the value until it succeeds.

no_priority_stripping = [true|false]
* Setting for receiving syslog data. 
* If this attribute is set to true, Splunk does NOT strip the <priority> syslog field from received events. 
* NOTE: Do NOT include this attribute if you want to strip <priority>.
* Default is false.

no_appending_timestamp = [true|false]
* If this attribute is set to true, Splunk does NOT append a timestamp and host to received events.
* NOTE: Do NOT include this attribute if you want to append timestamp and host to received events.
* Default is false.
 
queueSize = <integer>[KB|MB|GB]
* Maximum size of the in-memory input queue.
* Defaults to 500KB.

persistentQueueSize = <integer>[KB|MB|GB|TB]
* Maximum size of the persistent queue file.
* Defaults to 0 (no persistent queue).
* Persistent queues can help prevent loss of transient data. For information on persistent queues and how the 
  queueSize and persistentQueueSize settings interact, see the online documentation.

listenOnIPv6 = <no | yes | only>
* Toggle whether this port will listen on IPv4, IPv6, or both
* If not present, the setting in the [general] stanza of server.conf will be used

#*******
# FIFO:
#*******

[fifo://<path>]
* This directs Splunk to read from a FIFO at the specified path.

queueSize = <integer>[KB|MB|GB]
* Maximum size of the in-memory input queue.
* Defaults to 500KB.

persistentQueueSize = <integer>[KB|MB|GB|TB]
* Maximum size of the persistent queue file.
* Defaults to 0 (no persistent queue).
* Persistent queues can help prevent loss of transient data. For information on persistent queues and how the 
  queueSize and persistentQueueSize settings interact, see the online documentation.


#*******
# Scripted Input:
#*******

[script://<cmd>]
* Runs <cmd> at a configured interval (see below) and indexes the output.  
* The <cmd> must reside in one of 
  *  $SPLUNK_HOME/etc/system/bin/
  *  $SPLUNK_HOME/etc/apps/$YOUR_APP/bin/
  *   $SPLUNK_HOME/bin/scripts/
* Splunk on Windows ships with several Windows-only scripted inputs. Check towards the end of the inputs.conf.example 
  for examples of the stanzas for specific Windows scripted inputs that you must add to your local inputs.conf file.
* <cmd> can also be a path to a file that ends with a ".path" suffix. A file with this suffix is a special type of 
  pointer file that points to a command to be executed.  Although the pointer file is bound by the same location
  restrictions mentioned above, the command referenced inside it can reside anywhere on the file system.  
  This file must contain exactly one line: the path to the command to execute, optionally followed by 
  command line arguments.  Additional empty lines and lines that begin with '#' are also permitted and will be ignored.

interval = [<integer>|<cron schedule>]
* How often to execute the specified command (in seconds), or a valid cron schedule. 
* NOTE: when a cron schedule is specified, the script is not executed on start-up.
* Defaults to 60 seconds.

passAuth = <username>
* User to run the script as.
* If you provide a username, Splunk generates an auth token for that user and passes it to the script via stdin.
    
queueSize = <integer>[KB|MB|GB]
* Maximum size of the in-memory input queue.
* Defaults to 500KB.

persistentQueueSize = <integer>[KB|MB|GB|TB]
* Maximum size of the persistent queue file.
* Defaults to 0 (no persistent queue).
* Persistent queues can help prevent loss of transient data. For information on persistent queues and how the 
  queueSize and persistentQueueSize settings interact, see the online documentation.


#*******
# File system change monitor (fschange monitor)
#*******

NOTE: You cannot simultaneously watch a directory using both fschange monitor and monitor (described above).

[fschange:<path>]
* Monitors all add/update/deletes to this directory and its subdirectories.
* NOTE: <path> is the direct path.  You do not need to preface it with // like other inputs.
* Sends an event for every change.

# Additional attributes:
# NOTE: fschange does not use the same attributes as other input types (described above).  Use only the following attributes:

index = <indexname>
* The index in which to store all generated events. 
* Defaults to _audit, unless you do not set signedaudit (below) or set signedaudit = false, in which case events go 
  into the default index.

signedaudit = [true|false]
* Send cryptographically signed add/update/delete events.
* If set to true, events are *always* sent to the _audit index and will *always* have the source type "audittrail".
* If set to false, events are placed in the default index and the source type is whatever you specify (or 
 "fs_notification" by default).
* You must set signedaudit to false if you want to set the index.
* NOTE: You must also enable auditing in audit.conf.
* Defaults to false.

filters = <filter1>,<filter2>,...
* Each filter is applied left to right for each file or directory found during the monitor's poll cycle. 
* See "File System Monitoring Filters" below for help defining a filter.

recurse = [true|false]
* If true, recurse directories within the directory specified in [fschange].
* Defaults to true.

followLinks = [true|false]
* If true, follow symbolic links. 
* It is recommended that you do not set this to true; file system loops can occur. 
* Defaults to false.

pollPeriod = <integer>
* Check this directory for changes every <integer> seconds. 
* Defaults to 3600 seconds (1 hour).

hashMaxSize = <integer>
* Calculate a SHA256 hash for every file that is less than or equal to <integer> bytes. 
* This hash is used as an additional method for detecting changes to the file/directory. 
* Defaults to -1 (disabled).

fullEvent = [true|false]
* Set to true to send the full event if an add or update change is detected. 
* Further qualified by the sendEventMaxSize attribute. 
* Defaults to false.

sendEventMaxSize  = <integer>
* Only send the full event if the size of the event is less than or equal to <integer> bytes. 
* This limits the size of indexed file data. 
* Defaults to -1, which is unlimited.

sourcetype = <string>
* Set the source type for events from this input.
* "sourcetype=" is automatically prepended to <string>.
* Defaults to audittrail (if signedaudit=true) or fs_notification (if signedaudit=false).

host = <string>
* Set the host for events from this input.
* Defaults to whatever host sent the event.

filesPerDelay = <integer>
* Injects a delay specified by delayInMills after processing <integer> files.
* This is used to throttle file system monitoring so it doesn't consume as much CPU.
* Defaults to 10.

delayInMills = <integer>
* The delay in milliseconds to use after processing every <integer> files, as specified in filesPerDelay.
* This is used to throttle file system monitoring so it doesn't consume as much CPU.
* Defaults to 100.


#*******
# File system monitoring filters:
#*******

[filter:<filtertype>:<filtername>]
* Define a filter of type <filtertype> and name it <filtername>.
* <filtertype>:
  * Filter types are either 'blacklist' or 'whitelist.' 
  * A whitelist filter processes all file names that match the regex list.
  * A blacklist filter skips all file names that match the regex list.
* <filtername>
  * The filter name is used in the comma-separated list when defining a file system monitor.
	
regex<integer> = <regex>	
* Blacklist and whitelist filters can include a set of regexes.
* The name of each regex MUST be 'regex<integer>', where <integer> starts at 1 and increments. 
* Splunk applies each regex in numeric order:
  regex1=<regex>
  regex2=<regex>
  ...

#*******
# WINDOWS INPUTS:
#*******

* Windows platform specific input processor.
* The Security, Application, and System event log inputs are enabled by 
default.  To disable an input type, comment it out or set disabled = 1 in
$SPLUNK_HOME\etc\apps\windows\local\inputs.conf
* You can configure Splunk to read other Windows event logs as well, but
you must first import them to the Windows Event Viewer, and then add them
to your local copy of inputs.conf (in
$SPLUNK_HOME\etc\apps\windows\local\inputs.conf). Use the same format as 
the examples shown below and add the attribute/value pair "disabled = 0". 

[WinEventLog:<Log Name>] 
* Define a Windows Event Log to monitor.

disabled = [1|0]
* Enable (0) or disable (1) this input.

start_from = <string> [oldest|newest]
* oldest - Start reading Windows Event Log chronologically from oldest to newest.
* newest - Start reading Windows Event Log in reverse, from newest to oldest.  Once the
  backlog of events is consumed, Splunk will start picking up the newest events.
  * 'newest' is not supported in combination with current_only = 1 (This
    combination does not make much sense.)
* Defaults to oldest.

current_only = [1|0]
* If set to 1, the input will only acquire events that arrive after the input
  is turned on for the first time, like unix 'tail -f'.
  * current_only = 1 is not supported with start_from = 'newest'. (It would
    not really make sense.)
* If set to 0, the input will first get all existing events in the log and then
  continue to monitor events coming in real time.
* Defaults to 0 (false), gathering stored events first before monitoring live events.

checkpointInterval = <seconds>
* Sets how frequently the Windows Event Log input will save a checkpoint,
  storing the eventID of the acquired events, which allows splunk to continue
  monitoring at the correct event after shutdown or outage.
* The default value is 5.

evt_resolve_ad_obj = [1|0] 
* Enables (1)/disables (0) the resolution of Active Directory objects like Globally Unique IDentifier (GUID) and Security IDentifier (SID) objects to their
canonical names for a specific Windows event log channel.  
* By default, this option is enabled (1) for Security event logs, disabled for all others.
* If this parameter is missing, resolution would be disabled.
* Optionally, you can specify the Domain Controller name and/or DNS name of the
domain to bind to, which Splunk will then use to resolve the AD objects.

evt_dc_name = <string> 
* Optional. This parameter can be left empty. 
* Domain Controller Name to bind to in order to resolve AD objects.  
* This name can be the NetBIOS name of the domain controller or the fully-
qualified DNS name of the domain controller. Either name type can, optionally,
be preceded by two backslash characters.  The following examples represent
correctly formatted domain controller names:

    * "FTW-DC-01"
    * "\\FTW-DC-01"
    * "FTW-DC-01.splunk.com"
    * "\\FTW-DC-01.splunk.com"

evt_dns_name = <string> 
* Optional. This parameter can be left empty.  
* Fully-qualified DNS name of the domain to bind to.

# ***********
# Splunk for Windows ships with several Windows-only scripted inputs. They are defined in the default inputs.conf.  
 
* This is a list of the Windows scripted input stanzas:
    [script://$SPLUNK_HOME\bin\scripts\splunk-wmi.path]
    [script://$SPLUNK_HOME\bin\scripts\splunk-regmon.path]
    [script://$SPLUNK_HOME\bin\scripts\splunk-admon.path]
    [script://$SPLUNK_HOME\bin\scripts\splunk-perfmon.path]

* By default, some of the scripted inputs are enabled and others are disabled.  
* Use the "disabled=" parameter to enable/disable any of them.
* Here's a short summary of the inputs:
  * WMI: Retrieves event logs remotely and locally. It can also gather
    performance data remltey, as well as receive various system notifications.
  * RegMon: Uses a driver to track and report any changes that occur in the
    local system's Registry.
  * ADMon: Indexes existing AD objects and listens for AD changes.
  * PerfMon: Retrieves performance metrics.
