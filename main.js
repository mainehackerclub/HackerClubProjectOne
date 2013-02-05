/*
 * Main.js 
 *
 * Initializes Flation application.
 * Defines Socket.io events & handlers.
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
  ecstatic = require('ecstatic'),
  request = require('request');

// Activate Flatiron plugins
app.use(flatiron.plugins.http);

// Set config module to read environment variables.
//
app.config.use('env');
var v = validateEnv();

// Constants
//
var JSONtype = { 'Content-Type': 'application/json' },
    apiUrl = v.API_HOST+':'+v.API_PORT;


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
//winston.add(winston.transports.Loggly,logglyOpt);
winston.info('=================== STARTING APP =================');

// Reads all environment variables and returns then as an object.
// If any variable is missing from the environment the node process will exit.
function validateEnv() {
  winston.info('Validating Environment');
  console.log(process.env);
  var fail = false;
  var v = {};
  var envVariables = 
        [ 'NODE_ENV','LOCATION',
         'MAIN_PORT','API_PORT','API_HOST'];
  for (i in envVariables) {
    var item = envVariables[i];
    var envValue = process.env[item];
    winston.info(' env variable ',item,' value ',envValue);
    if (fail && envValue === undefined) {
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

// Configuring serving of static files.
// e.g. circle.html, force.html, index.html
app.http.before = [
  ecstatic('.')
];

winston.info('Running on port: '+v.MAIN_PORT+' in NODE_ENV: '+ v.NODE_ENV + ' on ' + v.LOCATION );
app.start(8080);

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
// Display all configured API endpoints, aka routes.
winston.info('route',util.inspect(app.router.routes));

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
  s.system = v.LOCATION;
  winston.info(util.inspect(s));
  // API CALL REPLACE
  // shlocks.save(s);
  request({url:apiUrl+'/shlocks', method:'POST', json:true, body:s},function(err,res,body) {
    winston.info(util.inspect(body));
  });
}

// Socket.io server disconnect event handler
function disconnectHandler(io,source) {
  io.sockets.emit('load',getConnections(io));
  var s = new Shlock('socket.io','disconnect','unknown');
  s.source = source;
  s.system = v.LOCATION;
  winston.info(util.inspect(s));
  // API CALL REPLACE
  //shlocks.save(s);
  request({url:apiUrl+'/shlocks', method:'POST', json:true, body:s},function(err,res,body) {
    winston.info(util.inspect(body));
  });
}

var io = require('socket.io').listen(app.server);
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
    data.system = v.LOCATION;
    data.source = 'socket.io.client';
  // API CALL REPLACE
  //  shlocks.save(data,saveCallback);
    request({url:apiUrl+'/shlocks', method:'POST', json:true, body:data},function(err,res,body) {
      winston.info(util.inspect(body));
    });
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
    data.system = v.LOCATION;
    data.source = 'socket.io.client';
  // API CALL REPLACE
  //  force.save(data,saveCallback);
    request({url:apiUrl+'/force', method:'POST', json:true, body:data},function(err,res,body) {
      winston.info(util.inspect(body));
    });
  });

  // Time to drive the replay visualization.
  socket.on('replay', function(data) {
    var throttle = 100,
        length = 100;

    // Pull fixed number of items from the DB
    // Establish Timeout / Interval

  });

});

io.sockets.on('disconnect', function(socket) {
  disconnectHandler(io,socket,'socket.io.server');
});
