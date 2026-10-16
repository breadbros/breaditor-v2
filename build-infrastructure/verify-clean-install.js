// Retain an isolated working-tree snapshot and its dependency cache for inspection.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

function yarnEntry() {
  if (/yarn\.(?:c?js)$/i.test(process.env.npm_execpath || '')) return process.env.npm_execpath;
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    for (const candidate of [path.join(directory, 'yarn.js'), path.join(directory, 'node_modules/yarn/bin/yarn.js'), path.join(directory, '../lib/node_modules/yarn/bin/yarn.js')]) {
      if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
    }
  }
  throw new Error('Run this verification with yarn verify:clean.');
}
function run(command, args, cwd, extra = {}) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', ...extra});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} ${args.join(' ')} failed (${result.status ?? result.signal}).`);
}
const source = path.resolve(__dirname, '..');
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Clean-install verification requires Node 22 or newer.');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'breaditor-clean-install-'));
const checkout = path.join(output, 'checkout');
const yarn = yarnEntry();
console.log(`Clean-install verification: ${output}`);
try {
  const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: source, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (listing.status !== 0) throw new Error('Could not enumerate the source working tree.');
  for (const relative of new Set(listing.stdout.split('\0').filter(Boolean))) {
    const destination = path.resolve(checkout, relative);
    if (!destination.startsWith(checkout + path.sep)) throw new Error(`Source path escapes the checkout: ${relative}`);
    const origin = path.join(source, relative);
    if (fs.lstatSync(origin).isSymbolicLink()) throw new Error(`Clean snapshot requires a real source file: ${relative}`);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(origin, destination);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(checkout, 'package.json'), 'utf8'));
  for (const name of ['crustacean-map-lib', 'crustacean-sprite-lib']) {
    if (!/^git\+https:\/\/github\.com\/[^#]+#[0-9a-f]{40}$/.test(pkg.dependencies[name] || ''))
      throw new Error(`${name} must use an immutable HTTPS Git commit.`);
  }
  const lock = fs.readFileSync(path.join(checkout, 'yarn.lock'));
  if (/file:\.\.\//.test(lock.toString('utf8'))) throw new Error('The lockfile still contains a sibling dependency.');
  const environment = {...process.env};
  delete environment.NODE_PATH;
  environment.GIT_TERMINAL_PROMPT = '0';
  const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path') || 'PATH';
  environment[pathKey] = path.dirname(process.execPath) + path.delimiter + (environment[pathKey] || '');
  const gitConfigCount = Number(environment.GIT_CONFIG_COUNT || 0);
  environment[`GIT_CONFIG_KEY_${gitConfigCount}`] = 'protocol.ssh.allow';
  environment[`GIT_CONFIG_VALUE_${gitConfigCount}`] = 'never';
  environment.GIT_CONFIG_COUNT = String(gitConfigCount + 1);
  const invoke = args => run(process.execPath, [yarn, ...args], checkout, {env: environment});
  invoke(['install', '--frozen-lockfile', '--non-interactive', '--cache-folder', path.join(output, 'yarn-cache')]);
  if (!lock.equals(fs.readFileSync(path.join(checkout, 'yarn.lock')))) throw new Error('Frozen installation changed yarn.lock.');
  invoke(['tsc', '--noEmit']);
  invoke(['pre-build']);
  run(process.execPath, ['build-infrastructure/sully-assets.js', '--verify', 'dist/app/assets/sully'], checkout, {env: environment});
  invoke(['pre-test']);
  invoke(['test', '--silent']);
  console.log(JSON.stringify({verified: true, node: process.versions.node, checkout, siblingProjects: false, cache: path.join(output, 'yarn-cache')}));
} catch (error) {
  console.error(`Clean-install verification failed. Retained checkout: ${checkout}`);
  console.error(error.stack || error);
  process.exitCode = 1;
}
