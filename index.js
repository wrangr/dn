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


//
// Dig up DNS records.
//
dn.dig = function (domain/*, type, server, cb*/) {
  var args = _.toArray(arguments).slice(1);
  var cb = args.pop();
  var type = args.shift() || 'ANY';
  var server = args.shift() || '208.67.222.222';
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


//
// Get authority name server for domain name.
//
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
  function get(uri, cb) {
    var reqOpt = {
      // Use GET as not all servers implement HEAD
      method: 'GET',
      url: uri,
      followRedirect: false,
      gzip: true,
      timeout: 30 * 1000,
      strictSSL: true
    };

    request(reqOpt, function (err, res) {
      // Pass err as result so we don't abort other requests running in
      // parallel.
      if (err) { return cb(null, err); }
      cb(null, _.pick(res, [ 'statusCode', 'headers' ]));
    });
  }

  var isWww = /^www\./.test(domain);
  var www = isWww ? domain : 'www.' + domain;
  var naked = isWww ? domain.slice(4) : domain;

  async.parallel({
    'https-naked': async.apply(get, 'https://' + naked),
    'https-www': async.apply(get, 'https://' + www),
    'http-naked': async.apply(get, 'http://' + naked),
    'http-www': async.apply(get, 'http://' + www)
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
// Probe a domain name, this will parse, check dns, baseurl and
// check agains our good practice and common problems checklist.
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
    dns: async.apply(dn.dns, domain),
    baseurl: [ 'dns', async.apply(dn.baseurl, domain) ]
  }, function (err, results) {
    if (err) { return cb(err); }
    Object.keys(results).forEach(function (k) {
      info[k] = results[k];
    });
    cb(null, info);
  });

};

