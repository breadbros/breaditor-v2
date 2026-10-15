const {watchFile, unwatchFile} = require('fs');
const {fileURLToPath} = require('url');

function watchMapFiles(urls, onChange) {
  const listeners = [];
  let stopped = false;
  let timer;
  let changes = new Set();
  for (const url of new Set(urls)) {
    const location = new URL(url);
    if (location.protocol !== 'file:') continue;
    const filename = fileURLToPath(location);
    const listener = (current, previous) => {
      if (stopped || ['mtimeMs', 'ctimeMs', 'size', 'ino', 'nlink'].every(key => current[key] === previous[key])) return;
      changes.add(url);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const changed = [...changes];
        changes = new Set();
        if (!stopped) onChange(changed);
      }, 150);
    };
    watchFile(filename, {persistent: false, interval: 250}, listener);
    listeners.push([filename, listener]);
  }
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    for (const [filename, listener] of listeners) unwatchFile(filename, listener);
    if (typeof window !== 'undefined') window.removeEventListener('unload', stop);
  };
  if (typeof window !== 'undefined') window.addEventListener('unload', stop, {once: true});
  return stop;
}
module.exports = {watchMapFiles};
