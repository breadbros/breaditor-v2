// Run: yarn test:monaco
// Exercises the built UI and real workers under file: and HTTP, without showing a window.
const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const root = path.resolve(__dirname, '../dist/app');
const expected = fs.readFileSync(path.join(root, 'assets/lord-stan/lord_stan.json'), 'utf8');
let server;
app.on('window-all-closed', () => {});
const deadline = setTimeout(() => { console.error('Monaco smoke test timed out.'); app.exit(1); }, 45000);

async function exercise(win, label) {
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 && /monaco|worker|TypeError|ReferenceError|SyntaxError/i.test(message)) {
      errors.push(message);
      console.error(label + ': ' + message);
    }
  });
  win.webContents.on('preload-error', (_event, _file, error) => errors.push(error.message));
  const result = await win.webContents.executeJavaScript(`(${async function () {
    window.addEventListener('error', event => console.error(event.error?.stack || event.message));
    const wait = async predicate => {
      const deadline = Date.now() + 20000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error('Timed out: ' + document.body.textContent);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };
    const select = title => {
      const tab = [...document.querySelectorAll('span')].find(node => node.textContent === title);
      if (!tab) throw new Error('Missing tab: ' + title);
      tab.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0}));
    };
    select('Text B Document');
    await wait(() => {
      const failure = document.querySelector('[aria-label="Text B Text Document"] [role="alert"]');
      if (failure) throw new Error(failure.textContent + ' (runtime=' + typeof window.breaditorMonaco + ', base=' + document.baseURI + ')');
      return window.breaditorMonaco?.editor.getEditors().length === 1;
    });
    const monaco = window.breaditorMonaco;
    let view = monaco.editor.getEditors()[0];
    const model = view.getModel();
    const text = model.getValue();
    const language = model.getLanguageId();
    const rect = document.querySelector('.monaco-editor').getBoundingClientRect();
    const accessor = await monaco.json.getWorker();
    const worker = await accessor(model.uri);
    const cleanDiagnostics = await worker.doValidation(model.uri.toString());
    view.setPosition({lineNumber: 5, column: 2});
    view.executeEdits('smoke', [{range: model.getFullModelRange(), text: '{', forceMoveMarkers: true}]);
    const invalidDiagnostics = await worker.doValidation(model.uri.toString());
    await model.undo();
    const undoRestored = model.getValue() === text;
    view.setPosition({lineNumber: 5, column: 2});
    view.setScrollTop(120);
    const savedScrollTop = view.getScrollTop();
    select('Map A Document');
    await wait(() => !document.querySelector('[aria-label="Text B Text Document"]'));
    select('Text B Document');
    await wait(() => monaco.editor.getEditors().length === 1);
    view = monaco.editor.getEditors()[0];
    const preserved = view.getModel() === model && model.getValue() === text;
    const viewStatePreserved = view.getPosition().lineNumber === 5 && view.getPosition().column === 2 &&
      view.getScrollTop() === savedScrollTop;
    await wait(() => !document.querySelector('[aria-label="Text B Text Document"] [role="status"]'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      text, language, width: rect.width, height: rect.height,
      cleanDiagnostics, invalidDiagnostics,
      undoRestored, preserved, viewStatePreserved, uri: model.uri.toString(),
    };
  }.toString()})()`, true);
  assert.strictEqual(result.text.replace(/\r\n/g, '\n'), expected.replace(/\r\n/g, '\n'));
  assert.strictEqual(result.language, 'json');
  assert(result.width > 100 && result.height > 100, `Editor has no useful size: ${JSON.stringify(result)}`);
  assert.strictEqual(result.cleanDiagnostics.length, 0, JSON.stringify(result.cleanDiagnostics.slice(0, 2)));
  assert(result.invalidDiagnostics.length > 0, 'JSON worker did not validate invalid text');
  assert(result.undoRestored && result.preserved, 'Tab switching lost text/model or undo failed');
  assert(result.viewStatePreserved, 'Tab switching lost cursor or scroll position');
  assert.deepStrictEqual(errors, []);
  fs.writeFileSync(path.join(root, `../monaco-${label}-smoke.png`), (await win.webContents.capturePage()).toPNG());
  const {text: _text, cleanDiagnostics, invalidDiagnostics, ...summary} = result;
  summary.cleanDiagnostics = cleanDiagnostics.length;
  summary.invalidDiagnostics = invalidDiagnostics.length;
  console.log(`${label}: ${JSON.stringify(summary)}`);
}

app.whenReady().then(async () => {
  const local = new BrowserWindow({show: false, width: 1200, height: 900, webPreferences: {
    contextIsolation: true, nodeIntegration: true, preload: path.join(root, 'preload.js'), backgroundThrottling: false,
  }});
  await local.loadFile(path.join(root, 'index.html'));
  await exercise(local, 'file');
  local.destroy();

  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const mime = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.html': 'text/html'};
    fs.readFile(filename, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, {'Content-Type': mime[path.extname(filename)] || 'application/octet-stream'}).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = new BrowserWindow({show: false, width: 1200, height: 900, webPreferences: {
    contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
  }});
  await browser.loadURL(`http://127.0.0.1:${server.address().port}/index.html`);
  await exercise(browser, 'http');
  browser.destroy();
  server.close();
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => {
  console.error(error);
  server?.close();
  clearTimeout(deadline);
  app.exit(1);
});
