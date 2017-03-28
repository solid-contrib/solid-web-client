'use strict'
/**
 * @module resource
 */

const graphUtil = require('../util/graph-util')

/**
 * Represents a Solid / LDP Resource (currently used when listing
 * SolidContainer resources)
 * @class SolidResource
 */
class SolidResource {
  /**
   * @constructor
   * @param rdf {RDF}
   * @param uri {string}
   * @param response {SolidResponse}
   */
  constructor (rdf, uri, response) {
    /**
     * Short name (page/filename part of the resource path),
     * derived from the URI
     * @property name
     * @type string
     */
    this.name = null
    /**
     * Parsed graph of the contents of the resource
     * @property parsedGraph
     * @type Graph
     */
    this.parsedGraph = null
    /**
     * Optional SolidResponse object from which this resource was initialized
     * @property response
     * @type SolidResponse
     */
    this.response = response
    /**
     * List of RDF Types (classes) to which this resource belongs
     * @property types
     * @type Array<string>
     */
    this.types = []
    /**
     * Absolute url of the resource
     * @property url
     * @type string
     */
    this.uri = uri

    /**
     * RDF Library (such as rdflib.js) to inject (used for parsing contents)
     * @type RDF
     */
    this.rdf = rdf

    if (response) {
      if (response.url !== uri) {
        // Override the given url (which may be relative) with that of the
        // response object (which will be absolute)
        this.uri = response.url
      }
      this.initFromResponse(response)
    }
    this.initName()
  }

  /**
   * Initializes the short name from the url
   * @method initName
   */
  initName () {
    if (!this.uri) {
      return
    }

    // Split on '/', use the last fragment
    let fragments = this.uri.split('/')
    this.name = fragments.pop()

    if (!this.name && fragments.length > 0) {
      // URI ended in a '/'. Try again.
      this.name = fragments.pop()
    }
  }

  /**
   * @method initFromResponse
   * @param response {SolidResponse}
   */
  initFromResponse (response) {
    let contentType = response.contentType()
    if (!contentType) {
      throw new Error('Cannot parse container without a Content-Type: header')
    }

    let parsedGraph = graphUtil.parseGraph(this.rdf, this.uri, response.raw(),
      contentType)
    this.parsedGraph = parsedGraph

    this.types = Object.keys(parsedGraph.findTypeURIs(this.rdf.namedNode(this.uri)))
  }

  /**
   * Is this a Container instance (vs a regular resource).
   * (Is overridden in the subclass, `SolidContainer`)
   *
   * @return {Boolean}
   */
  isContainer () {
    return false
  }

  /**
   * Returns true if this a given type matches this resource's types
   * @method isType
   * @param rdfClass {string}
   * @return {Boolean}
   */
  isType (rdfClass) {
    return this.types.indexOf(rdfClass) !== -1
  }
}

module.exports = SolidResource
