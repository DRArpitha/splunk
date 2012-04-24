# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 
#
# This file contains possible attribute/value pairs for saved search entries in savedsearches.conf.  
# You can configure saved searches by creating your own savedsearches.conf.
#
# There is a default savedsearches.conf in $SPLUNK_HOME/etc/system/default. To set custom 
# configurations, place a savedsearches.conf in $SPLUNK_HOME/etc/system/local/.  
# For examples, see savedsearches.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles


#*******
# The possible attribute/value pairs for savedsearches.conf are:
#*******

[<stanza name>]
* Create a unique stanza name for each saved search.
* Follow the stanza name with any number of the following attribute/value pairs.
* If you do not specify an attribute, Splunk uses the default.
 	
disabled = [0|1]
* Disable your search by setting to 1.
* If set to 1, this saved search is not visible in Splunk Web.
* Defaults to 0.

search = <string>
* Actual search terms of the saved search.
* For example, search = index::sampledata http NOT 500.
* Your search can include macro searches for substitution.
* To learn more about creating a macro search, search the documentation for "macro search."
* Defaults to empty string.


#*******
# Scheduling options
#*******

enableSched = [0|1]
* Set this to 1 to run your search on a schedule.
* Defaults to 0.

cron_schedule = <cron string>
* The cron schedule used to execute this search. 
* For example: */5 * * * *  causes the search to execute every 5 minutes.
* Cron lets you use standard cron notation to define your scheduled search interval. 
  In particular, cron can accept this type of notation: 00,20,40 * * * *, which runs the search 
  every hour at hh:00, hh:20, hh:40. Along the same lines, a cron of 03,23,43 * * * * runs the 
  search every hour at hh:03, hh:23, hh:43.
* Splunk recommends that you schedule your searches so that they are staggered over time. This 
  reduces system load. Running all of them every 20 minutes (*/20) means they would all launch
  at hh:00 (20, 40) and might slow your system every 20 minutes.
* Defaults to empty string.

schedule = <cron-style string>
* This field is DEPRECATED.
* Antequated pre-4.0 scheduling strings. Use cron_schedule instead.
* Slightly incompatable Cron-like schedule.  The behavior for '/' is splunk-specific.
* For this antequated key, the expression */n is handled as "divide by n" (instead of standard 
  POSIX cron's "every n").
* For example: */6 for posix cron means: every six minutes.  For this specific setting, this 
  means "for every sixth of an hour" which results in running every ten minutes.
* Defaults to empty string.

max_concurrent = <int>
* The maximum number of concurrent instances of this search the scheduler is allowed to run. 
* Defaults to 1.

realtime_schedule = [0|1]
* Controls the way the scheduler computes the next execution time of a scheduled search.
* If this value is set to 1, the scheduler bases its determination of the next scheduled search 
  execution time on the current time. 
* If this value is set to 0, the scheduler bases its determination of the next scheduled search 
  on the last search execution time. This is called continuous scheduling.
*    If set to 1, the scheduler might skip some execution periods to make sure that the scheduler 
     is executing the searches running over the most recent time range.  
*    If set to 0, the scheduler never skips scheduled execution periods. However, the execution 
     of the saved search might fall behind depending on the scheduler's load. Use continuous 
     scheduling whenever you enable the summary index option.
* The scheduler tries to execute searches that have realtime_schedule set to 1 before it
  executes searches that have continuous scheduling (realtime_schedule = 0).
* Defaults to 1


#*******
# Notification options
#*******

counttype = number of events | number of hosts | number of sources | always
* Set the type of count for alerting.
* Used with relation and quantity (below).
* NOTE: If you specify "always," do not set relation or quantity (below).
* Defaults to always.
        
relation = greater than | less than | equal to | not equal to | drops by | rises by
* Specifies how to compare against counttype.
* Defaults to empty string. 

quantity = <integer>
* Specifies a value for the counttype and relation, to determine the condition under which an 
  alert is triggered by a saved search.
* You can think of it as a sentence constructed like this: <counttype> <relation> <quantity>.
* For example, "number of events [is] greater than 10" sends an alert when the count of events 
  is larger than by 10.
* For example, "number of events drops by 10%" sends an alert when the count of events drops by 
  10%.
* Defaults to an empty string.  

alert_condition = <search string>
* Contains a conditional search that is evaluated against the results of the saved search. 
  Alerts are triggered if the specified search yields a non-empty search result list.
* NOTE: If you specify an alert_condition, do not set counttype, relation, or quantity. 
* Defaults to an empty string.


#*******
# generic action settings.
# For a comprehensive list of actions and their arguments, refer to alert_actions.conf.
#*******

action.<action_name> = 0 | 1
* Indicates whether the action is enabled or disabled for a particular saved search.
* The action_name can be: email | populate_lookup | script | summary_index
* For more about your defined alert actions see alert_actions.conf.
* Defaults to an empty string.

action.<action_name>.<parameter> = <value>
* Overrides an action's parameter (defined in alert_actions.conf) with a new <value> for this
  saved search only.
* Defaults to an empty string.


#******
# Settings for email action
#******

action.email = 0 | 1
* Enables or disables the email action.
* Defaults to 0.

action.email.to = <email list>
* REQUIRED. This setting is not defined in alert_actions.conf.
* Set a comma-delimited list of recipient email addresses.
* Defaults to empty string.

action.email.from = <email address>
* Set an email address to use as the sender's address.
* Defaults to splunk@<LOCALHOST> (or whatever is set in alert_actions.conf).

action.email.subject = <string>
* Set the subject of the email delivered to recipients.
* Defaults to SplunkAlert-<savedsearchname> (or whatever is set in alert_actions.conf).

action.email.mailserver = <string>
* Set the address of the MTA server to be used to send the emails.
* Defaults to <LOCALHOST> (or whatever is set in alert_actions.conf).


#******
# Settings for script action
#******

action.script = 0 | 1
* Enables or disables the script action.
* 1 to enable, 0 to disable.
* Defaults to 0

action.script.filename = <script filename>
* The filename of the shell script to execute. 
* The script should be located in: $SPLUNK_HOME/bin/scripts/
* Defaults to empty string.


#*******
# Settings for summary index action
#*******

action.summary_index = 0 | 1
* Enables or disables the summary index action.
* Defaults to 0.
	
action.summary_index._name = <index>
* Specifies the name of the summary index where the results of the scheduled search are saved.
* Defaults to summary.
	
action.summary_index.inline = <bool>
* Determines whether to execute the summary indexing action as part of the scheduled search. 
* NOTE: This option is considered only if the summary index action is enabled and is always 
  executed (in other words, if counttype = always).
* Defaults to true.

action.summary_index.<field> = <string>
* Specifies a field/value pair to add to every event that gets summary indexed by this search.
* You can define multiple field/value pairs for a single summary index search.
	  

#*******
# Settings for lookup table population parameters
#*******

action.populate_lookup = 0 | 1
* Enables or disables the lookup population action.
* Defaults to 0.

action.populate_lookup.dest = <string>
* Can be one of the following two options:
	* A lookup name from transforms.conf.
	* A path to a lookup .csv file that Splunk should copy the search results to, relative to 
	  $SPLUNK_HOME.
		* NOTE: This path must point to a .csv file in either of the following directories:
 			* etc/system/lookups/
 			* etc/apps/<app-name>/lookups
			* NOTE: the destination directories of the above files must already exist
* Defaults to empty string.

run_on_startup = true | false
* Toggles whether this search runs when Splunk starts.
* If it does not run on startup, it runs at the next scheduled time. 
* We recommend that you set run_on_startup to true for scheduled searches that populate lookup 
  tables.
* Defaults to false.
	

#*******
# dispatch search options
#*******

dispatch.ttl = <integer>[p]
* Indicates the time to live (in seconds) for the artifacts of the scheduled search, if no 
  actions are triggered.
* If an action is triggered Splunk changes the ttl to that action's ttl. If multiple actions are 
  triggered, Splunk applies the maximum ttl to the artifacts. To set the action's ttl, refer 
  to alert_actions.conf.spec.
* If the integer is followed by the letter 'p' Splunk interprets the ttl as a multiple of the 
  scheduled search's execution period (e.g. if the search is scheduled to run hourly and ttl is set to 2p
  the ttl of the artifacts will be set to 2 hours).
* Defaults to 2p (that is, 2 x the period of the scheduled search).

dispatch.buckets  = <integer>
* The maximum number of timeline buckets.
* Defaults to 0.

dispatch.max_count = <integer>
* The maximum number of results before finalizing the search.
* Defaults to 500000.

dispatch.max_time = <integer>
* Indicates the maximum amount of time (in seconds) before finalizing the search.
* Defaults to 0.

dispatch.lookups = 1| 0
* Enables or disables lookups for this search.
* Defaults to 1.

dispatch.earliest_time = <time-str>
* Specifies the earliest time for this search. Can be a relative or absolute time.
* If this value is an absolute time, use the dispatch.time_format to format the value.
* Defaults to empty string.

dispatch.latest_time = <time-str>
* Specifies the latest time for this saved search. Can be a relative or absolute time.
* If this value is an absolute time, use the dispatch.time_format to format the value.
* Defaults to empty string.

dispatch.time_format = <time format str>
* Defines the time format that Splunk uses to specify the earliest and latest time.
* Defaults to %FT%T.%Q%:z

dispatch.spawn_process = 1 | 0
* Specifies whether Splunk spawns a new search process when this saved search is executed.
* Default is 1.

dispatch.reduce_freq = <int>
* Specifies how frequently Splunk should run the MapReduce reduce phase on accumulated map values.
* Defaults to 10.

dispatch.rt_backfill = <bool>
* Specifies whether to do real-time window backfilling for scheduled real time searches
* Defaults to false.

restart_on_searchpeer_add = 1 | 0
* Specifies whether to restart a real-time search managed by the scheduler when a search peer 
  becomes available for this saved search.
* NOTE: The peer can be a newly added peer or a peer that has been down and has become available.
* Defaults to 1.
 

#*******
# alert suppression/severity/expiration/tracking settings
#*******

alert.suppress = 0 | 1
* Specifies whether alert suppression is enabled for this scheduled search.
* Defaults to 0. 

alert.suppress.period = <time-specifier>
* Sets the suppression period. Use [number][time-unit] to specify a time.
* For example: 60 = 60 seconds, 1m = 1 minute, 1h = 60 minutes = 1 hour etc
* Honored if and only if alert.suppress = 1
* Defaults to empty string.

alert.suppress.fields = <comma-delimited-field-list>
* List of fields to use when suppressing per-result alerts. This field *must* be specified
* if the digest mode is disabled and suppression is enabled.
* Defaults to empty string.

alert.severity = <int>
* Sets the alert severity level.
* Valid values are: 1-debug, 2-info, 3-warn, 4-error, 5-severe, 6-fatal
* Defaults to 3.

alert.expires = <time-specifier>
* Sets the period of time to show the alert in the dashboard. Use [number][time-unit] to specify a time.
* For example: 60 = 60 seconds, 1m = 1 minute, 1h = 60 minutes = 1 hour etc
* Defaults to 24h.

alert.digest_mode = true | false
* Specifies whether Splunk applies the alert actions to the entire result set or on each 
* individual result.
* Defaults to true.

alert.track = true | false | auto
* Specifies whether to track the actions triggered by this scheduled search.
* auto  - determine whether to track or not based on the tracking setting of each action, 
* do not track scheduled searches that always trigger actions.
* true  - force alert tracking.
* false - disable alert tracking for this search.
* Defaults to auto.

#*******
# UI-specific settings
#*******

displayview =<string>
* Defines the default UI view name (not label) in which to load the results.
* Accessibility is subject to the user having sufficient permissions.
* Defaults to empty string.

vsid = <string>
* Defines the viewstate id associated with the UI view listed in 'displayview'.
* Must match up to a stanza in viewstates.conf.
 * Defaults to empty string.
 
is_visible = true | false
* Specifies whether this saved search should be listed in the visible saved search list.
* Defaults to true.

description = <string>
* Human-readable description of this saved search.
* Defaults to empty string.

request.ui_dispatch_app  = <string>
* Specifies a field used by Splunk UI to denote the app this search should be dispatched in.
* Defaults to empty string.

request.ui_dispatch_view = <string>
* Specifies a field used by Splunk UI to denote the view this search should be displayed in.
* Defaults to empty string.

#*******
# deprecated settings
#*******

sendresults = <bool>
* use action.email.sendresult

action_rss = <bool>
* use action.rss

action_email = <string>
* use action.email and action.email.to

role = <string>
* see saved search permissions

userid = <string>
* see saved search permissions

query  = <string>
* use search

nextrun  = <int>
* not used anymore, the scheduler maintains this info internally

qualifiedSearch = <string>
* not used anymore, Splunk computes this value during runtime
