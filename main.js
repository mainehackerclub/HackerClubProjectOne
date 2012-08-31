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
  ecstatic = require('ecstatic'),
  mongo = require('mongojs').connect('hcp1');

app.use(flatiron.plugins.http);
var audit = mongo.collection('audit');
var shlocks = mongo.collection('shlocks');
var force = mongo.collection('force');
var pulse = mongo.collection('pulse');
var JSONtype = { 'Content-Type': 'application/json' };

function Shlock(kind, method, url, data) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.data = data;
  this.milliseconds = new Date().getTime();
};

 Shlock.prototype.toString = function() {
   var self = this;
   var ms = self.milliseconds;
   var d = new Date().setTime(ms);
   return self.kind+' '+self.method+' '+self.url+' '+d.toLocaleString();
 }

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
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);
  coll.save(shlock);
};

// Handle Errors for GET API calls.
function getHandlerError(res,url) {
  writeMeta(res,501,url,0);
  res.end('\n');
}

app.router.get('/audit',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);

  // Query Mongo
  audit.find(function(err,docs) {
    if (!err) {
      var length = docs.length;
      writeMeta(self.res,200,url,length);
      // Process results from Mongo
      docs.forEach(function(e,i,a) {
        console.log(e,i,a);
        self.res.write(JSON.stringify(e)+'\n');
      });

      self.res.end('\n');
    } else {
      getHandlerError(self.res,url);
    }
  });
});

app.router.get('/force',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/force';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);

  // Query Mongo
  force.find(function(err,docs) {
    if (!err) {
      // Return Success & JSON Content-type
      var length = docs.length;
      writeMeta(self.res,200,url,length);

      // Process results from Mongo
      docs.forEach(function(e,i,a) {
        console.log(e,i,a);
        self.res.write(JSON.stringify(e)+'\n');
      });

      // Finalize response.
      self.res.end('\n');
    } else {
      getHandlerError(self.res,url);
    }
  });
});

app.router.get('/pulse',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/pulse';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);

  // Query Mongo
  pulse.find(function(err,docs) {
    if (!err) {
      // Return Success & JSON Content-type
      var length = docs.length;
      writeMeta(self.res,200,url,length);

      // Process results from Mongo
      docs.forEach(function(e,i,a) {
        console.log(e,i,a);
        self.res.write(JSON.stringify(e)+'\n');
      });

      // Finalize response.
      self.res.end('\n');
    } else {
      getHandlerError(res,url);
    }
  });
});

app.router.get('/shlocks',function() {
  // Setup
  var self = this;
  var method = 'GET';
  var url = '/shlocks';
  var body = self.req.body;
  
  // Create metrics data.
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);

  // Query Mongo
  shlocks.find(function(err,docs) {
    if (!err) {
      // Return Success & JSON Content-type
      var length = docs.length;
      writeMeta(self.res,200,url,length);

      // Process results from Mongo
      docs.forEach(function(e,i,a) {
        console.log(e,i,a);
        self.res.write(JSON.stringify(e)+'\n');
      });

      // Finalize response.
      self.res.end('\n');
    } else {
      getHandlerError(res,url);
    }
  });
});

console.log('Flatiron app: starting');
app.http.before = [
  ecstatic('.')
];
app.start(80);

var io = require('socket.io').listen(app.server);

io.sockets.on('connection', function(socket) {

  socket.on('client', function (data) {
    var x = data.kind;
    var d = data.data;
    shlocks.save(data);
    console.log('client shlock:',data);
  });
  socket.on('point', function(data) {
    console.log('point shlock: ',data);
    socket.broadcast.emit('point',data);
    force.save(data);
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
