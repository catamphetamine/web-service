import { match }       from './redirect'
import { starts_with } from '../helpers'

// Koa URL rewrite
export default function rewrite(from, options = {})
{
	return async function(ctx, next)
	{
		let destination = match(ctx, from, options)

		// If there was a match, then rewrite URL
		if (destination)
		{
			// Validate destination path
			if (!starts_with(destination, '/'))
			{
				throw new Error(`The rewritten URL must start with a slash`)
			}

			ctx.url = destination
		}

		// Proceed
		next()
	}
}
