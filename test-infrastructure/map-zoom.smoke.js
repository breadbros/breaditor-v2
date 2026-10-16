// Run: yarn test:map-zoom. Profiles, saved copies and screenshots are retained.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

if (!process.versions.electron) {
  const output = fs.mkdtempSync(path.join(require('os').tmpdir(), 'breaditor-map-zoom-'));
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  for (const phase of ['write', 'read']) {
    const result = require('child_process').spawnSync(require('electron'), [__filename, phase, output, '--no-sandbox'], {env, stdio: 'inherit', windowsHide: true});
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log('Independent map zoom, wheel/Fit/100%, Save As, refresh and process restart passed. Retained:', output);
} else {
  const {app, BrowserWindow, dialog} = require('electron');
  const {pathToFileURL} = require('url');
  const [phase, output] = process.argv.slice(2);
  const appRoot = path.resolve(__dirname, '../dist/app');
  const sourceUrl = pathToFileURL(path.join(appRoot, 'assets/sully/maps/json/farmsville.map.json')).href;
  const copyPath = path.join(output, 'zoom-copy.map.json');
  const copyUrl = pathToFileURL(copyPath).href;
  const expectedPath = path.join(output, 'expected.json');
  app.setPath('userData', path.join(output, 'profile'));
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  let win;
  const errors = [];
  const timeout = setTimeout(() => {console.error('Map zoom smoke timed out:', output); app.exit(1);}, 90000);
  const browser = (fn, ...args) => win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`, true);
  const settle = () => browser(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function waitFor(fn, label, ...args) {
    const until = Date.now() + 20000;
    while (!await browser(fn, ...args)) {
      if (Date.now() > until) throw new Error('Timed out: ' + label);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
  async function ready(title) {
    await waitFor(title => document.querySelector(`[aria-label="${title} map editor"]`)?.getAttribute('aria-busy') === 'false', 'map renderer ' + title, title);
    await settle();
  }
  async function button(label) {
    await browser(label => {
      const button = [...document.querySelectorAll('[aria-label="Map controls"] button')].find(el => el.textContent.trim() === label);
      if (!button || button.disabled) throw new Error('Missing/disabled button ' + label);
      button.click();
    }, label);
    await settle();
  }
  async function zoom(url) {return browser(url => JSON.parse(localStorage.getItem('breaditor.mapZoom.v1.' + url)), url);}
  async function wheel() {
    const point = await browser(() => {const rect = document.querySelector('[aria-label="Map viewport"]').getBoundingClientRect(); return {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)};});
    win.webContents.sendInputEvent({type: 'mouseWheel', ...point, deltaX: 0, deltaY: -100});
    await settle();
  }
  async function expectZoom(url, expected) {
    assert.strictEqual(await zoom(url), expected, 'Stored zoom ' + url);
    const shown = await browser(() => document.querySelector('[data-testid="map-status"]').textContent.match(/Zoom (\d+)%/)[1]);
    assert.strictEqual(Number(shown), Math.round(expected * 100), 'Displayed zoom ' + url);
  }
  async function openCopy() {
    await browser(() => [...document.querySelectorAll('[data-testid="breaditor-browser-menubar"] div')].find(el => el.textContent === 'File').dispatchEvent(new MouseEvent('mousedown', {bubbles: true})));
    await browser(() => [...document.querySelectorAll('[data-testid="breaditor-menubar-contextmenu"] div')].find(el => el.textContent === 'Recent 1: zoom-copy.map.json').click());
    // The existing document strip needs a workspace rebuild to expose newly
    // opened documents; use its current UI command rather than changing it here.
    await browser(() => [...document.querySelectorAll('[data-testid="breaditor-browser-menubar"] div')].find(el => el.textContent === 'Test').dispatchEvent(new MouseEvent('mousedown', {bubbles: true})));
    await browser(() => [...document.querySelectorAll('[data-testid="breaditor-menubar-contextmenu"] div')].find(el => el.textContent === 'Panels on').click());
    await ready('zoom-copy');
  }
  async function reload() {
    const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    win.webContents.reload(); await loaded; await ready('Map A');
  }
  app.whenReady().then(async () => {
    const filename = path.resolve(__dirname, '../src/main/mapFileSaving.ts');
    const saving = new (require('module'))(filename, module); saving.paths = module.paths;
    saving._compile(require('esbuild').buildSync({entryPoints: [filename], bundle: true, platform: 'node', external: ['electron'], write: false}).outputFiles[0].text, filename);
    saving.exports.registerMapFileSaving();
    dialog.showSaveDialog = async () => ({canceled: false, filePath: copyPath});
    win = new BrowserWindow({show: false, width: 1450, height: 1000, webPreferences: {contextIsolation: true, nodeIntegration: true,
      preload: path.join(appRoot, 'preload.js'), backgroundThrottling: false}});
    win.webContents.on('console-message', (_event, level, message) => {if (level >= 2 && /TypeError|ReferenceError|SyntaxError/.test(message)) errors.push(message);});
    win.webContents.on('preload-error', (_event, _file, error) => errors.push(error.message));
    await win.loadFile(path.join(appRoot, 'index.html')); await ready('Map A');
    if (phase === 'write') {
      await button('100%'); await expectZoom(sourceUrl, 1);
      await wheel(); await wheel();
      const source = await zoom(sourceUrl); assert.notStrictEqual(source, 1, 'Wheel must change zoom');
      await expectZoom(sourceUrl, source);
      await button('Save As');
      await waitFor(() => document.querySelector('[data-testid="map-status"]').textContent.includes('Map saved'), 'Save As completed');
      await expectZoom(copyUrl, source);
      await button('Fit');
      assert.notStrictEqual(await zoom(copyUrl), source, 'Fit must replace saved zoom');
      await button('100%'); await wheel();
      const copy = await zoom(copyUrl); assert.notStrictEqual(copy, source, 'Maps need different zooms');
      await expectZoom(copyUrl, copy);
      assert.strictEqual(await zoom(sourceUrl), source, 'Copy zoom changed source preference');
      fs.writeFileSync(expectedPath, JSON.stringify({source, copy}, null, 2));
      await reload(); await expectZoom(sourceUrl, source);
      await openCopy(); await expectZoom(copyUrl, copy);
    } else {
      const expected = JSON.parse(fs.readFileSync(expectedPath));
      await expectZoom(sourceUrl, expected.source);
      await openCopy(); await expectZoom(copyUrl, expected.copy);
    }
    assert.deepStrictEqual(errors, []);
    // Let the compositor present the freshly mounted document before capture.
    await browser(() => new Promise(resolve => setTimeout(resolve, 250)));
    await ready('zoom-copy');
    fs.writeFileSync(path.join(output, phase + '.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); win.destroy(); app.exit(0);
  }).catch(async error => {
    console.error(error, '\nRetained:', output);
    if (win && !win.isDestroyed()) fs.writeFileSync(path.join(output, phase + '-failure.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); app.exit(1);
  });
}
