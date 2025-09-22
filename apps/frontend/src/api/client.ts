const RAW_BASE = (import.meta.env.VITE_API_BASE ?? '').trim();

/**
 * Make a safe absolute URL.
 * - If RAW_BASE is empty: use current origin + path (works with Vite proxy).
 * - If RAW_BASE is http(s): join absolute base + path.
 * - If RAW_BASE starts with '/': join current origin + base + path.
 */
function makeUrl(path: string, params?: Record<string, string>) {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const p = path.startsWith('/') ? path : `/${path}`;

  if (!RAW_BASE) {
    return new URL(p + qs, window.location.origin).toString();
  }
  if (/^https?:\/\//i.test(RAW_BASE)) {
    const base = RAW_BASE.replace(/\/$/, '');
    return `${base}${p}${qs}`;
  }
  if (RAW_BASE.startsWith('/')) {
    const base = RAW_BASE.replace(/\/$/, '');
    return new URL(`${base}${p}${qs}`, window.location.origin).toString();
  }
  // fallback: treat as relative segment
  return new URL(`/${RAW_BASE}${p}${qs}`, window.location.origin).toString();
}

const DEFAULT_HEADERS: HeadersInit = {
  'x-api-key': import.meta.env.VITE_API_KEY as string,
};

export async function apiGet<T>(path: string, params?: Record<string, string>) {
  const url = makeUrl(path, params);
  const r = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown) {
  const url = makeUrl(path);
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
