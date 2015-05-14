var assert = require('assert');
var dn = require('../');


describe('dn.whois()', function () {

  it('should fail when no whois server', function (done) {
    dn.whois('armtalent.co.za', function (err, data) {
      assert.ok(err instanceof Error);
      assert.ok(/No known WHOIS server/i.test(err.message));
      assert.ok(!data);
      done();
    });
  });

  it('should get WHOIS data for known tld', function (done) {
    dn.whois('google.co.uk', function (err, data) {
      assert.ok(!err);
      assert.equal(typeof data, 'string');
      assert.ok(/google\.co\.uk/i.test(data));
      assert.ok(/whois lookup/i.test(data));
      done();
    });
  });

});

