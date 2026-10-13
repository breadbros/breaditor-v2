const {EventEmitter} = require('events');
const {setImmediate: immediate} = require('timers');
const {createDevelopment} = require('./dev');

const settle = () => new Promise(resolve => immediate(resolve));

function appProcess() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = jest.fn(() => {
    child.signalCode = 'SIGTERM';
    child.emit('exit', null, 'SIGTERM');
    return true;
  });
  return child;
}

describe('development rebuilds', () => {
  let development;
  let changed;
  let build;
  let launch;
  let closeWatchers;

  function start(overrides = {}) {
    build = overrides.build || jest.fn(async () => {});
    launch = jest.fn(appProcess);
    closeWatchers = jest.fn();
    development = createDevelopment({
      build, launch, log: jest.fn(),
      watch: (_root, callback) => {changed = callback; return closeWatchers;},
    });
    return development.ready;
  }

  beforeEach(() => jest.useFakeTimers({doNotFake: ['performance']}));
  afterEach(async () => {
    if (development) await development.stop();
    development = undefined;
    jest.useRealTimers();
  });

  test('launches the app only after the initial build succeeds', async () => {
    let finishBuild;
    const ready = start({build: jest.fn(() => new Promise(resolve => {finishBuild = resolve;}))});
    expect(launch).not.toHaveBeenCalled();
    finishBuild();
    await ready;
    expect(launch).toHaveBeenCalledTimes(1);
  });

  test('debounces save notifications and replaces only its own app process', async () => {
    await start();
    const oldApp = launch.mock.results[0].value;
    changed(); changed(); changed();
    jest.runOnlyPendingTimers();
    await settle();
    expect(build).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(oldApp.kill).toHaveBeenCalledTimes(1);
    expect(launch.mock.results[1].value.kill).not.toHaveBeenCalled();
  });

  test('serializes edits during a build and skips launching stale output', async () => {
    await start();
    let finishBuild;
    build.mockImplementationOnce(() => new Promise(resolve => {finishBuild = resolve;}));
    changed();
    jest.runOnlyPendingTimers();
    changed(); changed();
    expect(build).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenCalledTimes(1);
    finishBuild();
    await settle();
    expect(build).toHaveBeenCalledTimes(3);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  test('failed rebuilds preserve the running app and recover on the next save', async () => {
    await start();
    const oldApp = launch.mock.results[0].value;
    build.mockRejectedValueOnce(new Error('Invalid source'));
    changed();
    jest.runOnlyPendingTimers();
    await settle();
    expect(oldApp.kill).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledTimes(1);

    changed();
    jest.runOnlyPendingTimers();
    await settle();
    expect(launch).toHaveBeenCalledTimes(2);
    expect(oldApp.kill).toHaveBeenCalledTimes(1);
  });

  test('an initial build failure can recover without restarting the watcher', async () => {
    await start({build: jest.fn().mockRejectedValueOnce(new Error('Invalid source')).mockResolvedValue(undefined)});
    expect(launch).not.toHaveBeenCalled();
    changed();
    jest.runOnlyPendingTimers();
    await settle();
    expect(launch).toHaveBeenCalledTimes(1);
    expect(closeWatchers).not.toHaveBeenCalled();
  });

  test('stopping cancels queued saves, closes watchers, and terminates the app once', async () => {
    await start();
    const child = launch.mock.results[0].value;
    changed();
    await development.stop();
    changed();
    jest.runOnlyPendingTimers();
    await development.stop();
    expect(build).toHaveBeenCalledTimes(1);
    expect(closeWatchers).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  test('closing the app stops the watcher instead of silently relaunching it', async () => {
    await start();
    const child = launch.mock.results[0].value;
    child.exitCode = 0;
    child.emit('exit', 0);
    await settle();
    changed();
    jest.runOnlyPendingTimers();
    expect(closeWatchers).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('stopping during a build prevents a late app launch', async () => {
    let finishBuild;
    const ready = start({build: jest.fn(() => new Promise(resolve => {finishBuild = resolve;}))});
    const stopped = development.stop();
    expect(closeWatchers).toHaveBeenCalledTimes(1);
    finishBuild();
    await ready;
    await stopped;
    expect(launch).not.toHaveBeenCalled();
  });
});
