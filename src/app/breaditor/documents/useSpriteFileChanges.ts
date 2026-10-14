import {useEffect, useState} from 'react';
import type {SpriteDocument} from './SpriteDocument';
import {resolveSpriteUrl} from './spriteSource';

export function useSpriteFileChanges(sprite: SpriteDocument, imageUrl?: string) {
  const [change, setChange] = useState({revision: 0, kind: 'json' as 'json' | 'image'});
  useEffect(() => {
    let json: string | undefined;
    try {
      if (sprite.crustacean_json === null) json = resolveSpriteUrl(sprite.filepath, document.baseURI);
    } catch {
      // The loader reports invalid source paths.
      return;
    }
    let active = true;
    const stop = window.electronAPI?.watchSpriteFiles?.({json, image: imageUrl}, kind => {
      if (active) setChange(previous => ({revision: previous.revision + 1, kind}));
    });
    return () => { active = false; stop?.(); };
  }, [sprite.filepath, sprite.crustacean_json, imageUrl]);
  return change;
}
