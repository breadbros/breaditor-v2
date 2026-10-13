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
    watch(path.join(root, 'src'), {recursive: true}, (_event, filename) => {
      changed(filename ? path.join('src', filename.toString()) : undefined);
    });
    watch(path.join(root, 'build-infrastructure'), {}, (_event, filename) => {
      if (!filename || filename.toString() === 'esbuild.js') changed('build-infrastructure/esbuild.js');
    });
    watch(root, {}, (_event, filename) => {
      if (!filename || ['.env', 'tsconfig.json'].includes(filename.toString())) changed(filename?.toString());
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
  launch = () => spawn(require('electron'), ['.'], {
    cwd: root, stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  }),
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
  let updateAvailable = false;
  let restartRequired = false;

  function notifyUpdate() {
    if (app?.connected) {
      app.send({type: 'dev-update', available: updateAvailable, restartRequired}, error => {
        if (error && !stopping) log(`[dev] Could not notify Electron: ${error.message}`);
      });
    }
  }

  function setUpdateAvailable(available) {
    updateAvailable = available;
    notifyUpdate();
  }

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

  function rebuild(reload = false) {
    if (stopping) return Promise.resolve();
    if (building) {
      changedDuringBuild = true;
      return activeBuild;
    }
    building = true;
    setUpdateAvailable(false);
    activeBuild = (async () => {
      let needsBuild = !reload;
      do {
        changedDuringBuild = false;
        try {
          if (needsBuild) {
            log('[dev] Building...');
            await build();
          }
          if (stopping || changedDuringBuild) continue;
          if (app && !reload) {
            setUpdateAvailable(true);
            log(`[dev] Changes available. Click ${restartRequired ? 'Restart app' : 'Reload'} in the app to apply them.`);
            continue;
          }
          await stopApp();
          if (stopping || changedDuringBuild) continue;
          const child = launch();
          app = child;
          restartRequired = false;
          child.once('error', error => {
            log(`[dev] Electron failed to start: ${error.message}`);
            if (app === child) app = undefined;
          });
          child.once('exit', () => {
            if (app === child) void stop();
          });
          child.on('message', message => {
            if (app !== child || stopping) return;
            if (message?.type === 'dev-update-check') notifyUpdate();
            if (message?.type === 'dev-reload' && updateAvailable && !building && !timer) {
              if (restartRequired) {
                void rebuild(true);
              } else if (child.connected) {
                setUpdateAvailable(false);
                child.send({type: 'dev-reload-renderer'}, error => {
                  if (error && !stopping && app === child) {
                    log(`[dev] Could not reload the renderer: ${error.message}`);
                  }
                });
              }
            }
          });
          log('[dev] Ready. Source edits will rebuild and offer a Reload action.');
        } catch (error) {
          log(`[dev] Build failed; fix the error and save to retry: ${error.message}`);
        } finally {
          needsBuild = true;
        }
      } while (changedDuringBuild && !stopping);
      building = false;
    })();
    return activeBuild;
  }

  function changed(filename) {
    if (stopping) return;
    const source = filename?.toString().replace(/\\/g, '/');
    if (!source || (!source.startsWith('src/app/') && !source.startsWith('src/main/preload/'))) {
      restartRequired = true;
    }
    setUpdateAvailable(false);
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
