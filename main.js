/*
 * Main.js 
 *
 * Initializes Flation application.
 * Defines REST API endpoints.
 * Defines Socket.io events & handlers.
 * Connects to Mongo as a data store.
 *
 */

var flatiron = require('flatiron'),
  app = flatiron.app,
  util = require('util'),
  union = require('union'),
  ecstatic = require('ecstatic');

// Activate Flatiron plugins
app.use(flatiron.plugins.http);
app.use(flatiron.plugins.log);

//Environment variables must be set.
app.log.info('Validating Environment');
validateEnv();
var mUser = process.env.MONGO_USER,
    mPass = process.env.MONGO_PASS,
    mHost = process.env.MONGO_HOST,
    mPort = process.env.MONGO_PORT;


//Mongo connection
var mUrl = 'mongodb://'+mHost+':'+mPort+'/hcp1';
app.log.info('Mongo connection URL: ', mUrl);
var hcp1 = require('mongojs').connect(mUrl);

// Constants
var JSONtype = { 'Content-Type': 'application/json' };
var PAGE_SIZE = 20;

app.log.info('Attempting database authentication');
//Mongo authentication
hcp1.authenticate(mUser,mPass,function(err, data) {
  if (!err) {
    app.log.info('Database authentication successful.');
  } else {
    app.log.error('Database authentication error.  Aborting now.');
    return process.exit(1);
  }
});

// Mongo collections
var audit   = hcp1.collection('audit'),
    shlocks = hcp1.collection('shlocks'),
    force   = hcp1.collection('force'),
    pulse   = hcp1.collection('pulse');

function saveCallback(err, docs) {
  if (!err) {
    app.log.info('mongo collection save succeeded');
  } else {
    app.log.error('mongo collection save failed',err);
  }
}


function validateEnv() {
  var fail = false;
  var v = {};
  if (!fail && process.env.MONGO_USER === undefined) {
    fail = true;
    app.log.error('MONGO_USER undefined');
  } else {
    v.MONGO_USER = process.env.MONGO_USER;
  };
  if (!fail && process.env.MONGO_PASS === undefined) {
    fail = true;
    app.log.error('MONGO_PASS undefined');
  } else {
    v.MONGO_PASS = 'xxxxx';
  };
  if (!fail && process.env.MONGO_HOST === undefined) {
    fail = true;
    app.log.error('MONGO_HOST undefined');
  } else {
    v.MONGO_HOST = process.env.MONGO_HOST;
  };
  if (!fail && process.env.MONGO_PORT === undefined) {
    fail = true;
    app.log.error('MONGO_PORT undefined');
  } else {
    v.MONGO_PORT = process.env.MONGO_PORT;
  };
  if (fail) {
    app.log.error(process.env);
    return process.exit(1);
  } else {
    app.log.info('Environment validated successfully\n',v);
  }
};

function Shlock(kind, method, url ) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.milliseconds = new Date().getTime();
};

function Meta(status, path, count) {
  this.status = status;
  this.path = path;
  this.count = count;
}

// Write standard meta data and header.
function writeMeta(res,code,url,count) {
  var meta = new Meta('success',url,count);
  res.writeHead(code,JSONtype);
  res.write(JSON.stringify(meta) + ',\n');
}

// POST Handler
//   Always returns status code 200 (success) to the client.
//   Creates metrics data and saves it to Mongo.
//   logs the event with metrics information.
function postHandler( url, body, res, coll) {
  var self = this;
  var method = 'POST';
  // Always return success
  writeMeta(res, 200,url,0);
  res.end('\n');
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  shlock.source = mUser;
  app.log.info(url,method,shlock);
  coll.save(shlock,saveCallback);
};

// Handle Errors for GET API calls.
function getHandlerError(res,url) {
  writeMeta(res,501,url,0);
  res.end('\n');
}


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
  app.log.info('Mongo Collection find criteria: ',criteria);
  return criteria;
}

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
  app.log.info('mongo collection find fields: ',filter);
  return filter;
}

function isQueryValid(query) {
  var valid = true;
  app.log.info(query);
  if (Object.keys(query).length == 0) {
    app.log.info('query empty');
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
    if (query.hasOwnProperty('filter')) {
      if (!isNaN(query.filter)) {
        valid = false;
      }
    }
  }
  if (!valid) {
    app.log.info('isQueryValid: ',valid);
  } else {
    app.log.warn('isQueryValid: ',valid);
  }
  return valid;
}

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

// GET AUDIT
app.router.get('/audit',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  app.log.info(url,method,shlock);

  // Query Mongo
  audit.find(function(err,docs) {findHandler(err,docs,self.res, url)});
});

// GET FORCE
app.router.get('/force',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/force';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  app.log.info(url,method,shlock);

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

app.router.get('/pulse',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/pulse';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  app.log.info(url,method,shlock);

  // Query Mongo
  shlocks.find(function(err,docs) {findHandler(err,docs,self.res, url)});
});

app.router.get('/shlocks',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url);
  shlock.body = body;
  app.log.info(url,method,shlock);

  // Query Mongo
  shlocks.find(function(err,docs) {findHandler(err,docs,self.res, url)});
});

app.log.info('Flatiron app: starting');
app.http.before = [
  ecstatic('.')
];
app.start(80);

var io = require('socket.io').listen(app.server);

io.sockets.on('connection', function(socket) {

  socket.on('client', function (data) {
    data.source = mUser;
    shlocks.save(data,saveCallback);
    app.log.info('client shlock:',data);
  });
  socket.on('point', function(data) {
    app.log.info('point shlock: ',data);
    data.point = [data.coordX, data.coordY];
    socket.broadcast.emit('point',data);
    data.source = mUser;
    force.save(data,saveCallback);
  });
});

function Circle(r, fill) {
  this.r = r;
  this.fill = fill;
};

// Takes radius and color from req.body and emits event to update a d3 circle.
app.router.post('/pulse',function(){
  var self = this;
  var body = self.req.body;
  postHandler('/pulse', body, self.res, pulse);
  // Update circles on clients.
  var circle = new Circle(body.r,body.fill);
  io.sockets.emit('pulse', circle);
});

// Takes req.body and saves it into the audit collection.
app.router.post('/audit',function () {
  var self = this;
  var body = self.req.body;
  postHandler('/audit', body, self.res, audit);
});

app.log.info(app.router.routes);
