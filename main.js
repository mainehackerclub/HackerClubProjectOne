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
var events = mongo.collection('events');
var JSONtype = { 'Content-Type': 'application/json' };

function Event(kind, method, url, data) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.data = data;
};

function Event( obj ) {
  this.kind = obj.kind;
  this.method = obj.method;
  this.url = obj.url;
  this.data = obj.data;
};

 Event.prototype.toString = function() {
   var self = this;
   return self.kind+' '+self.mmethod+' '+self.url;
 }

function Meta(status, path, count) {
  this.status = status;
  this.path = path;
  this.count = count;
}

app.router.post('/audit',function () {
  var self = this;
  var req = util.inspect(self.req.body, true, 3, true) + '\n';
  var meta = new Meta('success', '/audit', 0);
  console.log(req);
  self.res.writeHead(200, JSONtype);
  self.res.write(JSON.stringify(meta));
  self.res.end('\n');
  var event = new Event('api', 'post', '/audit', self.req.body);
  audit.save(event);
  console.log(event);
});

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

app.router.get('/events',function() {
  var self = this;
  var req = util.inspect(self.req.body, true, 3, true) + '\n';
  console.log(req);

  events.find(function(err,docs) {
    if (!err) {
      var code = 200;
      var length = docs.length;
      var meta = new Meta('success','/events',length);
      self.res.writeHead(code, JSONtype);
      self.res.write(JSON.stringify(meta) + ',\n');
      self.res.write(JSON.stringify(docs));
      self.res.end('\n');
    } else {
      var code = 501;
      var meta = new Meta('Internal server error','/events',length);
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

  socket.on('clientIP', function (data) {
    console.log(data);
    var x = data.kind;
    var d = data.data;
    socket.emit('hit', {IP: data.data.IP, ID: data.data.ID});
    events.save(data);
  });
  socket.on('force', function(data) {
    console.log('force event: ',data);
    var ev = new Event(data);
    console.log(ev.toString());
  });
  socket.on('point', function(data) {
    console.log('point event: ',data);
    socket.broadcast.emit('point',data);
  });
});

function Circle(r, fill) {
  this.r = r;
  this.fill = fill;
};

app.router.post('/pulse',function(){
  var self = this;
  var data = self.req.body;
  console.log(data);
  var circle = new Circle(data.r,data.fill);
  io.sockets.emit('pulse', circle);
  var code = 200;
  var meta = new Meta('success','/pulse',0);
  self.res.writeHead(code,JSONtype);
  self.res.write(JSON.stringify(meta) + ',\n');
  self.res.end('\n');
});
