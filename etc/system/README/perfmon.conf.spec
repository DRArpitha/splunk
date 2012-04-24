# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 
#
# This file contains possible attribute/value pairs for configuring Splunk's
# Windows Performance Monitor.  
#
# There is a perfmon.conf in $SPLUNK_HOME\etc\system\default\.  To set custom
# configurations, place a perfmon.conf in $SPLUNK_HOME\etc\system\local\. For
# examples, see perfmon.conf.example.  You must restart Splunk to enable
# configurations.
# 
# To learn more about configuration files (including precedence) please see the
# documentation located at
# http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles

###############################################################################
#----PERFMON SETTINGS-----
#
# Each [Perfmon:] stanza represents an individually configured performance
# monitoring input.  The value of "$NAME" will match what was specified in
# Splunk Web.  Splunk recommends that you use the Manager interface to configure
# performance monitor inputs because it is easy to mistype the values for
# Performance Monitor objects, counters and instances.
#
# Note: perfmon.conf is for local systems ONLY.  When defining performance
# monitor inputs for remote machines, use wmi.conf.
###############################################################################

[PERFMON:{NAME}]

object = <string>
* This is a valid Performance Monitor object as defined within Performance
  Monitor (for example, "Process," "Server," "PhysicalDisk.")
* You can only specify a single valid Performance Monitor object per input.
* This attribute is required, and the input will not run if the attribute is not
  present.
* There is no default.

counters = <semicolon-separated strings>
* This can be a single counter, or multiple valid Performance Monitor counters.
* This attribute is required, and the input will not run if the attribute is not
  present.
* '*' is equivalent to all available counters for a given Performance Monitor object.
* There is no default.

instances = <semicolon-separated strings>
* This can be a single instance, or multiple valid Performance Monitor
  instances.
* '*' is  equivalent to all available instances for a given Performance Monitor
  counter.
* If applicable instances are available for a counter and this attribute is not
  present, then all available instances are specified (this is the same as
  setting 'instances = *').
* If there are no applicable instances for a counter, then this attribute
  can be safely omitted.
* There is no default.

interval = <integer>
* How often, in seconds, to poll for new data.
* This attribute is required, and the input will not run if the attribute is not
  present.
* The recommended setting depends on the Performance Monitor object,
  counter(s) and instance(s) you are defining in the input, and how much 
  performance data you require for the input.  Objects with numerous
  instantaneous or per-second counters, such as "Memory," "Processor" and
  "PhysicalDisk" should have shorter interval times specified (anywhere
  from 1-3 seconds). Less volatile counters such as "Terminal Services,"
  "Paging File" and "Print Queue" can have longer times configured.
* There is no default.

disabled = [0|1]
* Specifies whether or not the input is enabled.
* 1 to disable the input, 0 to enable it.
* Defaults to 0 (enabled).

index = <string>
* Specifies the index that this input should send the data to.
* This attribute is optional.
* If no value is present, defaults to the default index.
