import web_service from '../source/web service'
import api_service from '../source/api'

describe(`web service`, function()
{
	it(`should start a web service`, mocha_async(async () =>
	{
		let web

		web = web_service
		({
			access_list: [],
			authentication: () => {},
			routing: true
		})
		
		web.get ('/test', async () => ({ works  : true }))
		web.post('/test', async () => ({ posted : true }))

		web = web_service
		({
			access_list: [],
			authentication: () => {},
			routing: '/api',
			parse_body: false
		})

		web.get ('/test', async () => ({ works  : true }))
		web.post('/test', async () => ({ posted : true }))

		web.serve_static_files('/assets', __dirname)

		web.file_upload
		({
			upload_folder: __dirname,
			on_file_uploaded: () => {}
		})

		web.proxy('/proxied', 'http://google.ru')

		web.redirect('/redirected', { to: 'http://google.ru' })
		web.rewrite('/rewritten', { to: '/rewrote' })

		// setTimeout(() => web.shut_down(), 1000)

		await web.listen(9876)
	}))

	it(`should start an api service`, mocha_async(async () =>
	{
		const api = api_service
		({
			access_list: [],
			authentication: () => {},
			routing: '/api',
			parse_body: true,
			api: [require('./api/method')]
		})

		await api.listen(9875)
	}))
})

function mocha_async(fn)
{
	return async function(done)
	{
		try
		{
			await fn()
			done()
		}
		catch (error)
		{
			done(error)
		}
	}
}