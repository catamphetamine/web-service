import jwt from 'jsonwebtoken'

import errors from '../errors'

function get_jwt_token(context)
{
	let token = context.cookies.get('authentication')

	if (token)
	{
		return { token }
	}

	if (context.header.authorization)
	{
		const parts = context.header.authorization.split(' ')

		if (parts.length !== 2)
		{
			return { error: 'Bad Authorization header format. Format is "Authorization: Bearer <token>"' }
		}

		const scheme      = parts[0]
		const credentials = parts[1]

		if (!/^Bearer$/i.test(scheme))
		{
			return { error: 'Bad Authorization header format (scheme). Format is "Authorization: Bearer <token>"' }
		}

		return { token: credentials }
	}

	return { error: 'JWT token not found' }
}

// takes some milliseconds to finish
// because it validates the token via an Http request
// to the authentication service
async function authenticate({ authentication, keys, validate_token })
{
	const { token, error } = get_jwt_token(this)

	this.authenticate = () => { throw new errors.Unauthenticated() }
	this.role         = () => { throw new errors.Unauthenticated() }

	if (!token)
	{
		this.authentication_error = new errors.Unauthenticated(error)
		return
	}

	this.jwt = token

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

	if (!payload)
	{
		this.authentication_error = new errors.Unauthenticated('Corrupt token')
		return
	}

	const jwt_id = payload.jti

	// subject
	const user_id = payload.sub

	// validate token 
	// (for example, that it has not been revoked)
	if (validate_token)
	{
		if (!this.validating_jwt_id)
		{
			this.validating_jwt_id = validate_token(token, this)
		}

		// takes some milliseconds to finish
		//
		// validates the token via an Http request
		// to the authentication service
		const is_valid = (await this.validating_jwt_id).valid

		delete this.validating_jwt_id

		if (!is_valid)
		{
			this.authentication_error = new errors.Unauthenticated(`Token revoked`)
			return
		}
	}

	this.jwt_id = jwt_id

	this.user = authentication ? authentication(payload) : {}
	this.user.id = user_id
	
	// payload fields:
	//
	// 'iss' // Issuer
	// 'sub' // Subject
	// 'aud' // Audience
	// 'exp' // Expiration time
	// 'nbf' // Not before
	// 'iat' // Issued at 
	// 'jti' // JWT ID

	this.token_data = payload

	this.authenticate = () => this.user

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

export default function(options)
{
	return async function(ctx, next)
	{
		await authenticate.call(ctx, options)
		await next()
	}
}

export function issue_jwt_token(payload, keys, user_id, jwt_id)
{
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