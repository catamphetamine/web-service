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

// REST API routes
service.get ('/items/:id', async ({ id }) => ({ color : 'black' }))
service.post('/save/:id',  async ({ id, name, description }) => ({ result : true }))

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

	// If a Json Web Token was supplied in an HTTP request
	// (`Authorization` HTTP header or `authentication` cookie),
	// then these three properties are set.
	//
	// The `user` object is gonna have 
	// a user `id` extracted from the token
	// along with all the extra fields 
	// extracted by `authentication` function 
	// (see "Json Web Token" section)
	user,
	//
	// Raw Json Web Token (can be used for additional HTTP requests)
	authentication_token,
	//
	// Json Web Token id (can be used for expiration checks)
	authentication_token_id,

	// The secret keys passed to webservice
	keys,

	// A handy HTTP client
	// (`.get('/data', parameters)`,
	//  `.post('/data', data)`,
	//  etc)
	// 
	// When using Json Web Token authentication
	// this HTTP client will send requests
	// with "Authorization" HTTP header set appropriately.
	//
	http
}
```

## API webservice

Mostly is simply a `routing: true` webservice with added support for Web 1.0 operation mode and a convenient `api` parameter for grouping api methods into separate modules.

```js
import { api, errors } from 'web-service'

// Supports Web 1.0 Mode (for DarkNet: Tor, etc)

const service = api
({
	api:
	[
		function(api)
		{
			// web 2.0 mode (ajax)
			api.get('/get/:id', async ({ id }) =>
			{
				if (id <= 0)
				{
					throw new errors.Input_rejected(`Invalid id: ${id}`)
				}

				return await database.get(id)
			})

			// web 1.0 mode (redirects to a URL when finished)
			api.legacy.post('/save/:id', async (input) =>
			{
				if (input.id <= 0)
				{
					throw new errors.Input_rejected(`Invalid id: ${id}`)
				}

				await database.save(input)

				return { redirect: '/done' }
			},
			(error) => '/error')
		},
		...
	]
})

service.listen(3000)
```

Each `api` handler is passed the same two arguments as each `routing` handler does (in Web 1.0 mode there's also the third argument which is called in case of an error being thrown from the handler).

## Sessions

Currently I've disabled using "sessions" in this library since I'm not using sessions anymore in my projects. Maybe I can turn them back on, if someone requests that feature (in that case create an issue).

I'm now using [Json Web Tokens](https://jwt.io/) instead of sessions in my project. Sessions are stateful while Json Web Tokens are stateless. Json Web Tokens provide means for user authentication and authorization. And that's enough for most (if not all) real-world scenarios. 

If someone needs to store additional user data in a "session", such as contents of a shopping cart, then I think it's better to store that data in a database instead so that the user could return a week later and not loose his shopping cart due to expiration (or a server restart).

"Registration" is kind of a relic of the past which can turn away website visitors nowadays. Instead one may consider "registering" dummy users under the hood for website users once they trigger storing some data in a "session" (e.g. hitting "Add to cart" button), and then storing that data in a persistent database. That's more work for sure but also better user experience.

## JWT authentication

To enable [Json Web Tokens](https://jwt.io/) authentication, supply two parameters:

 * `keys` array, which is an array of secret keys for data encryption (can have a single element, for example) and is used for siging Json Web Tokens being issued. The newest keys are added to the beginning of the array while the oldest (compromised) ones are moved to the end of the array eventually being removed (see [`keygrip`](https://www.npmjs.com/package/keygrip)). This enables secret key rotation which adds security.

 * `authentication` function `(payload)`, which extracts user data from decrypted Json Web Token `payload`.

 * (optional) `validate_token` `async` function `(token, ctx)`, which validates Json Web Token (`ctx` has `.path`, `.query`, etc) and returns `{ valid: true / false }`.

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
		const user = await database.users.get({ name })

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

	api.get('/restricted-data', async ({ parameter }, { user }) =>
	{
		if (!user)
		{
			throw new errors.Unauthenticated()
		}

		if (user.role !== 'admin')
		{
			throw new errors.Access_denied(`Must be an adminstrator to view the data`)
		}

		return await database.query(parameter)
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
