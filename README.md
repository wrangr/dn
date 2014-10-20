# dn (Domain Name)

* Parse domain
* Resolve DNS
* Resolve www or non-www counterpart
* Figure out baseurl
* Check if www or non-www counterpart redirects
* Check HTTPS?
* WHOIS?

Errors are only thrown for things that are not the site owner's fault.
Everything else goes in `info`.

```js
var dn = require('dn');

// `dn.probe()` will throw if first argument is not a string.
dn.probe(null).catch(TypeError, function (err) {
  //...
});

// We get a an error in the callback if domain can not be parsed.
dn.probe('aaa bbb').catch(dn.ParseError, function (err) {
  // {
  //   message: 'Domain name label can only contain...',
  //   code: 'LABEL_INVALID_CHARS',
  //   kind: 'parse'
  // }
  //
});

dn.probe('foo.bar.com').done(function (info) {
  //...
});
```
