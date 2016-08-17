import { exists, is_object } from './helpers'

export default
{
	Input_missing          : custom_error('Missing input',          { status: 400 }),
	Unauthenticated        : custom_error('Unauthenticated',        { status: 401 }),
	Unauthorized           : custom_error('Unauthorized',           { status: 403 }),
	Access_denied          : custom_error('Access denied',          { status: 403 }),
	Not_found              : custom_error('Not found',              { status: 404 }),
	Conflict               : custom_error('Conflict',               { status: 409 }),
	Unsupported_input_type : custom_error('Unsupported input type', { status: 415 }),
	Input_rejected         : custom_error('Input rejected',         { status: 422 }),
	Error                  : custom_error('Server error',           { status: 500 })
}

function custom_error(name, default_properties)
{
	class Custom_error extends Error
	{
		constructor(message, properties)
		{
			super()

			if (is_object(message))
			{
				properties = message
				message = undefined
			}

			for (let key of Object.keys(default_properties))
			{
				this[key] = default_properties[key]
			}

			this.name    = name
			this.message = name

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

			if (Error.captureStackTrace)
			{
				Error.captureStackTrace(this, Custom_error)
			}
		}
	}

	return Custom_error
}