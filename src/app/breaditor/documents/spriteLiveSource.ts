import type {SpriteDocument} from './SpriteDocument';
import {resolveSpriteUrl, spriteLoadRequest} from './spriteSource';

export interface SpriteSourceCache {definition?: {text: string; url: string}}

export function spriteLiveLoadRequest(sprite: SpriteDocument, base: string, signal: AbortSignal,
  cache: SpriteSourceCache, imageOnly: boolean, onImage: (url: string) => void) {
  const {url, options} = spriteLoadRequest(sprite, base, signal);
  if (!imageOnly) cache.definition = undefined;
  const fetchFile = options.fetch!;
  options.fetch = async (input, init) => {
    const isDefinition = String(input) === url;
    if (isDefinition && imageOnly && cache.definition) {
      const response = new Response(cache.definition.text);
      Object.defineProperty(response, 'url', {value: cache.definition.url});
      return response;
    }
    const response = await fetchFile(input, init);
    if (isDefinition && response.ok) {
      // A fetch Response (including its clones) remains tied to the old abort signal.
      const text = await response.clone().text();
      if (!signal.aborted) {
        cache.definition = {text, url: response.url};
      }
    }
    return response;
  };
  const resolveImage = options.resolveImage;
  options.resolveImage = (reference, definitionUrl) => {
    const imageUrl = String(resolveImage?.(reference, definitionUrl) ?? resolveSpriteUrl(reference, definitionUrl));
    // Begin watching even if the image is missing or temporarily undecodable.
    if (!signal.aborted) onImage(imageUrl);
    return imageUrl;
  };
  return {url, options};
}
