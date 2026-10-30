const TIMEOUT_MS = 6000;
const HEADERS = { 'User-Agent': 'Viajero/1.0 (https://github.com/DaviMarqs/viajero) node-fetch', Accept: 'image/*' };

/**
 * Confere se a URL responde com uma imagem. A extracao do Firecrawl as vezes inventa URLs
 * (ex.: cdn.example.com); so imagens que existem chegam ao banco.
 */
export async function isReachableImage(url: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetchFn(url, { method, headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (method === 'GET') void response.body?.cancel().catch(() => undefined);
      if (response.ok) return (response.headers.get('content-type') ?? '').toLowerCase().startsWith('image/');
      // Alguns servidores recusam HEAD; tenta GET antes de desistir.
      if (method === 'HEAD' && [403, 405, 501].includes(response.status)) continue;
      return false;
    } catch {
      if (method === 'GET') return false;
    }
  }
  return false;
}

/** Devolve o subconjunto de URLs que sao imagens acessiveis (checagens em paralelo). */
export async function filterReachableImages(urls: string[], fetchFn: typeof fetch = fetch): Promise<Set<string>> {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = await Promise.all(unique.map(async (url) => ((await isReachableImage(url, fetchFn)) ? url : null)));
  return new Set(results.filter((url): url is string => url !== null));
}
