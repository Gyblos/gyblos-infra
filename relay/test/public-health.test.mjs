import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPublicHealth } from '../check/public-health.mjs'

const fresh = new Date(Date.now() + 30 * 86400000).toUTCString()
function run (get, probeStatus = 404) {
  return checkPublicHealth({ url: 'https://relay.example', probeStatus, get })
}
test('public checks accept only the selected deployment probe status', async () => {
  for (const expected of [204, 404]) {
    const paths = []
    await run(async url => {
      paths.push(url.href)
      return { status: url.protocol === 'http:' ? expected : 200, expires: fresh }
    }, expected)
    assert.deepEqual(paths, ['https://relay.example/healthz', 'https://relay.example/ping', 'http://relay.example/generate_204'])
  }
  await assert.rejects(run(async () => ({ status: 200, expires: fresh })), /probe/)
  await assert.rejects(run(async () => ({ status: 404, expires: fresh })), /healthz/)
})
test('ping redirects, missing/expiring certificates and network errors fail', async () => {
  await assert.rejects(run(async url => ({
    status: url.pathname === '/ping' ? 302 : 200, expires: fresh
  })), /ping/)
  for (const expires of [undefined, 'invalid', new Date().toUTCString()]) {
    await assert.rejects(run(async () => ({ status: 200, expires })), /certificate/)
  }
  await assert.rejects(run(async () => { throw new Error('offline') }), /offline/)
  await assert.rejects(run(async () => assert.fail(), 'invalid'), /probe status/)
})
