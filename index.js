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

dn.PARSE_ENOTLISTED = 'Domain name doesnt belong to a known public suffix';
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
  // TODO: HANDLE ERRORS!!!
  req.on('timeout', function () {});
  req.on('message', function (err, msg) {
    //console.log(err, msg);
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
      //console.error(data);
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
  // HTTP HEAD to "resolve" URL...
  function head(uri, cb) {
    function handleResponse(err, res) {
      if (err) {
        return cb(null, err);
      }
      var ret = _.pick(res, [ 'statusCode', 'headers' ]);
      //var href = res.request.href;
      //var hrefObj = url.parse(href);
      //var uriObj = url.parse(uri);
      //ret.isExternalRedirect = (hrefObj.hostname !== uriObj.hostname);
      //ret.forceSSL = (hrefObj.protocol !== uriObj.protocol);
      cb(null, ret);
    }

    var reqOpt = {
      method: 'HEAD',
      url: uri,
      followRedirect: false,
      timeout: 30 * 1000
    };

    request(reqOpt, function (err, res) {
      if (err && err.code === 'HPE_INVALID_CONSTANT') {
        // In some weird cases we get http parse errors when using the `HEAD`
        // method, so when that happens try a GET request.
        // See:
        // https://github.com/mikeal/request/issues/350
        // https://github.com/joyent/node/issues/4863
        reqOpt.method = 'GET';
        request.get(reqOpt, function (err, res) {
          //if (err) { return cb(new dn.RequestError(err)); }
          handleResponse(err, res);
        });
      //} else if (err) {
      //  cb(new dn.RequestError(err));
      } else {
        handleResponse(err, res);
      }
    });
  }

  var isWww = /^www\./.test(domain);
  var www = isWww ? domain : 'www.' + domain;
  var naked = isWww ? domain.slice(4) : domain;

  async.parallel({
    'https-naked': async.apply(head, 'https://' + naked),
    'https-www': async.apply(head, 'https://' + www),
    'http-naked': async.apply(head, 'http://' + naked),
    'http-www': async.apply(head, 'http://' + www)
  }, cb);
};


//
// Query public WHOIS databases.
//
dn.whois = function (domain, cb) {
  var tld = domain.substring(domain.lastIndexOf('.') + 1);
  var cname = tld + '.whois-servers.net';

  function invokeCb(err, data) {
    cb(null, err || data);
    cb = function () {}; // Prevent calling more than once.
  }

  dns.resolveCname(cname, function (err, addresses) {
    if (err) { return invokeCb(err); }

    var responseText = '';
    var socket = net.connect(43, addresses[0], function () {
      socket.end(domain + '\r\n', 'ascii');
    });
    socket.setEncoding('ascii');
    socket.on('error', invokeCb);
    socket.on('data', function onData(chunk) {
      responseText += chunk;
    });
    socket.on('close', function onClose() {
      invokeCb(null, responseText);
    });
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

  if (!parsed.listed) {
    process.nextTick(function () {
      cb(new dn.ParseError('PARSE_ENOTLISTED'));
    });
  }

  async.auto({
    soa: async.apply(dn.soa, domain),
    //dns: async.apply(dn.dns, domain),
    //whois: async.apply(dn.whois, parsed.domain),
    //baseurl: [ 'dns', async.apply(dn.baseurl, domain) ]
  }, function (err, results) {
    if (err) { return cb(err); }
    Object.keys(results).forEach(function (k) {
      info[k] = results[k];
    });
    cb(null, info);
  });

};

