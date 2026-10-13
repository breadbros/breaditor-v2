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

test('real file edits rebuild assets and replace the app process without deleting dist', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'breaditor-dev-test-'));
  function write(file, content) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
  }
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  write('tsconfig.json', '{"compilerOptions":{"target":"es2017","jsx":"react"}}');
  write('build-infrastructure/esbuild.js', '// watched configuration');
  write('src/main/main.ts', 'console.log("main-first"); setInterval(() => {}, 1000);');
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
      const child = spawn(process.execPath, [path.join(root, 'dist/main/main.js')], {stdio: 'ignore'});
      children.push(child);
      return child;
    },
    log: message => messages.push(message),
  });
  try {
    await development.ready;
    expect(children).toHaveLength(1);
    expect(read('dist/app/index.js')).toContain('renderer-first');

    async function edit(file, content, output, expected) {
      const previous = children[children.length - 1];
      write(file, content);
      await waitFor(() => children[children.length - 1] !== previous);
      expect(previous.exitCode !== null || previous.signalCode !== null).toBe(true);
      if (output) expect(read(output)).toContain(expected);
    }

    await edit('src/app/index.tsx', 'import css from "./style.module.css"; console.log("renderer-second", css);', 'dist/app/index.js', 'renderer-second');
    await edit('src/app/style.module.css', '.panel { color: blue; }', 'dist/app/index.js', 'blue');
    await edit('src/app/index.html', '<div>html-second</div>', 'dist/app/index.html', 'html-second');
    await edit('src/main/preload/preload.js', 'console.log("preload-second");', 'dist/app/preload.js', 'preload-second');
    await edit('src/main/main.ts', 'console.log("main-second"); setInterval(() => {}, 1000);', 'dist/main/main.js', 'main-second');
    await edit('.env', 'BREADITOR_DEV_MODE=true');
    await edit('tsconfig.json', '{"compilerOptions":{"target":"es2018","jsx":"react"}}');

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
