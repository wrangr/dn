'use strict';


//
// Deps
//
const Util = require('util');
const Url = require('url');
const Net = require('net');
const Dns = require('native-dns');
const Request = require('request');
const Async = require('async');
const Psl = require('psl');
const _ = require('lodash');


const internals = {};


internals.definedTypes = [
  'A',
  'AAAA',
  'NS',
  'CNAME',
  'PTR',
  'NAPTR',
  'TXT',
  'MX',
  'SRV',
  'SOA'//,
  //'TLSA'
];


internals.defaultServer = '208.67.222.222';


//
// Public API
//

const dn = module.exports = {};


//
// Error codes
//

// Copy error codes from `psl`
_.each(Psl.errorCodes, (v, k) => {

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
  }
  else {
    this.message = obj.message;
    this.code = obj.code;
  }
  this.kind = 'parse';
  this.blame = 'caller';
};

Util.inherits(dn.ParseError, Error);


//
// DNS Error
//
dn.DNSError = function DNSError(code, blame) {

  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  if (dn[code]) {
    this.message = dn[code];
    this.code = code;
  }
  else {
    this.message = 'DNS Error.';
    this.code = code;
  }
  this.kind = 'dns';
  this.blame = blame || 'target';
};

Util.inherits(dn.DNSError, Error);


dn.RequestError = function RequestError(err) {

  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  const longCode = 'REQUEST_' + err.code;
  this.message = dn[longCode] || err.message;
  this.code = longCode;
  this.kind = 'request';
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
    this.blame = 'target';
  }
  else {
    this.blame = 'network';
  }
};

Util.inherits(dn.RequestError, Error);


internals.parseRecords = function (records) {

  return records.map((record) => {

    record.type = Dns.consts.QTYPE_TO_NAME[record.type];
    return _.omit(record, ['class']);
  });
};


internals.ensureParsedDomain = function (input) {

  if (_.isString(input)) {
    const parsed = Psl.parse(input);
    if (parsed.error) {
      throw new dn.ParseError(parsed.error);
    }
    return parsed;
  }

  if (_.isObject(input)) {
    const isParsedDomain = _.reduce([
      'input', 'tld', 'sld', 'domain', 'subdomain', 'listed'
    ], (memo, prop) => {

      if (!input.hasOwnProperty(prop)) {
        return false;
      }
      return memo;
    }, true);

    if (isParsedDomain) {
      return input;
    }
  }

  throw new TypeError('input must be either a string or a psl parsed object');
};


//
// Dig up DNS records.
//
dn.dig = function (domain/*, type, server, cb*/) {

  const args = _.toArray(arguments).slice(1);
  const cb = args.pop();
  const type = args.shift() || 'ANY';
  const server = args.shift() || internals.defaultServer;
  let types = type.split(',');

  if (type === 'ANY') {
    types = internals.definedTypes;
  }

  Async.map(types, (type, cb) => {

    const q = Dns.Question({ name: domain, type: type });
    const req = Dns.Request({
      question: q,
      server: server,
      //timeout: 5000,
      cache: false
    });

    req.on('timeout', () => {

      cb(new Error('DNS request timed out'));
    });

    req.on('message', (err, msg) => {

      if (err) {
        return cb(err);
      }

      cb(null, {
        answer: internals.parseRecords(msg.answer),
        authority: internals.parseRecords(msg.authority),
        additional: internals.parseRecords(msg.additional)
      });
    });

    req.send();
  }, (err, result) => {

    if (err) {
      return cb(err);
    }

    cb(null, result.reduce((memo, item) => {

      memo.answer = memo.answer.concat(item.answer);
      memo.additional = memo.additional.concat(item.additional);

      item.authority.forEach((record) => {

        const found = _.find(memo.authority, (memoItem) => {

          const mType = memoItem.type;
          const rType = record.type;
          const mPrimary = memoItem.primary;
          const rPrimary = record.primary;
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

  const resolvePrimary = function (soa) {

    Dns.resolve(soa.primary, (err, addresses) => {

      if (err) {
        return cb(err);
      }

      soa.addresses = addresses;
      cb(null, soa);
    });
  };

  const parsed = internals.ensureParsedDomain(domain);

  dn.dig(parsed.domain, 'SOA', null, (err, data) => {

    if (err) {
      return cb(err);
    }

    //const authority = data.authority || [];
    const answer = data.answer || [];

    // First we try to get SOA from answer array.
    const soa = answer.reduce((memo, record) => {

      if (record.type === 'SOA') {
        return record;
      }
      return memo;
    }, undefined);

    if (soa) {
      return resolvePrimary(soa, cb);
    }

    cb();
  });
};


//
// Dig up DNS records for domain.
//
dn.dns = function (domain, cb) {

  const handleDigCallback = function (server) {

    return function (err, data) {

      if (err) {
        return cb(err);
      }
      data.server = server || internals.defaultServer;
      cb(null, data);
    };
  };

  const parsed = internals.ensureParsedDomain(domain);

  dn.soa(parsed, (err, soa) => {

    if (err) {
      return cb(err);
    }

    if (!soa || !soa.addresses || !soa.addresses.length) {
      return dn.dig(domain, 'ANY', null, handleDigCallback());
    }

    dn.dig(domain, 'ANY', soa.addresses[0], (err, data) => {

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

  const matches = /^([a-z0-9+\.\-]+):/i.exec(domainOrUrl);
  if (!matches || matches.length < 2) {
    domainOrUrl = 'http://' + domainOrUrl;
  }
  else if (['http', 'https'].indexOf(matches[1]) === -1) {
    throw new Error('Unsupported scheme: ' + matches[1]);
  }

  const urlObj = Url.parse(domainOrUrl);
  if (!urlObj.hostname) {
    throw new Error('Invalid URL');
  }

  const parsed = Psl.parse(urlObj.hostname);
  if (!parsed.listed || !parsed.domain) {
    throw new Error('Invalid domain name');
  }

  let domain = parsed.domain;
  if (parsed.subdomain) {
    domain = parsed.subdomain + '.' + domain;
  }

  const isWww = /^www\./.test(domain);
  const www = isWww ? domain : 'www.' + domain;
  const naked = isWww ? domain.slice(4) : domain;

  const get = function (uri, cb) {

    const start = Date.now();
    const reqOpt = {
      // Use GET as not all servers implement HEAD
      method: 'GET',
      url: uri,
      followRedirect: false,
      gzip: true,
      timeout: 20 * 1000,
      strictSSL: opt.strictSSL
    };

    Request(reqOpt, (err, res) => {

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
  };

  const processResults = function (results) {

    const ok = [];
    const redirect = [];
    const error = [];

    Object.keys(results).forEach((key) => {

      const result = results[key];
      result.key = key;
      if (result.statusCode === 200) {
        ok.push(result);
      }
      else if ([301, 302, 307].indexOf(result.statusCode) >= 0) {
        redirect.push(result);
      }
      else {
        error.push(result);
      }
    });

    const primary = ok.reduce((memo, result) => {

      if (memo) {
        const memoKeyParts = memo.key.split('-');
        if (memoKeyParts[1] === 'www' && isWww) {
          return memo;
        }
        if (memoKeyParts[0] + ':' === urlObj.protocol) {
          return memo;
        }
      }
      return result;
    }, null);

    return { ok: ok, redirect: redirect, error: error, primary: primary };
  };

  Async.parallel({
    'https-naked': Async.apply(get, 'https://' + naked + urlObj.path),
    'https-www': Async.apply(get, 'https://' + www + urlObj.path),
    'http-naked': Async.apply(get, 'http://' + naked + urlObj.path),
    'http-www': Async.apply(get, 'http://' + www + urlObj.path)
  }, (err, results) => {

    if (err) {
      return cb(err);
    }
    cb(null, processResults(results));
  });
};


//
// Query public WHOIS databases.
//
dn.whois = function (domain, cb) {

  const tld = domain.substring(domain.lastIndexOf('.') + 1);
  const cname = tld + '.whois-servers.net';

  const invokeCb = function (err, data) {

    cb(err, data);
    cb = function () {}; // Prevent calling more than once.
  };

  const noAuthorityError = function () {

    invokeCb(new Error('No known WHOIS server found for .' + tld));
  };

  Dns.resolveCname(cname, (err, addresses) => {

    if (err && err.code === 'ENOTFOUND') {
      return noAuthorityError();
    }
    else if (err) {
      return invokeCb(err);
    }

    if (!addresses || !addresses.length) {
      return noAuthorityError();
    }

    let responseText = '';
    const socket = Net.connect(43, addresses[0], () => {

      socket.end(domain + '\r\n', 'ascii');
    });

    socket.setEncoding('ascii');

    socket.on('error', invokeCb);

    socket.on('data', (chunk) => {

      responseText += chunk;
    });

    socket.on('close', () => {

      invokeCb(null, responseText);
    });
  });
};

