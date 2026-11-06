import http from 'node:http'
import https from 'node:https'
import { pathToFileURL } from 'node:url'
import { relayUrl } from './runner.mjs'

export function request (url) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const req = transport.get(url, { agent: false }, res => {
      const cert = url.protocol === 'https:' ? res.socket.getPeerCertificate() : undefined
      res.resume()
      resolve({ status: res.statusCode, expires: cert?.valid_to })
    })
    // Absolute bound includes DNS, TLS and response headers.
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), 20000)
    req.on('close', () => clearTimeout(timer))
    req.on('error', reject)
  })
}

export async function checkPublicHealth ({ url, probeStatus, get = request }) {
  const origin = relayUrl(url)
  if (!['204', '404'].includes(String(probeStatus))) throw new Error('Explicit probe status 204 or 404 required')
  for (const route of ['healthz', 'ping']) {
    const response = await get(new URL(route, origin))
    if (response.status !== 200) throw new Error(route + ' must return 200')
    if (!(Date.parse(response.expires) > Date.now() + 7 * 86400000)) {
      throw new Error('TLS certificate must remain valid for at least seven days')
    }
  }
  const probe = new URL('/generate_204', origin)
  probe.protocol = 'http:'
  probe.port = '' // deployed probe uses host port 80
  const response = await get(probe)
  if (response.status !== Number(probeStatus)) throw new Error('Unexpected HTTP probe status')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkPublicHealth({ url: process.env.RELAY_URL, probeStatus: process.env.RELAY_PROBE_STATUS })
    console.log('PASS  public health, ping, expected HTTP probe and TLS validity (no authenticated E2E)')
  } catch {
    console.error('FAIL  public relay health (URL, connectivity, status or certificate)')
    process.exitCode = 1
  }
}
