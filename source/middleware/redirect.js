import { starts_with } from '../helpers'

// Redirection helper
export default function redirect(from, options = {})
{
	const { status, ...rest_options } = options

	return async function(ctx, next)
	{
		const destination = match(ctx, from, rest_options)

		// If no match, then don't redirect
		if (!destination)
		{
			return next()
		}

		// Perform the redirect
		ctx.status = status || 301
		ctx.redirect(destination)
	}
}

// Checks if HTTP request URL matches the conditions.
// Returns a new URL (or path)
export function match(ctx, from, options)
{
	// Validate `from`
	if (!starts_with(from, '/'))
	{
		throw new Error(`Invalid "from" path: "${from}". Must start with a slash.`)
	}

	const { match, to, exact } = options

	// In case of user supplied custom matching function
	if (match)
	{
		return match(ctx)
	}

	// Validate `to`
	if (!to)
	{
		throw new Error(`"to" was not passed for redirect/rewrite`)
	}

	// If HTTP request URL doesn't match `from`, then no match
	if (!starts_with(ctx.url, from))
	{
		return
	}

	// HTTP request URL matches `from`

	// In case of exact path match
	if (exact)
	{
		// Check for an exact match
		if (ctx.url === from)
		{
			return to
		}

		// In case of no exact match, no match
		return
	}

	return to + ctx.url.substring(from.length)
}
