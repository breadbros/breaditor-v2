/** @jest-environment jsdom */
import {fileURLToPath} from 'url';

const watchFile = jest.fn();
const unwatchFile = jest.fn();
let watchSpriteFiles: typeof import('./watchSpriteFiles').watchSpriteFiles;
const json = 'file:///D:/Sprite%20Files/sprite.json';
const image = 'file:///D:/Sprite%20Files/image.png';
const before = {mtimeMs: 1, ctimeMs: 1, size: 100, ino: 12, nlink: 1};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  watchFile.mockReset();
  unwatchFile.mockReset();
  jest.doMock('fs', () => ({watchFile, unwatchFile}));
  watchSpriteFiles = require('./watchSpriteFiles').watchSpriteFiles;
});

afterEach(() => {
  window.dispatchEvent(new Event('unload'));
  jest.useRealTimers();
});

function changed(url: string, stats = {...before, mtimeMs: 2}) {
  const [, , listener] = watchFile.mock.calls.find(([file]) => file === fileURLToPath(url))!;
  listener(stats, before);
}

test('debounces save bursts and lets JSON changes take precedence over image changes', () => {
  const callback = jest.fn();
  watchSpriteFiles({json, image}, callback);
  expect(watchFile).toHaveBeenCalledWith(fileURLToPath(json), {persistent: false, interval: 250}, expect.any(Function));
  changed(image);
  changed(json);
  changed(image);
  expect(callback).not.toHaveBeenCalled();
  jest.advanceTimersByTime(150);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenLastCalledWith('json');
  changed(image);
  jest.advanceTimersByTime(150);
  expect(callback).toHaveBeenLastCalledWith('image');
});

test('detects replacement and disappearance even when modification time is unchanged', () => {
  const callback = jest.fn();
  watchSpriteFiles({json}, callback);
  changed(json, before);
  jest.advanceTimersByTime(150);
  expect(callback).not.toHaveBeenCalled();
  changed(json, {...before, ino: 99});
  jest.advanceTimersByTime(150);
  expect(callback).toHaveBeenCalledTimes(1);
  changed(json, {...before, nlink: 0});
  jest.advanceTimersByTime(150);
  expect(callback).toHaveBeenCalledTimes(2);
});

test('unsubscribing cancels queued updates and detaches only its own listeners', () => {
  const callback = jest.fn();
  const stop = watchSpriteFiles({json, image}, callback);
  changed(image);
  stop();
  stop();
  jest.advanceTimersByTime(1000);
  expect(callback).not.toHaveBeenCalled();
  expect(unwatchFile).toHaveBeenCalledTimes(2);
  for (const [file, , listener] of watchFile.mock.calls) {
    expect(unwatchFile).toHaveBeenCalledWith(file, listener);
    listener({...before, mtimeMs: 3}, before);
  }
  jest.advanceTimersByTime(1000);
  expect(callback).not.toHaveBeenCalled();
});

test('cleans up watches on renderer unload and ignores remote URLs', () => {
  watchSpriteFiles({json: 'https://example.test/sprite.json', image}, jest.fn());
  expect(watchFile).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('unload'));
  expect(unwatchFile).toHaveBeenCalledTimes(1);
});
