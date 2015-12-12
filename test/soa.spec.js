'use strict';


const Assert = require('assert');
const Dn = require('../');


const assertSOA = function (obj) {

  Assert.equal(obj.type, 'SOA');
  Assert.equal(typeof obj.name, 'string');
  Assert.equal(typeof obj.ttl, 'number');
  Assert.equal(typeof obj.primary, 'string');
  Assert.equal(typeof obj.admin, 'string');
  Assert.equal(typeof obj.serial, 'number');
  Assert.equal(typeof obj.refresh, 'number');
  Assert.equal(typeof obj.retry, 'number');
  Assert.equal(typeof obj.expiration, 'number');
  Assert.equal(typeof obj.minimum, 'number');
  Assert.equal(typeof obj.addresses.length, 'number');

  obj.addresses.forEach((address) => {

    const parts = address.split('.');
    Assert.equal(parts.length, 4);
    parts.forEach((part) => {

      Assert.ok(/^\d{1,3}$/.test(part));
    });
  });
};


describe('Dn.soa()', () => {


  it('should get google.com\'s SOA record', (done) => {

    Dn.soa('google.com', (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.name, 'google.com');

      assertSOA(data);
      done();
    });
  });


  it('should deal with subdomains (espn.go.com)', (done) => {

    Dn.soa('espn.go.com', (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.name, 'go.com');

      assertSOA(data);
      done();
    });
  });

});

