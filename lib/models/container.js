'use strict';
/**
 * @module container
 */

module.exports = SolidContainer;
var graphUtil = require('../util/graph-util');
var parseLinks = graphUtil.parseLinks;
var vocab = require('solid-namespace');
var SolidResource = require('./resource');

/**
 * @class SolidContainer
 * @extends SolidResource
 * @constructor
 * @param rdf {RDF} RDF Library (such as rdflib.js) to inject
 * @param uri {String}
 * @param response {SolidResponse}
 */
function SolidContainer(rdf, uri, response) {
  // Call parent constructor
  SolidResource.call(this, rdf, uri, response);
  /**
   * Hashmap of Containers within this container, keyed by absolute uri
   * @property containers
   * @type Object
   */
  this.containers = {};
  /**
   * List of URIs of all contents (containers and resources)
   * @property contentsUris
   * @type Array<String>
   */
  this.contentsUris = [];
  /**
   * Hashmap of Contents that are just resources (not containers),
   * keyed by absolute uri
   * @property resources
   * @type Object
   */
  this.resources = {};

  /**
   * Hashmap of common RDF ontology namespaces
   * @type Object
   */
  this.vocab = vocab(rdf);

  if (this.parsedGraph) {
    this.appendFromGraph(this.parsedGraph, this.uri);
  }
}
// SolidContainer.prototype object inherits from SolidResource.prototype
SolidContainer.prototype = Object.create(SolidResource.prototype);
SolidContainer.prototype.constructor = SolidContainer;

/**
 * Extracts the contents (resources and sub-containers)
 * of the given graph and adds them to this container
 * @method appendFromGraph
 * @param parsedGraph {Graph}
 * @param graphUri {String}
 */
SolidContainer.prototype.appendFromGraph = function appendFromGraph(parsedGraph, graphUri) {
  // Set this container's types
  var uriNode = this.rdf.namedNode(this.uri);
  this.types = Object.keys(parsedGraph.findTypeURIs(uriNode));

  // Extract all the contents links (resources and containers)
  var contentsUris = parseLinks(parsedGraph, null, this.vocab.ldp('contains'));
  this.contentsUris = this.contentsUris.concat(contentsUris.sort());

  // Extract links that are just containers
  var containersLinks = parsedGraph.each(null, null, this.vocab.ldp('Container'));
  var self = this;
  var container;
  containersLinks.forEach(function (containerLink) {
    // Filter out . (the link to this directory)
    if (containerLink.uri !== self.uri) {
      container = new SolidContainer(self.rdf, containerLink.uri);
      container.types = Object.keys(parsedGraph.findTypeURIs(containerLink));
      self.containers[container.uri] = container;
    }
  });
  // Now that containers are defined, all the rest are non-container resources
  var isResource, isContainer;
  var resource, linkNode;
  contentsUris.forEach(function (link) {
    isContainer = link in self.containers;
    isResource = link !== self.uri && !isContainer;
    if (isResource) {
      resource = new SolidResource(self.rdf, link);
      linkNode = self.rdf.namedNode(link);
      resource.types = Object.keys(parsedGraph.findTypeURIs(linkNode));
      self.resources[link] = resource;
    }
  });
};

/**
 * Returns a list of SolidResource or SolidContainer instances that match
 * a given type.
 * @method findByType
 * @param rdfClass {String}
 * @return {Array<SolidResource|SolidContainer>}
 */
SolidContainer.prototype.findByType = function findByType(rdfClass) {
  var matches = [];
  var key;
  var container;
  for (key in this.containers) {
    container = this.containers[key];
    if (container.isType(rdfClass)) {
      matches.push(container);
    }
  }
  var resource;
  for (key in this.resources) {
    resource = this.resources[key];
    if (resource.isType(rdfClass)) {
      matches.push(resource);
    }
  }
  return matches;
};

/**
 * Is this a Container instance (vs a regular resource).
 * @return {Boolean}
 */
SolidResource.prototype.isContainer = function isContainer() {
  return true;
};

/**
 * Returns true if there are no resources or containers inside this container.
 * @method isEmpty
 * @return {Boolean}
 */
SolidContainer.prototype.isEmpty = function isEmpty() {
  return this.contentsUris.length === 0;
};