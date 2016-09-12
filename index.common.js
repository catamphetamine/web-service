'use strict'

var web_service = require('./build/web service') // ['default']

exports = module.exports = web_service

exports.errors = require('./build/errors')
exports.api = require('./build/api')
exports.http = require('./build/http')
exports.acl = require('./build/acl')
exports.jwt = require('./build/middleware/authentication').issue_jwt_token
exports.generate_unique_filename = require('./build/middleware/file upload').generate_unique_filename
exports.generateUniqueFilename = exports.generate_unique_filename

exports['default'] = web_service