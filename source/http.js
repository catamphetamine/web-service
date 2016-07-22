import superagent from 'superagent'
import { is_object } from './helpers'

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
				// If HTTP response was received,
				// and if that HTTP response is a JSON object,
				// then the error is the `error` property of that object.
				if (!error && response)
				{
					error = response.error
				}

				// If the HTTP request failed, or returned an `error` property
				if (error)
				{
					// superagent would have already output the error to console
					// console.error(error.stack)
					
					console.log('[http client] (http request error)')

					// If the 
					if (response)
					{
						error.code = response.status

						const content_type = response.get('content-type').split(';')[0].trim()

						if (content_type === 'text/plain')
						{
							error.message = response.text
						}
						else if (content_type === 'text/html')
						{
							error.html = response.text
						}
					}

					return reject(error)
				}

				resolve(response.body)
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