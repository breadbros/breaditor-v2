import React, {useEffect, useRef, useState} from 'react';
import {MapEditableAsset, MapTool, addLayer, renameLayer, removeLayer, resizeLayer, resizeMapGrid, setMapTileSize, createEntity, cloneEntity, removeEntity, moveEntity, createZone, updateZone, upgradeMap, addObstructionLayer, removeObstructionLayer, getLayerGrid, mapTileSize, activationScriptName, sullyEntityCode, sullyZoneCode} from '../documents/mapEditing';
import {MapLayerStack} from './MapLayerStack';
// @ts-ignore
import css from './MapPanels.module.css';

export interface MapScreenview {enabled: boolean; x: number; y: number; width: number; height: number; opacity: number}
export interface MapViewSettings {screenview?: MapScreenview; showObstructions?: boolean; showZones?: boolean; showEntities?: boolean; showBounds?: boolean; showHitboxes?: boolean; showCanopies?: boolean; checker?: boolean}
export interface MapPanelProps {
  panel: string;
  asset: MapEditableAsset;
  selectedLayer: string;
  selectedEntity?: string;
  tool: MapTool;
  primaryTile: number;
  secondaryTile: number;
  imageRevision?: number;
  onSelectLayer: (target: string) => void;
  onSelectEntity: (uuid: string) => void;
  onToolChange: (tool: MapTool) => void;
  onPrimaryTileChange: (tile: number) => void;
  onSecondaryTileChange: (tile: number) => void;
  onEdit: (label: string, mutate: (asset: MapEditableAsset) => void) => void;
  view?: MapViewSettings;
  onViewChange?: (settings: Partial<MapViewSettings>) => void;
  onStampChange?: (stamp: {width: number; height: number; tiles: number[]} | null) => void;
  onAddTileset?: (name: string, reference: string) => Promise<void>;
  onAddSprite?: (reference: string) => Promise<void>;
}
function Field({label, value, onChange, number = false, min, max}: {label: string; value: string | number; onChange: (value: string) => void; number?: boolean; min?: number; max?: number}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className={css.field}>{label}<input aria-label={label} type={number ? 'number' : 'text'} min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => {if (draft !== String(value)) {if (number && (!Number.isFinite(Number(draft)) || draft === '' || (min !== undefined && Number(draft) < min) || (max !== undefined && Number(draft) > max))) {setDraft(String(value)); return;} onChange(draft);}}} onKeyDown={event => {if (event.key === 'Enter') event.currentTarget.blur();}} /></label>;
}
function Check({label, checked, onChange}: {label: string; checked: boolean; onChange: (checked: boolean) => void}) {return <label className={css.check}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>;}
function JsonField({label, value, onChange}: {label: string; value: any; onChange: (value: Record<string, any>) => void}) {
  const serialized = JSON.stringify(value, null, 2), [draft, setDraft] = useState(serialized), [error, setError] = useState('');
  useEffect(() => setDraft(serialized), [serialized]);
  return <details><summary>{label}</summary><label>{label}<textarea aria-label={label} rows={10} value={draft} onChange={event => setDraft(event.target.value)} /></label><button onClick={() => {try {const data = JSON.parse(draft); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Enter a JSON object'); onChange(data); setError('');} catch (cause) {setError(cause instanceof Error ? cause.message : String(cause));}}}>Apply {label.toLowerCase()}</button>{error && <p role="alert">{error}</p>}</details>;
}
function Options({label, value, options, onChange}: {label: string; value: string; options: [string, string][]; onChange: (value: string) => void}) {return <label className={css.field}>{label}<select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;}
function LayersPanel(props: MapPanelProps) {
  const {asset, selectedLayer, onEdit, onSelectLayer} = props, selected = /^\d+$/.test(selectedLayer) ? Number(selectedLayer) : -1;
  const layer = asset.map.layers[selected];
  const obstruction = selectedLayer.startsWith('O:') ? asset.map.obstruction_layers?.find(item => item.id === selectedLayer.slice(2)) : undefined;
  const edit = (label: string, mutate: (asset: MapEditableAsset) => void) => onEdit(label, mutate);
  const [convert, setConvert] = useState(false);
  return <>
    <MapLayerStack {...props} />
    <div className={css.actions}><button onClick={() => edit('Add layer', draft => {onSelectLayer(String(addLayer(draft)));})}>Add art layer</button><button disabled={selected < 0} onClick={() => edit('Remove layer', draft => {removeLayer(draft, selected); onSelectLayer('0');})}>Remove layer</button></div>
    {layer && <>
      <Field label="Layer name" value={layer.name} onChange={value => edit('Rename layer', draft => renameLayer(draft, selected, value))} />
      <Options label="Art tileset" value={layer.vsp} options={Object.keys(asset.map.vsp).map(key => [key, key])} onChange={value => edit('Assign tileset', draft => {draft.map.layers[selected].vsp = value;})} />
      <Field label="Layer width" number min={1} value={layer.dimensions.X} onChange={value => edit('Resize layer', draft => resizeLayer(draft, selectedLayer, Number(value), layer.dimensions.Y))} />
      <Field label="Layer height" number min={1} value={layer.dimensions.Y} onChange={value => edit('Resize layer', draft => resizeLayer(draft, selectedLayer, layer.dimensions.X, Number(value)))} />
      {(['X', 'Y'] as const).map(axis => <React.Fragment key={axis}>
        <Field label={`Offset ${axis}`} number value={layer.offset?.[axis] ?? 0} onChange={value => edit('Layer offset', draft => {const item = draft.map.layers[selected]; item.offset = {...item.offset ?? {X: 0, Y: 0}, [axis]: Number(value)};})} />
        <Field label={`Parallax ${axis}`} number value={layer.parallax[axis]} onChange={value => edit('Layer parallax', draft => {draft.map.layers[selected].parallax[axis] = Number(value);})} />
      </React.Fragment>)}
      <Field label="Layer opacity" number min={0} max={1} value={layer.alpha} onChange={value => edit('Layer opacity', draft => {draft.map.layers[selected].alpha = Number(value);})} />
      <Check label="Layer visible" checked={!layer.MAPED_HIDDEN} onChange={value => edit('Layer visibility', draft => {draft.map.layers[selected].MAPED_HIDDEN = !value;})} />
      <Check label="Layer entities visible" checked={!layer.maped_HIDE_ENTS} onChange={value => edit('Layer entity visibility', draft => {draft.map.layers[selected].maped_HIDE_ENTS = !value;})} />
      <Check label="Redraw tall entities here" checked={asset.map.tallentitylayer === layer.name || (asset.map.tallentitylayer as unknown) === selected} onChange={value => edit('Tall entity redraw layer', draft => {draft.map.tallentitylayer = value ? layer.name : '';})} />
    </>}
    {obstruction && <>
      <Field label="Obstruction name" value={obstruction.name} onChange={value => edit('Rename obstruction layer', draft => {draft.map.obstruction_layers!.find(item => item.id === obstruction.id)!.name = value;})} />
      <Options label="Obstruction tileset" value={obstruction.vsp} options={Object.keys(asset.map.vsp).map(key => [key, key])} onChange={value => edit('Obstruction tileset', draft => {draft.map.obstruction_layers!.find(item => item.id === obstruction.id)!.vsp = value;})} />
      <Field label="Obstruction width" number min={1} value={obstruction.dimensions.X} onChange={value => edit('Resize obstruction layer', draft => resizeLayer(draft, selectedLayer, Number(value), obstruction.dimensions.Y))} />
      <Field label="Obstruction height" number min={1} value={obstruction.dimensions.Y} onChange={value => edit('Resize obstruction layer', draft => resizeLayer(draft, selectedLayer, obstruction.dimensions.X, Number(value)))} />
      {(['X', 'Y'] as const).map(axis => <Field key={axis} label={`Obstruction offset ${axis}`} number value={obstruction.offset?.[axis] ?? 0} onChange={value => edit('Obstruction offset', draft => {const layer = draft.map.obstruction_layers!.find(item => item.id === obstruction.id)!; layer.offset = {...layer.offset ?? {X: 0, Y: 0}, [axis]: Number(value)};})} />)}
      <Check label="Obstruction layer visible" checked={!obstruction.MAPED_HIDDEN} onChange={value => edit('Obstruction visibility', draft => {draft.map.obstruction_layers!.find(item => item.id === obstruction.id)!.MAPED_HIDDEN = !value;})} />
      <button onClick={() => edit('Remove obstruction layer', draft => {removeObstructionLayer(draft, obstruction.id); onSelectLayer(draft.map.layers.length ? '0' : 'E');})}>Remove obstruction layer</button>
    </>}
    {asset.map.format_version === 2 ? <button disabled={!Object.keys(asset.map.vsp).length} title={Object.keys(asset.map.vsp).length ? 'Create a layer with one tileset' : 'Import a tileset first'} onClick={() => edit('Add obstruction layer', draft => {onSelectLayer(`O:${addObstructionLayer(draft, 'New obstructions', 'obstructions' in draft.map.vsp ? 'obstructions' : Object.keys(draft.map.vsp)[0])}`);})}>Add obstruction layer</button> : <>
      <button onClick={() => setConvert(!convert)}>Convert to extended map…</button>
      {convert && <div role="alert"><p>Extended maps require Save As and cannot load in the unchanged Sully runtime.</p><button onClick={() => {edit('Convert to extended map', upgradeMap); setConvert(false);}}>Convert format</button><button onClick={() => setConvert(false)}>Cancel</button></div>}
    </>}
  </>;
}
function InfoPanel({asset, onEdit}: MapPanelProps) {
  const set = (key: string, value: any) => onEdit(`Map ${key}`, draft => {draft.map[key] = value;});
  const size = asset.map.dimensions ?? {X: Math.max(1, ...asset.map.layers.map(layer => layer.dimensions.X)), Y: Math.max(1, ...asset.map.layers.map(layer => layer.dimensions.Y))}, tiles = mapTileSize(asset);
  const notes = Array.isArray(asset.map.notes) ? asset.map.notes : [];
  return <>
    <Field label="Map name" value={asset.map.name ?? ''} onChange={value => set('name', value)} />
    <Field label="Music" value={asset.map.music ?? ''} onChange={value => set('music', value)} />
    <Field label="Initialization script" value={asset.map.initscript ?? ''} onChange={value => set('initscript', value)} />
    <Field label="Render order" value={asset.map.renderstring} onChange={value => set('renderstring', value)} />
    <Options label="Tall entity redraw layer" value={asset.map.tallentitylayer ?? ''} options={[['', 'None'], ...asset.map.layers.map(layer => [layer.name, layer.name] as [string, string])]} onChange={value => set('tallentitylayer', value)} />
    {asset.map.format_version === 2 && <fieldset><legend>Global map grid</legend>
      <Field label="Map grid width" number min={1} value={size.X} onChange={value => onEdit('Resize map grid', draft => resizeMapGrid(draft, Number(value), size.Y))} />
      <Field label="Map grid height" number min={1} value={size.Y} onChange={value => onEdit('Resize map grid', draft => resizeMapGrid(draft, size.X, Number(value)))} />
      <Field label="Map tile width" number min={1} value={tiles.width} onChange={value => onEdit('Map tile size', draft => setMapTileSize(draft, Number(value), tiles.height))} />
      <Field label="Map tile height" number min={1} value={tiles.height} onChange={value => onEdit('Map tile size', draft => setMapTileSize(draft, tiles.width, Number(value)))} />
      <p>Art and obstruction layers retain their own bounds. Shrinking this grid clips zone cells.</p>
    </fieldset>}
    <details><summary>Map notes ({notes.length})</summary>
      {notes.map((note: any, index: number) => <fieldset key={index}><legend>Note {index + 1}</legend><Field label={`Note ${index + 1} text`} value={note.text ?? ''} onChange={value => onEdit('Edit note', draft => {draft.map.notes[index].text = value;})} />{(['x', 'y'] as const).map(axis => <Field key={axis} label={`Note ${index + 1} ${axis.toUpperCase()}`} number value={note[axis] ?? 0} onChange={value => onEdit('Move note', draft => {draft.map.notes[index][axis] = typeof note[axis] === 'string' ? value : Number(value);})} />)}<button onClick={() => onEdit('Remove note', draft => {draft.map.notes.splice(index, 1);})}>Remove note {index + 1}</button></fieldset>)}
      <button onClick={() => onEdit('Add note', draft => {(draft.map.notes ??= []).push({x: 0, y: 0, text: ''});})}>Add note</button>
    </details>
    <p>{asset.map.layers.length} art layers · {asset.map.entities.length} entities · {asset.map.zones.length} zone definitions</p>
    <p>Format: {asset.map.format_version === 2 ? 'Extended v2' : 'Legacy Sully'}</p>
    <details><summary>Raw map metadata</summary><pre>{JSON.stringify(asset.map, (key, value) => key === 'entities' ? `[${value.length} entities]` : value, 2)}</pre></details>
  </>;
}
function EntitiesPanel(props: MapPanelProps) {
  const {asset, selectedEntity, onSelectEntity, onEdit} = props, entity = asset.map.entities.find(item => item.uuid === selectedEntity);
  const [clipboardStatus, setClipboardStatus] = useState('');
  const [spriteReference, setSpriteReference] = useState(''), [importing, setImporting] = useState(false), [importError, setImportError] = useState('');
  const tileSize = mapTileSize(asset), grid = {tileWidth: tileSize.width, tileHeight: tileSize.height};
  const px = entity?.location.px ?? (entity?.location.tx ?? 0) * grid.tileWidth, py = entity?.location.py ?? (entity?.location.ty ?? 0) * grid.tileHeight;
  const set = (key: string, value: any) => onEdit(`Entity ${key}`, draft => {const target = draft.map.entities.find(item => item.uuid === selectedEntity); if (target) target[key] = value;});
  const copy = async (text: string) => {try {await navigator.clipboard.writeText(text); setClipboardStatus('Copied');} catch {setClipboardStatus('Clipboard unavailable');}};
  return <>
    <div className={css.list} role="listbox" aria-label="Map entities">{asset.map.entities.map(item => <button role="option" aria-selected={item.uuid === selectedEntity} key={item.uuid} onClick={() => {onSelectEntity(item.uuid); props.onSelectLayer('E');}}>{item.name}</button>)}</div>
    <div className={css.actions}><button onClick={() => onEdit('Add entity', draft => onSelectEntity(createEntity(draft).uuid))}>Add entity</button><button disabled={!entity} onClick={() => onEdit('Clone entity', draft => onSelectEntity(cloneEntity(draft, selectedEntity!).uuid))}>Clone entity</button><button disabled={!entity} onClick={() => onEdit('Remove entity', draft => removeEntity(draft, selectedEntity!))}>Remove entity</button></div>
    {props.onAddSprite && <fieldset><legend>Import CrustySprite</legend><label className={css.field}>Sprite JSON reference<input aria-label="Sprite JSON reference" value={spriteReference} onChange={event => setSpriteReference(event.target.value)} placeholder="chrs/example.json or file URL" /></label><button disabled={importing || !spriteReference.trim()} onClick={async () => {setImporting(true); setImportError(''); try {await props.onAddSprite!(spriteReference.trim()); if (entity) set('filename', spriteReference.trim());} catch (cause) {setImportError(cause instanceof Error ? cause.message : String(cause));} finally {setImporting(false);}}}>{importing ? 'Importing sprite…' : 'Import sprite'}</button>{importError && <p role="alert">{importError}</p>}</fieldset>}
    {entity && <>
      <Field label="Entity name" value={entity.name} onChange={value => set('name', value)} />
      <Field label="Sprite path" value={entity.filename} onChange={value => set('filename', value)} />
      {!!Object.keys(asset.sprites ?? {}).length && <Options label="Loaded sprite" value={entity.filename} options={Array.from(new Set([entity.filename, ...Object.keys(asset.sprites ?? {})])).map(key => [key, key])} onChange={value => set('filename', value)} />}
      <Options label="Entity layer" value={entity.location.layer} options={[["Entity Layer (E)", 'Entity pass (E)'], ...asset.map.layers.map(layer => [layer.name, layer.name] as [string, string])]} onChange={value => set('location', {...entity.location, layer: value})} />
      <Options label="Entity animation" value={entity.animation ?? ''} options={Array.from(new Set([entity.animation ?? '', ...Object.keys(asset.sprites?.[entity.filename]?.definition.animations ?? {})])).map(key => [key, key])} onChange={value => set('animation', value)} />
      {(['X', 'Y'] as const).map(axis => <React.Fragment key={axis}><Field label={`Entity pixel ${axis}`} number value={axis === 'X' ? px : py} onChange={value => onEdit('Move entity', draft => moveEntity(draft, entity.uuid, axis === 'X' ? Number(value) : px, axis === 'Y' ? Number(value) : py))} /><Field label={`Entity tile ${axis}`} number value={axis === 'X' ? Math.floor(px / grid.tileWidth) : Math.floor(py / grid.tileHeight)} onChange={value => onEdit('Move entity', draft => moveEntity(draft, entity.uuid, axis === 'X' ? Number(value) * grid.tileWidth : px, axis === 'Y' ? Number(value) * grid.tileHeight : py))} /></React.Fragment>)}
      <Options label="Entity facing" value={entity.facing ?? 'Down'} options={['Down', 'Up', 'Left', 'Right'].map(key => [key, key])} onChange={value => set('facing', value)} />
      <Field label="Entity speed" number min={0} value={entity.speed ?? 100} onChange={value => set('speed', Number(value))} />
      <Field label="Activation script" value={entity.activation_script ?? ''} onChange={value => set('activation_script', value)} />
      {['pays_attention_to_obstructions', 'is_an_obstruction', 'autofaces'].map(key => <Check key={key} label={key.replace(/_/g, ' ')} checked={Boolean(entity[key])} onChange={value => set(key, value)} />)}
      <Options label="Wander mode" value={entity.wander?.mode ?? 'Scripted'} options={['Scripted', 'Rectangle', 'Zone'].map(key => [key, key])} onChange={value => set('wander', {...entity.wander, mode: value})} />
      <Field label="Wander delay" number min={0} value={entity.wander?.delay ?? 0} onChange={value => set('wander', {...entity.wander, delay: Number(value)})} />
      <Field label="Initial movestring" value={entity.wander?.initial_movestring ?? ''} onChange={value => set('wander', {...entity.wander, initial_movestring: value})} />
      <button onClick={() => set('activation_script', activationScriptName(entity.name))}>Generate activation script name</button><button onClick={() => void copy(sullyEntityCode(entity))}>Copy entity C#</button>
      <JsonField label="Entity properties" value={entity} onChange={value => {if (!value.location || typeof value.location.layer !== 'string' || typeof value.filename !== 'string' || typeof value.name !== 'string') throw new Error('Entity needs name, filename, and location.layer'); onEdit('Edit entity properties', draft => {const index = draft.map.entities.findIndex(item => item.uuid === entity.uuid); draft.map.entities[index] = {...value, uuid: entity.uuid} as typeof entity;});}} />
    </>}
    <button onClick={() => void copy(asset.map.entities.map(sullyEntityCode).join('\n'))}>Copy all entities C#</button><span role="status">{clipboardStatus}</span>
  </>;
}
function ZonesPanel(props: MapPanelProps) {
  const {asset, primaryTile, onPrimaryTileChange, onEdit} = props, index = Math.min(primaryTile, Math.max(0, asset.map.zones.length - 1)), zone = asset.map.zones[index];
  const [status, setStatus] = useState('');
  const set = (key: string, value: any) => onEdit(`Zone ${key}`, draft => updateZone(draft, index, {[key]: value}));
  return <><div className={css.list} role="listbox" aria-label="Map zones">{asset.map.zones.map((item, i) => <button role="option" aria-selected={i === index} key={i} onClick={() => {onPrimaryTileChange(i); props.onSelectLayer('Z'); props.onToolChange('brush');}}>{i}. {item.name}</button>)}</div><button onClick={() => onEdit('Add zone', draft => {onPrimaryTileChange(createZone(draft)); props.onSelectLayer('Z');})}>Add zone</button>{zone && <><Field label="Zone name" value={zone.name ?? ''} onChange={value => set('name', value)} /><Field label="Zone activation script" value={zone.activation_script ?? ''} onChange={value => set('activation_script', value)} /><Field label="Activation chance" number min={0} max={1} value={zone.activation_chance ?? 1} onChange={value => set('activation_chance', Number(value))} /><Check label="Adjacent activation" checked={Boolean(zone.can_by_adjacent_activated)} onChange={value => set('can_by_adjacent_activated', value)} /><Check label="Same tile activation" checked={Boolean(zone.can_by_same_tile_activated)} onChange={value => set('can_by_same_tile_activated', value)} /><button onClick={() => set('activation_script', activationScriptName(zone.name))}>Generate zone script name</button><button onClick={async () => {try {await navigator.clipboard.writeText(sullyZoneCode(zone, index)); setStatus('Copied');} catch {setStatus('Clipboard unavailable');}}}>Copy zone C#</button><p role="status">{status}</p></>}</>;
}
function ScreenviewPanel({view = {}, onViewChange}: MapPanelProps) {
  const screen = view.screenview ?? {enabled: false, x: 0, y: 0, width: 320, height: 240, opacity: .35};
  return <><Check label="Show screen rectangle" checked={screen.enabled} onChange={enabled => onViewChange?.({screenview: {...screen, enabled}})} />{(['x', 'y', 'width', 'height', 'opacity'] as const).map(key => <Field key={key} label={`Screen ${key}`} number min={key === 'width' || key === 'height' ? 1 : key === 'opacity' ? 0 : undefined} max={key === 'opacity' ? 1 : undefined} value={screen[key]} onChange={value => onViewChange?.({screenview: {...screen, [key]: Number(value)}})} />)}{(['showObstructions', 'showZones', 'showEntities', 'showBounds', 'showHitboxes', 'showCanopies', 'checker'] as const).map(key => <Check key={key} label={key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()} checked={view[key] ?? key === 'showEntities'} onChange={value => onViewChange?.({[key]: value})} />)}</>;
}
function TilesetPanel(props: MapPanelProps) {
  const {asset, selectedLayer, primaryTile, onPrimaryTileChange, secondaryTile, onSecondaryTileChange} = props;
  let vsp = asset.map.layers[0]?.vsp ?? 'default';
  try {if (selectedLayer !== 'E') vsp = getLayerGrid(asset, selectedLayer).vsp;} catch { /* A removed selection resolves to the first tileset. */ }
  const tileset = asset.tilesets?.[vsp], def = tileset?.definition, tw = def?.tilesize?.width ?? def?.tilesize?.X ?? 16, th = def?.tilesize?.height ?? def?.tilesize?.Y ?? 16;
  let paletteImageUrl = tileset?.imageUrl;
  if (paletteImageUrl && (props.imageRevision ?? 0) > 0) {const fresh = new URL(paletteImageUrl, document.baseURI); fresh.searchParams.set('breaditorRevision', String(props.imageRevision)); paletteImageUrl = fresh.href;}
  const [imageSize, setImageSize] = useState({width: 0, height: 0});
  const [selection, setSelection] = useState<{x: number; y: number; width: number; height: number} | null>(null), drag = useRef<{x: number; y: number} | null>(null);
  const [importName, setImportName] = useState(''), [importReference, setImportReference] = useState(''), [importing, setImporting] = useState(false), [importError, setImportError] = useState('');
  useEffect(() => {setSelection(null); drag.current = null; setImageSize({width: 0, height: 0});}, [tileset?.imageUrl]);
  function tileAt(event: {clientX: number; clientY: number; currentTarget: HTMLImageElement}) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {x: Math.max(0, Math.min(Math.max(0, Math.floor(imageSize.width / tw) - 1), Math.floor((event.clientX - rect.left) / tw))), y: Math.max(0, Math.min(Math.max(0, Math.floor(imageSize.height / th) - 1), Math.floor((event.clientY - rect.top) / th)))};
  }
  function area(a: {x: number; y: number}, b: {x: number; y: number}) {return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1};}
  const columns = def?.tiles_per_row || Math.floor(imageSize.width / tw) || 1;
  return <><p>Tileset: {vsp}</p><Field label="Primary tile" number min={0} value={primaryTile} onChange={value => {onPrimaryTileChange(Number(value)); props.onStampChange?.(null); setSelection(null);}} /><Field label="Secondary tile" number min={0} value={secondaryTile} onChange={value => onSecondaryTileChange(Number(value))} /><button onClick={() => {onPrimaryTileChange(secondaryTile); onSecondaryTileChange(primaryTile); props.onStampChange?.(null); setSelection(null);}}>Swap tiles</button>
    {props.onAddTileset && <fieldset><legend>Import tileset</legend><label className={css.field}>Tileset name<input aria-label="Tileset name" value={importName} onChange={event => setImportName(event.target.value)} placeholder="default" /></label><label className={css.field}>Tileset JSON reference<input aria-label="Tileset JSON reference" value={importReference} onChange={event => setImportReference(event.target.value)} placeholder="map.vsp.json or file URL" /></label><button disabled={importing || !importName.trim() || !importReference.trim()} onClick={async () => {setImporting(true); setImportError(''); try {await props.onAddTileset!(importName.trim(), importReference.trim()); setImportName(''); setImportReference('');} catch (cause) {setImportError(cause instanceof Error ? cause.message : String(cause));} finally {setImporting(false);}}}>{importing ? 'Importing tileset…' : 'Import tileset'}</button>{importError && <p role="alert">{importError}</p>}</fieldset>}
    {tileset ? <div className={css.tileset}><div className={css.paletteSurface}><img src={paletteImageUrl} alt={`${vsp} tile palette`} draggable={false} style={{maxWidth: 'none', imageRendering: 'pixelated'}} onLoad={event => setImageSize({width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight})}
      onPointerDown={event => {if (event.button !== 0) return; event.preventDefault(); const tile = tileAt(event); drag.current = tile; setSelection(area(tile, tile)); event.currentTarget.setPointerCapture?.(event.pointerId);}}
      onPointerMove={event => {if (drag.current) setSelection(area(drag.current, tileAt(event)));}}
      onPointerUp={event => {if (!drag.current) return; const selected = area(drag.current, tileAt(event)); setSelection(selected); drag.current = null; if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); const tiles = Array.from({length: selected.width * selected.height}, (_, i) => (selected.y + Math.floor(i / selected.width)) * columns + selected.x + i % selected.width); onPrimaryTileChange(tiles[0]); props.onStampChange?.({width: selected.width, height: selected.height, tiles});}}
      onPointerCancel={() => {drag.current = null; setSelection(null); props.onStampChange?.(null);}}
      onContextMenu={event => {event.preventDefault(); const tile = tileAt(event); onSecondaryTileChange(tile.y * columns + tile.x);}} />
      {selection && <div data-testid="tile-stamp-selection" className={css.tileSelection} style={{left: selection.x * tw, top: selection.y * th, width: selection.width * tw, height: selection.height * th}} />}
    </div></div> : <p role="status">This layer has no loaded tileset. Import a VSP JSON file and assign it in Layers.</p>}
    {selection && <p role="status">Stamp: {selection.width} × {selection.height} <button onClick={() => {setSelection(null); props.onStampChange?.(null);}}>Clear stamp</button></p>}
    <p>Drag a rectangle to select a brush stamp. Right-click selects the secondary tile.</p>
  </>;
}
export function MapPanel(props: MapPanelProps) {
  const name = props.panel.toLowerCase().replace(/^panel/, '');
  const body = name.includes('layer') ? <LayersPanel {...props} /> : name.includes('entit') ? <EntitiesPanel {...props} /> : name.includes('zone') ? <ZonesPanel {...props} /> : name.includes('screen') ? <ScreenviewPanel {...props} /> : name.includes('tile') ? <TilesetPanel {...props} /> : <InfoPanel {...props} />;
  return <section className={css.panel} aria-label={`Map ${props.panel}`}>{body}</section>;
}
export interface MapToolbarProps {tool: MapTool; onToolChange: (tool: MapTool) => void; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean; paused?: boolean; onPause?: () => void; onFit?: () => void; onReset?: () => void; onExportPng?: () => void; onSmartEyedropper?: () => void}
export function MapToolbar(props: MapToolbarProps) {return <div className={css.toolbar} role="toolbar" aria-label="Map tools">{(['pan', 'brush', 'fill', 'select', 'eyedropper', 'entity', 'zone'] as MapTool[]).map(tool => <button key={tool} aria-pressed={props.tool === tool} onClick={() => props.onToolChange(tool)}>{tool}</button>)}{props.onSmartEyedropper && <button onClick={props.onSmartEyedropper}>Smart eyedropper</button>}<button disabled={!props.canUndo} onClick={props.onUndo}>Undo</button><button disabled={!props.canRedo} onClick={props.onRedo}>Redo</button><button onClick={props.onPause}>{props.paused ? 'Play' : 'Pause'}</button><button onClick={props.onFit}>Fit</button><button onClick={props.onReset}>100%</button>{props.onExportPng && <button onClick={props.onExportPng}>Export PNG</button>}</div>;}
