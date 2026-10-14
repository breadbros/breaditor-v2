import React, {useEffect, useState} from 'react';
import {loadSpriteDefinition, LoadedDefinition} from 'crustacean-sprite-lib/load';
import type {SpriteDocument} from '../documents/SpriteDocument';
import {spriteLoadRequest} from '../documents/spriteSource';

// @ts-ignore
import css from './SpriteInfoPanel.module.css';

export function SpriteInfoPanel({document: sprite}: {document: SpriteDocument}) {
  const [loaded, setLoaded] = useState<LoadedDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoaded(null);
    setError(null);
    setFolderError(null);
    async function load() {
      try {
        const {url, options} = spriteLoadRequest(sprite, document.baseURI, abort.signal);
        const loaded = await loadSpriteDefinition(url, options);
        if (!abort.signal.aborted) setLoaded(loaded);
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    void load();
    return () => abort.abort();
  }, [sprite.filepath, sprite.crustacean_json, sprite.crustacean_image]);

  async function openImageFolder() {
    if (!loaded || !window.electronAPI?.showImageInFolder) return;
    setFolderError(null);
    try {
      await window.electronAPI.showImageInFolder(loaded.imageUrl);
    } catch (cause) {
      setFolderError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const entries = loaded ? Object.entries(loaded.definition).flatMap(([key, value]) =>
    key === 'animations'
      ? Object.entries(loaded.definition.animations).map(([name, animation]) => [`animations.${name}`, animation] as const)
      : [[key, value] as const],
  ) : [];

  return (
    <section id="PanelInfo" className={css.panel} aria-label={`${sprite.info.title} sprite info`}>
      {error ? <p role="alert">Could not load sprite info: {error}</p> : !loaded ?
        <p role="status">Loading sprite info…</p> :
        <table className={css.properties}>
          <thead><tr><th scope="col">Key</th><th scope="col">Value</th></tr></thead>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>
                  <div className={key === 'image' ? css.imageValue : undefined}>
                    <pre>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
                    {key === 'image' && <button
                      type="button"
                      onClick={openImageFolder}
                      disabled={!loaded.imageUrl.startsWith('file:') || !window.electronAPI?.showImageInFolder}
                      title={loaded.imageUrl.startsWith('file:') ? 'Open containing folder and select the image' : 'Only local images have a containing folder'}
                    >Open folder</button>}
                  </div>
                  {key === 'image' && folderError && <p role="alert">Could not open image folder: {folderError}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
    </section>
  );
}
