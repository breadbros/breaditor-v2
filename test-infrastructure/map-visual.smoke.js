// electron test-infrastructure/map-visual.smoke.js [--farmsville] [--write-fixture-pngs]
const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const zlib = require('zlib');
const {palette, scenes} = require('./map-visual.fixtures');

const root = path.resolve(__dirname, '..');
const artifactRoot = process.env.MAP_VISUAL_OUTPUT ? path.resolve(process.env.MAP_VISUAL_OUTPUT) : os.tmpdir();
fs.mkdirSync(artifactRoot, {recursive: true});
const artifacts = fs.mkdtempSync(path.join(artifactRoot, 'breaditor-map-visual-'));
fs.mkdirSync(path.join(artifacts, 'user-data'));
app.setPath('userData', path.join(artifacts, 'user-data'));
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.on('window-all-closed', () => {});
let server, win;
const deadline = setTimeout(() => {console.error('Visual map tests timed out. Retained artifacts:', artifacts); app.exit(1);}, 45000);

function expectedPixels(scene, frame) {
  if (frame.rows.length !== scene.height || frame.rows.some(row => row.length !== scene.width)) throw new Error(`Invalid expected dimensions: ${scene.name}`);
  const values = [];
  for (const symbol of frame.rows.join('')) {
    if (!palette[symbol]) throw new Error(`Unknown expected color ${symbol}`);
    values.push(...palette[symbol]);
  }
  return Buffer.from(values);
}

// Minimal PNG encoder; expected images come exclusively from the hand-authored rows.
function png(width, height, rgba) {
  function crc(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  }
  function chunk(name, bytes) {
    const header = Buffer.alloc(4), label = Buffer.from(name), checksum = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(Buffer.concat([label, bytes])));
    return Buffer.concat([header, label, bytes, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y++) rows.push(Buffer.from([0]), rgba.subarray(y * width * 4, (y + 1) * width * 4));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

function writeDataPng(filename, data) {fs.writeFileSync(filename, Buffer.from(data.split(',')[1], 'base64'));}
async function runBrowser(fn, ...args) {
  const result = await win.webContents.executeJavaScript(`(async () => {try {return {value: await (${fn.toString()})(...${JSON.stringify(args)})};} catch(error) {return {error: error.stack || error.message};}})()`);
  if (result.error) throw new Error(result.error);
  return result.value;
}

app.whenReady().then(async () => {
  const bundle = require('esbuild').buildSync({entryPoints: [path.join(__dirname, 'map-visual.renderer.js')], bundle: true,
    write: false, format: 'iife', globalName: 'mapVisual', platform: 'browser', target: 'chrome110'}).outputFiles[0].contents;
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') {response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><canvas id="map"></canvas><script src="/bundle.js"></script>');}
      else if (pathname === '/bundle.js') {response.setHeader('Content-Type', 'text/javascript'); response.end(bundle);}
      else if (pathname.startsWith('/content/')) {
        const contentRoot = path.join(root, 'assets/sully'), filename = path.resolve(contentRoot, pathname.slice('/content/'.length));
        if (!filename.startsWith(contentRoot + path.sep)) {response.writeHead(403).end(); return;}
        response.setHeader('Content-Type', filename.endsWith('.png') ? 'image/png' : 'application/json');
        response.end(fs.readFileSync(filename));
      } else response.writeHead(404).end();
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  win = new BrowserWindow({show: false, width: 600, height: 500, webPreferences: {
    contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
  }});
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
  const failures = [], results = [];
  for (const scene of scenes) {
    scene.frames.forEach(frame => expectedPixels(scene, frame));
    const actualFrames = await runBrowser((scene, palette) => mapVisual.renderScene(scene, palette), scene, palette);
    for (let index = 0; index < scene.frames.length; index++) {
      const expected = expectedPixels(scene, scene.frames[index]), actual = Buffer.from(actualFrames[index].rgba);
      const name = `${scene.name}-${index}-${scene.frames[index].timeMs}ms`;
      if (process.argv.includes('--write-fixture-pngs')) {
        const directory = path.join(__dirname, 'map-visual-fixtures/expected');
        fs.mkdirSync(directory, {recursive: true});
        fs.writeFileSync(path.join(directory, `${name}.png`), png(scene.width, scene.height, expected));
      }
      if (!actual.equals(expected) || actualFrames[index].error !== 0) {
        const differences = [];
        for (let offset = 0; offset < expected.length; offset += 4) {
          if (!expected.subarray(offset, offset + 4).equals(actual.subarray(offset, offset + 4))) differences.push({
            x: offset / 4 % scene.width, y: Math.floor(offset / 4 / scene.width),
            expected: [...expected.subarray(offset, offset + 4)], actual: [...actual.subarray(offset, offset + 4)],
          });
        }
        writeDataPng(path.join(artifacts, `${name}-actual.png`), actualFrames[index].actualPng);
        fs.writeFileSync(path.join(artifacts, `${name}-expected.png`), png(scene.width, scene.height, expected));
        const report = {name, differentPixels: differences.length, glError: actualFrames[index].error, firstDifferences: differences.slice(0, 12)};
        fs.writeFileSync(path.join(artifacts, `${name}-difference.json`), JSON.stringify(report, null, 2));
        failures.push(report);
      }
      results.push({name, pixels: scene.width * scene.height, pass: actual.equals(expected) && actualFrames[index].error === 0});
    }
  }
  if (process.argv.includes('--farmsville')) {
    const captures = await runBrowser(() => mapVisual.captureFarmsville());
    for (const capture of captures) writeDataPng(path.join(artifacts, `${capture.name}.png`), capture.png);
  }
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({results, failures}, null, 2));
  if (failures.length) throw new Error(`${failures.length} visual fixtures failed: ${JSON.stringify(failures)}`);
  console.log(`Passed ${results.length} exact-pixel WebGL frames across ${scenes.length} hand-authored scenes. Retained artifacts: ${artifacts}`);
  win.destroy(); server.close(); clearTimeout(deadline); app.exit(0);
}).catch(error => {
  console.error(error, '\nRetained artifacts:', artifacts);
  win?.destroy(); server?.close(); clearTimeout(deadline); app.exit(1);
});
