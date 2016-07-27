'use strict'
/**
 * Provides a simple configuration object for Solid web client
 * @module config-default
 */
module.exports = {
  /**
   * Default proxy URL for servicing CORS requests
   */
  proxyUrl: 'https://databox.me/,proxy?uri={uri}',
  /**
   * Timeout for web/ajax operations, in milliseconds
   */
  timeout: 50000
}
