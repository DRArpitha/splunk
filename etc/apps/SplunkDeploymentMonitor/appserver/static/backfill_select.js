// http://stackoverflow.com/questions/1184624/serialize-form-to-json-with-jquery
$.fn.serializeObject = function () {
    var o = {}, a = this.serializeArray();
    $.each(a, function () {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

function getDateWithTime(datepicker, timefield) {
    var dateWithTime = $(datepicker, this.container).datepicker('getDate'),
        t = $(timefield, this.container),
        hours = t.find('.hours').val() || 0,
        minutes = t.find('.minutes').val() || 0,
        seconds = t.find('.seconds').val() || 0,
        milliseconds = t.find('.milliseconds').val() || 0;
    dateWithTime.setHours(hours, minutes, seconds, milliseconds);
    return dateWithTime;
}

function clearError() {
    var container = document.getElementById('error_container');
    if (container.hasChildNodes()) {
        while (container.childNodes.length >= 1) {
            container.removeChild(container.firstChild);
        }
    } 
}

function displayError(text) {
    var error = document.createElement('p'),
        container = document.getElementById('error_container');
    clearError();
    error.setAttribute('className', 'errorText') || error.setAttribute('class', 'errorText');
    error.innerHTML = 'Error: ' + text;
    container.appendChild(error);
}

function validateAdd(form) {
    var bool_template = (!(form.find('#backfill_template_select').attr('disabled') === 'disabled')),
        earliest = new Date(form.find('#earliest').val()),
        latest = new Date(form.find('#latest').val()),
        maxjobs = parseInt(form.find('#maxjobs').val()),
        search = form.find('#backfill_search_select').val(),
        template = form.find('#backfill_template_select').val();
    if ((bool_template && !template) 
        || (!bool_template && !search) 
        || (search === null && template === null)) {
        displayError('you must select at least one search or template to add to the job');
        return false;
    }
    if (earliest > latest) {
        displayError('latest time must be later than earliest time');
        return false;
    }
    if (!maxjobs || isNaN(maxjobs) || maxjobs < 1 || maxjobs > 4) {
        displayError('Max concurrent searches must be an integeter between 1 and 4');
        return false;
    } else {
        clearError();
        return true;
    }
}

function validateSubmit(form) {
    var saved_search = form.find('li');
    if (saved_search.length < 1) {
        displayError('Your backfill job must include at least one saved search');
        return false;
    } else {
        clearError();
        return true;
    }
}

function getUUID(count) {
    var url = Splunk.util.make_url('/custom/SplunkDeploymentMonitor/dmbackfill/uuid/' + count),
        uuid = [];
    $.ajax({
        async: false,
        type: 'GET',
        url: url,
        complete: function (data) {
            uuid = JSON.parse(data.responseText);
        },
        error: function () { alert('could not retreive uuid'); }
    });
    return uuid;
}

function jobFactory(form_obj, saved_search, uuid) {
    var del = document.createElement('a'),
        del_span = document.createElement('span'),
        details = document.createElement('span'),
        earliest = document.createElement('span'),
        hidden = document.createElement('input'),
        job_list = document.getElementById('job_list'),
        latest = document.createElement('span'),
        li = document.createElement('li'),
        maxjobs = document.createElement('span'),
        sli = document.createElement('li'),
        span = document.createElement('span'),
        ul = document.createElement('ul');
    li.setAttribute('id', uuid);
    li.setAttribute('title', 'Drag elements to configure the order that the job should be executed');
    ul.setAttribute('className', 'JobList') || 
        ul.setAttribute('class', 'JobList');
    hidden.setAttribute('type', 'hidden');
    hidden.setAttribute('value', uuid + '::' + saved_search);
    hidden.setAttribute('name', 'saved_search');
    span.setAttribute('className', 'JobName') || 
        span.setAttribute('class', 'JobName');
    span.innerHTML = saved_search;
    sli.appendChild(span);
    sli.appendChild(hidden);
    span = document.createElement('span');
    del.setAttribute('className', 'splButton-tertiary') || 
        del.setAttribute('class', 'splButton-tertiary');
    del.className += ' ' + 'zoomOut';
    del.setAttribute('title', 'expand');
    del.setAttribute('href', uuid);
    del.setAttribute('id', 'expand_' + uuid);
    del_span.setAttribute('className', 'splButtonIcon') || 
        del_span.setAttribute('class', 'splButtonIcon');
    del.appendChild(del_span);
    span.appendChild(del);
    sli.appendChild(span);
    span = document.createElement('span');
    del = document.createElement('a');
    del.setAttribute('className', 'splButton-tertiary') || 
        del.setAttribute('class', 'splButton-tertiary');
    del.className += ' ' + 'cancel';
    del.setAttribute('title', 'remove');
    del.setAttribute('href', uuid);
    del.setAttribute('id', 'delete_' + uuid);
    del_span = document.createElement('span');
    del_span.setAttribute('className', 'splButtonIcon') || 
        del_span.setAttribute('class', 'splButtonIcon');
    del.appendChild(del_span);
    span.appendChild(del);
    sli.appendChild(span);
    li.appendChild(sli);
    sli = document.createElement('li');
    earliest.setAttribute('className', 'JobEarliest') || 
        earliest.setAttribute('class', 'JobEarliest');
    earliest.innerHTML = '<strong>Earliest:</strong>&nbsp;' + form_obj.earliest;
    hidden = document.createElement('input');
    hidden.setAttribute('type', 'hidden');
    hidden.setAttribute('value', uuid + '::' + form_obj.earliest);
    hidden.setAttribute('name', 'earliest');
    sli.appendChild(hidden);
    sli.appendChild(earliest);
    ul.appendChild(sli);
    sli = document.createElement('li');
    latest.setAttribute('className', 'JobLatest') || 
        latest.setAttribute('class', 'JobLatest');
    latest.innerHTML = '<strong>Latest:</strong>&nbsp;' + form_obj.latest;
    hidden = document.createElement('input');
    hidden.setAttribute('type', 'hidden');
    hidden.setAttribute('value', uuid + '::' + form_obj.latest);
    hidden.setAttribute('name', 'latest');
    sli.appendChild(hidden);
    sli.appendChild(latest);
    ul.appendChild(sli);
    sli = document.createElement('li');
    details.setAttribute('className', 'JobDedup') || 
        details.setAttribute('class', 'JobDedup');
    if (!form_obj.dedup) {
        details.innerHTML = '<strong>Dedup:</strong>&nbsp;False';
    } else {
        details.innerHTML = '<strong>Dedup:</strong>&nbsp;True&nbsp;';
        hidden = document.createElement('input');
        hidden.setAttribute('type', 'hidden');
        hidden.setAttribute('value', uuid + '::' + form_obj.dedup);
        hidden.setAttribute('name', 'dedup');
        sli.appendChild(hidden);
    }
    sli.appendChild(details);
    details = document.createElement('span');
    details.setAttribute('className', 'JobReverse') || 
        details.setAttribute('class', 'JobReverse');
    if (!form_obj.reverse) {
        details.innerHTML = '&nbsp;<strong>Reverse:</strong>&nbsp;False';
    } else {
        details.innerHTML = '&nbsp;<strong>Reverse:</strong>&nbsp;True&nbsp;';
        hidden = document.createElement('input');
        hidden.setAttribute('type', 'hidden');
        hidden.setAttribute('value', uuid + '::' + form_obj.reverse);
        hidden.setAttribute('name', 'reverse');
        sli.appendChild(hidden);
    }
    sli.appendChild(details);
    details = document.createElement('span');
    details.setAttribute('className', 'JobMax') || 
        details.setAttribute('class', 'JobMax');
    details.innerHTML = '&nbsp;<strong>Concurrency:</strong>&nbsp;' + form_obj.maxjobs + 'x';
    hidden = document.createElement('input');
    hidden.setAttribute('type', 'hidden');
    hidden.setAttribute('value', uuid + '::' + form_obj.maxjobs);
    hidden.setAttribute('name', 'maxjobs');
    sli.appendChild(details);
    sli.appendChild(hidden);
    ul.appendChild(sli);
    li.appendChild(ul);
    job_list.appendChild(li);
}

function updateJobsSummary() {
    var jobs = $('#job_list').children().length;
    $('#jobs_summary').html('Staged Jobs: ' + jobs.toString());
}

function jobBindHandler(uuid) {
    $('#delete_' + uuid).bind('click', function (event) {
        var del;
        $(event.target).unbind('click');
        del = document.getElementById(this.toString().split("/").pop());
        del.parentNode.removeChild(del);
        updateJobsSummary();
        event.preventDefault();
    });
    $('#expand_' + uuid).parent().parent().next().hide(); 
    $('#expand_' + uuid).toggle( 
        function (event) {
            $(this).parent().parent().next().show();
            $(this).attr('title', 'hide');
            $(this).removeClass('zoomOut').addClass('zoomIn');
            event.preventDefault();
        },
        function (event) {
            $(this).parent().parent().next().hide();
            $(this).attr('title', 'show');
            $(this).removeClass('zoomIn').addClass('zoomOut');
            event.preventDefault();
        }
    );
}

function createQueue(form_obj) {
    var i, j,
        options = $('#backfill_search_select option'), 
        template = form_obj.template,
        uuid,
        uuids,
        val,
        values = [];
    val = new RegExp(template); 
    options.each(function () {
        if ($(this).val().match(val)) {
            values.push($(this).val()); 
        }
    });
    uuids = getUUID(values.length);
    for (i = 0; i < values.length; i += 1) {
        uuid = uuids.pop();
        jobFactory(form_obj, values[i], uuid);
        jobBindHandler(uuid);
    }
}

function insertJobs(form) {
    var form_obj = form.serializeObject(),
        i,
        uuid,
        uuids;
    if (form_obj.template) {
       createQueue(form_obj); 
    } else if (form_obj.saved_search.constructor.toString().match(/string/i)) {
        uuid = getUUID(1)[0];
        jobFactory(form_obj, form_obj.saved_search, uuid);
        jobBindHandler(uuid);
    } else {
        uuids = getUUID(form_obj.saved_search.length);
        for (i = 0; i < form_obj.saved_search.length; i += 1) {
            uuid = uuids.pop();
            jobFactory(form_obj, form_obj.saved_search[i], uuid);
            jobBindHandler(uuid);
        }
    }
}

function backfillHandler() {
    $('#job_add').click(function (event) {
        var form = $('#backfill_select');
        form.find('#earliest').val(getDateWithTime('#EarliestDate', '#EarliestTime'));
        form.find('#latest').val(getDateWithTime('#LatestDate', '#LatestTime'));
        if (!validateAdd(form)) {
            event.preventDefault();
        } else {
            insertJobs(form);
            updateJobsSummary();
            event.preventDefault();
        }
    });
    $('#backfill_form_submit').submit(function (event) {
        var form = $('#backfill_form_submit');
        if (!validateSubmit(form)) {
            event.preventDefault();
        } else {
            $('#backfill_submit').attr('disabled', 'disabled').val(function () {
                return 'Please wait...';
            });
        }
    });
    $('#job_expand_all').click(function (event) {
        $('#job_list').children().children().show();
        event.preventDefault();
    });
    $('#job_min_all').click(function (event) {
        $('#job_list').children().children('ul').hide();
        event.preventDefault();
    });
    $('#job_del_all').click(function (event) {
        $('#job_list').children().remove();
        updateJobsSummary();
        event.preventDefault();
    });
}

$(document).ready(function () {
    var defaultDate = new Date();
    new Splunk.TimeSpinner($('#EarliestTime'));
    new Splunk.TimeSpinner($('#LatestTime'));
    $('#LatestDate').val((parseInt(defaultDate.getMonth(), 10) + 1) + '/' + defaultDate.getDate() + '/' + defaultDate.getFullYear());
    defaultDate.setDate(defaultDate.getDate() - 14);
    $('#EarliestDate').val((parseInt(defaultDate.getMonth(), 10) + 1) + '/' + defaultDate.getDate() + '/' + defaultDate.getFullYear());
    $('#EarliestDate').datepicker();
    $('#LatestDate').datepicker();

    $("#job_list").sortable({
        helper: function (event, ui) {
            ui.children().each(function () {
                $(this).width($(this).width());
            });
            return ui;
        }
    }).disableSelection();
    backfillHandler();
});

