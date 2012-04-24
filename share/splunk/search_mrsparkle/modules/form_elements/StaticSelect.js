Splunk.Module.StaticSelect = $.klass(Splunk.Module.AbstractStaticFormElement, {

    initialize: function($super, container) {
        $super(container);
        $('select', this.container).bind('change', this.onUserAction.bind(this));
    },

    getListValue: function() {
        return $('select', this.container).val();
    }
    
});
