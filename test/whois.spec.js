'use strict';


const Assert = require('assert');
const Dn = require('../');


describe('Dn.whois()', () => {


  it('should fail when no whois server', (done) => {

    Dn.whois('armtalent.co.za', (err, data) => {

      Assert.ok(err instanceof Error);
      Assert.ok(/No known WHOIS server/i.test(err.message));
      Assert.ok(!data);
      done();
    });
  });


  it('should get WHOIS data for known tld', (done) => {

    Dn.whois('google.co.uk', (err, data) => {

      Assert.ok(!err);
      Assert.equal(typeof data, 'string');
      Assert.ok(/google\.co\.uk/i.test(data));
      Assert.ok(/whois lookup/i.test(data));
      done();
    });
  });


});
