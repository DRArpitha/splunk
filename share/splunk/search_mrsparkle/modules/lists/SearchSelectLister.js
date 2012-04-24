
Splunk.Module.SearchSelectLister = $.klass(Splunk.Module.AbstractSearchLister, {

    initialize: function($super, container) {
        $super(container);
        $('select', this.container).bind('change', this.onUserAction.bind(this));
    },

    isDisabled: function() {
        return $('select', this.container).prop('disabled');
    },

    getListValue: function() {
        return $('select', this.container).val();
    },

    getTokenValues: function() {
        var selected = $('select', this.container);
        var option = $('select option:selected', this.container);
        return { 
            'value': selected.val(),
            'key': option.attr('key'),
            'label': option.text()
        };
    },

    /**
     * Select the selected option fool!
     */
    selectSelected: function() {
        var selected = this.getParam('selected');
        if (selected) {
            var labelBased = $('select > option:contains("' + selected + '")', this.container);
            if (labelBased.length > 0) {
                labelBased.prop('selected', true);
                return;
            }
        }
    },

    onInternalJobDispatched: function() {
        if ($('select', this.container).prop('disabled')) return;
        $('select', this.container).empty().prop('disabled', true);
        $('select', this.container).append($('<option>Loading...</option>'));
    },

    renderResults: function($super, html) {
        $('select', this.container).empty();
        $('select', this.container).append(html);
        this.selectSelected();
        $('select', this.container).prop('disabled', false);
        $super(html);
    }

});
