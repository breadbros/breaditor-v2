// Run: yarn test:map-viewport. Uses an isolated profile and retains captures.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
if (!process.versions.electron) {
  const output = fs.mkdtempSync(path.join(require('os').tmpdir(), 'breaditor-map-viewport-'));
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  for (const phase of ['write', 'read']) {
    const result = require('child_process').spawnSync(require('electron'), [__filename, phase, output, '--no-sandbox'], {env, stdio: 'inherit', windowsHide: true});
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log('Map position and zoom survived Reload Window and a process restart at a different window size. Retained:', output);
} else {
  const {app, BrowserWindow} = require('electron');
  const [phase, output] = process.argv.slice(2);
  const appRoot = path.resolve(__dirname, '../dist/app');
  const sourceUrl = require('url').pathToFileURL(path.join(appRoot, 'assets/sully/maps/json/farmsville.map.json')).href;
  const expectedPath = path.join(output, 'expected.json');
  app.setPath('userData', path.join(output, 'profile'));
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  let win;
  const timeout = setTimeout(() => {console.error('Viewport smoke timed out:', output); app.exit(1);}, 60000);
  const browser = (fn, ...args) => win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`, true);
  const settle = () => browser(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function ready() {
    await browser(async () => {
      const until = Date.now() + 20000;
      while (document.querySelector('[aria-label="Map A map editor"]')?.getAttribute('aria-busy') !== 'false') {
        if (Date.now() > until) throw new Error('Map renderer not ready');
        await new Promise(resolve => setTimeout(resolve, 40));
      }
    });
    await settle();
  }
  const camera = () => browser(url => JSON.parse(localStorage.getItem('breaditor.mapViewport.v1.' + url)), sourceUrl);
  const point = () => browser(() => {const r = document.querySelector('[aria-label="Map viewport"]').getBoundingClientRect(); return {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), left: r.x, top: r.y};});
  async function verify(expected) {
    assert.deepStrictEqual(await camera(), expected, 'Stored camera changed on restoration');
    const p = await point();
    win.webContents.sendInputEvent({type: 'mouseMove', x: p.x, y: p.y}); await settle();
    const status = await browser(() => document.querySelector('[data-testid="map-status"]').textContent);
    const world = [Math.floor((p.x - p.left) / expected.zoom + expected.x), Math.floor((p.y - p.top) / expected.zoom + expected.y)];
    assert(status.includes(`Pixel ${world[0]},${world[1]}`), `Displayed map position differs: ${status}`);
    assert(status.includes(`Zoom ${Math.round(expected.zoom * 100)}%`));
    assert(!status.includes('Unsaved changes'));
  }
  app.whenReady().then(async () => {
    const filename = path.resolve(__dirname, '../src/main/mapFileSaving.ts');
    const saving = new (require('module'))(filename, module); saving.paths = module.paths;
    saving._compile(require('esbuild').buildSync({entryPoints: [filename], bundle: true, platform: 'node', external: ['electron'], write: false}).outputFiles[0].text, filename);
    saving.exports.registerMapFileSaving();
    win = new BrowserWindow({show: false, width: phase === 'write' ? 1450 : 1250, height: phase === 'write' ? 1000 : 900,
      webPreferences: {contextIsolation: true, nodeIntegration: true, additionalArguments: ['--breaditor-development'],
        preload: path.join(appRoot, 'preload.js'), backgroundThrottling: false}});
    await win.loadFile(path.join(appRoot, 'index.html')); await ready();
    if (phase === 'write') {
      await browser(() => [...document.querySelectorAll('[aria-label="Map controls"] button')].find(el => el.textContent.trim() === '100%').click());
      await settle();
      const p = await point();
      win.webContents.sendInputEvent({type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: -100}); await settle();
      const before = await camera();
      win.webContents.sendInputEvent({type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1}); await settle();
      win.webContents.sendInputEvent({type: 'mouseMove', x: p.x + 73, y: p.y - 41}); await settle();
      win.webContents.sendInputEvent({type: 'mouseUp', x: p.x + 73, y: p.y - 41, button: 'left', clickCount: 1}); await settle();
      const expected = await camera();
      assert.strictEqual(expected.zoom, before.zoom);
      assert(Math.abs(expected.x - before.x) > 50 && Math.abs(expected.y - before.y) > 30, 'Native pan did not move the viewport');
      fs.writeFileSync(expectedPath, JSON.stringify(expected, null, 2));
      await verify(expected);
      await browser(() => [...document.querySelectorAll('[data-testid="breaditor-browser-menubar"] div')].find(el => el.textContent === 'Dev').dispatchEvent(new MouseEvent('mousedown', {bubbles: true})));
      const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      await browser(() => [...document.querySelectorAll('[data-testid="breaditor-menubar-contextmenu"] div')].find(el => el.textContent === 'Reload Window').click());
      await loaded; await ready(); await verify(expected);
    } else await verify(JSON.parse(fs.readFileSync(expectedPath)));
    await browser(() => new Promise(resolve => setTimeout(resolve, 250)));
    fs.writeFileSync(path.join(output, phase + '.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); win.destroy(); app.exit(0);
  }).catch(async error => {
    console.error(error, '\nRetained:', output);
    if (win && !win.isDestroyed()) fs.writeFileSync(path.join(output, phase + '-failure.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); app.exit(1);
  });
}
