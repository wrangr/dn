var assert = require('assert');
var dn = require('../');

describe('dn.probe()', function () {

  this.timeout(60 * 1000);

  it('should throw TypeError if arg is not a string', function (done) {
    dn.probe().catch(TypeError, function (err) {
      assert.ok(/string/i.test(err.message));
      done();
    });
  });

  it('should throw dn.ParseError for ""', function (done) {
    dn.probe('').catch(dn.ParseError, function (err) {
      assert.ok(err instanceof dn.ParseError);
      assert.ok(/too short/i.test(err.message));
      assert.equal(err.code, 'DOMAIN_TOO_SHORT');
      assert.equal(err.kind, 'parse');
      done();
    });
  });

  it('should throw dn.ParseError for "aaa bbb"', function (done) {
    dn.probe('aaa bbb').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'LABEL_INVALID_CHARS');
      assert.ok(/alphanum/i.test(err.message));
      done();
    });
  });

  it('should throw dn.ParseError for "x.local"', function (done) {
    dn.probe('x.yz').catch(dn.ParseError, function (err) {
      assert.equal(err.kind, 'parse');
      assert.equal(err.code, 'DOMAIN_NOT_LISTED');
      assert.ok(/public suffix/i.test(err.message));
      done();
    });
  });

  it('should get info with error property (no name servers) for "not-registered-zxtysiahjhbao-akj.org"', function (done) {
    dn.probe('not-registered-zxtysiahjhbao-akj.org').done(function (info) {
      console.log(info);
      done();
    });
  });

  it.only('should get full info on good domain without subdomain', function (done) {
    dn.probe('wrangr.com').done(function (info) {
      console.log(info);
      done();
    });
  });

  it('should get full info on good domain with subdomain', function (done) {
    dn.probe('lilianacosta.com').done(function (info) {
      //console.log(info);
      done();
    });
  });

});

