// Build first, then: electron test-infrastructure/map-layers.smoke.js --no-sandbox
// Uses the production UI and renderer; all screenshots and saved copies are retained.
const {app, BrowserWindow, dialog} = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const root = path.resolve(__dirname, '..'), artifactRoot = process.env.MAP_VISUAL_OUTPUT || os.tmpdir();
fs.mkdirSync(artifactRoot, {recursive: true});
const output = fs.mkdtempSync(path.join(artifactRoot, 'breaditor-map-layers-'));
const profile = path.join(output, 'profile'); fs.mkdirSync(profile); app.setPath('userData', profile);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
const saved = path.join(output, 'layers.map.json');
const original = JSON.parse(fs.readFileSync(path.join(root, 'assets/sully/maps/json/farmsville.map.json')));
const originalData = JSON.parse(fs.readFileSync(path.join(root, 'assets/sully/maps/json/farmsville.map.data.json')));
let win;
const errors = [], report = {};
const deadline = setTimeout(() => {console.error('Layer smoke timed out. Retained:', output); app.exit(1);}, 90000);
app.on('window-all-closed', () => {});

async function browser(fn, ...args) {
  const result = await win.webContents.executeJavaScript(`(async () => {try {return {value: await (${fn.toString()})(...${JSON.stringify(args)})};} catch(error) {return {error: error.stack || error.message};}})()`, true);
  if (result.error) throw new Error(result.error);
  return result.value;
}
async function waitFor(fn, label, ...args) {
  const until = Date.now() + 15000;
  while (!await browser(fn, ...args)) {
    if (Date.now() > until) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}
async function click(label) {
  await browser(label => {
    const button = document.querySelector(`#PanelLayers button[aria-label="${label}"]`);
    if (!button || button.disabled) throw new Error(`Missing/disabled ${label}`);
    button.click();
  }, label);
}
async function toolbar(label) {
  await browser(label => {
    const button = [...document.querySelectorAll('[aria-label="Map controls"] button')].find(item => item.textContent.trim() === label);
    if (!button || button.disabled) throw new Error(`Missing/disabled map command ${label}`);
    button.click();
  }, label);
}
async function pixels() {
  return browser(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('[aria-label="Map A map"]'), gl = canvas.getContext('webgl2');
    const bytes = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    let hash = 2166136261;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    return (hash >>> 0).toString(16);
  });
}
async function order() {return browser(() => [...document.querySelectorAll('#PanelLayers [data-render-token]')].map(row => row.dataset.renderToken));}

async function nativeDrag(from, to) {
  const points = await browser((from, to) => {
    const point = name => {
      const row = document.querySelector(`#PanelLayers [data-layer-name="${name}"]`);
      row.scrollIntoView({block: 'nearest'});
      const grip = row.firstElementChild.getBoundingClientRect();
      return {x: grip.x + grip.width / 2, y: grip.y + grip.height / 2};
    };
    return {to: point(to), from: point(from)};
  }, from, to);
  const debuggerAPI = win.webContents.debugger;
  debuggerAPI.attach('1.3');
  let timer;
  const dragData = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Native drag did not start')), 5000);
    debuggerAPI.on('message', (_event, method, parameters) => {if (method === 'Input.dragIntercepted') {clearTimeout(timer); resolve(parameters.data);}});
  });
  try {
    await debuggerAPI.sendCommand('Input.setInterceptDrags', {enabled: true});
    await debuggerAPI.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', ...points.from});
    await debuggerAPI.sendCommand('Input.dispatchMouseEvent', {type: 'mousePressed', ...points.from, button: 'left', buttons: 1, clickCount: 1});
    await debuggerAPI.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', x: points.from.x + 10, y: points.from.y + 10, button: 'left', buttons: 1});
    const data = await dragData;
    for (const type of ['dragEnter', 'dragOver', 'drop']) await debuggerAPI.sendCommand('Input.dispatchDragEvent', {type, ...points.to, data});
    await debuggerAPI.sendCommand('Input.dispatchMouseEvent', {type: 'mouseReleased', ...points.to, button: 'left', buttons: 0, clickCount: 1});
  } finally {clearTimeout(timer); debuggerAPI.detach();}
}

app.whenReady().then(async () => {
  const filename = path.join(root, 'src/main/mapFileSaving.ts'), saving = new Module(filename, module); saving.paths = module.paths;
  saving._compile(require('esbuild').buildSync({entryPoints: [filename], bundle: true, platform: 'node', external: ['electron'], write: false}).outputFiles[0].text, filename);
  saving.exports.registerMapFileSaving();
  dialog.showSaveDialog = async () => ({canceled: false, filePath: saved});
  win = new BrowserWindow({show: false, width: 1450, height: 1100, webPreferences: {contextIsolation: true, nodeIntegration: true,
    preload: path.join(root, 'dist/app/preload.js'), backgroundThrottling: false}});
  win.webContents.on('console-message', (_event, level, message) => {if (level >= 2 && /TypeError|ReferenceError|SyntaxError|WebGL/i.test(message) && !/GPU stall due to ReadPixels/.test(message)) errors.push(message);});
  await win.loadFile(path.join(root, 'dist/app/index.html'));
  await waitFor(() => document.querySelector('[aria-label="Map A map editor"]')?.getAttribute('aria-busy') === 'false' && !!document.querySelector('#PanelLayers [data-render-token]'), 'Farmsville and Layers');
  await toolbar('Pause');
  assert.deepStrictEqual(await order(), original.renderstring.split(',').reverse());
  assert.strictEqual(await browser(() => document.querySelector('[aria-label="Tall entities redraw on this layer"]').closest('[data-layer-name]').dataset.layerName), original.tallentitylayer);
  report.original = await pixels();
  await click('Hide Background layer'); report.hidden = await pixels();
  assert.notStrictEqual(report.hidden, report.original, 'Art eyeball did not change rendered pixels');
  await toolbar('Undo'); assert.strictEqual(await pixels(), report.original, 'Art visibility undo did not restore pixels');
  await toolbar('Redo'); assert.strictEqual(await pixels(), report.hidden, 'Art visibility redo did not restore pixels');
  await toolbar('Undo');
  await click('Hide all entities'); report.noEntities = await pixels();
  assert.notStrictEqual(report.noEntities, report.original, 'Global entity eyeball did not change pixels');
  await click('Show all entities'); assert.strictEqual(await pixels(), report.original);
  await click('Show obstruction overlay'); report.obstructions = await pixels();
  assert.notStrictEqual(report.obstructions, report.original, 'Obstruction eye did not show overlay');
  await click('Hide obstruction overlay');
  let moves = 0;
  while (!await browser(() => document.querySelector('[aria-label="Move Background up"]').disabled)) {await click('Move Background up'); moves++;}
  report.reordered = await pixels(); assert.notStrictEqual(report.reordered, report.original, 'Draw ordering did not change rendered pixels');
  for (let i = 0; i < moves; i++) await toolbar('Undo');
  assert.deepStrictEqual(await order(), original.renderstring.split(',').reverse());
  assert.strictEqual(await pixels(), report.original, 'Order undo did not restore rendering');

  await nativeDrag('Fishing', 'Foreground');
  const expected = original.renderstring.split(','), [moved] = expected.splice(expected.indexOf('5'), 1); expected.splice(expected.indexOf('4'), 0, moved);
  assert.deepStrictEqual(await order(), [...expected].reverse(), 'Native drag did not change render order');
  await toolbar('Save As');
  await waitFor(() => !document.querySelector('[data-testid="map-status"]').textContent.includes('Unsaved changes'), 'saved layer order');
  assert.strictEqual(JSON.parse(fs.readFileSync(saved)).renderstring, expected.join(','));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(output, 'layers.map.data.json'))), originalData, 'Reordering changed bound or surplus tile data');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(saved)).layers, original.layers, 'Reordering changed layer metadata');
  assert.deepStrictEqual(errors, [], `Renderer errors: ${errors.join('; ')}`);
  fs.writeFileSync(path.join(output, 'app.png'), (await win.webContents.capturePage()).toPNG());
  const rect = await browser(() => {const r = document.getElementById('PanelLayers').getBoundingClientRect(); return {x: Math.ceil(r.x), y: Math.ceil(r.y), width: Math.floor(r.width), height: Math.floor(r.height)};});
  fs.writeFileSync(path.join(output, 'layers.png'), (await win.webContents.capturePage(rect)).toPNG());
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({...report, nativeDrag: true, savedOrder: expected.join(',')}, null, 2));
  console.log('Layer panel, real render changes, native drag, undo/redo and saved data passed. Retained:', output);
  win.destroy(); clearTimeout(deadline); app.exit(0);
}).catch(async error => {
  console.error(error, '\nRetained:', output);
  if (win && !win.isDestroyed()) fs.writeFileSync(path.join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG());
  win?.destroy(); clearTimeout(deadline); app.exit(1);
});
