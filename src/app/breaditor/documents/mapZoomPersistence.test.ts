/** @jest-environment jsdom */
import {waitFor} from '@testing-library/react';
import {createEmptyMap, loadMap} from 'crustacean-map-lib';
import {MapDocument, mapMaker} from './MapDocument';
import {getMapEditorSession, disposeMapEditorSession} from './mapEditorSession';
import {loadMapZoom, saveMapZoom} from './mapZoomStorage';

jest.mock('crustacean-map-lib', () => ({...jest.requireActual('crustacean-map-lib'), loadMap: jest.fn()}));

const docs: MapDocument[] = [];
const originalAPI = window.electronAPI;
const source = 'file:///maps/demo.map.json';
const emptyAsset = () => createEmptyMap();

beforeEach(() => {
  localStorage.clear();
  (loadMap as jest.Mock).mockImplementation(async () => emptyAsset());
  window.electronAPI = {saveMapFiles: jest.fn(async () => ({url: 'file:///maps/copy.map.json', dataUrl: 'file:///maps/copy.map.data.json',
    contentRootUrl: 'file:///maps/', map: JSON.stringify(createEmptyMap().map), hashes: {}, journal: 'file:///journal.json'}))};
});
afterEach(() => {docs.splice(0).forEach(disposeMapEditorSession); window.electronAPI = originalAPI; jest.restoreAllMocks();});

async function open(filepath = source) {
  const doc = mapMaker('Demo', filepath); docs.push(doc);
  const session = getMapEditorSession(doc);
  await waitFor(() => expect(session.loading).toBe(false));
  return {doc, session};
}

test('restores zoom into a fresh document session and keeps other maps independent', async () => {
  const {doc, session} = await open();
  session.fitted = true; session.camera.zoom = 2.5; session.notify();
  expect(session.dirty).toBe(false);
  disposeMapEditorSession(doc);
  const reopened = await open();
  expect(reopened.session).not.toBe(session);
  expect(reopened.session.camera.zoom).toBe(2.5);
  expect(reopened.session.initialZoom).toBe(2.5);
  expect((await open('file:///different/demo.map.json')).session.initialZoom).toBeNull();
});

test('loading notifications preserve saved zoom before the initial viewport fit', async () => {
  saveMapZoom(source, 4);
  const {session} = await open();
  session.camera.zoom = 1; session.notify();
  expect(loadMapZoom(source)).toBe(4);
});

test('persists zoom changes without writing again for unrelated notifications', async () => {
  const {session} = await open();
  const write = jest.spyOn(Storage.prototype, 'setItem');
  session.fitted = true; session.camera.zoom = 2; session.notify();
  session.paused = true; session.notify();
  expect(write).toHaveBeenCalledTimes(1);
  session.camera.zoom = 1; session.notify();
  expect(loadMapZoom(source)).toBe(1);
});

test('Save As carries zoom to the new map while preserving the original map preference', async () => {
  const {session} = await open();
  session.fitted = true; session.camera.zoom = 3; session.notify();
  await session.save(true);
  expect(loadMapZoom('file:///maps/copy.map.json')).toBe(3);
  session.camera.zoom = 2; session.notify();
  expect(loadMapZoom(source)).toBe(3);
  expect(loadMapZoom('file:///maps/copy.map.json')).toBe(2);
});

test('an untitled map starts persisting zoom only after it is saved', async () => {
  const {session} = await open('');
  session.fitted = true; session.camera.zoom = 0.5; session.notify();
  expect(loadMapZoom('')).toBeNull();
  await session.save();
  expect(loadMapZoom('file:///maps/copy.map.json')).toBe(0.5);
});

test('does not persist notifications from a disposed session', async () => {
  const {doc, session} = await open();
  disposeMapEditorSession(doc);
  session.fitted = true; session.camera.zoom = 3; session.notify();
  expect(loadMapZoom(source)).toBeNull();
});
