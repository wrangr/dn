# dn (Domain Name)

* Parse domain
* Resolve DNS
* Resolve www or non-www counterpart
* Figure out baseurl
* Check if www or non-www counterpart redirects
* Check HTTPS?
* WHOIS?

```js
var dn = require('dn');

dn.baseurl('wrangr.com', function (err, baseurl) {
  //...
});

dn.probe('foo.bar.com', function (err, info) {
  //...
});
```
