# dn (Domain Name)

[![Build Status](https://magnum.travis-ci.com/wrangr/dn.svg?token=4uyuoxi9qhvAfjzUTB6y&branch=master)](https://magnum.travis-ci.com/wrangr/dn)

## Installation

```sh
git clone https://github.com/wrangr/dn.git
cd ./dn
npm install
npm link
```

## API

### `dn.baseurl( domain, callback )`

Send HTTP and HTTPS GET requests to domain both using `www` and without it so we can figure out what's the site's base URL.

```js
dn.baseurl('foo.com', function (err, data) {
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

### `dn.probe( domain, callback )`

Diagnose domain. This will run `dn.parse()` then `dn.dns()` and finally `dn.baseurl()`.

```js
dn.probe('foo.bar.com', function (err, info) {
  //...
});
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
➜  dn
Usage: dn [ options ] [ <command> ] <domain-name>

Commands:

baseurl          Figure out baseurl.
dig              Dig up DNS records. ie: "dn dig foo.com MX"
dns              Dig up "any" DNS records from authority.
parse            Parse domain name using "psl".
probe            Diagnose domain (parse -> dns -> baseurl).
soa              Get Authority name server for domain.
whois            Query public WHOIS database for domain.

Options:

-h, --help       Show this help.
-v, --version    Show version.
--no-colors      Diable pretty colours in output.
--json           Output minimised JSON (good for machines).
--jsonpretty     Output human readable JSON.

wrangr 2014
```
