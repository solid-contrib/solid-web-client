'use strict'

const nock = require('nock')
const rdf = require('rdflib')
const { stub } = require('sinon')
const test = require('tape')

var SolidResource = require('../../src/models/resource')
var SolidContainer = require('../../src/models/container')
var SolidResponse = require('../../src/models/response')
var XMLHttpRequest = require('../../src/util/xhr')

var sampleContainerUrl = 'https://localhost:8443/settings/'
var rawContainerSource = require('../resources/solid-container-ttl')

function sampleResponse (responseData) {
  const method = 'GET'
  nock('http://localhost:8443/')
    .get('/settings/')
    .reply(200, responseData, { 'Content-Type': 'text/turtle' })

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, 'https://localhost:8443/settings/')
    xhr.onload = () => {
      nock.cleanAll()
      resolve(new SolidResponse(rdf, xhr, method))
    }
    xhr.send()
  })
}

test('SolidContainer empty container test', function (t) {
  sampleResponse('')
    .then(solidResponse => {
      const container = new SolidContainer(rdf, sampleContainerUrl, solidResponse)
      t.ok(container.isEmpty(), 'Empty container - isEmpty() true')
      t.ok(container.isContainer(), 'Container - isContainer() true')
      t.notOk(container.parsedGraph.statements.length, 'Empty container - null parsedGraph')
      t.deepEqual(container.contentsUris, [],
                  'Empty container - empty contents uri list')
      t.deepEqual(container.containers, {},
                  'Empty container - empty hash of sub-containers')
      t.deepEqual(container.resources, {},
                  'Empty container - empty hash of non-container resources')
      t.end()
    })
})

test('SolidContainer from parsed response test', function (t) {
  sampleResponse(rawContainerSource)
    .then(response => {
      let container = new SolidContainer(rdf, '/settings/', response)
      t.notOk(container.isEmpty(), 'Container with items - isEmpty() false')
      t.equal(container.response, response)
      // Check that the 'short name' is set
      t.equal(container.name, 'settings')

      // Test that the container's url is overridden to that of the response object
      // (absolute, not relative like in the constructor)
      t.equal(container.uri, 'https://localhost:8443/settings/')

      let expectedTypes = [
        'http://www.w3.org/ns/ldp#BasicContainer',
        'http://www.w3.org/ns/ldp#Container'
      ]
      t.deepEqual(container.types.sort(), expectedTypes)

      // There are 6 total items in the sample /settings/ container
      let expectedLinks = [
        'https://localhost:8443/settings/ajax-loader.gif',
        'https://localhost:8443/settings/index.html',
        'https://localhost:8443/settings/prefs.ttl',
        'https://localhost:8443/settings/privateTypeIndex.ttl',
        'https://localhost:8443/settings/publicTypeIndex.ttl',
        'https://localhost:8443/settings/testcontainer/'
      ]
      t.deepEqual(container.contentsUris, expectedLinks)

      // Of those, only one is a container
      let subContainers = container.containers
      t.equal(Object.keys(subContainers).length, 1)
      let testContainer =
            subContainers['https://localhost:8443/settings/testcontainer/']

      t.ok(testContainer instanceof SolidContainer)
      t.equal(testContainer.name, 'testcontainer')
      expectedTypes = [
        'http://www.w3.org/ns/ldp#BasicContainer',
        'http://www.w3.org/ns/ldp#Container',
        'http://www.w3.org/ns/ldp#Resource'
      ]
      t.deepEqual(testContainer.types.sort(), expectedTypes)

      // And the other 5 are resources
      t.equal(Object.keys(container.resources).length, 5)

      let testResource =
            container.resources['https://localhost:8443/settings/privateTypeIndex.ttl']
      t.ok(testContainer instanceof SolidResource)
      expectedTypes = [
        'http://www.w3.org/ns/ldp#Resource',
        'http://www.w3.org/ns/solid/terms#PrivateTypeIndex'
      ]
      t.deepEqual(testResource.types.sort(), expectedTypes)
      t.equal(testResource.name, 'privateTypeIndex.ttl')

      let findResults = container
        .findByType('http://www.w3.org/ns/solid/terms#PrivateTypeIndex')
      t.equal(findResults[0].name, 'privateTypeIndex.ttl')

      t.end()
    })
})
