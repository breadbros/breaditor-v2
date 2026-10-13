const {EventEmitter} = require('events');
const {setImmediate: immediate} = require('timers');
const {createDevelopment} = require('./dev');

const settle = () => new Promise(resolve => immediate(resolve));
let development;
let changed;
let build;
let launch;

async function start() {
  build = jest.fn(async () => {});
  launch = jest.fn(() => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.connected = true;
    child.send = jest.fn();
    child.kill = jest.fn(() => {
      child.signalCode = 'SIGTERM';
      child.emit('exit', null, 'SIGTERM');
      return true;
    });
    return child;
  });
  development = createDevelopment({
    build, launch, log: jest.fn(),
    watch: (_root, callback) => { changed = callback; return jest.fn(); },
  });
  await development.ready;
  return launch.mock.results[0].value;
}

async function save(source = 'src/main/main.ts') {
  changed(source);
  jest.runOnlyPendingTimers();
  await settle();
}

beforeEach(() => jest.useFakeTimers({doNotFake: ['performance']}));
afterEach(async () => {
  if (development) await development.stop();
  development = undefined;
  jest.useRealTimers();
});

test('multiple successful saves leave the app alive until one reload request', async () => {
  const child = await start();
  await save();
  await save();
  expect(launch).toHaveBeenCalledTimes(1);
  expect(child.kill).not.toHaveBeenCalled();
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: true, restartRequired: true}, expect.any(Function));
  child.emit('message', {type: 'dev-reload'});
  child.emit('message', {type: 'dev-reload'});
  await settle();
  expect(build).toHaveBeenCalledTimes(3);
  expect(launch).toHaveBeenCalledTimes(2);
  expect(child.kill).toHaveBeenCalledTimes(1);
  const replacement = launch.mock.results[1].value;
  replacement.emit('message', {type: 'dev-update-check'});
  expect(replacement.send).toHaveBeenLastCalledWith({type: 'dev-update', available: false, restartRequired: false}, expect.any(Function));
});

test('renderer subscription recovers an update that arrived before it mounted', async () => {
  const child = await start();
  await save();
  child.send.mockClear();
  child.emit('message', {type: 'dev-update-check'});
  expect(child.send).toHaveBeenCalledWith({type: 'dev-update', available: true, restartRequired: true}, expect.any(Function));
});

test('rejects reload during debounce, during a build, and after failure', async () => {
  const child = await start();
  await save();
  let failBuild;
  build.mockImplementationOnce(() => new Promise((_resolve, reject) => { failBuild = reject; }));
  changed();
  child.emit('message', {type: 'dev-reload'});
  expect(child.kill).not.toHaveBeenCalled();
  jest.runOnlyPendingTimers();
  child.emit('message', {type: 'dev-reload'});
  expect(child.kill).not.toHaveBeenCalled();
  failBuild(new Error('Invalid source'));
  await settle();
  child.emit('message', {type: 'dev-reload'});
  await settle();
  expect(child.kill).not.toHaveBeenCalled();
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: false, restartRequired: true}, expect.any(Function));
  await save();
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: true, restartRequired: true}, expect.any(Function));
});

test('waits for edits during a build before offering the update', async () => {
  const child = await start();
  let finishBuild;
  build.mockImplementationOnce(() => new Promise(resolve => { finishBuild = resolve; }));
  changed();
  jest.runOnlyPendingTimers();
  changed();
  finishBuild();
  await settle();
  expect(build).toHaveBeenCalledTimes(3);
  expect(child.send.mock.calls.filter(([message]) => message.available)).toHaveLength(1);
  expect(child.kill).not.toHaveBeenCalled();
});

test('rebuilds edits arriving while a requested restart waits for the old app to exit', async () => {
  const child = await start();
  await save();
  child.kill.mockImplementation(() => true);
  child.emit('message', {type: 'dev-reload'});
  changed();
  child.signalCode = 'SIGTERM';
  child.emit('exit', null, 'SIGTERM');
  await settle();
  expect(build).toHaveBeenCalledTimes(3);
  expect(launch).toHaveBeenCalledTimes(2);
});

test.each([
  'src/app/index.tsx',
  'src/app/style.module.css',
  'src/app/index.html',
  'src/main/preload/preload.js',
  'src\\app\\ui\\DevelopmentUpdateToast.tsx',
])('reloads %s in the existing app process', async source => {
  const child = await start();
  await save(source);
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: true, restartRequired: false}, expect.any(Function));
  child.emit('message', {type: 'dev-reload'});
  child.emit('message', {type: 'dev-reload'});
  await settle();
  expect(child.send.mock.calls.filter(([message]) => message.type === 'dev-reload-renderer')).toHaveLength(1);
  expect(launch).toHaveBeenCalledTimes(1);
  expect(child.kill).not.toHaveBeenCalled();
  child.emit('message', {type: 'dev-update-check'});
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: false, restartRequired: false}, expect.any(Function));
  await save(source);
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: true, restartRequired: false}, expect.any(Function));
});

test.each(['src/main/main.ts', 'src/shared/reducer/reducer.inc.ts', '.env', 'tsconfig.json', 'build-infrastructure/esbuild.js', undefined])(
  'retains a pending restart for %s across later renderer builds', async source => {
    const child = await start();
    changed(source);
    jest.runOnlyPendingTimers();
    await settle();
    await save('src/app/index.tsx');
    expect(child.send).toHaveBeenLastCalledWith({type: 'dev-update', available: true, restartRequired: true}, expect.any(Function));
    child.emit('message', {type: 'dev-reload'});
    await settle();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledTimes(2);
  },
);

test('a failed renderer build cannot be reloaded and recovery still reloads in place', async () => {
  const child = await start();
  await save('src/app/index.tsx');
  build.mockRejectedValueOnce(new Error('Invalid renderer'));
  await save('src/app/index.tsx');
  child.emit('message', {type: 'dev-reload'});
  expect(child.send.mock.calls.some(([message]) => message.type === 'dev-reload-renderer')).toBe(false);
  await save('src/app/index.tsx');
  child.emit('message', {type: 'dev-reload'});
  expect(child.send).toHaveBeenLastCalledWith({type: 'dev-reload-renderer'}, expect.any(Function));
  expect(child.kill).not.toHaveBeenCalled();
});
