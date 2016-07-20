import http_proxy from 'http-proxy'
import mount      from 'koa-mount'
import { exists } from '../helpers'

export default function(path, to, options = {})
{
	if (!exists(to))
	{
		to = path
		path = undefined
	}

	const proxy = http_proxy.createProxyServer({})

	function proxy_middleware(to)
	{
		return async function(ctx)
		{
			const from_name = ctx.path // .substring(path.length)
			const to_name = options.to_name || to

			const promise = new Promise((resolve, reject) =>
			{
				ctx.res.on('close', () =>
				{
					reject(new Error(`Http response closed while proxying "${from_name}" to ${to_name}`))
				})

				ctx.res.on('finish', () =>
				{
					resolve()
				})

				// promisify(proxy.web, proxy) won't work here,
				// because the last parameter is not a "callback",
				// it's just an error handler.
				// https://github.com/nodejitsu/node-http-proxy/issues/951
				proxy.web(ctx.req, ctx.res, { target: to }, error =>
				{
					// usually errors with "Parse error" which is useless

					// error.proxy_error = true
					// error.proxy_to = to

					if (error.code === 'ECONNREFUSED')
					{
						error = new Error(`Couldn't proxy "${from_name}" to ${to_name}. No connection`)
					}

					// "Socket hang up" (probably it's caught here)
					if (error.code === 'ECONNRESET')
					{
						error = new Error(`Lost connection while proxying "${from_name}" to ${to_name}`)
					}

					console.error(`Proxy error`)
					reject(error)

					// response.writeHead(502)
					// response.end("There was an error proxying your request")
				})
			})

			await promise
		}
	}

	const result = { proxy }

	if (path)
	{
		result.middleware = mount(path, proxy_middleware(to))
	}
	else
	{
		result.middleware = proxy_middleware(to)
	}

	return result
}