# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.0
import sys,splunk.Intersplunk
import re
import urllib

LOCATION_URL = "http://api.hostip.info/get_html.php?ip="

""" This location url generates results that look like :
Country: UNITED STATES (US)
City: Kittanning, PA
"""

ipre = re.compile("\d+\.\d+\.\d+\.\d+")

results = []



try:

    results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()


    
    ipLocationCache = {}

    for r in results:
        if "_raw" in r:
            raw = r["_raw"]
            ips = ipre.findall(raw)
            i = 0
            for ip in ips:
                postfix = ""
                if( i > 0 ):
                    postfix = str(i)
                    
                r["ip" + postfix ] = ip


                
                lines = []
                if( ip in ipLocationCache ):
                    lines = ipLocationCache[ip]
                else:
                    location = urllib.urlopen( LOCATION_URL + ip )
                    l = location.headers['content-type'].split("charset=")
                    if len(l) == 2:
                      encoding = l[1]
                    else:
                      encoding = "iso-8859-1" # default
                    lines = location.readlines()
                    lines = map(lambda l: unicode(l, encoding), lines)
                    ipLocationCache[ip] = lines
                
                
                for l in lines:
                    if l:
                        colPos  = l.find(":")
                        if( colPos != -1 ):
                            r[l[:colPos] + postfix ] = l[colPos+1:].strip()                        
                
                i = i + 1
                
except:
    import traceback
    stack =  traceback.format_exc()
    results = splunk.Intersplunk.generateErrorResults("Error : Traceback: " + str(stack))

splunk.Intersplunk.outputResults( results )
