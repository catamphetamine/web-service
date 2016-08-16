import path from 'path'
import fs   from 'fs'

import web_service   from './web service'
import Url           from './url'
import { exists, is_object } from './helpers'

export default function(options = {})
{
	const web = web_service
	({
		...options,
		compress : true,
		routing  : true
	})

	const log = web.log

	const api = {}
	api.legacy = {}

	for (let method of ['get', 'put', 'patch', 'post', 'delete'])
	{
		// Web 2.0 Api (Ajax)
		api[method] = web[method]

		// Web 1.0 Api (no Ajax)
		api.legacy[method] = function(route, handler, error_handler)
		{
			web[method](route, async function(parameters)
			{
				try
				{
					// The handler returns a URL to which the user will be redirected
					return { redirect: await handler.apply(this, arguments) }
				}
				catch (error)
				{
					// Log the error, if it's not a normal Api error
					// (prevents log pollution with things like 
					//  `404 User not found` or `401 Not authenticated`)
					if (!exists(error.code))
					{
						log.error(error)
					}

					// Call the `error_handler` to get a URL
					// to which the user will be redirected
					const url = error_handler.call(this, error)

					// Add error info to the URL
					// to which the user is going to be redirected
					const redirect = new Url(url).set_parameters
					({
						...parameters, 
						error_field : error.field, 
						error_code  : error.code, 
						error       : error.message 
					})
					.print()

					// Perform the redirect
					return { redirect }
				}
			})
		}
	}

	if (!options.api)
	{
		throw new Error(`Api service "api" array is required`)
	}

	for (let api_module of options.api)
	{
		// log.info('loading api module', file)
		api_module(api)
	}

	const result = 
	{
		listen: (port, host) => web.listen(port, host)
	}

	return result
}