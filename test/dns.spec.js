'use strict';


const Assert = require('assert');
const _ = require('lodash');
const Dn = require('../');


describe('Dn.dns()', function () {

  this.timeout(5000);


  it('should get empty answer when no records', (done) => {

    Dn.dns('1234567890-abs-askjn-12jn-sdjk.co.uk', (err, data) => {

      Assert.ok(!err);
      Assert.ok(_.isArray(data.answer));
      Assert.equal(data.answer.length, 0);
      Assert.ok(_.isArray(data.authority));
      Assert.ok(data.authority.length > 0);

      data.authority.forEach((record) => {

        Assert.equal(record.type, 'SOA');
      });

      done();
    });
  });


  it('should get records for wrangr.com', (done) => {

    Dn.dns('wrangr.com', (err, data) => {

      Assert.ok(!err);
      Assert.ok(_.isArray(data.answer));
      Assert.ok(data.answer.length > 0);
      done();
    });
  });


  it('should get records for apple.com', (done) => {

    Dn.dns('apple.com', (err, data) => {

      Assert.ok(!err);
      Assert.ok(_.isArray(data.answer));
      Assert.ok(data.answer.length > 0);
      //console.log(data.answer);
      done();
    });
  });

});

