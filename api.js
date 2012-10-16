/*
 * API.js 
 *
 * Defines REST API endpoints.
 * Connects to Mongo as a data store.
 * Writes logs to console & Loggly service.
 *
 */

var flatiron = require('flatiron'),
  app = flatiron.app,
  union = require('union'),
  Color  = require('color'),
  util = require('util'),
  winston = require('winston'),
  ecstatic = require('ecstatic');

// Add Loggly support
require('winston-loggly');
  
// Activate Flatiron plugins
app.use(flatiron.plugins.http);

// Set config module to read environment variables.
//
app.config.use('env');
var v = validateEnv();

// Constants
//
var JSONtype = { 'Content-Type': 'application/json' };
var PAGE_SIZE = 20;

// Configure Loggly options
//
var logglyOpt =
      {
        subdomain:  v.LOGGLY_SUB_DOMAIN,
        inputToken: v.LOGGLY_INPUT_TOKEN,
        inputName:  v.LOGGLY_INPUT_NAME,
        auth: {
          username: v.LOGGLY_USERNAME,
          password: v.LOGGLY_PASSWORD,
        }
      };
winston.add(winston.transports.Loggly,logglyOpt);
winston.info('=================== STARTING APP =================');

//Mongo connection
//
var mUrl = 'mongodb://'+v.MONGO_HOST+':'+v.MONGO_PORT+'/hcp1';
winston.info('Mongo connection URL: ', mUrl);
var hcp1 = require('mongojs').connect(mUrl);


//Mongo authentication
//
winston.info('Attempting database authentication');
hcp1.authenticate(v.MONGO_USER,v.MONGO_PASS,function(err, data) {
  if (!err) {
    winston.info('Database authentication successful.');
  } else {
    winston.info('Database authentication error.  Aborting now.');
    return process.exit(1);
  }
});

// Mongo collections
//
var audit   = hcp1.collection('audit'),
    force   = hcp1.collection('force'),
    pulse   = hcp1.collection('pulse'),
    shlocks = hcp1.collection('shlocks');

audit.name = 'audit';
force.name = 'force';
pulse.name = 'pulse';
shlocks.name = 'shlocks';

// Generic callback function to use with collection.save function.
//
function saveCallback(err, docs) {
  if (!err) {
  } else {
    winston.error('mongo collection save failed',err);
  }
}


// Reads all environment variables and returns then as an object.
// If any variable is missing from the environment the node process will exit.
function validateEnv() {
  winston.info('Validating Environment');
  var fail = false;
  var v = {};
  var envVariables = 
        ['MONGO_USER', 'MONGO_PASS','MONGO_HOST', 'MONGO_PORT',
         'LOGGLY_INPUT_TOKEN', 'LOGGLY_INPUT_NAME', 'LOGGLY_SUB_DOMAIN',
         'LOGGLY_USERNAME', 'LOGGLY_PASSWORD', 'NODE_ENV','LOCATION','API_PORT'];
  for (i in envVariables) {
    var item = envVariables[i];
    winston.info('Reading env variable ',item);
    if (!fail && app.config.env().get(item) === undefined) {
      fail = true;
      winston.error(item,' undefined');
    } else {
      v[item] = app.config.get(item);
    };
  };
  if (fail) {
    winston.error('Environment improperly defined',process.env);
    return process.exit(1);
  } else {
    winston.info('Environment validated successfully');
  }
  return v;
};

// Object used for holding analytics data.
// Name is irreverant.
//
function Shlock(kind, method, url ) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.time = new Date().toJSON();
};

// Object used to hold common API related information.
//
function Meta(status, path, count) {
  this.status = status;
  this.path = path;
  this.count = count;
}

// Write standard meta data and header.
//
function writeMeta(res,code,url,count) {
  var meta = new Meta('success',url,count);
  res.writeHead(code,JSONtype);
  res.write(JSON.stringify(meta) + '\n');
}

// POST Handler
//   Always returns status code 200 (success) to the client.
//   Creates metrics data and saves it to Mongo.
//   logs the event with metrics information.
//
function postHandler( url, body, res, coll) {
  var self = this;
  var method = 'POST';
  // Always return success
  writeMeta(res, 200,url,0);
  res.end('\n');
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  shlock.system = v.MONGO_USER;
  winston.info(util.inspect(shlock));
  coll.save(shlock,saveCallback);
};

// Handle Errors for GET API calls.
//
function getHandlerError(res,url) {
  writeMeta(res,501,url,0);
  res.end('\n');
}

// Analyzes the query object, which holds parameters from the URL's
// query string.  Looks for parameters based on the collection name.
//
function getFindCriteria(coll,query) {
  var criteria = {};
  switch (coll) {
    case 'force':
      if (query.hasOwnProperty('source')) {
        criteria.source = query.source;
      };
      if (query.hasOwnProperty('ip')) {
        criteria.IP = query.ip;
      };
      break;
  }
  winston.info('find criteria: ',util.inspect(criteria));
  return criteria;
}

// Pull out a list of fields which should be returned from the query.
// This is more like a whitelist filter.
function getFindFields(coll,query) {
  var filter = {};
  switch (coll) {
    case 'force':
      if (query.hasOwnProperty('fields')) {
        filter.fields = query.fields.split(',')
          .reduce(function(acc, item) {
            acc[item] = 1;
            return acc;
          },{})
      }
      break;
  }
  winston.info('mongo collection find fields: ',util.inspect(filter));
  return filter;
}

// Checks querystring to determine whether or not it has
// the expected properties
//
function isQueryValid(query) {
  var valid = true;
  winston.info('query: ',util.inspect(query));
  if (Object.keys(query).length == 0) {
    // No query, RELAX!
  } else {
    // Check for page
    if (query.hasOwnProperty('page')) {
      if (isNaN(parseInt(query.page))) {
        valid = false;
      }
    }
    // Check for count
    if (query.hasOwnProperty('count')) {
      if (!(query.count === 'true' ||
            query.count === 'false')) {
        valid = false;
      }
    }
    // Check for filter
    if (query.hasOwnProperty('fields')) {
      if (!isNaN(query.filter)) {
        valid = false;
      }
    }
  }
  if (!valid) {
    winston.warn('isQueryValid: ',valid);
  } else {
    winston.info('isQueryValid: ',valid);
  }
  return valid;
}

// Generic function to handle a find function callback
// for a Mongo collection.
function findHandler(err, docs, res, url) {
  if (!err) {
    // Return Success & JSON Content-type
    var length = docs.length;
    writeMeta(res,200,url,length);

    // Process results from Mongo
    docs.forEach(function(e,i,a) {
      delete e._id;
      res.write(JSON.stringify(e)+'\n');
    });
    res.end('\n');
  } else {
    getHandlerError(res,url);
  }
}

// API ENDPOINT 
app.router.get('/audit',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  winston.info(util.inspect(shlock));

  // Query Mongo
  audit.find(function(err,docs) {findHandler(err,docs,self.res, url)});
});

function getHandler(request,response,url,coll) {
  // Setup
  var self = this;
  var method = 'GET';
  var body = request.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  winston.info(util.inspect(shlock));

  // Check for query string
  var query = request.query;
  if (!isQueryValid(query)) {
    writeMeta(resp,400,url,0);
    resp.end('\n');
  } else {
    // Handle count=true
    if (query.hasOwnProperty('count') &&
        query.count === 'true') {
      var only   = getFindCriteria(coll.name,query);
      coll.count(only,function(err,docs) {
        writeMeta(response,200,url,docs);
        response.end('\n');
      });
    } else {
      // Handle paging
      if (query.hasOwnProperty('page')) {
        var only = getFindCriteria(coll.name,query);
        var fields = getFindFields(coll.name,query);
        coll.find(only,fields,function(err,docs) {findHandler(err,docs,response, url)})
          .skip(PAGE_SIZE*query.page)
          .limit(PAGE_SIZE);
      } else {
        // Query Mongo
        var only = getFindCriteria(coll.name,query);
        var fields = getFindFields(coll.name,query);
        coll.find(only,fields,function(err,docs) {findHandler(err,docs,response, url)});
      }
    }
  }
}

// API ENDPOINT 
app.router.get('/force',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/force';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  winston.info(util.inspect(shlock));

  // Check for query string
  var query = self.req.query;
  if (!isQueryValid(query)) {
    writeMeta(self.res,400,url,0);
    self.res.end('\n');
  } else {
    // Handle count=true
    if (query.hasOwnProperty('count') &&
        query.count === 'true') {
      var only   = getFindCriteria('force',query);
      force.count(only,function(err,docs) {
        writeMeta(self.res,200,url,docs);
        self.res.end('\n');
      });
    } else {
      // Handle paging
      if (query.hasOwnProperty('page')) {
        var only = getFindCriteria('force',query);
        var fields = getFindFields('force',query);
        force.find(only,fields,function(err,docs) {findHandler(err,docs,self.res, url)})
          .skip(PAGE_SIZE*query.page)
          .limit(PAGE_SIZE);
      } else {
        // Query Mongo
        var only = getFindCriteria('force',query);
        var fields = getFindFields('force',query);
        force.find(only,fields,function(err,docs) {findHandler(err,docs,self.res, url)});
      }
    }
  }
});

// API ENDPOINT 
app.router.get('/pulse',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/pulse';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  winston.info(util.inspect(shlock));

  // Query Mongo
  pulse.find(function(err,docs) {findHandler(err,docs,self.res, url)});
});

// API ENDPOINT 
app.router.get('/shlocks',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  winston.info(util.inspect(shlock));

  getHandler(self.req,self.res,url,shlocks);

});

// API ENDPOINT 
app.router.post('/shlocks',function() {
  var self = this;
  var body = self.req.body;
  postHandler('/shlocks', body, self.res, shlocks);
});

// API ENDPOINT 
app.router.post('/force',function() {
  var self = this;
  var body = self.req.body;
  postHandler('/force', body, self.res, shlocks);
});

// API ENDPOINT 
// Takes req.body and saves it into the audit collection.
//
app.router.post('/audit',function () {
  var self = this;
  var body = self.req.body;
  postHandler('/audit', body, self.res, audit);
});

// API ENDPOINT 
// Takes radius and color from req.body and emits event to update a d3 circle.
//
app.router.post('/pulse',function(){
  var self = this;
  var body = self.req.body;
  postHandler('/pulse', body, self.res, pulse);
  // Update circles on clients.
  var circle = new Circle(body.r,body.fill);
  io.sockets.emit('pulse', circle);
});

winston.info('Running on port: '+v.API_PORT+' in NODE_ENV: '+ v.NODE_ENV + ' on ' + v.LOCATION );
app.start(v.API_PORT);

function Circle(r, fill) {
  this.r = r;
  this.fill = fill;
};

// Display all configured API endpoints, aka routes.
winston.info('route',util.inspect(app.router.routes));
