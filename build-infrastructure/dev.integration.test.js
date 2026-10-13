const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');
const {createDevelopment, buildProject} = require('./dev');

async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for rebuild/restart');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('real file edits wait for reload and restart only for main-process or configuration changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'breaditor-dev-test-'));
  function write(file, content) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
  }
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const mainSource = label => `
    console.log("${label}");
    process.on('message', message => {
      if (message.type === 'dev-update') process.send({type: 'test-update', available: message.available});
      if (message.type === 'test-reload') process.send({type: 'dev-reload'});
      if (message.type === 'dev-reload-renderer') process.send({type: 'test-renderer-reloaded'});
    });
  `;
  write('tsconfig.json', '{"compilerOptions":{"target":"es2017","jsx":"react"}}');
  write('build-infrastructure/esbuild.js', '// watched configuration');
  write('src/main/main.ts', mainSource('main-first'));
  write('src/main/preload/preload.js', 'console.log("preload-first");');
  write('src/app/index.tsx', 'import css from "./style.module.css"; console.log("renderer-first", css);');
  write('src/app/style.module.css', '.panel { color: red; }');
  write('src/app/index.html', '<div>html-first</div>');
  write('dist/keep.txt', 'preserve this file');
  const children = [];
  const messages = [];
  const development = createDevelopment({
    root, build: () => buildProject(root), debounceMs: 50,
    launch: () => {
      const child = spawn(process.execPath, [path.join(root, 'dist/main/main.js')], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      child.rendererReloads = 0;
      child.on('message', message => {
        if (message.type === 'test-update') child.updateAvailable = message.available;
        if (message.type === 'test-renderer-reloaded') child.rendererReloads++;
      });
      children.push(child);
      return child;
    },
    log: message => messages.push(message),
  });
  try {
    await development.ready;
    expect(children).toHaveLength(1);
    expect(read('dist/app/index.js')).toContain('renderer-first');

    async function edit(file, content, output, expected, restart = false) {
      const previous = children[children.length - 1];
      const previousReloads = previous.rendererReloads;
      write(file, content);
      await waitFor(() => previous.updateAvailable === true);
      expect(children[children.length - 1]).toBe(previous);
      expect(previous.exitCode).toBeNull();
      expect(previous.signalCode).toBeNull();
      if (output) expect(read(output)).toContain(expected);
      previous.send({type: 'test-reload'});
      if (restart) {
        await waitFor(() => children[children.length - 1] !== previous);
        expect(previous.exitCode !== null || previous.signalCode !== null).toBe(true);
      } else {
        await waitFor(() => previous.rendererReloads === previousReloads + 1);
        expect(children[children.length - 1]).toBe(previous);
        expect(previous.exitCode).toBeNull();
        expect(previous.signalCode).toBeNull();
        expect(previous.updateAvailable).toBe(false);
      }
      if (output) expect(read(output)).toContain(expected);
    }

    await edit('src/app/index.tsx', 'import css from "./style.module.css"; console.log("renderer-second", css);', 'dist/app/index.js', 'renderer-second');
    await edit('src/app/style.module.css', '.panel { color: blue; }', 'dist/app/index.js', 'blue');
    await edit('src/app/index.html', '<div>html-second</div>', 'dist/app/index.html', 'html-second');
    await edit('src/main/preload/preload.js', 'console.log("preload-second");', 'dist/app/preload.js', 'preload-second');
    await edit('src/main/main.ts', mainSource('main-second'), 'dist/main/main.js', 'main-second', true);
    await edit('.env', 'BREADITOR_DEV_MODE=true', undefined, undefined, true);
    await edit('tsconfig.json', '{"compilerOptions":{"target":"es2018","jsx":"react"}}', undefined, undefined, true);

    const previous = children[children.length - 1];
    write('src/app/index.tsx', 'const broken = ;');
    await waitFor(() => messages.some(message => message.includes('Build failed')));
    expect(children[children.length - 1]).toBe(previous);
    expect(previous.exitCode).toBeNull();
    await edit('src/app/index.tsx', 'console.log("renderer-recovered");', 'dist/app/index.js', 'renderer-recovered');
    expect(read('dist/keep.txt')).toBe('preserve this file');
  } finally {
    await development.stop();
  }
  expect(children.every(child => child.exitCode !== null || child.signalCode !== null)).toBe(true);
}, 45000);
