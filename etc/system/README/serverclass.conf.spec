# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# This file contains possible attributes and values for defining server classes to which 
# deployment clients can belong. These attributes and values specify what content a given server
# class member will receive from the deployment server. 
#
# To define server classes for this deployment server to use when deploying content to deployment 
# clients, place a serverclass.conf in $SPLUNK_HOME/etc/system/local/. 
# For examples, see serverclass.conf.example. You must restart Splunk for changes to this file
# to take effect.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles


#***************************************************************************
# Configure the server classes that are used by a deployment server instance.
#
# Server classes are essentially categories.  They use filters to control what
# clients they apply to, contain a set of applications, and may define
# deployment server behavior for the management of those applications.  The
# filters can be based on dns name, ip address, build number of client
# machines, platform, and so-called clientName tag strings.
# If a target machine matches the filter, then the apps and configuration
# content that make up the server class will be deployed to it.
#
# Property inheritance
# Stanzas in serverclass.conf go from general to more specific, in the following order:
# [serverClass] -> [serverClass:<name>] -> [serverClass:<scname>:app:<appname>]
#
# Some properties defined at a general level (say [serverClass]) can be
# overridden by the more specific stanzas as it applies to them. All inheritable
# properties are marked as such.
#***************************************************************************

# Global stanza that defines properties for all server classes.
[global]

repositoryLocation = <path>
    * The repository of applications on the server machine.
    * Can be overridden at the serverClass level.
    * Defaults to $SPLUNK_HOME/etc/deployment-apps

targetRepositoryLocation = <path>
    * The location on the deployment client to install the apps and configuration content defined for this server class.
    * If this value is unset, or set emptyr the repositoryLocation path is used.
    * Useful only for complex (for example, tiered) deployment strategies.
    * Defaults to $SPLUNK_HOME/etc/apps, the live configuration directory for a Splunk instance.

tmpFolder = <path>
    * Working folder used by deployment server.
    * Defaults to $SPLUNK_HOME/var/run/tmp

continueMatching = true | false
    * Controls how configuration is layered across classes and server-specific settings.
    * If true, configuration lookups continue matching server classes, beyond the first match.
    * If false, only the first match will be used.
    * A serverClass can override this property and stop the matching.
    * Matching is done in the order that server classes are defined.
    * Can be overridden at the serverClass level.
    * Defaults to true

endpoint = <URL template string>
    * The endpoint from which content can be downloaded by a deployment client. The deployment client knows how to substitute the values of the variables in the URL.
    * Any custom URL can also be supplied here as long as it uses the specified variables.
    * This attribute does not need to be specified unless you have very specific need, for example: to acquire deployment application files from a third-party httpd, for extremely large environments.
    * Can be overridden at the serverClass level.
    * Defaults to $deploymentServerUri$/services/streams/deployment?name=$serverClassName$:$appName$

filterType = whitelist | blacklist
    * The whitelist setting indicates a filtering strategy that pulls in a subset:
        * Items are not considered to match the stanza by default.
        * Items that match any whitelist entry, and do not match any blacklist entry are considered to match the stanza.
        * Items that match any blacklist entry are not considered to match the stanza, regardless of whitelist.
    * The blacklist setting indicates a filtering strategy that rules out a subset:
        * Items are considered to match the stanza by default.
        * Items that match any blacklist entry, and do not match any whitelist entry are considered to not match the stanza.
        * Items that match any whitelist entry are considered to match the stanza.
    * More briefly:
        * whitelist: default no-match -> whitelists enable -> blacklists disable
        * blacklist: default match -> blacklists disable-> whitelists enable
    * Can be overridden at the serverClass level, and the serverClass:app level.
    * Defaults to whitelist

whitelist.<n> = <clientName> | <ip address> | <hostname>
blacklist.<n> = <clientName> | <ip address> | <hostname>
    * 'n' is a number starting at 0, and increasing by 1. Stop looking at the filter when 'n' breaks.
    * The value of this attribute is matched against several things in order:
         * Any clientName specified by the client in its deploymentclient.conf file
         * The ip address of the connected client
         * The hostname of the connected client as provided by reverse DNS lookup
         * The hostname of the client as provided by the client
    * All of these can be used with wildcards.  * will match any sequence of characters.  For example:
        * Match an network range: 10.1.1.*
        * Match a domain: *.splunk.com
    * These patterns are PCRE regular expressions with the additional mappings:
        * '.' is mapped to '\.'
        * '*' is mapped to '.*'
    * Can be overridden at the serverClass level, and the serverClass:app level.
    * There are no whitelist or blacklist entries by default.

# Note: Overriding one type of filter (whitelist/blacklist) causes the other to
# the overridden too. It is important to note that if you are overriding the
# whitelist, the blacklist will not be inherited from the parent - you must
# provide one in the stanza.

# Example of when filterType is whitelist
# whitelist.0=*.splunk.com
# blacklist.0=printer.splunk.com
# blacklist.1=scanner.splunk.com
# This will cause all hosts in splunk.com, except 'printer' and 'scanner' to match this server class.

# Example of when filterType is blacklist
# blacklist.0=*
# whitelist.0=*.web.splunk.com
# whitelist.1=*.linux.splunk.com
# This will cause only the 'web' and 'linux' hosts to match the server class. No other hosts will match.

# client machineTypes can also be used to match clients.
# This setting lets you use the hardware type of the deployment client as a filter. 
# This filter will be used only if a client could not be matched using the whitelist/blacklist filter.
# The value for machineTypes is a specific string that is designated by the hardware platform itself. 
# The method for finding this string on the client itself will vary by platform, but if the deployment client 
# is already connected to the deployment server, you can determine what this string is by using this
# Splunk CLI command on the deployment server:
# <code>./splunk list deploy-clients</code>
# This will return a value for <code>utsname</code> that you can use to
# specify <code>machineTypes</code>.
machineTypes = <comma separated list>
    * This setting is deprecated. Use machineTypesFilter instead. If used, it will continue to work.
    * Not used unless specified.
    * Match any of the machine types in the comma-delimited list.
    * Commonly used machine types: linux-x86_64, windows-intel, linux-i686, freebsd-i386, darwin-i386, sunos-sun4u
    * This filter gets applied only if client matches whitelist/blacklist filter. To use a machineTypes filter even when
    * whitelist/blacklist fails, use 'machineTypesFilter' instead.
    * Be sure to include the 's' at the end of "machineTypes" 
    * This filter can be overridden at the serverClass and serverClass:app levels.
    * This value is unset by default.

machineTypesFilter = <comma separated list>
    * Not used unless specified.
    * Matches any of the machine types in the comma-delimited list.
    * Commonly used machine types: linux-x86_64, windows-intel, linux-i686, freebsd-i386, darwin-i386, sunos-sun4u
    * This filter gets applied along with whitelist/blacklist filter, if any.
    * This filter can be overridden at the serverClass and serverClass:app levels.
    * This filter is unset by default.
    * If both the machineTypes and machineTypesFilter attributes are specified, machineTypes is ignored.

restartSplunkWeb = True | False
    * If True, restart SplunkWeb on the client when a member app or directly configured app is updated.
    * Can be overridden at the serverClass level, and the serverClass:app level.
    * Defaults to False

restartSplunkd = True | False
    * If True, restart splunkd on the client when a member app or directly configured app is updated.
    * Can be overridden at the serverClass level, and the serverClass:app level.
    * Defaults to False

stateOnClient = enabled | disabled | noop
    * For enabled, set the application state to enabled on the client, regardless of state on the deployment server.
    * For disable, set the application state to disabled on the client, regardless of state on the deployment server.
    * For noop, the state on the client will be the same as on the deployment server.
    * Can be overridden at the serverClass level, and the serverClass:app level.
    * Defaults to enabled.

[serverClass:<serverClassName>]
    * This stanza defines a server class. A serverClass is a collection of applications.
    * serverClassName is a unique name that is assigned to this serverClass.
    * A serverClass can override all inheritable properties from the [serverClass] stanza.

#
# NOTE:
# the following keys listed below are all described in detail in the
# [global] section above, but can be used with serverClass stanza to
# override the global setting
#
continueMatching = true | false
endpoint = <URL template string>
filterType = whitelist | blacklist
whitelist.<n> = <clientName> | <ip address> | <hostname>
blacklist.<n> = <clientName> | <ip address> | <hostname>
machineTypes = <comma separated list>
machineTypesFilter = <comma separated list>
restartSplunkWeb = True | False
restartSplunkd = True | False
stateOnClient = enabled | disabled | noop
repositoryLocation = <path>

[serverClass:<server class name>:app:<app name>]
    * This stanza adds an application that exists in repositoryLocation to the server class.
    * server class name - the server class to which this content should be added. 
    * app name can be '*' or the name of an app:
        * The value '*' refers to all content in the repositoryLocation, adding it to this serverClass. '*' stanzas cannot be mixed with named stanzas.
        * Other values 'someAppName' explicitly adds the app/configuration content to a server class. Typically apps are named by the folders that contain them.
    * Important note on matching: A server class must be matched before content belonging to the server class will be matched by the system. 

appFile=<file name>
    * In cases where an appName is different from the file or directory name, you can use this parameter to specify the file name. Supported formats are: app directories, .tar or .tgz files.

