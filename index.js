const Transport = require('winston-transport')
const Batcher = require('./src/batcher')
const { MESSAGE } = require('triple-beam')

/**
 * A Winston transport for Grafana Loki.
 *
 * @class LokiTransport
 * @extends {Transport}
 */
class LokiTransport extends Transport {
  /**
   * Creates an instance of LokiTransport.
   * @param {*} options
   * @memberof LokiTransport
   */
  constructor (options) {
    super(options)

    // Pass all the given options to batcher
    this.batcher = new Batcher({
      host: options.host,
      pathname: options.pathname,
      basicAuth: options.basicAuth,
      headers: options.headers || {},
      interval: options.interval,
      json: options.json,
      batching: options.batching !== false,
      clearOnError: options.clearOnError,
      replaceOnError: options.replaceOnError,
      replaceTimestamp: options.replaceTimestamp,
      gracefulShutdown: options.gracefulShutdown !== false,
      timeout: options.timeout
    })

    this.useCustomFormat = options.format !== undefined
    this.labels = options.labels
    this.excludeDefaultLabels = options.excludeDefaultLabels
  }

  /**
   * An overwrite of winston-transport's log(),
   * which the Winston logging library uses
   * when pushing logs to a transport.
   *
   * @param {*} info
   * @param {*} callback
   * @memberof LokiTransport
   */
  log (info, callback) {
    // Immediately tell Winston that this transport has received the log.
    setImmediate(() => {
      this.emit('logged', info)
    })

    // Deconstruct the log
    const { label, labels, timestamp, level, message, ...rest } = info

    // build custom labels if provided
    let lokiLabels = this.excludeDefaultLabels ?  {} : { level: level }
    lokiLabels = Object.assign(lokiLabels, labels)

    if (this.labels) {
      lokiLabels = Object.assign(lokiLabels, this.labels)
    } else {
      lokiLabels['job'] = label
    }

    // follow the format provided
    const line = this.useCustomFormat ? info[MESSAGE] : `${message} ${
      rest && Object.keys(rest).length > 0 ? JSON.stringify(rest) : ''
    }`

    // Make sure all label values are strings
    lokiLabels = Object.fromEntries(Object.entries(lokiLabels).map(([key, value]) => [key, value ? value.toString() : value]))

    // Construct the log to fit Grafana Loki's accepted format
    const logEntry = {
      labels: lokiLabels,
      entries: [
        {
          ts: timestamp || Date.now().valueOf(),
          line
        }
      ]
    }

    // Pushes the log to the batcher
    this.batcher.pushLogEntry(logEntry).catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })

    // Trigger the optional callback
    callback()
  }

  /**
   * Send batch to loki when clean up
   */
  close () {
    this.batcher.close()
  }
}

module.exports = LokiTransport
