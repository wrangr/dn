//
// Deps
//
var util = require('util');
var url = require('url');
var net = require('net');
var dns = require('native-dns');
var request = require('request');
var async = require('async');
var psl = require('psl');


//
// Public API
//

var dn = module.exports = {};


//
// Error codes
//

// Copy error codes from `psl`
Object.keys(psl.errorCodes).forEach(function (k) {
  dn['PARSE_' + k] = psl.errorCodes[k];
});

dn.DNS_NS_ENOTFOUND = 'No name servers found for domain';
dn.DNS_NS_ENODATA = 'Empty response from server';
dn.REQUEST_ECONNRESET = 'Socket hang up';
dn.REQUEST_ECONNREFUSED = 'Connection refused by server';

//
// Parse Error
//
dn.ParseError = function ParseError(obj) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  if (typeof obj === 'string') {
    this.code = obj;
    this.message = dn[obj];
  } else {
    this.message = obj.message;
    this.code = obj.code;
  }
  this.kind = 'parse';
  this.blame = 'caller';
};

util.inherits(dn.ParseError, Error);

//
// DNS Error
//
dn.DNSError = function DNSError(code, blame) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  if (dn[code]) {
    this.message = dn[code];
    this.code = code;
  } else {
    this.message = 'DNS Error.';
    this.code = code;
  }
  this.kind = 'dns';
  this.blame = blame || 'target';
};

util.inherits(dn.DNSError, Error);

dn.RequestError = function RequestError(err) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  var longCode = 'REQUEST_' + err.code;
  this.message = dn[longCode] || err.message;
  this.code = longCode;
  this.kind = 'request';
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
    this.blame = 'target';
  } else {
    this.blame = 'network';
  }
};

util.inherits(dn.RequestError, Error);


var types = [ 'A', 'AAAA', 'MX', 'TXT', 'SRV', /*'PTR',*/ 'NS', 'CNAME' ];


//
// Dig up DNS records for domain.
//
// @param `domain` String|Object Can be a string (ie: foo.com) or an object
// returned by `dn.parse()`.
//
dn.dig = function (domain, cb) {
  // This will be invoked on the given name server ip address responsible for
  // this domain.
  function query(server) {
    var q = dns.Question({ name: domain, type: 'ANY' });
    var req = dns.Request({ question: q, server: server });
    var records = [];

    req.on('timeout', function () {
      console.log('Timeout in making request');
    });

    req.on('message', function (err, msg) {
      //console.log(msg);
      msg.answer.forEach(function (a) {
        var type = dns.consts.QTYPE_TO_NAME[a.type];
        a.type = type;
        delete a.class;
        records.push(a);
      });
    });

    req.on('end', function () {
      cb(null, records);
    });

    req.send();
  }

  // First we get the name servers for the domain as we want to query this for
  // the rest of the records.
  dns.resolveNs(domain, function (err, nameServers) {
    if (err) {
      if (err.code === dns.NODATA) {
        return cb(new dn.DNSError('DNS_NS_ENODATA'));
      } else if (err.code === dns.NOTFOUND) {
        return cb(new dn.DNSError('DNS_NS_ENOTFOUND'));
      } else {
        return cb(new dn.DNSError('DNS_NS_' + err.code, 'network'));
      }
    }

    var nameServer = nameServers[0];
    if (!net.isIP(nameServer)) {
      dns.resolve4(nameServer, function (err, nameServerAddresses) {
        if (err) {
          console.error(err);
          return;
        }
        query(nameServerAddresses[0]);
      });
    }
  });
};


//
// Figure out base url.
//
dn.baseurl = function (domain, cb) {
  var urlObj = {
    protocol: 'http:',
    hostname: domain
  };

  var reqOpt = {
    url: url.format(urlObj),
    method: 'HEAD'
  };

  function handleBaseurl(href) {
    var ret = { href: href };
    var hrefObj = url.parse(href);
    ret.isExternalRedirect = (hrefObj.hostname !== urlObj.hostname);
    ret.forceSSL = (hrefObj.protocol !== urlObj.protocol);
    cb(null, ret);
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
        if (err) { return cb(new dn.RequestError(err)); }
        handleBaseurl(res.request.href);
      });
    } else if (err) {
      cb(new dn.RequestError(err));
    } else {
      handleBaseurl(res.request.href);
    }
  });
};


//
// Query public WHOIS databases.
//
dn.whois = function (domain, cb) {
  var tld = domain.substring(domain.lastIndexOf('.') + 1);
  var cname = tld + '.whois-servers.net';
  var hasInvokedCb = false;

  function invokeCb(err, data) {
    if (hasInvokedCb) { return; }
    hasInvokedCb = true;
    cb(err, data);
  }

  dns.resolveCname(cname, function (err, addresses) {
    if (err) {
      return invokeCb(err);
    }

    var responseText = '';
    var socket = net.connect(43, addresses[0], onConnect);
    socket.setEncoding('ascii');
    socket.on('error', invokeCb);
    socket.on('data', onData);
    socket.on('close', onClose);

    function onConnect() {
      socket.end(domain + '\r\n', 'ascii');
    }

    function onData(chunk) {
      responseText += chunk;
    }

    function onClose() {
      invokeCb(null, responseText);
    }
  });
};


//
// Probe a domain name, this will parse, check dns, whois and baseurl and
// produce a report.
//
dn.probe = function (domain, cb) {

  var info = { input: domain };
  var parsed = psl.parse(domain);

  if (parsed.error) {
    process.nextTick(function () {
      cb(new dn.ParseError(parsed.error));
    });
    return;
  }

  info.parsed = parsed;

  async.series({
    dns: async.apply(dn.dig, domain),
    whois: async.apply(dn.whois, domain),
    baseurl: async.apply(dn.baseurl, domain)
  }, function (err, results) {
    if (err) { return cb(err); }
    Object.keys(results).forEach(function (k) {
      info[k] = results[k];
    });
    cb(null, info);
  });

};

