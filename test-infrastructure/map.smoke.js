// Run after the production build: electron test-infrastructure/map.smoke.js
// Temporary saved files and the screenshot are retained for inspection.
const {app, BrowserWindow, dialog} = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const {fileURLToPath, pathToFileURL} = require('url');
if (process.env.MAP_SMOKE_SCALE) app.commandLine.appendSwitch('force-device-scale-factor', process.env.MAP_SMOKE_SCALE);

const root = path.resolve(__dirname, '../dist/app');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'breaditor-map-smoke-'));
const profile = path.join(output, 'profile');
fs.mkdirSync(profile);
app.setPath('userData', profile);
const savedPath = path.join(output, 'saved.map.json');
const savedData = path.join(output, 'saved.map.data.json');
let selectedPath = savedPath;
const originalData = JSON.parse(fs.readFileSync(path.join(root, 'assets/sully/maps/json/farmsville.map.data.json'), 'utf8'));
let win;
const errors = [];
const deadline = setTimeout(() => {console.error('Map smoke timed out. Retained files:', output); app.exit(1);}, 120000);
app.on('window-all-closed', () => {});

function registerSaving() {
  const filename = path.resolve(__dirname, '../src/main/mapFileSaving.ts');
  const savingModule = new Module(filename, module);
  savingModule.paths = module.paths;
  savingModule._compile(require('esbuild').buildSync({entryPoints: [filename], bundle: true,
    platform: 'node', external: ['electron'], write: false}).outputFiles[0].text, filename);
  savingModule.exports.registerMapFileSaving();
}

async function browser(fn, ...args) {
  const result = await win.webContents.executeJavaScript(`(async () => {try {return {value: await (${fn.toString()})(...${JSON.stringify(args)})};} catch (error) {return {error: error.stack || error.message};}})()`, true);
  if (result.error) throw new Error(result.error);
  return result.value;
}

async function waitFor(fn, description, ...args) {
  const until = Date.now() + 25000;
  while (!await browser(fn, ...args)) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${description}: ${await browser(() => document.body.textContent)}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}

async function clickButton(title) {
  const result = await browser(title => {
    const toolbar = document.querySelector('[aria-label="Map controls"]');
    const button = [...(toolbar || document).querySelectorAll('button')].find(node => node.textContent.trim().toLowerCase() === title.toLowerCase());
    if (!button) throw new Error(`Missing map button ${title}: ${document.body.textContent}`);
    button.click();
    return !button.disabled;
  }, title);
  assert(result, `Button ${title} was disabled`);
}

async function waitForFile(filename) {
  const until = Date.now() + 25000;
  while (!fs.existsSync(filename)) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${filename}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}

async function paint(tile = 42) {
  await waitFor(() => document.querySelector('[aria-label="Map A map editor"]')?.getAttribute('aria-busy') === 'false', 'map graphics ready for painting');
  await clickButton('Brush');
  await browser(tile => {
    const input = document.querySelector('[aria-label="Primary tile"]');
    if (!input) throw new Error('Missing Primary tile input');
    {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(tile));
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
      input.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
    }
  }, tile);
  const point = await browser(() => {
    const rect = document.querySelector('[aria-label="Map A map"]').getBoundingClientRect();
    return {x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2)};
  });
  win.webContents.sendInputEvent({type: 'mouseMove', ...point});
  win.webContents.sendInputEvent({type: 'mouseDown', ...point, button: 'left', clickCount: 1});
  win.webContents.sendInputEvent({type: 'mouseUp', ...point, button: 'left', clickCount: 1});
  await waitFor(() => document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes'), 'paint dirty state');
}

app.whenReady().then(async () => {
  registerSaving();
  dialog.showSaveDialog = async () => ({canceled: false, filePath: selectedPath});
  win = new BrowserWindow({show: false, width: 1400, height: 1000, webPreferences: {
    contextIsolation: true, nodeIntegration: true, preload: path.join(root, 'preload.js'), backgroundThrottling: false,
  }});
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 && /TypeError|ReferenceError|SyntaxError|WebGL|Crustacean|map.*fail/i.test(message)) errors.push(message);
  });
  win.webContents.on('preload-error', (_event, _file, error) => errors.push(error.message));
  await win.loadFile(path.join(root, 'index.html'));
  await waitFor(() => !!document.querySelector('[aria-label="Map A map"]') &&
    /116 entities/.test(document.querySelector('[data-testid="map-status"]')?.textContent || '') &&
    document.querySelector('[aria-label="Map A map editor"]')?.getAttribute('aria-busy') === 'false', 'bundled Farmsville');
  await clickButton('Pause');
  const pixels = await browser(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('[aria-label="Map A map"]');
    const gl = canvas.getContext('webgl2');
    const bytes = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    const colors = new Set();
    for (let i = 0; i < bytes.length; i += 4) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]},${bytes[i + 3]}`);
    return {width: canvas.width, height: canvas.height, colors: colors.size};
  });
  assert(pixels.width > 100 && pixels.height > 100 && pixels.colors > 20, `Map rendering was empty: ${JSON.stringify(pixels)}`);
  const previousZoom = await browser(() => document.querySelector('[data-testid="map-status"]').textContent.match(/Zoom (\d+)%/)[1]);
  const zoomPoint = await browser(() => {
    const rect = document.querySelector('[aria-label="Map A map"]').getBoundingClientRect();
    return {x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2)};
  });
  win.webContents.sendInputEvent({type: 'mouseWheel', ...zoomPoint, deltaY: 100, deltaX: 0, canScroll: true});
  await waitFor(previous => {
    const zoom = document.querySelector('[data-testid="map-status"]')?.textContent.match(/Zoom (\d+)%/);
    return zoom && Number(zoom[1]) > Number(previous);
  }, 'cursor zoom', previousZoom);
  const zoomed = await browser(() => document.querySelector('[data-testid="map-status"]').textContent.match(/Zoom (\d+)%/)[1]);
  assert(Number(zoomed) > Number(previousZoom), 'Mouse wheel did not zoom the map');
  await paint(43);
  await clickButton('Undo');
  await waitFor(() => !document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes'), 'undo clean state');
  await clickButton('Redo');
  await waitFor(() => document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes'), 'redo dirty state');
  await clickButton('Save As');
  await waitFor(() => /saved/i.test(document.querySelector('[data-testid="map-status"]')?.textContent || '') &&
    !document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes'), 'Save As completion');
  assert(fs.existsSync(savedPath) && fs.existsSync(savedData), 'Map/data pair was not saved');
  const editedData = JSON.parse(fs.readFileSync(savedData, 'utf8'));
  assert.notDeepStrictEqual(editedData.tile_data, originalData.tile_data, 'Paint was not persisted');
  assert.deepStrictEqual(editedData.tile_data[6], originalData.tile_data[6], 'Surplus tile layer changed');

  // Reopen through the real document-opening event and verify the saved map loads.
  await browser(saved => document.getElementById('react-root').dispatchEvent(new CustomEvent('OPEN_FILE_SUCCESS', {detail: {filePath: saved}})), savedPath);
  await waitFor(() => document.body.textContent.includes('saved') && document.querySelectorAll('canvas').length > 0, 'saved map reopening');

  // Return to the saved Map A session; its source watcher follows Save As.
  await browser(() => {
    const tab = [...document.querySelectorAll('span')].find(node => node.textContent === 'Map A Document');
    if (!tab) throw new Error('Missing Map A tab');
    tab.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0}));
  });
  await waitFor(() => !!document.querySelector('[aria-label="Map A map"]'), 'Map A remount');
  assert.strictEqual(await browser(() => document.querySelector('[data-testid="map-status"]').textContent.match(/Zoom (\d+)%/)[1]), zoomed, 'Tab switching lost the map camera');
  const changedMap = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
  changedMap.entities.push({...changedMap.entities[0], uuid: 'smoke-clean-reload', name: 'Smoke reload entity'});
  fs.writeFileSync(savedPath, JSON.stringify(changedMap, null, 2));
  await waitFor(() => /117 entities/.test(document.querySelector('[data-testid="map-status"]')?.textContent || ''), 'clean source reload');
  await paint();
  changedMap.entities.push({...changedMap.entities[0], uuid: 'smoke-dirty-reload', name: 'Smoke dirty conflict entity'});
  fs.writeFileSync(savedPath, JSON.stringify(changedMap, null, 2));
  await waitFor(() => /changed.*disk|source.*changed|external.*chang/i.test(document.querySelector('[aria-label="Map A map editor"]')?.textContent || ''), 'dirty source conflict');
  assert(await browser(() => document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes')), 'External edit discarded dirty map');
  selectedPath = path.join(output, 'export #1.map.json');
  await clickButton('Export project');
  await waitFor(() => /Project exported/.test(document.querySelector('[data-testid="map-status"]')?.textContent || '') &&
    !document.querySelector('[data-testid="map-status"]')?.textContent.includes('Unsaved changes') &&
    !document.querySelector('[aria-label="Map A map editor"] [role="alert"]'), 'self-contained project export');
  const exported = JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
  const exportedMapUrl = pathToFileURL(selectedPath).href;
  const exportedRoot = new URL(exported.MAPED_CONTENT_ROOT, exportedMapUrl).href;
  const definitions = [
    ...Object.values(exported.vsp).map(reference => new URL(reference, exportedMapUrl).href),
    ...new Set(exported.entities.map(entity => new URL(entity.filename, exportedRoot).href)),
  ];
  for (const definitionUrl of definitions) {
    assert(definitionUrl.startsWith(exportedRoot), `Export references external definition ${definitionUrl}`);
    const definition = JSON.parse(fs.readFileSync(fileURLToPath(definitionUrl), 'utf8'));
    const imageUrl = new URL(definition.source_image || definition.image, definitionUrl).href;
    assert(imageUrl.startsWith(exportedRoot), `Export references external image ${imageUrl}`);
    assert(fs.existsSync(fileURLToPath(imageUrl)), `Missing exported image ${imageUrl}`);
  }
  selectedPath = path.join(output, 'exported-map.png');
  await clickButton('Export PNG');
  await waitFor(() => document.querySelector('[data-testid="map-status"]')?.textContent.includes('PNG exported'), 'PNG export completed');
  await waitForFile(selectedPath);
  const png = fs.readFileSync(selectedPath);
  assert.deepStrictEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.strictEqual(png.readUInt32BE(16), 2400);
  assert.strictEqual(png.readUInt32BE(20), 4000);
  assert.deepStrictEqual(errors, []);
  await waitFor(() => document.querySelector('[aria-label="Map A map editor"]')?.getAttribute('aria-busy') === 'false', 'exported map graphics');
  fs.writeFileSync(path.join(output, 'map-smoke.png'), (await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({pixels, zoomed, savedPath, cleanReload: true, dirtyConflict: true,
    exportedDefinitions: definitions.length, png: {width: png.readUInt32BE(16), height: png.readUInt32BE(20)}, retained: output}));
  win.destroy();
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => {
  console.error(error, '\nRetained files:', output, '\nRenderer errors:', errors);
  clearTimeout(deadline);
  app.exit(1);
});
