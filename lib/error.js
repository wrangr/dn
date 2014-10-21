//
// Errors
//

var util = require('util');
var psl = require('psl');

module.exports = function (dn) {

  //
  // Error codes
  //

  // Copy error codes from `psl`
  Object.keys(psl.errorCodes).forEach(function (k) {
    dn['PARSE_' + k] = psl.errorCodes[k];
  });

  dn.PARSE_ENOTSTRING = 'Domain name must be a string';
  dn.PARSE_ENOTLISTED = 'Domain name does not belong to any known public suffix';
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

};

