/*!
 * JQuery plugin for rich radios
 *
 * usage: $('.splRadio-group').splRadioInit().splRadioSet('edit');
 */
(function( $ ){
    // vars
    var radioSelector = '.splRadio-control', // the control-container
        radioState = 's-active'; //  the active state class

     // splRadioInit - set up default states
     $.fn.splRadioInit = function() {
       // do initial highlight
       this.find('input:checked').parents(radioSelector).addClass(radioState);
       // click handler for highlight
       this.find('label').click(function(){
           var $el = $(this);
           $el.parent().siblings().removeClass(radioState);
           $el.parent().addClass(radioState);
            // IE needs some help setting the radio state
           $for = $el.attr('for');
           $input = $for ? $('#' + $for) : $el.find('input');
           $input.attr('checked','checked');
           $input.trigger('change');
       });
       return this;
     };
     
     // splRadioSet - set the checked input programatically
     $.fn.splRadioSet = function(value){
         // find all the inputs, check value and then set checked & active
         $inputs = this.find('input:radio');
         $inputs.val([value]);
         $inputs.parents(radioSelector).siblings().removeClass(radioState);
         this.find('input:checked').parents(radioSelector).addClass(radioState);
         return this;
     };
})( jQuery );
