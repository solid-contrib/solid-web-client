# solid-web-client

Solid LDP REST client.

## Usage

```js
var rdf = require('rdflib')  // or other compatible library
var webClient = require('solid-web-client')(rdf)

webClient.get('https://example.com')
  .then(function (response) {
    console.log(response)
  })
```
