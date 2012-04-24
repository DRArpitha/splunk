# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# This file contains possible attributes and values you can use to configure distributed search.
#
# There is NO DEFAULT distsearch.conf.  
#
# To set custom configurations, place a distsearch.conf in $SPLUNK_HOME/etc/system/local/.  
# For examples, see distsearch.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles
#
# These attributes are all configured on the search head, with the exception of the optional attributes listed 
# under the SEARCH HEAD BUNDLE MOUNTING OPTIONS heading, which are configured on the search peers.

[distributedSearch]
* Set distributed search configuration options under this stanza name.
* Follow this stanza name with any number of the following attribute/value pairs.  
* If you do not set any attribute, Splunk uses the default value (if there is one listed).

disabled = [true|false]
* Toggle distributed search off (true) and on (false).
* Defaults to false (your distributed search stanza is enabled by default).

heartbeatMcastAddr = <IP address>
* Set a multicast address where each Splunk server sends and listens for heart beat messages.
* This allows Splunk servers to auto-discover other Splunk servers on your network.
* Defaults to 224.0.0.37.

heartbeatPort = <port>
* Set heartbeat port where each Splunk server sends and listens for heart beat messages.
* This allows Splunk servers to auto-discover other Splunk servers on your network.
* Defaults to 8888.

ttl = <integer>
* Time to live (ttl) of the heartbeat messages.
* Increasing this number allows the UDP multicast packets to spread beyond the current subnet to the specified number of hops.
* NOTE:  This will work only if routers along the way are configured to pass UDP multicast packets.
* Defaults to 1 (this subnet).  

heartbeatFrequency = <int, in seconds>
* The period between heartbeat messages, in seconds. Use 0 to disable sending of heartbeats.
* Defaults to 0.
  
statusTimeout = <int, in seconds>
* Set connection timeout when gathering a search peer's basic info (/services/server/info).
* Note: Read/write timeouts are automatically set to twice this value.
* Defaults to 10.
   
removedTimedOutServers = [true|false]
* If true, remove a server connection that cannot be made within serverTimeout. 
* If false, every call to that server attempts to connect. 
	* Note: This may result in a slow user interface.
* Defaults to false.

checkTimedOutServersFrequency = <integer, in seconds>
* This attribute is ONLY relevant if removeTimedOutServers is set to true. If removeTimedOutServers is false, 
  this attribute is ignored.
* Rechecks servers at this frequency (in seconds).  
* If this is set to 0, then no recheck will occur.
* Defaults to 60.   

autoAddServers = [true|false]
* If set to 'true', this node will automatically add all discovered servers.
* Defaults to false.

bestEffortSearch = [true|false]
* Whether to remove a peer from search when it does not have any of our bundles. 
* If set to true searches will never block on bundle replication, even when a peer is first adde - the 
* peers that don't have any common bundles will simply not be searched.
* Defaults to false

skipOurselves = [true|false]
* If set to 'true', this server will NOT participate as a server in any search or other call. 
* This is used for building a node that does nothing but merge the results from other servers. 
* Defaults to false.

servers = <comma separated list of servers>
* Initial list of servers.  
* If operating completely in 'autoAddServers' mode (discovering all servers), there is no need to list any servers here.

disabled_servers = <comma separated list of servers>
* A list of configured but disabled search peers.

shareBundles = [true|false]
* Indicates whether this server will use bundle replication to share search time configuration
  with search peers. 
* If set to false, the search head assumes that all the search peers can access the correct bundles 
  via share storage and have configured the options listed under "SEARCH HEAD BUNDLE MOUNTING OPTIONS".
* Defaults to true.

serverTimeout = <int, in seconds>
* DEPRECATED, please use  connectionTimeout, sendTimeout, receiveTimeout 

connectionTimeout = <int, in seconds>
* Amount of time in seconds to use as a timeout during search peer connection establishment.

sendTimeout = <int, in seconds>
* Amount of time in seconds to use as a timeout while trying to write/send data to a search peer.

receiveTimeout = <int, in seconds>
* Amount of time in seconds to use as a timeout while trying to read/receive data from a search peer.

#******************************************************************************
# DISTRIBUTED SEARCH KEY PAIR GENERATION OPTIONS
#******************************************************************************

[tokenExchKeys]

certDir = <directory>
* This directory contains the local Splunk instance's distributed search key pair.
* This directory also contains the public keys of servers that distribute searches to this Splunk instance.

publicKey = <filename>
* Name of public key file for this Splunk instance.

privateKey = <filename>
* Name of private key file for this Splunk instance.

genKeyScript = <command>
* Command used to generate the two files above.

#******************************************************************************
# REPLICATION SETTING OPTIONS
#******************************************************************************

[replicationSettings]

connectionTimeout = <int, in seconds>
* The maximum number of seconds to wait before timing out on inital connection to a peer.

sendRcvTimeout = <int, in seconds>
* The maximum number of seconds to wait for the sending of a full replication to a peer.

replicationThreads = <int, in seconds>
* The maximum number of threads to use when performing bundle replication to peers.
* Defaults to 1.

maxMemoryBundleSize = <int>
* The maximum size (in MB) of bundles to hold in memory. If the bundle is larger than this
* the bundles will be read and encoded on the fly for each peer the replication is taking place. 
* Defaults to 10

maxBundleSize = <int>
* The maximum size (in MB) of the bundle for which replication can occur. If the bundle is larger than this
* bundle replication will not occur and an error message will be logged.
* Defaults to: 1024 (1GB)

allowStreamUpload = <bool>
* Whether to enable streaming bundle replication. 
* Defaults to: false

#******************************************************************************
# REPLICATION WHITELIST OPTIONS
#******************************************************************************

[replicationWhitelist]

<name> = <whitelist_pattern>
* Controls Splunk's search-time conf replication from search heads to search nodes.
* Only files that match a whitelist entry will be replicated.
* Conversely, files which are not matched by any whitelist will not be replicated.
* Only files located under $SPLUNK_HOME/etc will ever be replicated in this way.
    * The regex will be matched against the filename, relative to $SPLUNK_HOME/etc.
      Example: for a file "$SPLUNK_HOME/etc/apps/fancy_app/default/inputs.conf"
               this whitelist should match "apps/fancy_app/default/inputs.conf"
    * Similarly, the etc/system files are available as system/... 
      user-specific files are available as users/username/appname/...
* The 'name' element is only functional in so far as allowing the setting to be
  overridden in the normal Splunk layering/bundle system.  It can, of course,
  also be used to hint at the target or goal of the particular whitelist.
* The whitelist_pattern is the Splunk-style pattern matching, which is primarily
  regex-based with special local behavior for '...' and '*'.
  * ... matches anything, while * matches anything besides directory separators.  
    See props.conf.spec for more detail on these.
  * Note '.' will match a literal dot, not any character.
* Note that these lists are applied globally across all conf data, not to any
  particular app, regardless of where they are defined.  Be careful to pull in
  only your intended files.

#******************************************************************************
# REPLICATION BLACKLIST OPTIONS
#******************************************************************************

[replicationBlacklist]

<name> = <blacklist_pattern>
* All comments from the replication whitelist notes above also apply here.
* Replication blacklist takes precedence over the whitelist, meaning that a
  file that matches both the whitelist and the blacklist will NOT be replicated.
* This can be used to prevent unwanted bundle replication in two common scenarios:
   * Very large files, which part of an app may not want to be replicated,
     especially if they are not needed on search nodes.
   * Frequently updated files (for example, some lookups) will trigger retransmission of
     all search head data.
* Note that these lists are applied globally across all conf data. Especially
  for blacklisting, be careful to constrain your blacklist to match only data
  your application will not need.


#******************************************************************************
# SEARCH HEAD BUNDLE MOUNTING OPTIONS 
# You set these attributes on the search peers only, and only if you also set shareBundles=false 
# in [distributedSearch] on the search head. Use them to achieve replication-less bundle access. The 
# search peers use a shared storage mountpoint to access the search head bundles ($SPLUNK_HOME/etc).
#******************************************************************************

[searchhead:<searchhead-splunk-server-name>]

mounted_bundles = [true|false]
* Determines whether the bundles belong to the search head specified in the stanza name are mounted.
* You must set this to "true" to use mounted bundles.
* Default is "false".

bundles_location = <path_to_bundles>
* The path to where the search head's bundles are mounted. This must be the mountpoint on the search peer, 
* not on the search head. This should point to a directory that is equivalent to $SPLUNK_HOME/etc/. It must
* contain at least the following subdirectories: system, apps, users.





