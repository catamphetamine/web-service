import jwt from 'jsonwebtoken'

import errors from '../errors'

// Looks for JWT token inside HTTP Authorization header
function get_jwt_token(ctx)
{
	// Parses "Authorization: Bearer ${token}"
	if (ctx.header.authorization)
	{
		const match = ctx.header.authorization.match(/^Bearer (.+)$/i)

		if (match)
		{
			return match[1]
		}
	}

	// (doesn't read cookies anymore to protect users from CSRF attacks)
	// // Tries the "authentication" cookie
	// if (ctx.cookies.get('authentication'))
	// {
	// 	return ctx.cookies.get('authentication')
	// }
}

// Looks for JWT token, and if it is found, sets some variables.
async function authenticate({ options, keys, log })
{
	// A little helper which can be called from routes
	// as `ctx.role('administrator')`
	// which will throw if the user isn't administrator.
	// The `roles` are taken from JWT payload.
	this.role = (...roles) =>
	{
		if (!this.user)
		{
			throw new errors.Unauthenticated()
		}

		for (const role of roles)
		{
			for (const user_role of this.user.roles)
			{
				if (user_role === role)
				{
					return true
				}
			}
		}

		throw new errors.Unauthorized(`One of the following roles is required: ${roles}`)
	}

	// Get JWT token from incoming HTTP request
	let token = get_jwt_token(this)

	// If no JWT token was found, then done
	if (!token)
	{
		return
	}

	// JWT token (is now accessible from Koa's `ctx`)
	this.accessToken = token

	// Verify JWT token integrity
	// by checking its signature using the supplied `keys`

	let payload

	for (const secret of keys)
	{
		try
		{
			payload = jwt.verify(token, secret)
			break
		}
		catch (error)
		{
			// If authentication token expired
			if (error.name === 'TokenExpiredError')
			{
				if (options.refreshAccessToken)
				{
					// If refreshing an access token fails
					// then don't prevent the user from at least seeing a page
					// therefore catching an error here.
					try
					{
						token = await options.refreshAccessToken(this)
					}
					catch (error)
					{
						log.error(error)
					}

					if (token)
					{
						for (const secret of keys)
						{
							try
							{
								payload = jwt.verify(token, secret)
								break
							}
							catch (error)
							{
								// Try another `secret`
								if (error.name === 'JsonWebTokenError')
								{
									continue
								}

								// Some other non-JWT-related error
								log.error(error)
								break
							}
						}
					}
				}

				if (payload)
				{
					break
				}

				throw new errors.Access_token_expired()
			}

			// Try another `secret`
			if (error.name === 'JsonWebTokenError')
			{
				// `error.message`:
				//
				// 'jwt malformed'
				// 'jwt signature is required'
				// 'invalid signature'
				// 'jwt audience invalid. expected: [OPTIONS AUDIENCE]'
				// 'jwt issuer invalid. expected: [OPTIONS ISSUER]'
				// 'jwt id invalid. expected: [OPTIONS JWT ID]'
				// 'jwt subject invalid. expected: [OPTIONS SUBJECT]'
				//
				continue
			}

			// Some other non-JWT-related error.
			// Shouldn't prevent the user from at least seeing a page
			// therefore not rethrowing this error.
			log.error(error)
			break
		}
	}

	// If JWT token signature was unable to be verified, then exit
	if (!payload)
	{
		return
	}

	// If the access token isn't valid for access to this server
	// (e.g. it's a "refresh token") then exit.
	if (options.validateAccessToken)
	{
		if (!options.validateAccessToken(payload, this))
		{
			return
		}
	}

	// Token payload can be accessed through `ctx`
	this.accessTokenPayload = payload

	// Fire "on user request" hook
	if (options.onUserRequest)
	{
		options.onUserRequest(token, this)
	}

	// JWT token ID
	const jwt_id = payload.jti

	// `subject`
	// (which is a user id)
	const user_id = payload.sub

	// // Optional JWT token validation (by id)
	// // (for example, that it has not been revoked)
	// if (validateToken)
	// {
	// 	// Can validate the token via a request to a database, for example.
	// 	// Checks for `valid` property value inside the result object.
	// 	// (There can possibly be other properties such as `reason`)
	// 	const is_valid = (await validateToken(token, this)).valid
	//
	// 	// If the JWT token happens to be invalid
	// 	// (expired or revoked, for example), then exit.
	// 	if (!is_valid)
	// 	{
	// 		// this.authenticationError = new errors.Unauthenticated('AccessTokenRevoked')
	// 		return
	// 	}
	// }

	// JWT token ID is now accessible via Koa's `ctx`
	this.accessTokenId = jwt_id

	// Extracts user data (description) from JWT token payload
	// (`user` is now accessible via Koa's `ctx`)
	this.user = options.userInfo ? options.userInfo(payload) : {}

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
	this.accessTokenPayload = payload
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
export function issue_jwt_token({ payload, key, userId, tokenId, issuer, audience, expiresIn, notBefore, algorithm, noTimestamp, header })
{
	if (arguments.length !== 1)
	{
		throw new Error("`jwt` function must take a single argument: an object { payload, key, userId, tokenId, ... }")
	}
	
	if (!key)
	{
		throw new Error(`JWT encryption "key" wasn't supplied`)
	}

	const token = jwt.sign(payload, key,
	{
		subject : userId,
		jwtid   : tokenId,

		// (optional)
		// The iss (issuer) claim identifies the principal that issued the JWT.
		// E.g. `google.com`.
		issuer,

		// (optional)
		// "audience" is where this token will be applied.
		// Typically, the base address of the resource being accessed,
		// such as "contoso.com".
		// The JWT will contain an "aud" claim that specifies which
		// Resource Servers the JWT is valid for.
		// If the "aud" contains "www.webapp.com",
		// but the client app tries to use the JWT on "secret.webapp.com",
		// then access will be denied because that Resource Server
		// will see that the JWT was not meant for it.
		audience,

		// (optional)
		// (in seconds)
		// After this time passes the JWT will be considered invalid.
		// E.g.: 60, "2 days", "10h", "7d"
		expiresIn,

		// (optional)
		// (in seconds)
		// The not-before time claim identifies the time
		// on which the JWT will start to be accepted for processing.
		// E.g.: 60, "2 days", "10h", "7d"
		notBefore,

		// (optional)
		algorithm,

		// (optional)
		noTimestamp,

		// (optional)
		header
	})

	return token
}

// Generates and signs a JWT token.
// `options.ignoreExpiration = true` can be passed.
export function verify_jwt_token(token, keys, options)
{
	let payload

	for (const secret of keys)
	{
		try
		{
			payload = jwt.verify(token, secret, options)
			break
		}
		catch (error)
		{
			// Try another `secret`
			if (error.name === 'JsonWebTokenError')
			{
				continue
			}

			// Some other non-JWT-related error
			throw error
		}
	}
}