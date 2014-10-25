# dn (Domain Name)

[![Build Status](https://magnum.travis-ci.com/wrangr/dn.svg?token=4uyuoxi9qhvAfjzUTB6y&branch=master)](https://magnum.travis-ci.com/wrangr/dn)

* Parse domain
* Resolve DNS
* Resolve www or non-www counterpart
* Figure out baseurl
* Check if www or non-www counterpart redirects
* Check HTTPS?
* WHOIS?


## API

### `dn.dig( domain, callback )`

```js
var dn = require('dn');

dn.dig('foo.com', function (err, data) {});
```

### `dn.whois( domain, callback )`

```js
dn.whois('foo.com', function (err, data) {});
```

### `dn.baseurl( domain, callback )`

```js
dn.baseurl('foo.com', function (err, data) {});
```

### `dn.probe( domain, callback )`

```js
// `dn.probe()` will throw if first argument is not a string.
dn.probe(null, function (err) {
  //...
});

// We get a an error in the callback if domain can not be parsed.
dn.probe('aaa bbb', function (err) {
  // {
  //   message: 'Domain name label can only contain...',
  //   code: 'LABEL_INVALID_CHARS',
  //   kind: 'parse'
  // }
  //
});

dn.probe('foo.bar.com', function (err, info) {
  //...
});
```

## CLI

```
➜  dn
Usage: dn [ options ] [ <command> ] <domain-name>

Commands:

probe            Run diagnosis/report on domain. This is the default command.
parse            Parse domain name.
dig              Dig up DNS records for domain.
whois            Query public WHOIS database for domain.
baseurl          Figure out baseurl.

Options:

-h, --help       Show this help.
-v, --version    Show version.
--no-colors      Diable pretty colours in output.
--json           Output minimised JSON (good for machines).
--jsonpretty     Output human readable JSON.

wrangr 2014
```
