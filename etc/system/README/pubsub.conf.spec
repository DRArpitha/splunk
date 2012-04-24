# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# This file contains possible attributes and values for configuring a client of the PubSub system (broker).
#
# To set custom configurations, place a pubsub.conf in $SPLUNK_HOME/etc/system/local/. 
# For examples, see pubsub.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles

#******************************************************************
# Configure the physical location where deploymentServer is running.
# This configuration is used by the clients of the pubsub system.
#******************************************************************
[pubsub-server:deploymentServer]

disabled = <false or true>
    * defaults to 'false'

targetUri = <IP:Port or hostname:Port or "direct">
    * specify either the url of a remote server in case the broker is remote, or just the keyword "direct" when broker is in-process.
    * It is usually a good idea to co-locate the broker and the Deployment Server on the same Splunk. In such a configuration, all 
    * deployment clients would have targetUri set to deploymentServer:port.

#******************************************************************
# The following section is only relevant to Splunk developers.
#******************************************************************

# This "direct" configuration is always available, and cannot be overridden.
[pubsub-server:direct]
disabled = false
targetUri = direct

[pubsub-server:<logicalName>]
    * It is possible for any Splunk to be a broker. If you have multiple brokers, assign a logicalName that is used by the clients to refer to it.

disabled = <false or true>
    * defaults to 'false'

targetUri = <IP:Port or hostname:Port or "direct">
    * The Uri of a Splunk that is being used as a broker.
    * The keyword "direct" implies that the client is running on the same Splunk instance as the broker.

