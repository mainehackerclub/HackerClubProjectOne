/*
 * Main.js 
 *
 */

var flatiron = require('flatiron'),
  app = flatiron.app,
  util = require('util'),
  mongo = require('mongojs').connect('hcp1');


app.use(flatiron.plugins.http);
var audit = mongo.collection('audit');

function MongoDump() {
  console.log('MongoDump - Showing Contents of Audit Table');
  audit.find(function(err,docs) {
    for (i in docs) {
      console.log(i,docs[i]);    
    }
  });
}

app.router.post('/',function () {
  console.log('POST /');
  var req = util.inspect(this.req.body, true, 3, true) + '\n';
  console.log(req);
  this.res.writeHead(200, { 'Content-Type': 'application/json' });
  this.res.write('{"status":"success"}');
  this.res.end('\n');
  audit.save(this.req.body);
  MongoDump();
});

console.log('Flatiron app: starting');
app.start(8082);
