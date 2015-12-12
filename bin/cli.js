#! /usr/bin/env node

'use strict';


const Util = require('util');
const Minimist = require('minimist');
const Psl = require('psl');
const Pkg = require('../package.json');
const Dn = require('../');


const internals = {};


internals.help = function () {

  console.log([
    'Usage: ' + Pkg.name + ' [ options ] [ <command> ] <domain-name>',
    '',
    'Commands:',
    '',
    'baseurl          Figure out baseurl.',
    'dig              Dig up DNS records. ie: "' + Pkg.name + ' dig foo.com MX"',
    'dns              Dig up "any" DNS records from authority.',
    'parse            Parse domain name using "psl".',
    'soa              Get Authority name server for domain.',
    'whois            Query public WHOIS database for domain.',
    '',
    'Options:',
    '',
    '-h, --help       Show this help.',
    '-v, --version    Show version.',
    '--no-colors      Diable pretty colours in output.',
    '--json           Output minimised JSON (good for machines).',
    '--jsonpretty     Output human readable JSON.',
    '',
    'wrangr ' + (new Date()).getFullYear()
  ].join('\n'));
};


internals.createInspectFn = function (argv) {

  return function (obj) {

    if (argv.json) {
      return JSON.stringify(obj);
    }
    else if (argv.jsonpretty) {
      return JSON.stringify(obj, null, 2);
    }
    else if (typeof obj === 'string') {
      return obj;
    }

    return Util.inspect(obj, {
      colors: argv.colors !== false,
      depth: null
    });
  };
};


internals.createErrorFn = function (inspect) {

  return function (err) {

    console.error(inspect(err));
    process.exit(1);
  };
};


internals.createDoneFn = function (inspect) {

  return function (data) {

    console.log(inspect(data));
    process.exit(0);
  };
};


internals.main = function (argv) {

  const cmd = argv._.shift();
  const domain = argv._.shift();
  const inspect = internals.createInspectFn(argv);
  const error = internals.createErrorFn(inspect);
  const done = internals.createDoneFn(inspect);


  if (argv.v || argv.version) {
    console.log(Pkg.version);
    process.exit(0);
  }
  else if (!cmd || !domain || argv.h || argv.help) {
    internals.help();
    process.exit(0);
  }


  if (cmd === 'parse') {
    return done(Psl.parse(domain));
  }

  if (typeof Dn[cmd] !== 'function') {
    return error(new Error('Unknown command.'));
  }


  Dn[cmd].apply(Dn, [domain].concat(argv._).concat((err, data) => {

    if (err) {
      error(err);
    }
    else {
      done(data);
    }
  }));
};


internals.main(Minimist(process.argv.slice(2)));

