'use strict'
/**
 * Provides convenience methods for graph manipulation.
 * Currently depends on RDFLib
 * @module graph-util
 */
module.exports.appendGraph = appendGraph
module.exports.parseGraph = parseGraph
module.exports.parseLinks = parseLinks
module.exports.serializeStatements = serializeStatements
module.exports.graphFromStatements = graphFromStatements

var ALL_STATEMENTS = null

/**
 * Appends RDF statements from one graph object to another
 * @method appendGraph
 * @param toGraph {Graph} Graph object to append to
 * @param fromGraph {Graph} Graph object to append from
 * @param docURI {String} Document URI to use as source
 */
function appendGraph (toGraph, fromGraph, docURI) {
  fromGraph.statementsMatching(ALL_STATEMENTS)
    .forEach(function (st) {
      toGraph.add(st.subject, st.predicate, st.object, st.why)
    })
}

/**
 * Converts a list of RDF statements into a Graph, and returns
 * it.
 * @method graphFromStatements
 * @param rdf {RDF} RDF library such as rdflib.js
 * @param statements {Array<Statement>}
 * @return {Graph}
 */
function graphFromStatements (rdf, statements) {
  var graph = rdf.graph()
  statements.forEach(function (st) {
    graph.addStatement(st)
  })
  return graph
}

/**
 * Parses a given graph, from text rdfSource, as a given content type.
 * Returns parsed graph.
 * @method parseGraph
 * @param rdf {RDF} RDF library such as rdflib.js
 * @param baseUrl {String}
 * @param rdfSource {String} Text source code
 * @param contentType {String} Mime Type (determines which parser to use)
 * @return {rdf.Graph}
 */
function parseGraph (rdf, baseUrl, rdfSource, contentType) {
  var parsedGraph = rdf.graph()
  rdf.parse(rdfSource, parsedGraph, baseUrl, contentType)
  return parsedGraph
}

/**
 * Extracts the URIs from a parsed graph that match parameters.
 * The URIs are a set (duplicates are removed)
 * @method parseLinks
 * @param graph {Graph}
 * @param subject {NamedNode}
 * @param predicate {NamedNode}
 * @param object {NamedNode}
 * @param source {NamedNode}
 * @return {Array<String>} Array of link URIs that match the parameters
 */
function parseLinks (graph, subject, predicate, object, source) {
  var links = {}
  var matches = graph.statementsMatching(subject,
    predicate, object, source)
  matches.forEach(function (match) {
    links[match.object.uri] = true
  })
  return Object.keys(links)
}

/**
 * Serializes an array of RDF statements into a simple N-Triples format
 * suitable for writing to a solid server.
 * @method serializeStatements
 * @param statements {Array<Statement>} List of RDF statements
 * @return {String}
 */
function serializeStatements (statements) {
  var source = statements.map(function (st) { return st.toNT() })
  source = source.join('\n')
  return source
}
