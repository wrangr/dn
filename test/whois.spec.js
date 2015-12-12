'use strict';


const assert = require('assert');
const dn = require('../');


describe('dn.whois()', () => {


  it('should fail when no whois server', (done) => {

    dn.whois('armtalent.co.za', (err, data) => {

      assert.ok(err instanceof Error);
      assert.ok(/No known WHOIS server/i.test(err.message));
      assert.ok(!data);
      done();
    });
  });


  it('should get WHOIS data for known tld', (done) => {

    dn.whois('google.co.uk', (err, data) => {

      assert.ok(!err);
      assert.equal(typeof data, 'string');
      assert.ok(/google\.co\.uk/i.test(data));
      assert.ok(/whois lookup/i.test(data));
      done();
    });
  });


});

