'use strict'

var web_service = require('./commonjs/web service').default

exports = module.exports = web_service

exports.errors = require('./commonjs/errors').default
exports.api = require('./commonjs/api').default
exports.http = require('./commonjs/http').default
exports.acl = require('./commonjs/acl').default

exports.jwt = require('./commonjs/middleware/authentication').issue_jwt_token
exports.verify_jwt = require('./commonjs/middleware/authentication').verify_jwt_token
exports.verifyJwt = exports.verify_jwt

exports.generate_unique_filename = require('./commonjs/middleware/file upload').generate_unique_filename
exports.generateUniqueFilename = exports.generate_unique_filename

exports['default'] = web_service