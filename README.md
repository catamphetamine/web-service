# web-service

[![NPM Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Test Coverage][coveralls-badge]][coveralls]

Easy web services on Node.js

## Installation

```
npm install web-service --save
```

## Usage

```js
import web_service, { api } from 'web-service'

...

const service = web_service({ routing: true })

// REST routes.
// Will be available at `/api/test` path.
service.get ('/test', async () => ({ works  : true }))
service.post('/test', async () => ({ posted : true }))

service.listen(3000)

...

const service = web_service
({
	// REST routes prefix
	routing: '/api', // or just `true`

	// Enables JWT authentication.
	//
	// Reads `authentication` cookie
	// holding a signed JWT token,
	// which means this cookie is to be set
	// manually during user login process.
	// 
	// import { jwt } from 'web-service'
	//
	// function login(user_id)
	// {
	//   const jwt_id = '...'
	//   const payload = { role: 'admin' }
	//   const token = jwt(payload, keys, user_id, jwt_id)
	//   set_cookie('authentication', token, { signed: false })
	// }
	//
	// First supply the encryption key.
	keys: ['secret'],
	//
	// Then supply a function which
	// parses JWT token payload
	// into a `user` variable
	// (which will be accessible in `api` service
	//  providing means for user authorization)
	authentication: payload => ({ role: payload.role })
})

// REST routes.
// Will be available at `/api/test` path.
service.get ('/test', async () => ({ works  : true }))
service.post('/test', async () => ({ posted : true }))

// Servers static files from '__dirname' at '/assets' path
service.serve_static_files('/assets', __dirname)

// Enables file upload at path '/'
service.file_upload
({
	upload_folder: __dirname,
	on_file_uploaded: () => {}
})

// Enables proxying to another HTTP server at path '/proxied'
service.proxy('/proxied', 'http://google.ru')

service.listen(3000)

...

// Supports Web 1.0 Mode

const service = api
({
	routing: true,
	api:
	[
		function(api)
		{
			// web 2.0 (ajax)
			api.get('/test', async () => ({ works: true }))
			// web 1.0 (redirects to a page)
			api.legacy.get('/test', async () => ({ redirect: '/done' }))
		},
		...
	]
})

service.listen(3000)
```

## Contributing

After cloning this repo, ensure dependencies are installed by running:

```sh
npm install
```

This module is written in ES6 and uses [Babel](http://babeljs.io/) for ES5
transpilation. Widely consumable JavaScript can be produced by running:

```sh
npm run build
```

Once `npm run build` has run, you may `import` or `require()` directly from
node.

After developing, the full test suite can be evaluated by running:

```sh
npm test
```

While actively developing, one can use (personally I don't use it)

```sh
npm run watch
```

in a terminal. This will watch the file system and run tests automatically 
whenever you save a js file.

When you're ready to test your new functionality on a real project, you can run

```sh
npm pack
```

It will `build`, `test` and then create a `.tgz` archive which you can then install in your project folder

```sh
npm install [module name with version].tar.gz
```

## License

[MIT](LICENSE)
[npm]: https://www.npmjs.org/package/web-service
[npm-badge]: https://img.shields.io/npm/v/web-service.svg?style=flat-square
[travis]: https://travis-ci.org/halt-hammerzeit/web-service
[travis-badge]: https://img.shields.io/travis/halt-hammerzeit/web-service/master.svg?style=flat-square
[coveralls]: https://coveralls.io/r/halt-hammerzeit/web-service?branch=master
[coveralls-badge]: https://img.shields.io/coveralls/halt-hammerzeit/web-service/master.svg?style=flat-square
