/*
 * Main.js 
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

app.router.get('/audit',function() {

  var self = this;
  var req = util.inspect(self.req.body, true, 3, true) + '\n';
  console.log(req);

  audit.find(function(err,docs) {
    if (!err) {
      var code = 200;
      var length = docs.length;
      var meta = new Meta('success','/audit',length);
      self.res.writeHead(code, JSONtype);
      self.res.write(JSON.stringify(meta) + ',\n');
      self.res.write(JSON.stringify(docs));
      self.res.end('\n');
    } else {
      var code = 501;
      var status = {'status':'Internal server error','path':'/audit'};
      self.res.writeHead(code, JSONtype);
      self.res.write(JSON.stringify(status));
      self.res.end('\n');
    }
  });

});

app.router.get('/shlocks',function() {
  var self = this;
  var req = util.inspect(self.req.body, true, 3, true) + '\n';
  console.log(req);

  shlocks.find(function(err,docs) {
    if (!err) {
      var code = 200;
      var length = docs.length;
      var meta = new Meta('success','/shlocks',length);
      self.res.writeHead(code, JSONtype);
      self.res.write(JSON.stringify(meta) + ',\n');
      self.res.write(JSON.stringify(docs));
      self.res.end('\n');
    } else {
      var code = 501;
      var meta = new Meta('Internal server error','/shlocks',length);
      self.res.writeHead(code, JSONtype);
      self.res.write(JSON.stringify(meta));
      self.res.end('\n');
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

// POST Handler
//   Always returns status code 200 (success) to the client.
//   Creates metrics data and saves it to Mongo.
//   logs the event with metrics information.
function postHandler( url, body, res, coll) {
  var self = this;
  var method = 'POST';
  // Always return success
  var code = 200;
  var meta = new Meta('success',url,0);
  res.writeHead(code,JSONtype);
  res.write(JSON.stringify(meta) + ',\n');
  res.end('\n');
  // Create metrics data.
  var shlock = new Shlock('api', method, url, body);
  console.log(url,method,shlock);
  coll.save(shlock);
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
