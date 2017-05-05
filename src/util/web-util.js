'use strict'
/**
 * Provides misc utility functions for the web client
 * @module web-util
 */
module.exports.absoluteUrl = absoluteUrl
module.exports.composePatchQuery = composePatchQuery
module.exports.hostname = hostname
module.exports.parseAllowedMethods = parseAllowedMethods
module.exports.parseLinkHeader = parseLinkHeader
module.exports.statementToNT = statementToNT

/**
 * Return an absolute URL
 * @method absoluteUrl
 *
 * @param baseUrl {string} URL to be used as base
 * @param pathUrl {string} Absolute or relative URL
 *
 * @return {string}
 */
function absoluteUrl (baseUrl, pathUrl) {
  if (pathUrl && pathUrl.slice(0, 4) !== 'http') {
    return [baseUrl, pathUrl].map((path) => {
      if (path[0] === '/') {
        path = path.slice(1)
      }
      if (path[path.length - 1] === '/') {
        path = path.slice(0, path.length - 1)
      }
      return path
    }).join('/')
  }

  return pathUrl
}

/**
 * Composes and returns a PATCH SPARQL query (for use with `web.patch()`)
 * @method composePatchQuery
 *
 * @param toDel {Array<string|Statement>} List of triples to delete
 * @param toIns {Array<string|Statement>} List of triples to insert
 *
 * @return {string} SPARQL query for use with PATCH
 */
function composePatchQuery (toDel, toIns) {
  let query = ''
  let excludeDot = true

  if (toDel && toDel.length > 0) {
    toDel = toDel.map(function (st) {
      return statementToNT(st, excludeDot)
    })
    query += 'DELETE DATA { ' + toDel.join(' . ') + ' . };\n'
  }

  if (toIns && toIns.length > 0) {
    toIns = toIns.map(function (st) {
      return statementToNT(st, excludeDot)
    })
    query += 'INSERT DATA { ' + toIns.join(' . ') + ' . };\n'
  }

  return query
}

function hostname (url) {
  let protocol, hostname, result, pathSegments
  let fragments = url.split('//')

  if (fragments.length === 2) {
    protocol = fragments[0]
    hostname = fragments[1]
  } else {
    hostname = url
  }

  pathSegments = hostname.split('/')
  if (protocol) {
    result = protocol + '//' + pathSegments[0]
  } else {
    result = pathSegments[0]
  }

  if (url.startsWith('//')) {
    result = '//' + result
  }

  return result
}

/**
 * Extracts the allowed HTTP methods from the 'Allow' and 'Accept-Patch'
 * headers, and returns a hashmap of verbs allowed by the server
 * @method parseAllowedMethods
 *
 * @param allowMethodsHeader {string} `Access-Control-Allow-Methods` response
 *   header
 * @param acceptPatchHeader {string} `Accept-Patch` response header
 *
 * @return {Object} Hashmap of verbs (in lowercase) allowed by the server for
 *   the current user. Example:
 *   ```
 *   {
 *     'get': true,
 *     'put': true
 *   }
 *   ```
 */
function parseAllowedMethods (allowMethodsHeader, acceptPatchHeader) {
  let allowedMethods = {}

  if (allowMethodsHeader) {
    let verbs = allowMethodsHeader.split(',')
    verbs.forEach((methodName) => {
      if (methodName && allowMethodsHeader.indexOf(methodName) >= 0) {
        allowedMethods[methodName.trim().toLowerCase()] = true
      }
    })
  }

  if (acceptPatchHeader &&
      acceptPatchHeader.indexOf('application/sparql-update') >= 0) {
    allowedMethods.patch = true
  }

  return allowedMethods
}

/**
* Parses a Link header from an XHR HTTP Request.
* @method parseLinkHeader
 *
* @param link {string} Contents of the Link response header
*
 * @return {Object}
*/
function parseLinkHeader (link) {
  if (!link) {
    return {}
  }

  let linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g
  let paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g
  let matches = link.match(linkexp)
  let rels = {}

  for (let i = 0; i < matches.length; i++) {
    let split = matches[i].split('>')
    let href = split[0].substring(1)
    let ps = split[1]
    let s = ps.match(paramexp)

    for (let j = 0; j < s.length; j++) {
      let p = s[j]
      let paramsplit = p.split('=')
      // var name = paramsplit[0]
      let rel = paramsplit[1].replace(/["']/g, '')

      if (!rels[rel]) {
        rels[rel] = []
      }

      rels[rel].push(href)

      if (rels[rel].length > 1) {
        rels[rel].sort()
      }
    }
  }

  return rels
}

/**
 * Converts a statement to string (if it isn't already), optionally slices off
 * the period at the end, and returns the statement.
 * @method statementToNT
 *
 * @param statement {string|Triple} RDF Statement to be converted.
 * @param [excludeDot=false] {Boolean} Optionally slice off ending period.
 *
 * @return {string}
 */
function statementToNT (statement, excludeDot) {
  if (typeof statement !== 'string') {
    // This is an RDF Statement. Convert to string
    statement = statement.toCanonical()
  }

  if (excludeDot && statement.endsWith('.')) {
    statement = statement.slice(0, -1)
  }

  return statement
}
