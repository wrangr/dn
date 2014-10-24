#! /usr/bin/env node

var util = require('util');
var minimist = require('minimist');
var pkg = require('../package.json');
var dn = require('../');
var argv = minimist(process.argv.slice(2));
var input = argv._[0];

if (!input || argv.h || argv.help) {
  console.log([
    'Usage: ' + pkg.name + ' [ options ] <domain-name>',
    '',
    'wrangr ' + (new Date()).getFullYear()
  ].join('\n'));
  process.exit(0);
}

dn.probe(input, function (err, info) {
  if (err) {
    console.error(util.inspect(err, { colors: true, depth: null }));
    process.exit(1);
  }
  console.log(util.inspect(info, { colors: true, depth: null }));
  process.exit(0);
});

