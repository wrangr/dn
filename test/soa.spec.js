var assert = require('assert');
var dn = require('../');

function assertSOA(obj) {
  assert.equal(obj.type, 'SOA');
  assert.equal(typeof obj.name, 'string');
  assert.equal(typeof obj.ttl, 'number');
  assert.equal(typeof obj.primary, 'string');
  assert.equal(typeof obj.admin, 'string');
  assert.equal(typeof obj.serial, 'number');
  assert.equal(typeof obj.refresh, 'number');
  assert.equal(typeof obj.retry, 'number');
  assert.equal(typeof obj.expiration, 'number');
  assert.equal(typeof obj.minimum, 'number');
  assert.equal(typeof obj.addresses.length, 'number');
  obj.addresses.forEach(function (address) {
    var parts = address.split('.');
    assert.equal(parts.length, 4);
    parts.forEach(function (part) {
      assert.ok(/^\d{1,3}$/.test(part));
    });
  });
}

describe('dn.soa()', function () {

  it('should get google.com\'s SOA record', function (done) {
    dn.soa('google.com', function (err, data) {
      assert.ok(!err);
      assertSOA(data);
      assert.equal(data.name, 'google.com');
      done();
    });
  });

  it('should deal with subdomains (espn.go.com)', function (done) {
    dn.soa('espn.go.com', function (err, data) {
      assert.ok(!err);
      assertSOA(data);
      assert.equal(data.name, 'go.com');
      done();
    });
  });

});

