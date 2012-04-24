
Splunk.Module.EntitySelectLister = $.klass(Splunk.Module.AbstractEntityLister, {

    initialize: function($super, container) {
        $super(container);

        var self = this;
        $('select', this.container).bind('change', function(event) {
            self.onUserAction(event);
            self.setParam('selected', self.getListValue(), true);
	    });
    },

    isDisabled: function() {
        return $('select', this.container).prop('disabled');
    },

    getListValue: function() {
        return $('select', this.container).val();
    },

    /**
     * Select the selected option fool!
     */
    selectSelected: function() {
        var selected = this.getParam('selected');

        if (selected) {
            if (selected == "{app}") selected = Splunk.ViewConfig.app.id;
            if (selected == "{user}") selected = window.$C['USERNAME'];
            
            var labelBased = $('select > option:contains("' + selected + '")', this.container);
            if (labelBased.length > 0) {
                labelBased.prop('selected', true);
                return;
            }
        }
    },

    renderResults: function($super, html) {
        $('select', this.container).empty();
        $('select', this.container).append(html);
        this.selectSelected();
        $('select', this.container).prop('disabled', false);
        $super(html);
    }

});
