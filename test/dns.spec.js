var assert = require('assert');
var _ = require('lodash');
var dn = require('../');

describe('dn.dns()', function () {

  this.timeout(5000);

  it('should get empty answer when no records', function (done) {
    dn.dns('1234567890-abs-askjn-12jn-sdjk.co.uk', function (err, data) {
      assert.ok(!err);
      assert.ok(_.isArray(data.answer));
      assert.equal(data.answer.length, 0);
      assert.ok(_.isArray(data.authority));
      assert.equal(data.authority.length, 1);
      assert.equal(data.authority[0].type, 'SOA');
      done();
    });
  });

  it('should get records for wrangr.com', function (done) {
    dn.dns('wrangr.com', function (err, data) {
      assert.ok(!err);
      assert.ok(_.isArray(data.answer));
      assert.ok(data.answer.length > 0);
      done();
    });
  });

  it('should get records for apple.com', function (done) {
    dn.dns('apple.com', function (err, data) {
      assert.ok(!err);
      assert.ok(_.isArray(data.answer));
      assert.ok(data.answer.length > 0);
      //console.log(data.answer);
      done();
    });
  });

});

