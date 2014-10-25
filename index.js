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
var _ = require('lodash');


//
// Public API
//

var dn = module.exports = {};


//
// Error codes
//

// Copy error codes from `psl`
_.each(psl.errorCodes, function (v, k) {
  dn['PARSE_' + k] = v;
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
  if (_.isString(obj)) {
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


function parseRecords(records) {
  return records.map(function (record) {
    record.type = dns.consts.QTYPE_TO_NAME[record.type];
    return _.omit(record, [ 'class' ]);
  });
}

dn.dig = function (domain/*, type, server, cb*/) {
  var args = _.toArray(arguments).slice(1);
  var type = args.shift();
  var cb = args.pop();
  var server = args.pop() || '208.67.222.222';
  var q = dns.Question({ name: domain, type: type });
  var req = dns.Request({ question: q, server: server });
  req.on('timeout', function () {});
  req.on('message', function (err, msg) {
    cb(null, {
      answer: parseRecords(msg.answer),
      authority: parseRecords(msg.authority),
      additional: parseRecords(msg.additional)
    });
  });
  req.send();
};

dn.soa = function (domain, cb) {
  function resolvePrimary(answer) {
    async.map(answer, function (record, cb) {
      dns.resolve(record.primary, function (err, addresses) {
        record.addresses = addresses;
        cb(null, record);
      });
    }, cb);
  }

  dn.dig(domain, 'SOA', '208.67.222.222', function (err, data) {
    if (err) { return cb(err); }
    if (data.answer.length) {
      resolvePrimary(data.answer);
    } else if (data.authority.length) {
      var soa = data.authority.reduce(function (memo, record) {
        if (record.type === 'SOA') { return record; }
        return memo;
      }, undefined);
      resolvePrimary([ soa ], cb);
    } else {
      console.error(data);
    }
  });
};

//
// Dig up DNS records for domain.
//
dn.dns = function (domain, cb) {
  dn.soa(domain, function (err, soa) {
    if (err) { return cb(err); }
    dn.dig(domain, 'ANY', soa[0].addresses[0], cb);
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

  async.auto({
    dns: async.apply(dn.dns, domain),
    whois: async.apply(dn.whois, parsed.domain),
    baseurl: [ 'dns', async.apply(dn.baseurl, domain) ]
  }, function (err, results) {
    if (err) { return cb(err); }
    Object.keys(results).forEach(function (k) {
      info[k] = results[k];
    });
    cb(null, info);
  });

};

