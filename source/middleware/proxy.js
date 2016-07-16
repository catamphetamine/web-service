import http_proxy from 'http-proxy'
import mount      from 'koa-mount'
import { exists } from '../helpers'

export default function(from, to)
{
	if (!exists(to))
	{
		to = from
		from = undefined
	}

	const proxy = http_proxy.createProxyServer({})

	function proxy_middleware(to)
	{
		return async function(ctx)
		{
			const promise = new Promise((resolve, reject) =>
			{
				ctx.res.on('close', () =>
				{
					reject(new Error(`Http response closed while proxying ${ctx.url} to ${to}`))
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

					console.error('Proxying failed')
					reject(error)

					// response.writeHead(502)
					// response.end("There was an error proxying your request")
				})
			})

			await promise
		}
	}

	const result = { proxy }

	if (from)
	{
		result.middleware = mount(from, proxy_middleware(to))
	}
	else
	{
		result.middleware = proxy_middleware(to)
	}

	return result
}