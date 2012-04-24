# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1 
#
# This file contains all possible options for an indexes.conf file.  Use this file to configure 
# Splunk's indexes and their properties.
#
# There is an indexes.conf in $SPLUNK_HOME/etc/system/default/.  To set custom configurations, 
# place an indexes.conf in $SPLUNK_HOME/etc/system/local/. For examples, see 
# indexes.conf.example. You must restart Splunk to enable configurations.
#
# To learn more about configuration files (including precedence) please see the documentation 
# located at http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles
#
# CAUTION:  You can drastically affect your Splunk installation by changing these settings.  
# Consult technical support (http://www.splunk.com/page/submit_issue) if you are not sure how 
# to configure this file.
#
# DO NOT change the attribute QueryLanguageDefinition without consulting technical support.

#******************************************************************************	
# GLOBAL OPTIONS
# These options affect every index.  Later, there is a section on
# index-specific and volume-specific settings.
# 
# Set these options at the top of the file, before defining any stanzas. 
# Alternatively, you can define them under a [default] stanza.
#******************************************************************************	

sync = <integer>
	* The index processor syncs events every <integer> number of events.
	* Must be non-negative.
	* Set to 0 to disable.
	* Defaults to 0.

defaultDatabase = <index name>
	* If no index is specified during search, Splunk searches the default index.
	* The specified index displays as the default in Splunk Manager settings.
	* Defaults to main.
  	
queryLanguageDefinition = <path to file>
	* DO NOT EDIT THIS SETTING. SERIOUSLY. 
	* The path to the search language definition file.
	* Defaults to $SPLUNK_HOME/etc/searchLanguage.xml.

blockSignatureDatabase = <index name>
	* This is the index that stores block signatures of events.
	* Defaults to _blocksignature.

memPoolMB = [integer, in MB|"auto"]
	* Determines how much memory is given to the indexer memory pool. This restricts the number of 
outstanding events in the indexer at any given time.
	* Must be greater than 0 and has a maximum value of 1048576 (which corresponds to 1 TB)
	* Setting this too high can lead to splunkd memory usage going up substantially.
	* Setting this too low can degrade splunkd indexing performance.
	* Setting this to "auto" or an invalid value will cause Splunk to autotune this parameter.
	* Defaults to "auto".
	* Only set this value if you are an expert user or are advised by Splunk Support.
	* CARELESSNESS IN SETTING THIS MAY LEAD TO PERMANENT BRAIN DAMAGE OR LOSS OF JOB.

indexThreads = <integer or "auto">
	* Determines the number of threads to use for indexing.
	* Must be at least 1 and no more than 16.
	* This number should not be set higher than the number of processors in the box.
	* If splunkd is also doing parsing and aggregation, the number should be set lower than the total number of 
	  processors minus two.
	* Setting this to "auto" or an invalid value will cause Splunk to autotune this parameter.
	* Defaults to "auto".
	* Only set this value if you are an expert user or are advised by Splunk Support.
	* CARELESSNESS IN SETTING THIS MAY LEAD TO PERMANENT BRAIN DAMAGE OR LOSS OF JOB.

assureUTF8 = [true|false]
	* Verifies that all data retreived from the index is proper UTF8.
	* Will degrade indexing performance when enabled (set to true).
	* Can only be set globally, by specifying in the [default] stanza.
	* Defaults to false.

enableRealtimeSearch = [true|false]
	* Enables real-time searches.
	* Defaults to true.

suppressBannerList = comma seperated list of strings
	* suppresses index missing warning banner messages for specified indexes
	* Defaults to empty

maxRunningProcessGroups = unsigned non-zero integer
	* The indexer fires off helper processes like splunk-optimize, recover-metadata, etc.  This param controls how many processes the indexer fires off at any given time
	* Must maintain maxRunningProcessGroupsLowPriority < maxRunningProcessGroups
	* This is an advanced parameter, do NOT set this unless instructed by Splunk Support
	* Defaults to 20

maxRunningProcessGroupsLowPriority = unsigned non-zero integer
	* The indexer fires off helper processes like splunk-optimize, recover-metadata, etc.  This param controls how many of these processes can be low-priority (e.g. fsck) ones at any given time
	* Must maintain maxRunningProcessGroupsLowPriority < maxRunningProcessGroups
	* This is an advanced parameter, do NOT set this unless instructed by Splunk Support
	* Defaults to 1

#******************************************************************************
# PER INDEX OPTIONS
# These options may be set under an [<index>] entry.
#
# Index names must consist of only numbers, letters, periods, underscores, and hyphens. 
#******************************************************************************

disabled = [true|false]
	* Toggles your index entry off and on.
	* Set to true to disable an index.
	* Defaults to false.

homePath = <path on index server>
	* An absolute path that contains the hotdb and warmdb for the index. 
	* Splunkd keeps a file handle open for warmdbs at all times.
	* May be defined in terms of a volume definition (see volume section below).
	* CAUTION: Path MUST be writable.
	* Required. Splunk will not start if an index lacks a valid homePath.

coldPath = <path on index server>
	* An absolute path that contains the colddbs for the index. 
	* Cold databases are opened as needed when searching.
	* May be defined in terms of a volume definition (see volume section below).
	* CAUTION: Path MUST be writable.
	* Required. Splunk will not start if an index lacks a valid coldPath.

thawedPath = <path on index server>
	* An absolute path that contains the thawed (resurrected) databases for the index.
	* Cannot be defined in terms of a volume definition.
	* Required. Splunk will not start if an index lacks a valid thawedPath.

bloomHomePath = <path on index server>
       * An absoluate path that contains the bloomfilter files for the index.
       * If not specified, it defaults to homePath.
       * May be different from homePath and may be on any disk drive.
       * MUST be defined in terms of a volume definition (see volume section below).
       * CAUTION: Path must be writable.

createBloomfilter = <bool>
       * Control whether to create bloomfilter files for the index.
       * TRUE: bloomfilter files will be created. FALSE: not created.
       * Defaults to TRUE.

maxBloomBackfillBucketAge = <integer>[smhd]
       * If a (warm or cold) bucket is older than this, we shall not [re]create its blomfilter when we come across it
       * Defaults to 30d.
       * When set to 0, bloomfilters are never rebuilt

enableOnlineBucketRepair = [true|false]
	* Controls asynchronous "online fsck" bucket repair, which runs concurrently with Splunk
	* When enabled, you do not have to wait until buckets are repaired, to start Splunk
	* When enabled, you might observe a slight performance degradation

# The following options can be set either per index or globally (as defaults for all indexes).
# Defaults set globally are overridden if set on a per-index basis.

maxWarmDBCount = <integer>
	* The maximum number of warmdb directories.
	* All warm databasess are in the <homePath> for the index. 
	* warm databases s are kept in open state.
	* Defaults to 300.

maxTotalDataSizeMB = <integer>
	* The maximum size of an index (in MB). 
	* If an index grows larger than the maximum size, the oldest data is frozen.
	* This paremeter only applies to hot, warm, and cold buckets.  It does not apply to thawed buckets.
	* Defaults to 500000.

rotatePeriodInSecs = <integer>
	* How frequently (in seconds) to check if a new hotdb needs to be created.
	* Also, how frequently to check if there are any cold DBs that should be frozen.
    * Also, how often to check whether buckets need to be moved out of hot and cold DBs, due to respective
      size constraints (i.e., homePath.maxDataSizeMB and coldPath.maxDataSizeMB)
    * Also, this value becomes default value for all volumes' rotatePeriodInSecs attribute
	* Defaults to 60.

frozenTimePeriodInSecs = <integer>
	* Number of seconds after which indexed data rolls to frozen.
	* If you do not specify a coldToFrozenScript, data is deleted when rolled to frozen.
	* IMPORTANT: Every event in the DB must be older than frozenTimePeriodInSecs before it will roll. Then, the DB 
	  will be frozen the next time splunkd checks (based on rotatePeriodInSecs attribute).
	* Defaults to 188697600 (6 years).

warmToColdScript = <script> 
	* Specifies a script to run when moving data from warm to cold. 
	* This attribute is supported for backwards compatibility with versions older than 4.0.  Migrating data across 
	  filesystems is now handled natively by splunkd.  
	* If you specify a script here, the script becomes responsible for moving the data, and Splunk's native data 
	  migration will not be used.
	* The script must accept two arguments:
	 * First: the warm directory (bucket) to be rolled to cold.
	 * Second: the destination in the cold path.
	* Searches and other activities are paused while the script is running.
	* Contact Splunk Support (http://www.splunk.com/page/submit_issue) if you need help configuring this setting.
	* Defaults to empty.

coldToFrozenScript = [path to program that runs script] <path to script>
        * Specify the path to the archiving script itself with <path to script>
	* If your script requires a program to run it (e.g. python), specify that first. Otherwise just specify the script path.
	* Splunk ships with an example archiving script in $SPLUNK_HOME/bin called coldToFrozenExample.py
        * Splunk DOES NOT recommend using this example script directly.
         * It uses a default path, and if modified in place any changes will be overwritten on upgrade.
	* We recommend copying the example script to a new file in bin and modifying it for your system
         * Most importantly, change the default archive path to an existing directory that fits your needs.
	 * If your new script in bin/ is named myColdToFrozen.py, set this key to the following:
	coldToFrozenScript = "$SPLUNK_HOME/bin/python" "$SPLUNK_HOME/bin/myColdToFrozen.py"
	* By default, the example script has two possible behaviors when archiving:
	 * For buckets created from version 4.2 and on, it will remove all files except for rawdata
	  * To thaw: cd to the frozen bucket and type "splunk rebuild .", then copy the bucket to thawed for that index
	 * For older-style buckets, we simply gzip all the .tsidx files
	  * To thaw: cd to the frozen bucket and unzip the tsidx files, then copy the bucket to thawed for that index
	* The script must be in $SPLUNK_HOME/bin or a subdirectory thereof.

coldToFrozenDir = <path to frozen archive>
        * An alternative to a coldToFrozen script - simply specify a destination path for the frozen archive
        * Splunk will automatically put frozen buckets in this directory
        * Bucket freezing policy is as follows:
          * New style buckets (4.2 and on): removes all files but the rawdata
            * To thaw: run 'splunk rebuild <bucket dir>' on the bucket, then move to the thawed directory
          * Old style buckets (Pre-4.2): gzip all the .data and .tsidx files
            * To thaw: gunzip the zipped files and move the bucket into the thawed directory
        * If both coldToFrozenDir and coldToFrozenScript are specified, coldToFrozenDir will take precedence

compressRawdata = [true|false]
	* This parameter is ignored. The splunkd process always compresses raw data.

maxConcurrentOptimizes = <integer>
	* The number of concurrent optimize processes that can run against the hot DB.
	* This number should be increased if: 
	  * There are always many small tsidx files in the hot DB.
	  * After rolling, there are many tsidx files in warm or cold DB.

maxDataSize = [<integer>|auto|auto_high_volume]
	* The maximum size in MB for a hot DB to reach before a roll to warm is triggered.
	* Specifying "auto" or "auto_high_volume" will cause Splunk to autotune this parameter (recommended).
	* You should use "auto_high_volume" for high volume indexes (such as the main
	  index); otherwise, use "auto".  A "high volume index" would typically be
	  considered one that gets over 10GB of data per day.
	* Defaults to "auto", which sets the size to 750MB.
	* "auto_high_volume" sets the size to 10GB on 64-bit, and 1GB on 32-bit systems.
	* Although the maximum value you can set this is 1048576 MB, which corresponds to 1 TB, a reasonable 
	  number ranges anywhere from 100 - 50000.  Any number outside this range should be approved by Splunk 
	  support before proceeding.
	* If you specify an invalid number or string, maxDataSize will be auto tuned.
	* NOTE: The precise size of your warm buckets may vary from maxDataSize, due to post-processing and 
	  timing issues with the rolling policy.
     
rawFileSizeBytes = <positive integer>
        * Deprecated in version 4.2 and later. We will ignore this value.
        * Rawdata chunks are no longer stored in individual files.
        * If you really need to optimize the new rawdata chunks (highly unlikely), edit rawChunkSizeBytes

rawChunkSizeBytes = <positive integer>
	* Target uncompressed size in bytes for individual raw slice in the rawdata journal of the index.
	* Defaults to 131072 (128KB).
	* 0 is not a valid value. if 0 is specified, rawChunkSizeBytes will be set to the default value.
	* NOTE: rawChunkSizeBytes only specifies a target chunk size. The actual chunk size may be slightly larger 
	  by an amount proportional to an individual event size.
	* WARNING: This is an advanced parameter. Only change it if you are instructed to do so by Splunk Support.

minRawFileSyncSecs = [<integer>|disable]
	* How frequently we force a filesystem sync while compressing journal slices.  During this
	  interval, uncompressed slices are left on disk even after they are compressed.  Then we
	  force a filesystem sync of the compressed journal and remove the accumulated uncompressed files.
	* If 0 is specified we force a filesystem sync after every slice completes compressing
	* Specifying "disable" disables syncing entirely: uncompressed slices are removed as soon as compression is complete
	* Defaults to "disable".
	* Some filesystems are very inefficient at performing sync operations, so only enable this if
	  you are sure it is needed

maxMemMB = <integer>
	* The amount of memory to allocate for indexing. 
	* This amount of memory will be allocated PER INDEX THREAD, or, if indexThreads is set to 0, once per index.
	* IMPORTANT:  Calculate this number carefully. splunkd will crash if you set this number higher than the amount
	  of memory available.
	* Defaults to 5.
	* The default is recommended for all environments.
   
blockSignSize = <integer>
	* Controls how many events make up a block for block signatures. 
	* If this is set to 0, block signing is disabled for this index.
	* Defaults to 0.
	* A recommended value is 100.

maxHotSpanSecs = <positive integer>
	* Upper bound of timespan of hot/warm buckets in seconds.
	* Defaults to 7776000 seconds (90 days).
	* NOTE: if you set this too small, you can get an explosion of hot/warm
	  buckets in the filesystem.
	* This parameter cannot be set to less than 3600; if you set it to a lesser
	  value, it will be automatically reset to 3600, which will then activate
	  snapping behavior (see below).
	* This is an advanced parameter that should be set
	  with care and understanding of the characteristics of your data.
	* If set to 3600 (1 hour), or 86400 (1 day), becomes also the lower bound
	  of hot bucket timespans.  Further, snapping behavior (i.e. ohSnap)
	  is activated, whereby hot bucket boundaries will be set at exactly the hour
	  or day mark, relative to local midnight.

maxHotIdleSecs = <positive integer>
	* Maximum life, in seconds, of a hot bucket.
	* If a hot bucket exceeds maxHotIdleSecs, Splunk rolls it to warm.
	* This setting operates independently of maxHotBuckets, which can also cause hot buckets to roll.
	* A value of 0 turns off the idle check (equivalent to INFINITE idle time).
	* Defaults to 0.

maxHotBuckets = <positive integer>
	* Maximum hot buckets that can exist per index.
	* When maxHotBuckets is exceeded, Splunk rolls the least recently used (LRU) hot bucket to warm.
	* Both normal hot buckets and quarantined hot buckets count towards this total.
	* This setting operates independently of maxHotIdleSecs, which can also cause hot buckets to roll.
	* Defaults to 3.

quarantinePastSecs = <positive integer>
	* Events with timestamp of quarantinePastSecs older than "now" will be
	  dropped into quarantine bucket.
	* Defaults to 77760000 (900 days).
	* This is a mechanism to prevent the main hot buckets from being polluted with
	  fringe events.

quarantineFutureSecs = <positive integer>
	* Events with timestamp of quarantineFutureSecs newer than "now" will be
	  dropped into quarantine bucket.
	* Defaults to 2592000 (30 days).
	* This is a mechanism to prevent main hot buckets from being polluted with
	  fringe events.

maxMetaEntries = <unsigned integer>
        * Sets the maximum number of unique lines in .data files in a bucket, which may help to reduce memory consumption
        * If exceeded, a hot bucket is rolled to prevent further increase
        * If your buckets are rolling due to Strings.data hitting this limit, the culprit maybe the 'punct' field
          in your data.  If you don't use punct, it may be best to simply disable this (see props.conf.spec)
        * There is a delta between when maximum is exceeded and bucket is rolled.
          This means a bucket may end up with epsilon more lines than specified, 
          but this is not a major concern unless excess is significant
        * If set to 0, this setting is ignored (it is treated as infinite)

syncMeta = [true|false]
	* When "true", a sync operation is called before file descriptor is closed on metadata file updates.
	* This functionality was introduced to improve integrity of metadata files, especially in regards 
	  to operating system crashes/machine failures.
	* Defaults to true.
	* NOTE: Do not change this parameter without the input of a Splunk support professional.

serviceMetaPeriod = <integer>
	* Defines how frequently metadata is synced to disk, in seconds.
	* Defaults to 25 (seconds).
	* You may want to set this to a higher value if the sum of your metadata file sizes is larger than many 
	  tens of megabytes, to avoid the hit on I/O in the indexing fast path.

partialServiceMetaPeriod = <integer>
	* Related to serviceMetaPeriod.  If set, it enables metadata sync every
	  <integer> seconds, but only for records where the sync can be done
	  efficiently in-place, without requiring a full re-write of the metadata
	  file.  Records that require full re-write will be sync'ed at serviceMetaPeriod.
	* <integer> specifies how frequently it should sync.  Zero means that this
	  feature is turned off and serviceMetaPeriod is the only time when metadata
	  sync happens.
	* If the value of partialServiceMetaPeriod is greater than serviceMetaPeriod,
	  this setting will have no effect.
	* By default it is turned off (zero).

throttleCheckPeriod = <integer>
	* Defines how frequently Splunk checks for index throttling condition, in seconds.
	* Defaults to 15 (seconds).
	* NOTE: Do not change this parameter without the input of a Splunk Support professional.

isReadOnly = [true|false]
	* Set to true to make an index read-only.
	* If true, no new events can be added to the index, but it is still searchable.
	* Defaults to false.
	
homePath.maxDataSizeMB = <integer>
	* Limits the size of the hot/warm DB to the maximum specified size, in MB. 
	* If this size is exceeded, Splunk will move buckets with the oldest value of latest time (for a given bucket)
	  into the cold DB until the DB is below the maximum size.
	* If this attribute is missing or set to 0, Splunk will not constrain size of the hot/warm DB.
	* Defaults to 0.

coldPath.maxDataSizeMB = <integer>
	* Limits the size of the cold DB to the maximum specifed size, in MB. 
	* If this size is exceeded, Splunk will freeze buckets with the oldest value of latest time (for a given bucket) 
	  until the DB is below the maximum size.
	* If this attribute is missing or set to 0, Splunk will not constrain size of the cold DB.
	* Defaults to 0.

#******************************************************************************	
# Volume settings.  This section describes settings that affect the volume-
# optional and volume-mandatory parameters only.
#
# All volume stanzas begin with "volume:". For example:
#   [volume:volume_name]
#   path = /foo/bar
#
# These volume stanzas can then be referenced by individual index parameters,
# e.g. homePath or coldPath.  To refer to a volume stanza, use the
# "volume:" prefix. For example, to set a cold DB to the example stanza above,
# use:
#   coldPath = volume:volume_name/baz
# This will cause the cold DB files to be placed under /foo/bar/baz.
#
# Note: thawedPath may not be defined in terms of a volume.  
# Thawed allocations are manually controlled by Splunk administrators,
# typically in recovery or archival/review scenarios, and should not
# trigger changes in space automatically used by normal index activity.
#******************************************************************************	

path = <path on server>
	* Required. 
	* Points to the location on the file system where all databases that use this volume will 
	  reside.  You must make sure that this location does not overlap with that of any other 
	  volume or index database.

maxVolumeDataSizeMB = <integer>
	* Optional. 
	* If set, this attribute will limit the total cumulative size of all databases 
	  that reside on this volume to the maximum size specified, in MB.  
	* If the size is exceeded, Splunk will remove buckets with the oldest value of latest time (for a given bucket)
 	  across all indexes in the volume, until the volume is below the maximum size.  
	  Note that this can cause buckets to be frozen directly from a warm DB, if those 
	  buckets happen to have the oldest value of latest time across all indexes in the volume.

rotatePeriodInSecs = <integer>
	* Optional. 
	* If set, this attribute specifies period of acquiesce operation for this volume.
    * If not set, the value of global rotatePeriodInSecs attribute is "inherited".
