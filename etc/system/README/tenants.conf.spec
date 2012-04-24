

# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# Use tenants.conf to redirect incoming requests from deployment clients to another deployment 
# server or servers. This is typically used for offloading load on your splunkd's HTTP server. 
# This is not a typical configuration for deployment server. There is no default tenants.conf
#
# *There is no need to create/edit tenants.conf* unless you have worked with Splunk Professional 
# Services to design a custom deployment that includes explicit involvement of tenants.conf. 
#
# To set custom configurations, place a pubsub.conf in $SPLUNK_HOME/etc/system/local/. 
# For examples, see pubsub.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles

#***************************************************************************
# Configure tenants (DeploymentServer instances) within the same Splunk server.
# 
# Multiple instances of deployment servers can be configured withing the same Splunk instance 
# using this configuration file.
# If this file is missing, a default DeploymentServer for tenant='default'is configured 
# by the system, if there exists serverclass.conf or default-serverclass.conf.
#
# It is possible to redirect deployment clients to the appropriate instance of deployment server
# by using a whitelist/blacklist mechanism, similar to the one in serverclass.conf.
#
# How does it all work?
# A DeploymentClient does a handshake with TenantService to determine which DeploymentServer
# it should be talking to. The TenantService will use this configuration to redirect a 
# client to the appropriate deployment server (represented by phoneHomeTopic).
#
# How is multi-tenant configuration stored?
# Server class configuration for each tenant should be made available in:
# <tenantName>-serverclass.conf
# 
# Configuration for the 'default' tenant can also be in 'serverclass.conf' - note the missing
# tenantName prefix.
#***************************************************************************

[tenant:<tenantName>]

filterType = <whitelist or blacklist>
    * defaults to whitelist

whitelist.<n> = <ipAddress or hostname or clientName>
blacklist.<n> = <ipAddress of hostname of clientName>

    * 'n' is a number starting at 0, and increasing by 1. Stop looking at the filter when 'n' breaks.
    * ipAddress of deployment client. Can also use wildcards as 10.1.1.*
    * hostname of deployment client. Can also use wildcards as *.splunk.com.
    * clientName- a logical or 'tag' name that can be assigned to each deployment client in deploymentclient.conf. clientName takes precedence (over ip/hostname) when matching a client to a filter.

# Internal.
phoneHomeTopic=deploymentServer/phoneHome/$tenantName$
    * some unique suffix. Default is to use the tenant name. Make sure this value is unique.
    * Override this value only when you wish to script and roll your own deployment server.

