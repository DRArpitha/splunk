Splunk.HCBridge = {};

////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.ChartBuilder


Splunk.HCBridge.ChartBuilder = {

    createChart: function(properties, container) {
        var chartConstructor = this.getConstructorByType(properties.chart, properties);
        if(properties['layout.splitSeries'] === 'true') {
            return new Splunk.HCBridge.SplitSeriesChart(container, chartConstructor);
        }
        return new chartConstructor(container);
    },

    getConstructorByType: function(chartType, properties) {

        switch(chartType) {

            case 'line':
                return Splunk.HCBridge.LineChart;

            case 'area':
                return Splunk.HCBridge.AreaChart;

            case 'column':
                return Splunk.HCBridge.ColumnChart;

            case 'bar':
                return Splunk.HCBridge.BarChart;

            case 'pie':
                return Splunk.HCBridge.PieChart;

            case 'scatter':
                return Splunk.HCBridge.ScatterChart;

            case 'radialGauge':
                return Splunk.HCBridge.RadialGauge;

            case 'fillerGauge':
                return (properties['chart.orientation'] === 'x') ? 
                        Splunk.HCBridge.HorizontalFillerGauge : Splunk.HCBridge.VerticalFillerGauge;

            case 'markerGauge':
                return (properties['chart.orientation'] === 'x') ? 
                        Splunk.HCBridge.HorizontalMarkerGauge : Splunk.HCBridge.VerticalMarkerGauge;

            default:
                return Splunk.HCBridge.ColumnChart;

        }

    }

};


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AbstractVisualization


Splunk.HCBridge.AbstractVisualization = $.klass({
    
    eventMap: {},
    
    initialize: function(container) {
        
        // this is copied from the Highcharts source, line 38
        this.hasSVG = !!document.createElementNS &&
            !!document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect;
        
    },
    
    applyProperties: function(properties) {
        for(var key in properties) {
            if(properties.hasOwnProperty(key)) {
                this.applyPropertyByName(key, properties[key], properties);
            }
        }
        this.performPropertyCleanup();
    },
    
    applyPropertyByName: function(key, value, properties) {
        
    },
    
    performPropertyCleanup: function() {
        
    },
    
    addEventListener: function(type, callback) {
        if(this.eventMap[type]) {
            this.eventMap[type].push(callback);
        }
        else {
            this.eventMap[type] = [callback];
        }
    },

    removeEventListener: function(type, callback) {
        if(this.eventMap[type] == undefined) {
            return;
        }
        var index = $.inArray(callback, this.eventMap[type]);
        if(this.eventMap[type][index]) {
            this.eventMap[type].splice(index, 1);
        }
    },

    dispatchEvent: function(type, event) {
        event = event || {};
        if(this.eventMap[type]) {
            for(var i in this.eventMap[type]) {
                this.eventMap[type][i](event);
            }
        }
    }
    
});



////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AbstractChart


Splunk.HCBridge.AbstractChart = $.klass(Splunk.HCBridge.AbstractVisualization, {

    needsColorPalette: true,

    // override
    initialize: function($super, container) {
        $super(container);
        this.hcConfig = false;
        this.hcChart = false;
        this.chartIsDrawing = false;
        this.chartIsStale = false;
        this.processedData = false;
        this.pendingData = false;
        this.pendingColors = false;
        this.pendingCallback = false;
        this.customConfig = false;
        this.chartIsEmpty = false;

        this.renderTo = container;
        this.chartHeight = $(this.renderTo).height();

        this.logYAxis = false;
        this.legendMaxWidth = 300;
        this.legendEllipsizeMode = 'ellipsisMiddle';
        this.tooMuchData = false;
        this.userDefinedCategories = false;
        
        this.fieldListMode = "hide_show";
        this.fieldHideList = [];
        this.fieldShowList = [];
    },

    draw: function(data, colors, properties, callback) {
        this.properties = properties;
        this.colors = colors;
        if(this.chartIsDrawing) {
            this.chartIsStale = true;
            this.pendingData = data;
            this.pendingCallback = callback;
            return;
        }
        this.chartIsDrawing = true;
        this.generateDefaultConfig();
        this.applyProperties(properties);
        this.processRawData(data, properties);
        if(this.chartIsEmpty) {
            this.configureEmptyChart();
        }
        else {
            this.hcConfig.colors = colors;
            this.applyFormatting(properties, this.processedData);
            this.addEventHandlers(properties, this.processedData);
            if(this.customConfig) {
                $.extend(true, this.hcConfig, this.customConfig);
            }
        }
        if(this.hcChart) {
            this.destroy();
        }
        this.hcChart = new Highcharts.Chart(this.hcConfig, function(chart) {
            if(this.chartIsStale) {
                // if new data came in while the chart was rendering, re-draw immediately
                this.chartIsStale = false;
                this.draw(this.pendingData, this.pendingColors, this.pendingCallback);
            }
            else {
                this.onDrawFinished(chart, callback);
            }
        }.bind(this));

        // DEBUGGING
        window.chart = this.hcChart;
        window.chartConfig = this.hcConfig;
        window.processedData = this.processedData;
    },

    setData: function(data, callback) {
        clearTimeout(this.drawTimeout);
        this.draw(data, this.colors, this.properties, callback);
        return;

        /*

        for the moment, don't try to push data to the chart without redrawing
        it is fraught with bugs, and the effect is not noticeable
        
        here is some old code in case it ever becomes useful

        var i;
        this.processRawData(data, this.properties);
        for(i = 0; i < this.hcConfig.series.length; i++) {
            if(this.hcChart.series.length > i) {
                // series already exists, clobber the data
                this.hcChart.series[i].setData(this.hcConfig.series[i].data);
                if(this.processedData.xAxisType == "category") {
                    this.hcChart.xAxis[0].setCategories(this.processedData.categories);
                }
            }
            else {
                // brand new data, create a new series
                this.hcChart.addSeries(this.hcConfig.series[i]);
            }
        }

        */
    },

    resize: function(width, height) {
        if(this.hcChart) {
            this.hcChart.setSize(width, height, false);
        }
    },

    destroy: function() {
        if(this.hcChart) {
            clearTimeout(this.drawTimeout);
            this.hcChart.destroy();
            this.hcChart = false;
        }
    },

    // a way to set custom config options on an instance specific basis,
    // will be applied after all other configurations
    setCustomConfig: function(config) {
        this.customConfig = config;
    },

    highlightSeriesInLegend: function(index) {
        $(this.hcChart.series).each(function(i, loopSeries) {
            if(i != index) {
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 0.25;
                });
            }
        }.bind(this));
    },

    unHighlightSeriesInLegend: function(index) {
        $(this.hcChart.series).each(function(i, loopSeries) {
            if(i != index) {
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 1.0;
                });
            }
        }.bind(this));
    },

    getChartSizeX: function() {
        if(!this.hcChart) {
            return undefined;
        }
        return this.hcChart.plotSizeX;
    },

    getChartSizeY: function() {
        if(!this.hcChart) {
            return undefined;
        }
        return this.hcChart.plotSizeY;
    },

    ///////////////////////////////////////////////////////////////////////////
    // end of "public" interface

    generateDefaultConfig: function() {
        this.hcConfig = $.extend(true, {}, Splunk.HCBridge.DEFAULT_HC_CONFIG, {
            chart: {
                renderTo: this.renderTo,
                height: this.chartHeight
            }
        });
    },

    applyFormatting: function(properties, data) {
        this.formatTooltip(properties, data);
        this.formatLegend();
        this.formatXAxis(properties, data);
        this.formatYAxis(properties, data);
    },

    addEventHandlers: function(properties, data) {
        this.addClickHandlers(data);
        this.addHoverHandlers();
        this.addLegendHandlers(properties);

    },

    processRawData: function(rawData, properties) {
        this.extractProcessedData(rawData, properties);
        if(!this.chartIsEmpty) {
            this.addDataToConfig();
        }
    },

    onDrawFinished: function(chart, callback) {
        var finalizeCallback = function() {
            this.finalizeChart();
            if(this.hcConfig.legend.enabled) {
                this.addLegendHoverEffects(chart);
            }
            this.addTestingMetadata(chart);
            this.chartIsDrawing = false;
            this.hcObjectId = chart.container.id;
            if(callback) {
                callback();
            }
        }.bind(this);
        
        if(this.tooMuchData) {
            $(this.renderTo).hide();
            this.addDataAsync(chart, function() {
                $(this.renderTo).show();
                finalizeCallback();
            }.bind(this));
        }
        else {
            finalizeCallback();
        }
    },

    finalizeChart: function() {
        // remove un-labeled tick marks on time axes
        if(this.processedData.xAxisType == 'time') {
            var $labels, $ticks;
            $('.highcharts-axis', $(this.renderTo)).each(function(i, axis) {
                $labels = $('text', $(axis));
                $ticks = $('path', $(axis));
                if(this.properties.chart in {area: 1, line: 1}) {
    				$labels.each(function(j, label) {
    				    if(label.textContent === ' ') {
    				        $ticks.eq(j).remove();
    				    }
    				});
                }
                // in the case of bar and line charts (where tick placement is 'between')
                // we actually remove the tick before the label in question
                else {
                    $labels.each(function(j, label) {
                        if(j !== 0 && label.textContent === ' ') {
                            $ticks.eq(j - 1).remove();
                        }
                    });
                    $ticks.last().remove();
                }
            }.bind(this));
        }
    },

    addDataAsync: function(chart, callback) {
        var i, seriesObject,
            numAdded = 0,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series,
            addSeriesByIndex = function(i) {
                seriesObject = this.constructSeriesObject(fieldNames[i],
                                series[fieldNames[i]], this.properties);
                if(seriesObject) {
                    chart.addSeries(seriesObject);
                }
            }.bind(this),
            addNextOrFinish = function() {
                if(numAdded == fieldNames.length) {
                    callback();
                }
                else {
                    addSeriesByIndex(numAdded);
                    numAdded++;
                    this.drawTimeout = setTimeout(addNextOrFinish, 15)
                }
            }.bind(this);

        this.drawTimeout = setTimeout(addNextOrFinish, 15);
    },

    configureEmptyChart: function() {
        $.extend(true, this.hcConfig, {
            yAxis: {
                min: 0,
                max: (this.logYAxis) ? 2 : 100,
                tickInterval: (this.logYAxis) ? 1 : 10,
                labels: {
                    formatter: (this.logYAxis) ?
                        function() {
                            return Math.pow(10, this.value);
                        } :
                        function() {
                            return this.value;
                        }
                }
            },
            legend: {
                enabled: false
            },
            series: [
                {
                    data: [],
                    visible: false,
                    showInLegend: false
                }
            ]
        });
    },

    ////////////////////////////////////////////////////////////////////////////
    // helper methods for managing chart properties
    
    // override
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        
        switch(key) {

            case 'chart.stackMode':
                this.mapStackMode(value, properties);
                break;
            case 'legend.placement':
                this.mapLegendPlacement(value);
                break;
            case 'primaryAxisTitle.text':
			case 'axisTitleX.text':
                this.mapPrimaryAxisTitle(value);
                break;
            case 'secondaryAxisTitle.text':
			case 'axisTitleY.text':
                this.mapSecondaryAxisTitle(value);
                break;
            case 'secondaryAxis.minimumNumber':
            case 'axisY.minimumNumber':
            case 'primaryAxis.minimumNumber':
            case 'axisX.minimumNumber':
                this.mapAxisMin(key, value, properties);
                break;
            case 'secondaryAxis.maximumNumber':
            case 'axisY.maximumNumber':
            case 'primaryAxis.maximumNumber':
            case 'axisX.maximumNumber':
                this.mapAxisMax(key, value, properties);
                break;
            case 'secondaryAxis.includeZero':
            case 'axisY.includeZero':
            case 'primaryAxis.includeZero':
            case 'axisX.includeZero':
                this.mapIncludeZero(key, value, properties);
                break;
            case 'axisLabelsY.axisVisibility':
            case 'axisLabelsX.axisVisibility':
                this.mapAxisVisibility(key, value, properties);
                break;
            case 'axisLabelsY.majorTickSize':
            case 'axisLabelsX.majorTickSize':
                this.mapMajorTickSize(key, value, properties);
                break;
            case 'axisLabelsY.majorTickVisibility':
            case 'axisLabelsX.majorTickVisibility':
                this.mapMajorTickVisibility(key, value, properties);
                break;
            case 'axisLabelsY.majorLabelVisibility':
            case 'axisLabelsX.majorLabelVisibility':
                this.mapMajorLabelVisibility(key, value, properties);
                break;
            case 'axisLabelsY.majorUnit':
            case 'axisLabelsX.majorUnit':
                this.mapMajorUnit(key, value, properties);
                break;
            case 'axisLabelsY.minorTickSize':
            case 'axisLabelsX.minorTickSize':
                this.mapMinorTickSize(key, value, properties);
                break;
            case 'axisLabelsY.minorTickVisibility':
            case 'axisLabelsX.minorTickVisibility':
                this.mapMinorTickVisibility(key, value, properties);
                break;
            case 'axisLabelsY.extendsAxisRange':
            case 'axisLabelsX.extendsAxisRange':
                this.mapExtendsAxisRange(key, value, properties);
                break;
            case 'chart.showMarkers':
                this.mapShowMarkers(value);
                break;
            case 'chart.nullValueMode':
                this.mapNullValueMode(value);
                break;
            case 'secondaryAxis.scale':
            case 'axisY.scale':
                this.mapSecondaryAxisScale(value);
                break;
            case "enableChartClick":
                this.enableChartClick = value;
                break;
            case "enableLegendClick":
                this.enableLegendClick = value;
                break;
            case 'legend.labelStyle.overflowMode':
                this.legendEllipsizeMode = value;
                break;
            case 'axisX.categories':
                this.userDefinedCategories = this.parseSerializedArray(value);
                break;
            case 'data.fieldListMode':
                this.fieldListMode = value;
                break;
            case 'data.fieldHideList':
                this.fieldHideList = this.parseSerializedArray(value) || [];
                break;
            case 'data.fieldShowList':
                this.fieldShowList = this.parseSerializedArray(value) || [];
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        }
    },
    
    // override
    // this method's purpose is to post-process the properties and resolve any that are interdependent
    performPropertyCleanup: function() {
        if(this.xAxisIncludeZero) {
            if(!this.hcConfig.xAxis.min || this.hcConfig.xAxis.min > 0) {
                this.hcConfig.xAxis.min = 0;
            }
            // hitting this else would mean a min is defined and is negative
            else if(!this.hcConfig.xAxis.max || this.hcConfig.xAxis.max < 0) {
                this.hcConfig.xAxis.max = 0;
            }
        }
        if(this.yAxisIncludeZero) {
            if(!this.hcConfig.yAxis.min || this.hcConfig.yAxis.min > 0) {
                this.hcConfig.yAxis.min = 0;
            }
            // hitting this else would mean a min is defined and is negative
            else if(!this.hcConfig.yAxis.max || this.hcConfig.yAxis.max < 0) {
                this.hcConfig.yAxis.max = 0;
            }
        }
    },

    mapStackMode: function(name, properties) {
        if(properties['layout.splitSeries'] == 'true') {
            name = 'default';
        }
        var translation = {
            "default": null,
            "stacked": "normal",
            "stacked100": "percent"
        };
        $.extend(true, this.hcConfig, {
            plotOptions: {
                column: {
                    stacking: translation[name]
                },
                area: {
                    stacking: translation[name]
                },
                bar: {
                    stacking: translation[name]
                }
            }
        });
    },

    mapLegendPlacement: function(name) {
        if(name in {left: 1, right: 1}) {
            $.extend(true, this.hcConfig, {
                legend: {
                    enabled: true,
                    verticalAlign: 'middle',
                    align: name,
                    layout: 'vertical'
                }
            });
        }
        else if(name in {bottom: 1, top: 1}) {
            var margin = (name == 'top') ? 30 : 15;
            $.extend(true, this.hcConfig, {
                legend: {
                    enabled: true,
                    verticalAlign: name,
                    align: 'center',
                    layout: 'horizontal',
                    margin: margin
                }
            });
        }
        else {
            $.extend(true, this.hcConfig, {
                legend: {
                    enabled: false
                }
            });
        }
    },

    mapPrimaryAxisTitle: function(titleText) {
        $.extend(true, this.hcConfig, {
            xAxis: {
                title: {
                    text: titleText || ''
                }
            }
        });
    },

    mapSecondaryAxisTitle: function(titleText) {
        $.extend(true, this.hcConfig, {
            yAxis: {
                title: {
                    text: titleText || ''
                }
            }
        });
    },

    mapAxisMin: function(key, value, properties) {
        var axisName = this.inferAxisFromKey(key),
            parsedValue = parseFloat(value, 10),
            useLog = (properties['secondaryAxis.scale'] === 'log' || properties['axisY.scale'] === 'log');
        parsedValue = isNaN(parsedValue) ? 0 : parsedValue;
        // if we are in log mode, have to log this value
        if(parsedValue && (axisName === 'yAxis') && useLog) {
            parsedValue = Splunk.HCBridge.Utils.absLogBaseTen(parsedValue);
        }
        $.extend(true, this.hcConfig[axisName], {
            min: parsedValue,
            startOnTick: (axisName === 'yAxis' && parsedValue == 0)
        });
    },

    mapAxisMax: function(key, value, properties) {
        var axisName = this.inferAxisFromKey(key),
            safeValue = Splunk.HCBridge.Utils.floatOrNull(value),
            useLog = (properties['secondaryAxis.scale'] === 'log' || properties['axisY.scale'] === 'log');
        // if we are in log mode, have to log this value
        if(safeValue && (axisName === 'yAxis') && useLog) {
            safeValue = Splunk.HCBridge.Utils.absLogBaseTen(safeValue + 0.1);
        }
        $.extend(true, this.hcConfig[axisName], {
            max: safeValue,
            endOnTick: (axisName === 'yAxis' && safeValue == null)
        });
    },
    
    mapIncludeZero: function(key, value, properties) {
        if(value === 'true') {
            var axisName = this.inferAxisFromKey(key);
            if(axisName === 'xAxis') {
                this.xAxisIncludeZero = true;
            }
            else if(axisName === 'yAxis') {
                this.yAxisIncludeZero = true;
            }
        }
    },
    
    mapAxisVisibility: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            lineWidth: (value === 'hide') ? 0 : 1
        });
    },
    
    mapMajorTickSize: function(key, value, properties) {
        var size = parseInt(value, 10);
        if(!isNaN(size)) {
            var axisName = this.inferAxisFromLabelKey(key);
            $.extend(true, this.hcConfig[axisName], {
                tickLength: size
            });
        }
    },
    
    mapMajorTickVisibility: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            tickWidth: (value === 'hide') ? 0 : 1
        });
    },
    
    mapMajorLabelVisibility: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            labels: {
                enabled: (value !== 'hide')
            }
        });
    },
    
    mapMajorUnit: function(key, value, properties) {
        var unit = parseInt(value, 10);
        if(!isNaN(unit)) {
            var axisName = this.inferAxisFromLabelKey(key);
            $.extend(true, this.hcConfig[axisName], {
                tickInterval: unit
            });
        }
    },
    
    mapMinorTickSize: function(key, value, properties) {
        var size = parseInt(value, 10);
        if(!isNaN(size)) {
            var axisName = this.inferAxisFromLabelKey(key);
            $.extend(true, this.hcConfig[axisName], {
                minorTickLength: size
            });
        }
    },
    
    mapMinorTickVisibility: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            minorTickWidth: (value !== 'hide') ? 1 : 0,
            minorTickInterval: (value !== 'hide') ? 'auto' : null
        });
    },
    
    mapExtendsAxisRange: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            endOnTick: (value === 'true')
        });
    },
    
    mapIntegerUnits: function(key, value, properties) {
        var axisName = this.inferAxisFromLabelKey(key);
        $.extend(true, this.hcConfig[axisName], {
            allowDecimals: (value !== 'true')
        });
    },

    mapShowMarkers: function(value) {
        var booleanValue = (value == "true") ? true : false;
        $.extend(true, this.hcConfig, {
            plotOptions: {
                line: {
                    marker: {
                        radius: (booleanValue) ? 5 : 0
                    }
                }
            }
        });
    },

    mapNullValueMode: function(value) {
        if(value == 'connect') {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    series: {
                        connectNulls: true
                    }
                }
            });
        }
        // the distinction between omit and zero is handled by the
        // extractProcessedData method
    },
    
    mapSecondaryAxisScale: function(value) {
        if(value == 'log') {
            this.logYAxis = true;
        }
    },
    
    inferAxisFromKey: function(key) {
        if((/axisX/).test(key) || (/primaryAxis/).test(key)) {
            return 'xAxis';
        }
        if((/axisY/).test(key) || (/secondaryAxis/).test(key)) {
            return 'yAxis';
        }
    },
    
    inferAxisFromLabelKey: function(key) {
        if((/axisLabelsX/).test(key)) {
            return 'xAxis';
        }
        if((/axisLabelsY/).test(key)) {
            return 'yAxis';
        }
    },
    
    parseSerializedArray: function(str) {
        if(str.charAt(0) !== '[' || str.charAt(str.length - 1) !== ']') {
            return false;
        }
        str = str.substr(1, str.length - 2);
        return str.split(',');
    },

    ////////////////////////////////////////////////////////////////////////////
    // helper methods for handling label and axis formatting

    formatTooltip: function(properties, data) {
        var xAxisKey = data.xAxisKey,
            resolveX = this.getTooltipXResolver(data.xAxisType),
            resolveY = this.getTooltipYResolver();
            
        $.extend(true, this.hcConfig, {
            tooltip: {
                formatter: function() {
                    return [
		      data.xAxisType == 'time' ? '' : ('<span style="color:#cccccc">' + xAxisKey + ': </span>'),
                      '<span style="color:#ffffff">', resolveX(this), '</span>', '<br/>',
                      '<span style="color:', this.point.series.color, '">', this.series.name, ': </span>',
                      '<span style="color:#ffffff">', resolveY(this), '</span>'
                    ].join('');
                }
            }
        })
    },
    
    getTooltipXResolver: function(axisType) {
        if(axisType == 'time') {
            // use the name field from the point object in case the time name
            // has been ellipsized
            return function(element) {
		var bdtime = (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d+[+-]{1}\d{2}:\d{2}$/.exec(element.point.name));
		if (!bdtime)
		    return element.point.name;

		var dateObj = new Date(bdtime[1], bdtime[2]-1, bdtime[3], bdtime[4], bdtime[5], bdtime[6]);
		var span = element.point._span || 1;

		if (span >= 86400) { // day or larger
		    return format_date(dateObj);
		} else if (span >= 60) { // minute or longer
		    return format_datetime(dateObj, 'medium', 'short');
		}

		return format_datetime(dateObj);
            }
        }
        if(axisType == 'category') {
            // use the name field from the point object in case the category name
            // has been ellipsized
            return function(element) {
                return element.point.name;
            }
        }
        // axisType is assumed to be "numeric"
        return function(element) {
            return element.x
        }
    },
    
    getTooltipYResolver: function() {
        return function(element) {
            return format_decimal(element.point.rawY);
        }
    },

    formatLegend: function() {
        var self = this;
        $.extend(true, this.hcConfig, {
            legend: {
                labelFormatter: function() {
                    return self.resolveLegendLabel.call(self, this.name);
                }
            }
        });
    },
    
    resolveLegendLabel: function(label) {
        var labelWidth = this.predictTextWidth(label, 12);
        if(labelWidth > this.legendMaxWidth) {
            return this.ellipsizeLegendElement(label);
        }
        return label;
    },
    
    ellipsizeLegendElement: function(label) {
        switch(this.legendEllipsizeMode) {
            
            case 'default':
                return this.startEllipsize(label, this.legendMaxWidth, 12);
            case 'ellipsisMiddle':
                return this.middleEllipsize(label, this.legendMaxWidth, 12);
            case 'ellipsisEnd':
                return this.endEllipsize(label, this.legendMaxWidth, 12);
            default:
                return this.middleEllipsize(label, this.legendMaxWidth, 12);
        
        }
    },

    formatXAxis: function(properties, data) {
        var self = this, 
            axisLength, safetyFactor, pixelsPerCategory,
            axisType = data.xAxisType,
            min = data.xMin,
            max = data.yMax,
            // TODO: this should probably depend on the width of chart and/or label
            tickPixelInterval = 200,
            resolveLabel = this.getXLabelResolver(axisType, min, max, tickPixelInterval);

        if(axisType == "category") {
            axisLength = $(this.renderTo).width();
            safetyFactor = 1.25;
            pixelsPerCategory = axisLength / (data.categories.length * safetyFactor);
            this.ellipsizeCategoriesIfNeeded(pixelsPerCategory);
            $.extend(true, this.hcConfig, {
                xAxis: {
                    categories: data.categories,
                    startOnTick: (this.hcConfig.chart.type in {line: 1, area: 1}),
                    tickmarkPlacement: (this.hcConfig.chart.type in {line: 1, area: 1}) ? 'on' : 'between',
                    labels: {
                        x: (this.hcConfig.chart.type in {line: 1, area: 1}) ? 5 : -pixelsPerCategory / 2 + 5
                    },
                    min: null,
                    max: null
                }
            });
        }
        else if(axisType == 'time') {
            axisLength = $(this.renderTo).width();
            safetyFactor = 1.25;
            pixelsPerCategory = axisLength / (data.categories.length * safetyFactor);
            $.extend(true, this.hcConfig, {
                xAxis: {
                    categories: data.categories,
                    startOnTick: (this.hcConfig.chart.type in {line: 1, area: 1}),
                    tickmarkPlacement: (this.hcConfig.chart.type in {line: 1, area: 1}) ? 'on' : 'between',
                    labels: {
                        align: 'left',
                        x: (this.hcConfig.chart.type in {line: 1, area: 1}) ? 5 : -pixelsPerCategory / 2 + 5
                    },
                    min: null,
                    max: null
                }
            });
        }
        else {
            // axisType is assumed to be "numeric"
            $.extend(true, this.hcConfig, {
                xAxis: {
                    tickPixelInterval: tickPixelInterval,
                    labels: {
                        formatter: function() {
                            var label = resolveLabel(this);
                            if(this.isLast && !self.labelFitsAxis(label, this.value, "horizontal")) {
                                return "";
                            }
                            return label;
                        }
                    }
                }
            });
        }
    },

    getXLabelResolver: function(type, min, max, tickPixelInterval) {
        if(type == "time") {
            return this.getDateTimeLabelResolver(tickPixelInterval);
        }
        if(type == "numeric") {
            return this.getNumericLabelResolver(min, max);
        }
        // type is "category"
        return function(element) {
            return element.value;
        };
    },

    formatYAxis: function(properties, data) {
        var self = this,
            min = this.hcConfig.yAxis.min || data.yMin,
            max = this.hcConfig.yAxis.max || data.yMax,
            // TODO: this should probably depend on the height of the chart
            tickPixelInterval = (this.logYAxis) ? undefined : 50,
            resolveLabel = (this.logYAxis) ? this.getLogLabelResolver(min, max) :
                                 this.getNumericLabelResolver(min, max);
            
        $.extend(true, this.hcConfig, {
            yAxis: {
                tickPixelInterval: tickPixelInterval,
                tickInterval: (this.logYAxis && (max - min) > 1) ? 1 : undefined,
                labels: {
                    formatter: function() {
                        var label = resolveLabel(this);
                        if(this.isFirst && !self.labelFitsAxis(label, this.value, "vertical")) {
                            return "";
                        }
                        return label;
                    }
                }
            }
        });
    },

    getNumericLabelResolver: function(min, max) {
        var range = max - min,
            maxPrecision = this.axisRangeToPrecision(range);

        return function(element) {
            var i, adjustedValue,
                value = element.value;

            for(i = 0; i < maxPrecision; i++) {
                adjustedValue = value * Math.pow(10, i);
                if(adjustedValue == Math.floor(adjustedValue)) {
                    return Highcharts.numberFormat(value, i);
                }
            }
            return Highcharts.numberFormat(value, maxPrecision);
        }
    },

    getDateTimeLabelResolver: function(tickPixelInterval) {
        var timeString,
            yearsSeen = {},
            datesSeen = {},
            millisPerMinute = 60 * 1000,
            millisPerDay = 24 * 60 * millisPerMinute,
            // HighCharts will massage the actual tickPixelInterval to make nice round
            // numbers for labels, so we err on the side of not hiding the time value
            // when it might be relevant
            safetyFactor = 1.5,
            chartWidth = $(this.renderTo).width(),
            range = this.processedData.xMax - this.processedData.xMin,
            millisPerTick = (range / chartWidth) * tickPixelInterval,
            showTimes = (millisPerTick < millisPerDay * safetyFactor),
            showSeconds = (millisPerTick < millisPerMinute);

        return function(element) {
            var value = element.value,
                year = Highcharts.dateFormat("%Y", value),
                date = Highcharts.dateFormat("%b %e", value);
            if(element.isFirst) {
                yearsSeen = {};
                datesSeen = {};
            }
            if(!yearsSeen[year]) {
                yearsSeen[year] = true;
                datesSeen[date] = true;
                if(showTimes) {
                    timeString = (showSeconds) ? "%l:%M:%S %p" : "%l:%M %p";
                    return Highcharts.dateFormat(timeString + " <br/> %a %b %e <br/> %Y", value);
                }
                return Highcharts.dateFormat("%a %b %e <br/> %Y", value);
            }
            if(!datesSeen[date]) {
                datesSeen[date] = true;
                if(showTimes) {
                    timeString = (showSeconds) ? "%l:%M:%S %p" : "%l:%M %p";
                    return Highcharts.dateFormat(timeString + " <br/> %a %b %e", value);
                }
                return Highcharts.dateFormat("%a %b %e", value);
            }
            return (showSeconds) ? Highcharts.dateFormat("%l:%M:%S %p", value) :
                                   Highcharts.dateFormat("%l:%M %p", value);
        }
    },

    getLogLabelResolver: function(min, max) {
        if((max - min) > 1) {
            return function(element) {
                var pow10 = Splunk.HCBridge.Utils.absPowerTen;
                return Highcharts.numberFormat(Math.round(pow10(element.value)), 0);
            }
        }
        var maxPrecision = 3;
        return function(element) {
            var i, adjustedValue,
                value = element.value,
                pow10 = Splunk.HCBridge.Utils.absPowerTen,
                labelValue = pow10(value);

            if(value == Math.floor(value)) {
                // a perfect power of ten
                return Highcharts.numberFormat(Math.round(labelValue), 0);
            }
            else {
                labelValue = Math.round(labelValue * 1000) / 1000;
                for(i = 0; i < maxPrecision; i++) {
                    adjustedValue = labelValue * Math.pow(10, i);
                    if(adjustedValue == Math.floor(adjustedValue)) {
                        return Highcharts.numberFormat(labelValue, i);
                    }
                }
                return Highcharts.numberFormat(labelValue, maxPrecision);
            }
        }
    },

    axisRangeToPrecision: function(range) {
        var rangeLog = Splunk.HCBridge.Utils.logBaseTen(range);
        if(rangeLog >= 1) {
            return 0;
        }
        return (-1 * Math.floor(rangeLog) + 1);
    },

    labelFitsAxis: function(label, value, orientation) {
        var axisMin, axisMax, axisLength;
        if(orientation == 'vertical') {
            axisMin = this.hcConfig.yAxis.min || this.processedData.yMin;
            axisMax = this.hcConfig.yAxis.max || this.processedData.yMax;
            axisLength = this.chartHeight;
            return this.labelFitsVertically(label, value, axisMin, axisMax, axisLength);
        }
        else if(orientation == 'horizontal') {
            axisMin = this.hcConfig.xAxis.min || this.processedData.xMin;
            axisMax = this.hcConfig.xAxis.max || this.processedData.xMax;
            axisLength = $(this.renderTo).width();
            return this.labelFitsHorizontally(label, value, axisMin, axisMax, axisLength);
        }
    },

    labelFitsVertically: function(label, value, min, max, length) {
        // TODO: this is a punt, need a more robust way to determine if
        // the label will fit on the axis
        var range = max - min,
            labelLineHeight = 14,
            spaceBelowTick = (length / range) * (value - min),
            numLines = label.split('<br/>').length;
        return (spaceBelowTick >= labelLineHeight * numLines);
    },

    labelFitsHorizontally: function(label, value, min, max, length) {
        // TODO: this is a punt, need a more robust way to determine if
        // the label will fit on the axis
        var i, loopWidth,
            labelWidth = 0,
            range = max - min,
            labelParts = label.split('<br/>'),
            spaceAfterTick = (length / range) * (max - value),
            safetyFactor = 10,
            fontSize = 11;

        for(i = 0; i < labelParts.length; i++) {
            loopWidth = this.predictTextWidth(label, fontSize);
            labelWidth = Math.max(loopWidth, labelWidth);
        }
        return (spaceAfterTick + safetyFactor >= labelWidth);
    },

    categoryLabelsWillOverlap: function(categories) {
        var i, loopWidth,
            axisLength = $(this.renderTo).width(),
            pixelsPerCategory = axisLength / categories.length,
            fontSize = 11;

        for(i = 0; i < categories.length; i++) {
            loopWidth = this.predictTextWidth(categories[i], fontSize);
            if(loopWidth > pixelsPerCategory) {
                return true;
            }
        }
        return false;
    },

    ellipsizeCategoriesIfNeeded: function(maxWidth) {
        var i, loopWidth,
            categories = this.processedData.categories,
            fontSize = 11;

        for(i = 0; i < categories.length; i++) {
            loopWidth = this.predictTextWidth(categories[i], fontSize);
            if(loopWidth > maxWidth) {
                categories[i] = this.middleEllipsize(categories[i], maxWidth, fontSize);
            }
        }
    },
    
    startEllipsize: function(text, width, fontSize) {
        var i = 1;
        while (i < text.length) {
            var postText = text.substr(i);
            var text = "..." + postText;
           
            if (this.predictTextWidth(text, fontSize) < width) {
                return text;
            }
            i++;
        }

        return "...";
    },

    middleEllipsize: function(text, width, fontSize) {
	    var i = 1;
	    while (i < text.length) {
	        var preText = text.substr(0, Math.round((text.length-i)/2));
	        var postText = text.substr(Math.round((text.length+i)/2));
	        var text = preText + "..." + postText;
	       
    		if (this.predictTextWidth(text, fontSize) < width) {
    		    return text;
    		}
    		i++;
	    }

	    return "...";
    },
    
    endEllipsize: function(text, width, fontSize) {
        var i = 1;
        while (i < text.length) {
            var preText = text.substr(0, text.length - i);
            var text = preText + "...";
           
            if (this.predictTextWidth(text, fontSize) < width) {
                return text;
            }
            i++;
        }

        return "...";
    },

    trimToWidth: function(text, width, fontSize, direction) {
        if(this.predictTextWidth(text, fontSize) <= width) {
            return text;
        }
        var index = Math.floor(text.length / 2),
            countBackward = (direction == 'fromEnd'),
            substring = (countBackward) ? text.substr(index) : text.substr(0, index);

        if(this.predictTextWidth(substring, fontSize) <= width) {
            while(this.predictTextWidth(substring, fontSize) <= width) {
                index = (countBackward) ? index - 1 : index + 1;
                substring = (countBackward) ? text.substr(index) : text.substr(0, index);
            }
            return text.substring(0, index - 1);
        }
        while(this.predictTextWidth(substring, fontSize) > width) {
            index = (countBackward) ? index + 1 : index - 1;
            substring = (countBackward) ? text.substr(index) : text.substr(0, index);
        }
        return substring;
    },

    predictTextWidth: function(text, fontSize) {
        var $testDiv = this.getTestDiv();
        $testDiv.css({
            'font-size': fontSize + 'px'
        });
        return $testDiv.html(text).width();
    },

    // use a singleton test div to predict sizes of text labels
    getTestDiv: function() {
        if(this.$testDiv) {
            this.$testDiv.empty();
        }
        else {
            this.$testDiv = $('<div></div>').css({
                position : 'absolute',
                'font-family': '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif',
                top: -999,
                left: -999
            })
            .appendTo('body');
        }
        return this.$testDiv;
    },

    ////////////////////////////////////////////////////////////////////////////
    // helper methods for attaching event handlers

    addClickHandlers: function(data) {
        if(this.enableChartClick) {
            var self = this;

            $.extend(true, this.hcConfig, {
                plotOptions: {
                    series: {
                        point: {
                            events: {
                                click: function() {
                                    self.onPointClick.call(self, this);
                                }
                            }
                        }
                    }
                }
            });
        }
    },

    addHoverHandlers: function() {
        var self = this;
        $.extend(true, this.hcConfig, {
            plotOptions: {
                series: {
                    point: {
                        events: {
                            mouseOver: function() {
                                self.onPointMouseOver.call(self, this);
                            },
                            mouseOut: function() {
                                self.onPointMouseOut.call(self, this);
                            }
                        }
                    }
                }
            }
        });
    },

    onPointClick: function(point) {
        var xAxisKey = this.processedData.xAxisKey,
            xAxisType = this.processedData.xAxisType,
            event = {
                fields: [xAxisKey, point.series.name],
                data: {}
            }
        // TODO: does this break with log scale?
        event.data[point.series.name] = point.y;
        if(xAxisType == "time") {
            event.data._span = point._span;
            event.data[xAxisKey] = Splunk.util.getEpochTimeFromISO(point.name);
        }
        else {
            event.data[xAxisKey] = (xAxisType == 'category') ? point.name : point.x;
        }
        this.dispatchEvent('chartClicked', event);
    },

    onPointMouseOver: function(point) {
        // to be implemented by subclasses
    },

    onPointMouseOut: function(point) {
        // to be implemented by subclasses
    },

    addLegendHandlers: function(properties) {
        var self = this;
        if(this.enableLegendClick) {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    series: {
                        events: {
                            legendItemClick: function() {
                                return self.onLegendClick.call(self, this);
                            }
                        }
                    }
                },
                legend: {
                    itemStyle: {
                        cursor: 'pointer'
                    },
                    itemHoverStyle: {
                        cursor: 'pointer'
                    }
                }
            });
        }
    },

    onLegendClick: function(series) {
        var event = {
            text: series.name
        };
        this.dispatchEvent('legendClicked', event);
        return false;
    },

    onLoadOrRedraw: function(chart, flag) {
        if(this.hcConfig.legend.enabled) {
            this.addLegendHoverEffects(chart);
        }
        this.addTestingMetadata(chart);
        if(flag == 'load') {
            this.onLoad(chart);
        }
        else if(flag == 'redraw') {
            this.onRedraw(chart);
        }
    },

    onLoad: function(chart) {
        // to be implemented by subclasses if needed
    },

    onRedraw: function(chart) {
        // to be implemented by subclasses if needed
    },

    addLegendHoverEffects: function(chart) {
        var self = this;
        $(chart.series).each(function(i, loopSeries) {
            $(self.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                $(element).hover(
                    function() {
                        self.onLegendMouseOver(loopSeries);
                    },
                    function() {
                        self.onLegendMouseOut(loopSeries);
                    }
                )
            });
        });
    },

    onLegendMouseOver: function(series) {
        this.highlightSeries(series);
    },

    onLegendMouseOut: function(series) {
        this.unHighlightSeries(series);
    },

    getSeriesLegendElements: function(series) {
        var elements = [];
        if(series.legendItem) {
            elements.push(series.legendItem.element);
        }
        if(series.legendSymbol) {
            elements.push(series.legendSymbol.element);
        }
        if(series.legendLine) {
            elements.push(series.legendLine.element);
        }
        return elements;
    },

    highlightSeries: function(theSeries) {
        var chart = theSeries.chart;
        $(chart.series).each(function(i, loopSeries) {
            if(i != theSeries.index) {
                loopSeries.group.element.style.opacity = 0.25;
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 0.25;
                });
            }
        }.bind(this));
    },

    unHighlightSeries: function(theSeries) {
        var chart = theSeries.chart;
        $(chart.series).each(function(i, loopSeries) {
            if(i != theSeries.index) {
                loopSeries.group.element.style.opacity = 1;
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 1;
                });
            }
        }.bind(this));
    },

    ////////////////////////////////////////////////////////////////////////////
    // helper methods for processing data

    extractProcessedData: function(rawData, properties) {
        if(!rawData) {
            this.chartIsEmpty = true;
            return;
        }
        var i, j,
            fieldInfo, fieldNames, xAxisKey,
            xAxisSeriesIndex, xSeries, _spanSeries,
            xAxisType, categories,
            loopSeries, loopYVal, loopXVal, loopDataPoint,
            yMin = Infinity,
            yMax = -Infinity,
            xMin = Infinity,
            xMax = -Infinity,
            series = {};

        // extract the field names and x-axis info

        fieldInfo = Splunk.HCBridge.Utils.extractFieldInfo(rawData);
        fieldNames = fieldInfo.fieldNames;
        if(fieldNames.length == 0) {
            this.chartIsEmpty = true;
            return;
        }
        xAxisKey = fieldInfo.xAxisKey;
        xAxisSeriesIndex = fieldInfo.xAxisSeriesIndex;
        xSeries = rawData.series[xAxisSeriesIndex];

        if(xAxisKey == "_time") {
            xAxisType = "time";
            for(i = 0; i < rawData.series.length; i++) {
                if(rawData.series[i].field == '_span') {
                    _spanSeries = rawData.series[i].data;
                    break;
                }
            }
        }
        else {
            for(i = 0; i < xSeries.data.length; i++) {
                if(isNaN(parseFloat(xSeries.data[i]))) {
                    xAxisType = "category";
                    break;
                }
            }
            if(!xAxisType) {
                xAxisType = "numeric";
            }
        }
        if(xAxisType == "category") {
            categories = [];
            for(i = 0; i < xSeries.data.length; i++) {
                categories.push(xSeries.data[i]);
            }
        }
        else if(xAxisType == "time") {
            categories = this.convertTimeToCategories(xSeries.data, _spanSeries);
        }
        else {
            for(i = 0; i < xSeries.data.length; i++) {
                xMax = Math.max(xMax, xSeries.data[i]);
                xMin = Math.min(xMin, xSeries.data[i]);
            }
        }
        // extract the data
        for(i = 0; i < rawData.series.length; i++) {
            loopSeries = rawData.series[i];
            series[loopSeries.field] = [];
            for(j = 0; j < loopSeries.data.length; j++) {
                loopYVal = parseFloat(loopSeries.data[j], 10);

                if(isNaN(loopYVal)) {
                    // handle null values here
                    if(properties['chart.nullValueMode'] in {gaps: 1, connect: 1}) {
                        loopYVal = null;
                        // the distinction between gaps and connect is handled by
                        // the mapNullValueMode method
                    }
                    else{
                         // assumes chart.nullValueMode is zero
                         loopYVal = 0;
                    }
                }
                
                yMax = Math.max(yMax, loopYVal);
                yMin = Math.min(yMin, loopYVal);
                loopDataPoint = {
                    name: xSeries.data[j],
                    y: loopYVal,
                    rawY: loopYVal
                }
                if(xAxisType in {numeric: 1}) {
                    loopXVal = parseFloat(xSeries.data[j], 10);
                    loopDataPoint.x = loopXVal;
                }
                else if(xAxisType in {time: 1} && _spanSeries) {
                    loopDataPoint._span = _spanSeries[j];
                }
                if(this.logYAxis && loopDataPoint.y != null) {
                    loopDataPoint.y = Splunk.HCBridge.Utils.absLogBaseTen(loopDataPoint.y);
                }
                series[loopSeries.field].push(loopDataPoint);
            }
            if(this.logYAxis) {
                yMin = Splunk.HCBridge.Utils.absLogBaseTen(yMin);
                yMax = Splunk.HCBridge.Utils.absLogBaseTen(yMax);
            }
        }
        this.processedData = {
            series: series,
            fieldNames: fieldNames,
            xAxisKey: xAxisKey,
            xAxisType: xAxisType,
            xMin: xMin,
            xMax: xMax,
            yMin: yMin,
            yMax: yMax,
            categories: categories
        };
    },

    convertTimeToCategories: function(timeData, spanData) {
        var i, j, formatter, bdTime, label, monthIntervals,
            prevBdTime = [0, 0, 0, 0, 0, 0],
            numLabelCutoff = 6,

            secsPerMin = 60,
            secsPerHour = 60 * secsPerMin,
            secsPerDay = 24 * secsPerHour,

            bdYear = 1,
            bdMonth = 2,
            bdDay = 3,
            bdHour = 4,
            bdMinute = 5,
            bdSecond = 6,

            pointSpan = spanData ? spanData[0] : 1,
            timeRange = pointSpan * timeData.length,
            categories = [],

            extractBdTime = function(timeString) {
                // assume time comes in ISO format
                return (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d+[+-]{1}\d{2}:\d{2}$/.exec(timeString));
            },
            getFormatterFromSeconds = function(intervals, multiplier, bdIndex) {
                var testInterval;
                for(i = 0; i < intervals.length - 1; i++) {
                    testInterval = intervals[i + 1] * multiplier;
                    if(!((timeRange / testInterval) < numLabelCutoff)) {
                        break;
                    }
                }
                // i is now equal to the index in intervals that we want for our step,
                // use it as a mod value to find the first label
                for(j = 0; j < timeData.length; j++) {
                    if(parseInt((extractBdTime(timeData[j]))[bdIndex], 10) % intervals[i] === 0) {
                        return { start: j, step: (intervals[i] * multiplier) / pointSpan };
                    }
                }
                // if we end up here, something went wrong, but we should return something reasonable
                return { start: 0, step: (intervals[i] * multiplier) / pointSpan };
            },
            getFormatterFromSpans = function(intervals, bdIndex) {
                var testInterval, testIndex;
                for(i = 0; i < intervals.length - 1; i++) {
                    testInterval = intervals[i + 1];
                    if(!((timeData.length / testInterval) < numLabelCutoff)) {
                        break;
                    }
                }
                // i is now equal to the index in intervals that we want for our step,
                // if we need to we clip the first label to the first of the month/year
                if(bdIndex === bdDay) {
                    return { start: 0, step: intervals[i] };
                }
                else {
                    testIndex = ((pointSpan * intervals[i]) < 12) ? bdDay : bdMonth;
                    for(j = 0; j < timeData.length; j++) {
                        if((extractBdTime(timeData[j]))[testIndex] === "01") {
                            return { start: j, step: intervals[i] };
                        }
                    }
                }
                // if we end up here, something went wrong, but we should return something reasonable
                return { start: 0, step: (intervals[i]) / pointSpan };
            };

        if(pointSpan < secsPerMin && timeRange < secsPerMin * numLabelCutoff) {
            // we are in the second domain
            var secIntervals = [60, 30, 15, 10, 5, 2, 1];
            formatter = getFormatterFromSeconds(secIntervals, 1, bdSecond);
        }
        else if(pointSpan < secsPerHour && timeRange < secsPerHour * numLabelCutoff) {
            // we are in the minute domain
            var minIntervals = [60, 30, 15, 10, 5, 2, 1];
            formatter = getFormatterFromSeconds(minIntervals, secsPerMin, bdMinute);
        }
        else if(pointSpan < 23 * secsPerHour && timeRange < secsPerDay * numLabelCutoff) {
            // we are in the hour domain
            var hourIntervals = [24, 12, 8, 6, 4, 2, 1];
            formatter = getFormatterFromSeconds(hourIntervals, secsPerHour, bdHour);
        }
        else if(pointSpan < 27 * secsPerDay) {
            // we are in the day domain
            var dayIntervals = [14, 7, 4, 2, 1];
            // work-around here for when the user has specified a small span for a large time range
            if(pointSpan < 23 * secsPerHour) {
                if(timeRange < 14 * secsPerDay * numLabelCutoff) {
                    return this.formatCategoriesByFiltering(dayIntervals, secsPerDay, bdDay, timeRange, timeData, extractBdTime);               
                }
                else {
                    monthIntervals = [240, 120, 96, 72, 48, 24, 12, 6, 4, 2, 1];
                    return this.formatCategoriesByFiltering(monthIntervals, 30 * secsPerDay, bdMonth, timeRange, timeData, extractBdTime);   
                }
            }
            formatter = getFormatterFromSpans(dayIntervals, bdDay);
        }
        else {
            // we are in the month domain
            monthIntervals = [240, 120, 96, 72, 48, 24, 12, 6, 4, 2, 1];
            formatter = getFormatterFromSpans(monthIntervals, bdMonth);
        }
        
        for(i = 0; i < timeData.length; i++) {
            if(i >= formatter.start && (i - formatter.start) % formatter.step == 0) {
                bdTime = extractBdTime(timeData[i]);
                label = this.formatBdTimeAsLabel(bdTime, formatter.step * pointSpan, prevBdTime);
                categories.push(label);
                prevBdTime = bdTime;
            }
            else {
                categories.push(" ");
            }
        }
        return categories;
    },
    
    formatCategoriesByFiltering: function(intervals, multiplier, bdTestIndex, timeRange, timeData, extractor) {
        var i, j, k, testInterval, loopBdTime, 
            prevBdValue = -1,
            numLabelCutoff = 6,
            prevBdTime = [0, 0, 0, 0, 0, 0],
            counter = -1, 
            categories = [];
        for(i = 0; i < intervals.length - 1; i++) {
            testInterval = intervals[i + 1] * multiplier;
            if(!((timeRange / testInterval) < numLabelCutoff)) {
                break;
            }
        }
        // i is now equal to the index in intervals that we want for our step
        var filterFn = function(bdTime) {
            for(k = bdTestIndex + 1; k < bdTime.length; k++) {
                if(k === 3) {
                    if(bdTime[k] !== "01") {
                        return false;
                    }
                }
                else if(parseInt(bdTime[k], 10)) {
                    return false;
                }
            }
            return true;
        };
        for(j = 0; j < timeData.length; j++) {
            loopBdTime = extractor(timeData[j]);
            
            if(filterFn(loopBdTime)) {
                if(loopBdTime[bdTestIndex] !== prevBdValue) {
                    if(counter > -1) {
                        counter++
                    }
                    prevBdValue = loopBdTime[bdTestIndex];
                }
                if(counter === -1 || counter % intervals[i] === 0) {
                    label = this.formatBdTimeAsLabel(loopBdTime, multiplier * intervals[i], prevBdTime);
                    categories.push(label);
                    prevBdTime = loopBdTime;
                    counter = 0;
                }
                else {
                    categories.push(' ');
                }
            }
            else {
                categories.push(" ");
            }
        }
        return categories;
    },

    formatBdTimeAsLabel: function(bdTime, labelSpan, prevBdTime) {
        var secsPerMin = 60,
            secsPerHour = 60 * secsPerMin,
            secsPerDay = 24 * secsPerHour,

            bdYear = 1,
            bdMonth = 2,
            bdDay = 3,
            bdHour = 4,
            bdMinute = 5,
            bdSecond = 6,
            
            year = parseInt(bdTime[bdYear], 10),
            month = parseInt(bdTime[bdMonth], 10) - 1,
            day = parseInt(bdTime[bdDay], 10),
            hour = parseInt(bdTime[bdHour], 10),
            minute = parseInt(bdTime[bdMinute], 10),
            second = parseInt(bdTime[bdSecond], 10),
            dateTime = new Date(year, month, day, hour, minute, second),

            showDay = (labelSpan < 28 * secsPerDay),
            showTimes = (labelSpan < (23 * secsPerHour)),
            showSeconds = (labelSpan < 60),

            timeFormat = (showSeconds) ? 'medium' : 'short',
            dateFormat = (showDay) ? 'ccc MMM d' : 'MMMM';

        if(labelSpan > 364 * secsPerDay) {
            return format_date(dateTime, 'YYYY');
        }
        if(bdTime[bdMonth] === prevBdTime[bdMonth] && bdTime[bdDay] === prevBdTime[bdDay]) {
            return format_time(dateTime, timeFormat);
        }
        if(bdTime[bdYear] !== prevBdTime[bdYear]) {
            dateFormat += '<br/>YYYY';
        }
        return (showTimes) ?
            format_time(dateTime, timeFormat) + '<br/>' + format_date(dateTime, dateFormat) :
            format_date(dateTime, dateFormat);
    },

    addDataToConfig: function() {
        var i, seriesObject,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series;
        
        if(!this.hcConfig.xAxis.title.text) {
            this.hcConfig.xAxis.title.text = this.processedData.xAxisKey;
        }
        if(!this.hcConfig.yAxis.title.text && fieldNames.length === 1) {
            this.hcConfig.yAxis.title.text = fieldNames[0];
        }

        if(fieldNames.length > 4 && series[fieldNames[0]].length > 500) {
            this.tooMuchData = true;
            return;
            //this.hcConfig.plotOptions.series.enableMouseTracking = false;
        }
        for(i = 0; i < fieldNames.length; i++) {
            seriesObject = this.constructSeriesObject(fieldNames[i],
                                series[fieldNames[i]], this.properties);
            if(seriesObject) {
                this.hcConfig.series.push(seriesObject);
            }
        }
    },

    // returns false if series should not be added to the chart
    constructSeriesObject: function(name, data, properties) {
        // first respect the field hide list that came from the parent module
        if(properties.fieldHideList && properties.fieldHideList.indexOf(name) > -1) {
            return false;
        }
        //alert(JSON.stringify({show: this.fieldShowList, hide: this.fieldHideList}));
        // next process the field visibility lists from the xml
        if(this.fieldListMode === 'show_hide') {
            if($.inArray(name, this.fieldHideList) > -1 && $.inArray(name, this.fieldShowList) < 0) {
                return false;
            }
        }
        else { 
            // assumes 'hide_show' mode
            if($.inArray(name, this.fieldHideList) > -1) {
                return false;
            }
        }
        return {
            name: name,
            data: data
        };
    },

    ////////////////////////////////////////////////////////////////////////////
    // methods for adding testing metadata

    addTestingMetadata: function(chart) {
        var tooltipRefresh = chart.tooltip.refresh,
            decorateTooltip = (this.processedData.xAxisType === 'time') ? 
                    this.addTimeTooltipClasses.bind(this) : this.addTooltipClasses.bind(this);
        this.addDataClasses();
        this.addAxisClasses(chart);
        if(chart.options.legend.enabled) {
            this.addLegendClasses(chart);
        }
        chart.tooltip.refresh = function(point) {
            tooltipRefresh(point);
            decorateTooltip(chart);
        }.bind(this);
    },

    addDataClasses: function() {
        var dataElements;

        $('.highcharts-series', $(this.renderTo)).each(function(i, series) {
            if(this.hasSVG) {
                dataElements = $('rect, path', $(series));
            }
            else {
                dataElements = $('shape', $(series));
            }
            dataElements.each(function(j, elem) {
                this.addClassToElement(elem, 'spl-display-object');
            }.bind(this))
        }.bind(this));
    },

    addAxisClasses: function(chart) {
        var i, labelElements;

        $('.highcharts-axis', $(this.renderTo)).each(function(i, elem) {
            if(this.hasSVG) {
                var loopBBox = elem.getBBox();
                if(loopBBox.width > loopBBox.height) {
                    this.addClassToElement(elem, 'horizontal-axis');
                }
                else {
                    this.addClassToElement(elem, 'vertical-axis');
                }
                labelElements = $('tspan', $(elem));
            }
            else {
                var firstSpan, secondSpan,
                    $spans = $('span', $(elem));
                if($spans.length < 2) {
                    return;
                }
                firstSpan = $spans[0];
                secondSpan = $spans[1];
                if(firstSpan.style.top == secondSpan.style.top) {
                    this.addClassToElement(elem, 'horizontal-axis');
                }
                else if(firstSpan.style.left == secondSpan.style.left) {
                    this.addClassToElement(elem, 'vertical-axis');
                }
                labelElements = $('span', $(elem));
            }
            labelElements.each(function(j, label) {
                this.addClassToElement(label, 'spl-text-label');
            }.bind(this))
        }.bind(this));

        for(i = 0; i < chart.xAxis.length; i++) {
            if(chart.xAxis[i].axisTitle) {
                this.addClassToElement(chart.xAxis[i].axisTitle.element, 'x-axis-title');
            }
        }
        for(i = 0; i < chart.yAxis.length; i++) {
            if(chart.yAxis[i].axisTitle) {
                this.addClassToElement(chart.yAxis[i].axisTitle.element, 'y-axis-title');
            }
        }
    },

    addTooltipClasses: function(chart) {
        var i, loopSplit, loopKeyName, loopKeyElem, loopValElem,
            $tooltip = $('.highcharts-tooltip', $(this.renderTo)),
            tooltipElements = (this.hasSVG) ? $('tspan', $tooltip) : 
                                              $('span > span', $tooltip);

        for(i = 0; i < tooltipElements.length; i += 2) {
            loopKeyElem =tooltipElements[i];
            if(tooltipElements.length < i + 2) {
                break;
            }
            loopValElem = tooltipElements[i + 1];
            loopSplit = (this.hasSVG) ? loopKeyElem.textContent.split(':') :
                                        $(loopKeyElem).html().split(':');
            loopKeyName = loopSplit[0];
            this.addClassToElement(loopKeyElem, 'key');
            this.addClassToElement(loopKeyElem, loopKeyName + '-key');
            this.addClassToElement(loopValElem, 'value');
            this.addClassToElement(loopValElem, loopKeyName + '-value');
        }
    },
    
    addTimeTooltipClasses: function(chart) {
        var i, loopSplit, loopKeyName, loopKeyElem, loopValElem,
        $tooltip = $('.highcharts-tooltip', $(this.renderTo)),
        tooltipElements = (this.hasSVG) ? $('tspan', $tooltip) : 
                                          $('span > span', $tooltip);
        
        this.addClassToElement(tooltipElements[0], 'time-value');
        this.addClassToElement(tooltipElements[0], 'value');

        for(i = 1; i < tooltipElements.length; i += 2) {
            loopKeyElem =tooltipElements[i];
            if(tooltipElements.length < i + 2) {
                break;
            }
            loopValElem = tooltipElements[i + 1];
            loopSplit = (this.hasSVG) ? loopKeyElem.textContent.split(':') :
                                        $(loopKeyElem).html().split(':');
            loopKeyName = loopSplit[0];
            this.addClassToElement(loopKeyElem, 'key');
            this.addClassToElement(loopKeyElem, loopKeyName + '-key');
            this.addClassToElement(loopValElem, 'value');
            this.addClassToElement(loopValElem, loopKeyName + '-value');
        }
    },

    addLegendClasses: function(chart) {
        var loopSeriesName;
        $(chart.series).each(function(i, series) {
            loopSeriesName = (this.hasSVG) ? series.legendItem.textStr : 
                                             $(series.legendItem.element).html();
            if(series.legendSymbol) {
                this.addClassToElement(series.legendSymbol.element, 'symbol');
                this.addClassToElement(series.legendSymbol.element, loopSeriesName + '-symbol');
            }
            if(series.legendLine) {
                this.addClassToElement(series.legendLine.element, 'symbol');
                this.addClassToElement(series.legendLine.element, loopSeriesName + '-symbol');
            }
        }.bind(this));
    },

    addClassToElement: function(elem, className) {
        // TODO: instead of a try-catch this should be a regex filter to prevent invalid characters
        try {
            if(this.hasSVG) {
                if(elem.classList) {
                    elem.classList.add(className);
                }
                else {
                    elem.className.baseVal += (" " + className);
                }
            }
            else {
                $(elem).addClass(className);
            }
        }
        catch(e) {
            
        }
    }

});

Splunk.HCBridge.DEFAULT_HC_CONFIG = {
    chart: {
        animation: false,
        showAxes: true,
        reflow: true
    },
    global: {
        useUTC: true
    },
    plotOptions: {
        series: {
            animation: false,
            stickyTracking: false,
            events: {
                legendItemClick: function() {
                    return false;
                }
            },
            marker: {
                symbol: 'square'
            },
            borderWidth: 0
        }
    },
    series: [],
    title: {
        text: null
    },
    legend: {
        align: 'right',
        verticalAlign: 'middle',
        borderWidth: 0,
        layout: 'vertical',
        enabled: true,
        itemStyle: {
            color: '#000000',
            cursor: 'auto'
        },
        itemHoverStyle: {
            cursor: 'auto'
        }
    },
    tooltip: {
        backgroundColor: '#000000',
        borderColor: '#000000'
    },
    xAxis: {
        lineColor: '#cccccc',
        tickLength: 25,
        minorTickLength: 10,
        tickColor: '#e6e6e6',
        minorTickColor: '#e6e6e6',
        tickPlacement: 'between',
        minorGridLineWidth: 0,
        x: 0,
        labels: {
            style: {
                color: '#000000'
            },
            align: 'left',
            x: 5
        },
        margin: 25,
        title: {
            text: '',
            style: {
                color: 'black'
            }
        }
    },
    yAxis: {
        title: {
            style: {
                color: 'black'
            },
            text: ''
        },
        tickWidth: 1,
        tickLength: 25,
        minorTickLength: 10,
        minorTickColor: '#e6e6e6',
        tickColor: '#e6e6e6',
        showFirstLabel: false,
        lineWidth: 1,
        lineColor: '#cccccc',
        gridLineColor: '#e6e6e6',
        minorGridLineWidth: 0,
        maxPadding: 0.02,
        labels: {
            style: {
                color: '#000000'
            },
            y: 15
        }
    },
    credits: {
        enabled: false
    }
};


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.SeriesBasedChart


Splunk.HCBridge.SeriesBasedChart = $.klass(Splunk.HCBridge.AbstractChart, {

    // override
    onPointMouseOver: function(point) {
        this.highlightSeries(point.series);
    },

    // override
    onPointMouseOut: function(point) {
        this.unHighlightSeries(point.series);
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.PointBasedChart


Splunk.HCBridge.PointBasedChart = $.klass(Splunk.HCBridge.AbstractChart, {

    // override
    onPointMouseOver: function(point) {
        this.highlightPoint(point);
    },

    // override
    onPointMouseOut: function(point) {
        this.unHighlightPoint(point);
    },

    highlightPoint: function(point) {
        var theSeries = point.series,
            chart = theSeries.chart,
            selector = '#' + this.hcObjectId + ' g.highcharts-series *',
            rule = 'opacity: 0.25;';

        Splunk.HCBridge.Utils.addCssRule(selector, rule);
        point.graphic.element.style.opacity = 1;

        $(chart.series).each(function(i, loopSeries) {
            if(i != theSeries.index) {
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 0.25;
                });
            }
        }.bind(this));
    },

    unHighlightPoint: function(point) {
        var theSeries = point.series,
            chart = theSeries.chart;

        Splunk.HCBridge.Utils.removeAllCssRules();
        point.graphic.element.style.opacity = '';

        $(chart.series).each(function(i, loopSeries) {
            if(i != theSeries.index) {
                $(this.getSeriesLegendElements(loopSeries)).each(function(j, element) {
                    element.style.opacity = 1;
                });
            }
        }.bind(this));
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.LineChart


Splunk.HCBridge.LineChart = $.klass(Splunk.HCBridge.SeriesBasedChart, {

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'line',
                className: 'line-chart'
            },
            plotOptions: {
                line: {
                    marker: {
                        enabled: false,
                        states: {
                            hover: {
                                enabled: true,
                                symbol: 'square',
                                radius: 5
                            }
                        }
                    }
                }
            }
        });
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AreaChart


Splunk.HCBridge.AreaChart = $.klass(Splunk.HCBridge.SeriesBasedChart, {

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'area',
                className: 'area-chart'
            },
            plotOptions: {
                area: {
                    marker: {
                        enabled: false
                    },
                    lineWidth: 1
                }
            }
        });
    },
    
    // override
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        switch(key) {
            
            case 'chart.showLines':
                this.mapShowLines(value);
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        
        }
    },
    
    mapShowLines: function(value) {
        $.extend(true, this.hcConfig, {
            plotOptions: {
                area: {
                    lineWidth: (value === 'false') ? 0 : 1
                }
            }
        });
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.ColumnChart


Splunk.HCBridge.ColumnChart = $.klass(Splunk.HCBridge.PointBasedChart, {

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'column',
                className: 'column-chart'
            },
            plotOptions: {
                column: {
                    pointPadding: 0,
                    groupPadding: 0.05,
                    minPointLength: 0.5,
                    shadow: false
                }
            }
        });
    },
    
    // override
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        
        switch(key) {
        
            case 'chart.columnSpacing':
                this.mapColumnSpacing(value);
                break;
            case 'chart.seriesSpacing':
                this.mapSeriesSpacing(value);
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        
        }
    },
    
    mapColumnSpacing: function(valueStr) {
        var value = parseFloat(valueStr, 10);
        if(!isNaN(value)) {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    column: {
                        groupPadding: (value < 3) ? 0.05 + ((value - 1) / 5) : 0.05 + ((value - 1) / 15)
                    }
                }
            });
        }
    },
    
    mapSeriesSpacing: function(valueStr) {
        var value = parseFloat(valueStr, 10);
        if(!isNaN(value)) {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    column: {
                        pointPadding: 0.2 * Math.pow(value, 0.25)
                    }
                }
            });
        }
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.BarChart


Splunk.HCBridge.BarChart = $.klass(Splunk.HCBridge.PointBasedChart, {

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'bar',
                className: 'bar-chart'
            },
            plotOptions: {
                bar: {
                    pointPadding: 0,
                    groupPadding: 0.05,
                    shadow: false,
                    minPointLength: 1
                }
            }
        });
    },
    
    // override
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        
        switch(key) {
        
            case 'chart.barSpacing':
                this.mapBarSpacing(value);
                break;
            case 'chart.seriesSpacing':
                this.mapSeriesSpacing(value);
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        
        }
    },
    
    mapBarSpacing: function(valueStr) {
        var value = parseFloat(valueStr, 10);
        if(!isNaN(value)) {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    bar: {
                        groupPadding: 0.05 + ((value - 1) / 20)
                    }
                }
            });
        }
    },
    
    mapSeriesSpacing: function(valueStr) {
        var value = parseFloat(valueStr, 10);
        if(!isNaN(value)) {
            $.extend(true, this.hcConfig, {
                plotOptions: {
                    bar: {
                        pointPadding: 0.2 * Math.pow(value, 0.25)
                    }
                }
            });
        }
    },

    // override
    applyFormatting: function($super, properties, data) {
        $super(properties, data);
        var temp = this.hcConfig.xAxis.tickPixelInterval;

        this.hcConfig.xAxis.tickPixelInterval = this.hcConfig.yAxis.tickPixelInterval;
        this.hcConfig.yAxis.tickPixelInterval = temp;

        $.extend(true, this.hcConfig, {
            xAxis: {
                labels: {
                    align: 'right',
                    x: -8,
                    y: -5
                }
            },
            yAxis: {
                labels: {
                    align: 'right',
                    x: -5
                }
            }
        });
    },

    // override
    configureEmptyChart: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            yAxis: {
                labels: {
                    align: 'right',
                    x: -5
                }
            }
        });
    },

    // bar charts reverse the notion of x and y, we flip them back here to make
    // getChartSizeX and getChartSizeY consistent across all chart types...

    // override
    getChartSizeX: function() {
        if(!this.hcChart) {
            return undefined;
        }
        return this.hcChart.plotSizeY;
    },

    // override
    getChartSizeY: function() {
        if(!this.hcChart) {
            return undefined;
        }
        return this.hcChart.plotSizeX;
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.ScatterChart


Splunk.HCBridge.ScatterChart = $.klass(Splunk.HCBridge.PointBasedChart, {
    
    initialize: function($super, container) {
        $super(container);
        this.mode = 'multiSeries';
    },

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'scatter',
                className: 'scatter-chart'
            },
            plotOptions: {
                scatter: {
                    marker: {
                        radius: 7
                    }
                }
            }
        });
    },
    
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        switch(key) {
            
            case 'chart.markerSize':
                this.mapMarkerSize(value);
                break;
            default:
                // no-op, ignore unsupported properties
                break;
                
        }
    },
    
    mapMarkerSize: function(valueStr) {
        var value = parseInt(valueStr, 10);
        if(!isNaN(value)) {
            $.extend(true, this.hcConfig, {
                    plotOptions: {
                    scatter: {
                        marker: {
                            radius: value - Math.floor(value / 3)
                        }
                    }
                }
            });
        }
    },
    
    setMode: function(mode) {
        this.mode = mode;
        if(mode === 'singleSeries') {
            $.extend(true, this.hcConfig, {
                legend: {
                    enabled: false
                }
            });
        }
        else {
            $.extend(true, this.hcConfig, {
                legend: {
                    enabled: true
                }
            });
        }
    },

    // override
    formatTooltip: function(properties, data) {
        var xAxisKey = data.xAxisKey,
            xFieldName = data.fieldNames[0],
            yFieldName = data.fieldNames[1],
            resolveX = this.getTooltipXResolver(data.xAxisType),
            resolveY = this.getTooltipYResolver(),
            resolveName = this.getTooltipNameResolver(data.xAxisKey);

        if(this.mode === 'multiSeries') {
            $.extend(true, this.hcConfig, {
                tooltip: {
                    formatter: function() {
                        return [
                           '<span style="color:#cccccc">', xAxisKey, ': </span>',
                           '<span style="color:', this.series.color, '">', resolveName(this), '</span> <br/>',
                           '<span style="color:#cccccc">', xFieldName, ': </span>',
                           '<span style="color:#ffffff">', resolveX(this), '</span> <br/>',
                           '<span style="color:#cccccc">', yFieldName, ': </span>',
                           '<span style="color:#ffffff">', resolveY(this), '</span>'
                        ].join('');
                    }
                }
            });
        }
        else {
            $.extend(true, this.hcConfig, {
                tooltip: {
                    formatter: function() {
                        return [
                           '<span style="color:#cccccc">', xAxisKey, ': </span>',
                           '<span style="color:#ffffff">', resolveX(this), '</span> <br/>',
                           '<span style="color:#cccccc">', xFieldName, ': </span>',
                           '<span style="color:#ffffff">', resolveY(this), '</span>'
                        ].join('');
                    }
                }
            });
        }
    },

    getTooltipNameResolver: function(axisKey) {
        return function(element) {
            return element.series.name;
        }
    },

    // override
    formatLegend: function() {
        var resolveLabel = this.getLegendResolver(this.processedData.xAxisKey);
        $.extend(true, this.hcConfig, {
            legend: {
                labelFormatter: function() {
                    return resolveLabel(this)
                }
            }
        })
    },

    getLegendResolver: function(axisKey) {
        return function(element) {
            return element.name;
        }
    },
    
    // override
    onPointClick: function(point) {
        var xAxisKey = this.processedData.xAxisKey,
            xAxisType = this.processedData.xAxisType,
            xFieldName = (this.mode === 'multiSeries') ? this.processedData.fieldNames[0] : xAxisKey,
            yFieldName = (this.mode === 'multiSeries') ? this.processedData.fieldNames[1] : this.processedData.fieldNames[0],
            event = {
                fields: (this.mode === 'multiSeries') ? [xAxisKey, xFieldName, yFieldName] : [xFieldName, yFieldName],
                data: {}
            }
        
        event.data[xAxisKey] = (xAxisKey == '_time') ? Splunk.util.getEpochTimeFromISO(point.series.name) : point.series.name
        event.data[yFieldName] = point.y;
        if(xAxisKey == "_time") {
            event.data._span = point._span;
        }
        event.data[xFieldName] = (xAxisType == 'category') ? point.name : point.x;
        this.dispatchEvent('chartClicked', event);
    },

    // override
    // TODO: look into to overriding extractProcessedData instead, there seems to be
    // some wasted work / hackery here...
    addDataToConfig: function() {
        var fieldNames = this.processedData.fieldNames;

        if(fieldNames.length < 1 || (fieldNames.length === 1 && this.processedData.xAxisKey === '_time')) {
            this.chartIsEmpty = true;
            return;
        }
        this.hcConfig.series = [];
        this.processedData.categories = undefined;
        this.processedData.xAxisType = "numeric";
        

        if(fieldNames.length === 1) {
            this.setMode('singleSeries');
            this.addSingleSeriesData();
        }
        else {
            this.setMode('multiSeries');
            this.addMultiSeriesData(); 
        }
    },
    
    addMultiSeriesData: function() {
        var i, key, loopYVal, loopXVal, loopName, loopDataPoint,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series,
            collapsedSeries = {},
            xMin = 0,
            xMax = 0,
            yMin = 0,
            yMax = 0;
        
        for(i = 0; i < series[fieldNames[0]].length; i++) {
            loopXVal = series[fieldNames[0]][i].y;
            if(this.logYAxis) {
                loopXVal = Math.round(Splunk.HCBridge.Utils.absPowerTen(loopXVal));
            }
            loopYVal = series[fieldNames[1]][i].y;
            xMin = Math.min(xMin, loopXVal);
            xMax = Math.max(xMax, loopXVal);
            yMin = Math.min(yMin, loopYVal);
            yMax = Math.max(yMax, loopYVal);
            loopName = series[fieldNames[0]][i].name;
            loopDataPoint = {
                x: loopXVal,
                y: loopYVal,
                rawY: series[fieldNames[1]][i].rawY
            }
            if(this.processedData.xAxisKey == '_time') {
                loopDataPoint.data._span = series[fieldNames[0]][i]._span
            }
            if(collapsedSeries[loopName]) {
                collapsedSeries[loopName].push(loopDataPoint);
            }
            else {
                collapsedSeries[loopName] = [loopDataPoint];
            }
        }
        window.collapsedSeries = collapsedSeries;
        for(key in collapsedSeries) {
            if(collapsedSeries.hasOwnProperty(key)) {
                this.hcConfig.series.push({
                    name: key,
                    data: collapsedSeries[key]
                });
            }
        }
        this.processedData.xMin = xMin;
        this.processedData.xMax = xMax;
        this.processedData.yMin = yMin;
        this.processedData.yMax = yMax;
    },
    
    addSingleSeriesData: function() {
        var i, loopYVal, loopXVal,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series,
            xMin = 0,
            xMax = 0,
            yMin = 0,
            yMax = 0;
        
        for(i = 0; i < series[fieldNames[0]].length; i++) {
            loopXVal = series[fieldNames[0]][i].x;
            loopYVal = series[fieldNames[0]][i].y;
            if(this.logYAxis) {
                loopYVal = Math.round(Splunk.HCBridge.Utils.absPowerTen(loopYVal));
            }
            xMin = Math.min(xMin, loopXVal);
            xMax = Math.max(xMax, loopXVal);
            yMin = Math.min(yMin, loopYVal);
            yMax = Math.max(yMax, loopYVal);
        }
        this.processedData.xMin = xMin;
        this.processedData.xMax = xMax;
        this.processedData.yMin = yMin;
        this.processedData.yMax = yMax;
        this.hcConfig.series.push({
            data: series[fieldNames[0]]
        });
    },

    addLegendClasses: function() {
        // empty placeholder to avoid errors caused by superclass method
    },

    addTooltipClasses: function() {
        // empty placeholder to avoid errors caused by superclass method
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.PieChart


Splunk.HCBridge.PieChart = $.klass(Splunk.HCBridge.AbstractChart, {
    
 // override
    initialize: function($super, container) {
        $super(container);
        this.collapseFieldName = 'other';
        this.collapsePercent = 0.01;
        this.showPercent = false;
        this.useTotalCount = false;
    },

    // override
    onPointMouseOver: function(point) {
        this.highlightSlice(point);
    },

    // override
    onPointMouseOut: function(point) {
        this.unHighlightSlice(point);
    },

    // override
    generateDefaultConfig: function($super) {
        $super();
        $.extend(true, this.hcConfig, {
            chart: {
                type: 'pie',
                className: 'pie-chart'
            },
            plotOptions: {
                pie: {
                    borderWidth: 0,
                    shadow: false
                }
            },
            xAxis: {
                lineWidth: 0
            },
            yAxis: {
                lineWidth: 0
            }
        });
    },
    
    applyPropertyByName: function($super, key, value, properties) {
        var keysToIgnore = {
            'secondaryAxis.scale': true,
            'axisY.scale': true,
            'primaryAxisTitle.text': true,
            'axisTitleX.text': true
        };
        
        if(key in keysToIgnore) {
            return;
        }
        $super(key, value, properties);
        switch(key) {
            
            case 'chart.sliceCollapsingThreshold':
                this.mapSliceCollapsingThreshold(value);
                break;
            case 'chart.sliceCollapsingLabel':
                this.collapseFieldName = value;
                break;
            case 'chart.showLabels':
                this.mapShowLabels(value);
                break;
            case 'chart.showPercent':
                this.showPercent = (value === 'true');
                break;
            default:
                // no-op, ignore unsupported properties
                break;
                
        }
    },
    
    mapSliceCollapsingThreshold: function(valueStr) {
        var value = parseFloat(valueStr, 10);
        if(!isNaN(value)) {
            value = (value > 1) ? 1 : value;
            this.collapsePercent = value;
        }
    },
    
    mapShowLabels: function(value) {
        $.extend(true, this.hcConfig, {
            plotOptions: {
                pie: {
                    dataLabels: {
                        enabled: (value === 'true')
                    }
                }
            }
        });
    },

    // override
    applyFormatting: function($super, properties, data) {
        var resolveLabel = this.getLabelResolver();

        $super(properties, data);
        $.extend(true, this.hcConfig, {
            plotOptions: {
                pie: {
                    dataLabels: {
                        formatter: function() {
                            return resolveLabel(this);
                        }
                    }
                }
            }
        });
    },

    getLabelResolver: function() {
        return function(element) {
            return element.point.name;
        }
    },

    // override
    formatTooltip: function(properties, data) {
        var xAxisKey = data.xAxisKey,
            resolveX = this.getTooltipXResolver(data.xAxisType),
            useTotalCount = this.useTotalCount;

        $.extend(true, this.hcConfig, {
            tooltip: {
                formatter: function() {
                    return [
                        '<span style="color:#cccccc">', xAxisKey, ': </span>',
                        '<span style="color:', this.point.color, '">', resolveX(this), '</span> <br/>',
                        '<span style="color:#cccccc">', this.series.name, ': </span>',
                        '<span style="color:#ffffff">', this.y, '</span> <br/>',
                        '<span style="color:#cccccc">', ((useTotalCount) ? 'percent' : this.series.name + '%'), ': </span>',
                        '<span style="color:#ffffff">', Highcharts.numberFormat(this.percentage, 2), '%</span>'
                    ].join('');
                }
            }
        });
    },

    //override
    getTooltipXResolver: function(axisType) {
        return function(element) {
            return element.point.rawName;
        }
    },
    
    // override
    extractProcessedData: function($super, rawData, properties) {
        $super(rawData, properties);
        for(var i = 0; i < rawData.series.length; i++) {
            if(rawData.series[i].field === '_tc') {
                this.useTotalCount = true;
                this.totalCount = parseInt(rawData.series[i].data[0], 10);
                return;
            }
        }
        this.useTotalCount = false;
    },

    // override
    addDataToConfig: function() {
        if(this.useTotalCount) {
            this.addDataWithTotalCount();
        }
        else {
            this.addDataWithCollapsing();
        }
    },
    
    addDataWithCollapsing: function() {
        var i, loopObject, loopPercent, labelWidth,
            totalY = 0,
            numCollapsed = 0,
            collapsedY = 0,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series,
            firstSeries = series[fieldNames[0]],
            prunedData = [],
            
            labelDistance = 30, // default value from HC
            maxLabelWidth = ($(this.renderTo).width() - 0.75 * this.chartHeight) / 2 - labelDistance;

        for(i = 0; i < firstSeries.length; i++) {
            totalY += firstSeries[i].y;
        }
        for(i = 0; i < firstSeries.length; i++) {
            loopObject = firstSeries[i];
            loopPercent = loopObject.y / totalY;
            if(loopPercent < this.collapsePercent) {
                collapsedY += loopObject.y;
                numCollapsed++;
            }
            else {
                loopObject.rawName = loopObject.name;
                if(this.showPercent) {
                    loopObject.name += ', ' + Highcharts.numberFormat(loopPercent * 100, 1) + '%';
                }
                labelWidth = this.predictTextWidth(loopObject.name, 11);
                if(labelWidth > maxLabelWidth) {
                    loopObject.name = this.middleEllipsize(loopObject.name, maxLabelWidth, 11);
                }
                prunedData.push(loopObject);
            }
        }
        if(numCollapsed > 0) {
            prunedData.push({
                name: this.collapseFieldName + ' (' + numCollapsed + ')' 
                            + ((this.showPercent) ? ', ' + Highcharts.numberFormat((collapsedY / totalY) * 100, 1) + '%' : ''),
                rawName: this.collapseFieldName + ' (' + numCollapsed + ')',
                y: collapsedY
            });
        }
        this.hcConfig.series = [
            {
                name: fieldNames[0],
                data: prunedData
            }
        ];
    },
    
    addDataWithTotalCount: function() {
        var i, loopObject, loopPercent, labelWidth,
            totalY = 0,
            fieldNames = this.processedData.fieldNames,
            series = this.processedData.series,
            firstSeries = series[fieldNames[0]],
            adjustedData = [],
            
            labelDistance = 30, // default value from HC
            maxLabelWidth = ($(this.renderTo).width() - 0.75 * this.chartHeight) / 2 - labelDistance;
    
        for(i = 0; i < firstSeries.length; i++) {
            loopObject = firstSeries[i];
            loopPercent = loopObject.y / this.totalCount;
            loopObject.rawName = loopObject.name;
            totalY += loopObject.y;
            if(this.showPercent) {
                loopObject.name += ', ' + Highcharts.numberFormat(loopPercent * 100, 1) + '%';
            }
            labelWidth = this.predictTextWidth(loopObject.name, 11);
            if(labelWidth > maxLabelWidth) {
                loopObject.name = this.middleEllipsize(loopObject.name, maxLabelWidth, 11);
            }
            adjustedData.push(loopObject);
        }
        if(totalY < this.totalCount) {
            adjustedData.push({
                name: this.collapseFieldName + ((this.showPercent) ? 
                            ', ' + Highcharts.numberFormat(((this.totalCount - totalY) / this.totalCount) * 100, 1) + '%' : ''),
                rawName: this.collapseFieldName,
                y: this.totalCount - totalY
            });
        }
        this.hcConfig.series = [
            {
                name: fieldNames[0],
                data: adjustedData
            }
        ];
    },

    highlightSlice: function(point) {
        var selector = '#' + this.hcObjectId + ' g.highcharts-point *',
            rule = 'opacity: 0.25;';

        Splunk.HCBridge.Utils.addCssRule(selector, rule);
        point.graphic.element.style.opacity = 1;
    },

    unHighlightSlice: function(point) {
        Splunk.HCBridge.Utils.removeAllCssRules();
        point.graphic.element.style.opacity = '';
    },

    addLegendClasses: function() {
        // empty placeholder to avoid errors caused by superclass method
    },

    addTooltipClasses: function() {
        // empty placeholder to avoid errors caused by superclass method
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.SplitSeriesChart


Splunk.HCBridge.SplitSeriesChart = $.klass(Splunk.HCBridge.AbstractVisualization, {

    needsColorPalette: true,
    interChartSpacing: 0,

    initialize: function(container, innerConstructor) {
        this.innerConstructor = innerConstructor;
        this.renderTo = container;
        this.chartHeight = $(this.renderTo).height();
        this.chartWidth = $(this.renderTo).width();
        this.innerHeights = [];
        this.innerWidths = [];
        this.innerCharts = [];
        this.$innerWrappers = [];
        this.chartIsDrawing = false;
        this.chartIsStale = false;

        // DEBUGGING
        window.sschart = this;
    },

    draw: function(data, colors, properties, callback) {
        this.properties = properties;
        this.colors = colors;
        if(this.chartIsDrawing) {
            this.pendingData = data;
            this.pendingCallback = callback;
            this.chartIsStale = true;
            return;
        }

        var i, $loopWrapper, loopProps,
            loopConstructor, loopChart,
            baseConstructor = this.getBaseConstructor(properties),
            topConstructor,
            middleConstructor,
            bottomConstructor,
            legendPlacement = properties['legend.placement'],
            $renderTo = $(this.renderTo),
            numDrawn = 0,
            innerCallback = function() {
                numDrawn++;
                if(numDrawn == this.numSeries) {
                    this.drawCallback = setTimeout(function() {
                        if(this.chartIsStale) {
                            this.chartIsStale = false;
                            this.draw(this.pendingData, this.colors, this.properties, this.pendingCallback);
                            return;
                        }
                        // here we'll adjust the inner chart sizes and resize
                        this.updateInnerChartSizes(properties);
                        this.autoResize();
                        this.chartIsDrawing = false;
                        if(callback) {
                            callback();
                        }
                    }.bind(this), 0);
                }
            }.bind(this);

        this.chartIsDrawing = true;
        this.extractFieldNames(data, properties);
        this.updateInnerChartSizes(properties);
        middleConstructor = this.getMiddleConstructor(properties, baseConstructor);
        bottomConstructor = this.getBottomConstructor(properties, baseConstructor);
        if(legendPlacement == 'top') {
            topConstructor = this.getTopConstructor(properties, middleConstructor);
        }

        if(this.innerCharts.length > 0) {
            this.destroy();
        }

        for(i = 0; i < this.numSeries; i++) {
            $renderTo.append(
                $('<div class="sschart-inner-wrapper"></div>')
                    .css({
                        'float': 'left',
                        width: this.innerWidths[i] + 'px',
                        height: this.innerHeights[i] + 'px',
                        'margin-bottom': (i == this.numSeries) ? 0 : this.interChartSpacing,
                        display: 'none'
                    })
            );
        }
        this.$innerWrappers = $('.sschart-inner-wrapper', $renderTo);
        this.$innerWrappers.each(function(i, wrapper) {
            if(i == 0) {
                loopConstructor = (legendPlacement == 'top') ? topConstructor : middleConstructor;
            }
            else if(i == this.numSeries - 1) {
                loopConstructor = bottomConstructor;
            }
            else {
                loopConstructor = middleConstructor;
            }
            $loopWrapper = $(wrapper);
            loopChart = new loopConstructor($loopWrapper[0]);
            this.innerCharts.push(loopChart);
            loopProps = $.extend(true, {}, properties, {
                fieldHideList: $.extend(true, [], this.fieldNames)
            });
            loopProps.fieldHideList.splice(i, 1);
            loopChart.draw(data, colors, loopProps, innerCallback);
        }.bind(this));
    },

    setData: function(data, callback) {

        this.draw(data, this.colors, this.properties, callback);

        /*

        As with the base charts, trying to push new data without redrawing is too buggy.

        var i,
            oldNumSeries = this.numSeries;
        this.extractFieldNames(data, this.properties);
        if(oldNumSeries != this.numSeries) {
            this.draw(data, this.colors, this.properties);
        }
        else {
            for(i = 0; i < this.innerCharts.length; i++) {
                this.innerCharts[i].setData(data);
            }
        }

        */
    },

    resize: function(width, height) {
        this.chartWidth = width;
        this.chartHeight = height;
        this.updateInnerChartSizes(this.properties);
        this.autoResize();
    },

    destroy: function() {
        var i;
        for(i = 0; i < this.innerCharts.length; i++) {
            this.innerCharts[i].destroy();
        }
        this.innerCharts = [];
        $(this.renderTo).empty();
        clearTimeout(this.drawTimeout);
    },

    // autoResize adjusts inner charts based on existing values for this.innerWidths
    // and this.innerHeights
    autoResize: function() {
        var i;
        for(i = 0; i < this.innerCharts.length; i++) {
            $('.sschart-inner-wrapper', $(this.renderTo)).each(function(i, elem) {
                $(elem)
                    .width(this.chartWidth)
                    .height(this.innerHeights[i])
                    .css({
                        display: 'block'
                    });
            }.bind(this));
        }
        for(i = 0; i < this.innerCharts.length; i++) {
            this.innerCharts[i].resize(this.innerWidths[i], this.innerHeights[i]);
        }
    },
    
    getBaseConstructor: function(properties) {
        var self = this,
            legendPlacement = properties['legend.placement'],
            chartType = properties.chart;
        return $.klass(this.innerConstructor, {

            // override
            generateDefaultConfig: function($super) {
                $super();
                $.extend(true, this.hcConfig, {
                    chart: {
                        ignoreHiddenSeries: false,
                        spacingTop: 5
                    },
                    legend: {
                        itemHiddenStyle: {
                            color: 'black'
                        },
                        margin: 0
                    }
                });
            },
           
            // override
            constructSeriesObject: function(name, data, properties) {
                var seriesObject = {
                    name: name,
                    data: data
                };
                if(properties.fieldHideList && properties.fieldHideList.indexOf(name) > -1) {
                    seriesObject.visible = false;
                    if(legendPlacement in {left: 1, right: 1}) {
                        seriesObject.showInLegend = false;
                    }
                }
                return seriesObject;
            },

            // override
            onLegendMouseOver: function($super, series) {
                $super(series);
                self.highlightInnerChart(series.index);
                if(legendPlacement in {left: 1, right: 1}) {
                    self.highlightInnerLegend(series.index);
                }
            },

            // override
            onLegendMouseOut: function($super, series) {
                $super(series);
                self.unHighlightInnerChart(series.index);
                if(legendPlacement in {left: 1, right: 1}) {
                    self.unHighlightInnerLegend(series.index);
                }
            },

            // override
            onPointMouseOver: function($super, point) {
                if(chartType in {line: 1, area: 1}) {
                    self.highlightInnerChart(point.series.index);
                }
                else {
                    $super(point);
                }
                if(legendPlacement in {left: 1, right: 1}) {
                    self.highlightInnerLegend(point.series.index);
                }
                else if(legendPlacement == 'top') {
                    self.innerCharts[0].highlightSeriesInLegend(point.series.index);
                }
                else if(legendPlacement == 'bottom') {
                    self.innerCharts[self.innerCharts.length - 1].highlightSeriesInLegend(point.series.index);
                }
            },

            // override
            onPointMouseOut: function($super, point) {
                if(chartType in {line: 1, area: 1}) {
                    self.unHighlightInnerChart(point.series.index);
                }
                else {
                    $super(point);
                }
                if(legendPlacement in {left: 1, right: 1}) {
                    self.unHighlightInnerLegend(point.series.index);
                }
                else if(legendPlacement == 'top') {
                    self.innerCharts[0].unHighlightSeriesInLegend(point.series.index);
                }
                else if(legendPlacement == 'bottom') {
                    self.innerCharts[self.innerCharts.length - 1].unHighlightSeriesInLegend(point.series.index);
                }
            },

            // override
            onLoad: function($super) {
                $super();
                if(legendPlacement == 'left') {
                    $('.highcharts-container', $(this.renderTo)).eq(0)
                        .css({
                            'float': 'right'
                        }
                    );
                }
            },

            // override
            addTestingMetadata: function() {

            }
           
        });
    },

    getBottomConstructor: function(properties, base) {
        return $.klass(base, {

            // override
            mapLegendPlacement: function($super, name) {
                $super(name);
                if(name == 'top') {
                    this.hcConfig.legend.enabled = false;
                }
            }

        });
    },

    getMiddleConstructor: function(properties, base) {
        return $.klass(base, {

            // override
            generateDefaultConfig: function($super) {
                $super();
                this.hcConfig.chart.spacingBottom = 10;
            },

            // override
            formatXAxis: function($super, properties, data) {
                var hiddenAxisConfig = {
                    labels: {
                        enabled: false
                    },
                    title: {
                       text: null
                    },
                    tickLength: 0
                };
                $super(properties, data);
                if(properties.chart == 'bar') {
                    $.extend(true, this.hcConfig, {
                        yAxis: hiddenAxisConfig
                    });
                }
                else {
                    $.extend(true, this.hcConfig, {
                        xAxis: hiddenAxisConfig
                    });
                }
            },

            // override
            mapLegendPlacement: function($super, name) {
                $super(name);
                if(name in {top: 1, bottom: 1}) {
                    this.hcConfig.legend.enabled = false;
                }
            }

        });

    },

    getTopConstructor: function(properties, base) {
        return $.klass(base, {

            // override
            mapLegendPlacement: function($super, name) {
                $super(name);
                if(name == 'top') {
                    this.hcConfig.legend.enabled = true;
                }
            }

        });
    },

    highlightInnerChart: function(index) {
        this.$innerWrappers.each(function(i, wrapper) {
            if(i != index) {
                $('.highcharts-series-group', $(wrapper))
                    .css({
                        opacity: 0.25
                    });
            }
        });
    },

    highlightInnerLegend: function(index) {
        this.$innerWrappers.each(function(i, wrapper) {
            if(i != index) {
                $('.highcharts-legend', $(wrapper))
                    .css({
                        opacity: 0.25
                    });
            }
        });
    },

    unHighlightInnerChart: function(index) {
        this.$innerWrappers.each(function(i, wrapper) {
            if(i != index) {
                $('.highcharts-series-group', $(wrapper))
                    .css({
                        opacity: 1
                    });
            }
        });
    },

    unHighlightInnerLegend: function(index) {
        this.$innerWrappers.each(function(i, wrapper) {
            if(i != index) {
                $('.highcharts-legend', $(wrapper))
                    .css({
                        opacity: 1
                    });
            }
        });
    },

    extractFieldNames: function(data, properties) {
        var i, loopField, loopIndex,
            fieldInfo = Splunk.HCBridge.Utils.extractFieldInfo(data),
            fieldNames = fieldInfo.fieldNames;

        // we are going to co-opt the notion of the fieldHideList, so we explicitly
        // remove those fields here
        if(properties.fieldHideList) {
            for(i = 0; i < properties.fieldHideList.length; i++) {
                loopField = properties.fieldHideList[i];
                loopIndex = fieldNames.indexOf(loopField);
                if(loopIndex > -1) {
                    fieldNames.splice(loopIndex, 1);
                }
            }
        }
        this.fieldNames = fieldNames;
        this.numSeries = fieldNames.length;
    },

    updateInnerChartSizes: function(properties) {
        var i, innerHeight, loopWidth, rawInnerHeight,
            legendPlacement = properties['legend.placement'],
            rawHeights = [],
            rawWidths = [],
            minWidth = Infinity;

        this.innerWidths = [];
        this.innerHeights = [];

        if(!this.innerCharts || this.innerCharts.length < 2) {
            // if we don't have any charts yet, give them all equal heights and widths
            innerHeight = ((this.chartHeight-(this.numSeries-1)*this.interChartSpacing)/this.numSeries);
            for(i = 0; i < this.numSeries; i++) {
                this.innerWidths.push(this.chartWidth);
                this.innerHeights.push(innerHeight);
            }
        }
        else {
            if(legendPlacement in {left: 1, right: 1}) {
                for(i = 0; i < this.innerCharts.length; i++) {
                    loopWidth = this.innerCharts[i].getChartSizeX();
                    minWidth = Math.min(minWidth, loopWidth);
                    rawWidths.push(loopWidth);
                }
                for(i = 0; i < this.innerCharts.length; i++) {
                    this.innerWidths.push(this.chartWidth - (rawWidths[i] - minWidth));
                }
            }
            else {
                for(i = 0; i < this.innerCharts.length; i++) {
                    this.innerWidths.push(this.chartWidth);
                }
            }
            if(this.innerCharts.length == 2) {
                var difference = this.innerCharts[0].getChartSizeY() - this.innerCharts[1].getChartSizeY();

                rawInnerHeight = ((this.chartHeight - this.interChartSpacing) / 2);
                this.innerHeights = [
                    rawInnerHeight - (difference / 2),
                    rawInnerHeight + (difference / 2)
                ];
            }
            else {
                var middleHeight = this.innerCharts[1].getChartSizeY(),
                    topOffset = middleHeight - this.innerCharts[0].getChartSizeY(),
                    bottomOffset = middleHeight - this.innerCharts[this.innerCharts.length - 1].getChartSizeY();
                    
                rawInnerHeight = ((this.chartHeight-topOffset-bottomOffset-(this.numSeries-1)*this.interChartSpacing)/this.numSeries);
                for(i = 0; i < this.innerCharts.length; i++) {
                    this.innerHeights.push(rawInnerHeight);
                }
                this.innerHeights[0] += topOffset;
                this.innerHeights[this.innerHeights.length - 1] += bottomOffset;
            }
        }
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.ListColorPalette


Splunk.HCBridge.ListColorPalette = function(colors, useInterpolation) {

    var self = this,
        colors = colors || Splunk.HCBridge.ListColorPalette.DEFAULT_COLORS,
        useInterpolation = (useInterpolation) ? true : false;

    self.getColor = function(field, index, count) {
        var p, index1, index2,
            numColors = colors.length;
        //alert('getColor called: ' + JSON.stringify({index: index, count: count}));
        if(numColors == 0) {
            return 0x000000;
        }
        if(index < 0) {
            index = 0;
        }
        if(!useInterpolation) {
            return colors[index % numColors];
        }
        if (count < 1) {
            count = 1;
        }
        if (index > count) {
            index = count;
        }
        p = (count == 1) ? 0 : (numColors - 1) * (index / (count - 1));
        index1 = Math.floor(p);
        index2 = Math.min(index1 + 1, numColors - 1);
        p -= index1;
        
        return self.interpolateColors(colors[index1], colors[index2], p);
    };

    // this is a direct port from the Flash library, ListColorPalette.as line 85
    self.interpolateColors = function(color1, color2, p) {
        var r1 = (color1 >> 16) & 0xFF,
            g1 = (color1 >> 8) & 0xFF,
            b1 = color1 & 0xFF,

            r2 = (color2 >> 16) & 0xFF,
            g2 = (color2 >> 8) & 0xFF,
            b2 = color2 & 0xFF,

            rInterp = r1 + Math.round((r2 - r1) * p),
            gInterp = g1 + Math.round((g2 - g1) * p),
            bInterp = b1 + Math.round((b2 - b1) * p);

        return ((rInterp << 16) | (gInterp << 8) | bInterp);
    };

    //implicit return this (aka self)
};

Splunk.HCBridge.ListColorPalette.DEFAULT_COLORS = [
    0x6BB7C8,
    0xFAC61D,
    0xD85E3D,
    0x956E96,
    0xF7912C,
    0x9AC23C,
    0x998C55,
    0xDD87B0,
    0x5479AF,
    0xE0A93B,
    0x6B8930,
    0xA04558,
    0xA7D4DF,
    0xFCDD77,
    0xE89E8B,
    0xBFA8C0,
    0xFABD80,
    0xC2DA8A,
    0xC2BA99,
    0xEBB7D0,
    0x98AFCF,
    0xECCB89,
    0xA6B883,
    0xC68F9B,
    0x416E79,
    0x967711,
    0x823825,
    0x59425A,
    0x94571A,
    0x5C7424,
    0x5C5433,
    0x85516A,
    0x324969,
    0x866523,
    0x40521D,
    0x602935
];

Splunk.HCBridge.ListColorPalette.DEFAULT_COLORS_CSS = [
       "#6BB7C8",
       "#FAC61D",
       "#D85E3D",
       "#956E96",
       "#F7912C",
       "#9AC23C",
       "#998C55",
       "#DD87B0",
       "#5479AF",
       "#E0A93B",
       "#6B8930",
       "#A04558",
       "#A7D4DF",
       "#FCDD77",
       "#E89E8B",
       "#BFA8C0",
       "#FABD80",
       "#C2DA8A",
       "#C2BA99",
       "#EBB7D0",
       "#98AFCF",
       "#ECCB89",
       "#A6B883",
       "#C68F9B",
       "#416E79",
       "#967711",
       "#823825",
       "#59425A",
       "#94571A",
       "#5C7424",
       "#5C5433",
       "#85516A",
       "#324969",
       "#866523",
       "#40521D",
       "#602935"
   ];


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AbstractGauge


Splunk.HCBridge.AbstractGauge = $.klass(Splunk.HCBridge.AbstractVisualization, {

    DEFAULT_COLORS: [0x69a847, 0xd5c43b, 0xa6352d],

    needsColorPalette: false,

    // override
    initialize: function($super, container) {
        this.renderTo = container;
        this.height = $(this.renderTo).height();
        this.width = $(this.renderTo).width();

        this.elements = {};
        this.colors = this.DEFAULT_COLORS;
        this.ranges = false;
        this.rangesCameFromXML = false;
        this.showMajorTicks = true;
        this.showMinorTicks = true;
        this.showLabels = true;
        this.showValue = true;
        this.showRangeBand = true;
        this.usePercentageRange = false;
        this.usePercentageValue = false;
    },

    draw: function(data, properties, callback) {
        this.properties = properties;
        this.applyProperties(properties);
        var interpolateColors = (this.ranges.length - 1 > this.colors.length);
        this.colorPalette = new Splunk.HCBridge.ListColorPalette(this.colors, interpolateColors);
        this.extractProcessedData(data, properties);
        this.renderGauge();
        this.nudgeChart();
        // add this class on successful draw for unit testing
        $(this.renderTo).addClass('highcharts-container');
        if(callback) {
            callback();
        }
    },

    setData: function(data, callback) {
        var i,
            rangesHaveChanged = false,
            oldValue = this.value,
            oldRanges = this.ranges;

        this.extractProcessedData(data, this.properties);
        for(i = 0; i < this.ranges.length; i++) {
            if(this.ranges[i] != oldRanges[i]) {
                rangesHaveChanged = true;
                break;
            }
        }
        // TODO: need to handle this in a graceful way..
        if(false && rangesHaveChanged) {
            this.destroy();
            this.draw(data, this.properties, callback);
        }
        else {
            this.updateValue(oldValue, this.value);
            if(callback) {
                callback();
            }
        }
    },

    resize: function(width, height) {
        this.width = width;
        this.height = height;
        this.destroy();
        this.renderGauge();
    },

    destroy: function() {
        for(var key in this.elements) {
            if(this.elements.hasOwnProperty(key)) {
                this.elements[key].destroy();
            }
        }
        this.elements = {};
        $(this.renderTo).empty();
    },

    // override
    applyPropertyByName: function($super, key, value, properties) {
        $super(key, value, properties);
        switch(key) {

            case 'gaugeColors':
                this.mapGaugeColors(value);
                break;
            case 'chart.rangeValues':
                this.mapRangeValues(value);
                break;
            case 'chart.majorUnit':
                this.majorUnit = parseInt(value, 10);
                break;
            case 'chart.showMajorTicks':
                this.showMajorTicks = (value === 'true');
                break;
            case 'chart.showMinorTicks':
                this.showMinorTicks = (value === 'true');
                break;
            case 'chart.showLabels':
                this.showLabels = (value === 'true');
                break;
            case 'chart.showValue':
                this.showValue = (value === 'true');
                break;
            case 'chart.showRangeBand':
                this.showRangeBand = (value === 'true');
                break;
            case 'chart.usePercentageRange':
                this.usePercentageRange = (value === 'true');
                break;
            case 'chart.usePercentageValue':
                this.usePercentageValue = (value === 'true');
                break;
            case 'chart.style':
                this.style = value;
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        }
    },
    
    mapGaugeColors: function(value) {
        var colors = this.colorStringToHexArray(value);
        if(colors) {
            this.colors = colors;
        }
    },
    
    mapRangeValues: function(value) {
        var i, ranges, rangeNumber;
        try {
            ranges = JSON.parse(value);
        }
        catch(e) {
            return;
        }
        for(i = 0; i < ranges.length; i++) {
            rangeNumber = parseInt(ranges[i], 10);
            if(isNaN(rangeNumber)) {
                return;
            }
            ranges[i] = rangeNumber;
        }
        this.ranges = ranges;
        this.rangesCameFromXML = true;
    },

    extractProcessedData: function(data, properties) {
        if(!data) {
            this.value = 0;
            if(!this.rangesCameFromXML) {
                this.ranges = [0, 30, 70, 100];
            }
            return;
        }
        var i, loopIndex, loopValue, value,
            ranges = [],
            numRangesMissing = 0,
            fieldInfo = Splunk.HCBridge.Utils.extractFieldInfo(data),
            xAxisSeriesIndex = fieldInfo.xAxisSeriesIndex;

        value = (fieldInfo.xAxisKey == '_time') ? 0
                            : parseFloat(data.series[xAxisSeriesIndex].data[0], 10);
        if(isNaN(value)) {
            value = 0;
        }
        this.value = value;
        
        // about to do a bunch of work to make sure we draw a reasonable gauge even if the data
        // is not what we expected, but only if there were no ranges specified in the XML
        if(!this.rangesCameFromXML) {
            for(i = 1; i < 5; i++) {
                loopIndex = xAxisSeriesIndex + i;
                if(data.series.length <= loopIndex) {
                    ranges.push(0);
                    numRangesMissing++;
                }
                else {
                    loopValue = parseInt(data.series[loopIndex].data[0], 10);
                    if(isNaN(loopValue)) {
                        ranges.push(0);
                        numRangesMissing++;
                    }
                    else {
                        ranges.push(loopValue);
                    }
                }
            }
            // if we were not able to extract at least two range values, punt and try
            // to come up with reasonable ranges based on the value
            if(numRangesMissing > 2) {
                var powerOfTen = (value == 0) ? 1 :
                        Math.floor(Splunk.HCBridge.Utils.logBaseTen(value));
                ranges = [
                    0,
                    3 * Math.pow(10, powerOfTen),
                    7 * Math.pow(10, powerOfTen),
                    10 * Math.pow(10, powerOfTen)
                ];
            }
            else {
                // in case the range values are not in ascending order, sort them
                // otherwise the chart won't render correctly
                ranges.sort(function(v1, v2) {
                    return v1 - v2;
                });
            }
            this.ranges = ranges;
        }
    },

    updateValue: function() {

    },

    renderGauge: function() {
        this.renderer = new Highcharts.Renderer(this.renderTo, this.width, this.height);
    },

    animateTransition: function(startVal, endVal, drawFn, finishCallback) {
        var animationIncrement = (endVal - startVal) / 20,
            animationTimestep = 25,
            incrementing = (endVal >= startVal),

            step = function(val) {
                var continueAnimating = true;

                if((incrementing && val >= endVal) || (!incrementing && val <= endVal)) {
                    drawFn(endVal);
                    if(finishCallback) {
                        finishCallback(endVal);
                    }
                    continueAnimating = false;
                }
                else {
                    drawFn(val);
                }
                this.nudgeChart();
                if(continueAnimating) {
                    this.transitionTimeout = setTimeout(function() {
                        step(val + animationIncrement);
                    },
                    animationTimestep);
                }
            }.bind(this);
        clearTimeout(this.transitionTimeout);
        this.transitionTimeout = setTimeout(function() {
                step(startVal + animationIncrement);
            },
            animationTimestep);
    },

    wobble: function(center, range, drawFn) {
        this.wobbleInterval = setInterval(function() {
            var randomVal = center + (Math.random() - 0.5) * 2 * range;
            drawFn(randomVal);
            this.nudgeChart();
        }.bind(this), 25);
    },

    nudgeChart: function() {
        // sometimes the VML renderer needs a "nudge" in the form of adding an invisible
        // element, this is a no-op for the SVG renderer
        if(this.hasSVG) {
            return;
        }
        if(this.elements.nudgeElement) {
            this.elements.nudgeElement.destroy();
        }
        this.elements.nudgeElement = this.renderer.rect(0, 0, 0, 0).add();
    },

    predictTextWidth: function(text, fontSize) {
        var testText = this.renderer.text(text, 0, 0)
                .attr({
                    visibility: 'hidden'
                })
                .css({
                    fontSize: fontSize
                })
                .add(),
            width = testText.getBBox().width;

        testText.destroy();
        return width;
    },

    calculateTickValues: function(start, end, numTicks) {
        var i, 
            // in normal mode we label in whole numbers, so the tick discovery loop starts at 0
            // but in percent mode we force it to label the first range value and go from there
            loopStart = (this.usePercentageRange) ? this.ranges[0] : 0,
            range = end - start,
            rawTickInterval = range / (numTicks - 1),
            nearestPowerOfTen = Splunk.HCBridge.Utils.nearestPowerOfTen(rawTickInterval),
            roundTickInterval,
            tickValues = [];
            
        if(this.usePercentageRange) {
            roundTickInterval = (this.majorUnit && !isNaN(this.majorUnit)) ? this.majorUnit : 10;
            for(i = 0; i <= 100; i += roundTickInterval) {
                tickValues.push(start + (i / 100) * range);
            }
        }
        else {
            if(this.majorUnit && !isNaN(this.majorUnit)) {
                roundTickInterval = this.majorUnit;
            }
            else {
                if(nearestPowerOfTen * 5 <= rawTickInterval) {
                    roundTickInterval = nearestPowerOfTen * 5;
                }
                else if(nearestPowerOfTen * 2 <= rawTickInterval) {
                    roundTickInterval = nearestPowerOfTen * 2;
                }
                else {
                    roundTickInterval = nearestPowerOfTen;
                }
            }
            for(i = loopStart; i <= end; i += roundTickInterval) {
                if(i >= start) {
                    // work-around to deal with floating-point inconsistencies
                    tickValues.push(parseFloat(i.toFixed(2), 10));
                }
            }
        }
        return tickValues;
    },
    
    colorStringToHexArray: function(colorStr) {
        if(colorStr.charAt(0) !== '[' || colorStr.charAt(colorStr.length - 1) !== ']') {
            return false;
        }
        colorStr = colorStr.substr(1, colorStr.length - 2);
        var i, hexColor,
            colors = colorStr.split(",");
        
        for(i = 0; i < colors.length; i++) {
            hexColor = parseInt(colors[i], 16);
            if(isNaN(hexColor)) {
                return false;
            }
            colors[i] = hexColor;
        }
        return colors;
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.RadialGauge


Splunk.HCBridge.RadialGauge = $.klass(Splunk.HCBridge.AbstractGauge, {

    // override
    initialize: function($super, container) {
        $super(container);
        this.verticalPadding = 10;
        this.borderWidth = (this.height < 300) ? 5 : 10;
        this.tickOffset = 5;
        this.tickWidth = 2;
        this.tickLabelOffset = (this.height < 300) ? 5: 10;
        this.tickFontSize = (this.height < 300) ? 12 : 15;  // in pixels
        this.maxTicksPerRange = 7;
        this.minorsPerMajor = 10;
        this.startAngle = this.degToRad(45 + 90); // specify in degrees for legibility, + 90 because we start at south
        this.arcAngle = this.degToRad(270);  // ditto
        this.valueFontSize = 20;  // in pixels
        this.needleTailLength = (this.height < 300) ? 20 : 40;
        this.needleTailWidth = (this.height < 300) ? 5 : 10;
        this.knobWidth = (this.height < 300) ? 10 : 15;
        
        this.showMinorTicks = false;
    },

    // override
    updateValue: function(oldValue, newValue) {
        var valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((this.value - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
            parseFloat(this.value.toFixed(2), 10);
        if(this.adjustedValueToRad(oldValue) != this.adjustedValueToRad(newValue)) {
            clearInterval(this.wobbleInterval);
            this.animateTransition(oldValue, newValue,
                    this.drawNeedle.bind(this), this.checkOutOfRange.bind(this));
        }
        if(this.showValue) {
            this.elements.valueDisplay.attr({
                text: valueText
            });
        }
    },

    // override
    applyPropertyByName: function($super, key, value, properties) {
        var angle;
        $super(key, value, properties);
        switch(key) {

            case 'chart.rangeStartAngle':
                angle = parseInt(value, 10);
                if(!isNaN(angle)) {
                    // add 90 to startAngle because we start at south instead of east
                    this.startAngle = this.degToRad(angle + 90);
                }
                break;
            case 'chart.rangeArcAngle':
                angle = parseInt(value, 10);
                if(!isNaN(angle)) {
                    this.arcAngle = this.degToRad(angle);
                }
                break;
            default:
                // no-op, ignore unsupported properties
                break;
        }
    },

    // override
    renderGauge: function($super) {
        $super();
        if(this.style === 'minimal') {
            this.bandOffset = 0;
            this.bandThickness = (this.height < 300) ? 10 : 20;
        }
        else {
            this.bandOffset = (this.height < 300) ? 5 : 10;
            this.bandThickness = (this.height < 300) ? 5 : 10;
        }
        this.tickColor = (this.style === 'minimal') ? 'black' : 'silver';
        this.valueColor = (this.style === 'minimal') ? 'black' : '#b8b167';
        this.tickLength = this.height / 20;
        this.minorTickLength = this.tickLength / 2;
        this.radius = (this.height - 2 * (this.verticalPadding + this.borderWidth)) / 2;
        this.valueHeight = this.height - ((this.radius / 4) + this.verticalPadding + this.borderWidth);
        this.needleLength = (this.style === 'minimal') ? this.radius - 10 : this.radius;
        
        if(this.style !== 'minimal') {
            this.elements.border = this.renderer.circle(this.width / 2,
                        this.height / 2, this.radius + this.borderWidth)
                .attr({
                    fill: '#edede7',
                    stroke: 'silver',
                    'stroke-width': 1
                })
                .add();
    
            this.elements.background = this.renderer.circle(this.width / 2,
                        this.height / 2, this.radius)
                .attr({
                    fill: '#000000'
                })
                .add();
        }

        if(this.showRangeBand) {
            this.drawColorBand();
        }
        this.drawTicks();
        this.drawNeedle(this.value);
        if(this.showValue) {
            this.drawValueDisplay();
        }

        this.checkOutOfRange(this.value);
    },

    drawColorBand: function() {
        var i, startAngle, endAngle,
            outerRadius = this.radius - this.bandOffset,
            innerRadius = outerRadius - this.bandThickness;

        for(i = 0; i < this.ranges.length - 1; i++) {
            startAngle = this.valueToRad(this.ranges[i]);
            endAngle = this.valueToRad(this.ranges[i + 1]);
            //alert('drawing band: ' + JSON.stringify({i: i, startAngle: startAngle, endAngle: endAngle}));
            this.elements['colorBand' + i] = this.renderer.arc(this.width / 2, this.height / 2,
                        outerRadius, innerRadius, startAngle, endAngle)
                .attr({
                    fill: Splunk.HCBridge.Utils.colorFromHex(this.colorPalette.getColor(null, i, this.ranges.length - 1))
                })
                .add();
        }
    },

    drawTicks: function() {
        var i, loopAngle, loopText,
            tickStart = this.radius - this.bandOffset - this.bandThickness - this.tickOffset,
            tickEnd = tickStart - this.tickLength,
            tickLabel = tickEnd - this.tickLabelOffset,
            tickValues = this.calculateTickValues(this.ranges[0], this.ranges[this.ranges.length - 1], this.maxTicksPerRange);

        for(i = 0; i < tickValues.length; i++) {
            loopAngle = this.valueToRad(tickValues[i]);
            if(this.showMajorTicks) {
                this.elements['tickmark' + i] = this.renderer.path([
                        'M', (this.width / 2) + tickStart * Math.cos(loopAngle),
                             (this.height / 2) + tickStart * Math.sin(loopAngle),
                        'L', (this.width / 2) + tickEnd * Math.cos(loopAngle),
                             (this.height / 2) + tickEnd * Math.sin(loopAngle)
                    ])
                    .attr({
                        stroke: this.tickColor,
                        'stroke-width': this.tickWidth
                    })
                    .add();
            }
            if(this.showLabels) {
                loopValue = (this.usePercentageRange) ? ((tickValues[i] - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])) : tickValues[i];
                            
                this.elements['ticklabel' + i] = this.renderer.text(loopValue + ((this.usePercentageRange) ? "%" : ""),
                        (this.width / 2) + tickLabel * Math.cos(loopAngle)
                            - this.tickLength * Math.cos(loopAngle),
                        (this.height / 2) + tickLabel * Math.sin(loopAngle)
                            - this.tickLength * Math.sin(loopAngle)
                            + (this.tickLength / 2) * Math.sin(loopAngle)
                    )
                    .attr({
                        align: 'center',
                        translateY: this.tickFontSize / 4
                    })
                    .css({
                        color: this.tickColor,
                        fontSize: this.tickFontSize + 'px'
                    })
                    .add();
            }
        }
        if(this.showMinorTicks) {
            this.drawMinorTicks(tickValues, tickStart);
        }
    },
    
    drawMinorTicks: function(majorValues, tickStart) {
        var loopValue, loopHeight,
            majorInterval = majorValues[1] - majorValues[0],
            minorInterval = (majorInterval / this.minorsPerMajor),
            startValue = this.ranges[0],
            tickEnd = tickStart - this.minorTickLength;

            // start at the next minor tick after the first range value, unless we are in percent
            // mode in which case we force things to start at the first range value
            if(!(this.usePercentageRange) && startValue % minorInterval > 0) {
                startValue = this.ranges[0] - (this.ranges[0] % minorInterval) + minorInterval;
            }

        for(loopValue = startValue; loopValue <= this.ranges[this.ranges.length - 1]; loopValue += minorInterval) {
            if(majorValues.indexOf(loopValue) < 0) {
                loopAngle = this.valueToRad(loopValue);
                this.elements['minorTickMark' + loopValue] = this.renderer.path([
                        'M', (this.width / 2) + tickStart * Math.cos(loopAngle),
                             (this.height / 2) + tickStart * Math.sin(loopAngle),
                        'L', (this.width / 2) + tickEnd * Math.cos(loopAngle),
                             (this.height / 2) + tickEnd * Math.sin(loopAngle)
                    ])
                    .attr({
                        stroke: this.tickColor,
                        'stroke-width': this.tickWidth
                    })
                    .add();
            }
        }
    },

    drawNeedle: function(val) {
        var needlePath, needleStroke, needleStrokeWidth,
            needleFill, needleRidgePath, knobFill,
            valueAngle = this.adjustedValueToRad(val),
            myCos = Math.cos(valueAngle),
            mySin = Math.sin(valueAngle);
        
        if(this.style === 'minimal') {
            needlePath = [
                'M', (this.width / 2), 
                        (this.height / 2),
                'L', (this.width / 2) + myCos * this.needleLength,
                        (this.height / 2) + mySin * this.needleLength
            ];
            needleStroke = 'black';
            needleStrokeWidth = 5;
        }
        else {
            needlePath = [
               'M', (this.width / 2) - this.needleTailLength * myCos,
                        (this.height / 2) - this.needleTailLength * mySin,
               'L', (this.width / 2) - this.needleTailLength * myCos + this.needleTailWidth * mySin,
                        (this.height / 2) - this.needleTailLength * mySin - this.needleTailWidth * myCos,
                    (this.width / 2) + this.needleLength * myCos,
                        (this.height / 2) + this.needleLength * mySin,
                    (this.width / 2) - this.needleTailLength * myCos - this.needleTailWidth * mySin,
                        (this.height / 2) - this.needleTailLength * mySin + this.needleTailWidth * myCos,
                    (this.width / 2) - this.needleTailLength * myCos,
                        (this.height / 2) - this.needleTailLength * mySin
            ];
            needleFill = {
                linearGradient: [(this.width / 2) - this.needleTailLength * myCos,
                                    (this.height / 2) - this.needleTailLength * mySin,
                                (this.width / 2) - this.needleTailLength * myCos - this.needleTailWidth * mySin,
                                    (this.height / 2) - this.needleTailLength * mySin + this.needleTailWidth * myCos],
                stops: [
                    [0, '#999999'],
                    [0.2, '#cccccc']
                ]
            };
            needleRidgePath = [
                'M', (this.width / 2) - (this.needleTailLength - 2) * myCos,
                        (this.height / 2) - (this.needleTailLength - 2) * mySin,
                'L', (this.width / 2) + (this.needleLength - (this.bandOffset / 2)) * myCos,
                        (this.height / 2) + (this.needleLength - (this.bandOffset / 2)) * mySin
            ];
            knobFill = {
                linearGradient: [(this.width / 2) + this.knobWidth * mySin,
                                     (this.height / 2) - this.knobWidth * myCos,
                                 (this.width / 2) - this.knobWidth * mySin,
                                     (this.height / 2) + this.knobWidth * myCos],
                stops: [
                    [0, 'silver'],
                    [0.5, 'black'],
                    [1, 'silver']
                ]
            };
        }
        if(this.style !== 'minimal') {
            if(this.elements.centerKnob) {
                this.elements.centerKnob.attr({
                    fill: knobFill
                });
            }
            else {
                this.elements.centerKnob = this.renderer.circle(this.width / 2, this.height /2, this.knobWidth)
                    .attr({
                        fill: knobFill
                    })
                    .add();
            }
        }
        if(this.elements.needle) {
            this.elements.needle.attr({
                d: needlePath,
                fill: needleFill || '',
                stroke: needleStroke || '',
                'stroke-width': needleStrokeWidth || ''
            });
        }
        else {
            this.elements.needle = this.renderer.path(needlePath)
               .attr({
                   fill: needleFill || '',
                   stroke: needleStroke || '',
                   'stroke-width': needleStrokeWidth || ''
               })
               .add();
        }
        if(this.style !== 'minimal') {
            if(this.elements.needleRidge) {
                this.elements.needleRidge.attr({
                    d: needleRidgePath
                });
            }
            else {
                this.elements.needleRidge = this.renderer.path(needleRidgePath)
                    .attr({
                        stroke: '#cccccc',
                        'stroke-width': 1
                    })
                    .add();
            }
        }
    },

    drawValueDisplay: function() {
        var valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((this.value - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
                            parseFloat(this.value.toFixed(2), 10);
        this.elements.valueDisplay = this.renderer.text(valueText, this.width / 2, this.valueHeight)
            .css({
                color: this.valueColor,
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            })
            .attr({
                align: 'center'
            })
            .add();
    },

    checkOutOfRange: function(val) {
        var totalRange, wobbleCenter, wobbleRange;

        if(val < this.ranges[0]) {
            totalRange = this.ranges[this.ranges.length - 1] - this.ranges[0];
            wobbleRange = totalRange * 0.01;
            wobbleCenter = this.ranges[0] + wobbleRange;
            this.wobble(wobbleCenter, wobbleRange, this.drawNeedle.bind(this));
        }
        else if(val > this.ranges[this.ranges.length - 1]) {
            totalRange = this.ranges[this.ranges.length - 1] - this.ranges[0];
            wobbleRange = totalRange * 0.01;
            wobbleCenter = this.ranges[this.ranges.length - 1] - wobbleRange;
            this.wobble(wobbleCenter, wobbleRange, this.drawNeedle.bind(this));
        }
    },

    adjustedValueToRad: function(val) {
        if(val < this.ranges[0]) {
            return this.valueToRad(this.ranges[0]);
        }
        if(val > this.ranges[this.ranges.length - 1]) {
            return this.valueToRad(this.ranges[this.ranges.length - 1]);
        }
        return this.valueToRad(val);
    },

    valueToRad: function(val) {
        var dataRange = this.ranges[this.ranges.length - 1] - this.ranges[0],
            normalizedValue = val - this.ranges[0];

        return this.startAngle + ((normalizedValue / dataRange) * this.arcAngle);
    },

    degToRad: function(deg) {
        return (deg * Math.PI) / 180;
    }

});


///////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AbstractFillerGauge


Splunk.HCBridge.AbstractFillerGauge = $.klass(Splunk.HCBridge.AbstractGauge, {
    
 // override
    initialize: function($super, container) {
        $super(container);
        this.tickOffset = 5;
        this.tickLength = 10;
        this.tickColor = 'black';
        this.tickWidth = 1;
        this.tickLabelOffset = 10;
        this.tickFontSize = 15; // in pixels
        this.minorsPerMajor = 5;
        this.minorTickLength = 5;
        this.minorTickWidth = 1;
        this.maxTicksPerRange = 7;
        this.backgroundCornerRad = 5;
        this.valueBottomPadding = 10;
        this.valueFontSize = 20;  // in pixels
        this.defaultValueColor = 'black';
    },

    // override
    updateValue: function(oldValue, newValue) {
        this.animateTransition(oldValue, newValue, this.drawFill.bind(this));
    },
    
    // override
    renderGauge: function($super) {
        var tickValues = this.calculateTickValues(this.ranges[0], this.ranges[this.ranges.length - 1],
                        this.maxTicksPerRange);
        $super();
        this.drawBackground();
        this.drawTicks(tickValues);
        this.drawFill(this.value);
    }
    
});


///////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.VerticalFillerGauge


Splunk.HCBridge.VerticalFillerGauge = $.klass(Splunk.HCBridge.AbstractFillerGauge, {
    
    initialize: function($super, container) {
        $super(container);
        this.verticalPadding = 20;
        this.backgroundWidth = 75;
    },

    drawBackground: function() {
        this.backgroundHeight = this.height - (2 * this.verticalPadding);

        var maxValueWidth,
            maxRangeValue = this.ranges[this.ranges.length - 1];

        // rather than trying to dynamically increase the width as the values come in, we
        // provide enough room for an order of magnitude greater than the highest range value
        maxValueWidth = this.predictTextWidth(Highcharts.numberFormat(maxRangeValue * 10),
                            this.valueFontSize + 'px');
        this.backgroundWidth = Math.max(this.backgroundWidth, maxValueWidth);

        if(this.style !== 'minimal') {
            this.elements.background = this.renderer.rect((this.width - this.backgroundWidth) / 2,
                    this.verticalPadding, this.backgroundWidth, this.backgroundHeight,
                    this.backgroundCornerRad)
                .attr({
                    fill: '#edede7',
                    stroke: 'silver',
                    'stroke-width': 1
                })
                .add();
        }
    },

    drawTicks: function(tickValues) {
        var i, loopHeight, loopValue,
            tickStartX = (this.width + this.backgroundWidth) / 2 + this.tickOffset,
            tickEndX = tickStartX + this.tickLength,
            labelStartX = tickEndX + this.tickLabelOffset;

        for(i = 0; i < tickValues.length; i++) {
            loopHeight = this.verticalPadding + this.backgroundHeight -
                this.valueToHeight(tickValues[i]);
            if(this.showMajorTicks) {
                this.elements['tickMark' + i] = this.renderer.path([
                    'M', tickStartX, loopHeight,
                    'L', tickEndX, loopHeight
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.tickWidth
                })
                .add();
            }
            if(this.showLabels) {
                loopValue = (this.usePercentageRange) ? ((tickValues[i] - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])) : tickValues[i];
                this.elements['tickLabel' + i] = this.renderer.text(
                    loopValue + ((this.usePercentageRange ? '%' : '')),
                    labelStartX, loopHeight + (this.tickFontSize / 4)
                )
                .attr({
                    align: 'left'
                })
                .css({
                    color: this.tickColor,
                    fontSize: this.tickFontSize + 'px'
                })
                .add();
            }
        }
        if(this.showMinorTicks) {
            this.drawMinorTicks(tickValues, tickStartX);
        }
    },

    drawMinorTicks: function(majorValues, startX) {
        var loopValue, loopHeight,
            majorInterval = majorValues[1] - majorValues[0],
            minorInterval = majorInterval / this.minorsPerMajor,
            // start at the next minor tick after the first range value
            startValue = (this.usePercentageRange) ? this.ranges[0] : this.ranges[0] - (this.ranges[0] % minorInterval) + minorInterval;

        for(loopValue = startValue; loopValue <= this.ranges[this.ranges.length - 1]; loopValue += minorInterval) {
            if(majorValues.indexOf(loopValue) < 0) {
                loopHeight = this.verticalPadding + this.backgroundHeight
                                - this.valueToHeight(loopValue);
                //alert(loopValue + ' --> ' + loopHeight);
                this.elements['minorTickMark' + loopValue] = this.renderer.path([
                    'M', startX, loopHeight,
                    'L', startX + this.minorTickLength, loopHeight
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.minorTickWidth
                })
                .add();
            }
        }
    },

    drawFill: function(val) {
        // TODO: implement calculation of gradient based on user-defined colors
        // for not we are using solid colors
        
        var //fillGradient = this.getFillGradient(val),
            fillColor = this.getFillColor(val),
            fillHeight = this.adjustedValueToHeight(val),
            fillTopY,
            fillPath;
            if(fillHeight > 0) {
                fillHeight = Math.max(fillHeight, this.backgroundCornerRad);
                fillTopY = this.verticalPadding + this.backgroundHeight - fillHeight;
                if(this.style === 'minimal') {
                    fillPath = [
                        'M', (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding,
                        'L', (this.width + this.backgroundWidth) / 2,
                                this.height - this.verticalPadding,
                             (this.width + this.backgroundWidth) / 2,
                                fillTopY,
                             (this.width - this.backgroundWidth) / 2,
                                fillTopY,
                             (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding
                    ];
                }
                else {
                    fillPath = [
                        'M', (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding - this.backgroundCornerRad,
                        'C', (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding - this.backgroundCornerRad,
                             (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding,
                             (this.width - this.backgroundWidth) / 2 + this.backgroundCornerRad,
                                this.height - this.verticalPadding,
                        'L', (this.width + this.backgroundWidth) / 2 - this.backgroundCornerRad,
                                this.height - this.verticalPadding,
                        'C', (this.width + this.backgroundWidth) / 2 - this.backgroundCornerRad,
                                this.height - this.verticalPadding,
                             (this.width + this.backgroundWidth) / 2,
                                this.height - this.verticalPadding,
                             (this.width + this.backgroundWidth) / 2,
                                this.height - this.verticalPadding - this.backgroundCornerRad,
                        'L', (this.width + this.backgroundWidth) / 2,
                                fillTopY,
                             (this.width - this.backgroundWidth) / 2,
                                fillTopY,
                             (this.width - this.backgroundWidth) / 2,
                                this.height - this.verticalPadding - this.backgroundCornerRad
                    ];
                }
            }
            else {
                fillPath = [];
            }

        if(this.elements.fill) {
            this.elements.fill.attr({
                d: fillPath,
                fill: fillColor
            });
        }
        else {
            this.elements.fill = this.renderer.path(fillPath)
            .attr({
                fill: fillColor
            })
            .add();
        }
        if(this.showValue) {
            this.drawValue(val);
        }
    },

    drawValue: function(val) {
        var fillHeight = this.adjustedValueToHeight(val),
            fillTopY = this.verticalPadding + this.backgroundHeight - fillHeight,
            valueTotalHeight = this.valueFontSize + this.valueBottomPadding,
            // TODO: need to calculate a contrasting color based on the fill color (user-defined color)
            // for now just defaulting to black
            //valueColor = this.getValueColor(val),
            valueColor = this.defaultValueColor,
            valueBottomY,
            valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((val - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
                parseFloat(val.toFixed(2), 10);

        // determine if the value display can (vertically) fit inside the fill,
        // if not orient it to the bottom of the fill
        if(fillHeight >= valueTotalHeight) {
            valueBottomY = fillTopY + valueTotalHeight - this.valueBottomPadding;
        }
        else {
            valueBottomY = fillTopY - this.valueBottomPadding;
            // un-comment this when the value color is calculated based on the fill color
            //valueColor = this.defaultValueColor;
        }
        if(this.elements.valueDisplay) {
            this.elements.valueDisplay.attr({
                text: valueText,
                y: valueBottomY
            })
            .css({
                color: valueColor,
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            });
        }
        else {
            this.elements.valueDisplay = this.renderer.text(
                valueText, this.width / 2, valueBottomY
            )
            .css({
                color: valueColor,
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            })
            .attr({
                align: 'center'
            })
            .add();
        }
    },

    adjustedValueToHeight: function(val) {
        if(val < this.ranges[0]) {
            return 0;
        }
        if(val > this.ranges[this.ranges.length - 1]) {
            return this.valueToHeight(this.ranges[this.ranges.length - 1]);
        }
        return this.valueToHeight(val);
    },

    valueToHeight: function(val) {
        var dataRange = this.ranges[this.ranges.length - 1] - this.ranges[0],
            normalizedValue = val - this.ranges[0];

        return Math.round((normalizedValue / dataRange) * this.backgroundHeight);
    },
    
    getFillColor: function(val) {
        var i;
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                break;
            }
        }
        return Splunk.HCBridge.Utils.colorFromHex(this.colorPalette.getColor(null, i, this.ranges.length - 1));
    },

    getFillGradient: function(val) {
        var i, myEndPoints,
            gradientEndPoints = [
                ['#638948', '#719f53'],
                ['#bfb011', '#ddd114'],
                ['#a3231a', '#bd2c1e']
            ];
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                myEndPoints = gradientEndPoints[i];
                break;
            }
        }
        if(!myEndPoints) {
            myEndPoints = gradientEndPoints[gradientEndPoints.length - 1];
        }
        return {
            linearGradient: [this.width / 2, this.height - this.verticalPadding,
                                this.width / 2, this.height - this.verticalPadding
                                    - this.backgroundHeight],
            stops: [
                [0, myEndPoints[0]],
                [1, myEndPoints[1]]
            ]
        };
    },

    getValueColor: function(val) {
        var i,
            valueColors = [
                'white',
                'black',
                'white'
            ];
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                return valueColors[i];
            }
        }
        return valueColors[valueColors.length - 1];
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.HorizontalFillerGauge


Splunk.HCBridge.HorizontalFillerGauge = $.klass(Splunk.HCBridge.AbstractFillerGauge, {
    
    initialize: function($super, container) {
        $super(container);
        this.horizontalPadding = 20;
        this.backgroundHeight = 75;
    },
    
    drawBackground: function() {
        this.backgroundWidth = this.width - (2 * this.horizontalPadding);

        if(this.style !== 'minimal') {
            this.elements.background = this.renderer.rect(this.horizontalPadding,
                    (this.height - this.backgroundHeight) / 2, this.backgroundWidth, this.backgroundHeight,
                    this.backgroundCornerRad)
                .attr({
                    fill: '#edede7',
                    stroke: 'silver',
                    'stroke-width': 1
                })
                .add();
        }
    },

    drawTicks: function(tickValues) {
        var i, loopOffset, loopValue,
            tickStartY = (this.height + this.backgroundHeight) / 2 + this.tickOffset,
            tickEndY = tickStartY + this.tickLength,
            labelStartY = tickEndY + this.tickLabelOffset;

        for(i = 0; i < tickValues.length; i++) {
            loopOffset = this.horizontalPadding + this.valueToOffset(tickValues[i]);
            if(this.showMajorTicks) {
                this.elements['tickMark' + i] = this.renderer.path([
                    'M', loopOffset, tickStartY,
                    'L', loopOffset, tickEndY
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.tickWidth
                })
                .add();
            }
            if(this.showLabels) {
                loopValue = (this.usePercentageRange) ? ((tickValues[i] - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])) : tickValues[i];
                this.elements['tickLabel' + i] = this.renderer.text(
                    loopValue + ((this.usePercentageRange ? '%' : '')),
                    loopOffset, labelStartY + this.tickFontSize / 4
                )
                .attr({
                    align: 'center'
                })
                .css({
                    color: this.tickColor,
                    fontSize: this.tickFontSize + 'px'
                })
                .add();
            }
        }
        if(this.showMinorTicks) {
            this.drawMinorTicks(tickValues, tickStartY);
        }
    },

    drawMinorTicks: function(majorValues, startY) {
        var loopValue, loopOffset,
            majorInterval = majorValues[1] - majorValues[0],
            minorInterval = majorInterval / this.minorsPerMajor,
            // start at the next minor tick after the first range value
            startValue = (this.usePercentageRange) ? this.ranges[0] : this.ranges[0] - (this.ranges[0] % minorInterval) + minorInterval;

        for(loopValue = startValue; loopValue <= this.ranges[this.ranges.length - 1]; loopValue += minorInterval) {
            if(majorValues.indexOf(loopValue) < 0) {
                loopOffset = this.horizontalPadding + this.valueToOffset(loopValue);
                //alert(loopValue + ' --> ' + loopHeight);
                this.elements['minorTickMark' + loopValue] = this.renderer.path([
                    'M', loopOffset, startY,
                    'L', loopOffset, startY + this.minorTickLength
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.minorTickWidth
                })
                .add();
            }
        }
    },

    drawFill: function(val) {
        // TODO: implement calculation of gradient based on user-defined colors
        // for not we are using solid colors
        
        var //fillGradient = this.getFillGradient(val),
            fillColor = this.getFillColor(val),
            fillOffset = this.adjustedValueToOffset(val),
            fillTopX,
            fillPath;
            if(fillOffset > 0) {
                fillOffset = Math.max(fillOffset, this.backgroundCornerRad);
                fillTopX = this.horizontalPadding + fillOffset;
                if(this.style === 'minimal') {
                    fillPath = [
                        'M', this.horizontalPadding,
                                (this.height - this.backgroundHeight) / 2,
                        'L', fillTopX,
                                (this.height - this.backgroundHeight) / 2,
                             fillTopX,
                                 (this.height + this.backgroundHeight) / 2,
                             this.horizontalPadding,
                                 (this.height + this.backgroundHeight) / 2,
                             this.horizontalPadding,
                                 (this.height - this.backgroundHeight) / 2
                    ];
                }
                else {
                    fillPath = [
                        'M', this.horizontalPadding + this.backgroundCornerRad,
                                (this.height - this.backgroundHeight) / 2,
                        'C', this.horizontalPadding + this.backgroundCornerRad,
                                (this.height - this.backgroundHeight) / 2,
                             this.horizontalPadding,
                                (this.height - this.backgroundHeight) / 2,
                             this.horizontalPadding,
                                (this.height - this.backgroundHeight) / 2 + this.backgroundCornerRad,
                        'L', this.horizontalPadding,
                                (this.height + this.backgroundHeight) / 2 - this.backgroundCornerRad,
                        'C', this.horizontalPadding,
                                (this.height + this.backgroundHeight) / 2 - this.backgroundCornerRad,
                             this.horizontalPadding,
                                (this.height + this.backgroundHeight) / 2,
                             this.horizontalPadding + this.backgroundCornerRad,
                                (this.height + this.backgroundHeight) / 2,
                        'L', fillTopX,
                                (this.height + this.backgroundHeight) / 2,
                             fillTopX,
                                (this.height - this.backgroundHeight) / 2,
                             this.horizontalPadding + this.backgroundCornerRad,
                                (this.height - this.backgroundHeight) / 2
                    ];
                }
            }
            else {
                fillPath = [];
            }

        if(this.elements.fill) {
            this.elements.fill.attr({
                d: fillPath,
                fill: fillColor
            });
        }
        else {
            this.elements.fill = this.renderer.path(fillPath)
            .attr({
                fill: fillColor
            })
            .add();
        }
        if(this.showValue) {
            this.drawValue(val);
        }
    },

    drawValue: function(val) {
        var fillOffset = this.adjustedValueToOffset(val),
            fillTopX = this.horizontalPadding + fillOffset,
            // TODO: need to calculate a contrasting color based on the fill color (user-defined color)
            // for now just defaulting to black
            //valueColor = this.getValueColor(val),
            valueColor = this.defaultValueColor,
            valueStartX,
            valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((val - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
                parseFloat(val.toFixed(2), 10),
            valueTotalWidth = this.predictTextWidth(valueText, this.valueFontSize + 'px') + this.valueBottomPadding;

        // determine if the value display can (horizontally) fit inside the fill,
        // if not orient it to the right of the fill
        if(fillOffset >= valueTotalWidth) {
            valueStartX = fillTopX - (valueTotalWidth);
        }
        else {
            valueStartX = fillTopX + this.valueBottomPadding;
            // un-comment this when the value color is calculated based on the fill color
            //valueColor = this.defaultValueColor;
        }
        if(this.elements.valueDisplay) {
            this.elements.valueDisplay.attr({
                text: valueText,
                x: valueStartX
            })
            .css({
                color: valueColor,
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            });
        }
        else {
            this.elements.valueDisplay = this.renderer.text(
                valueText, valueStartX, (this.height / 2) + this.valueFontSize / 4
            )
            .css({
                color: valueColor,
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            })
            .attr({
                align: 'left'
            })
            .add();
        }
    },

    adjustedValueToOffset: function(val) {
        if(val < this.ranges[0]) {
            return 0;
        }
        if(val > this.ranges[this.ranges.length - 1]) {
            return this.valueToOffset(this.ranges[this.ranges.length - 1]);
        }
        return this.valueToOffset(val);
    },

    valueToOffset: function(val) {
        var dataRange = this.ranges[this.ranges.length - 1] - this.ranges[0],
            normalizedValue = val - this.ranges[0];

        return Math.round((normalizedValue / dataRange) * this.backgroundWidth);
    },
    
    getFillColor: function(val) {
        var i;
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                break;
            }
        }
        return Splunk.HCBridge.Utils.colorFromHex(this.colorPalette.getColor(null, i, this.ranges.length - 1));
    },

    getFillGradient: function(val) {
        var i, myEndPoints,
            gradientEndPoints = [
                ['#638948', '#719f53'],
                ['#bfb011', '#ddd114'],
                ['#a3231a', '#bd2c1e']
            ];
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                myEndPoints = gradientEndPoints[i];
                break;
            }
        }
        if(!myEndPoints) {
            myEndPoints = gradientEndPoints[gradientEndPoints.length - 1];
        }
        return {
            linearGradient: [this.width / 2, this.height - this.verticalPadding,
                                this.width / 2, this.height - this.verticalPadding
                                    - this.backgroundHeight],
            stops: [
                [0, myEndPoints[0]],
                [1, myEndPoints[1]]
            ]
        };
    },

    getValueColor: function(val) {
        var i,
            valueColors = [
                'white',
                'black',
                'white'
            ];
        for(i = 0; i < this.colors.length; i++) {
            if(val < this.ranges[i + 1]) {
                return valueColors[i];
            }
        }
        return valueColors[valueColors.length - 1];
    }
    
});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.AbstractMarkerGauge


Splunk.HCBridge.AbstractMarkerGauge = $.klass(Splunk.HCBridge.AbstractGauge, {

    // override
    initialize: function($super, container) {
        $super(container);
        this.markerWindowHeight = 60;
        this.markerSideWidth = 30;
        this.markerSideCornerRad = 10;
        this.bandOffsetBottom = 5 + this.markerWindowHeight / 2;
        this.bandOffsetTop = 5 + this.markerWindowHeight / 2;
        this.bandCornerRad = 0;
        this.tickOffset = 5;
        this.tickLength = 10;
        this.tickColor = 'black';
        this.tickWidth = 1;
        this.tickLabelOffset = 10;
        this.tickLabelPaddingRight = 10;
        this.tickFontSize = 15;  // in pixels
        this.minorsPerMajor = 5;
        this.minorTickLength = 5;
        this.minorTickWidth = 1;
        this.maxTicksPerRange = 7;
        this.backgroundCornerRad = 5;
        this.valueFontSize = 20;
        this.valueOffset = this.markerSideWidth + 10;
        
        this.showValue = false;
    },

    // override
    renderGauge: function($super) {
        var tickValues = this.calculateTickValues(this.ranges[0], this.ranges[this.ranges.length - 1], this.maxTicksPerRange);
        $super();
        this.bandOffsetX = (this.style === 'minimal') ? 0 : 15;
        this.drawBackground(tickValues);
        if(this.showRangeBand) {
            this.drawBand();
        }
        this.drawTicks(tickValues);
        this.drawMarker(this.value);
        this.checkOutOfRange(this.value);
    },

    checkOutOfRange: function(val) {
        var totalRange, wobbleCenter, wobbleRange;
        if(val < this.ranges[0]) {
            totalRange = this.ranges[this.ranges.length - 1] - this.ranges[0];
            wobbleRange = totalRange * 0.01;
            wobbleCenter = this.ranges[0] + wobbleRange;
            this.wobble(wobbleCenter, wobbleRange, this.drawMarker.bind(this));
        }
        else if(val > this.ranges[this.ranges.length - 1]) {
            totalRange = this.ranges[this.ranges.length - 1] - this.ranges[0];
            wobbleRange = totalRange * 0.01;
            wobbleCenter = this.ranges[this.ranges.length - 1] - wobbleRange;
            this.wobble(wobbleCenter, wobbleRange, this.drawMarker.bind(this));
        }
    }
    
});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.VerticalMarkerGauge


Splunk.HCBridge.VerticalMarkerGauge = $.klass(Splunk.HCBridge.AbstractMarkerGauge, {
    
    // override
    initialize: function($super, container) {
        $super(container);
        this.backgroundWidth = 100;
        this.verticalPadding = 20;
    },

    // override
    updateValue: function(oldValue, newValue) {
        if(this.adjustedValueToHeight(oldValue) != this.adjustedValueToHeight(newValue)) {
            clearInterval(this.wobbleInterval);
            this.animateTransition(oldValue, newValue, this.drawMarker.bind(this),
                    this.checkOutOfRange.bind(this));
        }
    },
    
    drawBackground: function(tickValues) {
        this.backgroundHeight = this.height - (2 * this.verticalPadding);
        this.bandHeight = this.backgroundHeight - (this.bandOffsetBottom + this.bandOffsetTop);
        this.bandWidth = (this.style === 'minimal') ? 30 : 10;

        var maxLabelWidth, totalWidthNeeded,
            maxTickValue = tickValues[tickValues.length - 1];

        maxLabelWidth = this.predictTextWidth(Highcharts.numberFormat(maxTickValue), this.tickFontSize);
        totalWidthNeeded = this.bandOffsetX + this.bandWidth + this.tickOffset + this.tickLength + this.tickLabelOffset
                + maxLabelWidth + this.tickLabelPaddingRight;
        this.backgroundWidth = Math.max(this.backgroundWidth, totalWidthNeeded);
        
        if(this.style !== 'minimal') {
            this.elements.background = this.renderer.rect((this.width - this.backgroundWidth) / 2,
                    this.verticalPadding, this.backgroundWidth, this.backgroundHeight,
                    this.backgroundCornerRad)
                .attr({
                    fill: '#edede7',
                    stroke: 'silver',
                    'stroke-width': 1
                })
                .add();
        }
    },

    drawBand: function() {
        var i, startHeight, endHeight,
            bandLeftX = ((this.width - this.backgroundWidth) / 2) + this.bandOffsetX,
            bandBottomY = this.height - this.verticalPadding - this.bandOffsetBottom;

        for(i = 0; i < this.ranges.length - 1; i++) {
            startHeight = this.valueToHeight(this.ranges[i]);
            endHeight = this.valueToHeight(this.ranges[i + 1]);
            this.elements['colorBand' + i] = this.renderer.rect(
                    bandLeftX, bandBottomY - endHeight,
                    this.bandWidth, endHeight - startHeight, this.bandCornerRad
                )
                .attr({
                    fill: Splunk.HCBridge.Utils.colorFromHex(this.colorPalette.getColor(null, i, this.ranges.length - 1))
                })
                .add();
        }
    },

    drawTicks: function(tickValues) {
        var i, loopHeight, loopValue,
            tickStartX = (this.width - this.backgroundWidth) / 2 + (this.bandOffsetX + this.bandWidth)
                            + this.tickOffset,
            tickEndX = tickStartX + this.tickLength,
            labelStartX = tickEndX + this.tickLabelOffset;

        for(i = 0; i < tickValues.length; i++) {
            loopHeight = this.verticalPadding + this.backgroundHeight - (this.bandOffsetBottom
                            + this.valueToHeight(tickValues[i]));
            if(this.showMajorTicks) {
                this.elements['tickMark' + i] = this.renderer.path([
                    'M', tickStartX, loopHeight,
                    'L', tickEndX, loopHeight
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.tickWidth
                })
                .add();
            }
            if(this.showLabels) {
                loopValue = (this.usePercentageRange) ? ((tickValues[i] - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])) : tickValues[i];
                this.elements['tickLabel' + i] = this.renderer.text(
                    loopValue + (this.usePercentageRange ? '%' : ''),
                    labelStartX, loopHeight + (this.tickFontSize / 4)
                )
                .attr({
                    align: 'left'
                })
                .css({
                    color: this.tickColor,
                    fontSize: this.tickFontSize + 'px'
                })
                .add();
            }
        }
        if(this.showMinorTicks) {
            this.drawMinorTicks(tickValues, tickStartX);
        }
    },

    drawMinorTicks: function(majorValues, startX) {
        var loopValue, loopHeight,
            majorInterval = majorValues[1] - majorValues[0],
            minorInterval = majorInterval / this.minorsPerMajor,
            startValue = this.ranges[0];

            // start at the next minor tick after the first range value
            if(!(this.usePercentageRange) && startValue % minorInterval > 0) {
                startValue = this.ranges[0] - (this.ranges[0] % minorInterval) + minorInterval;
            }

        for(loopValue = startValue; loopValue <= this.ranges[this.ranges.length - 1]; loopValue += minorInterval) {
            if(majorValues.indexOf(loopValue) < 0) {
                loopHeight = this.verticalPadding + this.backgroundHeight -
                        (this.bandOffsetBottom + this.valueToHeight(loopValue));
                this.elements['minorTickMark' + loopValue] = this.renderer.path([
                    'M', startX, loopHeight,
                    'L', startX + this.minorTickLength, loopHeight
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.minorTickWidth
                })
                .add();
            }
        }
    },

    drawMarker: function(val) {
        var markerHeight = this.adjustedValueToHeight(val),
            markerStartY = this.verticalPadding + this.backgroundHeight
                            - (this.bandOffsetBottom + markerHeight),
            markerStartX = (this.style === 'minimal') ? (this.width - this.backgroundWidth) / 2 - 10 : (this.width - this.backgroundWidth) / 2,
            markerEndX = (this.style === 'minimal') ? markerStartX + this.bandWidth + 20 : markerStartX + this.backgroundWidth,
            markerLineStroke = 'black', // will be changed to red for shiny
            markerLineWidth = 3, // wil be changed to 1 for shiny
            markerLinePath = [
                'M', markerStartX, markerStartY,
                'L', markerEndX, markerStartY
            ];
        if(this.style !== 'minimal') {
            var markerLHSPath = [
                'M', markerStartX,
                        markerStartY - this.markerWindowHeight / 2,
                'L', markerStartX - (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY - this.markerWindowHeight / 2,
                'C', markerStartX - (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY - this.markerWindowHeight / 2,
                     markerStartX - this.markerSideWidth,
                        markerStartY - this.markerWindowHeight / 2,
                     markerStartX - this.markerSideWidth,
                        markerStartY - (this.markerWindowHeight / 2) + this.markerSideCornerRad,
                'L', markerStartX - this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                'C', markerStartX - this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                     markerStartX - this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2),
                     markerStartX - (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY + (this.markerWindowHeight / 2),
                'L', markerStartX,
                        markerStartY + this.markerWindowHeight / 2,
                     markerStartX,
                        markerStartY - this.markerWindowHeight / 2
            ],
            markerRHSPath = [
                'M', markerEndX,
                        markerStartY - this.markerWindowHeight / 2,
                'L', markerEndX + (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY - this.markerWindowHeight / 2,
                'C', markerEndX + (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY - this.markerWindowHeight / 2,
                     markerEndX + this.markerSideWidth,
                        markerStartY - this.markerWindowHeight / 2,
                     markerEndX + this.markerSideWidth,
                        markerStartY - (this.markerWindowHeight / 2) + this.markerSideCornerRad,
                'L', markerEndX + this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                'C', markerEndX + this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                     markerEndX + this.markerSideWidth,
                        markerStartY + (this.markerWindowHeight / 2),
                     markerEndX + (this.markerSideWidth - this.markerSideCornerRad),
                        markerStartY + (this.markerWindowHeight / 2),
                'L', markerEndX,
                        markerStartY + this.markerWindowHeight / 2,
                     markerEndX,
                        markerStartY - this.markerWindowHeight / 2
            ],
            markerBorderPath = [
                'M', markerStartX,
                        markerStartY - this.markerWindowHeight / 2,
                'L', markerEndX,
                        markerStartY - this.markerWindowHeight / 2,
                     markerEndX,
                        markerStartY + this.markerWindowHeight / 2,
                     markerStartX,
                        markerStartY + this.markerWindowHeight / 2,
                     markerStartX,
                        markerStartY - this.markerWindowHeight / 2,
                'M', markerStartX,
                        markerStartY + 1,
                'L', markerEndX,
                        markerStartY + 1
            ];
            markerLineStroke = 'red';
            markerLineWidth = 1;
        }

        if(this.style !== 'minimal') {
            if(this.elements.markerLHS) {
                this.elements.markerLHS.attr({d: markerLHSPath});
            }
            else {
                this.elements.markerLHS = this.renderer.path(markerLHSPath)
                .attr({
                    fill: '#cccccc'
                })
                .add();
            }
            if(this.elements.markerRHS) {
                this.elements.markerRHS.attr({d: markerRHSPath});
            }
            else {
                this.elements.markerRHS = this.renderer.path(markerRHSPath)
                .attr({
                    fill: '#cccccc'
                })
                .add();
            }
            if(this.elements.markerWindow) {
                this.elements.markerWindow.attr({
                    y: markerStartY - this.markerWindowHeight / 2
                });
            }
            else {
                this.elements.markerWindow = this.renderer.rect(markerStartX,
                        markerStartY - this.markerWindowHeight / 2, this.backgroundWidth,
                                this.markerWindowHeight, 0)
                    .attr({
                        fill: 'rgba(255, 255, 255, 0.3)'
                    })
                    .add();
            }
            if(this.elements.markerBorder) {
                this.elements.markerBorder.attr({d: markerBorderPath});
            }
            else {
                this.elements.markerBorder = this.renderer.path(markerBorderPath)
                .attr({
                    stroke: 'white',
                    'stroke-width': 2
                })
                .add();
            }
        }
        if(this.elements.markerLine) {
            this.elements.markerLine.attr({d: markerLinePath});
        }
        else {
            this.elements.markerLine = this.renderer.path(markerLinePath)
            .attr({
                stroke: markerLineStroke,
                'stroke-width': markerLineWidth
            })
            .add();
        }
        if(this.showValue) {
            this.drawValueDisplay(val);
        }

    },
    
    drawValueDisplay: function(val) {
        var valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((this.value - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
                            Highcharts.numberFormat(this.value, 0),
            markerHeight = this.adjustedValueToHeight(val),
            valueY = this.verticalPadding + this.backgroundHeight - this.bandOffsetBottom - markerHeight;
        
        if(this.elements.valueDisplay) {
            this.elements.valueDisplay.attr({
                text: valueText,
                y: valueY + this.valueFontSize / 4
            });
        }
        else {
            this.elements.valueDisplay = this.renderer.text(
                 valueText, (this.width - this.backgroundWidth) / 2 - this.valueOffset, valueY + this.valueFontSize / 4
            )
            .css({
                color: 'black',
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            })
            .attr({
                align: 'right'
            })
            .add();
        }
        
    },

    adjustedValueToHeight: function(val) {
        if(val < this.ranges[0]) {
            return 0;
        }
        if(val > this.ranges[this.ranges.length - 1]) {
            return this.valueToHeight(this.ranges[this.ranges.length - 1]);
        }
        return this.valueToHeight(val);
    },

    valueToHeight: function(val) {
        var dataRange = this.ranges[this.ranges.length - 1] - this.ranges[0],
            normalizedValue = val - this.ranges[0];

        return Math.round((normalizedValue / dataRange) * this.bandHeight);
    }

});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.HorizontalMarkerGauge


Splunk.HCBridge.HorizontalMarkerGauge = $.klass(Splunk.HCBridge.AbstractMarkerGauge, {
    
    // override
    initialize: function($super, container) {
        $super(container);
        this.backgroundHeight = 75;
        this.horizontalPadding = 20;
    },

    // override
    updateValue: function(oldValue, newValue) {
        if(this.adjustedValueToOffset(oldValue) != this.adjustedValueToOffset(newValue)) {
            clearInterval(this.wobbleInterval);
            this.animateTransition(oldValue, newValue, this.drawMarker.bind(this),
                    this.checkOutOfRange.bind(this));
        }
    },
    
    drawBackground: function(tickValues) {
        this.backgroundWidth = this.width - (2 * this.horizontalPadding);
        this.bandWidth = this.backgroundWidth - (this.bandOffsetBottom + this.bandOffsetTop);
        this.bandHeight = (this.style === 'minimal') ? 30 : 10;

        if(this.style !== 'minimal') {
            this.elements.background = this.renderer.rect(this.horizontalPadding,
                    (this.height - this.backgroundHeight) / 2, this.backgroundWidth, this.backgroundHeight,
                    this.backgroundCornerRad)
                .attr({
                    fill: '#edede7',
                    stroke: 'silver',
                    'stroke-width': 1
                })
                .add();
        }
    },

    drawBand: function() {
        var i, startOffset, endOffset,
            bandStartX = this.horizontalPadding + this.bandOffsetBottom,
            bandTopY = ((this.height - this.backgroundHeight) / 2) + this.bandOffsetX;

        for(i = 0; i < this.ranges.length - 1; i++) {
            startOffset = this.valueToOffset(this.ranges[i]);
            endOffset = this.valueToOffset(this.ranges[i + 1]);
            this.elements['colorBand' + i] = this.renderer.rect(
                    bandStartX + startOffset, bandTopY,
                    endOffset - startOffset, this.bandHeight, this.bandCornerRad
                )
                .attr({
                    fill: Splunk.HCBridge.Utils.colorFromHex(this.colorPalette.getColor(null, i, this.ranges.length - 1))
                })
                .add();
        }
    },

    drawTicks: function(tickValues) {
        var i, loopOffset, loopValue,
            tickStartY = (this.height - this.backgroundHeight) / 2 + (this.bandOffsetX + this.bandHeight)
                            + this.tickOffset,
            tickEndY = tickStartY + this.tickLength,
            labelStartY = tickEndY + this.tickLabelOffset;
    
        for(i = 0; i < tickValues.length; i++) {
            loopOffset = this.horizontalPadding + this.bandOffsetBottom + this.valueToOffset(tickValues[i]);
            if(this.showMajorTicks) {
                this.elements['tickMark' + i] = this.renderer.path([
                    'M', loopOffset, tickStartY,
                    'L', loopOffset, tickEndY
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.tickWidth
                })
                .add();
            }
            if(this.showLabels) {
                loopValue = (this.usePercentageRange) ? ((tickValues[i] - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])) : tickValues[i];
                this.elements['tickLabel' + i] = this.renderer.text(
                    loopValue + ((this.usePercentageRange ? '%' : '')),
                    loopOffset, labelStartY + this.tickFontSize / 4
                )
                .attr({
                    align: 'center'
                })
                .css({
                    color: this.tickColor,
                    fontSize: this.tickFontSize + 'px'
                })
                .add();
            }
        }
        if(this.showMinorTicks) {
            this.drawMinorTicks(tickValues, tickStartY);
        }
    },

    drawMinorTicks: function(majorValues, startY) {
        var loopValue, loopOffset,
            majorInterval = majorValues[1] - majorValues[0],
            minorInterval = majorInterval / this.minorsPerMajor,
            startValue = this.ranges[0];
        
        // start at the next minor tick after the first range value
        if(!(this.usePercentageRange) && startValue % minorInterval > 0) {
            startValue = this.ranges[0] - (this.ranges[0] % minorInterval) + minorInterval;
        }
    
        for(loopValue = startValue; loopValue <= this.ranges[this.ranges.length - 1]; loopValue += minorInterval) {
            if(majorValues.indexOf(loopValue) < 0) {
                loopOffset = this.horizontalPadding + this.bandOffsetBottom + this.valueToOffset(loopValue);
                //alert(loopValue + ' --> ' + loopOffset);
                this.elements['minorTickMark' + loopValue] = this.renderer.path([
                    'M', loopOffset, startY,
                    'L', loopOffset, startY + this.minorTickLength
                ])
                .attr({
                    stroke: this.tickColor,
                    'stroke-width': this.minorTickWidth
                })
                .add();
            }
        }
    },

    drawMarker: function(val) {
        var markerOffset = this.adjustedValueToOffset(val),
            markerStartY = (this.style === 'minimal') ? (this.height - this.backgroundHeight) / 2 - 10 : (this.height - this.backgroundHeight) / 2,
            markerEndY = (this.style === 'minimal') ? markerStartY + this.bandHeight + 20 : markerStartY + this.backgroundHeight,
            markerStartX = this.horizontalPadding + this.bandOffsetBottom + markerOffset,
            markerLineWidth = 3, // set to 1 for shiny
            markerLineStroke = 'black', // set to red for shiny
            markerLinePath = [
                'M', markerStartX, markerStartY,
                'L', markerStartX, markerEndY
            ];
            
        if(this.style !== 'minimal') {
            var markerLHSPath = [
                'M', markerStartX - this.markerWindowHeight / 2,
                        markerStartY,
                'L', markerStartX - this.markerWindowHeight / 2,
                        markerStartY  - (this.markerSideWidth - this.markerSideCornerRad),
                'C', markerStartX - this.markerWindowHeight / 2,
                        markerStartY  - (this.markerSideWidth - this.markerSideCornerRad),
                     markerStartX - this.markerWindowHeight / 2,
                        markerStartY - this.markerSideWidth,
                     markerStartX - (this.markerWindowHeight / 2) + this.markerSideCornerRad,
                        markerStartY - this.markerSideWidth,
                'L', markerStartX + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                        markerStartY - this.markerSideWidth,
                'C', markerStartX + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                        markerStartY - this.markerSideWidth,
                     markerStartX + (this.markerWindowHeight / 2),
                        markerStartY - this.markerSideWidth,
                     markerStartX + (this.markerWindowHeight / 2),
                        markerStartY - (this.markerSideWidth - this.markerSideCornerRad),
                'L', markerStartX + this.markerWindowHeight / 2,
                        markerStartY,
                     markerStartX - this.markerWindowHeight,
                        markerStartY
            ],
            markerRHSPath = [
                'M', markerStartX - this.markerWindowHeight / 2,
                        markerEndY,
                'L', markerStartX - this.markerWindowHeight / 2,
                        markerEndY + (this.markerSideWidth - this.markerSideCornerRad),
                'C', markerStartX - this.markerWindowHeight / 2,
                        markerEndY + (this.markerSideWidth - this.markerSideCornerRad),
                     markerStartX - this.markerWindowHeight / 2,
                        markerEndY + this.markerSideWidth,
                     markerStartX - (this.markerWindowHeight / 2) + this.markerSideCornerRad,
                        markerEndY + this.markerSideWidth,
                'L', markerStartX + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                        markerEndY + this.markerSideWidth,
                'C', markerStartX + (this.markerWindowHeight / 2) - this.markerSideCornerRad,
                        markerEndY + this.markerSideWidth,
                     markerStartX + (this.markerWindowHeight / 2),
                         markerEndY + this.markerSideWidth,
                     markerStartX + (this.markerWindowHeight / 2),
                         markerEndY + (this.markerSideWidth - this.markerSideCornerRad),
                'L', markerStartX + this.markerWindowHeight / 2,
                        markerEndY,
                     markerStartX - this.markerWindowHeight,
                        markerEndY
            ],
            markerBorderPath = [
                'M', markerStartX - this.markerWindowHeight / 2,
                        markerStartY,
                'L', markerStartX - this.markerWindowHeight / 2,
                        markerEndY,
                     markerStartX + this.markerWindowHeight / 2,
                        markerEndY,
                     markerStartX + this.markerWindowHeight / 2,
                        markerStartY,
                     markerStartX - this.markerWindowHeight / 2,
                        markerStartY,
                'M', markerStartX - 1,
                        markerStartY,
                'L', markerStartX - 1,
                        markerEndY
            ];
            markerLineStroke = 'red';
            markerLineWidth = 1;

            if(this.elements.markerLHS) {
                this.elements.markerLHS.attr({d: markerLHSPath});
            }
            else {
                this.elements.markerLHS = this.renderer.path(markerLHSPath)
                .attr({
                    fill: '#cccccc'
                })
                .add();
            }
            if(this.elements.markerRHS) {
                this.elements.markerRHS.attr({d: markerRHSPath});
            }
            else {
                this.elements.markerRHS = this.renderer.path(markerRHSPath)
                .attr({
                    fill: '#cccccc'
                })
                .add();
            }
            if(this.elements.markerWindow) {
                this.elements.markerWindow.attr({
                    x: markerStartX - this.markerWindowHeight / 2
                });
            }
            else {
                this.elements.markerWindow = this.renderer.rect(markerStartX - this.markerWindowHeight / 2,
                        markerStartY, this.markerWindowHeight, this.backgroundHeight, 0)
                    .attr({
                        fill: 'rgba(255, 255, 255, 0.3)'
                    })
                    .add();
            }
            if(this.elements.markerBorder) {
                this.elements.markerBorder.attr({d: markerBorderPath});
            }
            else {
                this.elements.markerBorder = this.renderer.path(markerBorderPath)
                .attr({
                    stroke: 'white',
                    'stroke-width': 2
                })
                .add();
            }
        }
        
        if(this.elements.markerLine) {
            this.elements.markerLine.attr({d: markerLinePath});
        }
        else {
            this.elements.markerLine = this.renderer.path(markerLinePath)
            .attr({
                stroke: markerLineStroke,
                'stroke-width': markerLineWidth
            })
            .add();
        }
        if(this.showValue) {
            this.drawValueDisplay(val);
        }
    },
    
    drawValueDisplay: function(val) {
        var valueText = (this.usePercentageValue) ?  Highcharts.numberFormat(((this.value - this.ranges[0]) * 100 / (this.ranges[this.ranges.length - 1] - this.ranges[0])), 2) + '%' : 
                            Highcharts.numberFormat(this.value, 0),
            markerOffset = this.adjustedValueToOffset(val),
            valueX = this.horizontalPadding + this.bandOffsetBottom + markerOffset;
        
        if(this.elements.valueDisplay) {
            this.elements.valueDisplay.attr({
                text: valueText,
                x: valueX
            });
        }
        else {
            this.elements.valueDisplay = this.renderer.text(
                 valueText, valueX, (this.height - this.backgroundHeight) / 2 - this.valueOffset
            )
            .css({
                color: 'black',
                fontSize: this.valueFontSize + 'px',
                fontWeight: 'bold'
            })
            .attr({
                align: 'center'
            })
            .add();
        }
        
    },

    adjustedValueToOffset: function(val) {
        if(val < this.ranges[0]) {
            return 0;
        }
        if(val > this.ranges[this.ranges.length - 1]) {
            return this.valueToOffset(this.ranges[this.ranges.length - 1]);
        }
        return this.valueToOffset(val);
    },

    valueToOffset: function(val) {
        var dataRange = this.ranges[this.ranges.length - 1] - this.ranges[0],
            normalizedValue = val - this.ranges[0];

        return Math.round((normalizedValue / dataRange) * this.bandWidth);
    }
    
});


////////////////////////////////////////////////////////////////////////////////
// Splunk.HCBridge.Utils


Splunk.HCBridge.Utils = (function() {

    // CSS manipulation code from http://rule52.com/2008/06/css-rule-page-load/

    var headElement = document.getElementsByTagName("head")[0],
        styleElement = document.createElement("style");

    styleElement.type = "text/css";
    headElement.appendChild(styleElement);

    return {

        // memoize the browser-dependent add function
        addCssRule: (function() {
            // IE doesn't allow you to append text nodes to <style> elements
            if(styleElement.styleSheet) {
                return function(selector, rule) {
                    if(styleElement.styleSheet.cssText == '') {
                        styleElement.styleSheet.cssText = '';
                    }
                    styleElement.styleSheet.cssText += selector + " { " + rule + " }";
                }
            }
            else {
                return function(selector, rule) {
                    styleElement.appendChild(document.createTextNode(selector + " { " + rule + " }"));
                }
            }
        })(),

        // memoized remove function
        removeAllCssRules: (function() {
            // IE doesn't allow you to append text nodes to <style> elements
            if(styleElement.styleSheet) {
                return function() {
                    styleElement.styleSheet.cssText = "";
                }
            }
            else {
                return function() {
                    $(styleElement).empty();
                }
            }
        })(),

        resolveStaticURL: function(url) {
            var hadTrailingSlash = (url.charAt(url.length - 1) == "/");
            url = Splunk.util.make_url(url);
            var hasTrailingSlash = (url.charAt(url.length - 1) == "/");
            if (hasTrailingSlash != hadTrailingSlash) {
                url = hadTrailingSlash ? url + "/" : url.substring(0, url.length - 1);
            }
            return url;
        },

        logBaseTen: function(num) {
            return Math.log(num) / Math.LN10;
        },

        absLogBaseTen: function(num) {
            var log10 = Splunk.HCBridge.Utils.logBaseTen,
                isNegative = (num < 0),
                result;

            if(isNegative) {
                num = -num;
            }
            if(num < 10) {
                num += (10 - num) / 10;
            }
            result = log10(num);
            return (isNegative) ? -result : result;
        },

        absPowerTen: function(num) {
            var isNegative = (num < 0),
                result;

            if(isNegative) {
                num = -num;
            }
            result = Math.pow(10, num);
            if(result < 10) {
                result = 10 * (result - 1) / (10 - 1);
            }
            return (isNegative) ? -result : result;
        },

        // calculates the power of ten that is closest to but not greater than the number
        nearestPowerOfTen: function(num) {
            var log = this.logBaseTen(num);
            return Math.pow(10, Math.floor(log));
        },

        floatOrNull: function(numString) {
            var parsed = parseFloat(numString, 10);
            return isNaN(parsed) ? null : parsed;
        },

        extractFieldInfo: function(rawData) {
            var i, loopField, xAxisKey, xAxisSeriesIndex, spanSeriesIndex,
                xAxisKeyFound = false,
                fieldNames = [];

            for(i = 0; i < rawData.series.length; i++) {
                loopField = rawData.series[i].field;
                if(loopField == '_span') {
                    spanSeriesIndex = i;
                    continue;
                }
                if(loopField.charAt(0) == '_' && loopField != "_time") {
                    continue;
                }
                if(!xAxisKeyFound) {
                    xAxisKey = loopField;
                    xAxisSeriesIndex = i;
                    xAxisKeyFound = true;
                }
                else {
                    fieldNames.push(loopField);
                }
            }
            return {
                fieldNames: fieldNames,
                xAxisKey: xAxisKey,
                xAxisSeriesIndex: xAxisSeriesIndex,
                spanSeriesIndex: spanSeriesIndex
            }
        },

        colorFromHex: function(hexNum) {
            var r = (hexNum & 0xff0000) >> 16,
                g = (hexNum & 0x00ff00) >> 8,
                b = hexNum & 0x0000ff;

            return "rgb(" + r + "," + g + "," + b + ")";
        }
    };

})();
