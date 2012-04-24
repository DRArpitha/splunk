Splunk.Module.JSChart = $.klass(Splunk.Module.DispatchingModule, {

    LEADING_UNDERSCORE_PREFIX: "VALUE_",
    DRILLDOWN_VISIBILITY_KEY : "JSChartInteractionValidity",

    CATEGORY_LABEL_CUTOFF: 80,
    DEFAULT_MAX_SERIES: 50,

    MANUAL_RESIZE_EVENT: 'ChartManualResize', // fired to indicate a chart has been manually resized
    DISPLAY_REFLOW_EVENT: 'Splunk.Events.REDRAW', // fired by higher-level objects when a display reflows
    PANEL_DROP_EVENT: 'Splunk.Events.PANEL_DROP', // fired by the drag-and-drop controller when a panel is dropped

    initialize: function($super, container) {
        $super(container);

        this._selection = null;
        this._enableDrilldown = false;
        this._isVisible = true;
        this.renderMonitor = false;
        this.updateId = -1;
        this.sid = 0;
        this.resultsCount = 1000;
        this.pp = false;
        this.customPPWasAdded = false;
        this.offset = false;
        this.properties = {};
        this.redrawNeeded = false;
        this.legendFieldList = [];
        this.legendFieldMap = {};
        this.currentData = false;
        this.requestId = 0;
        this.chart = false;
        this.resultsAreStale = false;
        this.chartingLibLoaded = false;
        this.hasPendingDraw = false;
        
        if(Splunk.util.getConfigValue('JSCHART_TEST_MODE', false) === true) {
            this.properties['testMode'] = true;
        }

        // if set to 'foo', the drilldown keys coming out of getModifiedContext() will look like "foo.name", "foo.value"
        this.drilldownPrefix = this.getParam("drilldownPrefix");
        this.moduleId = $(container).attr('id');

        // create a div inside the module element that will serve as a rendering target for the chart
        // otherwise it will clobber the contents of the module element every time it draws a chart
        this.$moduleElement = $('.JSChartContainer', $(container));
        this.chartContainer = ($('<div class="highcharts-placeholder"></div>')
                                .css({
                                    height: '100%',
                                    width: '100%'
                                })
                                .appendTo(this.$moduleElement))[0];
        
        // dynamically load in the HighCharts source and js_charting adapter files
        var jsBasePath = Splunk.util.make_url('/static/js');
        var that = this;
        // if we are the first JSChart module initialized, this next line will fetch the charting depencies
        // otherwise it will be a no-op for script.js
        $script([jsBasePath + '/contrib/highcharts.js', jsBasePath + '/js_charting.js'], 'jschart_dependencies'); 
        // either way, bind to the on-ready event for the dependencies
        $script.ready('jschart_dependencies', function() {
            // the charting dependencies are now loaded, if there was a call to draw in the interim, execute that draw now
            that.chartingLibLoaded = true;
            that.colorPalette = new Splunk.JSCharting.ListColorPalette();
            if(that.hasPendingDraw) {
                that.draw(that.updateId);
                that.hasPendingDraw = false;
            }
        });

        if(Splunk.util.normalizeBoolean(this.getParam("enableResize"))) {
            this.enableResizable();
        }

        Splunk.Legend.register(this.moduleId);
        this.legendManager = {
            setLabels: function(labels) {
                Splunk.Legend.setLabels(this.moduleId, labels);
            }.bind(this),

            getLabelIndex: function(label) {
                return Splunk.Legend.getLabelIndex(label);
            },

            numLabels: function() {
                return Splunk.Legend.numLabels();
            }
        };
        Splunk.Legend.addEventListener("labelIndexMapChanged", function() {
            if(this.chart && this.chart.needsColorPalette) {
                this.applyColorsAndDraw(this.legendFieldList, this.pendingCallback);
            }
        }.bind(this));

        this.setProperty("enableChartClick", this._enableDrilldown);
        this.setProperty("enableLegendClick", this._enableDrilldown);

        this.logger = Splunk.Logger.getLogger("js_chart.js");

        $(document).bind("PrintStart", this.onPrintStart.bind(this));
        $(document).bind("PrintEnd", this.onPrintEnd.bind(this));

        $(document).bind(this.DISPLAY_REFLOW_EVENT, this.onDisplayReflow.bind(this));
        // call onDisplayReflow here to handle the case where the page loads in a 'reflowed' configuration
        // specifically this is a work-around for the case where a dashboard is soft-refreshing in Edit mode from the viz editor
        this.onDisplayReflow();
        
        $(document).bind(this.PANEL_DROP_EVENT, function(event, data) {
            // when a global panel drop event is fired, check to see if it was our container that was dropped
            // in which case fire the internal onPanelDrop method
            if($.contains(data.droppedElement, this.container[0])) {
                this.onPanelDrop();
            }
        }.bind(this));
        
        this.sniffCssStyles();
    },

    onLoadStatusChange: function($super,statusInt) {
        $super(statusInt);
        if (statusInt == Splunk.util.moduleLoadStates.WAITING_FOR_HIERARCHY) {
            this.hideDescendants(this.DRILLDOWN_VISIBILITY_KEY + "_" + this.moduleId);
        }
    },

    onPrintStart: function() {
        this.resize();
    },

    onPrintEnd: function() {
        this.resize();
    },

    /**
     * We assume that JSChart always require transformed results
     * see comments on this function in DispatchingModule.js for more details.
     */
    requiresTransformedResults: function() {
        return true;
    },

    /**
     * Current version of jQuery ui is buggy. Additional logic to make things work consistently.
     */

    enableResizable: function(){
        if (!($.browser.safari && $.browser.version < "526")) { //disable resizing for safari 3 and below only
            this.$moduleElement.resizable({
                autoHide: true,
                helper: "ui-resizable-helper",
                handles: "s",
                stop: this.onResizeStop.bind(this)
            });
            this.$moduleElement.mouseup( //workaround until jquery ui is updated
                function(event){
                    $(this).width('100%');
                }
            );
        }
    },

    /**
     * Handle a resize stop event from the Resizable jQuery extension. See http://docs.jquery.com/UI/Resizable
     * Saves the new height with a 'px' suffix to viewstate.conf.
     *
     * @param {Object} event Original browser event.
     * @param {Object} ui Prepared ui object having the following attributes: http://docs.jquery.com/UI/Resizable#overview
     */

    onResizeStop: function(event, ui) {
        $(this.chartContainer).height(ui.size.height);
        this.resize();
        $(event.target).width('100%');
        // in case the chart is part of a dashboard, we fire this custom event here to nudge the panels into alignment
        $(document).trigger(this.MANUAL_RESIZE_EVENT);
        this.setParam('height', ui.size.height + "px");
    },

    onDisplayReflow: function() {
        // reflow can involve modification of parent element's max-height, make sure to respect it
        var newChartHeight,
            parentMaxHeight = this.container.parent().css('max-height');
        if(parentMaxHeight === 'none') {
            // the parent has no max height, so revert to the cached previous height if it exists
            // otherwise ignore the reflow event
            if(!this.previousChartHeight) {
                return;
            }
            newChartHeight = this.previousChartHeight;
            this.previousChartHeight = undefined;
        }
        else {
            // the parent now has a max height, so cache the current height (if we haven't already) and set our height to match the parent
            if(!this.previousChartHeight) {
                this.previousChartHeight = $(this.chartContainer).height();
            }
            newChartHeight = parentMaxHeight;
        }
        this.container.css({'max-height': parentMaxHeight});
        $(this.chartContainer).height(newChartHeight);
        this.resize();
        // XXX this is a pretty big hack...
        // for reasons not understood, some reflow events (drag-and-drop moves) will cause the chart's hover interactions to stop working
        // the chart needs a "nudge" in the form of an artificial click event fired on mouse over
        if(this.chart && this.chart.hcChart) {
            var self = this;
            $(this.chartContainer).bind('mouseover.postReflowNudge', function() {
                $(self.chart.hcChart.container).focus().trigger('click');
                $(self).unbind('.postReflowNudge');
            });
        }
    },
    
    onPanelDrop: function() {
        // for the VML renderer have to redraw the dropped chart or it will lose its colors
        // accomplish this by calling pushDataToChart, which automatically redraws the chart with the most recent data
        if(this.chart && $.browser.msie && $.browser.version in {"6.0": true, "7.0": true, "8.0": true}) {
            this.updateId++;
            this.pushDataToChart(this.updateId);
        }
    },

    /**
     * The only reason you'd have a child of a JSChart is if you wanted to give it
     * various children that represent drilldown configurations.
     * Therefore if we have children, we automatically turn on the highlighting cues.
     */
    addChild: function($super, child) {
        this._enableDrilldown = true;
        this.setProperty("enableChartClick", true);
        // NOTE THAT WE MAY LATER DISABLE THIS IN chart='pie', because the special-casing of legend
        // items there breaks our model.
        this.setProperty("enableLegendClick", true);
        return $super(child);
    },

    getResultParams: function($super) {
        var params = $super();
        var context = this.getContext();
        var search  = context.get("search");

        if (!this.sid) {
            this.logger.error(this.moduleType, "Assertion Failed. getResultParams was called, but searchId is missing from my job.");
        }

        params.sid = this.sid;
        params.count = this.resultsCount;
        params.showOffset = 1;
        params.segmentation = 'raw';
        params.output_mode = 'json_cols';
        if(this.pp) {
            params.search = this.pp;
        }
        if(this.offset) {
            params.offset = this.offset;
        }
        
        return params;
    },

    getResultURL: function(params) {
        var context = this.getContext();
        var search  = context.get("search");

        var uri = Splunk.util.make_url('/splunkd/search/jobs/', this.sid,
                        (search.job.isDone()) ? '/results' : '/results_preview');
        uri += '?' + Splunk.util.propToQueryString(params);
        return uri;
    },

    renderResults: function(response) {
        this.updateId++;
        if(response) {
            if(this.requestID != this.properties['jobID']) {
                this.destroyChart();
                this.requestID = this.properties['jobID'];
            }
            this.response = response;
            // check the number of series, if it is larger than the "maxSeries" parameter, 
            // truncate and set a flag to indicate that an inline message should be shown
            if(this.response.columns.length > this.DEFAULT_MAX_SERIES) {
                this.response.columns = response.columns.slice(0, this.DEFAULT_MAX_SERIES);
                this.response.fields = response.fields.slice(0, this.DEFAULT_MAX_SERIES);
                this.response.numSeriesTruncated = true;
            }
            // check for a top/rare search and respect the "maxRowsForTop" parameter if it is set
            // this truncation takes precedence over all others since this is a parameter that should be part of the getResults URL
            // also suppress the "percent" field for top/rare
            if(this.resultsAreTopOrRare(this.response)) {
                if(this._params["maxRowsForTop"]) {
                    var maxRowsForTop = parseInt(this._params["maxRowsForTop"], 10);
                    if(!isNaN(maxRowsForTop)) {
                        this.response = this.sliceResultsBySeriesLength(this.response, maxRowsForTop);
                    }
                }
                this.setProperty("fieldHideList", ["percent"]);
            }
            else {
                this.setProperty("fieldHideList", null);
            }
        }
        // even if there is no data, we let the instruction to draw trickle down
        // and assume the chart will do the right thing.
        
        if(!this.chart || this.redrawNeeded) {
            this.draw(this.updateId);
        }
        else {
            this.pushDataToChart(this.updateId);
        }
    },

    // as a work-around we are testing for the presence of the _tc field for indication of a "top" or "rare" search
    resultsAreTopOrRare: function(response) {
        for(var i = 0; i < response.fields.length; i++) {
            if(response.fields[i] === "_tc") {
                return true;
            }
        }
        return false;
    },

    // creates a new results object with all series truncated to the number given
    sliceResultsBySeriesLength: function(response, howMany) {
        var sliced = $.extend(true, {}, response);
        for(var i = 0; i < response.columns.length; i++) {
            sliced.columns[i] = response.columns[i].slice(0, howMany);
        }
        return sliced;
    },

    onContextChange: function() {
        $('.messageContainer', this.container).hide().html('');
        this.hideDescendants(this.DRILLDOWN_VISIBILITY_KEY + "_" + this.moduleId);
        this._selection = null;

        var context = this.getContext();
        var search  = context.get("search");
        var sid = context.get('charting.data.jobID') || search.job.getSearchId();

        this.extractPropertiesFromContext(context, search, sid);

        // initially the value of the shouldRedraw flag depends on whether there were any results to draw in the first place,
        // later we will force it to false if a new search has been kicked off
        var resultCount = search.job.getResultCount();
        var searchIsRealTime = search._range._relativeArgs.latest.isRealTime;
        var sidHasChanged = false;
        var shouldRedraw = (resultCount > 0);

        if(this.sid != sid) {
            if(this.sid != 0) {
                this.destroyChart();
                this.response = false;
            }
            this.sid = sid;
            // if the search has changed, there is no point in redrawing the chart with the existing data
            shouldRedraw = false;
            sidHasChanged = true;
        }

        // if the results are stale and we have something to display, fetch new ones
        if(this.resultsAreStale && (resultCount || searchIsRealTime)) {
            this.getResults();
            this.resultsAreStale = false;
        }
        // otherwise redraw if we have results and a new search has not been kicked off,
        // if a new search has been kicked off, do nothing and wait for onJobProgress
        else if(shouldRedraw) {
            this.updateId++;
            // timing issue here, have to wait for the history manager to modify the URL
            // because HighCharts uses it as a unique identifier
            setTimeout(function() {
                this.redrawIfNeeded(this.updateId);
            }.bind(this), 0);
        }
    },

    extractPropertiesFromContext: function(context, search, sid) {
        if(context.get('charting.data.offset')) {
            var offset = parseInt(context.get('charting.data.offset'), 10);
            if(!isNaN(offset)) {
                this.offset = offset;
            }
        }
        if(context.get('charting.data.count')) {
            var count = parseInt(context.get('charting.data.count'), 10);
            if(!isNaN(count)) {
                this.resultsCount = count;
            }
        }

        // This handles the case where the sid has high byte chars in it.
        // It should probably be removed when Gatt has implemented encoding in his Flash lib.
        if (sid != null) {
            this.setProperty("jobID", encodeURIComponent(encodeURIComponent(sid)));
        }
        else {
            this.setProperty("jobID", sid);
        }

        // if the job is already done there will be no progress events, and right here the jobId assignment
        // will trigger the final render.
        // In order for PageStatus to be notified of these renders, we have to set up a monitor here.
        if (search.job.isDone()) {
            // Notifying PageStatus that a render is beginning.
            if (!this.renderMonitor) {
                this.renderMonitor = Splunk.Globals['PageStatus'].register(this.moduleType + ' - rendering final data - ' + this.container.attr('id'));
            }
            // also need to put up the message if we're done AND there's no data.
            // the check in onJobDone isnt sufficient cause chart formatting changes and the like
            // will push a new context with the same dispatched job.
            if (search.job.getResultCount() == 0) {
                this.showStatusMessage('results', 'nodata', sid);
            } else {
                this.hideStatusMessage();
            }
        }

        // Handle post process
        var pp = search.getPostProcess();
        if (pp) {
            this.pp = pp;
        }
        else {
            this.pp = false;
        }

        var propertyManagerHash = context.getAll("charting");

        // TEMPORARY -- the charting.swf special cases the handling of the legend in pie.
        //              legend items there are basically the same as the data values,
        //              and are not showing a split-by field.
        //              However it does it such that when the legend click comes,
        //              we've lost the information of the field-name so i cannot special case it here.
        // For now I've just disabled legend clicking.
        this.setProperty("enableLegendClick", (propertyManagerHash["chart"] != "pie"));


        // if this is a scatter chart we set some other values that make for more sensible defaults.
        // and that will 98% of the time make life better.
        // TODO - this is a possible candidate to be pulled into a generic pluggable validation/normalization mechanism in Context.

        var plotIntention = search.getIntentionReference("plot");
        var isTopOrRare = (plotIntention && plotIntention["arg"]["mode"] in {"top":1, "rare":1});

        // #1 - special case for top/rare, where we tell the charting system to only render the top N rows.
        if (this._params["maxRowsForTop"] && isTopOrRare && (propertyManagerHash["chart"] != "pie")) {
            this.setProperty("resultsCount", this._params["maxRowsForTop"]);
            this.resultsCount = Math.min(this.resultsCount, this._params["maxRowsForTop"]);
        } else {
            this.setProperty("resultsCount", this.getParam('maxResultCount'));
            this.resultsCount = Math.min(this.resultsCount, this.getParam('maxResultCount'));
        }

        // #2 - another special case for top/rare, where we suppress the 'percent' field.
        // this is currently being handled in renderResults
//        if(isTopOrRare) {
//            this.setProperty("fieldHideList", ["percent"]);
//        }
//        else {
//            this.setProperty("fieldHideList", null);
//        }
        if (plotIntention && plotIntention["arg"]["mode"]=="chart") {
            this.determineAxisType(plotIntention["arg"]);
        }
        // set the ancillary props
        if (propertyManagerHash && propertyManagerHash.hasOwnProperty('chartTitle') && propertyManagerHash['chartTitle']) {
            $('.chartTitle', this.container).text(propertyManagerHash['chartTitle']).show();
        } else {
            $('.chartTitle', this.container).hide();
        }

        // set the chart properties
        for (var key in propertyManagerHash) {
            if (propertyManagerHash.hasOwnProperty(key)) {
                this.setProperty(key, this.resolveStaticURL(key, propertyManagerHash[key]));
            }
        }
    },

    getModifiedContext: function() {
        var context = this.getContext();
        if (this._selection) {
            for (key in this._selection) {
                context.set(this.drilldownPrefix + "." + key, this._selection[key]);
            }

            var searchModified = false;
            var search = context.get("search");

            var searchRange  = search.getTimeRange();
            // if the selection itself has a timeRange (ie this is a timechart or an event click)
            // then we use that.
            if (this._selection.timeRange) {
                search.setTimeRange(this._selection.timeRange);
                searchModified = true;
            // otherwise, if this is a relative or realtime search.
            // then we take the current absolute-time snapshot FROM THE JOB
            // and use that as the drilldown timerange.
            } else if (!searchRange.isAbsolute() && !searchRange.isAllTime()) {
                var job = this.getContext().get("search").job;
                search.setTimeRange(job.getTimeRange());
                searchModified = true;
            }

            // push the modified search back into the context.
            if (searchModified) context.set("search", search);
        }
        return context;
    },

    /**
     *  override isReadyForContextPush to stop the pushes downstream
     * when we have no selected state
     */
    isReadyForContextPush: function($super) {
        if (!this._selection) {
            return Splunk.Module.CANCEL;
        }
        return $super();
    },

    resolveStaticURL: function(propertyName, propertyValue) {
        if (propertyName && propertyValue && (propertyValue.substring(0, 8) == "/static/"))
        {
            var lastDotIndex = propertyName.lastIndexOf(".");
            if (lastDotIndex > 0)
            {
                propertyName = propertyName.substring(lastDotIndex + 1, propertyName.length);
                if ((propertyName == "source") || (propertyName == "sourcePath"))
                {
                    var hadTrailingSlash = (propertyValue.charAt(propertyValue.length - 1) == "/");
                    propertyValue = Splunk.util.make_url(propertyValue);
                    var hasTrailingSlash = (propertyValue.charAt(propertyValue.length - 1) == "/");
                    if (hasTrailingSlash != hadTrailingSlash)
                        propertyValue = hadTrailingSlash ? propertyValue + "/" : propertyValue.substring(0, propertyValue.length - 1);
                }
            }
        }
        return propertyValue;
    },

    determineAxisType: function(intentionArg) {
        var fieldNames = [];

        //var fieldsList   = plotIntention["arg"]["fields"]
        // TODO - plot intentions in mode="chart" unfortunately extract the x-axis arg as though it was a 'splitby', which its not.
        var splitBy = intentionArg["splitby"];
        // TODO See above comment about mode="chart" and splitBy
        if (splitBy) fieldNames.push(splitBy);
        // TODO - when the above is fixed, the correct thing to do will be to get the [1] element from the fields themselves.
        //for (var i=0;i<fieldsList.length; i++) {
        //    fieldNames.push(fieldsList[i][1]);
        //}

        var args = {
            field_list:  fieldNames,
            top_count: 0,
            min_freq: 0
        };
        // we want a context that was run with statusBuckets>0.
        // If there's a base_sid attribute in the URL, that is exactly the general sort of thing
        // that guy is there for.  If he's there we use him.
        var search;
        var qsDict = Splunk.util.queryStringToProp(document.location.search);
        if (qsDict.hasOwnProperty("base_sid")) {
            search = Splunk.Search.resurrectFromSearchId(qsDict["base_sid"]);
        } else {
            // if no base_sid was found, we try and use our own sid, but it's quite likely
            // it was run with status_buckets=0 so our summary request will fail.
            search = this.getContext().get("search");
        }
        $.get(search.getUrl('summary', args), function(resultXML) {
            var eventCount = parseInt($(resultXML).find("summary").attr("c"), 10);
            var moduleInstance = this;
            $.each($(resultXML).find("field"), function(index) {
                var fieldElt = $(this);
                // treat as numeric if HALF or more of the occurences are considered numeric
                var isNumeric = (fieldElt.attr("nc") > fieldElt.attr("c")/2);
//                if (isNumeric) {
//                    //this.callBridgeMethod("setValue", "axisX", "numeric");
//                    //this.callBridgeMethod("setValue", "axisX.fitZero", "false");
//                } else {
//                    // revert to whatever internal defaults or autoswitching the swf has..
//                    //this.callBridgeMethod("clearValue", "axisX");
//                    //this.callBridgeMethod("clearValue", "axisX.fitZero");
//                }
            });

        }.bind(this));
    },

    onJobProgress: function() {
        if(!this._isVisible) {
            return;
        }
        var context = this.getContext();
        var search  = context.get("search");
        var resultCount = search.job.getResultCount();
        var searchIsRealTime = search._range._relativeArgs.latest.isRealTime;
        var searchIsTransforming = search.job.areResultsTransformed();
        var postProcess = search.getPostProcess();
        
        // if the search is non-transforming, don't try to plot the results
        // unless the search is being post-processed
        if(!searchIsTransforming && !postProcess) {
            this.showStatusMessage('results', 'nontransforming', null);
        }
        else if(resultCount == 0 && search.job.isDone()) {
            this.showStatusMessage('results', 'nodata', search.job.getSearchId());
        }
        else if(resultCount == 0 && !searchIsRealTime) {
            this.showStatusMessage('results', 'waiting', search.job.getSearchId());
            // call destroy here to handle a mid-job switch to disabled preview
            this.destroyChart();
        }
        else {
            this.hideStatusMessage();
            if(search.job.isPreviewable() && context.get('charting.data.preview') !== 'false') {
                this.getResults();
            }
        }
        if (search.job.isDone()) {
            // Notifying PageStatus that a render is beginning.
            if (!this.renderMonitor) {
                this.renderMonitor = Splunk.Globals['PageStatus'].register(this.moduleType + ' - rendering final data - ' + this.container.attr('id'));
            }
        }
    },

    onJobDone: function($super) {
        $super();

        if(!this._isVisible) {
            return;
        }

        var context = this.getContext();
        var search = context.get("search");
        var searchIsTransforming = search.job.areResultsTransformed();
        var postProcess = search.getPostProcess();
        
        // if the search is non-transforming, don't try to plot the results
        // unless the search is being post-processed
        if(!searchIsTransforming && !postProcess) {
            this.showStatusMessage('results', 'nontransforming', null);
        }
        else if (search.job.getResultCount() == 0) {
            this.showStatusMessage('results', 'nodata', search.job.getSearchId());
        }
        else {
            this.hideStatusMessage();
            this.getResults();
        }
    },

    stripUnderscoreFieldPrefix: function(fieldName) {
        // this and similar code in SimpleResultsTable is a temporary fix for SPL-27829
        // certain modules, notably SimpleResultsTable, (and even when displaying 'results'),
        // will suppress or otherwise treat underscore fields specially.
        // to circumvent negative effects from this, whenever reporting commands like chart
        // and timechart find themselves generating columns that begin with underscores,
        // they will tack on a bizarre "VALUE_" prefix to the column names.
        // Two wrongs dont really make a right but hopefully this provokes some discussion
        // between S&I and UI to resolve these issues in a better way.
        if (fieldName.indexOf(this.LEADING_UNDERSCORE_PREFIX) !=-1) {
            return fieldName.replace(this.LEADING_UNDERSCORE_PREFIX, "_");
        }
        return fieldName;
    },

    onDataUpdated: function(event) {
        var context = this.getContext();
        var search  = context.get("search");
        // screen out previews and (for the timeline) async updates onJobProgress
        if (search.isJobDispatched() && search.job.isDone()) {
            // each time you call 'update' you get back an int that increments each time.
            // We keep this int as a local property - this.updateId
            // if the 'updateCount' of this particular dataUpdated event, matches the last
            // update we asked for,  then we mark it complete.
            // it's possible however that we asked for another update RIGHT when the penultimate
            // update request returned.  That's what this check is doing.
            if (this.renderMonitor && (event.updateCount >= this.updateId)) {
                this.renderMonitor.loadComplete();
                this.renderMonitor = false;
            }
        }
    },

    _changeVisibility: function() {
        var visible = true;
        for (var mode in this._invisibilityModes) {
            if (this._invisibilityModes.hasOwnProperty(mode)) {
                visible = false;
            }
        }
        if(visible) {
            // while the module was hidden it was not being notified of context changes
            // so we set a flag that will result in fetching new results on the next call to onContextChange
            // TODO: would be nice to have a smarter way of figuring out if the results we have are stale or not
            this.resultsAreStale = true;

            this.container.show();
            this._isVisible = true;
        }
        else {
            this.container.hide();
            this._isVisible = false;
        }
    },

    onLegendClicked: function(event) {
        var seriesStr = event.text;
        this._selection = {};
        this._selection.name2 = this.stripUnderscoreFieldPrefix(event.text);
        // normalize the modifier keys for mac/pc control vs. command (this assumes a jQuery event!)
        event.ctrlKey = (event.domEvent.ctrlKey || event.domEvent.metaKey);
        if (this._selection && event.ctrlKey) {
            this._selection.modifierKey = event.ctrlKey;
        }
        this.showDescendants(this.DRILLDOWN_VISIBILITY_KEY + "_" + this.moduleId);
        this.pushContextToChildren();
    },

    onChartClicked: function(event) {
        var data = event.data;
        var fields = event.fields;

        this.showDescendants(this.DRILLDOWN_VISIBILITY_KEY + "_" + this.moduleId);
        this._selection = null;

        for (var i=0;i<fields.length; i++) {

            if (!this._selection) this._selection = {};
            // Although in the data they are called 'fields', in a more fundamental sense that is not always true.
            var name = fields[i];
            if (data.hasOwnProperty(name)) {
                if (i==0) {
                    this._selection.name  = name;
                    this._selection.value = data[name];
                }
                else if (i==1) {
                    this._selection.name2  = this.stripUnderscoreFieldPrefix(name);
                    this._selection.value2 = data[name];
                } else {
                    this.logger.error("we only support 2-d drilldown at the moment.");
                    this.logger.error(fields);
                    this.logger.error(data);
                }
            }
            else {
                this.logger.message("Assertion failed - received a click event but there was a field in fields that was not in the data.");
            }
        }
        if (this._selection.name=="_time") {
            if (data["_span"]) {
                var duration = parseFloat(data["_span"]);
                var startTime   = parseInt(this._selection.value, 10);  // convert from millis to epoch
                var endTime     = startTime + duration;
                this._selection.timeRange = new Splunk.TimeRange(startTime, endTime);
            }
        }
        // normalize the modifier keys for mac/pc control vs. command (this assumes a jQuery event!)
        event.ctrlKey = (event.domEvent.ctrlKey || event.domEvent.metaKey);
        if (this._selection && event.ctrlKey) {
            this._selection.modifierKey = event.ctrlKey;
        }

        this.pushContextToChildren();
    },

    /**
     * display a search job status message
     */

    showStatusMessage: function(entity_name, msg, sid) {
        this.statusEnabled = true;
        if(msg === "nontransforming") {
            $('.messageContainer', this.container).hide();
            $('.nonTransformingWarning', this.container).show();
        }
        else {
            $('.nonTransformingWarning', this.container).hide();
            var self = this;
            var getArgs = {
                entity_name: entity_name,
                msg: msg,
                sid: sid
            };
            $('.messageContainer', this.container).load(
                Splunk.util.make_url('/module/search/JSChart/statusMessage')
                + '?' + Splunk.util.propToQueryString(getArgs),
                function() {
                    if (self.statusEnabled) { $(this).show(); }
                }); // fix for weird timing issue
        }
    },

    hideStatusMessage: function() {
        this.statusEnabled = false;
        $('.messageContainer', this.container).hide().html('');
        $('.nonTransformingWarning', this.container).hide();
    },
    
    showInlineMessage: function() {
        $('.inlineMessageContainer', this.container).show();
    },
    
    hideInlineMessage: function() {
        $('.inlineMessageContainer', this.container).hide();
    },

    // look for css styles being applied to FlashChart, not JSChart (for backwards compatibility)
    sniffCssStyles: function() {
        // doing our best to put the mock FlashChart element in the right document context, but style rules based on children number might not work
        var $mockFlashChart = $('<div class="FlashChart" style="display: none"></div>').insertAfter(this.container);

        this.properties.backgroundColor = $mockFlashChart.css('backgroundColor') || "#ffffff";
        this.properties.foregroundColor = $mockFlashChart.css('borderLeftColor') || "#000000";
        this.properties.fontColor = $mockFlashChart.css('color') || "#000000";

        $mockFlashChart.remove();
    },

    redrawIfNeeded: function(updateCount) {
        if(this.redrawNeeded) {
            this.draw(updateCount);
        }
        else {
            this.onDataUpdated({updateCount: updateCount});
        }
    },

    draw: function(updateCount) {
        // if dependencies are not loaded yet, defer the draw the their on-ready callback
        if(!this.chartingLibLoaded) {
            this.hasPendingDraw = true;
            return;
        }
        var i, newFieldList,
            fieldInfo = Splunk.JSCharting.extractFieldInfo(this.response),
            data = this.getChartReadyData(this.response, fieldInfo, this.properties),
            drawCallback = function(chartObject) {
                this.redrawNeeded = false;
                this.onDataUpdated({updateCount: updateCount});
                this.updateGlobalReference(chartObject);
            }.bind(this);
        
        this.destroyChart();
        this.chart = Splunk.JSCharting.createChart(this.chartContainer, this.properties);

        this.chart.addEventListener('chartClicked', this.onChartClicked.bind(this));
        this.chart.addEventListener('legendClicked', this.onLegendClicked.bind(this));

        this.chart.prepare(data, fieldInfo, this.properties);

        if(this.chart.needsColorPalette) {
            newFieldList = this.chart.getFieldList();
            this.applyColorsAndDraw(newFieldList, drawCallback);
        }
        else {
            this.chart.draw(drawCallback);
        }
    },

    pushDataToChart: function(updateCount) {
        var newFieldList,
            fieldInfo = Splunk.JSCharting.extractFieldInfo(this.response),
            data = this.getChartReadyData(this.response, fieldInfo, this.properties),
            successCallback = function(chartObject) {
                this.onDataUpdated({updateCount: updateCount});
                this.updateGlobalReference(chartObject);
            }.bind(this);

        this.chart.setData(data, fieldInfo);
        if(this.chart.needsColorPalette) {
            newFieldList = this.chart.getFieldList();
            this.applyColorsAndDraw(newFieldList, successCallback);
        }
        else {
            this.chart.draw(successCallback);
        }
    },
    
    getChartReadyData: function(response, fieldInfo, properties) {
        var adjustedResponse;
        this.hideInlineMessage();
        this.properties['axisLabelsX.hideCategories'] = false;
        // for pie and scatter charts or gauges, don't adjust the raw response
        if(properties.chart in {pie: true, scatter: true, radialGauge: true, fillerGauge: true, markerGauge: true}) {
            adjustedResponse = response;
        }
        //set a limit on the total number of data points based on the chart type and renderer
        var actualPointsPerSeries = response.columns[0].length,
            // the SVG renderer can handle more column-type points than the VML renderer
            maxColumnPoints = ($.browser.msie && $.browser.version in {"6.0": true, "7.0": true, "8.0": true}) ? 1000 : 1200,
            maxLinePoints = 2000,
            maxPoints = (properties.chart in {line: true, area: true}) ? maxLinePoints : maxColumnPoints,
            numSeries = fieldInfo.fieldNames.length,
            pointsAllowedPerSeries = Math.floor(maxPoints / numSeries);
        
        if(actualPointsPerSeries > pointsAllowedPerSeries) {
            adjustedResponse = this.sliceResultsBySeriesLength(response, pointsAllowedPerSeries);
            this.showInlineMessage();
        }
        else {
            adjustedResponse = response;
        }
        
        // for category-based charting, use the CATEGORY_LABEL_CUTOFF to determine if labels should be shown
        if(!this.resultsAreTopOrRare(response) && !fieldInfo.isTimeData) {
            var numCategories = adjustedResponse.columns[0].length;
            if(numCategories > this.CATEGORY_LABEL_CUTOFF) {
                this.properties['axisLabelsX.hideCategories'] = true;
            }
        }
        
        if(response.numSeriesTruncated && !(properties.chart in {pie: true, scatter: true, radialGauge: true, fillerGauge: true, markerGauge: true})) {
            this.showInlineMessage();
        }
        return Splunk.JSCharting.extractChartReadyData(adjustedResponse, fieldInfo);
    },

    // create/update the reference to the chart object in the global map so it is accessible for automated testing
    updateGlobalReference: function(chartObject) {
        Splunk.Module.JSChart.setChartById(this.moduleId, chartObject);
    },

    applyColorsAndDraw: function(fieldList, callback) {
        var i, loopLabel, masterIndex, localIndex, colorIndex, colorHex,
            colors = [],
            shouldNotifyMaster = false,
            legendTotalSize = this.legendManager.numLabels();
        
        this.legendFieldList = fieldList;
        
        // make sure the legend field map is up to date, will need to fetch new label mappings if
        // a new label was added that doesn't have an index in the master legend manager
        for(i = 0; i < this.legendFieldList.length; i++) {
            loopLabel = this.legendFieldList[i];
            masterIndex = this.legendManager.getLabelIndex(loopLabel);
            localIndex = this.legendFieldMap[loopLabel];
            if(masterIndex === -1) {
                // the label is not being tracked by the master
                shouldNotifyMaster = true;
            }
            else {
                // the master legend is tracking this label, so we can safely use the same index
                this.legendFieldMap[loopLabel] = masterIndex;
            }
        }
        // if the shouldNotifyMaster flag is set, have to notify the master legend manager and wait for an update
        if(shouldNotifyMaster) {
            this.legendManager.setLabels(this.legendFieldList);
            this.pendingCallback = callback;
        }
        // otherwise we have what we need to draw right away
        else {
            for(i = 0; i < this.legendFieldList.length; i++) {
                colorIndex = this.legendFieldMap[this.legendFieldList[i]];
                colorHex = this.colorPalette.getColor(this.legendFieldList[i], colorIndex, legendTotalSize);
                colors.push(Splunk.JSCharting.ColorUtils.colorFromHex(colorHex));
            }
            this.chart.setColors(colors);
            this.chart.draw(callback);
        }
    },

    resize: function() {
        if(this.chart) {
            // resizing is expensive, make sure the dimensions actually changed before doing it
            var currentWidth = this.chart.chartWidth,
                currentHeight = this.chart.chartHeight,
                newWidth = $(this.chartContainer).width(),
                newHeight = $(this.chartContainer).height();
            
            if(currentWidth != newWidth || currentHeight != newHeight) {
                this.chart.resize(newWidth, newHeight);
            }
        }
    },

    setProperty: function(propertyName, value) {
        if(this.properties[propertyName] !== value) {
            this.properties[propertyName] = value;
            this.onPropertyChanged(propertyName, value);
        }
    },

    getProperty: function(propertyName){
        return this.properties[propertyName];
    },

    // based on the property name, decides if the chart can be updated in place,
    // or flips the redrawNeeded boolean so a full redraw will take place on the
    // next call to redrawIfNeeded
    onPropertyChanged: function(name, value) {
        if(name == 'jobID') {
            // a new job is being kicked off, so reset all legend color data
            this.legendIndexMap = {};
            this.globalLegendSize = 0;
            this.localLegendSize = 0;
            return;
        }
        if(name == 'chartTitle') {
            return;
        }
        if(name == 'chart' || name == 'layout.splitSeries') {
            this.destroyChart();
        }
        this.redrawNeeded = true;
    },
    
    destroyChart: function() {
        if(this.chart) {
            this.chart.destroy();
            $(this.chartContainer).empty();
            this.chart = false;
        }
    },

    chartIsAGauge: function() {
        return (this.properties.chart in {radialGauge: 1, fillerGauge: 1, markerGauge: 1});
    }

});

// some "class" level methods for managing the various charts on a given page
// FOR TESTING ONLY!

Splunk.Module.JSChart.chartByIdMap = {};

Splunk.Module.JSChart.getChartById = function(moduleId) {
    return this.chartByIdMap[moduleId];
};

Splunk.Module.JSChart.setChartById = function(moduleId, chart) {
    this.chartByIdMap[moduleId] = chart;
};
