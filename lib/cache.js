// Simple in-memory TTL cache for server-side Mailchimp responses.
// Lives in the Node.js process — survives across requests, resets on redeploy.

const _store = new Map();

export function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    _store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  _store.set(key, { value, expires: Date.now() + ttlMs });
}
