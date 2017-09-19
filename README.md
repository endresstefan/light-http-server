## **Light http server**
  Lightweight express like web framework for [node](http://nodejs.org).

  [![npm](https://img.shields.io/npm/v/light-http-server.svg)](https://www.npmjs.com/package/light-http-server)

```js
var server = require('light-http-server');

server.get('/', function (req, res) {
  res.send('It works.')
});

server.listen(80)
```

## Installation

```bash
$ npm install light-http-server
```

## Features

  * No module dependencies
  * Lightweight and fast
  * Express like syntax
  * Quick app prototyping

## Docs & Community

  * [GitHub Organization](https://github.com/endresstefan/light-http-server) 


## License

  [ISC](https://github.com/endresstefan/light-http-server/blob/master/LICENSE)
