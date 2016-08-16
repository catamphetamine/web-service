import { exists, is_object } from './helpers'

export default
{
	Input_missing          : custom_error('Missing input',          { http_status_code: 400 }),
	Unauthenticated        : custom_error('Unauthenticated',        { http_status_code: 401 }),
	Unauthorized           : custom_error('Unauthorized',           { http_status_code: 403 }),
	Access_denied          : custom_error('Access denied',          { http_status_code: 403 }),
	Not_found              : custom_error('Not found',              { http_status_code: 404 }),
	Conflict               : custom_error('Conflict',               { http_status_code: 409 }),
	Unsupported_input_type : custom_error('Unsupported input type', { http_status_code: 415 }),
	Input_rejected         : custom_error('Input rejected',         { http_status_code: 422 }),
	Error                  : custom_error('Server error',           { http_status_code: 500 })
}

function custom_error(name, default_properties)
{
	class Custom_error extends Error
	{
		constructor(message, properties)
		{
			super()

			this.name    = name
			this.message = name

			if (is_object(message))
			{
				properties = message
				message = undefined
			}

			if (message)
			{
				this.message = message
			}

			if (exists(properties))
			{
				for (let key of Object.keys(properties))
				{
					this[key] = properties[key]
				}
			}

			for (let key of Object.keys(default_properties))
			{
				if (this[key] === undefined)
				{
					this[key] = default_properties[key]
				}
			}

			if (Error.captureStackTrace)
			{
				Error.captureStackTrace(this, Custom_error)
			}
		}
	}

	return Custom_error
}