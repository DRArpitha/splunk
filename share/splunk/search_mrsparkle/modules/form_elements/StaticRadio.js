Splunk.Module.StaticRadio = $.klass(Splunk.Module.AbstractStaticFormElement, {

    initialize: function($super, container) {
        $super(container);
        $('fieldset input[type="radio"]', this.container).bind('click', this.onUserAction.bind(this));
    },

    getListValue: function() {
        return $('fieldset input:checked', this.container).val();
    }
    
});
