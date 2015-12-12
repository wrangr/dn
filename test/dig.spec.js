'use strict';


const Dn = require('../');


describe.skip('Dn.dig()', () => {


  it('should...', (done) => {

    Dn.dig('github.com', 'ANY',  (err, data) => {

      console.log(err, data);
      done();
    });
  });


  it('should...', (done) => {

    Dn.dig('wrangr.com', 'ANY',  (err, data) => {

      console.log(err, data);
      done();
    });
  });


});

