/** @jest-environment jsdom */
import {fileURLToPath} from 'url';

const watchFile = jest.fn();
const unwatchFile = jest.fn();
let watchMapFiles: (urls: string[], onChange: (changed: string[]) => void) => () => void;
const json = 'file:///D:/Map%20Files/farmsville.map.json';
const data = 'file:///D:/Map%20Files/farmsville.map.data.json';
const image = 'file:///D:/Map%20Files/tiles.png';
const before = {mtimeMs: 1, ctimeMs: 1, size: 100, ino: 12, nlink: 1};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  watchFile.mockReset();
  unwatchFile.mockReset();
  jest.doMock('fs', () => ({watchFile, unwatchFile}));
  watchMapFiles = require('./watchMapFiles').watchMapFiles;
});

afterEach(() => {
  window.dispatchEvent(new Event('unload'));
  jest.useRealTimers();
});

function changed(url: string, stats = {...before, mtimeMs: 2}) {
  const [, , listener] = watchFile.mock.calls.find(([file]) => file === fileURLToPath(url))!;
  listener(stats, before);
}

test('watches the local dependency closure once and batches all changed files across a save burst', () => {
  const callback = jest.fn();
  watchMapFiles([json, data, image, json, 'https://example.test/map.json'], callback);
  expect(watchFile).toHaveBeenCalledTimes(3);
  expect(watchFile).toHaveBeenCalledWith(fileURLToPath(json), {persistent: false, interval: 250}, expect.any(Function));
  changed(image);
  jest.advanceTimersByTime(100);
  changed(json);
  changed(image);
  changed(data);
  jest.advanceTimersByTime(149);
  expect(callback).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][0]).toEqual([image, json, data]);
  changed(image);
  jest.advanceTimersByTime(150);
  expect(callback).toHaveBeenLastCalledWith([image]);
});

test('replacement, disappearance and recreation trigger updates without requiring a changed mtime', () => {
  const callback = jest.fn();
  watchMapFiles([json], callback);
  changed(json, before);
  jest.advanceTimersByTime(150);
  expect(callback).not.toHaveBeenCalled();
  for (const stats of [{...before, ino: 99}, {...before, nlink: 0}, {...before, ctimeMs: 3}, {...before, size: 200}]) {
    changed(json, stats);
    jest.advanceTimersByTime(150);
  }
  expect(callback).toHaveBeenCalledTimes(4);
});

test('stopping cancels pending updates and detaches only this subscription once', () => {
  const callback = jest.fn();
  const stop = watchMapFiles([json, image], callback);
  changed(json);
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

test('renderer unload cancels pending delivery and removes every owned watch', () => {
  const callback = jest.fn();
  watchMapFiles([json, data, image], callback);
  changed(data);
  window.dispatchEvent(new Event('unload'));
  jest.advanceTimersByTime(1000);
  expect(unwatchFile).toHaveBeenCalledTimes(3);
  expect(callback).not.toHaveBeenCalled();
});

test('independent documents watching the same file retain independent listeners', () => {
  const first = jest.fn();
  const second = jest.fn();
  const stopFirst = watchMapFiles([json], first);
  const stopSecond = watchMapFiles([json], second);
  stopFirst();
  const [, , firstListener] = watchFile.mock.calls[0];
  const [, , secondListener] = watchFile.mock.calls[1];
  expect(unwatchFile).toHaveBeenCalledWith(fileURLToPath(json), firstListener);
  expect(unwatchFile).not.toHaveBeenCalledWith(fileURLToPath(json), secondListener);
  secondListener({...before, mtimeMs: 2}, before);
  jest.advanceTimersByTime(150);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith([json]);
  stopSecond();
});
