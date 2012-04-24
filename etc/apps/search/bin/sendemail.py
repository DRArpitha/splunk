# Copyright (C) 2005-2011 Splunk Inc. All Rights Reserved.  Version 4.0
import re,sys,time,logging,splunk.Intersplunk, splunk.mining.dcutils as dcu
import smtplib, sys, StringIO, base64, os, socket, urllib, urllib2, urlparse, ssl
from xml.sax import saxutils
import cStringIO, csv
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.application import MIMEApplication
from email.header import Header

import splunk.search as search
import splunk.entity as entity
import splunk.clilib.cli_common as cli_common
from splunk.util import setSSLWrapProtocol

TIMEOUT = 600

importanceMap = {
    "highest": "1 (Highest)",
    "high"   : "2 (High)",
    "low"    : "4 (Low)",
    "lowest" : "5 (Lowest)",
    "1" : "1 (Highest)",
    "2" : "2 (High)",
    "4" : "4 (Low)",
    "5" : "5 (Lowest)"
}

logger = dcu.getLogger()
charset = "UTF-8"

class PDFException(Exception):
    pass

def getCredentials(sessionKey, namespace):
   try:
      ent = entity.getEntity('admin/alert_actions', 'email', namespace=namespace, owner='nobody', sessionKey=sessionKey)
      if 'auth_username' in ent and 'clear_password' in ent:
          return ent['auth_username'], ent['clear_password']
   except Exception, e:
      logger.error("Could not get email credentials from splunk, using no credentials. Error: %s" % (str(e)))

   return '', ''

def getJobMessages(searchid, sessionKey):
    try:
        job = search.getJob(searchid, sessionKey=sessionKey, message_level='warn')
        return job.messages
    except Exception, e:
         logger.error("Could not get job status for searchId=%s, Error: %s" % (searchid, str(e)))

    return {} 


def toBool(strVal):
   if strVal == None:
       return False

   lStrVal = strVal.lower()
   if lStrVal == "true" or lStrVal == "t" or lStrVal == "1" or lStrVal == "yes" or lStrVal == "y" :
       return True 
   return False

def isASCII(str):
    for i in str:
        if ord(i) > 127:
            return False
    return True

def escape(str, plainTextMode):
    if plainTextMode: 
       return str
    return saxutils.escape(str)

def renderJobMessages(messages, plainTextMode):
    result = '' 
    for k,v in messages.items():
       result += 'Message Level: ' + k.upper() + '\n'
       i = 1
       for m in v:
           result += str(i) + '. ' +  escape(m, plainTextMode) + '\n'  
           i      += 1    
       result + '\n'
    if len(result) > 0:
       result = '\n-- Search generated the following messages -- \n' + result

    return result

def unquote(val):
    if val is not None and len(val) > 1 and val.startswith('"') and val.endswith('"'):
       return val[1:-1]
    return val

def getarg(argvals, name, defaultVal=None):
    return unquote(argvals.get(name, defaultVal)) 

EMAIL_DELIM = re.compile('\s*[,;]\s*')
def mail(argvals, settings, bodytext=''):

    serverURL  = getarg(argvals, "server", "localhost")
    sender     = getarg(argvals, "from", "splunk")
    to         = getarg(argvals, "to" , None)
    cc         = getarg(argvals, "cc" , None)
    bcc        = getarg(argvals, "bcc", None)
    subject    = getarg(argvals, "subject" , "Splunk Results")
    format     = getarg(argvals, "format"  , "html")
    importance = getarg(argvals, "priority", None)
    inline     = getarg(argvals, "inline"  , "true").lower()
    plainText  = format != "html"
    sendresults = toBool(getarg(argvals, "sendresults"  , "false")) 
    sendpdf     = toBool(getarg(argvals, "sendpdf"  , "false")) 
    pdfview     = getarg(argvals, "pdfview"  , "") 
    searchid    = getarg(argvals, "searchid"  , None)
    use_ssl     = toBool(getarg(argvals, "use_ssl"  , "false"))
    use_tls     = toBool(getarg(argvals, "use_tls"  , "false"))
    username    = getarg(argvals, "username"  , "")
    password    = getarg(argvals, "password"  , "")
    sessionKey  = settings.get('sessionKey', None)

    # fetch credentials from the endpoint if none are supplied or password is encrypted
    if (len(username) == 0 and len(password) == 0) or password.startswith('$1$') :
         namespace  = settings.get("namespace", None)
         username, password = getCredentials(sessionKey, namespace)

    # use the Header object to specify UTF-8 msg headers, such as subject, to, cc etc
    message = MIMEMultipart()
    if isASCII(subject):
        message['Subject'] = subject
    else:
        message['Subject'] = Header(subject, charset)

    recipients = []
    if to:
        message['To'] = to
        recipients.extend(EMAIL_DELIM.split(to))

    if sender:
        message['From'] = sender
        
    if cc:
       for addr in EMAIL_DELIM.split(cc):
           message['Cc'] = addr
           recipients.append(addr)

    if bcc:
       for addr in EMAIL_DELIM.split(bcc):
           message['Bcc'] = addr
           recipients.append(addr)

    # Clear leading / trailing whitespace from recipients
    recipients = [r.strip() for r in recipients]

    if importance:
        # look up better name
        val = importanceMap.get(importance.lower(), None)
        # unknown value, use value user supplied
        if val == None:
            val = importance
        message['X-Priority'] = val


    intro = ''
    
    # write out a condensed body if we are just delivering a PDF snapshot
    # of a view/URI
    if pdfview:
        intro += 'Scheduled view delivery.\n\nA PDF snapshot has been generated for the view: %s.\n\n' % pdfview
        
    else:
        intro += "Saved search results.\n\n"
   
        if settings != None:
            user  = settings.get("user", None)
            if user:
                intro += "User: \'" + escape(user, plainText) + "\'\n"
    
        ssName = getarg(argvals, "ssname", None)
        if ssName:
            intro += "Name: \'" + escape(ssName, plainText) + "\'\n"
    
        query = getarg(argvals, "ssquery", None)
        if query:
            intro += "Query Terms: \'" + escape(query, plainText) + "\'\n"

        ssLink = getarg(argvals, "sslink", None)
        if ssLink and not plainText:
            ssLink = "<a href=\"" + ssLink + "\">" + ssLink + "</a>"
        
        if ssLink:
            intro += "Link to results: " + ssLink + "\n";
        
        ssSummary = getarg(argvals, "sssummary", None)
        if ssSummary:
            intro += "Alert was triggered because of: \'" + escape(ssSummary, plainText) + "\'\n"
    
        
    bodyformat = "html"
    if plainText:
        bodyformat = "plain"
        

    #######################################################################################
    # create the body of the email and attach or inline results if required. Make sure to #
    # adhere to the requested format and proper tag balancing.                            #
    #######################################################################################

    body = StringIO.StringIO()

    pdf = None
    errorLines = []

    if sendpdf:
        try:
            # will raise an Exception on error
            pdf = generatePDF(getarg(argvals, "sslink", None), subject, searchid, settings, pdfview)
        except PDFException, e:
            errorLines.append("An error occurred while generating a PDF of this report:")           
            errorLines.append(str(e))
            logger.error("An error occurred while generating a PDF of this report: %s" % e) 

    if sendresults and toBool(settings.get('truncated')):
       intro += '\nNOTE: Search results in this email might have been truncated. Please visit the search job page to view the full resultset\n'

    intro += renderJobMessages(getJobMessages(searchid, sessionKey), plainText)
   
    if not plainText:
        body.write("<HTML><BODY>\n")
        intro = intro.replace("\n", "\n<BR> \n") + "<BR><BR>\n"
    body.write(intro)
    
    if toBool(inline)  or inline == "none" or not sendresults:
    
        # inline the results if required to 
        if inline != "none" and sendresults:
            body.write("\n\n")
            body.write(bodytext)
            
        if errorLines:
            if plainText:
                body.write("\n\n")
                body.write("\n".join(errorLines))
            else:
                body.write("<BR><BR> \n\n")
                body.write("<BR>\n".join([saxutils.escape(err) for err in errorLines]))

        # correctly close the html if we're not in plaintext mode
        if not plainText:
            body.write("</BODY></HTML>")
        message.attach(MIMEText(body.getvalue(), bodyformat, _charset=charset))
    else:
        attachStr = "\nSearch results attached:\n\n"; 
            
        if errorLines:
            attachStr += "\n\n"
            if plainText:
                attachStr += "\n".join(errorLines)
            else:
                attachStr += "\n".join([saxutils.escape(err) for err in errorLines])

        if not plainText:
           attachStr = attachStr.replace("\n", "\n<BR>\n") + "</BODY></HTML>"
        body.write(attachStr)

        message.attach(MIMEText(body.getvalue(), bodyformat, _charset=charset))

        # now attach the results as a separate file
        
        filename = "splunk-results.csv"

        mimetype = "text"
        subtype = "csv"

        attachment = MIMEBase(mimetype, subtype)


        attachment.set_payload(bodytext)
        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
        message.attach(attachment)

    if pdf:
        message.attach(pdf)

            
    mail_log_msg = 'Sending email. subject="%s", results_link="%s", recepients="%s"' % (
        subject, 
        getarg(argvals, "sslink", None),
        str(recipients)
    ) 

    try:
        # make sure the sender is a valid email address
        if sender.find("@") == -1:
           sender = sender + '@' + socket.gethostname()
           if sender.endswith("@"):
              sender = sender + 'localhost'
     
        # send the mail
        if not use_ssl:
            smtp = smtplib.SMTP(serverURL)
        else:
            smtp = smtplib.SMTP_SSL(serverURL)

        if use_tls:
           smtp.starttls()

        if len(username) > 0:
           smtp.login(username, password)

        smtp.sendmail(sender, recipients, message.as_string())
        smtp.quit()
        #log an info message only if eveything passes
        logger.info(mail_log_msg)
    except Exception, e:
        #else log the same message at an error level
        logger.error(mail_log_msg)
        raise 
    
    
def numsort(x, y):
    if y[1] > x[1]:
        return -1
    elif x[1] > y[1]:
        return 1
    else:
        return 0

# sort columns from shortest to largest
def getSortedColumns(results, width_sort_columns):
    if len(results) == 0:
        return []

    columnMaxLens = {}
    for result in results:
        for k,v in result.items():
            # ignore attributes that start with "_"
            if k.startswith("_") and k!="_raw" and k!="_time":
                continue
            newLen = len(str(v))
            oldMax = columnMaxLens.get(k, -1)
            
            #initialize the column width to the length of header (name)
            if oldMax == -1:
                columnMaxLens[k] = oldMax = len(k)
            if newLen > oldMax:
                columnMaxLens[k] = newLen

    colsAndCounts = []
    # sort columns iff asked to
    if width_sort_columns:
       colsAndCounts = columnMaxLens.items()
       colsAndCounts.sort(numsort)
    else:
       for k,v in results[0].items():         
          if k in columnMaxLens:
             colsAndCounts.append([k, columnMaxLens[k]]) 

    return colsAndCounts

def pad(count):
    padding = ""
    for i in range(0, count):
        padding += ' '
    return padding
    
def generateTextResults(results, width_sort_columns):
    columnMaxLens = getSortedColumns(results, width_sort_columns)
    text = ""
    space = " "*4
    
    # output column names
    for col, maxlen in columnMaxLens:
        val = col
        padsize = maxlen - len(val)
        text += val + pad(padsize) + space
    text += "\n" + "-"*len(text) + "\n"
    # output each result's values
    for result in results:
        for col, maxlen in columnMaxLens:
            val = result.get(col, "")
            padsize = maxlen - len(val)
            # left justify ALL the columns
            text += val + pad(padsize) + space
        text += "\n"
    return text

def generateHTMLResults(results):
    text = "<table border=1>\n<tr>"

    if  len(results) != 0:
            cols = []
            for k,v in results[0].items():
               # ignore attributes that start with "_"
               if k.startswith("_") and k!="_raw" and k!="_time":
                   continue
               cols.append(k)

            # output column names
            for col in cols:
                text += "<th>" + col + "</th>"
            text += "</tr>\n"
            # output each result's values
            for result in results:
                text += "<tr valign=top>"
                for col in cols:
                    val = result.get(col, "")
                    escval = saxutils.escape(val)
                    text += "<td><pre>" + escval + "</pre></td>"
                text += "</tr>\n"
            text += "</table>"
    return text

def esc(val):
    return val.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")

def generateCSVResults(results):
    if len(results) == 0:
        return ''
    
    header = []
    s      = cStringIO.StringIO()
    w      = csv.writer(s)
    
    
    if "_time" in results[0] : header.append("_time")
    if "_raw"  in results[0] : header.append("_raw")
    
    # for backwards compatibility remove all internal fields except _raw and _time
    for k in results[0].keys():
       if k.startswith("_") :
          continue
       header.append(k)
        

    w.writerow(header)
    # output each result's values
    for result in results:
        row = [esc(result.get(col,"")) for col in header]
        w.writerow(row)
    return s.getvalue()

def generateRawResults(results):
    str = splunk.Intersplunk.rawresultsToString(results)
    if(len(str) == 0):
        str = "The results contain no '_raw' field. Please choose another result emailing format (csv, plain or html)."
        
    return str

def renderTime(results):
   for result in results:
      if "_time" in result:
         try:
              result["_time"] = time.ctime(float(result["_time"]))
         except: 
              pass

def sendEmail(results, settings):
    keywords, argvals = splunk.Intersplunk.getKeywordsAndOptions() 

    if not ('graceful' in argvals):
        argvals['graceful'] = 0

    if getarg(argvals, "to") == None:
        return dcu.getErrorResults(results, argvals['graceful'], "missing required argument: to. Please specify at least on email recipient as: \"to=address@example.com\"")

    if 'subject' in argvals and '_ScheduledView__' in argvals['subject']:
        argvals['subject'] = argvals['subject'].replace('_ScheduledView__', '')

    if len(results) == 0:
        msgText = "No results."
    else:
        format = getarg(argvals, "format", "html").lower()
        
        # always attach in CSV format
        if not toBool(getarg(argvals, "inline", "true") ):
           format = "csv"
        else:
	   # if inlining results render _time to something user readable
           renderTime(results)           
      
        # see if we need to sort fields by widht (in text mode only) 
        width_sort_columns = toBool(argvals.get("width_sort_columns", "true"))
 
        if format == "raw":
            msgText = generateRawResults(results)
        elif format == "html":
            msgText = generateHTMLResults(results)
        elif format =="csv":
            msgText = generateCSVResults(results)        
        else:
            msgText = generateTextResults(results, width_sort_columns)

    try:
#       if not toBool(getarg(argvals, "sendresults", "false") ):
#           msgText=''

        mail(argvals, settings, msgText)
    except Exception, e:
        #import traceback
        #stack   = traceback.format_exc()
        results = dcu.getErrorResults(results, argvals['graceful'], str(e) + ' while sending mail to: ' + getarg(argvals, "to"))
    return results


def generatePDF(sslink, subject, searchid, settings, pdfview):
    """
    Reach out and retrieve a PDF copy of the search results if possible
    and return the MIME attachment
    """
    sessionKey = settings.get('sessionKey', None)
    owner = settings.get('owner', 'nobody')
    #logger.info('sslink=%s searchid=%s settings=%s' % (sslink, searchid, settings))
    if not (sslink and sessionKey):
        raise PDFException("Can't attach PDF - either ssLink or sessionKey unavailable")

    # send the report request to the appserver running on the host serving the content
    ss_scheme, ss_netloc, ss_path, ss_query, ss_fragment = urlparse.urlsplit(sslink)

    # Find the root prefix if the appserver is mounted on a prefix other than /
    prefix = ss_path[:ss_path.index('/app/')] 
    server = "%s://%s%s/en-US/report/" % (ss_scheme, ss_netloc, prefix)

    pdfviewfn = pdfview and pdfview.strip(' .:;|><\'"')

    datestamp = time.strftime('%Y-%m-%d')

    if pdfviewfn:
        filename = '%s-%s.pdf' % (pdfviewfn[:50], datestamp)
        # strip control characters, forward & backslash
        filename = re.sub(r'[\x00-\x1f\x7f/\\]+', '-', filename)
        if isinstance(filename, unicode):
            filename = ('utf-8', '', filename.encode('utf-8'))
    else:
        filename = 'splunk-report-%s.pdf' % datestamp

    if pdfview:
        app = ss_path[len(prefix):].split('/')[2]
        target = "%s://%s%s/app/%s/%s" % (ss_scheme, ss_netloc, prefix, app, pdfview)
    else:
        # assume that no doc fragments are used here
        if ss_query:
            target = sslink + '&media=print'
        else:
            target = sslink + '?media=print'

    try:
        logger.info("sendemail opening PDF request to appserver at %s" % server)
        # Ensure compatibility with systems with supportSSLV3Only=tru
        setSSLWrapProtocol(ssl.PROTOCOL_SSLv3)
        response = urllib2.urlopen(server, urllib.urlencode({
            'request_path' : target,
            'session_key' : sessionKey,
            'owner': owner,
            'title' : subject
            }), TIMEOUT)
    except urllib2.HTTPError, e:
        msg = e.fp.read().strip()
        if msg and msg[0]=='>':
            raise PDFException("Failed to generate PDF: %s" % msg[1:])
        else:
            raise PDFException("Failed to contact appserver at %s: %s" % (server, e))
    except Exception, e:
        raise PDFException("Failed to fetch PDF from appserver at %s: %s" % (server, e))

    headers = response.info()
    #logger.debug('Response headers: %s' % headers)
    if headers['Content-Type']!='application/pdf':
        logger.error("Didn't receive PDF from Report Server")
        raise PDFException("Didn't receive PDF from Report Server")

    data = response.read()
    mpart = MIMEApplication(data, 'pdf')
    mpart.add_header('content-disposition', 'attachment', filename=filename)
    logger.info('Generated PDF for email')
    return mpart


    
        
results, dummyresults, settings = splunk.Intersplunk.getOrganizedResults()
results = sendEmail(results, settings)
splunk.Intersplunk.outputResults(results)


