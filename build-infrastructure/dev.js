const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');

function watchSources(root, changed, failed) {
  const watchers = [];
  function watch(directory, options, callback) {
    const watcher = fs.watch(directory, options, callback);
    watcher.on('error', failed);
    watchers.push(watcher);
  }
  const close = () => watchers.forEach(watcher => watcher.close());
  try {
    watch(path.join(root, 'src'), {recursive: true}, changed);
    watch(path.join(root, 'build-infrastructure'), {}, (_event, filename) => {
      if (!filename || filename.toString() === 'esbuild.js') changed();
    });
    watch(root, {}, (_event, filename) => {
      if (!filename || ['.env', 'tsconfig.json'].includes(filename.toString())) changed();
    });
  } catch (error) {
    close();
    throw error;
  }
  return close;
}

function buildProject(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'esbuild.js'), '--quiet'], {
      cwd: root, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Build exited with code ${code}`));
    });
  });
}

function createDevelopment({
  root = process.cwd(),
  build = () => buildProject(root),
  launch = () => spawn(require('electron'), ['.'], {cwd: root, stdio: 'inherit'}),
  watch = watchSources,
  log = console.log,
  debounceMs = 150,
} = {}) {
  let app;
  let timer;
  let building = false;
  let changedDuringBuild = false;
  let stopping = false;
  let activeBuild;
  let stopPromise;

  async function stopApp() {
    const child = app;
    app = undefined;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      child.once('exit', resolve);
      if (!child.kill()) {
        child.removeListener('exit', resolve);
        resolve();
      }
    });
  }

  function rebuild() {
    if (stopping) return Promise.resolve();
    if (building) {
      changedDuringBuild = true;
      return activeBuild;
    }
    building = true;
    activeBuild = (async () => {
      do {
        changedDuringBuild = false;
        log('[dev] Building...');
        try {
          await build();
          if (stopping || changedDuringBuild) continue;
          await stopApp();
          if (stopping || changedDuringBuild) continue;
          const child = launch();
          app = child;
          child.once('error', error => {
            log(`[dev] Electron failed to start: ${error.message}`);
            if (app === child) app = undefined;
          });
          child.once('exit', () => {
            if (app === child) void stop();
          });
          log('[dev] Ready. Source edits will rebuild and restart Electron.');
        } catch (error) {
          log(`[dev] Build failed; fix the error and save to retry: ${error.message}`);
        }
      } while (changedDuringBuild && !stopping);
      building = false;
    })();
    return activeBuild;
  }

  function changed() {
    if (stopping) return;
    if (building) {
      changedDuringBuild = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void rebuild(); }, debounceMs);
  }

  function stop() {
    if (stopPromise) return stopPromise;
    stopping = true;
    clearTimeout(timer);
    closeWatchers();
    stopPromise = (async () => {
      await activeBuild;
      await stopApp();
    })();
    return stopPromise;
  }

  const closeWatchers = watch(root, changed, error => {
    log(`[dev] Watcher failed: ${error.message}`);
    void stop();
  });
  return {ready: rebuild(), stop};
}

if (require.main === module) {
  const development = createDevelopment();
  const stop = () => { void development.stop(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

module.exports = {createDevelopment, watchSources, buildProject};
