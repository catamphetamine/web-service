0.1.20 / 22.07.2016
===================

  * `detect_locale` now sets `ctx.locale` variable which can be read, for example, in route handlers as `this.locale`

0.1.20 / 22.07.2016
===================

  * Added `options` argument to `proxy` function. See [`http-proxy` options](https://github.com/nodejitsu/node-http-proxy#options).

0.1.19 / 21.07.2016
===================

  * Renamed `http` utility (which is passed inside `parameters` object of route handlers) to `internal_http`, emphasizing the fact that it should only be used to send HTTP requests to your own servers because it will also send JWT token header and therefore it would expose that sensitive information to a third party if used for external HTTP requests.

0.1.17 / 21.07.2016
===================

  * Added `stream(file, response)` parameter for `file_upload` which bypasses writing the uploaded files to disk. `stream` must either return a Promise (the resolved value will be later sent back in HTTP response) or stream response data directly to HTTP `response`. If `stream` is set, then `process` won't be called.

0.1.17 / 21.07.2016
===================

  * Added `process` parameter for `file_upload` which can process each file individually in parallel returning a result, while `postprocess` is applied at the end when all files are uploaded and `process`ed.

0.1.16 / 21.07.2016
===================

  * Parallelized file upload
  * A little breaking change of `on_file_uploaded` function parameters: now takes an object.

0.1.14 / 21.07.2016
===================

  * Added short-hand aliases for `file_upload` and `serve_static_files`. Refactored `file_upload` function call parameters.

0.1.12 / 20.07.2016
===================

  * Removed `development` option. Checking `NODE_ENV` now.

0.1.8 / 20.07.2016
===================

  * Fixed bugs found by @once-ler. Introduced `development` option.

0.1.0 / 15.07.2016
===================

  * Initial release