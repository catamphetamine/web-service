import { exists } from './helpers'

export default
{
	Input_missing          : custom_error('Missing input',          { additional_properties: { http_status_code: 400 } }),
	Unauthenticated        : custom_error('Unauthenticated',        { additional_properties: { http_status_code: 401 } }),
	Unauthorized           : custom_error('Unauthorized',           { additional_properties: { http_status_code: 403 } }),
	Access_denied          : custom_error('Access denied',          { additional_properties: { http_status_code: 403 } }),
	Not_found              : custom_error('Not found',              { additional_properties: { http_status_code: 404 } }),
	Conflict               : custom_error('Conflict',               { additional_properties: { http_status_code: 409 } }),
	Unsupported_input_type : custom_error('Unsupported input type', { additional_properties: { http_status_code: 415 } }),
	Input_rejected         : custom_error('Input rejected',         { additional_properties: { http_status_code: 422 } }),
	Error                  : custom_error('Server error',           { additional_properties: { http_status_code: 500 } })
}

function custom_error(name, { code, message, lock_message, additional_properties })
{
	class Custom_error extends Error
	{
		constructor(argument)
		{
			super()

			if (exists(code))
			{
				this.code = code
			}

			if (exists(message))
			{
				this.message = message
			}
			else
			{
				this.message = name
			}

			if (exists(argument))
			{
				if (exists(argument.code))
				{
					this.code = argument.code
				}
				
				if (exists(argument.message))
				{
					this.message = argument.message
				}

				if (lock_message !== true)
				{
					this.message = argument || this.message
				}
			}

			this.name = name

			if (additional_properties)
			{
				for (let key of Object.keys(additional_properties))
				{
					if (this[key] === undefined)
					{
						this[key] = additional_properties[key]
					}
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