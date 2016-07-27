# solid-web-client
[![](https://img.shields.io/badge/project-Solid-7C4DFF.svg?style=flat)](https://github.com/solid/solid)
[![NPM Version](https://img.shields.io/npm/v/solid-web-client.svg?style=flat)](https://npm.im/solid-web-client)
[![Build Status](https://travis-ci.org/solid/solid-web-client.svg?branch=master)](https://travis-ci.org/solid/solid-web-client)

Minimal [Solid](https://github.com/solid/solid) LDP REST client functionality.
Serves as a standalone library, and is also used inside
[`solid-client`](https://github.com/solid/solid-client).

## Usage

```js
var rdf = require('rdflib')  // or other compatible library
var webClient = require('solid-web-client')(rdf)

webClient.get('https://example.com')
  .then(function (response) {
    console.log(response)
  })
```
