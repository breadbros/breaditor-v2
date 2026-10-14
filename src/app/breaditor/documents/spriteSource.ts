import type {LoadOptions} from 'crustacean-sprite-lib/load';
import type {SpriteDocument} from './SpriteDocument';

export function spriteLoadRequest(sprite: SpriteDocument, base: string, signal: AbortSignal) {
  const url = resolveSpriteUrl(sprite.filepath, base);
  const options: LoadOptions = {
    signal,
    fetch: (input, init) => fetch(input, {...init, cache: 'no-store'}),
  };
  if (sprite.crustacean_json !== null) {
    const json = typeof sprite.crustacean_json === 'string'
      ? sprite.crustacean_json : JSON.stringify(sprite.crustacean_json);
    const fetchFile = options.fetch!;
    options.fetch = (input, init) => String(input) === url
      ? Promise.resolve(new Response(json)) : fetchFile(input, init);
  }
  if (sprite.crustacean_image) {
    options.resolveImage = (_reference, definitionUrl) =>
      resolveSpriteUrl(sprite.crustacean_image, definitionUrl);
  }
  return {url, options};
}

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
