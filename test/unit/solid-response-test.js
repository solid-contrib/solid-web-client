'use strict'

var test = require('tape')
var sinon = require('sinon')
var SolidResponse = require('../../src/models/response')

test('empty SolidResponse test', function (t) {
  let response = new SolidResponse()
  t.notOk(response.isContainer(), 'An empty response is not a Container')
  t.notOk(response.xhr, 'An empty response should have an empty .xhr property')
  // t.notOk(response.user, 'An empty response should not have the user set')
  // t.notOk(response.isLoggedIn(), 'User should not be logged in')
  t.notOk(response.exists(), 'Resource should not exist for empty header')
  t.end()
})

test('SolidResponse aclAbsoluteUrl() test', t => {
  let response = new SolidResponse()
  t.notOk(response.aclAbsoluteUrl(),
    'aclAbsoluteUrl() for an empty/new response should be null')

  response = new SolidResponse()
  response.url = 'https://example.com/resource1'
  response.acl = 'resource1.acl'
  t.equal(response.aclAbsoluteUrl(), 'https://example.com/resource1.acl')

  response = new SolidResponse()
  response.url = 'https://example.com/resource1'
  response.acl = 'https://example.com/resource1.acl'
  t.equal(response.aclAbsoluteUrl(), 'https://example.com/resource1.acl')

  response = new SolidResponse()
  response.url = 'https://example.com/'
  response.acl = '.acl'
  t.equal(response.aclAbsoluteUrl(), 'https://example.com/.acl')
  t.end()
})

test('SolidResponse metaAbsoluteUrl() test', t => {
  let response = new SolidResponse()
  t.notOk(response.metaAbsoluteUrl(),
    'metaAbsoluteUrl() for an empty/new response should be null')

  response = new SolidResponse()
  response.url = 'https://example.com/resource1'
  response.meta = 'resource1.meta'
  t.equal(response.metaAbsoluteUrl(), 'https://example.com/resource1.meta')

  response = new SolidResponse()
  response.url = 'https://example.com/resource1'
  response.meta = 'https://example.com/resource1.meta'
  t.equal(response.metaAbsoluteUrl(), 'https://example.com/resource1.meta')

  response = new SolidResponse()
  response.url = 'https://example.com/'
  response.meta = '.meta'
  t.equal(response.metaAbsoluteUrl(), 'https://example.com/.meta')
  t.end()
})

test('SolidResonse full IRI based on Location header', t => {
  let stub = sinon.stub()
  stub.withArgs('Link').returns(null)

  stub.withArgs('Location').returns('/bar')
  let xhr = { getResponseHeader: stub, responseURL: 'https://foo.example/' }
  let response = new SolidResponse(null, xhr, 'POST')
  t.equal(response.url, 'https://foo.example/bar')

  xhr.responseURL = 'https://foo.example/baz/'
  response = new SolidResponse(null, xhr, 'POST')
  t.equal(response.url, 'https://foo.example/bar')

  stub.withArgs('Location').returns('https://foo.example/dan')
  response = new SolidResponse(null, xhr, 'POST')
  t.equal(response.url, 'https://foo.example/dan')
  t.end()
})

test('SolidResonse ignore parameter in Content-Type header', t => {
  let stub = sinon.stub()
  stub.withArgs('Link').returns(null)
  let xhr = { getResponseHeader: stub }
  let response

  stub.withArgs('Content-Type').returns('text/turtle')
  response = new SolidResponse(null, xhr, 'POST')
  t.equal(response.contentType(), 'text/turtle')

  stub.withArgs('Content-Type').returns('text/turtle; charset=UTF-8')
  response = new SolidResponse(null, xhr, 'POST')
  t.equal(response.contentType(), 'text/turtle')

  t.end()
})
