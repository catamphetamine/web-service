import path from 'path'
import fs from 'fs-extra'

// https://github.com/cojs/busboy/issues/30
// https://github.com/brentburg/chan/pull/18
import busboy           from 'async-busboy'
import file_size_parser from 'filesize-parser'
import mount            from 'koa-mount'
import uid              from 'uid-safe'

import promisify from '../promisify'
import errors    from '../errors'

export default function(...parameters)
{
	let mount_path
	let upload_folder
	let options
	let log

	// New API
	if (typeof parameters[0] === 'string')
	{
		mount_path    = parameters[0]
		upload_folder = parameters[1]
		options       = parameters[2]
		log           = parameters[3]
	}
	// Old API
	else
	{
		options       = parameters[0]
		log           = parameters[1]
		mount_path    = options.path || options.mount_path || options.at || '/'
		upload_folder = options.to || options.upload_folder
	}

	const
	{
		requires_authentication = false,
		on_file_uploaded,
		process
	}
	= options

	const multiple_files  = options.multiple_files || options.multiple
	const file_size_limit = options.file_size_limit || options.limit
	const respond         = options.postprocess || options.respond

	return mount(mount_path, async function(ctx)
	{
		if (!ctx.is('multipart/form-data'))
		{
			throw new errors.Unsupported_input_type(`This is supposed to be a "multipart/form-data" http request`)
		}

		if (requires_authentication !== false && !ctx.user)
		{
			throw new errors.Unauthenticated()
		}

		const form_data = await busboy(ctx.req,
		{
			limits:
			{
				fileSize: file_size_limit ? file_size_parser(file_size_limit) : undefined
			}
		})

		// non-channel approach, since `chan` package currently doesn't support async/await
		const { files, fields } = form_data
		const parameters = fields

		const file_upload_promises = []

		// let form_data_item
		// while (form_data_item = yield form_data)
		for (let form_data_item of files)
		{
			if (!multiple_files && file_upload_promises.not_empty())
			{
				throw new Error(`Multiple files are being uploaded to a single file upload endpoint`)
			}

			// if (Array.isArray(form_data_item))
			// {
			// 	parameters[form_data_item[0]] = form_data_item[1]
			// 	continue
			// }

			file_upload_promises.push(upload_file(form_data_item, { upload_folder, log }).then(async file_name =>
			{
				const file_path = path.join(upload_folder, file_name)

				if (on_file_uploaded)
				{
					// `ctx.request.ip` trusts X-Forwarded-For HTTP Header
					on_file_uploaded
					({
						original_file_name : form_data_item.filename,
						uploaded_file_name : file_name,
						path               : file_path,
						ip                 : ctx.request.ip
					})
				}

				if (process)
				{
					// `ctx.request.ip` trusts X-Forwarded-For HTTP Header
					return await process
					({
						original_file_name : form_data_item.filename,
						uploaded_file_name : file_name,
						path               : file_path,
						ip                 : ctx.request.ip
					})
				}

				const result =
				{
					original_file_name: form_data_item.filename,
					uploaded_file_name: file_name
				}

				return result
			}))
		}

		const file_upload_results = await Promise.all(file_upload_promises)

		let result

		if (multiple_files)
		{
			result = { files: file_upload_results, parameters }
		}
		else
		{
			result = { file: file_upload_results[0], parameters }
		}

		if (respond)
		{
			result = await respond.call(this, result)
		}

		ctx.body = result
	})
}

// checks if filesystem path exists
function fs_exists(path)
{
	return new Promise((resolve, reject) => 
	{
		fs.exists(path, exists => resolve(exists))
	})
}

// generates a unique temporary file name
async function generate_unique_filename(folder, options)
{
	// 24 bytes
	let file_name = uid.sync(24)

	if (options.dot_extension)
	{
		file_name += options.dot_extension
	}

	const exists = await fs_exists(path.join(folder, file_name))

	if (!exists)
	{
		return file_name
	}

	if (options.log)
	{
		options.log.info(`Generate unique file name: collision for "${file_name}". Taking another try.`)
	}

	return await generate_unique_filename(folder, options)
}

// handles file upload
async function upload_file(file, { upload_folder, log })
{
	if (log)
	{
		log.debug(`Uploading: ${file.filename}`)
	}
		
	const file_name = await generate_unique_filename(upload_folder, { log }) // dot_extension: path.extname(file.filename), 
	const output_file = path.join(upload_folder, file_name)

	return await new Promise((resolve, reject) =>
	{
		fs.ensureDir(upload_folder, (error) =>
		{
			if (error)
			{
				return reject(error)
			}

			const stream = fs.createWriteStream(output_file)

			file.pipe(stream)
				.on('finish', () => resolve(path.relative(upload_folder, output_file)))
				.on('error', error => reject(error))
		})
	})
}