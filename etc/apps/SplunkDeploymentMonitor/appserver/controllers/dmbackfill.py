from collections import OrderedDict
import logging
import os
import sys
import time

import cherrypy

import splunk
import splunk.util as util
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.appserver.mrsparkle.lib.util as apps_util
from splunk.models.saved_search import SavedSearch 

logger = logging.getLogger('splunk.appserver.dmbackfill')

dir = os.path.join(apps_util.get_apps_dir(), __file__.split('.')[-2], 'bin')
if not dir in sys.path:
    sys.path.append(dir)

import deployment_monitor.backfiller.bfsum as bfsum
from deployment_monitor.models.dm_backfill import Backfill
from deployment_monitor.models.input import ScriptedInput

UUID_LIMIT = 200

class DMBackfill(controllers.BaseController):
    '''Deployment Monitor Backfill Controller'''
 
    @route('/:app/:action=list')
    @expose_page(must_login=True, methods=['GET']) 
    def list(self, app, action, **kwargs):
        ''' provides list of saved searches for backfill lister'''

        host_app = cherrypy.request.path_info.split('/')[3]
        user = cherrypy.session['user']['name'] 
            
        searches = SavedSearch.all()
        searches = searches.filter_by_app(app)
        searches = searches.search('action.summary_index=1')

        return self.render_template('/%s:/templates/backfill_select.html' % host_app, 
                                    dict(app=app, searches=searches))


    @route('/:action=uuid/:count')
    @expose_page(must_login=True, methods=['GET'])
    def get_uuid(self, action, count, **kwargs):

        count = int(count)
        if count > UUID_LIMIT:
            count = UUID_LIMIT
        response = []
        for i in range(count): 
            response.append(util.uuid4())
        return self.render_json(response)

    @route('/:app/:action=success')
    @expose_page(must_login=True, methods=['GET'])
    def success(self, app, action, **kwargs):
        ''' render the success page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        return self.render_template('/%s:/templates/backfill_success.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=failure')
    @expose_page(must_login=True, methods=['GET']) 
    def failure(self, app, action, **kwargs):
        ''' render the failure page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        return self.render_template('/%s:/templates/backfill_failure.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=unauthorized')
    @expose_page(must_login=True, methods=['GET']) 
    def unauthorized(self, app, action, **kwargs):
        ''' render the unauthorized page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        return self.render_template('/%s:/templates/backfill_403.html' \
                                    % host_app,
                                    dict(app=app))

    @route('/:app/:action=submit')
    @expose_page(must_login=True, methods=['POST']) 
    def submit(self, app, action, **params):
        ''' submit a job list to the queue '''
            
        sessionKey = cherrypy.session.get('sessionKey')
        host_app = cherrypy.request.path_info.split('/')[3]
        user = cherrypy.session['user']['name'] 
        
        if not self.verify_input_exists(host_app, user):
            raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'))
      
        try:
            jobs = self.parse_jobs(params)  
        except Exception, ex:
            logger.exception(ex)
            raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure'))

        for job in jobs.keys():
            bf = Backfill(app, user, jobs[job]['name'])
            earliest = jobs[job].pop('earliest')
            latest = jobs[job].pop('latest')
            bf.update(jobs[job])
            bf.human2epoch(earliest=earliest, latest=latest)
            bf.share_app()

            try:
                if not bf.passive_save():
                    logger.error(bf.errors[0])
                    logger.error('Could not validate and submit the backfill job')
                    return self.render_template('/%s:/templates/backfill_failure.html' % host_app,
                                                dict(app=app, errors=bf.errors))
            except splunk.AuthorizationFailed:
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized'))

        logger.info('controller submitted new backfill job for user %s' % user)
        raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'success'))
        
    def verify_input_exists(self, host_app, user):
    
        name = os.path.join(apps_util.get_apps_dir(), host_app, 
                            'bin', 'scripted_inputs', 'dm_backfill_factory.py')

        try:
            scripted = ScriptedInput.get(ScriptedInput.build_id(name, host_app, user))
            scripted.disabled = False
        except:
            scripted = ScriptedInput(host_app, user, name)
            scripted.pass_auth = 'admin'
            scripted.disabled = False
            scripted.interval = 15

        if not scripted.passive_save():
            logger.error(scripted.errors[0])
            return False

        return True 
        
    def parse_jobs(self, params):
        ''' parse a list of jobs provided by backfill_select '''

        # order is of primary importance 
        job_list = OrderedDict()
        param_list = ['dedup', 'earliest', 'latest', 'maxjobs', 'reverse'] 
        searches = params.pop('saved_search')
        seed_time = time.mktime(time.localtime()) 
  
        if not isinstance(searches, list):
            searches = [searches]

        for search in searches:
            try:
                (key, value) = search.split('::')
                seed_time = seed_time + .05
                job_list[key] = {'saved_search' : value, 'status' : '0',
                                 'seed' : seed_time, 'name' : key}
            except Exception, ex:
                # this is not a valid input, ignore >> except 
                logger.debug(ex)
                pass    
         
        for param in param_list:
            try:
                if not isinstance(params[param], list):
                    params[param] = [params[param]]
                for setting in params[param]:
                    (key, value) = setting.split('::')
                    job_list[key][param] = value
            except KeyError:
                pass
 
        return job_list
       
    def _redirect(self, host_app, app, endpoint, _qs=None):
        ''' redirect convenience '''

        return self.make_url(['custom', host_app, 'dmbackfill', app, endpoint], _qs=_qs)

