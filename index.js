var dns = require('dns');
var psl = require('psl');


exports.baseurl = function (domain, cb) {

};

exports.probe = function (domain, cb) {

  var info = {
    input: domain,
    isRegistered: false,
    isWww: false,
    isSubdomain: false,
    isRedirect: false,
    dns: [],
    baseurl: null
  };

  var parsed = psl.parse(domain);

  if (parsed.error) {
    return cb(null, info);
  }

  info.parsed = parsed;

  // Resolve name servers.
  dns.resolveNs(domain, function (err, addresses) {
    if (err) { return cb(err); }
    info.dns = addresses;
    cb(null, info);
  });

};

