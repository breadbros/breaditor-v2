import React, {useEffect, useRef, useState} from 'react';
import {bounds, pickMap, tileSize, entityBounds} from 'crustacean-map-lib';
import {WebGLMapRenderer} from 'crustacean-map-lib/webgl';
import type {MapDocument} from './MapDocument';
import {editableMap, useMapEditorSession, setMapClipboard} from './mapEditorSession';
import {resolveSpriteUrl} from './spriteSource';
import {MIN_MAP_ZOOM, MAX_MAP_ZOOM} from './mapZoomStorage';
import {copySelection, cutSelection, pasteSelection, getLayerGrid, paintTiles, stampTiles, fillTiles, readTile, moveEntity, removeEntity, createEntity, addLayer, sullyTileCode, MapTool} from './mapEditing';
import {MapPanel, MapToolbar} from '../panels/MapPanels';
import {DocumentControls} from '../../layout/components/DocumentControls';
// @ts-ignore
import css from './MapDocumentView.module.css';

export function MapDocumentPanel({document: doc, panel, id, title}: {document: MapDocument; panel: string; id: string; title: string}) {
  const session = useMapEditorSession(doc);
  return <section id={id} className={css.panel} aria-label={title}>
    <div className={css.title}>{title}</div>
    {session.asset ? <MapPanel panel={panel} asset={editableMap(session)} selectedLayer={session.selectedLayer}
      selectedEntity={session.selectedEntity} tool={session.tool} primaryTile={session.primaryTile} secondaryTile={session.secondaryTile}
      onSelectLayer={target => {session.selectedLayer = target; session.notify();}}
      onSelectEntity={id => {session.selectedEntity = id; session.notify();}}
      onToolChange={tool => {session.tool = tool; session.notify();}}
      onPrimaryTileChange={tile => {session.primaryTile = tile; session.notify();}}
      onSecondaryTileChange={tile => {session.secondaryTile = tile; session.notify();}}
      onEdit={(label, mutate) => {
        const sources = JSON.stringify([session.asset?.map.vsp, session.asset?.map.entities.map(entity => entity.filename)]);
        session.edit(label, mutate);
        if (sources !== JSON.stringify([session.asset?.map.vsp, session.asset?.map.entities.map(entity => entity.filename)])) void session.refreshAssets();
      }} view={session.view} imageRevision={session.imageRevision}
      onStampChange={stamp => {session.stamp = stamp; if (stamp) {session.tool = 'brush'; session.primaryTile = stamp.tiles[0];} session.notify();}}
      onAddTileset={async (name, reference) => {
        const url = resolveSpriteUrl(reference, session.asset?.mapUrl || document.baseURI);
        session.edit('Import tileset', asset => {
          asset.map.vsp[name] = url;
          if (!asset.map.layers.length) session.selectedLayer = String(addLayer(asset, 'Ground', name));
          else if (/^\d+$/.test(session.selectedLayer) && asset.map.layers[Number(session.selectedLayer)]) asset.map.layers[Number(session.selectedLayer)].vsp = name;
        });
        await session.refreshAssets();
        if (!session.asset?.tilesets[name]) throw new Error(session.error || 'Tileset could not be loaded.');
      }}
      onAddSprite={async reference => {
        session.edit('Import sprite', asset => {
          const selected = asset.map.entities.find(entity => entity.uuid === session.selectedEntity);
          if (selected) selected.filename = reference;
          else {const entity = createEntity(asset, {filename: reference, name: reference.replace(/\\/g, '/').split('/').pop() || 'Entity'}); session.selectedEntity = entity.uuid;}
        });
        await session.refreshAssets();
        if (!session.asset?.sprites[reference]) throw new Error(session.error || 'Sprite could not be loaded.');
      }}
      onViewChange={settings => {Object.assign(session.view, settings); session.notify();}} />
      : <div role="status">{session.error || 'Loading map…'}</div>}
  </section>;
}

export function MapDocumentView({document: doc}: {document: MapDocument}) {
  const session = useMapEditorSession(doc);
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLMapRenderer | null>(null);
  const [graphicsError, setGraphicsError] = useState<string | null>(null), [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  const [hover, setHover] = useState<{x: number; y: number; worldX: number; worldY: number} | null>(null);
  const space = useRef(false), pointer = useRef<{id: number; mode: string; x: number; y: number; cx: number; cy: number; tx: number; ty: number; lastX: number; lastY: number; entity?: string; ex?: number; ey?: number; button: number} | null>(null);
  const smart = useRef(false);

  function fit(reset = false, initialZoom?: number) {
    if (!session.asset || !viewportRef.current) return;
    const area = bounds(session.asset), viewport = viewportRef.current;
    const zoom = initialZoom ?? (reset ? 1 : Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, Math.min((viewport.clientWidth - 24) / Math.max(1, area.width), (viewport.clientHeight - 24) / Math.max(1, area.height)))));
    session.camera = {x: area.x - (viewport.clientWidth / zoom - area.width) / 2, y: area.y - (viewport.clientHeight / zoom - area.height) / 2, zoom};
    session.fitted = true; session.notify();
  }
  useEffect(() => {
    if (!session.asset) return;
    const asset = session.asset, canvas = canvasRef.current!, viewport = viewportRef.current!;
    const abort = new AbortController(); let renderer: WebGLMapRenderer | undefined, request = 0, last = 0, revision = -1;
    setReady(false); setGraphicsError(null);
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(viewport.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(viewport.clientHeight * ratio));
      if (!session.fitted && viewport.clientWidth > 0 && viewport.clientHeight > 0) fit(false, session.initialZoom ?? undefined);
    }
    function fail(error: unknown) {if (!abort.signal.aborted) {setGraphicsError(error instanceof Error ? error.message : String(error)); setReady(false);}}
    function tick(time: number) {
      if (abort.signal.aborted) return;
      try {
        if (!document.hidden && viewport.clientWidth && viewport.clientHeight) {
          if (last && !session.paused) session.timeMs += Math.max(0, time - last);
          if (revision !== session.revision) {renderer!.invalidate(); revision = session.revision;}
          renderer!.render(session.camera, {width: viewport.clientWidth, height: viewport.clientHeight, timeMs: session.timeMs, ...session.view} as any);
        }
        last = document.hidden ? 0 : time;
        request = requestAnimationFrame(tick);
      } catch (error) {fail(error);}
    }
    async function load() {
      renderer = new WebGLMapRenderer(canvas); rendererRef.current = renderer;
      await renderer.load(asset, {signal: abort.signal});
      if (abort.signal.aborted) return;
      resize(); setReady(true); request = requestAnimationFrame(tick);
    }
    function lost(event: Event) {event.preventDefault(); cancelAnimationFrame(request); setReady(false);}
    async function restored() {try {await renderer?.restore(); if (!abort.signal.aborted) {last = 0; setReady(true); request = requestAnimationFrame(tick);}} catch (error) {fail(error);}}
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined; observer?.observe(viewport);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    window.addEventListener('resize', resize); resize(); void load().catch(fail);
    return () => {abort.abort(); cancelAnimationFrame(request); observer?.disconnect(); window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      renderer?.dispose(); if (rendererRef.current === renderer) rendererRef.current = null;};
  }, [session, session.asset, session.imageRevision, attempt]);

  useEffect(() => {
    const blur = () => {space.current = false; session.finishGesture(); pointer.current = null;};
    window.addEventListener('blur', blur);
    return () => {window.removeEventListener('blur', blur); session.finishGesture();};
  }, [session]);

  function grid() {
    if (!session.asset || session.selectedLayer === 'E') return null;
    try {return getLayerGrid(editableMap(session), session.selectedLayer);} catch {return null;}
  }
  function position(event: {clientX: number; clientY: number}) {
    const rect = viewportRef.current!.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    const worldX = x / session.camera.zoom + session.camera.x, worldY = y / session.camera.zoom + session.camera.y;
    const current = grid();
    const layer = session.asset?.map.layers[Number(session.selectedLayer)];
    return {x, y, worldX, worldY, tx: Math.floor((x / session.camera.zoom + session.camera.x * (layer?.parallax?.X ?? 1) - (current?.offsetX ?? 0)) / (current?.tileWidth ?? 16)),
      ty: Math.floor((y / session.camera.zoom + session.camera.y * (layer?.parallax?.Y ?? 1) - (current?.offsetY ?? 0)) / (current?.tileHeight ?? 16))};
  }
  function pick(x: number, y: number) {
    return rendererRef.current?.pick({x, y}, session.camera, Math.max(0, Number(session.selectedLayer) || 0), {smart: smart.current}) ?? pickMap(session.asset!, {x, y}, session.camera, Math.max(0, Number(session.selectedLayer) || 0));
  }
  function setTool(tool: MapTool) {
    session.tool = tool;
    if (tool === 'zone') {session.selectedLayer = 'Z'; session.view.showZones = true;}
    if (tool === 'entity') session.selectedLayer = 'E';
    if ((tool === 'brush' || tool === 'fill') && session.selectedLayer === 'E' && session.asset?.map.layers.length) session.selectedLayer = '0';
    session.notify();
  }
  function paint(x: number, y: number, button = 0, previous?: {x: number; y: number}) {
    if (!grid()) return;
    const cells: {x: number; y: number}[] = [];
    const dx = x - (previous?.x ?? x), dy = y - (previous?.y ?? y), steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let index = 0; index <= steps; index++) cells.push({x: Math.round(x - dx + dx * index / steps), y: Math.round(y - dy + dy * index / steps)});
    session.edit('Paint tiles', asset => {
      if (session.stamp && button !== 2) for (const cell of cells) stampTiles(asset, session.selectedLayer, cell.x, cell.y, session.stamp);
      else paintTiles(asset, session.selectedLayer, cells, button === 2 ? session.secondaryTile : session.primaryTile);
    });
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!ready || !session.asset) return;
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
    const p = position(event), pan = event.button === 1 || space.current || session.tool === 'pan';
    const state = {id: event.pointerId, mode: pan ? 'pan' : session.tool, x: p.x, y: p.y, cx: session.camera.x, cy: session.camera.y, tx: p.tx, ty: p.ty, lastX: p.tx, lastY: p.ty, button: event.button};
    pointer.current = state;
    if (pan) return;
    if (session.tool === 'eyedropper') {
      smart.current = smart.current || event.shiftKey;
      const hit = pick(p.x, p.y);
      if ((smart.current || event.shiftKey) && hit.entityIndex !== undefined) {session.selectedEntity = String(session.asset.map.entities[hit.entityIndex].uuid); session.selectedLayer = 'E';}
      else if (smart.current && hit.layerIndex >= 0) {session.selectedLayer = String(hit.layerIndex); session.primaryTile = hit.tile;}
      else if (grid()) session.primaryTile = readTile(editableMap(session), session.selectedLayer, p.tx, p.ty);
      session.stamp = null;
      session.notify(); return;
    }
    if (session.tool === 'select') {session.selection = {x: p.tx, y: p.ty, width: 1, height: 1}; session.notify(); return;}
    if (session.tool === 'entity' || session.selectedLayer === 'E') {
      const hit = pick(p.x, p.y), entity = hit.entityIndex !== undefined ? session.asset.map.entities[hit.entityIndex] : undefined;
      if (entity) {session.selectedEntity = entity.uuid; pointer.current = {...state, mode: 'entity', entity: entity.uuid,
        ex: entity.location.px ?? (entity.location.tx ?? 0) * tileSize(session.asset).width, ey: entity.location.py ?? (entity.location.ty ?? 0) * tileSize(session.asset).height}; session.beginGesture('Move entity'); session.notify();}
      return;
    }
    if (session.tool === 'fill') {session.edit('Flood fill', asset => fillTiles(asset, session.selectedLayer, p.tx, p.ty, event.button === 2 ? session.secondaryTile : session.primaryTile)); return;}
    session.beginGesture('Paint tiles'); paint(p.tx, p.ty, event.button);
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const p = position(event); setHover({x: p.tx, y: p.ty, worldX: p.worldX, worldY: p.worldY});
    const state = pointer.current; if (!state || state.id !== event.pointerId) return;
    if (state.mode === 'pan') {session.camera.x = state.cx - (p.x - state.x) / session.camera.zoom; session.camera.y = state.cy - (p.y - state.y) / session.camera.zoom; session.notify();}
    else if (state.mode === 'select') {session.selection = {x: Math.min(state.tx, p.tx), y: Math.min(state.ty, p.ty), width: Math.abs(p.tx - state.tx) + 1, height: Math.abs(p.ty - state.ty) + 1}; session.notify();}
    else if (state.mode === 'entity' && state.entity) {
      const tiles = session.asset ? tileSize(session.asset) : {width: 16, height: 16};
      const snapX = event.altKey ? tiles.width : 1, snapY = event.altKey ? tiles.height : 1;
      const x = Math.round((state.ex! + (p.x - state.x) / session.camera.zoom) / snapX) * snapX, y = Math.round((state.ey! + (p.y - state.y) / session.camera.zoom) / snapY) * snapY;
      session.edit('Move entity', asset => moveEntity(asset, state.entity!, x, y));
    } else if ((state.mode === 'brush' || state.mode === 'zone') && (p.tx !== state.lastX || p.ty !== state.lastY)) paint(p.tx, p.ty, state.button, {x: state.lastX, y: state.lastY});
    state.lastX = p.tx; state.lastY = p.ty;
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {if (pointer.current?.id === event.pointerId) {session.finishGesture(); pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);}}
  function clipboard(action: 'copy' | 'cut' | 'paste', multi = false) {
    if (!session.asset) return;
    try {
      if (action === 'paste') {
        if (session.clipboard) session.edit('Paste tiles', asset => pasteSelection(asset, session.clipboard!, hover?.x ?? session.selection?.x ?? 0, hover?.y ?? session.selection?.y ?? 0, multi ? undefined : session.selectedLayer));
      } else if (session.selection && grid()) {
        const targets = multi ? (session.superLayers.length ? session.superLayers : [...session.asset.map.layers.map((_, index) => String(index)), 'Z', ...(session.asset.map.obstruction_layers?.map(layer => `O:${layer.id}`) ?? (session.asset.data.legacy_obstruction_data?.length ? ['O:legacy'] : []))]) : [session.selectedLayer];
        if (action === 'copy') setMapClipboard(copySelection(editableMap(session), targets, session.selection));
        else session.edit('Cut tiles', asset => {setMapClipboard(cutSelection(asset, targets, session.selection!));});
      }
      session.notify();
    } catch (error) {session.error = error instanceof Error ? error.message : String(error); session.notify();}
  }
  async function exportPng() {
    if (!session.asset) return;
    let renderer: WebGLMapRenderer | undefined;
    try {
      const area = bounds(session.asset), canvas = document.createElement('canvas');
      canvas.width = Math.ceil(area.width); canvas.height = Math.ceil(area.height);
      renderer = new WebGLMapRenderer(canvas); await renderer.load(session.asset);
      renderer.render({x: area.x, y: area.y, zoom: 1}, {width: canvas.width, height: canvas.height, pixelRatio: 1, timeMs: session.timeMs, ...session.view} as any);
      const dataUrl = canvas.toDataURL('image/png');
      if (window.electronAPI?.saveMapImage) {
        const saved = await window.electronAPI.saveMapImage({suggestedName: `${doc.name}.png`, dataUrl});
        if (saved) {session.message = 'PNG exported'; session.notify();}
      } else {const link = document.createElement('a'); link.download = `${doc.name}.png`; link.href = dataUrl; link.click(); session.message = 'PNG downloaded'; session.notify();}
    } catch (error) {session.error = String(error); session.notify();} finally {renderer?.dispose();}
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]')) return;
    const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    const prevent = () => event.preventDefault();
    if (event.code === 'Space') {space.current = true; prevent();}
    else if (command && key === 's') {void session.save(event.shiftKey); prevent();}
    else if (command && key === 'z') {event.shiftKey ? session.redo() : session.undo(); prevent();}
    else if (command && key === 'y') {session.redo(); prevent();}
    else if (command && (key === 'c' || key === 'x' || key === 'v')) {clipboard(key === 'c' ? 'copy' : key === 'x' ? 'cut' : 'paste', event.shiftKey); prevent();}
    else if (command && key === 'a' && grid()) {const selected = grid()!; session.selection = {x: 0, y: 0, width: selected.width, height: selected.height}; session.notify(); prevent();}
    else if (command && key === '0') {fit(true); prevent();}
    else if (key === 'escape') {session.cancelGesture(); session.selection = null; session.selectedEntity = undefined; session.notify(); prevent();}
    else if (key === 'delete' && session.selectedEntity) {session.edit('Remove entity', asset => removeEntity(asset, session.selectedEntity!)); prevent();}
    else if (key === 'x') {const old = session.primaryTile; session.primaryTile = session.secondaryTile; session.secondaryTile = old; session.notify();}
    else if (key === 'i') {smart.current = event.shiftKey; setTool('eyedropper');}
    else if (key === 'o') {session.selectedLayer = session.asset?.map.obstruction_layers?.[0] ? `O:${session.asset.map.obstruction_layers[0].id}` : 'O:legacy'; session.view.showObstructions = true; session.notify();}
    else if (key === 'e') {setTool('entity');}
    else if (key === 'z') {setTool('zone');}
    else if (/^[1-9]$/.test(key) && session.asset?.map.layers[Number(key) - 1]) {session.selectedLayer = String(Number(key) - 1); session.notify();}
    else if ({b: 'brush', g: 'fill', m: 'select', v: 'entity'}[key]) setTool(({b: 'brush', g: 'fill', m: 'select', v: 'entity'} as Record<string, MapTool>)[key]);
  }
  const selectedGrid = grid(), layer = session.asset?.map.layers[Number(session.selectedLayer)], selection = session.selection;
  const selectedEntity = session.asset?.map.entities.find(entity => entity.uuid === session.selectedEntity);
  const selectedBounds = session.asset && selectedEntity ? entityBounds(session.asset, selectedEntity) : null;
  const selectedEntityLayer = session.asset?.map.layers.find(item => item.name === selectedEntity?.location.layer);
  const gridWidth = (selectedGrid?.tileWidth ?? 16) * session.camera.zoom, gridHeight = (selectedGrid?.tileHeight ?? 16) * session.camera.zoom;
  const gridX = ((selectedGrid?.offsetX ?? 0) - session.camera.x * (layer?.parallax?.X ?? 1)) * session.camera.zoom;
  const gridY = ((selectedGrid?.offsetY ?? 0) - session.camera.y * (layer?.parallax?.Y ?? 1)) * session.camera.zoom;
  const selectionRect = selection && selectedGrid ? {
    x: (selection.x * selectedGrid.tileWidth + selectedGrid.offsetX - session.camera.x * (layer?.parallax?.X ?? 1)) * session.camera.zoom,
    y: (selection.y * selectedGrid.tileHeight + selectedGrid.offsetY - session.camera.y * (layer?.parallax?.Y ?? 1)) * session.camera.zoom,
    width: selection.width * selectedGrid.tileWidth * session.camera.zoom, height: selection.height * selectedGrid.tileHeight * session.camera.zoom,
  } : null;
  return <section id={doc.info.id} className={css.container} aria-label={`${doc.info.title} map editor`} aria-busy={session.loading || !ready}>
    <div className={css.title}>{doc.info.title} Document <span>{session.dirty ? '● Unsaved changes' : session.message}</span></div>
    <DocumentControls documentId={doc.info.id}>
      <div className={css.controls}>
        <MapToolbar tool={session.tool} onToolChange={tool => {smart.current = false; setTool(tool);}} onUndo={() => session.undo()} onRedo={() => session.redo()} canUndo={!!session.history.length} canRedo={!!session.redoHistory.length}
          paused={session.paused} onPause={() => {session.paused = !session.paused; session.notify();}} onFit={() => fit()} onReset={() => fit(true)} onExportPng={() => void exportPng()}
          onSmartEyedropper={() => {smart.current = true; setTool('eyedropper');}} />
        <button disabled={!session.asset || session.saving} onClick={() => void session.save()}>Save</button>
        <button disabled={!session.asset || session.saving} onClick={() => void session.save(true)}>Save As</button>
        <button disabled={!session.asset || session.saving} onClick={() => void session.save(true, true)}>Export project</button>
        <button disabled={!doc.filepath} onClick={() => {if (!session.dirty || window.confirm('Discard unsaved map edits and reload?')) void session.reload(true);}}>Reload</button>
        <button disabled={!selection} onClick={() => clipboard('copy')}>Copy</button><button disabled={!selection} onClick={() => clipboard('cut')}>Cut</button><button disabled={!session.clipboard} onClick={() => clipboard('paste')}>Paste</button>
        <button disabled={!selection} onClick={() => clipboard('cut', true)}>Super cut</button><button disabled={!session.clipboard} onClick={() => clipboard('paste', true)}>Super paste</button>
        <button disabled={!session.clipboard} onClick={() => void navigator.clipboard?.writeText(sullyTileCode(session.clipboard!, hover?.x ?? 0, hover?.y ?? 0))}>Copy tiles C#</button>
        <label>Primary <input aria-label="Primary tile" type="number" min={0} value={session.primaryTile} onChange={event => {session.primaryTile = Math.max(0, Number(event.target.value)); session.stamp = null; session.notify();}} /></label>
        <label>Secondary <input aria-label="Secondary tile" type="number" min={0} value={session.secondaryTile} onChange={event => {session.secondaryTile = Math.max(0, Number(event.target.value)); session.notify();}} /></label>
        <label><input type="checkbox" checked={session.view.grid} onChange={event => {session.view.grid = event.target.checked; session.notify();}} />Grid</label>
      </div>
    </DocumentControls>
    {session.conflict && <div className={css.conflict} role="alert">Source files changed; unsaved edits are retained.<button onClick={() => {if (window.confirm('Discard unsaved edits and reload the changed files?')) void session.reload(true);}}>Reload from disk</button><button onClick={() => void session.save(true)}>Save As</button></div>}
    <div ref={viewportRef} className={css.viewport} tabIndex={0} aria-label="Map viewport" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => {session.cancelGesture(); pointer.current = null;}} onContextMenu={event => event.preventDefault()}
      onKeyDown={keyDown} onKeyUp={event => {if (event.code === 'Space') space.current = false;}}
      onWheel={event => {event.preventDefault(); const p = position(event), zoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, session.camera.zoom * (event.deltaY < 0 ? 1.25 : 0.8))); session.camera = {x: p.worldX - p.x / zoom, y: p.worldY - p.y / zoom, zoom}; session.notify();}}>
      <canvas ref={canvasRef} className={css.canvas} aria-label={`${doc.info.title} map`} />
      <svg className={css.overlay}>
        {session.view.grid && gridWidth >= 4 && gridHeight >= 4 && <><defs><pattern id={`grid-${doc.info.id}`} width={gridWidth} height={gridHeight} patternUnits="userSpaceOnUse" x={gridX} y={gridY}><path d={`M ${gridWidth} 0 L 0 0 0 ${gridHeight}`} fill="none" stroke="#ffffff44" strokeWidth={0.5} /></pattern></defs><rect width="100%" height="100%" fill={`url(#grid-${doc.info.id})`} /></>}
        {selectionRect && <rect {...selectionRect} fill="#71b7ff22" stroke="#b9dbff" strokeWidth={1} strokeDasharray="4 3" />}
        {selectedBounds && <rect x={(selectedBounds.x + (selectedEntityLayer?.offset?.X ?? 0) - session.camera.x * (selectedEntityLayer?.parallax?.X ?? 1)) * session.camera.zoom} y={(selectedBounds.y + (selectedEntityLayer?.offset?.Y ?? 0) - session.camera.y * (selectedEntityLayer?.parallax?.Y ?? 1)) * session.camera.zoom} width={selectedBounds.width * session.camera.zoom} height={selectedBounds.height * session.camera.zoom} fill="none" stroke="#ffe264" strokeWidth={2} />}
      </svg>
      {(session.loading || (!ready && !graphicsError && !session.error)) && <div role="status" className={css.message}>Loading map…</div>}
      {(graphicsError || session.error) && <div role="alert" className={css.message}>{graphicsError || session.error}<button onClick={() => {setAttempt(value => value + 1); if (!session.asset) void session.reload(); else {session.error = null; session.notify();}}}>Retry</button></div>}
    </div>
    {!!session.asset?.diagnostics.length && <details className={css.status}><summary>{session.asset.diagnostics.length} asset diagnostic(s)</summary>{session.asset.diagnostics.map((item, index) => <div key={index}>{item.severity}: {item.message}{item.url ? ` (${item.url})` : ''}</div>)}</details>}
    <div role="status" data-testid="map-status" className={css.status}>
      {session.asset ? `${session.asset.map.name || doc.name} · ${session.asset.map.layers.length} layers · ${session.asset.map.entities.length} entities · Zoom ${Math.round(session.camera.zoom * 100)}%${hover ? ` · Tile ${hover.x},${hover.y} · Pixel ${Math.floor(hover.worldX)},${Math.floor(hover.worldY)}` : ''} · ${session.dirty ? 'Unsaved changes' : session.message || 'Ready'}${session.asset.map.format_version === 2 ? ' · Extended format (Sully runtime unsupported)' : ''}` : 'Loading map'}
    </div>
  </section>;
}
