import { html as html_stack_trace } from 'print-error'
import { exists, is_object } from '../helpers'

export default function({ development, log, markup_settings })
{
	return async function(ctx, next)
	{
		try
		{
			// // measure Http request processing time
			// const key = `${ctx.host}${ctx.url}`

			// // started processing Http request
			// console.time(key)

			// try to respond to this Http request
			await next()

			// // finished processing Http request
			// console.timeEnd(key)
		}
		catch (error)
		{
			// HTTP response status code
			let http_status_code

			// If this error has an HTTP status code set,
			// then this status code will be used when sending HTTP response.
			// (this also works for `superagent` errors because they too have the `status` property)
			if (typeof error.status === 'number')
			{
				http_status_code = error.status
			}

			// If HTTP response status code has been obtained, then use it.
			if (http_status_code)
			{
				// Set Http Response status code according to the error's `code`
				ctx.status = http_status_code

				// Set Http Response according to the error thrown
				if (is_object(error.data))
				{
					const error_data = error.data

					if (!exists(error_data.message))
					{
						error_data.message = error.message
					}

					if (!exists(error_data.status))
					{
						error_data.status = error.status
					}

					ctx.body = error_data
				}
				else
				{
					ctx.body = error.message || 'Internal error'
				}
			}
			// Else, if no HTTP response status code was specified,
			// default to 500 and a generic error message.
			else
			{
				// log the error, if it's not a normal Api error
				// (prevents log pollution with things like 
				//  `404 User not found` or `401 Not authenticated`)

				// if (error.proxy_error 
				// 	&& options.show_proxy_errors 
				// 	&& options.show_proxy_errors[error.proxy_to] === false)
				// {
				// 	// don't output error to the log
				// }
				// else
				// {
				// 	// for easier debugging
				// 	console.log('(http request failed)')
				// 	log.error(error)
				// }

				log.error(error)

				ctx.status = 500
				ctx.body = 'Internal error'
			}

			// (in development mode)
			// Show stack trace for generic errors for easier debugging
			if (development)
			{
				// If it was a generic (unspecific) error,
				// then render its stack trace.
				if (!http_status_code)
				{
					const { response_status, response_body } = render_stack_trace(error, { markup_settings, log })

					if (response_body)
					{
						ctx.status = response_status || 500
						ctx.body = response_body
						ctx.type = 'html'

						// Can be used to reconstruct the original error message
						ctx.set('X-Error-Message', error.message)
						// Can be used to reconstruct the original error stack trace
						ctx.set('X-Error-Stack-Trace', JSON.stringify(error.stack))
					}
				}
			}
		}
	}
}

// Renders the stack trace of an error as HTML markup
function render_stack_trace(error, { markup_settings, log })
{
	// Supports custom `html` for an error
	if (error.html)
	{
		return { response_status: error.status, response_body: error.html }
	}

	// Handle `superagent` errors
	// https://github.com/visionmedia/superagent/blob/29ca1fc938b974c6623d9040a044e39dfb272fed/lib/node/response.js#L106
	if (error.response && typeof error.status === 'number')
	{
		// If the `superagent` http request returned an HTML response 
		// (possibly an error stack trace),
		// then just output that stack trace.
		if (error.response.headers['content-type']
			&& error.response.headers['content-type'].split(';')[0].trim() === 'text/html')
		{
			return { response_status: error.status, response_body: error.message }
		}
	}

	// If this error has a stack trace then it can be shown

	let stack_trace

	if (error.stack)
	{
		stack_trace = error.stack
	}
	// `superagent` errors have the `original` property 
	// for storing the initial error
	else if (error.original && error.original.stack)
	{
		stack_trace = error.original.stack
	}

	// If this error doesn't have a stack trace - do nothing
	if (!stack_trace)
	{
		return {}
	}

	// Render the error's stack trace as HTML markup
	try
	{
		return { response_body: html_stack_trace({ stack: stack_trace }, markup_settings) }
	}
	catch (error)
	{
		log.error(error)

		// If error stack trace couldn't be rendered as HTML markup,
		// then just output it as plain text.
		return { response_body: error.stack }
	}
}
