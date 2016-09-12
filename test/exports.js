import chai from 'chai'
chai.should()

import webservice, { api, errors, http, acl, jwt, generate_unique_filename, generateUniqueFilename } from '../index.es6'

describe(`exports`, function()
{
	it(`should export ES6`, () =>
	{
		webservice.should.be.a('function')
		api.should.be.a('function')
		errors.should.be.an('object')
		http.should.be.an('object')
		http.post.should.be.a('function')
		acl.should.be.a('function')
		jwt.should.be.a('function')
		generate_unique_filename.should.be.a('function')
		generateUniqueFilename.should.be.a('function')
	})

	it(`should export ES5`, () =>
	{
		const _ = require('../index.common')

		_.should.be.a('function')
		_.api.should.be.a('function')
		_.errors.should.be.an('object')
		_.http.should.be.an('object')
		_.http.post.should.be.a('function')
		_.acl.should.be.a('function')
		_.jwt.should.be.a('function')
		_.generate_unique_filename.should.be.a('function')
		_.generateUniqueFilename.should.be.a('function')
	})
})