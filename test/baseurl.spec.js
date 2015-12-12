'use strict';


const Assert = require('assert');
const Nock = require('nock');
const Dn = require('../');


describe('Dn.baseurl()', function () {

  this.timeout(30000);


  it('should throw when domain is not String or psl parsed obj', () => {

    [null, undefined, 1, [], new Date(), function () {}, {}].forEach((val) => {

      Assert.throws(() => {

        Dn.baseurl(val, () => {});
      }, (err) => {

        return err instanceof TypeError && /string/i.test(err);
      });
    });
  });


  it('should throw when invalid domain', () => {

    Assert.throws(() => {

      Dn.baseurl('^%$Bbysyg&^T*&^..siui');
    }, (err) => {

      return /invalid url/i.test(err.message);
    });
  });


  it('should pick primary based on input', (done) => {

    Nock('http://foo.com').get('/').reply(200, 'Hello Foo', {});
    Nock('http://www.foo.com').get('/').reply(200, 'Hello Foo', {});
    Nock('https://foo.com').get('/').reply(200, 'Hello Foo', {});
    Nock('https://www.foo.com').get('/').reply(200, 'Hello Foo', {});

    Dn.baseurl('https://foo.com', { strictSSL: false }, (err, data) => {

      Assert(!err);
      Assert.equal(data.primary.key, 'https-naked');
      Assert.equal(data.primary.url, 'https://foo.com/');
      done();
    });
  });


  it('should handle site URL with subdir', (done) => {

    Nock('http://foo.com').get('/bar').reply(200, 'Hello Foo', {});
    Nock('http://www.foo.com').get('/bar').reply(200, 'Hello Foo', {});
    Nock('https://foo.com').get('/bar').reply(200, 'Hello Foo', {});
    Nock('https://www.foo.com').get('/bar').reply(200, 'Hello Foo', {});

    Dn.baseurl('www.foo.com/bar', { strictSSL: false }, (err, data) => {

      Assert(!err);
      Assert.equal(data.primary.key, 'https-www');
      Assert.equal(data.primary.url, 'https://www.foo.com/bar');
      done();
    });
  });


  it('should handle domain with single baseurl and 2 redirects (https invalid cert)', (done) => {

    Nock('http://wrangr.com').get('/').reply(301, 'wrangr', { location: 'https://wrangr.com' });
    Nock('http://www.wrangr.com').get('/').reply(301, 'wrangr', { location: 'https://wrangr.com' });
    Nock('https://wrangr.com').get('/').reply(200, 'wrangr', {});
    //Nock('https://www.wrangr.com').get('/').reply(200, 'wrangr', { location: 'https://wrangr.com' });

    Dn.baseurl('wrangr.com', (err, data) => {

      Assert(!err);
      //console.log(data);
      done();
    });
  });


  it('should handle domain with single baseurl and 3 redirects (bravo)');


  it.skip('should figure out baseurl for wrangr.com', (done) => {

    Dn.baseurl('wrangr.com', (err, data) => {

      Assert.ok(!err);

      ['http-naked', 'http-www', 'https-naked', 'https-www'].forEach((key) => {

        Assert.ok(data.hasOwnProperty(key));
        if (data[key] instanceof Error) {
          //console.log(data[key]);
        }
        else {
          Assert.ok(data[key].hasOwnProperty('statusCode'));
          Assert.ok(data[key].hasOwnProperty('headers'));
          //console.log(data[key]);
        }
      });

      done();
    });
  });


});

