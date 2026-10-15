import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

export type MonacoApi = typeof Monaco;

declare global {
  interface Window {
    breaditorMonaco?: MonacoApi;
  }
}

let pending: Promise<MonacoApi> | undefined;

export function loadMonaco(): Promise<MonacoApi> {
  if (pending) return pending;
  const base = new URL('monaco/', document.baseURI);
  // Classic bundled workers work under both Electron file: URLs and HTTP.
  globalThis.MonacoEnvironment = {
    getWorker: (_workerId, label) => {
      const name = label === 'json' ? 'json' :
        ['javascript', 'typescript'].includes(label) ? 'ts' :
        ['css', 'scss', 'less'].includes(label) ? 'css' :
        ['html', 'handlebars', 'razor'].includes(label) ? 'html' : 'editor';
      return new Worker(new URL(`${name}.worker.js`, base), {name: label});
    },
  };
  pending = new Promise<MonacoApi>((resolve, reject) => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('monaco.css', base).href;
    const script = document.createElement('script');
    script.src = new URL('monaco.js', base).href;
    let cssReady = false;
    let scriptReady = false;
    function ready() {
      if (cssReady && scriptReady) {
        if (window.breaditorMonaco) resolve(window.breaditorMonaco);
        else fail();
      }
    }
    function fail() {
      stylesheet.remove();
      script.remove();
      reject(new Error('Could not load the text editor.'));
    }
    stylesheet.onload = () => { cssReady = true; ready(); };
    script.onload = () => { scriptReady = true; ready(); };
    stylesheet.onerror = fail;
    script.onerror = fail;
    document.head.append(stylesheet, script);
  }).catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}
