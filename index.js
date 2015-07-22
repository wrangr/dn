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


var definedTypes = [
  'A',
  'AAAA',
  'NS',
  'CNAME',
  'PTR',
  'NAPTR',
  'TXT',
  'MX',
  'SRV',
  'SOA',
  //'TLSA'
];


var defaultServer = '208.67.222.222';


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

function ensureParsedDomain(input) {
  if (_.isString(input)) {
    var parsed = psl.parse(input);
    if (parsed.error) {
      throw new dn.ParseError(parsed.error);
    }
    return parsed;
  }
  
  if (_.isObject(input)) {
    var isParsedDomain = _.reduce([
      'input', 'tld', 'sld', 'domain', 'subdomain', 'listed'
    ], function (memo, prop) {
      if (!input.hasOwnProperty(prop)) { return false; }
      return memo;
    }, true);
    if (isParsedDomain) {
      return input;
    }
  }

  throw new TypeError('input must be either a string or a psl parsed object');
}


//
// Dig up DNS records.
//
dn.dig = function (domain/*, type, server, cb*/) {
  var args = _.toArray(arguments).slice(1);
  var cb = args.pop();
  var type = args.shift() || 'ANY';
  var server = args.shift() || defaultServer;
  var types = type.split(',');

  if (type === 'ANY') {
    types = definedTypes;
  }

  async.map(types, function (type, cb) {
    var q = dns.Question({ name: domain, type: type });
    var req = dns.Request({
      question: q,
      server: server,
      //timeout: 5000,
      cache: false
    });

    req.on('timeout', function () {
      cb(new Error('DNS request timed out'));
    });

    req.on('message', function (err, msg) {
      if (err) { return cb(err); }
      cb(null, {
        answer: parseRecords(msg.answer),
        authority: parseRecords(msg.authority),
        additional: parseRecords(msg.additional)
      });
    });

    req.send();
  }, function (err, result) {
    if (err) { return cb(err); }
    cb(null, result.reduce(function (memo, item) {
      memo.answer = memo.answer.concat(item.answer);
      memo.additional = memo.additional.concat(item.additional);
      item.authority.forEach(function (record) {
        var found = _.find(memo.authority, function (memoItem) {
          var mType = memoItem.type;
          var rType = record.type;
          var mPrimary = memoItem.primary;
          var rPrimary = record.primary;
          return mType === 'SOA' && mType === rType && mPrimary === rPrimary;
        });
        if (!found) {
          memo.authority.push(record);
        }
      });
      return memo;
    }, { answer: [], authority: [], additional: [] }));
  });
};


//
// Get authority name server for domain name.
//
// Arguments:
//
// * `domain`: Either a String or a `psl` "parsed" object.
// * `callback`
//
dn.soa = function (domain, cb) {
  function resolvePrimary(soa) {
    dns.resolve(soa.primary, function (err, addresses) {
      if (err) { return cb(err); }
      soa.addresses = addresses;
      cb(null, soa);
    });
  }

  var parsed = ensureParsedDomain(domain);

  dn.dig(parsed.domain, 'SOA', null, function (err, data) {
    if (err) { return cb(err); }
    var authority = data.authority || [];
    var answer = data.answer || [];

    // First we try to get SOA from answer array.
    var soa = answer.reduce(function (memo, record) {
      if (record.type === 'SOA') { return record; }
      return memo;
    }, undefined);

    if (soa) { return resolvePrimary(soa, cb); }

    cb();
  });
};


//
// Dig up DNS records for domain.
//
dn.dns = function (domain, cb) {
  function handleDigCallback(server) {
    return function (err, data) {
      if (err) { return cb(err); }
      data.server = server || defaultServer;
      cb(null, data);
    };
  }

  var parsed = ensureParsedDomain(domain);

  dn.soa(parsed, function (err, soa) {
    if (err) { return cb(err); }
    if (!soa || !soa.addresses || !soa.addresses.length) {
      return dn.dig(domain, 'ANY', null, handleDigCallback());
    }
    dn.dig(domain, 'ANY', soa.addresses[0], function (err, data) {
      if (err) {
        return dn.dig(domain, 'ANY', null, handleDigCallback());
      }
      handleDigCallback(soa.addresses[0])(null, data);
    });
  });
};


//
// Figure out base url.
//
dn.baseurl = function (domainOrUrl, opt, cb) {
  if (!domainOrUrl || typeof domainOrUrl !== 'string') {
    throw new TypeError('First argument to dn.baseurl() must be a non-empty string');
  }

  if (arguments.length < 3) {
    cb = opt;
    opt = {};
  }

  if (opt.strictSSL !== false) {
    opt.strictSSL = true;
  }

  var matches = /^([a-z0-9+\.\-]+):/i.exec(domainOrUrl);
  if (!matches || matches.length < 2) {
    domainOrUrl = 'http://' + domainOrUrl;
  } else if ([ 'http', 'https' ].indexOf(matches[1]) === -1) {
    throw new Error('Unsupported scheme: ' + matches[1]);
  }

  var urlObj = url.parse(domainOrUrl);
  if (!urlObj.hostname) {
    throw new Error('Invalid URL');
  }

  var parsed = psl.parse(urlObj.hostname);
  if (!parsed.listed || !parsed.domain) {
    throw new Error('Invalid domain name');
  }

  var domain = parsed.domain;
  if (parsed.subdomain) {
    domain = parsed.subdomain + '.' + domain;
  }

  var isWww = /^www\./.test(domain);
  var www = isWww ? domain : 'www.' + domain;
  var naked = isWww ? domain.slice(4) : domain;

  async.parallel({
    'https-naked': async.apply(get, 'https://' + naked + urlObj.path),
    'https-www': async.apply(get, 'https://' + www + urlObj.path),
    'http-naked': async.apply(get, 'http://' + naked + urlObj.path),
    'http-www': async.apply(get, 'http://' + www + urlObj.path)
  }, function (err, results) {
    if (err) { return cb(err); }
    cb(null, processResults(results));
  });

  function get(uri, cb) {
    var start = Date.now();
    var reqOpt = {
      // Use GET as not all servers implement HEAD
      method: 'GET',
      url: uri,
      followRedirect: false,
      gzip: true,
      timeout: 20 * 1000,
      strictSSL: opt.strictSSL
    };

    request(reqOpt, function (err, res) {
      // Pass err as result so we don't abort other requests running in
      // parallel.
      if (err) {
        err.url = uri;
        return cb(null, err);
      }
      cb(null, {
        url: uri,
        responseTime: Date.now() - start,
        statusCode: res.statusCode,
        headers: res.headers
      });
    });
  }

  function processResults(results) {
    var ok = [], redirect = [], error = [];

    Object.keys(results).forEach(function (key) {
      var result = results[key];
      result.key = key;
      if (result.statusCode === 200) {
        ok.push(result);
      } else if ([ 301, 302, 307 ].indexOf(result.statusCode) >= 0) {
        redirect.push(result);
      } else {
        error.push(result);
      }
    });

    var primary = ok.reduce(function (memo, result) {
      var keyParts = result.key.split('-');
      if (memo) {
        var memoKeyParts = memo.key.split('-');
        if (memoKeyParts[1] === 'www' && isWww) { return memo; }
        if (memoKeyParts[0] + ':' === urlObj.protocol) { return memo; }
      }
      return result;
    }, null);

    return { ok: ok, redirect: redirect, error: error, primary: primary };
  }

};


//
// Query public WHOIS databases.
//
dn.whois = function (domain, cb) {
  var tld = domain.substring(domain.lastIndexOf('.') + 1);
  var cname = tld + '.whois-servers.net';

  function invokeCb(err, data) {
    cb(err, data);
    cb = function () {}; // Prevent calling more than once.
  }

  function noAuthorityError() {
    invokeCb(new Error('No known WHOIS server found for .' + tld));
  }

  dns.resolveCname(cname, function (err, addresses) {
    if (err && err.code === 'ENOTFOUND') {
      return noAuthorityError();
    } else if (err) {
      return invokeCb(err);
    }

    if (!addresses || !addresses.length) {
      return noAuthorityError();
    }

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

