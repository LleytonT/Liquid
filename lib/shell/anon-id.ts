const KEY = "liquid-anon-id"

/** Anonymous browser id. Sign-in can replace the server's OwnerSource without changing this key's readers. */
export function anonId(): string {
  const existing = window.localStorage.getItem(KEY)
  if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing
  const next = `anon_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
  window.localStorage.setItem(KEY, next)
  return next
}
