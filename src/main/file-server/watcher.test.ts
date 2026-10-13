const capabilityCheck = jest.fn();
const command = jest.fn();
let watcher: typeof import('./watcher');

beforeEach(() => {
  jest.resetModules();
  capabilityCheck.mockReset();
  command.mockReset();
  jest.doMock('fb-watchman', () => ({
    Client: jest.fn(() => ({capabilityCheck, command})),
  }));
  watcher = require('./watcher');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function initialize() {
  watcher.initialize();
  capabilityCheck.mock.calls[0][1](null, {});
}

test('rejects watches before initialization', () => {
  expect(() => watcher.watch('/project')).toThrow('Watchman Client not initialized');
  expect(command).not.toHaveBeenCalled();
});

test('initialization requests a capability check', () => {
  watcher.initialize();
  expect(capabilityCheck).toHaveBeenCalledWith(
    {optional: [], required: []}, expect.any(Function),
  );
});

test('failed initialization surfaces the error and keeps watches disabled', () => {
  watcher.initialize();
  const error = new Error('Watchman unavailable');
  expect(() => capabilityCheck.mock.calls[0][1](error)).toThrow(error);
  expect(() => watcher.watch('/project')).toThrow('Watchman Client not initialized');
});

test('watches the requested path and rejects duplicates after success', () => {
  initialize();
  watcher.watch('/project/subdir');
  expect(command).toHaveBeenCalledWith(
    ['watch-project', '/project/subdir'], expect.any(Function),
  );
  command.mock.calls[0][1](null, {watch: '/project', relative_path: 'subdir'});
  expect(() => watcher.watch('/project/subdir')).toThrow("already watching '/project/subdir'");
  expect(command).toHaveBeenCalledTimes(1);
  watcher.watch('/other-project');
  expect(command).toHaveBeenCalledTimes(2);
});

test('failed watches log the error and can be retried', () => {
  initialize();
  watcher.watch('/project');
  const error = new Error('Permission denied');
  command.mock.calls[0][1](error);
  expect(console.error).toHaveBeenCalledWith('Error initiating watch:', error);
  watcher.watch('/project');
  expect(command).toHaveBeenCalledTimes(2);
});

test('reports Watchman warnings and consolidated watch paths', () => {
  initialize();
  watcher.watch('/project/subdir');
  command.mock.calls[0][1](null, {
    watch: '/project', relative_path: 'subdir', warning: 'Recrawled',
  });
  expect(console.log).toHaveBeenCalledWith('warning: ', 'Recrawled');
  expect(console.log).toHaveBeenCalledWith(
    'watch established on ', '/project', ' relative_path', 'subdir',
  );
});

export {};
