'use strict'
/**
 * Provides a Solid web client class for performing LDP CRUD operations.
 * @module web
 */
var DEFAULT_ACCEPT = 'text/turtle;q=0.8,*/*;q=0.5'
var DEFAULT_MIME_TYPE = 'text/turtle'
var defaultConfig = require('../config-default')

var composePatchQuery = require('./util/web-util').composePatchQuery
var SolidResponse = require('./models/response')
var XMLHttpRequest = require('./util/xhr')
var HttpError = require('standard-http-error')
var vocab = require('solid-namespace')

/**
 * Provides a collection of Solid/LDP web operations (CRUD)
 * @class SolidWebClient
 */
class SolidWebClient {
  /**
   * @constructor
   * @param rdf {RDF} RDF library (like rdflib.js or rdf-ext) for parsing
   * @param [config={}] {Object} Config hashmap
   * @param [config.auth] {ClientAuthOIDC} Solid OIDC auth client instance
   */
  constructor (rdf, config = {}) {
    this.rdf = rdf
    this.vocab = vocab(rdf)
    this.config = Object.assign({}, defaultConfig, config)
    this.auth = config.auth
  }

  /**
   * Creates a Solid container with the specified name.
   * Uses PUT instead of POST to guarantee the container name (and uses
   * conditional HTTP headers to fail with a `409 Conflict` error if
   * a container with that name already exists).
   *
   * @method createContainer
   * @param parentUrl {string} Parent directory/container in which to create
   * @param name {string} Container name (slug / URL fragment), no trailing
   *   slash needed.
   * @param [options] {Object} Options hashmap (optional, see `solidRequest()`)
   * @param [data] {string} Optional RDF data payload (additional triples
   *   that will be added to the container's metadata)
   *
   * @throws {HttpError} Throws an error if a resource or container with the
   *   same name already exists
   *
   * @return {Promise<SolidResponse>}
   */
  createContainer (parentUrl, name, options, data) {
    return this.post(parentUrl, data, name, true)
  }

  /**
   * Creates and returns the appropriate Solid wrapper for the XHR response.
   *
   * @method createResponse
   * @param xhrResponse {XMLHttpRequest} XHR Response
   * @param method {string} HTTP verb
   *
   * @return {SolidResponse} A SolidResponse
   */
  createResponse (xhrResponse, method) {
    return new SolidResponse(this.rdf, xhrResponse, method)
  }

  /**
   * Returns the current window's location (for use with `needsProxy()`)
   * if used in browser, or `null` if used from Node.
   *
   * @method currentUrl
   *
   * @return {string|null}
   */
  currentUrl () {
    if (typeof window !== 'undefined') {
      return window.location.href
    } else {
      return null
    }
  }

  /**
   * Deletes an existing resource or container.
   *
   * @method del
   * @param url {string} URL of the resource or container to be deleted
   *
   * @return {Promise<SolidResponse>} Result of the HTTP Delete operation
   *   (true on success, or an anonymous error object on failure)
   */
  del (url) {
    return this.solidRequest(url, 'DELETE')
  }

  /**
   * Retrieves a resource or container by making an HTTP GET call.
   *
   * @method get
   * @param url {string} URL of the resource or container to fetch
   * @param [options={}] {Object} Options hashmap (see `solidRequest()` docs)
   *
   * @return {Promise<SolidResponse>} Result of the HTTP
   *   GET operation, or an error object
   */
  get (url, options = {}) {
    options.headers = options.headers || {}

    // If no explicit Accept: header specified, set one
    if (!options.headers['Accept']) {
      options.headers['Accept'] = DEFAULT_ACCEPT
    }

    return this.solidRequest(url, 'GET', options)
  }

  /**
   * Checks to see if a Solid resource exists, and returns useful resource
   *   metadata info.
   *
   * @method head
   * @param url {string} URL of a resource or container
   * @param [options] Options hashmap (see `solidRequest()` docs)
   *
   * @return {Promise} Result of an HTTP HEAD operation (returns a meta object)
   */
  head (url, options) {
    return this.solidRequest(url, 'HEAD', options)
  }

  /**
   * Loads a list of given RDF graphs via an async `Promise.all()`,
   * which resolves to an array of uri/parsed-graph hashes.
   *
   * @method loadParsedGraphs
   * @param locations {Array<string>} Array of graph URLs to load
   * @param [options] Options hashmap (see `solidRequest()` docs)
   *
   * @return {Promise<Array<Object>>}
   */
  loadParsedGraphs (locations, options) {
    let loadPromises = locations.map((location) => {
      let responseUrl // may differ from location if redirected

      return this.get(location, options)
        .then(function (response) {
          responseUrl = response.url
          return response.parsedGraph()
        })
        .catch(function () {
          // Suppress the error, no need to reject, just return null graph
          return null
        })
        .then(function (parsedGraph) {
          return {
            uri: responseUrl,
            value: parsedGraph
          }
        })
    })

    return Promise.all(loadPromises)
  }

  /**
   * Determines whether the web client needs to fall back onto a Proxy url,
   * to avoid being blocked by CORS
   *
   * @method needsProxy
   * @param url {string}
   *
   * @return {Boolean}
   */
  needsProxy (url) {
    let currentUrl = this.currentUrl()
    let currentIsHttps = currentUrl && currentUrl.slice(0, 6) === 'https:'
    let targetIsHttp = url && url.slice(0, 5) === 'http:'

    return currentIsHttps && targetIsHttp
  }

  /**
   * Issues an HTTP OPTIONS request. Useful for discovering server capabilities
   * (`Accept-Patch:`, `Updates-Via:` for websockets, etc).
   * @method options
   * @param url {string} URL of a resource or container
   * @return {Promise<SolidResponse>} Result of an HTTP OPTIONS operation
   */
  options (url) {
    return this.solidRequest(url, 'OPTIONS')
  }

  /**
   * Partially edits an RDF-type resource by performing a PATCH operation.
   *   Accepts arrays of individual statements (in Turtle format) as params.
   *   For example:
   *   [ '<a> <b> <c> .', '<d> <e> <f> .']
   * @method patch
   * @param url {string} URL of the resource to be edited
   * @param toDel {Array<string>} Triples to remove from the resource
   * @param toIns {Array<string>} Triples to insert into the resource
   * @param [options] Options hashmap
   * @return {Promise<SolidResponse>} Result of PATCH operation
   */
  patch (url, toDel, toIns, options) {
    let data = composePatchQuery(toDel, toIns)
    let mimeType = 'application/sparql-update'
    options = options || {}
    options.headers = options.headers || {}
    options.headers['Content-Type'] = mimeType

    return this.solidRequest(url, 'PATCH', options, data)
  }

  /**
   * Creates a new resource by performing
   *   a Solid/LDP POST operation to a specified container.
   * @param url {string} URL of the container to post to
   * @param data {Object} Data/payload of the resource to be created
   * @param slug {string} Suggested URL fragment for the new resource
   * @param isContainer {Boolean} Is the object being created a Container
   *            or Resource?
   * @param mimeType {string} Content Type of the data/payload
   * @method post
   * @return {Promise<SolidResponse>} Result of XHR POST (returns parsed response
   *     meta object) or an anonymous error object with status code
   */
  post (url, data, slug, isContainer, mimeType = DEFAULT_MIME_TYPE) {
    let resourceType

    if (isContainer) {
      resourceType = this.vocab.ldp('BasicContainer')
      // Force the right mime type for containers only
      mimeType = 'text/turtle'
    } else {
      resourceType = this.vocab.ldp('Resource')
    }

    let options = {}
    options.headers = {}
    options.headers['Link'] = resourceType + '; rel="type"'
    options.headers['Content-Type'] = mimeType

    if (slug && slug.length > 0) {
      options.headers['Slug'] = slug
    }

    return this.solidRequest(url, 'POST', options, data)
  }

  /**
   * Turns a given URL into a proxied version, using a proxy template
   * @method proxyUrl
   * @param url {string} Intended URL
   * @param proxyUrlTemplate {string}
   * @return {string}
   */
  proxyUrl (url, proxyUrlTemplate) {
    proxyUrlTemplate = proxyUrlTemplate || this.config.proxyUrl
    return proxyUrlTemplate.replace('{uri}', encodeURIComponent(url))
  }

  /**
   * Updates an existing resource or creates a new resource by performing
   *   a Solid/LDP PUT operation to a specified container
   * @method put
   * @param url {string} URL of the resource to be updated/created
   * @param data {Object} Data/payload of the resource to be created or updated
   * @param [mimeType] {string} MIME Type of the resource to be created
   * @param [options={}] Options hashmap, see docs for `solidResponse()`
   * @return {Promise<SolidResponse>} Result of PUT operation (returns parsed
   *     response meta object if successful, rejects with an anonymous error
   *     status object if not successful)
   */
  put (url, data, mimeType, options = {}) {
    options.headers = options.headers || {}
    mimeType = mimeType || DEFAULT_MIME_TYPE
    options.headers['Content-Type'] = mimeType

    return this.solidRequest(url, 'PUT', options, data)
  }

  /**
   * Sends a generic XHR request with the appropriate Solid headers,
   * and returns a promise that resolves to a parsed response.
   * @method solidRequest
   * @param url {string} URL of the request
   * @param method {string} HTTP Verb ('GET', 'PUT', etc)
   * @param [options] Options hashmap
   * @param [options.noCredentials=false] {Boolean} Don't use `withCredentials`
   * @param [options.forceProxy=false] {Boolean} Enforce using proxy URL if true
   * @param [options.headers={}] {Object} HTTP headers to send along
   *          with request
   * @param [options.proxyUrl=config.proxyUrl] {string} Proxy URL to use for
   *          CORS Requests.
   * @param [options.timeout=config.timeout] {Number} Request timeout in
   *          milliseconds.
   * @param [data] {Object} Optional data / payload
   * @throws {HttpError} Rejects with `httpError.HttpError` of the appropriate
   *   type
   * @return {Promise<SolidResponse>}
   */
  solidRequest (url, method, options, data) {
    options = options || {}
    options.headers = options.headers || {}

    if (this.auth && this.auth.accessToken) {
      options.headers['Authorization'] = 'Bearer ' + this.auth.accessToken
    }

    options.proxyUrl = options.proxyUrl || this.config.proxyUrl
    options.timeout = options.timeout || this.config.timeout
    if (this.needsProxy(url) || options.forceProxy) {
      url = this.proxyUrl(url)
    }

    const client = this

    return new Promise((resolve, reject) => {
      let http = new XMLHttpRequest()

      http.open(method, url)
      if (!options.noCredentials) {
        http.withCredentials = true
      }

      for (var header in options.headers) {  // Add in optional headers
        http.setRequestHeader(header, options.headers[header])
      }

      if (options.timeout) {
        http.timeout = options.timeout
      }

      http.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(client.createResponse(this, method))
        } else {
          reject(new HttpError(this.status, this.statusText, { xhr: this }))
        }
      }

      http.onerror = function () {
        reject(new HttpError(this.status, this.statusText, { xhr: this }))
      }
      if (typeof data === 'undefined' || !data) {
        http.send()
      } else {
        http.send(data)
      }
    })
  }
}

/**
 * Returns a web client instance (convenience constructor method).
 * Usage:
 *
 *   ```
 *   var rdf = require('rdflib')  // or other compatible library
 *   var webClient = require('solid-web-client')(rdf)
 *   ```
 * @param rdf
 * @param config
 *
 * @return {SolidWebClient}
 */
function getClient (rdf, config) {
  return new SolidWebClient(rdf, config)
}

module.exports = getClient
module.exports.SolidWebClient = SolidWebClient
