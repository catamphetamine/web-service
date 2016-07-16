'use strict'

var web_service = require('./build/web service') // ['default']

exports = module.exports = web_service

exports.errors = require('./build/errors')
exports.api = require('./build/api')
exports.http = require('./build/http')
exports.acl = require('./build/acl')

exports['default'] = web_service
