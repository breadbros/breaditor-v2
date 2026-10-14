export function resolveSpriteUrl(reference: string, base: string): string {
  const normalized = reference.replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalized)) {
    const url = new URL('file:///');
    url.pathname = '/' + normalized;
    return url.href;
  }
  if (reference.startsWith('\\\\')) {
    const [host, ...segments] = normalized.slice(2).split('/');
    const url = new URL('file:///');
    url.hostname = host;
    url.pathname = '/' + segments.join('/');
    return url.href;
  }
  return new URL(normalized, base).href;
}
