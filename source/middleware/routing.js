import util from 'util'

import koa_router  from 'koa-router'
import mount       from 'koa-mount'
import body_parser from 'koa-bodyparser'

import { exists, is_object, starts_with } from '../helpers'

// `http` utility
import http from '../http'

export default function(options)
{
	const router = new koa_router()

	// These extesion methods will be added
	// to the webservice object later (not in this function)
	const extensions = {}

	// Define handlers for HTTP requests for these HTTP methods
	for (let method of ['get', 'put', 'patch', 'post', 'delete'])
	{
		extensions[method] = function(path, action)
		{
			// All errors thrown from this middleware will get caught 
			// by the error-catching middleware up the middleware chain
			router[method](path, function(ctx, next)
			{
				// Sessions aren't currently used
				const session = ctx.session
				const session_id = ctx.sessionId
				const destroy_session = () => ctx.session = null

				// Cookie helpers

				const get_cookie = name => ctx.cookies.get(name)

				const set_cookie = (name, value, options = {}) =>
				{
					// Set the cookie to expire in January 2038 (the fartherst it can get)
					// http://stackoverflow.com/questions/3290424/set-a-cookie-to-never-expire
					options.expires = options.expires || new Date(2147483647000)

					ctx.cookies.set(name, value, options)
				}

				const destroy_cookie = name =>
				{
					// Clear the coookie itself (raw value)
					ctx.cookies.set(name, null)
					// The ".sig" counterpart contains the hash of the cookie,
					// so clear it too (used for Koa "signed cookies").
					ctx.cookies.set(name + '.sig', null)
				}

				// This route handler parameters,
				// which are extracted from POST body, GET query, and route parameters.
				const parameters = { ...ctx.request.body, ...ctx.query, ...ctx.params }

				// Treat empty string parameters as `undefined`s
				for (let key of Object.keys(parameters))
				{
					if (parameters[key] === '')
					{
						delete parameters[key]
					}
				}

				// By default, use the standard `http` utility
				let http_client = http

				// If Json Web Tokens are used for authentication,
				// then add JWT Authorization header to internal HTTP requests.
				if (ctx.jwt)
				{
					// Customize all methods of `http` utility
					http_client = {}

					// HTTP Authorization header value for a JWT token
					const jwt_header = `Bearer ${ctx.jwt}`

					// For each HTTP method
					for (let key of Object.keys(http))
					{
						// Add JWT Header to an internal HTTP request
						http_client[key] = function(destination, data, options = {})
						{
							// Send JWT token in `Authorization` HTTP header
							options.headers = options.headers || {}
							options.headers.Authorization = options.headers.Authorization || jwt_header

							// Perform HTTP request
							return http[key](destination, data, options)
						}
					}
				}

				// Сall the route handler with `parameters` and a utility object
				const result = action.bind(ctx)(parameters,
				{
					// Client's IP address.
					// Trusts 'X-Forwarded-For' HTTP header.
					ip: ctx.ip,
					
					// Cookie utilities
					get_cookie,
					set_cookie,
					destroy_cookie,

					// Sessions aren't used currently
					session,
					session_id,
					destroy_session,

					// JWT stuff
					user                    : ctx.user,
					authentication_error    : ctx.authentication_error,
					authentication_token_id : ctx.jwt_id,
					authentication_token    : ctx.jwt,

					// Applicaton's secret signing keys
					keys : options.keys,

					// internal `http` utility
					// (only use it for internal HTTP requests,
					//  because it will send cookies and JWT tokens too)
					internal_http : http_client
				})

				// Responds to this HTTP request
				// with a route handler result
				const respond = result =>
				{
					// Return some special 200 statuses for some special HTTP methods
					// http://goinbigdata.com/how-to-design-practical-restful-api/
					// http://habrahabr.ru/company/yandex/blog/265569/
					switch (method)
					{
						case 'put':
						case 'delete':
							if (exists(result))
							{
								throw new Error(`PUT and DELETE HTTP queries must not return any content.\nRequested ${method.toUpperCase()} ${ctx.originalUrl} and got:\n${util.inspect(result)}`)
							}
							break
					}

					// If it's a redirect, then do the redirect
					if (is_redirect(result))
					{
						return ctx.redirect(result.redirect)
					}

					if (!exists(result))
					{
						ctx.status = 204 // No Content
						return
					}

					// Send result JSON object as HTTP response body
					ctx.body = response(result)
				}

				// If route handler result is a Promise,
				// then wait for it to finish, and then respond.
				// Otherwise respond immediately.
				if (result && typeof result.then === 'function')
				{
					// All errors thrown here will be caught
					// by the error-catching middleware up the middleware chain
					return result.then(respond, error => { throw error })
				}
				else
				{
					respond(result)
				}
			})
		}
	}

	// Routing requires parsing HTTP POST requests body
	// to be able to parse HTTP POST parameters
	// and pass them in `parameters` to HTTP POST route handlers.
	//
	// So if routing is enabled for all paths,
	// then HTTP POST request body parsing
	// should also be enabled globally.
	//
	// This is not a strict requirement
	// because one may simply opt out of using POST handlers
	// while still using GET handlers, for example.
	//
	// But still it's a useful simple check
	// to make sure a developer didn't mess up the settings.
	//
	if (typeof options.routing !== 'string')
	{
		if (!options.parse_body)
		{
			throw new Error(`"parse_body" was set to false and "routing" was set to true. Set "routing" to a path then.`)
		}

		const result =
		{
			extensions,
			middleware:
			[
				router.routes(),
				router.allowedMethods()
			]
		}

		return result
	}
	else
	{
		const result =
		{
			extensions,
			middleware:
			[
				mount(options.routing, body_parser({ formLimit: '100mb' })),
				mount(options.routing, router.routes()),
				mount(options.routing, router.allowedMethods())
			]
		}

		return result
	}
}

// Creates HTTP response JSON object
// out of a route handler result
function response(result)
{
	if (!is_object(result) && !Array.isArray(result))
	{
		return { result }
	}

	return result
}

// Checks if a route handler requests a redirect to a URL
// (then `result` must have a form of `{ redirect: "/url" }`)
function is_redirect(result)
{
	return is_object(result) && result.redirect && Object.keys(result).length === 1
}