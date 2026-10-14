const {watchFile, unwatchFile} = require('fs');
const {fileURLToPath} = require('url');

// Poll paths so editor saves that replace a file do not detach its watch.
function watchSpriteFiles(sources, onChange) {
  const files = new Map();
  for (const kind of ['image', 'json']) {
    if (!sources[kind]) continue;
    const url = new URL(sources[kind]);
    if (url.protocol === 'file:') files.set(fileURLToPath(url), kind);
  }
  let timer;
  let pending;
  let stopped = false;
  const listeners = [];
  for (const [file, kind] of files) {
    const listener = (current, previous) => {
      if (stopped || (current.mtimeMs === previous.mtimeMs &&
        current.ctimeMs === previous.ctimeMs && current.size === previous.size &&
        current.ino === previous.ino && current.nlink === previous.nlink)) return;
      pending = pending === 'json' ? pending : kind;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const change = pending;
        pending = undefined;
        if (!stopped) onChange(change);
      }, 150);
    };
    watchFile(file, {persistent: false, interval: 250}, listener);
    listeners.push([file, listener]);
  }
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    for (const [file, listener] of listeners) unwatchFile(file, listener);
    if (typeof window !== 'undefined') window.removeEventListener('unload', stop);
  };
  if (typeof window !== 'undefined') window.addEventListener('unload', stop, {once: true});
  return stop;
}

module.exports = {watchSpriteFiles};
