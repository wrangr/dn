#! /usr/bin/env node

var util = require('util');
var minimist = require('minimist');
var pkg = require('../package.json');
var dn = require('../');

var argv = minimist(process.argv.slice(2));
var cmd = argv._.shift();
var domain = argv._.shift();
var inspectOpt = { colors: argv.colors !== false, depth: null };

if (argv.v || argv.version) {
  console.log(pkg.version);
  process.exit(0);
} else if (!cmd || !domain || argv.h || argv.help) {
  console.log([
    'Usage: ' + pkg.name + ' <command> [ options ] <domain-name>',
    '',
    'Commands:',
    '',
    'parse            Parse domain name.',
    'dig              Dig up DNS records for domain.',
    'whois            Query public WHOIS database for domain.',
    'baseurl          Figure out baseurl.',
    'probe            Run diagnosis/report on domain.',
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
  process.exit(0);
}

function inspect(obj) {
  if (argv.json) {
    return JSON.stringify(obj);
  } else if (argv.jsonpretty) {
    return JSON.stringify(obj, null, 2);
  }
  return util.inspect(obj, inspectOpt);
}

function error(err) {
  console.error(inspect(err));
  process.exit(1);
}

function done(data) {
  console.log(inspect(data));
  process.exit(0);
}

if (cmd === 'parse') {
  done(require('psl').parse(domain));
}

if (typeof dn[cmd] !== 'function') {
  error(new Error('Unknown command.'));
}

dn[cmd](domain, function (err, data) {
  if (err) {
    error(err);
  } else {
    done(data);
  }
});

