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
    server = v.API_HOST+':'+v.API_PORT;

function Shlock(kind, method, url ) {
  this.kind = kind;
  this.method = method;
  this.url = url;
  this.time = new Date().toJSON();
};

/*
 * Tests for API endpoint: /force
 * - Count should increment after a succesful POST.
 */
var path = '/force',
    query = '?count=true';
url = server+path+query;
// Request intial count
request.get(url,function(err,resp,body) {
  assert.equal(err,null,url+" not OK");
  var data = JSON.parse(body);
  first = data.count;
  assert.ok(data.count > 0,"body not greater than zero.");
  assert.equal(data.status ,"success");
  assert.equal(data.path ,path);

  query = '';
  url = server+path+query;

  var payload = new Shlock('api','POST','/force'),
      options = {url:url, json:true, body:payload};
  // Post an additional item.
  request.post(options,function(err,resp,body) {
    assert.equal(err,null,url+" not OK");
    winston.info(util.inspect(body));
    assert.equal(body.status, "success");
    assert.equal(body.path, path);
    assert.equal(body.count, 0);

    query = '?count=true';
    url = server+path+query;
    // Request second count, which should be incremented by one.
    request.get(url,function(err,resp,body) {
      assert.equal(err,null,url+" not OK");
      var data = JSON.parse(body);
      second = data.count;
      assert.ok(data.count > 0,"body not greater than zero.");
      winston.info('first ' + first + ' second ' + second);
      assert.ok(second > first,"second not greater than first.");
      assert.equal(first+1,second);
      assert.equal(data.status ,"success");
      assert.equal(data.path ,path);
    });
  });
});

/*
 * Tests for API endpoint: /shlocks
 * - Count should increment after a succesful POST.
 */
path = '/shlocks';
query = '?count=true';
url = server+path+query;
// Request intial count
request.get(url,function(err,resp,body) {
  assert.equal(err,null,url+" not OK");
  var data = JSON.parse(body);
  first = data.count;
  assert.ok(data.count > 0,"body not greater than zero.");
  assert.equal(data.status ,"success");
  assert.equal(data.path ,path);

  query = '';
  url = server+path+query;

  var payload = new Shlock('api','POST','/shlocks'),
      options = {url:url, json:true, body:payload};
  // Post an additional item.
  request.post(options,function(err,resp,body) {
    assert.equal(err,null,url+" not OK");
    winston.info(util.inspect(body));
    assert.equal(body.status, "success");
    assert.equal(body.path, path);
    assert.equal(body.count, 0);

    query = '';
    url = server+path+query;
    // Request second count, which should be incremented by one.
    request.get(url,function(err,resp,body) {
      assert.equal(err,null,url+" not OK");
      var data = JSON.parse(body);
      second = data.count;
      assert.ok(data.count > 0,"body not greater than zero.");
      winston.info('first ' + first + ' second ' + second);
      assert.ok(second > first,"second not greater than first.");
      assert.equal(first+1,second);
      assert.equal(data.status ,"success");
      assert.equal(data.path ,path);
    });
  });
});

});
