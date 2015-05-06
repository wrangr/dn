var assert = require('assert');
var nock = require('nock');
var dn = require('../');

describe('dn.baseurl()', function () {

  this.timeout(30000);

  it('should throw when domain is not String or psl parsed obj', function () {
    [ null, undefined, 1, [], new Date(), function () {}, {} ].forEach(function (val) {
      assert.throws(function () {
        dn.baseurl(val, function (err, data) {});
      }, function (err) {
        return err instanceof TypeError && /string/i.test(err);
      });
    });
  });

  it('should throw when invalid domain', function () {
    assert.throws(function () {
      dn.baseurl('^%$Bbysyg&^T*&^..siui');
    }, function (err) {
      return /invalid url/i.test(err.message);
    });
  });

  it('should pick primary based on input', function (done) {
    nock('http://foo.com').get('/').reply(200, 'Hello Foo', {});
    nock('http://www.foo.com').get('/').reply(200, 'Hello Foo', {});
    nock('https://foo.com').get('/').reply(200, 'Hello Foo', {});
    nock('https://www.foo.com').get('/').reply(200, 'Hello Foo', {});
    dn.baseurl('https://foo.com', function (err, data) {
      assert(!err);
      assert.equal(data.primary.key, 'https-naked');
      assert.equal(data.primary.url, 'https://foo.com/');
      done();
    });
  });

  it('should handle site URL with subdir', function (done) {
    nock('http://foo.com').get('/bar').reply(200, 'Hello Foo', {});
    nock('http://www.foo.com').get('/bar').reply(200, 'Hello Foo', {});
    nock('https://foo.com').get('/bar').reply(200, 'Hello Foo', {});
    nock('https://www.foo.com').get('/bar').reply(200, 'Hello Foo', {});
    dn.baseurl('www.foo.com/bar', function (err, data) {
      assert(!err);
      assert.equal(data.primary.key, 'https-www');
      assert.equal(data.primary.url, 'https://www.foo.com/bar');
      done();
    });
  });

  it('should handle domain with single baseurl and 2 redirects (https invalid cert)', function (done) {
    nock('http://wrangr.com').get('/').reply(301, 'wrangr', { location: 'https://wrangr.com' });
    nock('http://www.wrangr.com').get('/').reply(301, 'wrangr', { location: 'https://wrangr.com' });
    nock('https://wrangr.com').get('/').reply(200, 'wrangr', {});
    //nock('https://www.wrangr.com').get('/').reply(200, 'wrangr', { location: 'https://wrangr.com' });
    dn.baseurl('wrangr.com', function (err, data) {
      assert(!err);
      //console.log(data);
      done();
    });
  });

  it('should handle domain with single baseurl and 3 redirects (bravo)');

  it.skip('should figure out baseurl for wrangr.com', function (done) {
    dn.baseurl('wrangr.com', function (err, data) {
      assert.ok(!err);
      var keys = [ 'http-naked', 'http-www', 'https-naked', 'https-www' ];
      keys.forEach(function (key) {
        assert.ok(data.hasOwnProperty(key));
        if (data[key] instanceof Error) {
          //console.log(data[key]);
        } else {
          assert.ok(data[key].hasOwnProperty('statusCode'));
          assert.ok(data[key].hasOwnProperty('headers'));
          //console.log(data[key]);
        }
      });
      done();
    });
  });

});

