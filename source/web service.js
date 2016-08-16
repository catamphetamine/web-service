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
import { is_object, ends_with } from './helpers'

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
//   redirect()          - HTTP redirect helper
//
//     parameters:
//
//       from       - the URL path from which to redirect
//       to         - the URL (or path) to which the redirect will be performed
//       status     - HTTP redirection status (defaults to 301 (Moved Permanently))
//                    (e.g. can be set to 302 (Moved Temporarily))
//
//   proxy()             - proxies all requests for this path to another web server
//
//     parameters:
//
//       path        - the URL path to mount the requests for
//       destination - where to proxy these requests to
//
export default function web_service(options = {})
{
	// In development mode errors are printed as HTML
	const development = process.env.NODE_ENV !== 'production'

	// This object will be returned
	const result = {}

	// Create a Koa web application
	const web = new koa()

	// Trust `X-Forwarded-For` HTTP header
	// https://en.wikipedia.org/wiki/X-Forwarded-For
	web.proxy = true

	// Compresses HTTP response with GZIP
	// (better delegate this task to NginX or HAProxy in production)
	if (options.compress)
	{
		// хз, нужно ли сжатие в node.js: мб лучше поставить впереди nginx'ы, 
		// и ими сжимать, чтобы не нагружать процесс node.js
		web.use(compress())
	}

	// Dummy log in case no `log` supplied
	const log = options.log ||
	{
		debug : console.info.bind(console),
		info  : console.info.bind(console),
		warn  : console.warn.bind(console),
		error : console.error.bind(console)
	}

	// Is used in `api.js`
	result.log = log

	// Handle all subsequent errors
	web.use(error_handler({ development, log, markup_settings: options.error_html }))

	// If an Access Control List is set,
	// then allow only IPs from the list of subnets.
	// (this is a "poor man"'s ACL, better use a real firewall)
	if (options.access_list)
	{
		web.use(acl(options.access_list))
	}

	// Outputs Apache-style logs for incoming HTTP requests.
	// E.g. "GET /users?page=2 200 466ms 4.66kb"
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
		// Gets locale from HTTP request
		// (the second parameter is the HTTP GET query parameter name
		//  and also the cookie name)
		koa_locale(web, 'locale')

		// Sets `ctx.locale` variable for reference
		web.use(async function(ctx)
		{
			ctx.locale = ctx.getLocaleFromQuery() || ctx.getLocaleFromCookie() || ctx.getLocaleFromHeader()
		})
	}

	// Secret keys (used for JWT token signing, for example)
	web.keys = options.keys

	// Enable JWT authentication
	if (options.authentication)
	{
		web.use(authentication
		({
			authentication : options.authentication,
			keys           : options.keys,
			validate_token : options.validate_token
		}))
	}

	// Sessions aren't currently used
	if (options.session)
	{
		web.use(session(options.redis))
	}

	// Checks if `parse_body` needs to be set to `true`
	// (that's the case for routing)
	if (options.parse_body !== false && options.routing === true)
	{
		options.parse_body = true
	}

	// Enables HTTP POST body parsing
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

	// Enables REST routing
	if (options.routing)
	{
		const { extensions, middleware } = routing
		({
			keys       : options.keys,
			routing    : options.routing,
			parse_body : options.parse_body
		})

		// Injects REST routing methods to `result` object.
		for (let key of Object.keys(extensions))
		{
			result[key] = extensions[key]
		}

		for (let use of middleware)
		{
			web.use(use)
		}
	}

	// Active HTTP proxy servers
	const proxies = []

	// HTTP server shutdown flag
	let shut_down = false

	// In case of server shutdown, stop accepting new HTTP connections.
	// (this code wasn't tested)
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

	// Shuts down the HTTP server.
	// Returns a Promise.
	// (this method wasn't tested)
	result.shut_down = function()
	{
		shut_down = true

		// Pending promises
		const pending = []

		// Shut down http proxies
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

	// Returns the number of currently present HTTP connections.
	// (this method wasn't tested)
	result.connections = function()
	{
		// http_server.getConnections()
		return promisify(web.getConnections, web)()
	}

	// Enables handling file uploads.
	// Takes an object with parameters.
	result.file_upload = function()
	{
		// Check for misconfiguration
		if (options.parse_body)
		{
			throw new Error(`.file_upload() was enabled but also "parse_body" wasn't set to false, therefore Http POST request bodies are parsed which creates a conflict. Set "parse_body" parameter to false.`)
		}

		// Enable file uploading middleware
		web.use(file_upload.apply(this, arguments))
	}

	// Shorter alias for file uploads
	result.upload = result.file_upload

	// Serves static files
	// (better do it with NginX or HAProxy in production)
	result.serve_static_files = function(url_path, filesystem_path, options = {})
	{
		// Cache them in the web browser for 1 year by default
		const maxAge = options.maxAge || 365 * 24 * 60 * 60
		// https://github.com/koajs/static
		web.use(mount(url_path, statics(filesystem_path, { maxAge })))
	}

	// Shorter alias for static files serving
	result.files = result.serve_static_files

	// Mounts Koa middleware at path
	result.mount = (path, handler) =>
	{
		web.use(mount(path, handler))
	}

	// exposes Koa .use() function for custom middleware
	result.use = web.use.bind(web)

	// Proxies all URLs starting with 'from_path' to another server
	// (make sure you proxy only to your own servers
	//  so that you don't leak cookies or JWT tokens to the 3rd party)
	result.proxy = (from_path, to, proxy_options) =>
	{
		const { proxy, middleware } = proxier(from_path, to, proxy_options)
		proxies.push(proxy)
		web.use(middleware)
	}

	// Redirection helper
	result.redirect = (from, to, status = 301) =>
	{
		web.use(mount(from, async function(ctx)
		{
			ctx.status = status
			ctx.redirect(to)
		}))
	}

	// Runs http server.
	// Returns a Promise resolving to an instance of HTTP server.
	result.listen = (port, host) =>
	{
		if (is_object(port))
		{
			host = port.host
			port = port.port
		}

		host = host || '0.0.0.0'

		return new Promise((resolve, reject) =>
		{
			// The last route - throws "Not found" error
			web.use(async function(ctx)
			{
				ctx.status = 404
				ctx.message = `The requested resource not found: ${ctx.method} ${ctx.url}`
				
				// Reduces noise in the `log` in case of errors
				// (web browsers query '/favicon.ico' automatically)
				if (!ends_with(ctx.path, '/favicon.ico'))
				{
					log.error(ctx.message, 'Web server error: Not found')
				}
			})

			// Create HTTP server
			const http_web_server = http.createServer()

			// // Enable Koa for handling HTTP requests
			// http_web_server.on('request', web.callback())

			// Copy-pasted from 
			// https://github.com/koajs/koala/blob/master/lib/app.js
			//
			// "Expect: 100-continue" is something related to http request body parsing
			// http://crypto.pp.ua/2011/02/mexanizm-expectcontinue/
			//
			const koa_callback = web.callback()
			http_web_server.on('request', koa_callback)
			http_web_server.on('checkContinue', function(request, response)
			{
				// Requests with `Expect: 100-continue`
				request.checkContinue = true
				koa_callback(request, response)
			})

			// Starts HTTP server
			http_web_server.listen(port, host, error =>
			{
				if (error)
				{
					return reject(error)
				}

				resolve(http_web_server)
			})
			// .on('connection', () => connections++)
			// .on('close', () => connections--)
		})
	}

	// done
	return result
}