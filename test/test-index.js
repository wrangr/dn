//
// Deps
//
var assert = require('assert');
var util = require('util');
var dns = require('dns');
var rewire = require('rewire');
var sinon = require('sinon');
var nock = require('nock');
var _ = require('lodash');


// `MockError` extends `Error` to allow for cleaner tests below.
function MockError(code) {
  Error.call(this);
  this.message = '';
  this.code = code;
}
util.inherits(MockError, Error);


// Load the `dn` module using `rewire` instead of `require` so we can inject
// mock dependencies.
var dn = rewire('../');


//
// Tests
//

describe('dn.probe()', function () {

  it('should throw dn.ParseError and blame caller if arg is not a string', function (done) {
    dn.probe().catch(dn.ParseError, function (err) {
      assert.ok(err instanceof dn.ParseError);
      assert.ok(/string/i.test(err.message));
      assert.equal(err.code, 'PARSE_ENOTSTRING');
      assert.equal(err.kind, 'parse');
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError and blame caller for ""', function (done) {
    dn.probe('').catch(dn.ParseError, function (err) {
      assert.ok(err instanceof dn.ParseError);
      assert.ok(/too short/i.test(err.message));
      assert.equal(err.code, 'DOMAIN_TOO_SHORT');
      assert.equal(err.kind, 'parse');
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError and blame caller for "aaa bbb"', function (done) {
    dn.probe('aaa bbb').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'LABEL_INVALID_CHARS');
      assert.ok(/alphanum/i.test(err.message));
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.ParseError and blame caller for "x.local"', function (done) {
    dn.probe('x.yz').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'PARSE_ENOTLISTED');
      assert.ok(/public suffix/i.test(err.message));
      assert.equal(err.blame, 'caller');
      done();
    });
  });

  it('should throw dn.DNSError and blame target when name servers not found', function (done) {
    var stub = sinon.stub();
    stub.callsArgWith(1, new MockError(dns.NOTFOUND));
    var revert = dn.__set__('dns', _.extend({}, dns, { resolveNs: stub }));
    dn.probe('foo.org').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'DNS_NS_ENOTFOUND');
      assert.ok(/name servers/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should throw dn.DNSError and blame target when we get empty reply when resolving getting name servers', function (done) {
    var stub = sinon.stub();
    stub.callsArgWith(1, new MockError(dns.NODATA));
    var revert = dn.__set__('dns', _.extend({}, dns, { resolveNs: stub }));
    dn.probe('foo.host').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'DNS_NS_ENODATA');
      assert.ok(/empty response/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should throw dn.DNSError and blame network on dns.resolveNs timeout', function (done) {
    var stub = sinon.stub();
    stub.callsArgWith(1, new MockError(dns.TIMEOUT));
    var revert = dn.__set__('dns', _.extend({}, dns, { resolveNs: stub }));
    dn.probe('foo.host').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'DNS_NS_ETIMEOUT');
      assert.ok(/dns error/i.test(err.message));
      assert.equal(err.blame, 'network');
      revert();
      done();
    });
  });

  it('should throw dn.DNSError and blame network on dns.resolve timeout', function (done) {
    // Mock DNS calls.
    var resolveNsStub = sinon.stub();
    resolveNsStub.callsArgWith(1, null, [ 'ns2.foo.com', 'ns.foo.com' ]);
    var resolveStub = sinon.stub();
    resolveStub.callsArgWith(1, new MockError(dns.TIMEOUT));
    var revert = dn.__set__('dns', _.extend({}, dns, {
      resolveNs: resolveNsStub,
      resolve: resolveStub
    }));
    dn.probe('foo.host').catch(dn.DNSError, function (err) {
      assert.equal(err.kind, 'dns');
      assert.equal(err.code, 'DNS_A_ETIMEOUT');
      assert.ok(/dns error/i.test(err.message));
      assert.equal(err.blame, 'network');
      revert();
      done();
    });
  });

  it('should throw dn.RequestError and blame target when ECONNRESET request error', function (done) {
    var revert = dn.__set__('request', function (opt, cb) {
      cb(new MockError('ECONNRESET'));
    });

    dn.baseurl('foo.com').catch(function (err) {
      assert.equal(err.kind, 'request');
      assert.equal(err.code, 'REQUEST_ECONNRESET');
      assert.ok(/hang up/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should throw dn.RequestError and blame target when ECONNREFUSED request error', function (done) {
    var revert = dn.__set__('request', function (opt, cb) {
      cb(new MockError('ECONNREFUSED'));
    });

    dn.baseurl('foo.com').catch(function (err) {
      assert.equal(err.kind, 'request');
      assert.equal(err.code, 'REQUEST_ECONNREFUSED');
      assert.ok(/refused/i.test(err.message));
      assert.equal(err.blame, 'target');
      revert();
      done();
    });
  });

  it('should throw dn.RequestError and blame network when EPIPE', function (done) {
    var revert = dn.__set__('request', function (opt, cb) {
      cb(new MockError('EPIPE'));
    });

    dn.baseurl('foo.net').catch(function (err) {
      assert.equal(err.kind, 'request');
      assert.equal(err.code, 'REQUEST_EPIPE');
      assert.equal(err.blame, 'network');
      revert();
      done();
    });
  });

  it('should handle HPE_INVALID_CONSTANT error when resolving baseurl', function (done) {
    // Mock DNS calls.
    var resolveNsStub = sinon.stub();
    resolveNsStub.callsArgWith(1, null, [ 'ns2.foo.com', 'ns.foo.com' ]);
    var resolveStub = sinon.stub();
    resolveStub.callsArgWith(1, null, [ '1.2.3.4' ]);
    var revertDns = dn.__set__('dns', _.extend({}, dns, {
      resolveNs: resolveNsStub,
      resolve: resolveStub
    }));
    var revertRequest = dn.__set__('request', function (opt, cb) {
      if (opt.method === 'HEAD') {
        return cb(new MockError('HPE_INVALID_CONSTANT'));
      }
      return require('request')(opt, cb);
    });
    // Mock HTTP requests.
    nock('http://foo.com')
      .get('/')
      .reply(200);

    dn.probe('foo.com').done(function (info) {
      assert.equal(info.baseurl.href, 'http://foo.com/');
      revertDns();
      revertRequest();
      done();
    });
  });

  it('should handle 40x and 50x');
  it('should handle viabcp');
  it('should handle google.com');
  it('should warn sites with non-redirecting www and non-www');

  it('should follow redirect to HTTPS', function (done) {
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

  it('should follow redirect to www subdomain', function (done) {
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

