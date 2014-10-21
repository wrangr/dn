var assert = require('assert');
var util = require('util');
var dns = require('dns');
var rewire = require('rewire');
var sinon = require('sinon');
var nock = require('nock');
var _ = require('lodash');


function MockError(code) {
  Error.call(this);
  this.message = '';
  this.code = code;
}
util.inherits(MockError, Error);

var dn = rewire('../');

describe('dn.probe()', function () {

  this.timeout(60 * 1000);

  it('should throw dn.ParseError if arg is not a string', function (done) {
    dn.probe().catch(dn.ParseError, function (err) {
      assert.ok(err instanceof dn.ParseError);
      assert.ok(/string/i.test(err.message));
      assert.equal(err.code, 'DOMAIN_MUST_BE_STRING');
      assert.equal(err.kind, 'parse');
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError for ""', function (done) {
    dn.probe('').catch(dn.ParseError, function (err) {
      assert.ok(err instanceof dn.ParseError);
      assert.ok(/too short/i.test(err.message));
      assert.equal(err.code, 'DOMAIN_TOO_SHORT');
      assert.equal(err.kind, 'parse');
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError for "aaa bbb"', function (done) {
    dn.probe('aaa bbb').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'LABEL_INVALID_CHARS');
      assert.ok(/alphanum/i.test(err.message));
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError for "x.local"', function (done) {
    dn.probe('x.yz').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'DOMAIN_NOT_LISTED');
      assert.ok(/public suffix/i.test(err.message));
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.DNSError when name servers not found', function (done) {
    var stub = sinon.stub();
    stub.callsArgWith(1, new MockError(dns.NOTFOUND));
    var revert = dn.__set__('dns', _.extend({}, dns, { resolveNs: stub }));
    dn.probe('foo.org').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'NS_NOT_FOUND');
      assert.ok(/name servers/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should throw dn.DNSError when we get empty reply when resolving getting name servers', function (done) {
    var stub = sinon.stub();
    stub.callsArgWith(1, new MockError(dns.NODATA));
    var revert = dn.__set__('dns', _.extend({}, dns, { resolveNs: stub }));
    dn.probe('not.enoise.host').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'NS_NO_DATA');
      assert.ok(/empty response/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should get full info on good domain without subdomain', function (done) {
    // Mock DNS calls.
    var resolveNsStub = sinon.stub();
    resolveNsStub.callsArgWith(1, null, [ 'ns2.mainnameserver.com', 'ns.mainnameserver.com' ]);
    var resolveStub = sinon.stub();
    resolveStub.callsArgWith(1, null, [ '54.72.0.124' ]);
    var revert = dn.__set__('dns', _.extend({}, dns, {
      resolveNs: resolveNsStub,
      resolve: resolveStub
    }));
    // Mock HTTP requests.
    nock('http://wrangr.com')
      .head('/')
      .reply(301, '', { 'location': 'https://wrangr.com' });
    nock('https://wrangr.com')
      .head('/')
      .reply(200, '<html><body></body></html>');

    dn.probe('wrangr.com').done(function (info) {
      //console.log(info);
      revert();
      done();
    });
  });

  it('should get full info on good domain with subdomain', function (done) {
    // Mock DNS calls.
    var resolveNsStub = sinon.stub();
    resolveNsStub.callsArgWith(1, null, [ 'uma.ns.cloudfare.com', 'ed.ns.cloudfare.com' ]);
    var resolveStub = sinon.stub();
    resolveStub.callsArgWith(1, null, [ '104.28.25.91', '104.28.24.91' ]);
    var revert = dn.__set__('dns', _.extend({}, dns, {
      resolveNs: resolveNsStub,
      resolve: resolveStub
    }));
    // Mock HTTP requests.
    nock('http://lilianacosta.com')
      .head('/')
      .reply(301, '', { 'location': 'http://www.lilianacosta.com' });
    nock('http://www.lilianacosta.com')
      .head('/')
      .reply(200, '<html><body></body></html>');

    dn.probe('lilianacosta.com').done(function (info) {
      //console.log(info);
      done();
    });
  });

});

