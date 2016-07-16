import path from 'path'
import fs   from 'fs'

import http  from 'http'
import https from 'https'

import koa           from 'koa'
import body_parser   from 'koa-bodyparser'
import mount         from 'koa-mount'
import koa_logger    from 'koa-bunyan'
import compress      from 'koa-compress'
import statics       from 'koa-static'
import koa_locale    from 'koa-locale'

import errors      from './errors'
import promisify   from './promisify'

import error_handler  from './middleware/error handler'
import authentication from './middleware/authentication'
import proxier        from './middleware/proxy'
import file_upload    from './middleware/file upload'
import acl            from './middleware/acl'
import session        from './middleware/session'
import routing        from './middleware/routing'

// Sets up a Web Server instance (based on Koa)
//
// options:
//
// compress            - enables tar/gz compression of Http response data
//
// detect_locale       - extracts locale from Http Request headers 
//                       and places it into ctx.locale
//
// session             - tracks user session (ctx.session)
//
// authentication      - uses a JWT token as a means of user authentication
//                       (should be a function transforming token payload into user info)
//
// parse_body          - parse Http Post requests body (default: false; true when using routing)
//
// routing             - enables Rest Http routing
//                       (usage: web.get('/path', parameters => return 'Echo'))
//
// log                 - bunyan log instance
//
// csrf                - enables protection against Cross Site Request Forgery attacks
//                       (pending)
//
// (removed) secret    - gives access to app.keys[0] when using routing feature
//
// returns an object with properties:
//
//   shut_down()   - gracefully shuts down the server (pending)
//
//   connections() - returns currently open connections count (not tested)
//
//   errors        - a set of common Http errors
//
//     Unauthorized
//     Access_denied
//     Not_found
//     Input_missing
//
//   file_upload() - enables file upload functionality
//
//     parameters:
//
//       path           - the URL path to mount this middleware at (defaults to /)
//
//       upload_folder  - where to write the files
//
//       multiple_files - set this flag to true in case of multiple file upload
//
//   serve_static_files() - enables serving static files
//
//     parameters:
//
//       url_path        - the URL path to mount this middleware at
//
//       filesystem_path - the corresponding filesystem path where the static files reside
//
//   listen()             - starts listening for requests
//
//     parameters:
//
//       port - the TCP port to listen on
//       host - the TCP host to listen on (defaults to 0.0.0.0)
//
//     returns: a Promise
//
//   mount()             - mounts a middleware at a path
//
//     parameters:
//
//       path       - the URL path to mount the middleware at
//       middleware - the middleware to mount
//
//   use()               - standard Koa .use() method
//
//   proxy()             - proxies all requests for this path to another web server
//
//     parameters:
//
//       path        - the URL path to mount the requests for
//       destination - where to proxy these requests to
//
export default function web_server(options = {})
{
	// this object will be returned
	const result = {}

	// instantiate a Koa web application
	const web = new koa()

	// Trust `X-Forwarded-For` HTTP header
	// https://en.wikipedia.org/wiki/X-Forwarded-For
	web.proxy = true

	if (options.compress)
	{
		// хз, нужно ли сжатие в node.js: мб лучше поставить впереди nginx'ы, 
		// и ими сжимать, чтобы не нагружать процесс node.js
		web.use(compress())
	}

	// handle errors
	web.use(error_handler)

	// If an Access Control List is set,
	// then allow only IPs from the list of subnets
	if (options.access_list)
	{
		web.use(acl(options.access_list))
	}

	const log = options.log ||
	{
		debug : console.info.bind(console),
		info  : console.info.bind(console),
		warn  : console.info.bind(console),
		error : console.info.bind(console)
	}

	result.log = log

	if (options.debug)
	{
		web.use(koa_logger(log,
		{
			// which level you want to use for logging.
			// default is info
			level: 'debug',
			// this is optional. Here you can provide request time in ms,
			// and all requests longer than specified time will have level 'warn'
			timeLimit: 100
		}))
	}

	if (options.detect_locale)
	{
		// get locale from Http request
		// (the second parameter is the Http Get parameter name)
		koa_locale(web, 'locale')

		// usage:
		//
		// .use(async function(ctx)
		// {
		// 	const preferred_locale = ctx.getLocaleFromQuery() || ctx.getLocaleFromCookie() || ctx.getLocaleFromHeader() || 'en'
		// })
	}

	web.keys = options.keys

	if (options.authentication)
	{
		web.use(authentication(options.authentication, options.keys))
	}

	if (options.session)
	{
		web.use(session(options.redis))
	}

	if (options.parse_body !== false && options.routing === true)
	{
		options.parse_body = true
	}

	if (options.parse_body)
	{
		// Set up http post request handling.
		// Usage: ctx.request.body
		web.use(body_parser({ formLimit: '100mb' }))
	}

	if (options.csrf)
	{
		// Cross Site Request Forgery protection
		//
		// также: в api client'е при любом запросе выставлять заголовок X-Csrf-Token = csrf token cookie.
		//
		// // Cross Site Request Forgery token check
		// web.use(function* (next)
		// {
		// 	// on login:
		// 	import crypto from 'crypto'
		// 	const hmac = crypto.createHmac('sha1', configuration.session_secret_keys.first())
		// 	hmac.update(ctx.session)
		// 	ctx.cookies.set('csrf-token', hmac.digest('hex'))
		//
		// 	// else, if logged in
		// 	if (ctx.get('X-Csrf-Token') !== ctx.cookies.get('csrf-token'))
		// 	{
		// 			throw new Errors.Access_denied(`Cross Site Request Forgery token mismatch. Expected "csrf-token" cookie value ${ctx.cookies.get('csrf-token')} to equal "X-Csrf-Token" header value ${ctx.get('X-Csrf-Token')}`)
		// 	}
		// })
	}

	if (options.routing)
	{
		const { extensions, middleware } = routing
		({
			keys       : options.keys,
			routing    : options.routing,
			parse_body : options.parse_body
		})

		for (let key of Object.keys(extensions))
		{
			result[key] = extensions[key]
		}

		for (let use of middleware)
		{
			web.use(use)
		}
	}

	// active Http proxy servers
	const proxies = []

	// server shutting down flag
	let shut_down = false

	// in case of maintenance
	web.use(async function (ctx, next)
	{
		if (shut_down)
		{
			ctx.status = 503
			ctx.message = 'The server is shutting down for maintenance'
		}
		else
		{
			await next()
		}
	})

	result.shut_down = function()
	{
		shut_down = true

		// pending promises
		const pending = []

		// shut down http proxy
		for (let proxy of proxies)
		{
			pending.push(promisify(proxy.close, proxy)())
		}

		// Stops the server from accepting new connections and keeps existing connections. 
		//
		// The optional callback will be called once the 'close' event occurs. 
		// Unlike that event, it will be called with an Error as its only argument 
		// if the server was not open when it was closed.
		//
		pending.push(promisify(web.close, web)())

		return Promise.all(pending)
	}

	result.connections = function()
	{
		// http_server.getConnections()
		return promisify(web.getConnections, web)()
	}

	// can handle file uploads
	result.file_upload = function(settings)
	{
		if (options.parse_body)
		{
			throw new Error(`.file_upload() was enabled but also "parse_body" wasn't set to false, therefore Http POST request bodies are parsed which creates a conflict. Set "parse_body" parameter to false.`)
		}

		web.use(file_upload(settings, log))
	}

	// standard Http errors
	result.errors = errors

	// can serve static files
	result.serve_static_files = function(url_path, filesystem_path)
	{
		// https://github.com/koajs/static
		web.use(mount(url_path, statics(filesystem_path,
		{
			maxAge  : 365 * 24 * 60 * 60 // 1 year
		})))
	}

	// mounts middleware at path
	result.mount = (path, handler) =>
	{
		web.use(mount(path, handler))
	}

	// exposes Koa .use() function for custom middleware
	result.use = web.use.bind(web)

	// can proxy http requests
	result.proxy = (from, to) =>
	{
		const { proxy, middleware } = proxier(from, to)
		proxies.push(proxy)
		web.use(middleware)
	}

	// runs http server
	result.listen = (port, host = '0.0.0.0') =>
	{
		return new Promise((resolve, reject) =>
		{
			// the last route - throws not found error
			web.use(async function(ctx)
			{
				// throw new Method_not_found()
				ctx.status = 404
				ctx.message = `The requested resource not found: ${ctx.method} ${ctx.url}`
				
				// Reduces noise in the `log` in case of errors
				// (browsers query '/favicon.ico' automatically)
				if (!ctx.path.ends_with('/favicon.ico'))
				{
					log.error(ctx.message, 'Web server error: Not found')
				}
			})

			// http server
			const http_web_server = http.createServer()

			// // enable Koa for handling http requests
			// http_web_server.on('request', web.callback())

			// copy-pasted from 
			// https://github.com/koajs/koala/blob/master/lib/app.js
			//
			// "Expect: 100-continue" is something related to http request body parsing
			// http://crypto.pp.ua/2011/02/mexanizm-expectcontinue/
			//
			const koa_callback = web.callback()
			http_web_server.on('request', koa_callback)
			http_web_server.on('checkContinue', function(request, response)
			{
				// requests with `Expect: 100-continue`
				request.checkContinue = true
				koa_callback(request, response)
			})

			http_web_server.listen(port, host, error =>
			{
				if (error)
				{
					return reject(error)
				}

				resolve()
			})
			// .on('connection', () => connections++)
			// .on('close', () => connections--)
		})
	}

	// done
	return result
}