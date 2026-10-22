// Checks a Gyblos Iroh relay end to end with real Iroh endpoints.
// - Without a token (and with a wrong one) the relay must refuse: no home relay.
// - With the token (env GYBLOS_RELAY_TOKEN, never printed) two relay-only
//   endpoints must meet through the relay and exchange an echo.
// Usage: node check.mjs            (refusal checks only)
//        GYBLOS_RELAY_TOKEN=... node check.mjs
import { Endpoint, EndpointAddr, RelayMap, RelayMode, SecretKey } from '@number0/iroh'

const RELAY_URL = process.env.RELAY_URL ?? 'https://na1.relay.gyblos.com'
const QUIC_PORT = 7842
const ALPN = [...Buffer.from('gyblos/relay-check/0')]
const ONLINE_MS = 15000
const TOKEN = process.env.GYBLOS_RELAY_TOKEN

const withTimeout = (promise, ms) =>
  Promise.race([promise.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))])

async function relayOnlyEndpoint (authToken) {
  const map = RelayMap.empty()
  map.insert({ url: RELAY_URL, quicPort: QUIC_PORT, ...(authToken ? { authToken } : {}) })
  const builder = Endpoint.builder()
  builder.applyMinimal()
  builder.secretKey(SecretKey.generate().toBytes())
  builder.alpns([ALPN])
  builder.bindAddr('127.0.0.1:0') // loopback only: no direct path, traffic must use the relay
  builder.relayMode(RelayMode.custom(map))
  return builder.bind()
}

async function refusal (label, token) {
  const ep = await relayOnlyEndpoint(token)
  const online = await withTimeout(ep.online(), 8000)
  await ep.close()
  console.log(`${online ? 'FAIL' : 'PASS'}  ${label}: ${online ? 'relay accepted the endpoint' : 'relay refused (no home relay)'}`)
  return !online
}

async function echoThroughRelay () {
  const server = await relayOnlyEndpoint(TOKEN)
  const client = await relayOnlyEndpoint(TOKEN)
  try {
    const t0 = performance.now()
    const ok = (await withTimeout(server.online(), ONLINE_MS)) && (await withTimeout(client.online(), ONLINE_MS))
    if (!ok) { console.log('FAIL  with token: endpoints did not get the relay as home relay'); return false }
    const onlineMs = Math.round(performance.now() - t0)
    const serving = (async () => {
      const incoming = await server.acceptNext()
      const conn = await (await incoming.accept()).connect()
      const bi = await conn.acceptBi()
      const msg = await bi.recv.readToEnd(1024)
      await bi.send.writeAll(msg)
      await bi.send.finish()
      await conn.closed().catch(() => {})
    })()
    const t1 = performance.now()
    const conn = await client.connect(new EndpointAddr(server.id(), RELAY_URL, []), ALPN)
    const bi = await conn.openBi()
    const payload = [...Buffer.from('gyblos relay echo')]
    await bi.send.writeAll(payload)
    await bi.send.finish()
    const back = await bi.recv.readToEnd(1024)
    const echoMs = Math.round(performance.now() - t1)
    const paths = conn.paths().map((p) => JSON.stringify(p)).join(' ')
    const same = Buffer.from(back).toString() === Buffer.from(payload).toString()
    conn.close(0n, [])
    await Promise.race([serving, new Promise((r) => setTimeout(r, 2000))])
    console.log(`${same ? 'PASS' : 'FAIL'}  with token: echo through relay (online ${onlineMs} ms, connect+echo ${echoMs} ms)`)
    console.log(`      paths: ${paths}`)
    return same
  } finally {
    await client.close()
    await server.close()
  }
}

let ok = await refusal('no token', undefined)
ok = (await refusal('wrong token', 'x'.repeat(48))) && ok
if (TOKEN) ok = (await echoThroughRelay()) && ok
else console.log('SKIP  with token: set GYBLOS_RELAY_TOKEN to run the echo test')
process.exit(ok ? 0 : 1)
