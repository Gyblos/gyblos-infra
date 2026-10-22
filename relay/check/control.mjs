// Control: the same script setup goes online with n0's public relays, so a
// refusal from our relay is a real refusal and not a broken test.
import { Endpoint, RelayMode, SecretKey } from '@number0/iroh'
const b = Endpoint.builder(); b.applyMinimal(); b.secretKey(SecretKey.generate().toBytes())
b.alpns([[...Buffer.from('gyblos/relay-check/0')]]); b.bindAddr('127.0.0.1:0'); b.relayMode(RelayMode.defaultMode())
const ep = await b.bind()
const online = await Promise.race([ep.online().then(() => true), new Promise((r) => setTimeout(() => r(false), 15000))])
console.log(`${online ? 'PASS' : 'FAIL'}  control: endpoint went online with n0 relays (${ep.addr().relayUrl()})`)
await ep.close(); process.exit(online ? 0 : 1)
