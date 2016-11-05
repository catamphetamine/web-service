import { exists, is_object } from './helpers'

// httpstatuses.com
export default
{
	// 400 Bad Request
	//
	// Syntax error in HTTP Request payload.
	//
	// The server cannot or will not process the request due to something 
	// that is perceived to be a client error (e.g., malformed request syntax, 
	// invalid request message framing, or deceptive request routing).
	//
	Malformed_input : custom_error('Malformed input', { status: 400 }),

	// 401 Unauthorized
	//
	// Non-authenticated users are not allowed to perform this action.
	//
	// The request has not been executed because it lacks 
	// valid authentication credentials for the target resource.
	//
	Unauthenticated : custom_error('Unauthenticated', { status: 401 }),

	// 403 Forbidden
	//
	// The user has not enough privileges to perform this action.
	//
	// The server understood the request but refuses to authorize it.
	//
	Unauthorized : custom_error('Unauthorized', { status: 403 }),

	// Just an alias for `Unathorized`
	Access_denied : custom_error('Access denied', { status: 403 }),

	// 404 Not found
	//
	// The requested resource was not found.
	//
	Not_found : custom_error('Not found', { status: 404 }),

	// 409 Conflict
	//
	// The request could not be completed due to a conflict
	// with the current state of the target resource.
	//
	// This code is used in situations where the user might be able
	// to resolve the conflict and resubmit the request.
	//
	Conflict : custom_error('Conflict', { status: 409 }),

	// 415 Unsupported media type
	//
	// Unsupported HTTP Request content-type
	//
	Unsupported_input_type : custom_error('Unsupported input type', { status: 415 }),

	// 422 Unprocessable Entity
	//
	// The service supports the content type of the HTTP Request,
	// and the syntax of the HTTP Request entity is correct,
	// but was unable to process the contained instructions.
	// (e.g. missing a required JSON field)
	//
	Input_rejected : custom_error('Input rejected', { status: 422 }),

	// 429 Too Many Requests
	//
	// The user has sent too many requests in a given amount of time.
	// Intended for use with rate-limiting schemes.
	//
	Too_many_requests : custom_error('Too many requests', { status: 429 }),

	// 500 Internal Server Error
	//
	// HTTP Request input is valid, but the service encountered
	// an unexpected condition which prevented it from fulfilling the request.
	//
	Error : custom_error('Server error', { status: 500 })
}

function custom_error(name, default_properties = {})
{
	return class Custom_error extends Error
	{
		data = {}

		constructor(message, properties = {})
		{
			super()

			// Normalize arguments
			if (is_object(message))
			{
				properties = message
				message = undefined
			}

			// Set default properties
			for (let key of Object.keys(default_properties))
			{
				// Set the property
				this.data[key] = default_properties[key]
				// Set the property shortcut
				this[key]      = default_properties[key]
			}

			this.name    = name
			this.message = name

			if (message)
			{
				this.message = message
			}

			// Set error instance properties
			for (let key of Object.keys(properties))
			{
				// Set the property
				this.data[key] = properties[key]
				// Set the property shortcut
				this[key]      = properties[key]
			}

			// Capture stack trace (if available)
			if (Error.captureStackTrace)
			{
				Error.captureStackTrace(this, Custom_error)
			}
		}
	}
}