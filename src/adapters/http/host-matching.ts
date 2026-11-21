/**
 * Host match: exact `host:port`, a bare hostname on any port, or a leading-dot entry for
 * the domain and its subdomains (`.example.test` never matches `badexample.test`).
 */
export function matchesHost(host: string | undefined, allowed: ReadonlySet<string>): boolean {
  if (!host || /[\s,/@\\?#%]/.test(host)) return false;
  let url: URL;
  try {
    url = new URL(`http://${host}`);
  } catch {
    return false;
  }
  const authority = host.toLowerCase();
  for (const entry of allowed) {
    if (entry.startsWith('.')) {
      if (url.hostname === entry.slice(1) || url.hostname.endsWith(entry)) return true;
    } else if (authority === entry || (!entry.includes(':') && url.hostname === entry)) {
      return true;
    }
  }
  return false;
}
