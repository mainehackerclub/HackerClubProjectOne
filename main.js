/*
 * Main.js 
 *
 * Initializes Flation application.
 * Defines Socket.io events & handlers.
 * Connects to Mongo as a data store.
 * Writes logs to console & Loggly service.
 *
 */

var http = require('http');
var static = require('node-static');
var file = new(static.Server)('.');

var Color  = require('color'),
  util = require('util'),
  winston = require('winston'),
  request = require('request');

var HOST = 'localhost';
var PORT = 1339;
// var apiUrl = v.API_HOST+':'+v.API_PORT;
var server = http.createServer(function(req,res) {
  console.log('HTTP request',req.method,req.url);
  switch (req.url)
  {
    default:
      file.serve(req,res);
  }
  console.log('HTTP respone',res.statusCode);
}).listen(PORT);
winston.info('Running on port: '+ PORT  );

// Object used for holding analytics data.
function Shlock(kind, method, url ) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.time = new Date().toJSON();
};

function Circle(r, fill) {
  this.r = r;
  this.fill = fill;
};

// Each client will be assigned a random color and radius 
// for the circles that they create.
// Returns a color object with randomly generated color;
function randomColor() {
  var color = Color();
  var temp =  Math.floor(Math.random()*255);
  color.red(temp);
  temp =  Math.floor(Math.random()*255);
  color.green(temp);
  temp =  Math.floor(Math.random()*255);
  color.blue(temp);
  return color;
}

// Returns a random radius
function randomR() {
  return Math.floor(Math.random()*20+4.5);
}

// Realtime communication with the browser via socket.io.

function getConnections(io) {
  var data = {};
  data.sockets = io.sockets.clients().length;
  return data;
}

// Socket.io server disconnect event handler
function connectHandler(io,socket,source) {
  socket.broadcast.emit('load',getConnections(io));
  socket.emit('load',getConnections(io));
  var s = new Shlock('socket.io','connect','unknown');
  s.source = source;
  winston.info(util.inspect(s));
  // API CALL
  //request({url:apiUrl+'/shlocks', method:'POST', json:true, body:s},function(err,res,body) { winston.info(util.inspect(body)); });
}

// Socket.io server disconnect event handler
function disconnectHandler(io,source) {
  io.sockets.emit('load',getConnections(io));
  var s = new Shlock('socket.io','disconnect','unknown');
  s.source = source;
  winston.info(util.inspect(s));
  // API CALL
  //request({url:apiUrl+'/shlocks', method:'POST', json:true, body:s},function(err,res,body) { winston.info(util.inspect(body)); });
}

var io = require('socket.io').listen(server);
io.sockets.on('connection', function(socket) {

  connectHandler(io,socket,'socket.io.server');

  // Establishing random color for this client.
  var color = randomColor();
  socket.set('color',color.hexString(), function(color) {
   winston.info(util.inspect(color));
  });
  
  // Establishing random node size for this client.
  var r = randomR();
  socket.set('r',r, function(r) {
   winston.info(util.inspect(r));
  });
  var attrs = {};
  attrs.color = color.hexString();
  attrs.r = r;
  socket.emit('nodeAttr',attrs);
  winston.info(util.inspect(attrs));

  socket.on('disconnect', function() {
    setTimeout(disconnectHandler,200,io,'socket.io.client');
  });
  
  socket.on('client', function (data) {
    data.source = 'socket.io.client';
    // API CALL
    //request({url:apiUrl+'/shlocks', method:'POST', json:true, body:data},function(err,res,body) { winston.info(util.inspect(body)); });
    winston.info(util.inspect(data));
  });
  
  socket.on('point', function(data) {
    winston.info(util.inspect(data));
    data.point = [data.coordX, data.coordY];
    // Every point broadcast by a client will contain its 
    // random color and radius
    socket.get('color',function(err,color) {
      data.color = color;
    });
    socket.get('r',function(err,r) {
      data.r = r;
    });
    // Sending point click event to all clients.
    socket.broadcast.emit('point',data);
    data.source = 'socket.io.client';
    // API CALL
    //request({url:apiUrl+'/force', method:'POST', json:true, body:data},function(err,res,body) { winston.info(util.inspect(body)); });
  });

  // Time to drive the replay visualization.
  socket.on('replay', function(data) {
    var throttle = 100,
        length = 100;

    // TODO:  Pull fixed number of items from the DB
    // Establish Timeout / Interval

  });

});

io.sockets.on('disconnect', function(socket) {
  disconnectHandler(io,socket,'socket.io.server');
});
