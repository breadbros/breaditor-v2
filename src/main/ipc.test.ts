/** @jest-environment jsdom */
const showOpenDialog = jest.fn();
const quit = jest.fn();
let settings: Record<string, string> | undefined;
let appHandlers: Record<string, (...args: any[]) => any>;
let mainHandlers: Record<string, (...args: any[]) => any>;
let rendererHandlers: Record<string, (...args: any[]) => any>;
let api: {
  appClose: () => void;
  appMinimize: () => void;
  appMaximize: () => void;
  openFileDialog: (options: any) => void;
};
let windows: any[];
let BrowserWindow: any;
let sender: {send: jest.Mock};

beforeEach(() => {
  jest.resetModules();
  showOpenDialog.mockReset();
  quit.mockReset();
  settings = {};
  appHandlers = {};
  mainHandlers = {};
  rendererHandlers = {};
  windows = [];
  document.body.innerHTML = '<div id="react-root"></div>';
  sender = {send: jest.fn((channel, message) => rendererHandlers[channel]({}, message))};
  BrowserWindow = jest.fn(() => {
    const windowMock = {
      setMenu: jest.fn(), loadFile: jest.fn(), on: jest.fn(),
      minimize: jest.fn(), maximize: jest.fn(), unmaximize: jest.fn(),
      isMaximized: jest.fn(() => false), close: jest.fn(),
      setPosition: jest.fn(), setSize: jest.fn(),
      webContents: {
        setDevToolsWebContents: jest.fn(), openDevTools: jest.fn(), once: jest.fn(),
      },
    };
    windows.push(windowMock);
    return windowMock;
  });
  BrowserWindow.getAllWindows = () => windows;
  jest.doMock('electron', () => ({
    BrowserWindow,
    app: {on: (name: string, callback: (...args: any[]) => any) => {appHandlers[name] = callback;}, quit},
    ipcMain: {on: (name: string, callback: (...args: any[]) => any) => {mainHandlers[name] = callback;}},
    session: {defaultSession: {webRequest: {onHeadersReceived: jest.fn()}}},
    dialog: {showOpenDialog},
    contextBridge: {exposeInMainWorld: (_name: string, value: typeof api) => {api = value;}},
    ipcRenderer: {
      send: (channel: string, options: any) => mainHandlers[channel]({sender}, options),
      on: (name: string, callback: (...args: any[]) => any) => {rendererHandlers[name] = callback;},
    },
  }));
  jest.doMock('dotenv', () => ({config: () => ({parsed: settings})}));
});

async function boot() {
  require('./main');
  require('./preload/preload.js');
  await appHandlers.ready();
}

async function settleDialog() {
  await Promise.resolve();
  await Promise.resolve();
}

test('Electron startup works without an env file and loads the renderer and preload', async () => {
  settings = undefined;
  await boot();
  expect(BrowserWindow).toHaveBeenCalledTimes(1);
  expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
    frame: false,
    webPreferences: expect.objectContaining({
      contextIsolation: true,
      preload: expect.stringMatching(/[\\/]app[\\/]preload\.js$/),
    }),
  }));
  expect(windows[0].loadFile).toHaveBeenCalledWith('dist/app/index.html');
  expect(windows[0].setMenu).toHaveBeenCalledWith(null);
});

test('development startup connects the detached inspector', async () => {
  settings = {BREADITOR_DEV_MODE: 'true'};
  await boot();
  expect(windows).toHaveLength(2);
  expect(windows[0].webContents.setDevToolsWebContents).toHaveBeenCalledWith(windows[1].webContents);
  expect(windows[0].webContents.openDevTools).toHaveBeenCalledWith({mode: 'detach'});
});

test('preload window commands reach the native window', async () => {
  await boot();
  api.appMinimize();
  api.appMaximize();
  windows[0].isMaximized.mockReturnValue(true);
  api.appMaximize();
  api.appClose();
  expect(windows[0].minimize).toHaveBeenCalledTimes(1);
  expect(windows[0].maximize).toHaveBeenCalledTimes(1);
  expect(windows[0].unmaximize).toHaveBeenCalledTimes(1);
  expect(windows[0].close).toHaveBeenCalledTimes(1);
});

test('dialog options reach Electron intact and the selected path reaches the renderer', async () => {
  await boot();
  const received = jest.fn();
  document.getElementById('react-root')!.addEventListener('OPEN_FILE_SUCCESS', received);
  showOpenDialog.mockResolvedValue({canceled: false, filePaths: ['/maps/example.txt']});
  const options = {properties: ['openFile'], title: 'Open map'};
  api.openFileDialog(options);
  await settleDialog();

  expect(showOpenDialog).toHaveBeenCalledWith(options);
  expect(received).toHaveBeenCalledTimes(1);
  expect(received.mock.calls[0][0].detail).toEqual({filePath: '/maps/example.txt'});
  expect(sender.send).toHaveBeenCalledWith('OPEN_FILE_SUCCESS', {
    type: 'OPEN_FILE_SUCCESS', payload: '/maps/example.txt',
  });
});

test.each([
  {canceled: true, filePaths: []},
  {canceled: false, filePaths: []},
])('an empty or canceled dialog notifies the renderer: %j', async result => {
  await boot();
  const received = jest.fn();
  document.getElementById('react-root')!.addEventListener('OPEN_FILE_CANCELLED', received);
  showOpenDialog.mockResolvedValue(result);
  api.openFileDialog({properties: ['openFile']});
  await settleDialog();
  expect(received).toHaveBeenCalledTimes(1);
  expect(sender.send).toHaveBeenCalledTimes(1);
  expect(sender.send).toHaveBeenCalledWith('OPEN_FILE_CANCELLED', {type: 'OPEN_FILE_CANCELLED'});
});

test('dialog rejection reaches the renderer as a failure', async () => {
  await boot();
  const received = jest.fn();
  document.getElementById('react-root')!.addEventListener('OPEN_FILE_FAILURE', received);
  const error = new Error('Permission denied');
  showOpenDialog.mockRejectedValue(error);
  api.openFileDialog({properties: ['openFile']});
  await settleDialog();
  expect(received).toHaveBeenCalledTimes(1);
  expect(received.mock.calls[0][0].detail.filePath).toBe(error);
  expect(sender.send).toHaveBeenCalledWith('OPEN_FILE_FAILURE', {
    type: 'OPEN_FILE_FAILURE', payload: error,
  });
});

export {};
