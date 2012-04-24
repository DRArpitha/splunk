# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 
#
# This file contains attribute/value pairs to use when configuring Windows 
# Active Directory monitoring.
# 
# To learn more about configuration files (including precedence) please see
# the documentation located at 
# http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles

[<stanza name>]
* A unique name that represents a configuration or set of configurations for
  a specific domain controller (DC).
* Multiple configurations are possible for any given DC.

targetDc = <string>
* Specifies a fully qualified domain name of a valid, network-accessible DC. 
* If not specified, Splunk will obtain the local computer's DC by default, and
  bind to its root Distinguished Name (DN).

startingNode = <string>
* Tells Splunk where in the Active Directory directory tree to start monitoring. 
* If not specified, Splunk will attempt to start at the root of the directory
  tree, by default.
* Where Splunk starts monitoring is determined by the user Splunk is configured
  to run as on the computer running Active Directory monitor.

monitorSubtree = [0|1]
* Tells Splunk whether or not to monitor the subtree(s) of a given directory
  tree path.
* Defaults to 1 (monitor subtrees of a given directory tree path).

disabled = [0|1]
* Tells Splunk whether or not the stanza is enabled.
* Defaults to 0 (enabled.)

index = <string>
* Tells Splunk which index to store incoming data into for this stanza.
* This field is optional.
* Defaults to the default index.
