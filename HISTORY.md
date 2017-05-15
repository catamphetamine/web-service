0.5.0 / 12.05.2016
==================

Rewrote `authentication` logic – it now supports Auth0 style authentication: expiring "access tokens" and "refresh tokens" (with automatic token refresh feature).

Breaking changes:

  * `authentication` used to be a function. Now it's an object rather than a function.
  * `authentication : function(payload)` -> `authentication.userInfo : function(payload)`
  * Added `authentication.refreshAccessToken(ctx)` optional parameter for automatically refreshing expired tokens
  * Route handlers (including `api` route handlers) are no longer bound to `this`, use the new `ctx` parameter instead: `({ ... }, { ..., ctx }) => {}`
  * `jwt()` function parameters renamed: `user_id` -> `userId`, `jwt_id` -> `tokenId`. `expiresIn` parameter added. `keys` parameter changed to a single `key` (pass it like `key: keys[0]`)
  * `authentication_token_id` and `authentication_token` route handler parameters removed (use `accessTokenId` and `accessToken` instead)
  * `ctx.authenticate()` function removed (wasn't used at all). Renamed: `ctx.jwt_id` -> `ctx.accessTokenId`, `ctx.jwt` -> `ctx.accessToken`, `ctx.authentication_error` -> removed, `ctx.token_data` -> `ctx.accessTokenPayload`
  * `authentication.validate_token` option removed
  * `parse_body` option renamed to `parseBody`

0.4.3 / 13.12.2016
==================

  * Fix for `Date` parsing regular expression

0.4.1 / 05.11.2016
==================

  * Added HTTP error "429 Too Many Requests"

0.4.0 / 23.10.2016
==================

  * JWT is now only looked up in the HTTP Authorization header. JWT is no more looked up in the `authentication` cookie since it's prone to [Cross-Site Request Forgery attacks](http://docs.spring.io/spring-security/site/docs/current/reference/html/csrf.html).

0.3.0 / 11.09.2016
===================

  * (breaking change) file upload's `stream` function now takes an extra `fields` attribute (form fields)
  * (breaking change) removed `postprocess` option of file upload (use `process` instead)
  * (breaking change) file upload `respond` is now synchronous
  * now exporting a basic `generateUniqueFilename(path)` helper function

0.2.4 / 27.08.2016
===================

  * `routing` and `api` now don't wrap primitives into a JSON object when sending HTTP response

0.2.3 / 27.08.2016
===================

  * Fixed HTTP status `204` being sent instead of `200` for HEADs, GETs, POSTs and PATCHes.

0.2.2 / 25.08.2016
===================

  * Added `Date` parsing for `routing` (and `api`) parameters

0.2.0 / 16.08.2016
===================

  *  `http` utility now `reject`s the `Promise` with the `error` slightly different from what it was in `0.1.x`: it used to have `.code` property set to HTTP response status, but now that `.code` property is renamed to `.status` (I guess the new name better suits it)

0.1.25 / 07.08.2016
===================

  * Fixed a bug of `PUT and DELETE HTTP queries must not return any content` error being thrown when a Promise is returned from a route handler

0.1.24 / 31.07.2016
===================

  * Placed a restriction on `PUT` and `DELETE` HTTP queries to not return any content
  * Added `date_parser` to `http` utility

0.1.23 / 27.07.2016
===================

  * Fixed returning `Promise`s in routes resolving to strange objects of form `{ _c: [], _s: 0, _d: false, _h: 0, _n: false }`

0.1.22 / 23.07.2016
===================

  * Renamed `to_name` to just `name` for proxying

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