/** @jest-environment jsdom */
import {loadMapViewport, saveMapViewport, loadMapZoom, saveMapZoom} from './mapZoomStorage';

const source = 'file:///maps/demo.map.json';
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('stores independent complete viewports for individual map files', () => {
  const first = {x: -12.5, y: 0, zoom: 2.5}, second = {x: 640, y: 320.25, zoom: 0.5};
  saveMapViewport(source, first);
  saveMapViewport('file:///other/demo.map.json', second);
  expect(loadMapViewport(source)).toEqual(first);
  expect(loadMapViewport('file:///other/demo.map.json')).toEqual(second);
  expect(loadMapZoom(source)).toBe(first.zoom);
});

test('keeps legacy zoom-only preferences available until a full viewport is saved', () => {
  saveMapZoom(source, 3);
  expect(loadMapViewport(source)).toBeNull();
  expect(loadMapZoom(source)).toBe(3);
  saveMapViewport(source, {x: 75, y: -150, zoom: 2});
  expect(loadMapZoom(source)).toBe(2);
  saveMapZoom(source, 1);
  expect(loadMapViewport(source)).toEqual({x: 75, y: -150, zoom: 1});
});

test('shares viewports across native Windows paths and file URLs', () => {
  saveMapViewport('D:\\maps\\Map A.map.json', {x: 10, y: 20, zoom: 1});
  expect(loadMapViewport('file:///D:/maps/Map%20A.map.json')).toEqual({x: 10, y: 20, zoom: 1});
});

test('does not give untitled maps a shared persistent viewport', () => {
  saveMapViewport('', {x: 1, y: 2, zoom: 3});
  expect(loadMapViewport('')).toBeNull();
  expect(localStorage.length).toBe(0);
});

test.each(['invalid', 'null', '[]', '{"zoom":2}', '{"x":"1","y":2,"zoom":2}',
  '{"x":1e999,"y":2,"zoom":2}', '{"x":1,"y":null,"zoom":2}', '{"x":1,"y":2,"zoom":0}'])('ignores invalid viewport data: %s', raw => {
  localStorage.setItem('breaditor.mapViewport.v1.' + source, raw);
  expect(loadMapViewport(source)).toBeNull();
});

test('invalid coordinates cannot replace a valid saved viewport', () => {
  const camera = {x: 1, y: 2, zoom: 3}; saveMapViewport(source, camera);
  saveMapViewport(source, {...camera, x: NaN});
  saveMapViewport(source, {...camera, y: Infinity});
  expect(loadMapViewport(source)).toEqual(camera);
});

test('unavailable storage leaves camera changes usable', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('blocked');});
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('full');});
  expect(loadMapViewport(source)).toBeNull();
  expect(() => saveMapViewport(source, {x: 1, y: 2, zoom: 3})).not.toThrow();
});
