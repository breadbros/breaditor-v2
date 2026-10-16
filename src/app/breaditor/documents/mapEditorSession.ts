import {useEffect, useState} from 'react';
import {createEmptyMap, loadMap, serializeMap, MapAsset, MapCamera} from 'crustacean-map-lib';
import type {MapDocument} from './MapDocument';
import {resolveSpriteUrl} from './spriteSource';
import {loadMapZoom, loadMapViewport, saveMapViewport} from './mapZoomStorage';
import type {MapEditableAsset, MapRect, MapTool, TileClipboard} from './mapEditing';

export interface MapViewOptions {
  showObstructions: boolean; showZones: boolean; showEntities: boolean;
  showBounds: boolean; showHitboxes: boolean; showCanopies: boolean; grid: boolean;
  screenview: {enabled: boolean; x: number; y: number; width: number; height: number; opacity: number};
  [key: string]: any;
}
interface HistoryEntry {label: string; before: string; after: string}
export interface MapEditorSession {
  document: MapDocument; asset: MapAsset | null; error: string | null; message: string;
  loading: boolean; saving: boolean; dirty: boolean; conflict: boolean; revision: number; imageRevision: number;
  selectedLayer: string; selectedEntity?: string; tool: MapTool; primaryTile: number; secondaryTile: number;
  selection: MapRect | null; clipboard: TileClipboard | null; superLayers: string[];
  stamp: {width: number; height: number; tiles: number[]} | null;
  camera: MapCamera; initialZoom: number | null; initialViewport: MapCamera | null;
  fitted: boolean; paused: boolean; timeMs: number; view: MapViewOptions;
  history: HistoryEntry[]; redoHistory: HistoryEntry[];
  hashes: Record<string, string | null>; saved: string; disposed: boolean;
  subscribe(listener: () => void): () => void;
  notify(): void; edit(label: string, mutate: (asset: MapEditableAsset) => void): void;
  beginGesture(label: string): void; finishGesture(): void; cancelGesture(): void;
  undo(): void; redo(): void; reload(discard?: boolean): Promise<void>; save(saveAs?: boolean, exportProject?: boolean): Promise<void>;
  refreshAssets(): Promise<void>;
}
interface Entry {session: MapEditorSession; abort?: AbortController; dependencyAbort?: AbortController; stopWatch?: () => void; gesture?: {label: string; before: string}; subscribers: Set<() => void>}
const sessions = new WeakMap<MapDocument, Entry>();
const liveSessions = new Set<MapEditorSession>();
function preventDirtyUnload(event: BeforeUnloadEvent) {if ([...liveSessions].some(session => session.dirty)) {event.preventDefault(); event.returnValue = '';}}
let clipboard: TileClipboard | null = null;
export function setMapClipboard(value: TileClipboard) {clipboard = value; for (const session of liveSessions) {session.clipboard = value; session.notify();}}
function snapshot(asset: MapAsset) {return JSON.stringify({map: asset.map, data: asset.data});}
function rememberRecent(doc: MapDocument) {
  if (!doc.filepath || doc.bundled) return;
  try {
    const entries: string[] = JSON.parse(localStorage.getItem('breaditor.recentMaps') || '[]');
    localStorage.setItem('breaditor.recentMaps', JSON.stringify([doc.filepath, ...entries.filter(url => url !== doc.filepath)].slice(0, 10)));
  } catch { /* A disabled local store does not block opening maps. */ }
}
export function recentMapFiles(): string[] {try {return JSON.parse(localStorage.getItem('breaditor.recentMaps') || '[]');} catch {return [];}}
export function editableMap(session: MapEditorSession): MapEditableAsset {return session.asset as unknown as MapEditableAsset;}
function prepare(asset: MapAsset) {
  asset.map.zones ??= [];
  asset.data.zone_data ??= [];
  asset.data.legacy_obstruction_data ??= [];
  asset.map.entities.forEach((entity, index) => {entity.uuid ||= `breaditor-${index}`;});
  return asset;
}

export function getMapEditorSession(doc: MapDocument): MapEditorSession {
  const existing = sessions.get(doc);
  if (existing) return existing.session;
  const entry: Entry = {session: undefined as unknown as MapEditorSession, subscribers: new Set()};
  const initialViewport = loadMapViewport(doc.filepath);
  const initialZoom = initialViewport?.zoom ?? loadMapZoom(doc.filepath);
  let lastViewport = initialViewport, lastViewportPath = doc.filepath;
  const session: MapEditorSession = {
    document: doc, asset: doc.filepath ? null : prepare(createEmptyMap()), error: null, message: '',
    loading: !!doc.filepath, saving: false, dirty: false, conflict: false, revision: 0, imageRevision: 0,
    selectedLayer: 'E', tool: 'pan', primaryTile: 0, secondaryTile: 0, selection: null, clipboard, superLayers: [], stamp: null,
    camera: initialViewport ? {...initialViewport} : {x: 0, y: 0, zoom: initialZoom ?? 1},
    initialZoom, initialViewport, fitted: false, paused: false, timeMs: 0,
    view: {showObstructions: false, showZones: false, showEntities: true, showBounds: false, showHitboxes: false, showCanopies: false, grid: false,
      screenview: {enabled: false, x: 0, y: 0, width: 320, height: 240, opacity: 0.5}},
    history: [], redoHistory: [], hashes: {}, saved: '', disposed: false,
    subscribe(listener) {entry.subscribers.add(listener); return () => {entry.subscribers.delete(listener);};},
    notify() {
      if (session.disposed) return;
      // Loading notifications must not replace the saved viewport. Save As
      // carries the current position and zoom to its new file.
      const camera = session.camera;
      if (session.fitted && (!lastViewport || camera.x !== lastViewport.x || camera.y !== lastViewport.y ||
        camera.zoom !== lastViewport.zoom || doc.filepath !== lastViewportPath)) {
        saveMapViewport(doc.filepath, camera);
        lastViewport = {...camera}; lastViewportPath = doc.filepath;
      }
      entry.subscribers.forEach(listener => listener());
    },
    edit(label, mutate) {
      if (!session.asset || session.loading) return;
      const before = entry.gesture?.before ?? snapshot(session.asset);
      try {mutate(editableMap(session));}
      catch (cause) {
        Object.assign(session.asset, JSON.parse(before)); session.error = String(cause instanceof Error ? cause.message : cause); session.notify(); return;
      }
      session.error = null;
      if (!entry.gesture) record(label, before);
      else {session.dirty = true; session.revision++; session.notify();}
    },
    beginGesture(label) {if (session.asset && !entry.gesture) entry.gesture = {label, before: snapshot(session.asset)};},
    finishGesture() {if (entry.gesture) {const gesture = entry.gesture; entry.gesture = undefined; record(gesture.label, gesture.before);}},
    cancelGesture() {if (entry.gesture && session.asset) {Object.assign(session.asset, JSON.parse(entry.gesture.before)); entry.gesture = undefined; session.revision++; session.dirty = snapshot(session.asset) !== session.saved; session.notify();}},
    undo() {session.finishGesture(); const change = session.history.pop(); if (change && session.asset) {Object.assign(session.asset, JSON.parse(change.before)); session.redoHistory.push(change); changed();}},
    redo() {const change = session.redoHistory.pop(); if (change && session.asset) {Object.assign(session.asset, JSON.parse(change.after)); session.history.push(change); changed();}},
    async refreshAssets() {
      if (!session.asset) return;
      const original = session.asset, revision = session.revision;
      entry.dependencyAbort?.abort();
      const abort = new AbortController(); entry.dependencyAbort = abort;
      const mapUrl = original.mapUrl || new URL('__new__.map.json', document.baseURI).href;
      const dataUrl = mapUrl.replace(/\.map\.json$/i, '.map.data.json');
      const serialized = serializeMap(original);
      try {
        const loaded = await loadMap(mapUrl, {signal: abort.signal, contentRootUrl: original.contentRootUrl || new URL('.', mapUrl).href,
          fetch: (input, init) => String(input) === mapUrl ? Promise.resolve(new Response(serialized.map))
            : String(input) === dataUrl ? Promise.resolve(new Response(serialized.data)) : fetch(input, {...init, cache: 'no-store'})});
        if (abort.signal.aborted || session.disposed) return;
        if (revision !== session.revision) {await session.refreshAssets(); return;}
        const dependencies = loaded.dependencies.filter(url => original.mapUrl || (url !== mapUrl && url !== dataUrl));
        session.asset = {...original, tilesets: loaded.tilesets, sprites: loaded.sprites, dependencies, diagnostics: loaded.diagnostics};
        Object.assign(session.hashes, await window.electronAPI?.mapFileHashes?.(dependencies));
        if (session.disposed) return;
        const errors = loaded.diagnostics.filter(diagnostic => diagnostic.severity === 'error');
        session.error = errors.length ? errors.map(diagnostic => diagnostic.message).join('; ') : null;
        session.revision++; watch(); session.notify();
      } catch (cause) {if (!abort.signal.aborted) {session.error = cause instanceof Error ? cause.message : String(cause); session.notify();}}
    },
    async reload(discard = false) {
      if (session.dirty && !discard) {session.conflict = true; session.notify(); return;}
      if (!doc.filepath) return;
      entry.abort?.abort();
      const abort = new AbortController(); entry.abort = abort;
      session.loading = true; session.error = null; session.notify();
      const url = resolveSpriteUrl(doc.filepath, document.baseURI);
      try {
        const asset = prepare(await loadMap(url, {signal: abort.signal,
          contentRootUrl: doc.contentRoot ? resolveSpriteUrl(doc.contentRoot, document.baseURI) : undefined,
          fetch: (input, init) => fetch(input, {...init, cache: 'no-store'})}));
        const hashes = await window.electronAPI?.mapFileHashes?.(asset.dependencies) ?? {};
        if (abort.signal.aborted || session.disposed) return;
        session.asset = asset; session.hashes = hashes; session.saved = snapshot(asset);
        session.dirty = false; session.conflict = false; session.history = []; session.redoHistory = [];
        const selected = session.selectedLayer;
        const validSelection = selected === 'E' || selected === 'Z' ||
          (/^\d+$/.test(selected) && !!asset.map.layers[Number(selected)]) ||
          (selected.startsWith('O:') && (!!asset.map.obstruction_layers?.some(layer => `O:${layer.id}` === selected) ||
            (selected === 'O:legacy' && !asset.map.obstruction_layers && !!asset.data.legacy_obstruction_data?.length)));
        if (!validSelection)
          session.selectedLayer = asset.map.layers.length ? '0' : 'E';
        if (!session.fitted) session.view.showObstructions = !!asset.map.MAPED_OBSLAYER_VISIBLE;
        session.revision++;
        rememberRecent(doc);
        watch();
      } catch (cause) {
        if (!abort.signal.aborted) session.error = cause instanceof Error ? cause.message : String(cause);
      } finally {if (!abort.signal.aborted) {session.loading = false; session.notify();}}
    },
    async save(saveAs = false, exportProject = false) {
      if (!session.asset || session.saving) return;
      session.finishGesture();
      if (!window.electronAPI?.saveMapFiles) {session.error = 'Saving map bundles requires the desktop editor.'; session.notify(); return;}
      if (session.conflict && !saveAs && !exportProject) {session.error = 'Source files changed. Reload or Save As before saving.'; session.notify(); return;}
      const asset = session.asset, sourceSnapshot = snapshot(asset);
      let serialized: {map: string; data: string};
      try {serialized = serializeMap(asset);} catch (cause) {session.error = cause instanceof Error ? cause.message : String(cause); session.notify(); return;}
      const savedFormat = session.saved ? JSON.parse(session.saved).map.format_version : undefined;
      session.saving = true; session.error = null; session.notify();
      try {
        const result = await window.electronAPI.saveMapFiles({sourceUrl: asset.mapUrl || undefined,
          suggestedName: `${doc.name.replace(/[^a-z0-9_-]/gi, '_')}.map.json`, ...serialized,
          saveAs: saveAs || !!doc.bundled || !asset.mapUrl || (asset.map.format_version === 2 && savedFormat !== 2),
          exportProject, contentRootUrl: asset.contentRootUrl || new URL('.', document.baseURI).href,
          dependencies: asset.dependencies, expectedHashes: session.hashes});
        if (!result || session.disposed) return;
        const previousMapUrl = asset.mapUrl, previousDataUrl = asset.dataUrl;
        doc.filepath = result.url; doc.contentRoot = undefined; doc.bundled = false;
        asset.mapUrl = result.url; asset.dataUrl = result.dataUrl; asset.contentRootUrl = result.contentRootUrl;
        // Preserve edits made during an asynchronous save, updating only relocated references.
        const persisted = JSON.parse(result.map);
        const originalState = JSON.parse(sourceSnapshot);
        const rebaseMap = (value: any) => {
          for (const key of Object.keys(value.vsp || {})) {
            if (value.vsp[key] === originalState.map.vsp[key] && key in persisted.vsp) value.vsp[key] = persisted.vsp[key];
            else if (result.url !== previousMapUrl && previousMapUrl && typeof value.vsp[key] === 'string') {
              // URLs are accepted references; changed/history-only assets retain their original meaning after relocation.
              value.vsp[key] = new URL(value.vsp[key].replace(/\\/g, '/'), previousMapUrl).href;
            }
          }
          if (persisted.MAPED_CONTENT_ROOT) value.MAPED_CONTENT_ROOT = persisted.MAPED_CONTENT_ROOT;
        };
        rebaseMap(asset.map);
        if (result.url !== previousMapUrl) for (const history of [...session.history, ...session.redoHistory]) {
          for (const field of ['before', 'after'] as const) {const state = JSON.parse(history[field]); rebaseMap(state.map); history[field] = JSON.stringify(state);}
        }
        if (persisted.MAPED_CONTENT_ROOT) asset.map.MAPED_CONTENT_ROOT = persisted.MAPED_CONTENT_ROOT;
        const savedState = originalState; savedState.map.vsp = persisted.vsp;
        if (persisted.MAPED_CONTENT_ROOT) savedState.map.MAPED_CONTENT_ROOT = persisted.MAPED_CONTENT_ROOT;
        session.saved = JSON.stringify(savedState); session.dirty = snapshot(asset) !== session.saved;
        session.hashes = {...session.hashes, ...result.hashes}; session.conflict = false; session.message = exportProject ? 'Project exported' : 'Map saved';
        asset.dependencies = [...new Set([...asset.dependencies.filter(url => url !== previousMapUrl && url !== previousDataUrl), result.url, result.dataUrl])];
        rememberRecent(doc); watch();
        if (exportProject && !session.dirty) await session.reload(true);
      } catch (cause) {session.error = cause instanceof Error ? cause.message : String(cause);}
      finally {session.saving = false; session.notify();}
    },
  };
  function changed() {session.revision++; session.dirty = !!session.asset && snapshot(session.asset) !== session.saved; session.notify();}
  function record(label: string, before: string) {
    if (!session.asset) return;
    const after = snapshot(session.asset);
    if (before !== after) {session.history.push({label, before, after}); if (session.history.length > 40) session.history.shift(); session.redoHistory = [];}
    changed();
  }
  function watch() {
    entry.stopWatch?.();
    if (!session.asset) return;
    entry.stopWatch = window.electronAPI?.watchMapFiles?.(session.asset.dependencies, async urls => {
      if (session.disposed) return;
      if (urls.every(url => !/\.json(?:$|[?#])/i.test(url))) {
        const imageHashes = await window.electronAPI?.mapFileHashes?.(urls);
        if (session.disposed) return;
        if (imageHashes) Object.assign(session.hashes, imageHashes);
        session.imageRevision++; session.notify(); return;
      }
      if (session.saving) return;
      const hashes = await window.electronAPI?.mapFileHashes?.(urls);
      if (hashes && urls.every(url => hashes[url] === session.hashes[url])) return;
      if (session.dirty) {session.conflict = true; session.message = 'Source files changed; your edits are retained.'; session.notify();}
      else await session.reload();
    });
  }
  entry.session = session; sessions.set(doc, entry);
  if (!liveSessions.size && typeof window !== 'undefined') window.addEventListener('beforeunload', preventDirtyUnload);
  liveSessions.add(session);
  if (session.asset) session.saved = snapshot(session.asset);
  if (doc.filepath) void session.reload();
  return session;
}
export function useMapEditorSession(doc: MapDocument) {
  const session = getMapEditorSession(doc);
  const [, update] = useState(0);
  useEffect(() => session.subscribe(() => update(value => value + 1)), [session]);
  return session;
}
export function disposeMapEditorSession(doc: MapDocument) {
  const entry = sessions.get(doc); if (!entry) return;
  entry.session.disposed = true; entry.abort?.abort(); entry.dependencyAbort?.abort(); entry.stopWatch?.(); entry.subscribers.clear();
  liveSessions.delete(entry.session); sessions.delete(doc);
  if (!liveSessions.size && typeof window !== 'undefined') window.removeEventListener('beforeunload', preventDirtyUnload);
}
export function hasDirtyMaps() {return [...liveSessions].some(session => session.dirty);}
export function saveOpenMapDocument(doc: MapDocument, saveAs = false, exportProject = false) {void getMapEditorSession(doc).save(saveAs, exportProject);}
