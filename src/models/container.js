'use strict'
/**
 * @module container
 */
var graphUtil = require('../util/graph-util')
var parseLinks = graphUtil.parseLinks
var vocab = require('solid-namespace')
var SolidResource = require('./resource')

/**
 * @class SolidContainer
 * @extends SolidResource
 * @constructor
 * @param rdf {RDF} RDF Library (such as rdflib.js) to inject
 * @param uri {string}
 * @param response {SolidResponse}
 */
class SolidContainer extends SolidResource {
  constructor (rdf, uri, response) {
    super(rdf, uri, response)
    /**
     * Hashmap of Containers within this container, keyed by absolute uri
     * @property containers
     * @type Object
     */
    this.containers = {}
    /**
     * List of URIs of all contents (containers and resources)
     * @property contentsUris
     * @type Array<string>
     */
    this.contentsUris = []
    /**
     * Hashmap of Contents that are just resources (not containers),
     * keyed by absolute uri
     * @property resources
     * @type Object
     */
    this.resources = {}

    /**
     * Hashmap of common RDF ontology namespaces
     * @type Object
     */
    this.vocab = vocab(rdf)

    if (this.parsedGraph) {
      this.appendFromGraph(this.parsedGraph, this.uri)
    }
  }

  /**
   * Extracts the contents (resources and sub-containers)
   * of the given graph and adds them to this container
   *
   * @method appendFromGraph
   * @param parsedGraph {Graph}
   * @param graphUri {string}
   */
  appendFromGraph (parsedGraph, graphUri) {
    // Set this container's types
    let ns = this.vocab
    let uriNode = this.rdf.namedNode(this.uri)
    this.types = Object.keys(parsedGraph.findTypeURIs(uriNode))

    // Extract all the contents links (resources and containers)
    let contentsUris = parseLinks(parsedGraph, null, ns.ldp('contains'))
    this.contentsUris = this.contentsUris.concat(contentsUris.sort())

    // Extract links that are just containers
    let containersLinks = parsedGraph.each(null, null, ns.ldp('Container'))

    let container
    containersLinks.forEach((containerLink) => {
      // Filter out . (the link to this directory)
      if (containerLink.uri !== this.uri) {
        container = new SolidContainer(this.rdf, containerLink.uri)
        container.types = Object.keys(parsedGraph.findTypeURIs(containerLink))
        this.containers[container.uri] = container
      }
    })

    // Now that containers are defined, all the rest are non-container resources
    let isResource, isContainer
    let resource, linkNode
    contentsUris.forEach((link) => {
      isContainer = link in this.containers
      isResource = link !== this.uri && !isContainer
      if (isResource) {
        resource = new SolidResource(this.rdf, link)
        linkNode = this.rdf.namedNode(link)
        resource.types = Object.keys(parsedGraph.findTypeURIs(linkNode))
        this.resources[link] = resource
      }
    })
  }

  /**
   * Returns a list of SolidResource or SolidContainer instances that match
   * a given type.
   * @method findByType
   * @param rdfClass {string}
   * @return {Array<SolidResource|SolidContainer>}
   */
  findByType (rdfClass) {
    let matches = []
    let key, container

    for (key in this.containers) {
      container = this.containers[key]
      if (container.isType(rdfClass)) {
        matches.push(container)
      }
    }

    let resource
    for (key in this.resources) {
      resource = this.resources[key]
      if (resource.isType(rdfClass)) {
        matches.push(resource)
      }
    }

    return matches
  }

  /**
   * Is this a Container instance (vs a regular resource).
   * @return {Boolean}
   */
  isContainer () {
    return true
  }

  /**
   * Returns true if there are no resources or containers inside this container.
   * @method isEmpty
   * @return {Boolean}
   */
  isEmpty () {
    return this.contentsUris.length === 0
  }
}

module.exports = SolidContainer
