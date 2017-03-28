'use strict'
/**
 * @module response
 */

const graphUtil = require('../util/graph-util')  // Used by .parsedGraph()
const SolidContainer = require('./container')
const SolidResource = require('./resource')
const webUtil = require('../util/web-util')

/**
 * Provides a wrapper around an XHR response object, and adds several
 * Solid-specific parsed fields (link headers, allowed verbs, etc)
 * @class SolidResponse
 */
class SolidResponse {
  /**
   * @constructor
   * @param rdf {RDF} RDF Library such as rdflib.js
   * @param xhrResponse {XMLHttpRequest} Result of XHR operation
   * @param method {string} HTTP verb for the original request. Passed in
   *   separately because it's not actually stored in the XHR object.
   */
  constructor (rdf, xhrResponse, method) {
    if (!xhrResponse) {
      this.xhr = null
      this.user = ''
      this.method = null
      this.types = []
      this.graph = null
      return
    }
    /**
     * RDF Library such as rdflib.js. Used by parsedGraph()
     * @property rdf
     * @type RDF
     */
    this.rdf = rdf
    /**
     * Hashmap of parsed `Link:` headers. Example:
     *
     *   ```
     *   {
     *     acl: [ 'resourceName.acl' ],
     *     describedBy: [ 'resourceName.meta' ],
     *     type: [
     *       'http://www.w3.org/ns/ldp#RDFResource',
     *       'http://www.w3.org/ns/ldp#Resource'
     *     ]
     *   }
     *   ```
     * @property linkHeaders
     * @type Object
     */
    let linkHeader = xhrResponse.getResponseHeader('Link')
    this.linkHeaders = webUtil.parseLinkHeader(linkHeader) || {}

    if (method) {
      method = method.toLowerCase()
    } else {
      method = ''
    }
    /**
     * HTTP verb for the original request (GET, PUT, etc)
     * @property method
     * @type string
     */
    this.method = method

    /**
     * Name of the corresponding `.acl` resource
     * @property acl
     * @type string
     */
    this.acl = this.linkHeaders['acl']
    if (this.acl) {
      this.acl = this.acl[0]  // Extract the single .acl link
    }
    /**
     * Hashmap of HTTP methods/verbs allowed by the server.
     * (If a verb is not allowed, it's not included.)
     * Example:
     *   ```
     *   {
     *     'get': true,
     *     'put': true
     *   }
     *   ```
     * @property allowedMethods
     * @type Object
     */
    this.allowedMethods = this.parseAllowedMethods(xhrResponse, method)

    /**
     * Cache of the parsed graph of xhr.response,
     * lazy-initialized when you call `response.parsedGraph()`
     * @property graph
     * @type {IndexedFormula}
     */
    this.graph = null

    /**
     * Name of the corresponding `.meta` resource
     * @property meta
     * @type string
     */
    this.meta = this.linkHeaders['meta'] || this.linkHeaders['describedBy']
    if (this.meta) {
      this.meta = this.meta[0]  // Extract the single .meta link
    }
    /**
     * LDP Types for the resource.
     * Example: [
     *   'http://www.w3.org/ns/ldp#Resource',
     *   'http://www.w3.org/ns/ldp#RDFResource'
     * ]
     * @property types
     * @type Array<string>
     */
    this.types = this.typeLinkHeaders()
    /**
     * URL of the resource created or retrieved
     * @property url
     * @type string
     */
    this.url = xhrResponse.getResponseHeader('Location')
      ? webUtil.absoluteUrl(webUtil.hostname(xhrResponse.responseURL), xhrResponse.getResponseHeader('Location'))
      : xhrResponse.responseURL
    /**
     * WebID URL of the currently authenticated user (empty string if none)
     * @property user
     * @type string
     */
    this.user = xhrResponse.getResponseHeader('User') || ''
    /**
     * URL of the corresponding websocket instance, for this resource
     * Example: `wss://example.org/blog/hello-world`
     * @property websocket
     * @type string
     */
    this.websocket = xhrResponse.getResponseHeader('Updates-Via') || ''
    /**
     * Raw XHR response object
     * @property xhr
     * @type XMLHttpRequest
     */
    this.xhr = xhrResponse

    /**
     * The resource which was returned by the XHR, if any.
     */
    this.resource = null
    if (this.method === 'get') {
      this.resource = this.isContainer()
        ? new SolidContainer(this.rdf, this.url, this)
        : new SolidResource(this.rdf, this.url, this)
    }
  }

  /**
   * Returns the absolute URL of the ACL resource for this response.
   * @method aclAbsoluteUrl
   *
   * @return {string}
   */
  aclAbsoluteUrl () {
    if (!this.acl) {
      return null
    }

    return this.resolveMetaOrAclUrl('acl')
  }

  /**
   * Returns the Content-Type of the response (or null if no response
   * is present)
   * @method contentType
   *
   * @return {string|null}
   */
  contentType () {
    if (this.xhr) {
      return this.xhr.getResponseHeader('Content-Type').split(';')[0] // remove parameter
    } else {
      return null
    }
  }

  /**
   * Returns true if the resource exists (not a 404)
   * @method exists
   *
   * @return {Boolean}
   */
  exists () {
    return this.xhr && this.xhr.status >= 200 && this.xhr.status < 400
  }

  /**
   * Is this a Container instance (vs a regular resource)
   *
   * @return {Boolean}
   */
  isContainer () {
    return this.isType('http://www.w3.org/ns/ldp#Container') ||
      this.isType('http://www.w3.org/ns/ldp#BasicContainer')
  }

  /**
   * Returns true if the user is logged in with the server
   * @method isLoggedIn
   *
   * @return {Boolean}
   */
  isLoggedIn () {
    return this.user // && this.user.slice(0, 4) === 'http'
  }

  /**
   * Returns true if this a given type matches this resource's types
   * @method isType
   *
   * @param rdfClass {string}
   *
   * @return {Boolean}
   */
  isType (rdfClass) {
    return this.types.indexOf(rdfClass) !== -1
  }

  /**
   * Returns the absolute URL of the .meta resource for this response.
   * @method metaAbsoluteUrl
   *
   * @return {string}
   */
  metaAbsoluteUrl () {
    if (!this.meta) {
      return null
    }
    return this.resolveMetaOrAclUrl('meta')
  }

  /**
   * In case that this was preflight-type request (OPTIONS or POST, for example),
   * parses and returns the allowed methods for the resource (for the current
   * user).
   * @method parseAllowedMethods
   *
   * @param xhrResponse {XMLHttpRequest}
   * @param method {string} HTTP verb for the original request
   *
   * @return {Object} Hashmap of the allowed methods
   */
  parseAllowedMethods (xhrResponse, method) {
    if (method === 'get') {
      // Not a preflight request
      return {}
    } else {
      return webUtil.parseAllowedMethods(
        xhrResponse.getResponseHeader('Allow'),
        xhrResponse.getResponseHeader('Accept-Patch')
      )
    }
  }

  /**
   * Returns the parsed graph of the response (lazy-initializes it if it's not
   * present)
   * @method parsedGraph
   *
   * @return {Graph}
   */
  parsedGraph () {
    if (!this.graph) {
      this.graph = graphUtil.parseGraph(this.rdf, this.url, this.raw(),
        this.contentType())
    }

    return this.graph
  }

  /**
   * Returns the raw XHR response (or null if absent)
   * @method raw
   *
   * @return {Object|null}
   */
  raw () {
    if (this.xhr) {
      return this.xhr.response
    } else {
      return null
    }
  }

  /**
   * Returns the absolute url of a "related" resource (.acl or .meta)
   *
   * @param propertyName {string} Either 'acl' or 'meta'
   *
   * @return {string|null}
   */
  resolveMetaOrAclUrl (propertyName) {
    if (!this.url) {
      return null
    }

    let metaOrAclUrl = this[propertyName]
    // if url is https://example.com/resource, parent is https://example.com/
    let parentUrl = this.url.slice(0, this.url.lastIndexOf('/') + 1)

    return webUtil.absoluteUrl(parentUrl, metaOrAclUrl)
  }

  /**
   * Returns a unique (de-duplicated) list of `rel="type"` Link headers.
   *
   * @return {Array<string>}
   */
  typeLinkHeaders () {
    if (!Array.isArray(this.linkHeaders.type)) {
      return []
    }
    let types = new Set(this.linkHeaders.type || [])

    return Array.from(types)
  }
}

module.exports = SolidResponse
