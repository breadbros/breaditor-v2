/** @jest-environment jsdom */
import {waitFor} from '@testing-library/react';
import {createEmptyMap, loadMap, serializeMap} from 'crustacean-map-lib';
import {mapMaker, MapDocument} from './MapDocument';
import {disposeMapEditorSession, getMapEditorSession, hasDirtyMaps} from './mapEditorSession';

jest.mock('crustacean-map-lib', () => ({createEmptyMap: jest.fn(), loadMap: jest.fn(), serializeMap: jest.fn()}), {virtual: true});
const load = loadMap as jest.Mock;
const empty = createEmptyMap as jest.Mock;
const serialize = serializeMap as jest.Mock;
const sourceUrl = 'file:///maps/demo.map.json', dataUrl = 'file:///maps/demo.map.data.json', imageUrl = 'file:///art/tiles.png';
const docs: MapDocument[] = [];
const originalAPI = window.electronAPI;

function asset() {return {map: {name: 'Original', layers: [{name: 'Ground', dimensions: {X: 2, Y: 2}, vsp: 'default', parallax: {X: 1, Y: 1}, alpha: 1}], vsp: {default: '../art/tiles.json'}, entities: [], zones: [], renderstring: '1,E', notes: [{text: 'retain'}]}, data: {tile_data: [[1, 2, 3, 4], [99]], legacy_obstruction_data: [], zone_data: []}, tilesets: {}, sprites: {}, mapUrl: sourceUrl, dataUrl, contentRootUrl: 'file:///', dependencies: [sourceUrl, dataUrl, imageUrl], diagnostics: []};}
function doc(filepath = sourceUrl) {const result = mapMaker('Demo', filepath); docs.push(result); return result;}
function deferred<T>() {let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}
function saveResult(map = asset().map, url = sourceUrl, companion = dataUrl) {return {url, dataUrl: companion, contentRootUrl: 'file:///', map: JSON.stringify(map), hashes: {[url]: 'saved-map', [companion]: 'saved-data'}, journal: 'file:///recovery/journal.json'};}
function api() {return window.electronAPI as {watchMapFiles: jest.Mock; mapFileHashes: jest.Mock; saveMapFiles: jest.Mock};}
async function opened() {const document = doc(), session = getMapEditorSession(document); await waitFor(() => expect(session.loading).toBe(false)); return {document, session};}
function watcher() {const watch = api().watchMapFiles; return watch.mock.calls[watch.mock.calls.length - 1][1] as (urls: string[]) => Promise<void>;}

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  empty.mockImplementation(asset); load.mockImplementation(async () => asset());
  serialize.mockImplementation(value => ({map: JSON.stringify(value.map), data: JSON.stringify(value.data)}));
  window.electronAPI = {watchMapFiles: jest.fn(() => jest.fn()), mapFileHashes: jest.fn(async urls => Object.fromEntries(urls.map((url: string) => [url, 'initial']))), saveMapFiles: jest.fn(async request => saveResult(JSON.parse(request.map)))};
});
afterEach(() => {for (const document of docs.splice(0)) disposeMapEditorSession(document); window.electronAPI = originalAPI;});

test('session and view state survive view subscriber removal and reuse', async () => {
  const {document, session} = await opened(), listener = jest.fn(), unsubscribe = session.subscribe(listener);
  session.camera = {x: 37, y: 51, zoom: 3}; session.paused = true; session.selectedLayer = '0';
  session.edit('Rename', value => {value.map.name = 'Edited';}); unsubscribe();
  session.notify(); expect(listener).toHaveBeenCalledTimes(1);
  const reused = getMapEditorSession(document);
  expect(reused).toBe(session); expect(reused.camera).toEqual({x: 37, y: 51, zoom: 3}); expect(reused.paused).toBe(true); expect(reused.asset!.map.name).toBe('Edited'); expect(load).toHaveBeenCalledTimes(1);
});

test('one gesture undoes as one operation and retains surplus map data', async () => {
  const {session} = await opened(); session.beginGesture('Paint');
  session.edit('Paint', value => {value.data.tile_data[0][0] = 7;}); session.edit('Paint', value => {value.data.tile_data[0][1] = 8;});
  session.finishGesture(); expect(session.history).toHaveLength(1); expect(session.dirty).toBe(true);
  session.undo(); expect(session.asset!.data.tile_data).toEqual([[1, 2, 3, 4], [99]]); expect(session.dirty).toBe(false); expect(session.asset!.map.notes).toEqual([{text: 'retain'}]);
  session.redo(); expect(session.asset!.data.tile_data[0]).toEqual([7, 8, 3, 4]); expect(session.dirty).toBe(true);
});

test('no-op and cancelled gestures leave no history or dirty state', async () => {
  const {session} = await opened(); session.beginGesture('No-op'); session.edit('No-op', () => {}); session.finishGesture();
  expect(session.history).toHaveLength(0); expect(session.dirty).toBe(false);
  session.beginGesture('Cancelled'); session.edit('Change', value => {value.map.name = 'Cancelled';}); session.cancelGesture();
  expect(session.asset!.map.name).toBe('Original'); expect(session.history).toHaveLength(0); expect(session.dirty).toBe(false);
});

test('failed edit rolls back the full document and reports the error', async () => {
  const {session} = await opened(); session.edit('Invalid', value => {value.map.name = 'Partial'; value.data.tile_data[0][0] = 99; throw new Error('Invalid operation');});
  expect(session.asset!.map.name).toBe('Original'); expect(session.asset!.data.tile_data[0][0]).toBe(1); expect(session.error).toBe('Invalid operation'); expect(session.dirty).toBe(false); expect(session.history).toHaveLength(0);
});

test('save captures one revision and preserves edits made while writing', async () => {
  const {session} = await opened(), pending = deferred<ReturnType<typeof saveResult>>();
  session.edit('Rename', value => {value.map.name = 'Saving';});
  api().saveMapFiles.mockReturnValueOnce(pending.promise); const saving = session.save();
  const persisted = JSON.parse(api().saveMapFiles.mock.calls[0][0].map);
  expect(persisted.name).toBe('Saving'); expect(session.saving).toBe(true);
  session.edit('Concurrent edit', value => {value.map.name = 'Still editing';});
  pending.resolve(saveResult(persisted)); await saving;
  expect(session.asset!.map.name).toBe('Still editing'); expect(session.dirty).toBe(true); expect(JSON.parse(session.saved).map.name).toBe('Saving'); expect(session.saving).toBe(false);
});

test('failed and cancelled saves retain dirty edits', async () => {
  const {session} = await opened(); session.edit('Rename', value => {value.map.name = 'Edited';});
  api().saveMapFiles.mockRejectedValueOnce(new Error('Disk full')); await session.save();
  expect(session.error).toBe('Disk full'); expect(session.dirty).toBe(true);
  api().saveMapFiles.mockResolvedValueOnce(null); await session.save(); expect(session.dirty).toBe(true); expect(session.asset!.map.name).toBe('Edited');
});

test('a tileset reference edited during save is retained as unsaved work', async () => {
  const {session} = await opened(), pending = deferred<ReturnType<typeof saveResult>>();
  api().saveMapFiles.mockReturnValueOnce(pending.promise); const saving = session.save();
  session.edit('Add tileset', value => {value.map.vsp.extra = '../art/extra.json';});
  pending.resolve(saveResult()); await saving;
  expect(session.asset!.map.vsp.extra).toBe('../art/extra.json'); expect(session.dirty).toBe(true);
  expect(JSON.parse(session.saved).map.vsp.extra).toBeUndefined();
});

test('Save As rebased asset references remain correct through undo and redo', async () => {
  const {session} = await opened(); session.edit('Rename', value => {value.map.name = 'Edited';});
  api().saveMapFiles.mockResolvedValueOnce(saveResult({...asset().map, name: 'Edited', vsp: {default: '../../art/tiles.json'}}, 'file:///copy/nested/map.map.json', 'file:///copy/nested/map.map.data.json'));
  await session.save(true); session.undo();
  expect(session.asset!.map.name).toBe('Original'); expect(session.asset!.map.vsp.default).toBe('../../art/tiles.json');
  session.redo(); expect(session.asset!.map.name).toBe('Edited'); expect(session.asset!.map.vsp.default).toBe('../../art/tiles.json'); expect(session.dirty).toBe(false);
});

test('dirty JSON source changes raise a conflict and retain current edits', async () => {
  const {session} = await opened(); session.edit('Rename', value => {value.map.name = 'Unsaved';});
  api().mapFileHashes.mockResolvedValueOnce({[sourceUrl]: 'external'}); await watcher()([sourceUrl]);
  expect(session.conflict).toBe(true); expect(session.asset!.map.name).toBe('Unsaved'); expect(load).toHaveBeenCalledTimes(1);
  await session.save(); expect(api().saveMapFiles).not.toHaveBeenCalled(); expect(session.error).toMatch(/Reload or Save As/);
  await session.reload(); expect(session.asset!.map.name).toBe('Unsaved'); expect(load).toHaveBeenCalledTimes(1);
});

test('invalid clean external reload keeps the last good map and view state', async () => {
  const {session} = await opened(), good = session.asset;
  session.camera = {x: 100, y: 50, zoom: 2}; session.paused = true;
  api().mapFileHashes.mockResolvedValueOnce({[sourceUrl]: 'invalid'}); load.mockRejectedValueOnce(new Error('Malformed JSON'));
  await watcher()([sourceUrl]);
  expect(session.asset).toBe(good); expect(session.error).toBe('Malformed JSON'); expect(session.loading).toBe(false); expect(session.camera).toEqual({x: 100, y: 50, zoom: 2}); expect(session.paused).toBe(true);
});

test('image reload refreshes expected file hashes without mutating the map or dirty state', async () => {
  const {session} = await opened(), before = JSON.stringify({map: session.asset!.map, data: session.asset!.data}), revision = session.imageRevision;
  api().mapFileHashes.mockResolvedValueOnce({[imageUrl]: 'new-image'}); await watcher()([imageUrl]);
  expect(session.imageRevision).toBe(revision + 1); expect(session.hashes[imageUrl]).toBe('new-image'); expect(session.dirty).toBe(false);
  expect(JSON.stringify({map: session.asset!.map, data: session.asset!.data})).toBe(before); expect(load).toHaveBeenCalledTimes(1);
  session.edit('Paint', value => {value.data.tile_data[0][0] = 5;}); await session.save();
  expect(api().saveMapFiles.mock.calls[0][0].expectedHashes[imageUrl]).toBe('new-image');
});

test('image reload retains dirty work without raising a JSON conflict', async () => {
  const {session} = await opened(); session.edit('Paint', value => {value.data.tile_data[0][0] = 5;});
  api().mapFileHashes.mockResolvedValueOnce({[imageUrl]: 'new-image'}); await watcher()([imageUrl]);
  expect(session.dirty).toBe(true); expect(session.conflict).toBe(false); expect(session.asset!.data.tile_data[0][0]).toBe(5);
});

test('Save As replaces old primary dependencies while preserving referenced assets', async () => {
  const {document, session} = await opened(), newUrl = 'file:///copy/new.map.json', newData = 'file:///copy/new.map.data.json';
  api().saveMapFiles.mockResolvedValueOnce(saveResult({...asset().map, vsp: {default: '../art/tiles.json'}}, newUrl, newData));
  await session.save(true);
  expect(document.filepath).toBe(newUrl); expect(session.asset!.dependencies).toEqual(expect.arrayContaining([newUrl, newData, imageUrl]));
  expect(session.asset!.dependencies).not.toContain(sourceUrl); expect(session.asset!.dependencies).not.toContain(dataUrl);
  expect(api().watchMapFiles.mock.calls.at(-1)[0]).not.toContain(sourceUrl); expect(session.dirty).toBe(false);
});

test('bundled demo save always uses Save As and then becomes a normal document', async () => {
  const document = doc(); document.bundled = true; const session = getMapEditorSession(document); await waitFor(() => expect(session.loading).toBe(false));
  await session.save(); expect(api().saveMapFiles.mock.calls[0][0].saveAs).toBe(true); expect(document.bundled).toBe(false);
});

test('disposal stops file watching and removes document from dirty-map tracking', async () => {
  const {document, session} = await opened(), stop = api().watchMapFiles.mock.results[0].value;
  session.edit('Dirty', value => {value.map.name = 'Edited';}); expect(hasDirtyMaps()).toBe(true);
  disposeMapEditorSession(document); expect(stop).toHaveBeenCalledTimes(1); expect(hasDirtyMaps()).toBe(false); expect(session.disposed).toBe(true);
});

test.each(['E', 'Z'])('clean source reload preserves special selection %s and view settings', async selected => {
  const {session} = await opened(); session.selectedLayer = selected; session.fitted = true;
  session.view.showObstructions = true; session.camera = {x: 50, y: 80, zoom: 2};
  await session.reload();
  expect(session.selectedLayer).toBe(selected); expect(session.view.showObstructions).toBe(true);
  expect(session.camera).toEqual({x: 50, y: 80, zoom: 2});
});

test('a dirty background document vetoes unload until its session is disposed', async () => {
  const {document, session} = await opened();
  session.edit('Rename', value => {value.map.name = 'Keep this edit';});
  const event = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  disposeMapEditorSession(document);
  const next = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(next);
  expect(next.defaultPrevented).toBe(false);
});
