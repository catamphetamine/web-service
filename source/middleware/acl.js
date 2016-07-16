import Access_list from '../acl'

export default function(access_list)
{
	// If an Access Control List is set,
	// then allow only IPs from the list of subnets.
	const ip_access_list = new Access_list(access_list)

	return async function(ctx, next)
	{
		// Check the entire `X-Forwarded-For` IP address chain
		// along with the HTTP request originator IP address.
		for (let ip_address of ctx.request.ips.concat(ctx.req.connection.remoteAddress))
		{
			if (!ip_access_list.test(ip_address))
			{
				throw new Error(`Access denied for ip ${ip_address}`)
			}
		}

		await next()
	}
}