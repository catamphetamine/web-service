# web-service

[![NPM Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Test Coverage][coveralls-badge]][coveralls]

Easy web services on Node.js

## Installation

```
npm install web-service --save
```

## Webservice

Example:

```js
import web_service from 'web-service'

const service = web_service({ routing: true })

// REST routes.
service.get ('/items/:id', async ({ id }) => ({ color : 'black' }))
service.post('/save/:id',  async (data) => ({ result : true }))

service.listen(3000)
```

Each `routing` handler is passed two arguments

 * `parameters` object (includes HTTP GET query parameters, HTTP POST body data, route parameters)

 * `utilities` object

The `utilities` object holds:

```js
{
	// Incoming HTTP request IP address
	// (Trusts `X-Forwarded-For` header)
	ip,

	// Cookie helpers
	get_cookie,
	set_cookie,
	destroy_cookie,

	// Data extracted from Json Web Token (if any)
	user,
	// Json Web Token
	authentication_token,
	// Json Web Token id
	authentication_token_id,

	// The secret keys passed to webservice
	keys,

	// An HTTP client
	// (`.get('/data', parameters)`,
	//  `.post('/data', data)`,
	//  etc)
	http
}
```

## API webservice

Mostly is simply a `routing: true` webservice with added support for Web 1.0 operation mode and a convenient `api` parameter for grouping api methods into separate modules.

```js
import { api } from 'web-service'

// Supports Web 1.0 Mode (for DarkNet: Tor, etc)

const service = api
({
	api:
	[
		function(api)
		{
			// web 2.0 mode (ajax)
			api.get('/get/:id', async ({ id }) => ({ works: true }))

			// web 1.0 mode (redirects to a URL when finished)
			api.legacy.post('/save/:id', async ({ id }) => ({ redirect: '/done' }), (error) => '/error')
		},
		...
	]
})

service.listen(3000)
```

Each `api` handler is passed the same two arguments as each `routing` handler does (in Web 1.0 mode there's also the third argument which is called in case of an error being thrown from the handler).

## Sessions

Currently I've disabled using "sessions" in this library since I'm not using sessions in my projects. Maybe I can turn them back on, if someone requests that feature (in that case create an issue).

## JWT authentication

To enable [Json Web Tokens](https://jwt.io/) authentication, supply two parameters:

 * `keys` array, which is an array of secret keys for data encryption (can have a single element, for example) and is used for siging Json Web Tokens being issued. The newest keys are added to the beginning of the array while the oldest (compromised) ones are moved to the end of the array eventually being removed (see [`keygrip`](https://www.npmjs.com/package/keygrip)). This enables secret key rotation which adds security.

 * `authentication` function, which extracts user data from decrypted Json Web Token payload.

Example:

```js
const service = web_service
({
	keys: ['secret'],
	authentication: payload => ({ role: payload.role })
})
```

And also set `authentication` cookie on user login. The contents of the cookie is gonna be the signed Json Web Token (data inside the token can be read, i.e. it's not encrypted, but it can't be modified without breaking it because it is signed with a secret key).

Example (using `api` service):

```js
import { jwt, errors } from 'web-service'

export default function(api)
{	
	api.post('/login', async ({ name, password }, { set_cookie }) =>
	{
		const user = database.users.get({ name })

		if (!user)
		{
			throw new errors.Not_found()
		}

		if (password !== user.password)
		{
			throw new errors.Input_rejected(`Wrong password`)
		}

		const jwt_id = '...' // a randomly generated unique id of some kind
		const payload = { role: 'admin' }
		const token = jwt(payload, keys, user_id, jwt_id)
		set_cookie('authentication', token, { signed: false })
	}

	api.get('/restricted-data', async ({ parameter_1, parameter_2 }, { user }) =>
	{
		if (!user)
		{
			throw new errors.Unauthenticated()
		}

		if (user.role !== 'admin')
		{
			throw new errors.Access_denied(`Must be an adminstrator to view the data`)
		}

		return { data: [...] }
	})
}
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
