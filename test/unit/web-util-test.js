'use strict'

var test = require('tape')
var webUtil = require('../../src/util/web-util')

test('web-util.composePatchQuery() test', function (t) {
  let toDelLinks = [
    'ex:subj ex:pred "one".',
    'ex:subj ex:pred "two".'
  ]
  let toAddLinks = [
    'ex:subj ex:pred "three".',
    'ex:subj ex:pred "four".'
  ]
  let expectedQuery = 'DELETE DATA { ex:subj ex:pred "one". ex:subj ex:pred "two". };\n' +
    'INSERT DATA { ex:subj ex:pred "three". ex:subj ex:pred "four". };\n'
  t.equal(
    webUtil.composePatchQuery(toDelLinks, toAddLinks),
    expectedQuery
  )
  t.end()
})

test('web-util.composePatchQuery() - single statement', function (t) {
  let toDelLinks = []
  let toAddLinks = ['ex:subj ex:pred "one".']
  let expectedQuery = 'INSERT DATA { ex:subj ex:pred "one". };\n'
  t.equal(
    webUtil.composePatchQuery(toDelLinks, toAddLinks),
    expectedQuery
  )
  t.end()
})

test('parse link header test', function (t) {
  t.plan(1)
  let linkStr = '<testResource.ttl.acl>; rel="acl", <testResource.ttl.meta>; rel="describedBy", <http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFResource>; rel="type"'
  let expectedParsedLinks = {
    acl: [ 'testResource.ttl.acl' ],
    describedBy: [ 'testResource.ttl.meta' ],
    type: [
      'http://www.w3.org/ns/ldp#RDFResource',
      'http://www.w3.org/ns/ldp#Resource'
    ]
  }
  let actualParsedLinks = webUtil.parseLinkHeader(linkStr)

  t.deepEqual(expectedParsedLinks, actualParsedLinks)
})

test('parseAllowedMethods() test with no headers', function (t) {
  t.plan(1)
  t.deepEqual(webUtil.parseAllowedMethods(), {},
    'Empty parseAllowedMethods() should result in an empty object')
})

test('parseAllowedMethods() test', function (t) {
  t.plan(1)
  let allowMethodsHeader = 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
  let acceptPatchHeader = 'application/sparql-update'
  let expectedAllowedMethods = {
    'delete': true,
    'get': true,
    'head': true,
    'options': true,
    'patch': true,
    'post': true,
    'put': true
  }
  let allowedMethods = webUtil.parseAllowedMethods(allowMethodsHeader,
    acceptPatchHeader)
  t.deepEqual(allowedMethods, expectedAllowedMethods)
})

test('parseAllowedMethods() does not support json-patch', function (t) {
  t.plan(1)
  let allowMethodsHeader = null
  let acceptPatchHeader = 'application/json'
  let expectedAllowedMethods = {}
  let allowedMethods = webUtil.parseAllowedMethods(allowMethodsHeader,
    acceptPatchHeader)
  t.deepEqual(allowedMethods, expectedAllowedMethods, 'JSON-Patch method is not supported')
})

test('hostname() test', function (t) {
  var hostname = webUtil.hostname
  t.equal(hostname('https://example.com'), 'https://example.com')
  t.equal(hostname('https://example.com/'), 'https://example.com')
  t.equal(hostname('//example.com/'), '//example.com')
  t.equal(hostname('//example.com'), '//example.com')
  t.equal(hostname('example.com'), 'example.com')
  t.equal(hostname('https://username:password@www.example.com/'),
    'https://username:password@www.example.com')
  t.equal(hostname('https://example.com/dir1/'), 'https://example.com')
  t.equal(hostname('https://example.com/dir1/dir2/#me?k=v'), 'https://example.com')
  t.end()
})
