import jwt from 'jsonwebtoken'

import errors from '../errors'

// Looks for JWT token inside HTTP Authorization header
function get_jwt_token(context)
{
	// Parses "Authorization: Bearer ${token}"
	if (context.header.authorization)
	{
		const match = context.header.authorization.match(/^Bearer (.+)$/i)

		if (match)
		{
			return { token: match[1] }
		}

		// return { error: 'Bad Authorization header format. Format is "Authorization: Bearer <token>"' }
	}

	// (doesn't read cookies anymore to protect users from CSRF attacks)
	// // Tries the "authentication" cookie
	// if (context.cookies.get('authentication'))
	// {
	// 	return { token: context.cookies.get('authentication') }
	// }

	// No JWT token was found
	return { error: `JWT token not found: no "Authorization: Bearer {token}" HTTP header specified.` }
}

// Looks for JWT token, and if it is found, sets some variables.
async function authenticate({ authentication, keys, validate_token })
{
	// Get JWT token from incoming HTTP request
	const { token, error } = get_jwt_token(this)

	// Little helpers which can be called from routes to ensure
	// a logged in user or a specific user role
	this.authenticate = () => { throw new errors.Unauthenticated() }
	this.role         = () => { throw new errors.Unauthenticated() }

	// If no JWT token was found, then done
	if (!token)
	{
		this.authentication_error = new errors.Unauthenticated(error)
		return
	}

	// JWT token (is now accessible from Koa's `ctx`)
	this.jwt = token

	// Verify JWT token integrity
	// by checking its signature using the supplied `keys`

	let payload

	for (let secret of keys)
	{
		try
		{
			payload = jwt.verify(token, secret)
			break
		}
		catch (error)
		{
			// if authentication token expired
			if (error.name === 'TokenExpiredError')
			{
				this.authentication_error = new errors.Unauthenticated('Token expired')
				return
			}

			// try another `secret`
			if (error.name === 'JsonWebTokenError')
			{
				continue
			}

			// some other error
			throw error					
		}
	}

	// If JWT token signature was unable to be verified, then exit
	if (!payload)
	{
		this.authentication_error = new errors.Unauthenticated('Corrupt token')
		return
	}

	// JWT token ID
	const jwt_id = payload.jti

	// `subject`
	// (which is a user id)
	const user_id = payload.sub

	// Optional JWT token validation (by id)
	// (for example, that it has not been revoked)
	if (validate_token)
	{
		// Can validate the token via a request to a database, for example.
		// Checks for `valid` property value inside the result object.
		// (There can possibly be other properties such as `reason`)
		const is_valid = (await validate_token(token, this)).valid

		// If the JWT token happens to be invalid
		// (expired or revoked, for example), then exit.
		if (!is_valid)
		{
			this.authentication_error = new errors.Unauthenticated(`Token revoked`)
			return
		}
	}

	// JWT token ID is now accessible via Koa's `ctx`
	this.jwt_id = jwt_id

	// Extracts user data (description) from JWT token payload
	// (`user` is now accessible via Koa's `ctx`)
	this.user = authentication ? authentication(payload) : {}

	// Sets user id
	this.user.id = user_id
	
	// Extra payload fields:
	//
	// 'iss' // Issuer
	// 'sub' // Subject
	// 'aud' // Audience
	// 'exp' // Expiration time
	// 'nbf' // Not before
	// 'iat' // Issued at 
	// 'jti' // JWT ID

	// JWT token payload is accessible via Koa's `ctx`
	this.token_data = payload

	// The user is assumed authenticated now,
	// so `this.authenticate()` helper won't throw an exception.
	// (and will return the `user`)
	this.authenticate = () => this.user

	// A little helper which can be called from routes
	// as `this.role('administrator')`
	// which will throw if the user isn't administrator
	// (`authentication` function needs to get 
	//  `role` from JWT payload for this to work)
	this.role = (...roles) =>
	{
		for (let role of roles)
		{
			if (this.user.role === role)
			{
				return true
			}
		}

		throw new errors.Unauthorized(`One of the following roles is required: ${roles}`)
	}
}

// Koa middleware creator
export default function(options)
{
	// Koa middleware
	return async function(ctx, next)
	{
		await authenticate.call(ctx, options)
		await next()
	}
}

// Generates and signs a JWT token
export function issue_jwt_token({ payload, keys, user_id, jwt_id })
{
	if (arguments.length !== 1)
	{
		throw new Error("`jwt` function must take a single argument: an object { payload, keys, user_id, jwt_id }")
	}
	
	if (!keys)
	{
		throw new Error(`JWT encryption "keys" weren't supplied`)
	}

	const token = jwt.sign(payload, keys[0],
	{
		subject : user_id,
		jwtid   : jwt_id
	})

	return token
}