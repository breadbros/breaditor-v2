// Build first, then: node test-infrastructure/panel-layout.smoke.js
// Runs two separate Electron processes with an isolated, retained profile.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
if (!process.versions.electron) {
  const output = fs.mkdtempSync(path.join(require('os').tmpdir(), 'breaditor-panel-layout-'));
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  for (const phase of ['write', 'read']) {
    const result = require('child_process').spawnSync(require('electron'), [__filename, phase, output], {env, stdio: 'inherit', windowsHide: true});
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log('Panel layout drag, resize, visibility, refresh and process restart passed. Retained:', output);
} else {
  const {app, BrowserWindow} = require('electron');
  const [phase, output] = process.argv.slice(2);
  app.setPath('userData', path.join(output, 'profile'));
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  let win;
  const timeout = setTimeout(() => {console.error('Panel layout smoke timed out:', output); app.exit(1);}, 60000);
  const browser = (fn, ...args) => win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`, true);
  const settle = () => browser(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function waitFor(fn) {
    const until = Date.now() + 15000;
    while (!await browser(fn)) {if (Date.now() > until) throw new Error('UI did not become ready'); await new Promise(resolve => setTimeout(resolve, 40));}
  }
  async function focus(title) {
    await browser(title => [...document.querySelectorAll('span')].find(el => el.textContent === title + ' Document').dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0})), title);
    await settle();
  }
  async function toggle(title) {
    await browser(() => [...document.querySelectorAll('[data-testid="breaditor-browser-menubar"] div')].find(el => el.textContent === 'Panels').dispatchEvent(new MouseEvent('mousedown', {bubbles: true})));
    await browser(title => [...document.querySelectorAll('[data-testid="breaditor-menubar-contextmenu"] span')].find(el => el.textContent === title).click(), title);
    await settle();
  }
  async function layout(type, area = 'panels') {return browser((type, area) => JSON.parse(localStorage.getItem(`breaditor.layout.v1.${type}.${area}`)).layout, type, area);}
  async function resize(selector, dx, dy) {
    const point = await browser(selector => {const r = document.querySelector(selector).getBoundingClientRect(); return {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)};}, selector);
    win.webContents.sendInputEvent({type: 'mouseMove', ...point});
    win.webContents.sendInputEvent({type: 'mouseDown', ...point, button: 'left', clickCount: 1}); await settle();
    win.webContents.sendInputEvent({type: 'mouseMove', x: point.x + dx, y: point.y + dy}); await settle();
    win.webContents.sendInputEvent({type: 'mouseUp', x: point.x + dx, y: point.y + dy, button: 'left', clickCount: 1}); await settle();
  }
  async function check(expected) {
    for (const [type, title] of [['MAP', 'Map A'], ['TEXT', 'Text B'], ['SPRITE', 'Sprite C']]) {
      await focus(title);
      const current = await layout(type);
      assert.deepStrictEqual(current.map(p => p.windows.map(w => ({widgets: w.widgets, selected: w.selected}))), expected[type].map(p => p.windows.map(w => ({widgets: w.widgets, selected: w.selected}))), type + ' panel arrangement');
      current.forEach((panel, p) => panel.windows.forEach((win, w) => {
        const savedSize = expected[type][p].windows[w].size;
        if (savedSize !== undefined) assert(Math.abs(win.size - savedSize) < 3, `${type} row ${w} height: ${win.size} vs ${savedSize}`);
      }));
      if (type === 'MAP') {
        const heights = await browser(() => [...document.querySelectorAll('#panels-container [data-rbd-droppable-id]')].map(el => el.closest('.pg-panel').getBoundingClientRect().height));
        heights.forEach((height, i) => assert(Math.abs(height - expected.heights[i]) < 3, `Rendered row ${i}: ${height} vs ${expected.heights[i]}`));
      }
      assert.deepStrictEqual(await browser(() => [...document.querySelectorAll('#panels-container [data-rbd-draggable-id]')].map(el => el.textContent)), current.flatMap(p => p.windows.flatMap(w => w.widgets.map(id => id.replace('Panel', '') + ' Panel'))));
    }
    await focus('Map D');
    const width = await browser(() => document.getElementById('panels-container').getBoundingClientRect().width);
    assert(Math.abs(width - expected.width) < 3, `Sidebar width changed: ${width} vs ${expected.width}`);
  }
  app.whenReady().then(async () => {
    const filename = path.resolve(__dirname, '../src/main/mapFileSaving.ts');
    const saving = new (require('module'))(filename, module); saving.paths = module.paths;
    saving._compile(require('esbuild').buildSync({entryPoints: [filename], bundle: true, platform: 'node', external: ['electron'], write: false}).outputFiles[0].text, filename);
    saving.exports.registerMapFileSaving();
    win = new BrowserWindow({show: false, width: 1450, height: 1000, webPreferences: {contextIsolation: true, nodeIntegration: true, preload: path.resolve(__dirname, '../dist/app/preload.js'), backgroundThrottling: false}});
    await win.loadFile(path.resolve(__dirname, '../dist/app/index.html'));
    await waitFor(() => !!document.querySelector('#panels-container [data-rbd-draggable-id]'));
    const expectedFile = path.join(output, 'expected.json');
    if (phase === 'write') {
      await toggle('Zones Panel');
      // Use the dock library's supported keyboard drag sensor to reorder tabs.
      await browser(() => [...document.querySelectorAll('#panels-container [data-rbd-draggable-id]')].find(el => el.textContent === 'Info Panel').focus());
      for (const keyCode of ['Space', 'Left', 'Space']) {
        win.webContents.sendInputEvent({type: 'keyDown', keyCode});
        win.webContents.sendInputEvent({type: 'keyUp', keyCode});
        await settle();
      }
      assert.deepStrictEqual((await layout('MAP'))[0].windows[0].widgets, ['PanelInfo', 'PanelLayers'], 'Tab drag did not reorder');
      await resize('[data-testid="breaditor-browser-workspacearea"] > .pg-panelGroup > .pg-divider', -120, 0);
      const previousHeight = await browser(() => document.getElementById('PanelInfo').closest('.pg-panel').getBoundingClientRect().height);
      await resize('#panels-container .pg-divider', 0, 70);
      assert((await layout('MAP'))[0].windows[0].size > previousHeight + 50, 'Row resize did not take effect');
      const width = await browser(() => document.getElementById('panels-container').getBoundingClientRect().width);
      const heights = await browser(() => [...document.querySelectorAll('#panels-container [data-rbd-droppable-id]')].map(el => el.closest('.pg-panel').getBoundingClientRect().height));
      const MAP = await layout('MAP');
      await focus('Text B'); await toggle('Todo Panel'); const TEXT = await layout('TEXT');
      await focus('Sprite C'); await toggle('Palette Panel'); const SPRITE = await layout('SPRITE');
      const expected = {MAP, TEXT, SPRITE, width, heights};
      fs.writeFileSync(expectedFile, JSON.stringify(expected, null, 2));
      await check(expected);
      const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve)); win.webContents.reload(); await loaded;
      await waitFor(() => !!document.querySelector('#PanelInfo'));
      await check(expected);
    } else await check(JSON.parse(fs.readFileSync(expectedFile)));
    fs.writeFileSync(path.join(output, phase + '.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); win.destroy(); app.exit(0);
  }).catch(async error => {
    console.error(error, '\nRetained:', output);
    if (win && !win.isDestroyed()) fs.writeFileSync(path.join(output, phase + '-failure.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(timeout); app.exit(1);
  });
}
