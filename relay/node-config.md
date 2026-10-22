# Configuring Gyblos nodes and buyers to use our relays

Source of truth checked: `@number0/iroh` **1.1.0** `index.d.ts` and
`src/relay.rs` (napi binding over Rust `iroh`/`iroh-relay` 1.x), and
`gyblos-payments/packages/transport/src/endpoint.ts`,
`apps/cli/src/p2p/{seller,buyer}.ts`, `packages/application/src/offers.ts`.
No change was made to `gyblos-payments`; the snippets below are proposals for
whoever owns the transport package.

## Short answer: yes, the TS binding supports custom relays

`@number0/iroh` 1.1.0 exposes everything needed, including per-relay QUIC port
and auth token:

```ts
// index.d.ts (1.1.0)
class EndpointBuilder { applyN0(): void; relayMode(mode: RelayMode): void; ... }
class RelayMode {
  static disabled(): RelayMode
  static defaultMode(): RelayMode          // n0 production relays (dev-only for us)
  static staging(): RelayMode
  static custom(map: RelayMap): RelayMode
  static customFromUrls(urls: string[]): RelayMode
  relayMap(): RelayMap
}
class RelayMap { static empty(); static fromUrls(urls); insert(c: RelayConfig); remove(url); contains(url); urls(); ... }
interface RelayConfig { url: string; quicPort?: number; authToken?: string }
class Endpoint { online(): Promise<void>; insertRelay(c: RelayConfig); removeRelay(url);
                 watchHomeRelay(cb: (urls: string[]) => void); ... }
```

Details that matter:

- `RelayMap.fromUrls` / `RelayMode.customFromUrls` give each relay the default
  QUIC config (UDP 7842) but **no auth token**. Use `RelayMap.empty()` +
  `insert({ url, quicPort: 7842, authToken })` when the relays run in
  `shared_token` mode.
- `RelayMap.insert({ url })` **without `quicPort` disables QAD for that relay**
  (binding maps `undefined` to `quic: None`). Always pass `quicPort: 7842`.
- The token is sent as `Authorization: Bearer <token>` on the relay WebSocket
  upgrade.
- `applyN0()` must still be called first (crypto provider + n0 DNS/pkarr
  discovery); `relayMode(...)` afterwards replaces only the relay map.
  Address discovery therefore still depends on n0's DNS service; replacing it
  is a separate decision.
- iroh picks the **home relay by measured latency** among the map entries;
  there is no priority/weight field. "Prefer ours" therefore means "only ours
  in the map"; fallback means "add more entries later", not "lower priority".

## Proposed configuration surface (env)

| Variable | Default (prod) | Meaning |
| --- | --- | --- |
| `GYBLOS_RELAYS` | `https://sa1.relay.<domain>/,https://na1.relay.<domain>/` (compiled-in constant in `@gyblos/config`) | Our relay URLs |
| `GYBLOS_RELAY_TOKEN` | compiled-in current token | Bearer token for our relays |
| `GYBLOS_RELAY_FALLBACK` | `none` | `none` \| `n0` (append n0 relays if ours fail; dev/emergency) |
| `GYBLOS_RELAY_MODE` | `gyblos` | `gyblos` \| `n0` (current behavior, dev) \| `disabled` (LAN tests) |

## Proposed `bindEndpoint` change (packages/transport/src/endpoint.ts)

```ts
import { Endpoint, RelayMap, RelayMode, type RelayConfig } from '@number0/iroh';
import { RELAYS } from '@gyblos/config'; // { urls: string[]; token?: string; quicPort: 7842 }

const QUIC_PORT = 7842;

export function gyblosRelayConfigs(env = process.env): RelayConfig[] {
  const urls = (env.GYBLOS_RELAYS ?? RELAYS.urls.join(','))
    .split(',').map((u) => u.trim()).filter(Boolean);
  const authToken = env.GYBLOS_RELAY_TOKEN ?? RELAYS.token;
  return urls.map((u) => {
    const url = new URL(u);
    if (url.protocol !== 'https:' || url.search || url.hash || url.username)
      throw new Error('Invalid relay URL.');
    return { url: url.href, quicPort: QUIC_PORT, authToken };
  });
}

export function n0RelayConfigs(): RelayConfig[] {
  return RelayMode.defaultMode().relayMap().urls().map((url) => ({ url, quicPort: QUIC_PORT }));
}

export function relayModeFromEnv(env = process.env): RelayMode {
  switch (env.GYBLOS_RELAY_MODE ?? 'gyblos') {
    case 'n0': return RelayMode.defaultMode();
    case 'disabled': return RelayMode.disabled();
    case 'gyblos': {
      const map = RelayMap.empty();
      for (const c of gyblosRelayConfigs(env)) map.insert(c);
      return RelayMode.custom(map);
    }
    default: throw new Error('Invalid GYBLOS_RELAY_MODE.');
  }
}

// in bindEndpoint(), replace `builder.relayMode(RelayMode.defaultMode())` with:
builder.relayMode(relayModeFromEnv());
```

Fallback after bind (seller and buyer), before signing/dialing:

```ts
async function ensureOnline(endpoint: Endpoint, ms: number) {
  try {
    await withDeadline(endpoint.online(), ms, () => {});
  } catch (error) {
    if ((process.env.GYBLOS_RELAY_FALLBACK ?? 'none') !== 'n0') throw error;
    for (const c of n0RelayConfigs()) await endpoint.insertRelay(c);
    await withDeadline(endpoint.online(), ms, () => void endpoint.close());
  }
}
```

The two-relay, two-provider setup is itself the primary fallback: if `sa1` is
down, iroh's net report marks it unreachable and picks `na1` as home relay
automatically (no code). n0 fallback is opt-in because n0's public relays are
development-only and rate-limited.

## Required changes elsewhere (same PR as the above)

1. **`apps/cli/src/p2p/buyer.ts` rejects any offer whose `relayUrl` is not in
   `RelayMode.defaultMode().relayMap()`** (n0's map). It must check against
   the same map the buyer binds with (`relayModeFromEnv().relayMap()`, plus n0
   entries when fallback is on), or every offer from a seller homed on our
   relays is refused with "Unconfigured relay rejected."
2. `packages/application/src/offers.ts` already validates `https:` and no
   userinfo/query/hash. Keep it: a token must never appear in a relay URL
   (the relay also accepts `?token=`; never use that form).
3. Seller offers embed a single `relayUrl` (home relay at signing time). If the
   home relay changes mid-offer (`watchHomeRelay`), the offer is stale; re-sign
   on change, or have buyers try both of our relays.
4. Both sides must use the same relay set. With `shared_token`, a buyer whose
   map lacks our relays (or has the wrong token) cannot reach a seller homed on
   them. Mixed-version rollout: ship the new client with our relays first,
   relays in `open` mode, then switch relays to `shared_token`.
5. Relay URLs: compare normalized `new URL(u).href` (trailing slash), as the
   buyer already does.

## Verifying a node uses our relays

```ts
const ep = await bindEndpoint(secret);
await ep.online();
console.log(ep.addr().relayUrl());   // https://sa1.relay.<domain>/ or na1
ep.watchHomeRelay((urls) => console.log('home relay', urls));
```

And on the relay host: `unique_client_keys` / `accepts` increase in
`127.0.0.1:9090/metrics`.
