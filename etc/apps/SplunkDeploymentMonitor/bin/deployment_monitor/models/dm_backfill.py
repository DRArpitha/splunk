from time import strptime, mktime
from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field, BoolField, FloatField, IntField 

'''
Provides object mapping for backfill objects
'''

class Backfill(SplunkAppObjModel):
    
    resource              = 'backfill/dm_backfill'
    dedup                 = BoolField(default_value=False)
    description           = Field()
    earliest              = FloatField()
    index                 = Field(default_value='summary')
    latest                = FloatField()
    maxjobs               = IntField(default_value=1)
    namespace             = Field(default_value='search')
    owner                 = Field()
    reverse               = BoolField(default_value=False)
    saved_search          = Field()
    seed                  = FloatField() 
    status                = IntField(default_value=0) 
    totaljobs             = IntField()

    def validate(self):
        if self.earliest > self.latest:
            self.errors.append(['earliest','earliest time is after latest time'])
        if self.earliest < 0:
            self.errors.append(['earliest','invalid earliest time specified'])
        if self.latest < 0:
            self.errors.append(['latest','invalid earliest time specified'])
        if int(self.maxjobs) > 4 or int(self.maxjobs) < 1:
            self.errors.append(['maxjobs','maxjobs must be in range 1-4'])
        if self.status and int(self.status) not in range(0,2):
            self.errors.append(['status','status must be in range 0-2'])
        if self.description and len(self.description) > 1024:
            self.errors.append(['description','description cannot be longer than 1024 characters'])
        if len(self.errors) > 0:
            return False
        return True

    def human2epoch(self, earliest=None, latest=None):
        """ converts the browser time provided into epoch time """

        def passive_convert(time, pattern):
            """ private - try to parse the times without raising """

            new_time = None

            try:
                new_time = strptime(time, pattern)
            except:
                pass

            return new_time

        if not earliest and not latest:
            return False 

        temp = {'earliest': earliest, 'latest': latest}

        for x in temp:
            if temp[x]:
                new_ts = None
                # 1: Tues Jan 21 2011 12:34:56 GMT-0200 (Foobar Standard Time)
                # 2: Tues Jan 21 2011 12:34:56 GMT+0200 (Foobar Standard Time)
                # 3: Tues Jan 21 2011 12:34:56 -0200 (FST) 
                # 4: Tues Jan 21 12:34:56 GMT 2011 
                combinations = [[temp[x].split('(')[0].split('-')[0] , 
                                 '%a %b %d %Y %H:%M:%S %Z'],
                                [temp[x].split('(')[0].split('+')[0] , 
                                 '%a %b %d %Y %H:%M:%S %Z'], 
                                [' '.join([' '.join(temp[x].split(' ')[:-2]), 
                                     temp[x].split(' ')[-1][1:-1]]) ,
                                 '%a %b %d %Y %H:%M:%S %Z'],
                                [temp[x], '%a %b %d %H:%M:%S %Z %Y']] 
                                 
                for pair in combinations:
                    new_ts = passive_convert(pair[0], pair[1])
                    if new_ts:
                        break

                if not new_ts:
                    return False

                if x in ['earliest']:
                    self.earliest = float(mktime(new_ts))
                else:
                    self.latest = float(mktime(new_ts))
        return True
