//
// Deps
//
var dns = require('dns');
var url = require('url');
var request = require('request');
var BluebirdPromise = require('bluebird');
var psl = require('psl');


//
// Public API
//

var dn = module.exports = {};

// Extend with error stuff.
require('./lib/error')(dn);

dn.parse = function (domain) {
  return new BluebirdPromise(function (resolve, reject) {
    try {
      var parsed = psl.parse(domain);
      if (parsed.error) {
        return reject(new dn.ParseError(parsed.error));
      }
      if (!parsed.listed) {
        return reject(new dn.ParseError({
          message: dn.DOMAIN_NOT_LISTED,
          code: 'DOMAIN_NOT_LISTED',
        }));
      }
      resolve(parsed);
    } catch (err) {
      return reject(err);
    }
  });
};

// Resolve name servers.
dn.ns = function (domain) {
  return new BluebirdPromise(function (resolve, reject) {
    dns.resolveNs(domain, function (err, ns) {
      if (err) {
        if (err.code === dns.NODATA) {
        } else if (err.code === dns.NOTFOUND) {
          reject(err);
        } else {
          return reject(err);
        }
      }
      resolve(ns);
    });
  });
};

dn.resolve = function (domain) {
  return new BluebirdPromise(function (resolve, reject) {
    dns.resolve(domain, function (err, addresses) {
      if (err) { return reject(err); }
      resolve(addresses);
    });
  });
};

dn.baseurl = function (domain) {
  var urlObj = {
    protocol: 'http:',
    hostname: domain
  };

  var reqOpt = {
    url: url.format(urlObj),
    method: 'HEAD'
  };

  return new BluebirdPromise(function (resolve, reject) {
    function handleBaseurl(href) {
      var ret = { href: href };
      var hrefObj = url.parse(href);
      ret.isExternalRedirect = (hrefObj.hostname !== urlObj.hostname);
      ret.forceSSL = (hrefObj.protocol !== urlObj.protocol);
      resolve(ret);
    }

    request(reqOpt, function (err, res) {
      if (err && err.code === 'HPE_INVALID_CONSTANT') {
        // In some weird cases we get http parse errors when using the `HEAD`
        // method, so when that happens try a GET request.
        // See:
        // https://github.com/mikeal/request/issues/350
        // https://github.com/joyent/node/issues/4863
        reqOpt.method = 'GET';
        request(reqOpt, function (err, res) {
          if (err) { return reject(err); }
          handleBaseurl(res.request.href);
        });
      } else if (err) {
        reject(err);
      } else {
        handleBaseurl(res.request.href);
      }
    });
  });
};

dn.probe = function (domain) {

  var info = { input: domain };

  return new BluebirdPromise(function (resolve, reject) {

    dn.parse(domain).then(function (parsed) {
      info.parsed = parsed;
      return dn.ns(domain);
    }).then(function (ns) {
      if (!ns) { return resolve(info); }
      info.ns = ns;
      return dn.resolve(domain);
    }).then(function (addresses) {
      if (!addresses) { return resolve(info); }
      info.addresses = addresses;
      return dn.baseurl(domain);
    }).then(function (baseurl) {
      if (!baseurl) { return resolve(info); }
      info.baseurl = baseurl;
      resolve(info);
    }).error(function (err) {
      reject(err);
    });

  });

};

