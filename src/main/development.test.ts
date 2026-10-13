/** @jest-environment jsdom */
import {EventEmitter} from 'events';

test('development updates cross the main/preload bridge and subscriptions clean up', () => {
  jest.resetModules();
  const main = new EventEmitter();
  const renderer = new EventEmitter();
  const sendToParent = jest.fn();
  const originalSend = process.send;
  const originalConnected = process.connected;
  const originalListeners = process.listeners('message');
  let api: any;
  const webContents = {
    send: jest.fn((channel, ...values) => renderer.emit(channel, {}, ...values)),
    reload: jest.fn(),
  };
  const window = {webContents, isDestroyed: jest.fn(() => false)};
  const ipcSend = jest.fn((channel) => main.emit(channel, {sender: webContents}));
  jest.doMock('electron', () => ({
    ipcMain: main,
    ipcRenderer: {on: renderer.on.bind(renderer), removeListener: renderer.removeListener.bind(renderer), send: ipcSend},
    contextBridge: {exposeInMainWorld: (_name: string, value: any) => { api = value; }},
  }));
  process.send = sendToParent;
  process.connected = true;
  try {
    require('./development').connectDevelopment(() => window);
    require('./preload/preload.js');
    const notify = jest.fn();
    const unsubscribe = api.onDevelopmentUpdate(notify);
    expect(sendToParent).toHaveBeenCalledWith({type: 'dev-update-check'}, expect.any(Function));

    process.emit('message', {type: 'dev-update', available: true}, undefined);
    expect(notify).toHaveBeenLastCalledWith(true, false);
    expect(sendToParent).not.toHaveBeenCalledWith({type: 'dev-reload'}, expect.any(Function));
    api.reloadDevelopment();
    expect(sendToParent).toHaveBeenLastCalledWith({type: 'dev-reload'}, expect.any(Function));
    expect(webContents.reload).not.toHaveBeenCalled();
    process.emit('message', {type: 'dev-reload-renderer'}, undefined);
    expect(webContents.reload).toHaveBeenCalledTimes(1);

    process.emit('message', {type: 'dev-update', available: false}, undefined);
    expect(notify).toHaveBeenLastCalledWith(false, false);
    process.emit('message', {type: 'dev-update', available: true, restartRequired: true}, undefined);
    expect(notify).toHaveBeenLastCalledWith(true, true);
    unsubscribe();
    process.emit('message', {type: 'dev-update', available: true}, undefined);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(renderer.listenerCount('dev-update')).toBe(0);

    sendToParent.mockClear();
    main.emit('dev-reload', {sender: {}});
    expect(sendToParent).not.toHaveBeenCalled();
    process.connected = false;
    api.reloadDevelopment();
    expect(sendToParent).not.toHaveBeenCalled();

    webContents.send.mockClear();
    window.isDestroyed.mockReturnValue(true);
    process.emit('message', {type: 'dev-update', available: true}, undefined);
    process.emit('message', {type: 'dev-reload-renderer'}, undefined);
    expect(webContents.reload).toHaveBeenCalledTimes(1);
    window.isDestroyed.mockReturnValue(false);
    process.emit('message', {type: 'unrelated', available: true}, undefined);
    process.emit('message', {type: 'dev-update', available: 'invalid'}, undefined);
    expect(webContents.send).not.toHaveBeenCalled();
  } finally {
    process.send = originalSend;
    process.connected = originalConnected;
    for (const listener of process.listeners('message')) {
      if (!originalListeners.includes(listener)) (process as EventEmitter).removeListener('message', listener);
    }
  }
});

test('ordinary app launches do not register development IPC handlers', () => {
  jest.resetModules();
  const on = jest.fn();
  jest.doMock('electron', () => ({ipcMain: {on}}));
  const originalSend = process.send;
  process.send = undefined;
  try {
    require('./development').connectDevelopment(() => undefined);
    expect(on).not.toHaveBeenCalled();
  } finally {
    process.send = originalSend;
  }
});
