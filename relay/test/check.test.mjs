import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { deadline, relayUrl, verifyAccess } from '../check/runner.mjs'

test('requires an explicit safe HTTPS origin without exposing invalid input', () => {
  assert.equal(relayUrl(' https://relay.example '), 'https://relay.example/')
  for (const value of ['', 'bad', 'http://relay.example', 'https://secret@relay.example',
    'https://relay.example/?token=secret', 'https://relay.example/path']) {
    assert.throws(() => relayUrl(value))
  }
})

test('CLI fails closed for missing URL or token before loading native dependencies', () => {
  for (const [url, token, status, expected] of [
    ['', '', 64, /Usage:/],
    ['https://relay.example', '', 2, /INCOMPLETE/],
    ['https://secret@relay.example', 'sensitive-test-value', 64, /HTTPS origin/],
    ['https://relay.example', 'sensitive-test-value', 64, /Invalid GYBLOS_RELAY_TOKEN/]
  ]) {
    const result = spawnSync(process.execPath, ['relay/check/check.mjs'], {
      env: { ...process.env, RELAY_URL: url, GYBLOS_RELAY_TOKEN: token }, encoding: 'utf8'
    })
    assert.equal(result.status, status)
    assert.match(result.stderr, expected)
    assert.doesNotMatch(result.stdout + result.stderr, /sensitive-test-value|secret@/)
  }
})

test('unreachable authenticated relay never produces negative PASS', async () => {
  const output = []
  let called = false
  await assert.rejects(verifyAccess({
    echo: async () => { throw new Error('unreachable') },
    offline: async () => { called = true; return true },
    report: x => output.push(x)
  }))
  assert.equal(called, false)
  assert.deepEqual(output, [])
})

test('accepted unauthorized endpoint fails', async () => {
  await assert.rejects(verifyAccess({
    echo: async () => {}, offline: async () => false,
    report: () => assert.fail('must not report PASS')
  }), /unauthorized/)
})

test('outage during negatives invalidates their results', async () => {
  let echoes = 0
  await assert.rejects(verifyAccess({
    echo: async () => { if (++echoes === 2) throw new Error('outage') },
    offline: async () => true, report: () => assert.fail('must not report PASS')
  }), /outage/)
})

test('full success requires both positive controls and both negative observations', async () => {
  const events = []
  const output = []
  await verifyAccess({
    echo: async () => { events.push('echo') },
    offline: async token => { events.push(token ? 'wrong' : 'none'); return true },
    report: x => output.push(x)
  })
  assert.deepEqual(events, ['echo', 'none', 'wrong', 'echo'])
  assert.equal(output.length, 3)
})

test('timeouts are bounded and preserve operation errors', async () => {
  await assert.rejects(deadline(new Promise(() => {}), 10, 'Echo'), /timed out/)
  await assert.rejects(deadline(Promise.reject(new Error('broken')), 50, 'Echo'), /broken/)
  assert.equal(await deadline(Promise.resolve('ok'), 50, 'Echo'), 'ok')
})
