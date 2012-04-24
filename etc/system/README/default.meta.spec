# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.3.1
#
# *.meta files contain ownership information, access controls, and export
# settings for Splunk objects like saved searches, event types, and views.
# Each app has its own default.meta file. 

# Set access controls on the app containing this metadata file.
[]
access = read : [ * ], write : [ admin, power ]
* Allow all users to read this app's contents. Unless overridden by other metadata, 
allow only admin and power users to share objects into this app.

# Set access controls on this app's views.
[views]
access = read : [ * ], write : [ admin ]
* Allow all users to read this app's views. Allow only admin users to create,
* remove, share, or unshare views in this app.

# Set access controls on a specific view in this app.
[views/index_status]
access = read : [ admin ], write : [ admin ]
* Allow only admin users to read or modify this view.

# Make this view available in all apps.
export = system
* To make this view available only in this app, set 'export = none' instead.
owner = admin
* Set admin as the owner of this view.
