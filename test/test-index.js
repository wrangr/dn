var assert = require('assert');
var dn = require('../');

describe('dn.probe()', function () {

  it('should throw if arg is not a string', function (done) {
    assert.throws(function () {
      dn.probe();
    }, /string/i);
    done();
  });

  it('sdajhb shbasj', function (done) {
    dn.probe('aaa bbb', function (err, info) {
      assert.ok(!err);
      console.log(info);
      done();
    });
  });

  it('should gracefully get info for empty domain', function (done) {
    dn.probe('', function (err, info) {
      assert.ok(!err);
      console.log(info);
      done();
    });
  });

  it('should gracefully get info for invalid domain');

  it('should get full info on good domain without subdomain', function (done) {
    dn.probe('wrangr.com', function (err, info) {
      assert.ok(!err);
      console.log(info);
      done();
    });
  });

  it.only('should get full info on good domain with subdomain', function (done) {
    dn.probe('lilianacosta.com', function (err, info) {
      //assert.ok(!err);
      console.log(err, info);
      done();
    });
  });

});

