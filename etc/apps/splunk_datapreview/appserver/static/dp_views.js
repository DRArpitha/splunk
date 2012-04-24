Splunk.namespace("Splunk.preview");


//
// main preview event view renderer
//

Splunk.preview.EventView = function() {
    this.context = ".previewEvents tbody";
    this._throbber = $('.eventsLoader');
    this._nextEvent = $('.eventTooltip');
};
Splunk.preview.EventView.prototype = {

    render: function(events) {
        $(this.context).empty();
    
        var tbody = $(this.context);
        $.each(events, $.proxy(function(idx, evt) {

            var raw = evt.get('raw');
            var start = evt.get('time_extract_start');
            var end = evt.get('time_extract_end');
            var rawFragment = Splunk.util.escapeHtml(raw.substring(0, start))
                + '<span class="tex">' + Splunk.util.escapeHtml(raw.substring(start, end))
                + '</span>' + Splunk.util.escapeHtml(raw.substring(end));
            
            var time = 'n/a';
            if (evt.get('time')) {
                time = format_datetime_microseconds(evt.get('time'));
            }
            
            //time = time.replace(/(\d{1,2}\/\d{1,2}\/\d{2})/g, '<span>$1</span>');
            
            var gutterColumn = $('<td/>').text(idx+1).addClass('idx');
            if (evt.get('messages').length) {
                var msglist = $('<ul/>');
                $.each(evt.get('messages'), function(ix, msg) {
                    if (msg.text.length) {
                        $('<li/>').text(Splunk.util.escapeHtml(msg.text)).appendTo(msglist);
                    }
                });
                gutterColumn.html(
                    (idx+1)
                    + '<span class="warning-icon" title="'
                    + $('<div/>').append(msglist).html()
                    + '">&nbsp;</span>' 
                );
                this.setWarningClass();
            }
            var row = $('<tr/>')
                .append(gutterColumn)
                .append($('<td/>').text(time).addClass('time'))
                .append($('<td/>').html('<pre>' + rawFragment + '</pre>').addClass('raw'));
            row.appendTo(tbody);
        }, this));
        $('span.warning-icon', tbody).tipTip({
            delay: 0,
            fadeIn: 0,
            maxWidth: '500px'
        });
        
        var updateTooltip = $.proxy(function() {
            if ($('.previewEvents tr').eq(1).position().top + $('.previewEvents tr').eq(1).height() > $('.previewEvents').height()) {
                this.showTooltip();
            } else {
                this.hideTooltip();
            }
        },this);
        
        updateTooltip();
        $('.previewEvents').scroll(updateTooltip);
        
        $('#nextEvent').click($.proxy(function(e) {
            $('.previewEvents').scrollTop($('.previewEvents').scrollTop()+$('.previewEvents tr').eq(2).position().top);
        },this));

        setPreviewHeight();
        $(window).resize(setPreviewHeight);
    },
    
    setWarningClass: function() {
        var $previewEvents = $('.previewEvents');
        if ( !$previewEvents.hasClass('has_warnings') ) {
            $previewEvents.addClass('has_warnings');
        }
    },
    
    clear: function() {
        $(this.context).empty();
    },
    
    showThrobber: function() {
        this._throbber.show();
        // prevent event from firing multiple times
        $('.previewSettingsActions a').bind('click', this.disableLink);
    },

    clearThrobber: function() {
        this._throbber.hide();
        // restore links
        $('.previewSettingsActions a').unbind('click', this.disableLink);        
        this.setProgress(0);
    },
    
    showTooltip: function() {
        this._nextEvent.show();
    },
    
    hideTooltip: function() {
        this._nextEvent.hide();
    },

    setProgress: function(percentage) {
        percentage = parseFloat(percentage);
        this._throbber.text(format_percent(percentage));
    },

    disableLink: function(e) {
        // cancels the event
        e.preventDefault();
        return false;
    }
    
};



//
// Sidebar job metadata renderer
//

Splunk.preview.MetadataView = function() {
    this.context = ".previewMetadata #metadata_body";
};
Splunk.preview.MetadataView.prototype =  {

    render: function(results) {
        
        //
        // render the timeline
        //

        var timeline_data = [];
        var timeline_dates = [];
        var max_count = 0;
        var earliestTime = results.buckets[0].earliest_time;
        var latestTime = results.buckets[results.buckets.length-1].earliest_time;
        
        $.each(results.buckets, function(idx, bucket) {
            timeline_data.push((bucket.total_count == 0 ? null : bucket.total_count));
            timeline_dates.push(format_datetime_microseconds(bucket.earliest_time, 'short'));
            max_count = Math.max(max_count, bucket.total_count);
        });
        
        if (parseInt(results.buckets[0].duration,10) >= 2419200) {
            // buckets longer than a month should only display month and year
            earliestTime = format_date(earliestTime, 'M/yyyy');
            latestTime = format_date(latestTime, 'M/yyyy');
        }
        else {
            earliestTime = format_datetime(earliestTime, 'short');
            latestTime = format_datetime(latestTime, 'short');
        }
        
        this.chart = new Highcharts.Chart({
            chart: {
                renderTo: 'chart_container',
                type: 'column',
                height: 75,
                animation: false,
                spacingTop: 10,
                spacingRight: 5,
                spacingBottom: 10,
                spacingLeft: 1,
                backgroundColor: '#edede7'
            },
            credits: {
                enabled: false
            },
            title: {
                text: null
            },
            legend: {
                enabled: false
            },
            plotOptions: {
                column: {
                    animation: false,
                    shadow: false,
                    groupPadding: 0,
                    pointPadding: 0,
                    borderWidth: 0,
                    minPointLength: 2
                }
            },
            xAxis: {
                title: null,
                categories: timeline_dates,
                labels: {enabled: false},
                lineWidth: 1,
                lineColor: '#999'
            },
            yAxis: {
                title: null,
                gridLineWidth: 0,
                lineWidth: 1,
                lineColor: '#999',
                /* tickPixelInterval: 200, */
                max: max_count,
                labels: {
                    style: {
                        fontSize: '9px',
                        color: '#333'
                    }
                }
            },
            tooltip: {
                borderWidth: 1,
                formatter: function() {
                    return (this.x + ": <b>" + this.y + "</b>");
                },
                style: {
                    padding: '3px'
                }
            },
            series: [{
                name: 'Event count',
                data: timeline_data
            }],
            colors: [
                {linearGradient: [0, 0, 0, 500], stops: [[0, '#6FAA1A'],[1, '#447800']]}
            ]
        });

        $('#chart_range')
            .append($('<span/>').text(earliestTime).addClass('start_time'))
            .append($('<span/>').text(latestTime).addClass('end_time'));


        //
        // render stats
        //

        $('#stats_num_events').text(format_number(results.stats.count));
        $('#stats_total_bytes').text(format_number(results.file.size));
        $('#stats_bytes_read').text(format_number(results.file.read));

        if (!results.file.isComplete) {
            var note;
            if (results.file.isCompressed) {
                note = _('Only a portion of your compressed file used for preview.');
            } else {
                note = sprintf(
                    _('Only the first %sB used for preview.'),
                   results.file.read
                );
            }
            $('#preview_truncate_note').text(note).show();

        } else {
            $('#preview_truncate_note').hide();
        
        }
        
        
        //
        // render linecount table
        //

        var linecounts = $('#metadata_linecounts').html('');
        $.each(results.stats.linecount_table, function(idx, row) {
            linecounts.append($('<tr/>')
                .append($('<td/>').text(format_number(row[0])))
                .append($('<td/>').text(format_number(row[1]) + ' (' + format_percent(row[2]) + ')'))
            );
        });

    },
    
    clear: function() {
       this.clearThrobber();
        if (this.chart && this.chart.destroy) {
            this.chart.destroy();
        }
        $('#chart_range').html('');
        $('#stats_num_events').text('');
        $('#stats_total_bytes').text('');
        $('#stats_bytes_read').text('');
        $('#metadata_linecounts').html('');
        $('#preview_truncate_note').html('').hide();
    },
    
    showThrobber: function() {
        $('.metaLoader').show();
    },

    clearThrobber: function() {
        $('.metaLoader').hide();
    }


};



//
// props.conf configurator
//

Splunk.preview.ConfigurationView = function() {
    this.context = ".previewConfig";
    this.settingsShown = false;
    this.advancedMode = false;
    this.simpleFormData = null;
    this.advancedFormData = null;
    this._inheritedText = '';
};
Splunk.preview.ConfigurationView.prototype = {

    render: function(tz_data) {
        // initialize tabs
        function switch_tabs(obj) {
            $('.tab-content').hide();
            $('.tabs a').removeClass("selected");
        
            $('#'+obj.attr('rel')).show();
            obj.addClass("selected");        
        };
        $('.tabs a').click($.proxy(function(evt){
            switch_tabs($(evt.target));
            this.advancedMode = (evt.target.rel == 'tab_advanced');
        }, this));
        switch_tabs($('.defaulttab'));
        
        // handler for the line-breaking switcher
        $('input[name=lb_type]').change(function(){
            if ( $(this).val() == 'regex' ) {
                $('#lb_line_breaker').prop('disabled', false);
            } else {
                $('#lb_line_breaker').prop('disabled', true);

            }
        }); 
        
        $('input[name=ts_type]').change(function(){
            switch ($(this).val()) {
                case '':
                    $('#ts_time_prefix').prop('disabled', true);
                    $('#ts_max_lookahead_into').prop('disabled', true);
                    break;
                case 'pre_pattern':
                    $('#ts_time_prefix').prop('disabled', false);
                    $('#ts_max_lookahead_into').prop('disabled', true);
                    break;
                case 'never_more_into':
                    $('#ts_time_prefix').prop('disabled', true);
                    $('#ts_max_lookahead_into').prop('disabled', false);
                    break;
                
                default:
                    break;
            }
        });
        
        $('input#ts_prefaced_past').click(function() {
            if ($('input#ts_prefaced_past').is(':checked')) {
                $('input#ts_max_lookahead_past').prop('disabled', false);
            } else {
                $('input#ts_max_lookahead_past').prop('disabled', true);
            }
        });
        
        $('input#change_timezone').click(function() {
            if ($('input#change_timezone').is(':checked')) {
                $('#ts_tz').prop('disabled', false);
            } else {
                $('#ts_tz').prop('disabled', true);
            }
        });
        
        $('input#change_time_format').click(function() {
            if ($('input#change_time_format').is(':checked')) {
                $('#ts_time_format').prop('disabled', false);
            } else {
                $('#ts_time_format').prop('disabled', true);
            }
        });
    
        $('#modify_settings_link').click($.proxy(function(){
            this.showSettings();
        },this));    
        
        $('#simple_config_form').unbind('keypress').bind('keypress', function(event){
            if(event.keyCode==13){
                ctrlr.handleApply(event);
            }
        });
        

    
    },
    
    getSimpleSettings: function() {
        return $("#simple_config_form").serializeArray();
    },
    
    getAdvancedSettings: function() {
        return $("#text_props_advanced").val();
    },
    
    resetSettings: function() {
        if (this.isAdvancedMode()) {
            $("#text_props_advanced").val('');
        } else {
            $('#simple_config_form')[0].reset();
            $('input:text,select', '#simple_config_form').prop('disabled', true);
        }
        this.updateSettings();
    },
    
    updateSettings: function() {
        this.advancedFormData = this.getAdvancedSettings();
        this.simpleFormData = this.getSimpleSettings();
    },
    
    settingsChanged: function() {
        return (
            this.advancedFormData != this.getAdvancedSettings()
            || !Splunk.util.objectSimilarity(this.simpleFormData, this.getSimpleSettings())
        );
    },
    
    hideVerify: function() {
        $('#settings_verifyMessage').hide();
    },
    
    showSettings: function() {
        this.hideVerify();
        this.settingsShown = true;
        $('#settings_layout').show();
        $('.preview').addClass('tabs_visible');
    },
    
    isSettingsShown: function() {
        return this.settingsShown;
    },
    
    isAdvancedMode: function() {
        return this.advancedMode;
    },
        
    // handles the initial set of properties determined by the preview backend
    loadProps: function(settings) {
        var rows = [];
        var k;

        var isFirst = true;
        for (k in settings.toSourcetypeSettings('explicit')) {
            if (isFirst) {
                rows.push(_('# your settings'));
                isFirst = false;
            }                
            var val = (settings.get(k) != null ? settings.get(k) : '');
            rows.push(k + '=' + val);
        }

        if (rows.length > 0) {
            rows.push('');
        }

        isFirst = true;
        for (k in settings.toSourcetypeSettings('preset')) {
            if (isFirst) {
                rows.push(_('# set by detected sourcetype'));
                isFirst = false;
            }                
            var val = (settings.get(k) != null ? settings.get(k) : '');
            rows.push(k + '=' + val);
        }

        $('#text_inherited_advanced').val(rows.join('\n'));
    },
    
    clear: function() {
        $(this.context).empty();
    }
};

//
// popup manager for initial sourcetype selection mode
//

Splunk.preview.SourcetypeModeView = function() {
    this.context = "#st_select_popup";
    this.radioset = "st_type";
    this.presets = "#st_type_preset";
    this.popupInstance = null;
    this.presetValues = [];
    this.autoSourcetype = null;
};
Splunk.preview.SourcetypeModeView.prototype = {

    render: function() {
        $('.errors', this.context).hide();

        this.popupInstance = new Splunk.Popup($(this.context), {
            title: _('Set source type'),
            pclass: 'set_st_popup',
            buttons: [
                {
                    label: _('Continue'),
                    type: 'primary',
                    callback: $.proxy(this.handleSubmit, this)
                }
            ]
        });

        var container = this.popupInstance.getPopup();
        $(document).unbind('keydown.Popup');
        
        // build the preset sourcetype list
        var select = $(this.presets, container);

        if (this.autoSourcetype) {
            select.append($('<option/>').val(this.autoSourcetype).text(this.autoSourcetype));
        }

        $.map(this.presetValues, function(item) {
            select.append($('<option/>').val(item).text(item));
        });
        select.bind('change', function() {
            $('#st_type_existing', container).prop('checked', true);
        });

        if (this.autoSourcetype) {
            
            // set the auto sourcetype, if any
            $('#st_type_auto_value', container).text(this.autoSourcetype);
            $('#st_type_auto', container).prop('checked', true);

        } else {
            
            $('#st_type_auto_wrapper', container).hide();
            $('#st_type_not_found_message', container).show();
            $('#st_type_new', container).prop('checked', true);

        }

        // SPL-44000 IE8 fix
        $('label', this.context).click($.proxy(function(e){ 
            e.preventDefault(); 
            $("#"+$(e.target).attr("for"), this.context).click().change();
        },this));
        
    },

    getSelectionValue: function() {
        return $('input[name=' + this.radioset + ']:checked', this.popupInstance.getPopup()).val();
    },

    getPresetValue: function() {
        return $(this.presets + ' option:selected').val();
    },

    handleSubmit: function(evt) {
        if (this.getSelectionValue() == "existing" && this.getPresetValue() == "")  {
            $('.errors', this.context).text(_('No existing sourcetypes selected.')).show();
            return false;
        }
        $(this).trigger('submit');
        this.close();
    },

    bind: function(evt, callback) {
        return $(this).bind(evt, callback);
    },
    
    close: function() {
        this.popupInstance.destroyPopup();
    }

};



//
// popup manager for sourcetype save dialog
//

Splunk.preview.SourcetypeConfirmView = function() {
    this.context = "#st_confirm_popup";
    this.popupInstance = null;
};
Splunk.preview.SourcetypeConfirmView.prototype = {

    render: function(settings, continue_to, return_to) {
        $('.errors', this.context).hide();        
        this.popupInstance = new Splunk.Popup($(this.context), {
            title: _('Review settings'),
            buttons: [
                {
                    label: _('Cancel'),
                    type: 'secondary',
                    callback: function() { 
                        return this.close();
                    }.bind(this)
                },             
                {
                    label: _('Exit without saving'),
                    type: 'secondary',
                    callback: function() { 
                        window.document.location = return_to;
                    }
                },
                {
                    label: _('Save source type'),
                    type: 'primary',
                    callback: $.proxy(ctrlr.handleSubmit, ctrlr)
                }
            ]
        });

        var container = this.popupInstance.getPopup();
        $(document).unbind('keydown.Popup');
        $('#st_confirm_form').unbind('keypress').bind('keypress', function(event){
            if(event.keyCode==13){
                event.preventDefault();
                ctrlr.handleSubmit();
            }
        });
                
        var list = [];
        var k;
        for (k in settings.toSourcetypeSettings()) {
            var val = (settings.get(k) != null ? settings.get(k) : '');
            list.push(k + '=' + val);
        }
        $('#st_props', container).val('[]\n' + list.join('\n'));
        
        list = [];
        for (k in settings.toSourcetypeSettings('inherited')) {
            var val = (settings.get(k) != null ? settings.get(k) : '');
            list.push(k + '=' + val);
        }
        $('#text_props_default', container).val(list.join('\n'));
        
        
        $('#st_name', container).bind('keyup', function(evt) {
            var name = $('#st_name, container').val().replace(/\n/g,'');
            var propsText = $('#st_props', container).val().replace(/^\[(.*)\]/, '['+name+']');
            $('#st_props', container).val(propsText);
        });
        
        $('#st_props_default', container).click(function() {
            $('#text_props_default', container).toggle();
        });       
    },
    
    close: function() {
        this.popupInstance.destroyPopup();
    },
    
    showError: function(err) {
        $('.errors').text(err).show();
        setPreviewHeight();
    },
    
    clearErrors: function() {
        $('.errors', this.context).empty().hide();
        setPreviewHeight();
    }
    

};

//
// popup manager for sourcetype success dialog
//

Splunk.preview.SourcetypeSuccessView = function() {
    this.context = "#st_success_popup";
    this.popupInstance = null;
};
Splunk.preview.SourcetypeSuccessView.prototype = {

    render: function(st_name, continue_to, return_to) {
        $('span#success_msg', this.context).append(st_name);
        this.popupInstance = new Splunk.Popup($(this.context), {
            title: _('Sourcetype saved'),
            buttons: [
                {
                    label: _('Exit'),
                    type: 'secondary',
                    callback: function() { 
                        window.document.location = return_to;
                    }
                },
                {
                    label: _('Create input'),
                    type: 'primary',
                    callback: function() { 
                        window.document.location = continue_to;
                    }
                }
            ]
        });
        $(document).unbind('keydown.Popup');
    },
    
    close: function() {
        this.popupInstance.destroyPopup();
    }
    
};


var setPreviewHeight = function() {
    var $preview = $('.preview'), 
    $header = $('.header'), 
    $messages = $('.messaging'),
    $error = $('#main_error_panel');
    var newHeight = $(window).height() - $header.height() - $messages.height() - $error.height();
    $preview.height( newHeight + 'px');
};
