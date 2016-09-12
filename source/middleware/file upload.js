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
		process,
		stream,
		respond
	}
	= options

	const multiple_files  = options.multiple_files || options.multiple
	const file_size_limit = options.file_size_limit || options.limit

	return mount(mount_path, async function(ctx)
	{
		// Only "multipart/form-data" HTTP POST requests are allowed
		if (!ctx.is('multipart/form-data'))
		{
			throw new errors.Unsupported_input_type(`This is supposed to be a "multipart/form-data" http request`)
		}

		// If authentication is required, and the user is not authenticated, then abort
		if (requires_authentication !== false && !ctx.user)
		{
			throw new errors.Unauthenticated()
		}

		// Initialize `busboy` streamer
		const form_data = await busboy(ctx.req,
		{
			limits:
			{
				fileSize: file_size_limit ? file_size_parser(file_size_limit) : undefined
			}
		})

		// This is a non-channel approach, since `chan` package
		// currently doesn't support `async/await`.
		//
		// The consequence is that files are written to disk twice.
		// First, `async-busboy` writes them to disk
		// and waits for that to finish.
		// Second, `upload_file` reads those file streams
		// and writes them to the `upload_folder`.
		//
		// This bug will be fixed once they release
		// a `co-busboy` alternative for Koa 2 (`async/await`).
		// In the meantime I'm using `async-busboy` just to get it working.
		//
		// See:
		// https://github.com/cojs/busboy/issues/30
		// https://github.com/brentburg/chan/pull/18
		//
		// `co-busboy` can be easily rewrote with async channels.
		//
		// Currently it just waits for all files to be written to disk,
		// and then get that `{ files, fields }` result object.
		//
		const { files, fields } = form_data
		const parameters = fields

		const file_upload_promises = []

		// `co-busboy` asynchronous approach (old code)
		// let form_data_item
		// while (form_data_item = yield form_data) { ... }

		// Synchronous approach (after all files have been uploaded)
		for (let file of files)
		{
			// Checks if multiple file upload is allowed
			if (!multiple_files && file_upload_promises.not_empty())
			{
				throw new Error(`Multiple files are being uploaded to a single file upload endpoint`)
			}

			// Old `co-busboy` code
			// if (Array.isArray(form_data_item))
			// {
			// 	parameters[form_data_item[0]] = form_data_item[1]
			// 	continue
			// }

			let file_upload_promise

			// Custom low-level uploaded stream handling logic
			if (stream)
			{
				// `file` is a `ReadableStream`.
				//
				// If the resolved value should be later sent back in HTTP response,
				// then `stream` must return a Promise,
				// and also `respond` parameter must not be `false`.
				// The third parameter of the `stream` function is ignored in this case.
				//
				// If the user of this library wants to stream HTTP response instead
				// then the `respond` parameter should be set to `false`
				// and the response data should be streamed to the third parameter
				// of the `stream` function (which is a regular Node.js `http.ServerResponse`)
				// 
				file_upload_promise = stream(file, parameters, ctx.res)
			}
			else
			{
				// Upload each file and `process` it (if needed)
				file_upload_promise = upload_file(file, { upload_folder, log }).then(async file_name =>
				{
					const file_path = path.join(upload_folder, file_name)

					// Fire `on_file_uploaded` listener
					if (on_file_uploaded)
					{
						// `ctx.request.ip` trusts X-Forwarded-For HTTP Header
						on_file_uploaded
						({
							original_file_name : file.filename,
							uploaded_file_name : file_name,
							path               : file_path,
							ip                 : ctx.request.ip
						},
						parameters)
					}

					// `process` the file (if needed), returning a result
					if (process)
					{
						// `ctx.request.ip` trusts X-Forwarded-For HTTP Header
						return await process
						({
							original_file_name : file.filename,
							uploaded_file_name : file_name,
							path               : file_path,
							ip                 : ctx.request.ip
						},
						parameters)
					}

					// Default result
					const result =
					{
						original_file_name: file.filename,
						uploaded_file_name: file_name
					}

					return result
				})
			}

			file_upload_promises.push(file_upload_promise)
		}

		// If the `respond` parameter was set to `false`
		// then it means that the user of the library
		// chose to stream HTTP response manually,
		// so write nothing to `ctx.body`
		if (respond === false)
		{
			return
		}

		// Wait for all files to be uploaded and `process`ed
		const file_upload_results = await Promise.all(file_upload_promises)

		// Default HTTP response

		let response

		if (process)
		{
			if (multiple_files)
			{
				response = file_upload_results
			}
			else
			{
				response = file_upload_results[0]
			}
		}
		else
		{
			if (multiple_files)
			{
				response = { files: file_upload_results, parameters }
			}
			else
			{
				response = { file: file_upload_results[0], parameters }
			}
		}

		// Optionally modify the HTTP response
		if (respond)
		{
			response = respond.call(this, response)
		}

		// HTTP response
		ctx.body = response
	})
}

// Checks if the filesystem `path` exists.
// Returns a Promise resolving to either `true` or `false`.
function fs_exists(path)
{
	return new Promise((resolve, reject) => 
	{
		fs.exists(path, exists => resolve(exists))
	})
}

// Generates a unique temporary file name inside the `folder` path.
// Returns a Promise resolving to the randomly generated filename.
export async function generate_unique_filename(folder, options)
{
	// 24 bytes for UUID filename
	let file_name = uid.sync(24)

	// Check if a file with such a name exists
	const exists = await fs_exists(path.join(folder, file_name))

	// If no such file exists yet,
	// then this filename is considered unique.
	if (!exists)
	{
		return file_name
	}

	// If a file with this name already exists, then retry

	if (options.on_collision)
	{
		options.on_collision(file_name)
	}

	return await generate_unique_filename(folder, options)
}

// Handles file upload.
// Takes a `file` busboy file object
// along with `upload_folder` option.
// Writes the `file` stream to `upload_folder`
// naming it with a randomly generated filename.
//
// Returns a Promise resolving to the randomly generated filename.
//
async function upload_file(file, { upload_folder, log })
{
	if (log)
	{
		log.debug(`Uploading: ${file.filename}`)
	}

	// Generate random unique filename
	const file_name = await generate_unique_filename(upload_folder,
	{
		on_collision: (file_name) =>
		{
			log.info(`Generate unique file name: collision for "${file_name}". Taking another try.`)
		}
	})

	// dot_extension: path.extname(file.filename)

	const output_file = path.join(upload_folder, file_name)

	// Write the file to disk
	return await new Promise((resolve, reject) =>
	{
		// Ensure the `upload_folder` exists
		// (just an extra precaution)
		fs.ensureDir(upload_folder, (error) =>
		{
			if (error)
			{
				return reject(error)
			}

			// Open output file stream
			const stream = fs.createWriteStream(output_file)

			// Pipe file contents to disk
			file.pipe(stream)
				.on('finish', () => resolve(path.relative(upload_folder, output_file)))
				.on('error', error => reject(error))
		})
	})
}