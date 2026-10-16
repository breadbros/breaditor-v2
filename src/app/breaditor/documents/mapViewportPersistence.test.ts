/** @jest-environment jsdom */
import {waitFor} from '@testing-library/react';
import {createEmptyMap, loadMap} from 'crustacean-map-lib';
import {MapDocument, mapMaker} from './MapDocument';
import {getMapEditorSession, disposeMapEditorSession} from './mapEditorSession';
import {loadMapViewport, saveMapViewport, saveMapZoom} from './mapZoomStorage';

jest.mock('crustacean-map-lib', () => ({...jest.requireActual('crustacean-map-lib'), loadMap: jest.fn()}));
const source = 'file:///maps/demo.map.json', copy = 'file:///maps/copy.map.json';
const docs: MapDocument[] = [];
const originalAPI = window.electronAPI;
beforeEach(() => {
  localStorage.clear();
  (loadMap as jest.Mock).mockImplementation(async () => createEmptyMap());
  window.electronAPI = {saveMapFiles: jest.fn(async () => ({url: copy, dataUrl: 'file:///maps/copy.map.data.json',
    contentRootUrl: 'file:///maps/', map: JSON.stringify(createEmptyMap().map), hashes: {}, journal: 'file:///journal.json'}))};
});
afterEach(() => {docs.splice(0).forEach(disposeMapEditorSession); window.electronAPI = originalAPI; jest.restoreAllMocks();});
async function open(filepath = source) {
  const doc = mapMaker('Demo', filepath); docs.push(doc);
  const session = getMapEditorSession(doc);
  await waitFor(() => expect(session.loading).toBe(false));
  return {doc, session};
}

test('restores pan position and zoom into a new session for the same file', async () => {
  const {doc, session} = await open();
  session.fitted = true; session.camera = {x: 157.25, y: -42, zoom: 2}; session.notify();
  disposeMapEditorSession(doc);
  const reopened = (await open()).session;
  expect(reopened.camera).toEqual({x: 157.25, y: -42, zoom: 2});
  expect(reopened.initialViewport).toEqual(reopened.camera);
  expect((await open('file:///other/demo.map.json')).session.initialViewport).toBeNull();
});

test('persists panning at unchanged zoom, including in-place camera mutations', async () => {
  const {session} = await open();
  session.fitted = true; session.camera = {x: 0, y: 0, zoom: 2}; session.notify();
  const write = jest.spyOn(Storage.prototype, 'setItem');
  session.camera.x = 123.5; session.camera.y = 456; session.notify();
  expect(loadMapViewport(source)).toEqual({x: 123.5, y: 456, zoom: 2});
  session.paused = true; session.notify();
  expect(write).toHaveBeenCalledTimes(1);
  expect(session.dirty).toBe(false);
});

test('loading notifications do not overwrite a saved viewport', async () => {
  const camera = {x: 500, y: 750, zoom: 3}; saveMapViewport(source, camera);
  const {session} = await open();
  session.camera = {x: 0, y: 0, zoom: 1}; session.notify();
  expect(loadMapViewport(source)).toEqual(camera);
});

test('legacy zoom-only entries retain the initial fit path', async () => {
  saveMapZoom(source, 3);
  const {session} = await open();
  expect(session.initialViewport).toBeNull();
  expect(session.initialZoom).toBe(3);
  expect(session.fitted).toBe(false);
});

test('Save As copies the viewport and later pans affect only the new file', async () => {
  const {session} = await open();
  const original = {x: 150, y: 250, zoom: 2};
  session.fitted = true; session.camera = {...original}; session.notify();
  await session.save(true);
  expect(loadMapViewport(copy)).toEqual(original);
  session.camera.x = 300; session.notify();
  expect(loadMapViewport(source)).toEqual(original);
  expect(loadMapViewport(copy)).toEqual({...original, x: 300});
});
