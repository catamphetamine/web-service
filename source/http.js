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

				// 204 - No content (e.g. PUT, DELETE)
				if (response.statusCode === 204)
				{
					return resolve()
				}

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

// JSON date deserializer.
//
// Automatically converts ISO serialized `Date`s
// in JSON responses for Ajax HTTP requests.
//
// Without it the developer would have to convert
// `Date` strings to `Date`s in Ajax HTTP responses manually.
//
// Use as the second, 'reviver' argument to `JSON.parse`: `JSON.parse(json, JSON.date_parser)`
//
// http://stackoverflow.com/questions/14488745/javascript-json-date-deserialization/23691273#23691273

// ISO 8601 date regular expression
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/

// Walks JSON object tree
function parse_dates(object)
{
	// If an array is encountered, 
	// proceed recursively with each element of this array.
	if (object instanceof Array)
	{
		let i = 0
		while (i < object.length)
		{
			object[i] = parse_dates(object[i])
			i++
		}
	}
	// If a child JSON object is encountered,
	// convert all of its `Date` string values to `Date`s,
	// and proceed recursively for all of its properties.
	else if (is_object(object))
	{
		for (let key of Object.keys(object))
		{
			const value = object[key]
			if (typeof value === 'string' && ISO.test(value))
			{
				object[key] = new Date(value)
			}
			else
			{
				// proceed recursively
				parse_dates(value)
			}
		}
	}

	// Dates have been converted for this JSON object
	return object
}

export default http_client