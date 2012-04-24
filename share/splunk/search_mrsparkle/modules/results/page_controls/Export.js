
Splunk.Module.Export = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container){
        $super(container);
        this.logger = Splunk.Logger.getLogger("Splunk.Module.Export");
        var exportBtn = $("a", this.container);
        exportBtn.bind("click.export", function(){return false;});
    },
    onContextChange: function(){
        this.updateExportLink();
        return;
    },
    onJobDone: function(event){
        this.updateExportLink();
        return;

    },
    updateExportLink : function(){
        var context = this.getContext();
        var search = context.get("search");
        var jobDone = search.job.isDone()
        var exportBtn = $("a", this.container);
        var type = this.getParam('exportType');
        
        if(jobDone){
            
            var context = this.getContext();
            var formContainer = $('.exportPopupContainer')[0];
            var exportBtn = $("a", this.container);
            
            exportBtn.unbind('click.export');
            exportBtn.bind('click.export', function(){            
                var search = context.get("search");
                if(typeof search == 'undefined' || typeof search == 'undefined' || search.job == 'undefined' || !search.job){
                    return;
                }
                Splunk.Popup.createExportResultsForm(formContainer, search.job, type);
                return false;
            });
        
            exportBtn.removeClass('splIconicLinkDisabled');
        }else{
            exportBtn.addClass('splIconicLinkDisabled');
            exportBtn.unbind('click.export');
            exportBtn.bind('click.export', function(){return false;});
        }    
    },
    
    onJobProgress: function(event){
        
        
    }
});