#! /usr/bin/env node

var dn = require('../');
var args = process.argv.slice(2);
var input = args[0];

if (!input) {
  throw new Error('Input is required!');
}

dn.probe(input).then(function (info) {
  console.log(info);
}).error(function (err) {
  console.error(err);
});

