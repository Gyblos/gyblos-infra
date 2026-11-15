// Behavioral access-gate check. An offline endpoint alone is never evidence
// of rejection: authenticated echo must succeed before and after the negatives.
export function relayUrl (value) {
  if (!value?.trim()) throw new Error('RELAY_URL is required')
  let url
  try { url = new URL(value.trim()) } catch { throw new Error('Invalid RELAY_URL') }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') {
    throw new Error('RELAY_URL must be an HTTPS origin without credentials, query or fragment')
  }
  return url.href
}

export async function deadline (promise, ms, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out')), ms)
      })
    ])
  } finally { clearTimeout(timer) }
}

export async function verifyAccess ({ echo, offline, report, wrongToken = 'x'.repeat(48) }) {
  await echo()
  // Do not publish negative PASS results until the post-check echo succeeds.
  for (const token of [undefined, wrongToken]) {
    if (!await offline(token)) throw new Error('Relay accepted an unauthorized endpoint')
  }
  await echo()
  report('PASS  authenticated echo before and after access checks')
  report('PASS  no token: endpoint stayed offline')
  report('PASS  wrong token: endpoint stayed offline')
}

// Open access (RELAY_ACCESS_MODE=open): an endpoint without any token must relay. Echo runs without a
// token before and after a second tokenless endpoint comes online, so an outage never reads as success.
export async function verifyOpen ({ echo, online, report }) {
  await echo()
  if (!await online()) throw new Error('Relay refused a tokenless endpoint in open mode')
  await echo()
  report('PASS  open access: tokenless echo before and after the access check')
  report('PASS  no token: endpoint came online')
}
