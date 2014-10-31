var dn = require('../');

describe('dn.dns()', function () {

  it.only('should...', function (done) {
    dn.dns('1234567890-abs-askjn-12jn-sdjk.co.uk', function (err, data) {
      console.log(err, data);
      done();
    });
  });

  it.only('should...', function (done) {
    dn.dns('wrangr.com', function (err, data) {
      console.log(err, data);
      done();
    });
  });

});

