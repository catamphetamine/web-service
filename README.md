# web-service

[![npm version](https://img.shields.io/npm/v/web-service.svg?style=flat-square)](https://www.npmjs.com/package/web-service)
[![npm downloads](https://img.shields.io/npm/dm/web-service.svg?style=flat-square)](https://www.npmjs.com/package/web-service)
[![coverage](https://img.shields.io/coveralls/halt-hammerzeit/web-service/master.svg?style=flat-square)](https://coveralls.io/r/halt-hammerzeit/web-service?branch=master)

Easy web services on Node.js

## Installation

```
npm install web-service --save
```

## Webservice

Example:

```js
import webservice from 'web-service'

const service = webservice({ routing: true })

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
	getCookie,
	setCookie,
	destroyCookie,

	// If a Json Web Token was supplied in an HTTP request
	// (`Authorization: Bearer {token}` HTTP header),
	// then these three properties are set.
	//
	// The `user` object is gonna have 
	// a user `id` extracted from the token
	// along with all the extra fields 
	// extracted by `authentication.userInfo(payload)` function (plus user `id`)
	// (see "Json Web Token" section)
	user,
	//
	// Raw Json Web Token (can be used for additional HTTP requests)
	accessToken,
	//
	// Json Web Token id (can be used for token expiration checks)
	accessTokenId,
	//
	// Json Web Token payload (can be used for checking `scopes`)
	accessTokenPayload,
	//
	// Checks that a user has at least one of the roles
	// which are supplied as arguments (comma separated).
	// Throws a `new errors.Unauthorized()` otherwise.
	// In order for this to work `authentication.userInfo(payload)`
	// should return an object with a `.role` property (String).
	role(role1, role2, ...),

	// The secret keys passed to webservice
	keys,

	// A handy HTTP client for making "internal" HTTP requests
	// (`.get('/data', parameters).then(result => ...)`,
	//  `.post('/data', data).then(result => ...)`,
	//  etc)
	// 
	// If Json Web Token authentication is enabled
	// then this "internal" HTTP client utility will send HTTP requests
	// with "Authorization" HTTP header set appropriately.
	//
	// Therefore this `internalHttp` utility should only be used
	// for sending HTTP requests to your own servers
	// (hence the word "internal")
	// to prevent leaking JWT token to a third party.
	//
	internalHttp,

	// Koa `ctx` (for advanced use cases)
	ctx
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
					throw new errors.InputRejected(`Invalid id: ${id}`)
				}

				return await database.get(id)
			})

			// web 1.0 mode (redirects to a URL when finished)
			api.legacy.post('/save/:id', async (input) =>
			{
				if (input.id <= 0)
				{
					throw new errors.InputRejected(`Invalid id: ${input.id}`)
				}

				await database.save(input)

				return { redirect: '/done' }
			},
			(error) => '/error')
		},
		...
	]
})

// // `api` array can be used with `require()` 
// // to split a large code base into modules
// const service = api
// ({
//     api:
//     [
//         require('./api/items'),
//         require('./api/users'),
//         require('./api/utility')
//     ]
// })

service.listen(3000)
```

Each `api` handler is passed the same two arguments as each `routing` handler does (in Web 1.0 mode there's also the third argument which is called in case of an error being thrown from the handler, and the return value of that third argument is gonna be the redirection URL, e.g. `/error?status=${error.status}`).

## Tools

```js
import webservice from 'web-service'

const service = webservice()

// Performs an HTTP redirect (301 Moved Permanently)
service.redirect('/old', { to: '/new' })

// Serve static files from a folder on disk
service.files('/static', path.join(__dirname, '../static'))

// Proxy '/proxied' path to another server
// (make sure you proxy only to your own servers
//  so that you don't leak JWT token to a third party).
//
// Additional options may be passed as a third parameter.
// https://github.com/nodejitsu/node-http-proxy#options
//
service.proxy('/proxied', 'http://localhost:8080/api')

// Handle file uploads
service.upload('/upload', path.join(__dirname, '../uploads'),
{
   // (optional)
   // Will process each file being uploaded.
   // The returned value is gonna be sent back in HTTP response.
   process: async function({ path })
   {
      const contents = await fs.readFileAsync(path, 'utf-8')
      const stats = await analyze(contents)
      return { stats }

      // // Or maybe something like this
      // const convertedFileName = await convert(path)
      // return { filename: convertedFileName }
   }

   // // (optional)
   // // Instead of first writing files to disk
   // // and then `process`ing them,
   // // the uploaded files may be `stream`ed directly.
   // // `fields` are the `<form/>` fields.
   // stream: async function(file, fields, response)
   // {
   //    // To stream HTTP response manually
   //    file.pipe(analyzer).pipe(response)
   //    
   //    // // Without streaming HTTP response manually
   //    // return new Promise((resolve, reject) =>
   //    // {
   //    //    analyzer.on('end', result => resolve(result))
   //    //    analyzer.on('error', reject)
   //    //    file.pipe(analyzer)
   //    // })
   // },
   //
   // // `respond: false` tells the library that
   // // no response data should be sent to `response`
   // // (which means the user of the library
   // //  chose to send HTTP response manually)
   // respond: false
})

service.listen(3000)
```

## Sessions

Currently I've disabled using "sessions" in this library since I'm not using sessions anymore in my projects. Maybe I can turn them back on, if someone requests that feature (in that case create an issue).

I'm now using [Json Web Tokens](https://jwt.io/) instead of sessions in my project. Sessions are stateful while Json Web Tokens are stateless. Json Web Tokens provide means for user authentication and authorization. And that's enough for most (if not all) real-world scenarios. 

If someone needs to store additional user data in a "session", such as contents of a shopping cart, then I think it's better to store that data in a database instead so that the user could return a week later and not loose his shopping cart due to expiration (or a server restart).

"Registration" is kind of a relic of the past which can turn away website visitors nowadays. Instead one may consider "registering" dummy users under the hood for website users once they trigger storing some data in a "session" (e.g. hitting "Add to cart" button), and then storing that data in a persistent database. That's more work for sure but also better user experience.

## JWT authentication

To enable [Json Web Tokens](https://ponyfoo.com/articles/json-web-tokens-vs-session-cookies) authentication, supply the following parameters:

 * `keys` which is an array of secret keys for data encryption (can have a single element, for example) and is used for siging Json Web Tokens being issued. The newest keys are added to the beginning of the array while the oldest (compromised) ones are moved to the end of the array eventually being removed (see [`keygrip`](https://www.npmjs.com/package/keygrip)). This enables secret key rotation which adds security.

 * `authentication.userInfo : function(tokenPayload)` which extracts user info from a decrypted Json Web Token `payload` (except the `id` – it is extracted automatically). The resulting object will be available both as `ctx.user` and the `user` parameter of route handlers (including `api`).

 * (optional) (advanced) `refreshAccessToken : async function(ctx)` – refreshes an expired access token (if using an architecture with short lived access tokens and long lived refresh tokens). Either returns a new access token or throws an `Error` (which will not propagate further).

 * (optional) (advanced) `validateAccessToken : function(payload, ctx)` – validates a supplied Json Web Token given its `payload` (and `ctx` argument has `.path`, `.query`, etc). Returns `true` if the access token is considered valid for this "Resource Server" (API server). For example, this function can check that the "audience" (`aud`, e.g. `"api.users.google.com"`) claim matches this particular "Resource Server" (API server) so that a token issued for a particular API server can't be maliciously used to query data from other unrelated API servers.

Example:

```js
const service = webservice
({
	keys: ['secret', 'older-deprecated-secret'],
	authentication:
	{
		userInfo: payload => ({ roles: payload.roles })
	}
})
```

Now, when this API server receives an `Authorization` HTTP header it attempts to extract and validate an access token from this header value, and, if succeeded, the `user` object is populated from the acces token payload, so the API server endpoint queried can both know the "current user" and check this user's privileges (without querying any database at all – that's the whole point of authentication tokens).

The reason for passing the access token in the form of an HTTP header instead of a cookie is to guard users against [Cross-Site Request Forgery attacks](http://docs.spring.io/spring-security/site/docs/current/reference/html/csrf.html): even if a user clicks on a malicious link it still won't do anything like transferring all user's funds to the attacker's wallet because while links do carry cookies they don't carry HTTP headers.

Access tokens are usually stored either in a cookie or in `localStorage`. Access tokens are usually made expirable and are accompanied with the corresponding "refresh tokens". This increases the architectural complexity of the system while also increasing its safety.

An example of setting authentication cookie on user login (using `api` service):

```js
import { jwt, errors } from 'web-service'

export default function(api)
{	
	api.post('/login', async ({ name, password }, { setCookie }) =>
	{
		const user = await database.users.get({ name })

		if (!user)
		{
			throw new errors.NotFound()
		}

		if (password !== user.password)
		{
			throw new errors.InputRejected(`Wrong password`)
		}

		const tokenId = '...' // a randomly generated unique id of some kind
		const payload = { roles: ['admin'] }

		// Generate a non-expiring JWT
		const token = jwt({ payload, key: 'secret', userId: user.id, tokenId, expiresIn: undefined })

		// Cookies are created being "HttpOnly" by default
		// (that means it can only be read on the server side).
		// Pass `httpOnly: false` to make it readable in a web browser.
		setCookie('authentication', token, { signed: false })
	}

	api.get('/restricted-data', async ({ parameter }, { user, role }) =>
	{
		// The `user` parameter is populated from the token payload.
		// The token is taken from the `Authorization: Bearer ${token}` HTTP header
		// which must be set on the client side when sending this HTTP request.

		if (!user)
		{
			throw new errors.Unauthenticated()
		}

		if (!role('admin', 'or-some-other-role'))
		{
			throw new errors.AccessDenied()
		}

		return await database.query(parameter)
	})
}
```

The upside of storing an access token in a cookie is because cookies are accessible both on the client and on the server while `localStorage` is for the client side only (therefore rendering isomorphic page rendering impossible).

The authentication token cookie can also be further protected (advanced topic, not required) by making it "HttpOnly" so that it's only readable on the server side (further protecting the user from session hijacking via an XSS attack).

If an access token expired and is either not configured to be refreshed via `authentication.refreshAccessToken()` or if access token refresh attempt failed then a `401` HTTP response is sent with the following JSON body (not tested)

```js
{
	status: 401,
	type: 'ACCESS_TOKEN_EXPIRED'
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
