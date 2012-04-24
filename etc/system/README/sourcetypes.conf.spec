# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved. Version 4.3.1 
#
# NOTE: sourcetypes.conf is a machine-generated file that stores the document models used by the 
# file classifier for creating source types.

# Generally, you should not edit sourcetypes.conf, as most attributes are machine generated.
# However, there are two attributes which you can change.
#
# There is a sourcetypes.conf in $SPLUNK_HOME/etc/system/default/ To set custom 
# configurations, place a sourcetypes..conf in $SPLUNK_HOME/etc/system/local/. 
# For examples, see sourcetypes.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles


_sourcetype = <value>
	* Specifies the sourcetype for the model.
	* Change this to change the model's sourcetype.
	* Future sources that match the model will receive a sourcetype of this new name.


_source = <value>
	* Specifies the source (filename) for the model.
