var dn = require('../');

describe('dn.dig()', function () {

  it.only('should...', function (done) {
    dn.dig('github.com', 'ANY',  function (err, data) {
      console.log(err, data);
      done();
    });
  });

  it('should...', function (done) {
    dn.dig('wrangr.com', 'ANY',  function (err, data) {
      console.log(err, data);
      done();
    });
  });

});

