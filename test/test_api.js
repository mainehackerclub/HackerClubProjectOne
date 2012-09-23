// Tests for HTTP API
//

var request = require('request'),
    util = require('util'),
    assert = require('assert'),
    winston = require('winston'),
    specify = require('specify');

// Testing state variables.
var first = 0,
    second = 0;

specify.run(function(assert) {

function validateEnv() {
  var v = {}, envVariables = [ 'API_HOST','API_PORT'];
  for (i in envVariables) { var item = envVariables[i]; v[item] = process.env[item]; };
  return v;
};

var v = validateEnv(),
    url = v.API_HOST+':'+v.API_PORT+'/shlocks?count=true';

function Shlock(kind, method, url ) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.time = new Date().toJSON();
};

request.get(url,function(err,resp,body) {
  assert.equal(err,null,url+" not OK");
  var data = JSON.parse(body);
  first = data.count;
  assert.ok(data.count > 0,"body not greater than zero.");
  assert.equal(data.status ,"success");
  assert.equal(data.path ,"/shlocks");

  url = v.API_HOST+':'+v.API_PORT+'/shlocks';

  var payload = new Shlock('api','POST','/shlocks'),
      options = {url:url, json:true, body:payload};
  request.post(options,function(err,resp,body) {
    assert.equal(err,null,url+" not OK");
    winston.info(util.inspect(body));
    assert.equal(body.status, "success");
    assert.equal(body.path, "/shlocks");
    assert.equal(body.count, 0);

    url = v.API_HOST+':'+v.API_PORT+'/shlocks?count=true';
    request.get(url,function(err,resp,body) {
      assert.equal(err,null,url+" not OK");
      var data = JSON.parse(body);
      second = data.count;
      assert.ok(data.count > 0,"body not greater than zero.");
      winston.info('first ' + first + ' second ' + second);
      assert.ok(second > first,"second not greater than first.");
      assert.equal(first+1,second);
      assert.equal(data.status ,"success");
      assert.equal(data.path ,"/shlocks");
    });
  });
});

});
