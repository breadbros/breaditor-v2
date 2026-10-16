/** @jest-environment jsdom */
import {EventEmitter} from 'events';

afterEach(() => jest.restoreAllMocks());

test.each([false, true])('passes the dev menu flag through main and preload when packaged=%s', async isPackaged => {
  jest.resetModules();
  const app = Object.assign(new EventEmitter(), {isPackaged});
  const constructor = jest.fn(() => ({
    setMenu: jest.fn(), loadFile: jest.fn(), on: jest.fn(),
    webContents: {on: jest.fn()},
  }));
  let api: any;
  jest.doMock('electron', () => ({
    app, BrowserWindow: constructor,
    ipcMain: {handle: jest.fn(), on: jest.fn()},
    ipcRenderer: {on: jest.fn()},
    contextBridge: {exposeInMainWorld: (_name: string, value: any) => {api = value;}},
    session: {defaultSession: {webRequest: {onHeadersReceived: jest.fn()}}},
  }));
  jest.doMock('dotenv', () => ({config: () => ({parsed: {}})}));
  const send = process.send;
  const argv = process.argv;
  process.send = undefined;
  try {
    require('./main');
    app.emit('ready');
    const args = constructor.mock.calls[0] as unknown as [{webPreferences: {additionalArguments: string[]}}];
    process.argv = ['electron', ...args[0].webPreferences.additionalArguments];
    require('./preload/preload.js');
    expect(api.isDevelopment).toBe(!isPackaged);
  } finally {process.send = send; process.argv = argv;}
});
