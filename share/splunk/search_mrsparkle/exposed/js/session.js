Splunk.namespace("Splunk.Session");
/**
 * A simple class that dispatches jQuery document events Splunk.Session.TIMEOUT_EVENT and Splunk.Session.START_EVENT.
 * Events triggered on UI activity/no-activity configuration setting POLLER_TIMEOUT_INTERVAL.
 */
Splunk.Session = $.klass({
    EVENT_BUFFER_TIMEOUT: 1000,//Never operate on many DOM events without a governor (ie., 1000ms governor cancels >30 scroll events).
    UI_INACTIVITY_TIMEOUT: 60,
    START_EVENT: "SessionStart",
    TIMEOUT_EVENT: "SessionTimeout",
    UI_EVENT_TYPES: ["click", "keydown", "mouseover", "scroll"],
    /**
     * Initializes Session.
     */
    initialize: function(){
        this.logger = Splunk.Logger.getLogger("Splunk.Session");
        this.serverLogger = Splunk.Logger.getLogger("Splunk.Session", Splunk.Logger.mode.Server);
        this.eventBuffer = [];
        this.timeoutDelay = Splunk.util.getConfigValue("UI_INACTIVITY_TIMEOUT", this.UI_INACTIVITY_TIMEOUT);
        this.timeoutDelay *= 60000;
        this.timeoutID = null;
        $(document).bind(this.START_EVENT, this.onSessionStart.bind(this));
        if(this.timeoutDelay<1){ 
            this.logger.info("UI_INACTIVITY_TIMEOUT is zero or a negative number, no timeout event will be fired. Sessions will survive as long as the browser is open.");
        }else {
            this.logger.info("UI_INACTIVITY_TIMEOUT is a number, a timeout event will be fired in", this.timeoutDelay, "mins. if there is no ui activity.");
            $(document).bind(this.TIMEOUT_EVENT, this.onSessionTimeout.bind(this));
            $(document).bind(this.UI_EVENT_TYPES.join(" "), this.onUIEvent.bind(this));
            this.startTimeout();
        }
        $(document).trigger(this.START_EVENT, new Date());
    },
    /**
     * Top level UI event listener and dispatcher, triggers Splunk.Session.START_EVENT if timeoutID is null, resets the 
     * timer if timeoutID not null.
     *
     * @param {Object} event A DOM event.
     */
    onUIEvent: function(event){
        if(this.timeoutID){
            this.eventBuffer.push("");
            if(this.eventBuffer.length===1){
                this.resetTimeout();
                setTimeout(
                    function(){
                        //this.logger.info("Skipped", this.eventBuffer.length-1, "unnecessary operations.")
                        this.eventBuffer = [];
                    }.bind(this),
                    this.EVENT_BUFFER_TIMEOUT
                );
            }
        }else{
            this.startTimeout();
            $(document).trigger(this.START_EVENT, new Date());
        }
    },
    /**
     * Start of new UI activity/session.
     * 
     * @param {Object) event The jQuery passed event.
     * @param {Date} date The time the event was fired.
     */
    onSessionStart: function(event, date){
        var serverMessage = [];
        var navigator = window.navigator;
        var screen = window.screen;
        var flash = swfobject.getFlashPlayerVersion();
        var flashInfo = "flash=" + flash.major + "." + flash.minor + "." + flash.release;
        var genericMessage = "Splunk.Session.START_EVENT fired @" + date.toString();
        var documentURL = "documentURL" + "=" + document.URL;
        var documentReferrer = "documentReferrer" + "=" + document.referrer;
        this.logger.info(genericMessage);
        for(var i in navigator){
            if(typeof(navigator[i])==="string" && navigator[i].length>0){
                var navigatorInfo = i + "=" + navigator[i];
                serverMessage.push(navigatorInfo);
            }
        }
        for(var j in screen){
            var screenInfo = j + "=" + screen[j];
            serverMessage.push(screenInfo);
        }
        serverMessage.push(documentURL);
        serverMessage.push(documentReferrer);
        serverMessage.push(flashInfo);
        serverMessage.push(genericMessage);
        this.serverLogger.info(serverMessage.join(", "));
    },
    /**
     * End of UI activity/session.
     * 
     * @param {Object) event The jQuery passed event.
     * @param {Date} date The time the event was fired.
     */
    onSessionTimeout: function(event, date){
        this.logger.info("Splunk.Session.TIMEOUT_EVENT fired @", date.toString());
    },
    /**
     * Reset timeout, stop and start again.
     */
    resetTimeout: function(){
        this.stopTimeout();
        this.startTimeout();
    },
    /**
     * Start timeout, set timeoutID.
     */
    startTimeout: function(){
        this.timeoutID = window.setTimeout(this.timeoutHandler.bind(this), this.timeoutDelay);
    },
    /**
     * Stop timeout, if timeoutID exists clear the previous delay and set timeoutID back to null.
     * 
     * Note: Passing an invalid ID to clearTimeout does not have any effect (and doesn't throw an exception).
     */
    stopTimeout: function(){
        if(this.timeoutID){
            window.clearTimeout(this.timeoutID);
            this.timeoutID = null;
        }
    },
    /**
     * Handler for successful timeout, set timeoutID back to null, trigger Splunk.Session.TIMEOUT_EVENT.
     */
    timeoutHandler: function(){
        this.stopTimeout();
        $(document).trigger(this.TIMEOUT_EVENT, new Date());
    }    
});
Splunk.Session.instance = null;
/**
 * Singleton reference to Session object.
 *
 * @return A reference to a shared Session object.
 * @type Object
 */
Splunk.Session.getInstance = function(){
    if(!Splunk.Session.instance){
        Splunk.Session.instance = new Splunk.Session();
    }
    return Splunk.Session.instance;
};
