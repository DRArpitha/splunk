# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 
#
# This file contains possible attribute/value pairs for creating custom time 
# ranges.
#
# To set custom configurations, place a times.conf in $SPLUNK_HOME/etc/system/local/. 
# For help, see times.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles


[<timerange_name>]
    * The token to be used when accessing time ranges via the API or command line
    * A times.conf file can contain multiple stanzas. 

label = <string>
    * The textual description used by the UI to reference this time range
    * Required

header_label = <string>
    * The textual description used by the UI when displaying search results in
      this time range.
    * Optional.  If omitted, the <timerange_name> is used instead.

earliest_time = <relative_time_identifier>
    * The relative time identifier string that represents the earliest event to
      to return, inclusive.
    * Optional.  If omitted, no earliest time bound is used.

latest_time = <relative_time_identifier>
    * The relative time identifier string that represents the latest event to
      to return, exclusive.
    * Optional.  If omitted, no latest time bound is used.  NOTE: events that
      occur in the future (relative to the server timezone) may be returned.
    
order = <integer>
	* The key on which all custom time ranges are sorted, ascending.
	* The default time range selector in the UI will merge and sort all time
	  ranges according to the 'order' key, and then alphabetically.
	* Optional.  Default value is 0.

sub_menu = <submenu name>
	* if present, the time range is to be shown in the given submenu instead 
	  of in the main menu.  
	* the value for this key must be the label key of an existing stanza name, 
	  and that stanza name must have an is_sub_menu = True key
	* Optional. If omitted the given time option will display in the main menu.    

is_sub_menu = <boolean>
	* If True, the given item is only the 'opener' element for a submenu. 
	* stanzas containing this key can still be assigned an order value to set
	  the placement within the main menu, but can not themselves have 
	  latest_time nor earliest_time keys.
	
