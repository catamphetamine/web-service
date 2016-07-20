import { html as html_stack_trace } from 'print-error'
import { exists } from '../helpers'

export default function({ development, log })
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
			let http_status_code

			if (exists(error.http_status_code))
			{
				http_status_code = error.http_status_code
			}
			// superagent errors
			// https://github.com/visionmedia/superagent/blob/29ca1fc938b974c6623d9040a044e39dfb272fed/lib/node/response.js#L106
			else if (typeof error.status === 'number')
			{
				http_status_code = error.status
			}

			if (exists(http_status_code))
			{
				// set Http Response status code according to the error's `code`
				ctx.status = http_status_code

				// set Http Response text according to the error message
				ctx.body = error.message || 'Internal error'
			}
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

				log.error(error, '(http request failed)')

				ctx.status = 500
				ctx.body = 'Internal error'
			}

			// show error stack trace in development mode for easier debugging
			if (development && (!http_status_code || (http_status_code === 500 && error.message === 'Internal Server Error')))
			{
				const { response_status, response_body } = render_stack_trace(error)

				if (response_body)
				{
					ctx.status = response_status || http_status_code || 500
					ctx.body = response_body
					ctx.type = 'html'

					return
				}
			}
		}
	}
}

function render_stack_trace(error)
{
	// supports custom `html` for an error
	if (error.html)
	{
		return { response_status: error.code, response_body: error.html }
	}

	// handle `superagent` errors: if an error response was an html, then just render it
	// https://github.com/visionmedia/superagent/blob/29ca1fc938b974c6623d9040a044e39dfb272fed/lib/node/response.js#L106
	if (typeof error.status === 'number')
	{
		// if the `superagent` http request returned an html response 
		// (possibly an error stack trace),
		// then just output that stack trace
		if (error.response 
			&& error.response.headers['content-type']
			&& error.response.headers['content-type'].split(';')[0].trim() === 'text/html')
		{
			return { response_status: error.status, response_body: error.message }
		}
	}

	// if this error has a stack trace then it can be shown

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

	// if this error doesn't have a stack trace - do nothing
	if (!stack_trace)
	{
		return {}
	}

	try
	{
		return { response_body: html_stack_trace({ stack: stack_trace }, { font_size: '20pt' }) }
	}
	catch (error)
	{
		console.error(error)
		return { response_status: 500, response_body: error.stack }
	}
}
