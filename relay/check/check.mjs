// Usage: RELAY_URL=https://relay.example node check.mjs
// shared_token relays (default): load GYBLOS_RELAY_TOKEN through the environment, never a command argument.
// Open relays: RELAY_ACCESS_MODE=open checks that endpoints without a token relay.
import { deadline, relayUrl, verifyAccess, verifyOpen } from './runner.mjs'

let url
try { url = relayUrl(process.env.RELAY_URL) } catch (error) {
  console.error(error.message + '\nUsage: RELAY_URL=https://relay.example node check.mjs')
  process.exit(64)
}
const mode = process.env.RELAY_ACCESS_MODE || 'shared_token'
if (mode !== 'shared_token' && mode !== 'open') {
  console.error("RELAY_ACCESS_MODE must be 'shared_token' or 'open'")
  process.exit(64)
}
const open = mode === 'open'
const token = open ? undefined : process.env.GYBLOS_RELAY_TOKEN
if (!open && !token) {
  console.error('INCOMPLETE: set GYBLOS_RELAY_TOKEN through the environment for authenticated validation')
  process.exit(2)
}
if (!open && !/^[A-Za-z0-9_-]{32,}$/.test(token)) {
  console.error('Invalid GYBLOS_RELAY_TOKEN format')
  process.exit(64)
}
// Also bound native binding, connection and shutdown hangs for local callers.
const watchdog = setTimeout(() => {
  console.error('FAIL  relay check exceeded its overall deadline')
  process.exit(1)
}, 120000)

try {
  const { Endpoint, EndpointAddr, RelayMap, RelayMode, SecretKey } = await import('@number0/iroh')
  const alpn = [...Buffer.from('gyblos/relay-check/0')]
  const ms = 15000
  const endpoints = new Set()
  async function endpoint (authToken) {
    const map = RelayMap.empty()
    map.insert({ url, quicPort: 7842, ...(authToken ? { authToken } : {}) })
    const builder = Endpoint.builder()
    builder.applyMinimal()
    builder.secretKey(SecretKey.generate().toBytes())
    builder.alpns([alpn])
    builder.bindAddr('127.0.0.1:0') // no direct peer path
    builder.relayMode(RelayMode.custom(map))
    const ep = await deadline(builder.bind(), ms, 'Endpoint bind')
    endpoints.add(ep)
    return ep
  }
  async function close (ep) {
    await deadline(ep.close(), 2000, 'Endpoint close')
    endpoints.delete(ep)
  }
  async function offline (authToken) {
    const ep = await endpoint(authToken)
    try {
      // A rejected promise is an error, not a successful negative observation.
      return await deadline(ep.online().then(() => false), 8000, 'Negative observation')
    } catch (error) {
      if (error.message === 'Negative observation timed out') return true
      throw error
    } finally { await close(ep) }
  }
  async function online () {
    const ep = await endpoint(undefined)
    try {
      await deadline(ep.online(), ms, 'Tokenless online')
      return true
    } finally { await close(ep) }
  }
  async function echo () {
    const server = await endpoint(token)
    const client = await endpoint(token)
    try {
      await deadline(Promise.all([server.online(), client.online()]), ms, 'Authenticated online')
      const serving = (async () => {
        const incoming = await server.acceptNext()
        const conn = await (await incoming.accept()).connect()
        try {
          const bi = await conn.acceptBi()
          const data = await bi.recv.readToEnd(1024)
          await bi.send.writeAll(data)
          await bi.send.finish()
          await conn.closed()
        } finally { conn.close(0n, []) }
      })()
      // Observe server errors immediately; Promise.all below still propagates them.
      serving.catch(() => {})
      const exchange = (async () => {
        const conn = await client.connect(new EndpointAddr(server.id(), url, []), alpn)
        try {
          const bi = await conn.openBi()
          const payload = Buffer.from('gyblos relay echo')
          await bi.send.writeAll([...payload])
          await bi.send.finish()
          const back = await bi.recv.readToEnd(1024)
          if (!Buffer.from(back).equals(payload)) throw new Error('Echo payload mismatch')
        } finally { conn.close(0n, []) }
      })()
      await deadline(Promise.all([serving, exchange]), ms, 'Authenticated echo')
    } finally {
      await Promise.all([close(client), close(server)])
    }
  }
  try {
    const report = (message) => console.log(message)
    if (open) await verifyOpen({ echo, online, report })
    else {
      await verifyAccess({
        echo, offline, report,
        wrongToken: (token[0] === 'x' ? 'y' : 'x').repeat(48)
      })
    }
  } finally {
    await Promise.allSettled([...endpoints].map(close))
  }
} catch {
  // Native errors can include connection details. Never print credentials,
  // raw URLs, response bodies or upstream error messages.
  console.error('FAIL  relay validation failed (reachability, authentication, echo or cleanup)')
  process.exitCode = 1
} finally { clearTimeout(watchdog) }
// The native runtime may retain background handles after endpoints close.
process.exit(process.exitCode || 0)
