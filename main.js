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
var JSONtype = { 'Content-Type': 'application/json' };

function Shlock(kind, method, url, data) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.data = data;
  this.milliseconds = new Date().getTime();
};

function Shlock( obj ) {
  this.kind = obj.kind;
  this.method = obj.method;
  this.url = obj.url;
  this.data = obj.data;
  this.milliseconds = obj.milliseconds;
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

app.router.post('/audit',function () {
  var self = this;
  var req = util.inspect(self.req.body, true, 3, true) + '\n';
  var meta = new Meta('success', '/audit', 0);
  console.log(req);
  self.res.writeHead(200, JSONtype);
  self.res.write(JSON.stringify(meta));
  self.res.end('\n');
  var shlock = new Shlock('api', 'post', '/audit', self.req.body);
  audit.save(shlock);
  console.log(shlock);
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
  socket.on('force', function(data) {
    console.log('force shlock: ',data);
    var ev = new Shlock(data);
    console.log(ev.toString());
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
