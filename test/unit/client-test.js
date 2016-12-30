'use strict'

var test = require('tape')
var sinon = require('sinon')
var solid = require('../../src/client')

test('loadParsedGraphs uses proper URI when redirected', t => {
  let parsedGraph = sinon.stub().returns(null)
  let response = { parsedGraph: parsedGraph, url: 'https://bar.example' }
  let get = sinon.stub().returns(Promise.resolve(response))
  let client = new solid.SolidWebClient()
  client.get = get
  client.loadParsedGraphs(['https://foo.example/'])
    .then((graphs) => {
      t.equal(graphs[0].uri, 'https://bar.example')
      t.end()
    })
})
