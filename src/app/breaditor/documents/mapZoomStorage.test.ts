/** @jest-environment jsdom */
import {loadMapZoom, saveMapZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM} from './mapZoomStorage';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('stores independent zoom values by file rather than name or document ID', () => {
  saveMapZoom('file:///maps/one/demo.map.json', 2.5);
  saveMapZoom('file:///maps/two/demo.map.json', 0.5);
  expect(loadMapZoom('file:///maps/one/demo.map.json')).toBe(2.5);
  expect(loadMapZoom('file:///maps/two/demo.map.json')).toBe(0.5);
  expect(loadMapZoom('file:///maps/new.map.json')).toBeNull();
});

test('native Windows paths and file URLs refer to the same zoom setting', () => {
  saveMapZoom('D:\\maps\\Map A.map.json', 3);
  expect(loadMapZoom('file:///D:/maps/Map%20A.map.json')).toBe(3);
});

test('relative and absolute references refer to the same map', () => {
  saveMapZoom('assets/demo.map.json', 0.75);
  expect(loadMapZoom(new URL('assets/demo.map.json', document.baseURI).href)).toBe(0.75);
});

test('unsaved maps have no shared zoom setting', () => {
  saveMapZoom('', 4);
  expect(loadMapZoom('')).toBeNull();
  expect(localStorage.length).toBe(0);
});

test.each(['bad json', 'null', '"2"', '0', '-1', '17', '1e999', '{}'])('ignores invalid stored zoom: %s', raw => {
  localStorage.setItem('breaditor.mapZoom.v1.file:///maps/demo.map.json', raw);
  expect(loadMapZoom('file:///maps/demo.map.json')).toBeNull();
});

test.each([MIN_MAP_ZOOM, MAX_MAP_ZOOM])('accepts the existing zoom limit %s', zoom => {
  saveMapZoom('file:///maps/demo.map.json', zoom);
  expect(loadMapZoom('file:///maps/demo.map.json')).toBe(zoom);
});

test('does not replace a valid preference with invalid zoom', () => {
  saveMapZoom('file:///maps/demo.map.json', 2);
  for (const zoom of [NaN, Infinity, -1, 0, 17]) saveMapZoom('file:///maps/demo.map.json', zoom);
  expect(loadMapZoom('file:///maps/demo.map.json')).toBe(2);
});

test('unavailable storage does not break opening or zooming a map', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('blocked');});
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('full');});
  expect(loadMapZoom('file:///maps/demo.map.json')).toBeNull();
  expect(() => saveMapZoom('file:///maps/demo.map.json', 2)).not.toThrow();
});
