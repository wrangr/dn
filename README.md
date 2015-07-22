# dn (Domain Name)

[![Build Status](https://travis-ci.org/wrangr/dn.svg?branch=master)](https://travis-ci.org/wrangr/dn)
[![Dependency Status](https://david-dm.org/wrangr/dn.svg?style=flat)](https://david-dm.org/wrangr/dn)
[![devDependency Status](https://david-dm.org/wrangr/dn/dev-status.png)](https://david-dm.org/wrangr/dn#info=devDependencies)

## Installation

```sh
npm install dn
```

## API

### `dn.baseurl( domain, [options,] callback )`

Send HTTP and HTTPS GET requests to domain both using `www` and without it so we can figure out what's the site's base URL.

```js
dn.baseurl('foo.com', function (err, data) {
  //...
});

dn.baseurl('https://foo.com', { strictSSL: false }, function (err, data) {
  //...
});
```

### `dn.dig( domain, rtype, [server,] callback )`

Dig up DNS records.

```js
dn.dig('foo.com', 'MX', '1.2.3.4', function (err, data) {
  //...
});
```

### `dn.dns( domain, callback )`

Dig up "any" DNS records using authority server.

```js
dn.dns('foo.com', function (err, data) {
  //...
});
```

### `dn.parse( domain )`

Parse domain using `psl`.

```js
var parsed = dn.parse('mydomain.co.uk');
```

### `dn.soa( domain, callback )`

Get authority name server for domain name.

```js
dn.soa('www.example.com', function (err, data) {
  //...
});
```

### `dn.whois( domain, callback )`

Query public WHOIS data for domain.

```js
dn.whois('foo.com', function (err, data) {
  //...
});
```

## CLI

```
➜  npm install -g dn
...

➜  dn
Usage: dn [ options ] [ <command> ] <domain-name>

Commands:

baseurl          Figure out baseurl.
dig              Dig up DNS records. ie: "dn dig foo.com MX"
dns              Dig up "any" DNS records from authority.
parse            Parse domain name using "psl".
soa              Get Authority name server for domain.
whois            Query public WHOIS database for domain.

Options:

-h, --help       Show this help.
-v, --version    Show version.
--no-colors      Diable pretty colours in output.
--json           Output minimised JSON (good for machines).
--jsonpretty     Output human readable JSON.

wrangr 2015
```
