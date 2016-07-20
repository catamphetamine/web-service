import koa_router  from 'koa-router'
import mount       from 'koa-mount'
import body_parser from 'koa-bodyparser'
import { exists, is_object } from '../helpers'

import http_client from '../http'

export default function(options)
{
	const router = new koa_router()

	const extensions = {}

	// supports routing
	//
	// usage: web.get('/path', parameters => 'Echo')
	for (let method of ['get', 'put', 'patch', 'post', 'delete'])
	{
		extensions[method] = function(path, action)
		{
			// all errors thrown from this middleware will get caught 
			// by the error-catching middleware above
			router[method](path, function(ctx, next)
			{
				const session = ctx.session
				const session_id = ctx.sessionId
				const destroy_session = () => ctx.session = null

				const get_cookie = name => ctx.cookies.get(name)
				
				const set_cookie = (name, value, options = {}) =>
				{
					// http://stackoverflow.com/questions/3290424/set-a-cookie-to-never-expire
					options.expires = options.expires || new Date(2147483647000)  // January 2038

					ctx.cookies.set(name, value, options)
				}

				const destroy_cookie = name =>
				{
					ctx.cookies.set(name, null)
					ctx.cookies.set(name + '.sig', null)
				}

				// api call parameters
				const parameters = { ...ctx.request.body, ...ctx.query, ...ctx.params }

				// treat empty strings as `undefined`s
				for (let key of Object.keys(parameters))
				{
					if (parameters[key] === '')
					{
						delete parameters[key]
					}
				}

				// add JWT header to http client requests
				
				let tokenized_http_client = http_client

				if (ctx.jwt)
				{
					tokenized_http_client = {}

					const jwt_header = `Bearer ${ctx.jwt}`

					for (let key of Object.keys(http_client))
					{
						tokenized_http_client[key] = function(destination, data, options = {})
						{
							options.headers = options.headers || {}
							options.headers.Authorization = options.headers.Authorization || jwt_header

							return http_client[key](destination, data, options)
						}
					}
				}

				// call the api method action
				const result = action.bind(ctx)(parameters,
				{
					ip: ctx.ip,
					
					get_cookie,
					set_cookie,
					destroy_cookie,

					session,
					session_id,
					destroy_session,

					user                    : ctx.user,
					authentication_error    : ctx.authentication_error,
					authentication_token_id : ctx.jwt_id,
					authentication_token    : ctx.jwt,

					keys : options.keys,

					http : tokenized_http_client
				})

				// http://habrahabr.ru/company/yandex/blog/265569/
				// http://goinbigdata.com/how-to-design-practical-restful-api/
				switch (method)
				{
					case 'put':
						ctx.status = 204 // No Content - Resource was updated and body is empty

					case 'delete':
						ctx.status = 204 // No Content - Resource deleted and body is empty
				}

				function postprocess(result)
				{
					if (!exists(result))
					{
						return {}
					}

					if (!is_object(result) && !Array.isArray(result))
					{
						return { result }
					}

					return result
				}

				function is_redirect(result)
				{
					return is_object(result) && result.redirect && Object.keys(result).length === 1
				}

				const respond = result =>
				{
					if (is_redirect(result))
					{
						return ctx.redirect(result.redirect)
					}

					ctx.body = postprocess(result)
				}

				if (result instanceof Promise)
				{
					return result.then
					(
						respond,
						error => { throw error }
					)
				}
				else
				{
					respond(result)
				}
			})
		}
	}

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