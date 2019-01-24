const Batcher = require('../src/batcher')
const got = require('got')
const fixtures = require('./fixtures.json')
const sinon = require('sinon')

let batcher

describe('Batcher tests with JSON transport', function () {
  beforeEach(function () {
    batcher = new Batcher(fixtures.options_json)
    this.post = sinon.stub(got, 'post')
  })
  afterEach(function () {
    batcher.clearBatch()
    got.post.restore()
  })
  it('Should construct with default interval if one is not given', function () {
    const options = JSON.parse(JSON.stringify(fixtures.options_json))
    delete options.interval
    batcher = new Batcher(options)
    expect(batcher.interval).toBe(5000)
  })
  it('Should add same items as separate streams', function () {
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))
    expect(batcher.batch.streams.length).toBe(2)
  })
  it('Should add items with same labels as separate streams', function () {
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[1]))
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[2]))
    expect(batcher.batch.streams.length).toBe(2)
  })
  it('Should be able to clear the batch of streams', function () {
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[2]))
    expect(batcher.batch.streams.length).toBe(2)
    batcher.clearBatch()
    expect(batcher.batch.streams.length).toBe(0)
  })
  it('Should clear batch and resolve on successful send', async function () {
    const responseObject = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json'
      }
    }
    got.post.resolves(responseObject)
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))
    expect(batcher.batch.streams.length).toBe(1)
    await batcher.sendBatchToLoki()
    expect(batcher.batch.streams.length).toBe(0)
  })
  it('Should reject promise and not clear batch on unsuccessful send', async function () {
    const errorObject = {
      statusCode: 404
    }
    got.post.rejects(errorObject)
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))
    expect(batcher.batch.streams.length).toBe(1)
    try {
      await batcher.sendBatchToLoki()
    } catch (error) {
      expect(error.statusCode).toBe(404)
    }
    expect(batcher.batch.streams.length).toBe(1)
  })
  it('Should fail if the batch is not constructed correctly', async function () {
    const responseObject = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json'
      }
    }
    got.post.resolves(responseObject)
    batcher.pushLogEntry(fixtures.incorrectly_mapped)
    try {
      await batcher.sendBatchToLoki()
    } catch (error) {
      expect(error).toBeTruthy()
    }
  })
  it('Run loop should work correctly', async function () {
    const errorObject = {
      statusCode: 404
    }
    got.post.rejects(errorObject)

    const circuitBreakerInterval = fixtures.options_json.interval * 1000 * 1.01
    const waitFor = fixtures.options_json.interval * 1000 * 1.05

    batcher.circuitBreakerInterval = circuitBreakerInterval
    batcher.run()
    batcher.pushLogEntry(JSON.parse(fixtures.logs_mapped[0]))

    expect(batcher.batch.streams.length).toBe(1)
    expect(batcher.interval).toBe(fixtures.options_json.interval * 1000)

    await batcher.wait(waitFor)

    expect(batcher.batch.streams.length).toBe(1)
    expect(batcher.interval).toBe(circuitBreakerInterval)

    const responseObject = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json'
      }
    }
    got.post.resolves(responseObject)

    await batcher.wait(waitFor)

    expect(batcher.interval).toBe(fixtures.options_json.interval * 1000)
  })
})