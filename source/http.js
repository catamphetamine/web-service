import superagent from 'superagent'
import { is_object } from './helpers'
import parse_dates from './date parser'

// HTTP request methods
const methods =
[
	'get',
	'post',
	'put',
	'patch',
	'delete',
	'head',
	'options'
]

const http_client = {}

// Define HTTP methods on `http_client` object
for (let method of methods)
{
	http_client[method] = (destination, data, options = {}) =>
	{
		const url = format_url(destination)

		return new Promise((resolve, reject) =>
		{
			// Create Http request
			const request = superagent[method](url)

			// Attach data to the outgoing HTTP request
			if (data)
			{
				switch (method)
				{
					case 'get':
						request.query(data)
						break

					case 'post':
					case 'put':
					case 'patch':
					case 'head':
					case 'options':
						request.send(data)
						break

					case 'delete':
						throw new Error(`"data" supplied for HTTP DELETE request: ${JSON.stringify(data)}`)

					default:
						throw new Error(`Unknown HTTP method: ${method}`)
				}
			}

			// Apply this HTTP request specific HTTP headers
			if (options.headers)
			{
				request.set(options.headers)
			}

			// Send HTTP request
			request.end((error, response) => 
			{
				// If there was an error, then reject the Promise
				if (error)
				{
					// `superagent` would have already output the error to console
					// console.error(error.stack)

					// console.log('[react-isomorphic-render] (http request error)')

					// Populate error from the HTTP response
					if (response)
					{
						// Set `error` `status` to HTTP response status code
						error.status = response.statusCode

						switch (response.type)
						{
							// Set error `data` from response body,
							case 'application/json':
								// if (!is_object(error.data))
								error.data = response.body

								// Set the more meaningful message for the error (if available)
								if (error.data.message)
								{
									error.message = error.data.message
								}

								break

							// If the HTTP response was not a JSON object,
							// but rather a text or an HTML page,
							// then include that information in the `error`
							// for future reference (e.g. easier debugging).

							case 'text/plain':
								error.message = response.text
								break

							case 'text/html':
								error.html = response.text

								// Recover the original error message (if any)
								if (response.headers['x-error-message'])
								{
									error.message = response.headers['x-error-message']
								}

								// Recover the original error stack trace (if any)
								if (response.headers['x-error-stack-trace'])
								{
									error.stack = JSON.parse(response.headers['x-error-stack-trace'])
								}

								break
						}
					}

					// HTTP request failed with an `error`
					return reject(error)
				}

				// HTTP request completed without errors,
				// so return the HTTP response data.

				// If HTTP response status is "204 - No content"
				// (e.g. PUT, DELETE)
				// then resolve with an empty result
				if (response.statusCode === 204)
				{
					return resolve()
				}

				// Else, the result is HTTP response body
				resolve(parse_dates(response.body))
			})
		})
	}
}

function format_url(destination)
{
	if (is_object(destination))
	{
		// Prepend host and port of the API server to the path.
		return `http://${destination.host}:${destination.port}${destination.path}`
	}

	// Prepend prefix to relative URL, to proxy to API server.
	return destination
}

export default http_client