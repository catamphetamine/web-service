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
		api[method] = web[method]

		api.legacy[method] = function(route, handler, error_handler)
		{
			web[method](route, async function(parameters)
			{
				try
				{
					return { redirect: await handler.apply(this, arguments) }
				}
				catch (error)
				{
					// log the error, if it's not a normal Api error
					// (prevents log pollution with things like 
					//  `404 User not found` or `401 Not authenticated`)
					if (!exists(error.code))
					{
						log.error(error, 'Api service error')
					}

					const url = error_handler.call(this, error)

					const redirect = new Url(url).set_parameters
					({
						...parameters, 
						error_code : error.code, 
						error      : error.message 
					})
					.print()

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