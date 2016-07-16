// import koa_convert   from 'koa-convert'
//
// import session       from 'koa-generic-session'
// import redis_store   from 'koa-redis'
//
// // forked from the original repo as of 25.01.2016
// // https://github.com/halt-hammerzeit/generic-session
// import session       from './koa-generic-session'
// // forked from the original repo as of 25.01.2016
// // https://github.com/halt-hammerzeit/koa-redis
// import redis_store   from './koa-redis'
//
// npm install koa-convert copy-to@2 crc@3 debug@2 parseurl@1 --save

import uid from 'uid-safe'

import promisify from '../promisify'

export default function(redis_options)
{
	throw new Error(`Session support is currently turned off. Try using JSON Web Tokens to store session data instead.`)

	const ttl = 15 * 60 * 1000 // 15 minutes // session timeout, in seconds

	if (redis_options)
	{
		const redis_client = require('redis').createClient
		({
			host      : redis_options.redis.host,
			port      : redis_options.redis.port,
			auth_pass : redis_options.redis.password // auth_pass
		})

		const prefix = 'user:session:'

		function generate_id()
		{
			return uid.sync(24) // 24 is "byte length"; string length is 32 symbols
		}

		async function is_unique(id)
		{
			return !(await promisify(redis_client.exists, redis_client)(prefix + id))
		}

		async function generate_unique_id()
		{
			const id = generate_id()
			if (await is_unique(id))
			{
				return id
			}
			return generate_unique_id()
		}

		return koa_convert(session
		({
			key    : 'session:id',
			prefix,
			cookie :
			{
				maxAge : ttl
			},
			ttl, 
			genSid : generate_unique_id,
			store  : redis_store
			({
				client : redis_client
			})
		}))
	}
	else
	{
		return koa_convert(session
		({
			key: 'session:id',
			// ttl,
			cookie :
			{
				maxAge : ttl
			}
		}))
	}
}