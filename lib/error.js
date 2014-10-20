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
    dn[k] = psl.errorCodes[k];
  });

  dn.DOMAIN_NOT_LISTED = 'Domain name does not belong to any known public suffix.';
  dn.NS_NOT_FOUND = 'No name servers found for domain.';
  dn.NS_NO_DATA = 'Empty response from server.';

  //
  // Parse Error
  //
  dn.ParseError = function ParseError(obj) {
    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);
    this.message = obj.message;
    this.code = obj.code;
    this.kind = 'parse';
  };

  util.inherits(dn.ParseError, Error);

  //
  // DNS Error
  //
  dn.DNSError = function DNSError(code) {
    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);
    this.message = dn[code];
    this.code = code;
    this.kind = 'dns';
  };

  util.inherits(dn.DNSError, Error);

  //
  // NetworkError
  //
  dn.NetworkError = function NetworkError(message, code) {

  };

  util.inherits(dn.NetworkError, Error);

};

