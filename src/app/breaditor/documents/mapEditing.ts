/** Mutable editing operations. Call inside the document session's undo transaction. */
export type MapTool = 'pan' | 'brush' | 'fill' | 'select' | 'eyedropper' | 'entity' | 'zone';
export interface MapPoint {X: number; Y: number}
export interface MapLayer {name: string; dimensions: MapPoint; parallax: MapPoint; alpha: number; vsp: string; offset?: MapPoint; MAPED_HIDDEN?: boolean; [key: string]: any}
export interface MapEntity {uuid: string; name: string; filename: string; location: {layer: string; px?: number; py?: number; tx?: number; ty?: number; [key: string]: any}; [key: string]: any}
export interface ObstructionLayer {id: string; name: string; vsp: string; dimensions: MapPoint; offset?: MapPoint; [key: string]: any}
export interface MapEditableAsset {
  map: {layers: MapLayer[]; vsp: Record<string, string>; entities: MapEntity[]; zones: any[]; renderstring: string; tallentitylayer?: string; dimensions?: MapPoint; tile_size?: MapPoint | {width: number; height: number}; obstruction_layers?: ObstructionLayer[]; [key: string]: any};
  data: {tile_data: number[][]; legacy_obstruction_data: number[]; zone_data: {x: number; y: number; z: number}[]; obstruction_data?: Record<string, number[]>; [key: string]: any};
  tilesets?: Record<string, {definition: any; imageUrl: string}>;
  sprites?: Record<string, {definition: any; imageUrl: string; [key: string]: any}>;
}
export interface TileCell {x: number; y: number; tile?: number}
export interface MapRect {x: number; y: number; width: number; height: number}
export interface MapGrid {width: number; height: number; tileWidth: number; tileHeight: number; offsetX: number; offsetY: number; data: number[]; vsp: string}
export interface TileClipboard {width: number; height: number; layers: {target: string; tiles: number[]}[]}

function positive(value: number) {if (!Number.isInteger(value) || value <= 0) throw new Error('Dimensions must be positive whole numbers'); return value;}
function clone<T>(value: T): T {return JSON.parse(JSON.stringify(value));}
function dimensions(asset: MapEditableAsset) {return asset.map.dimensions ?? {X: Math.max(1, ...asset.map.layers.map(layer => layer.dimensions.X)), Y: Math.max(1, ...asset.map.layers.map(layer => layer.dimensions.Y))};}
function tileSize(asset: MapEditableAsset, vsp: string) {
  const size = asset.tilesets?.[vsp]?.definition.tilesize ?? asset.map.tile_size ?? asset.tilesets?.default?.definition.tilesize ?? asset.tilesets?.[asset.map.layers[0]?.vsp]?.definition.tilesize ?? {width: 16, height: 16};
  return {width: Number('X' in size ? size.X : size.width) || 16, height: Number('Y' in size ? size.Y : size.height) || 16};
}
export function mapTileSize(asset: MapEditableAsset) {
  const size = asset.map.tile_size ?? asset.tilesets?.default?.definition.tilesize ?? asset.tilesets?.[asset.map.layers[0]?.vsp]?.definition.tilesize ?? {width: 16, height: 16};
  return {width: Number('X' in size ? size.X : size.width) || 16, height: Number('Y' in size ? size.Y : size.height) || 16};
}
export function getLayerGrid(asset: MapEditableAsset, target: string): MapGrid {
  let size = dimensions(asset), offset = {X: 0, Y: 0}, vsp = target === 'Z' ? 'default' : 'obstructions', data: number[];
  if (target === 'Z') {
    size = asset.map.format_version === 2 ? size : asset.map.zone_layer_size ?? size;
    data = new Array(size.X * size.Y).fill(0);
    for (const cell of asset.data.zone_data) if (cell.x >= 0 && cell.y >= 0 && cell.x < size.X && cell.y < size.Y) data[cell.y * size.X + cell.x] = cell.z;
  } else if (target === 'O:legacy' && !asset.map.obstruction_layers?.some(layer => layer.id === 'legacy')) {
    size = asset.map.obstructions_layer?.dimensions ?? size; offset = asset.map.obstructions_layer?.offset ?? offset;
    vsp = asset.map.obstructions_layer?.vsp ?? vsp;
    data = asset.data.legacy_obstruction_data ?? [];
  } else if (target.startsWith('O:')) {
    const layer = asset.map.obstruction_layers?.find(layer => layer.id === target.slice(2));
    if (!layer) throw new Error(`Unknown obstruction layer: ${target}`);
    size = layer.dimensions; offset = layer.offset ?? offset; vsp = layer.vsp;
    data = asset.data.obstruction_data?.[layer.id] ?? new Array(size.X * size.Y).fill(0);
  } else {
    const index = Number(target), layer = asset.map.layers[index];
    if (!Number.isInteger(index) || !layer) throw new Error(`Unknown tile layer: ${target}`);
    size = layer.dimensions; offset = layer.offset ?? offset; vsp = layer.vsp;
    data = asset.data.tile_data[index] ?? new Array(size.X * size.Y).fill(0);
  }
  const tiles = target === 'Z' ? mapTileSize(asset) : tileSize(asset, vsp);
  return {width: size.X, height: size.Y, tileWidth: tiles.width, tileHeight: tiles.height, offsetX: offset.X, offsetY: offset.Y, data, vsp};
}
export function readTile(asset: MapEditableAsset, target: string, x: number, y: number) {
  const grid = getLayerGrid(asset, target);
  return x < 0 || y < 0 || x >= grid.width || y >= grid.height ? 0 : grid.data[y * grid.width + x] ?? 0;
}
export function paintTiles(asset: MapEditableAsset, target: string, cells: TileCell[], tile = 0) {
  const grid = getLayerGrid(asset, target);
  const valid = cells.filter(cell => Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height);
  if (target === 'Z') {
    const previous = new Map(asset.data.zone_data.map(cell => [`${cell.x},${cell.y}`, cell]));
    const edits = new Map(valid.map(cell => [`${cell.x},${cell.y}`, {...previous.get(`${cell.x},${cell.y}`), x: cell.x, y: cell.y, z: cell.tile ?? tile}]));
    asset.data.zone_data = asset.data.zone_data.filter(cell => !edits.has(`${cell.x},${cell.y}`));
    asset.data.zone_data.push(...Array.from(edits.values()).filter(cell => cell.z !== 0));
  } else {
    if (!valid.length) return;
    for (const cell of valid) grid.data[cell.y * grid.width + cell.x] = cell.tile ?? tile;
    if (target === 'O:legacy' && !asset.map.obstruction_layers?.some(layer => layer.id === 'legacy')) asset.data.legacy_obstruction_data = grid.data;
    else if (target.startsWith('O:')) (asset.data.obstruction_data ??= {})[target.slice(2)] = grid.data;
    else asset.data.tile_data[Number(target)] = grid.data;
  }
}
export function stampTiles(asset: MapEditableAsset, target: string, x: number, y: number, stamp: {width: number; height: number; tiles: number[]}) {
  paintTiles(asset, target, stamp.tiles.map((tile, index) => ({x: x + index % stamp.width, y: y + Math.floor(index / stamp.width), tile})).filter(cell => cell.y < y + stamp.height));
}
export function fillTiles(asset: MapEditableAsset, target: string, x: number, y: number, tile: number) {
  const grid = getLayerGrid(asset, target);
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
  const old = grid.data[y * grid.width + x] ?? 0;
  if (old === tile) return;
  const seen = new Uint8Array(grid.width * grid.height), pending = [y * grid.width + x], cells: TileCell[] = [];
  while (pending.length) {
    const index = pending.pop()!;
    if (seen[index]) continue;
    seen[index] = 1;
    if ((grid.data[index] ?? 0) !== old) continue;
    const cx = index % grid.width, cy = Math.floor(index / grid.width);
    cells.push({x: cx, y: cy});
    if (cx > 0) pending.push(index - 1);
    if (cx + 1 < grid.width) pending.push(index + 1);
    if (cy > 0) pending.push(index - grid.width);
    if (cy + 1 < grid.height) pending.push(index + grid.width);
  }
  paintTiles(asset, target, cells, tile);
}
export function copySelection(asset: MapEditableAsset, targets: string[], rect: MapRect): TileClipboard {
  positive(rect.width); positive(rect.height);
  return {width: rect.width, height: rect.height, layers: targets.map(target => ({target, tiles: Array.from({length: rect.width * rect.height}, (_, i) => readTile(asset, target, rect.x + i % rect.width, rect.y + Math.floor(i / rect.width)))}))};
}
export function cutSelection(asset: MapEditableAsset, targets: string[], rect: MapRect) {
  const copied = copySelection(asset, targets, rect);
  for (const target of targets) paintTiles(asset, target, Array.from({length: rect.width * rect.height}, (_, i) => ({x: rect.x + i % rect.width, y: rect.y + Math.floor(i / rect.width)})), 0);
  return copied;
}
export function pasteSelection(asset: MapEditableAsset, clipboard: TileClipboard, x: number, y: number, target?: string) {
  clipboard.layers.forEach((layer, index) => stampTiles(asset, target && index === 0 ? target : layer.target, x, y, {...clipboard, tiles: layer.tiles}));
}

export function addLayer(asset: MapEditableAsset, name = 'New layer', vsp = Object.keys(asset.map.vsp)[0] ?? '') {
  const size = clone(dimensions(asset)), index = asset.map.layers.length;
  // Insert before surplus legacy arrays rather than overwriting unbound data.
  asset.map.layers.push({name, dimensions: size, parallax: {X: 1, Y: 1}, offset: {X: 0, Y: 0}, alpha: 1, vsp});
  asset.data.tile_data.splice(index, 0, new Array(size.X * size.Y).fill(0));
  asset.map.renderstring = [...asset.map.renderstring.split(',').filter(Boolean), String(index + 1)].join(',');
  return index;
}
export function renameLayer(asset: MapEditableAsset, index: number, name: string) {
  if (!name.trim() || asset.map.layers.some((layer, i) => i !== index && layer.name === name)) throw new Error('Layer names must be nonempty and unique');
  const layer = asset.map.layers[index], old = layer.name;
  layer.name = name;
  if (asset.map.tallentitylayer === old) asset.map.tallentitylayer = name;
  for (const entity of asset.map.entities) if (entity.location.layer === old) entity.location.layer = name;
}
function remapRender(asset: MapEditableAsset, mapping: Map<number, number>) {
  asset.map.renderstring = asset.map.renderstring.split(',').filter(Boolean).flatMap(token => {
    if (!/^\d+$/.test(token.trim())) return [token];
    const result = mapping.get(Number(token) - 1);
    return result === undefined ? [] : [String(result + 1)];
  }).join(',');
}
export function removeLayer(asset: MapEditableAsset, index: number) {
  if (!asset.map.layers[index]) return;
  const oldName = asset.map.layers[index].name, count = asset.map.layers.length;
  asset.map.layers.splice(index, 1); asset.data.tile_data.splice(index, 1);
  remapRender(asset, new Map(Array.from({length: count}, (_, i) => [i, i > index ? i - 1 : i] as [number, number]).filter(([i]) => i !== index)));
  if (asset.map.tallentitylayer === oldName) asset.map.tallentitylayer = '';
  for (const entity of asset.map.entities) if (entity.location.layer === oldName) entity.location.layer = 'Entity Layer (E)';
}
export function reorderLayer(asset: MapEditableAsset, from: number, to: number) {
  if (!asset.map.layers[from] || to < 0 || to >= asset.map.layers.length || from === to) return;
  const order = asset.map.layers.map((_, i) => i), [moved] = order.splice(from, 1); order.splice(to, 0, moved);
  const layers = [...asset.map.layers], tiles = [...asset.data.tile_data];
  asset.map.layers = order.map(index => layers[index]);
  asset.data.tile_data = [...order.map(index => tiles[index]), ...tiles.slice(order.length)];
  remapRender(asset, new Map(order.map((old, current) => [old, current])));
}
export function resizeLayer(asset: MapEditableAsset, target: string, width: number, height: number) {
  positive(width); positive(height);
  const grid = getLayerGrid(asset, target), resized = new Array(width * height).fill(0);
  for (let y = 0; y < Math.min(height, grid.height); y++) for (let x = 0; x < Math.min(width, grid.width); x++) resized[y * width + x] = grid.data[y * grid.width + x] ?? 0;
  if (target.startsWith('O:') && target !== 'O:legacy') {
    const layer = asset.map.obstruction_layers!.find(layer => layer.id === target.slice(2))!;
    layer.dimensions = {X: width, Y: height}; asset.data.obstruction_data![layer.id] = resized;
  } else if (/^\d+$/.test(target)) {asset.map.layers[Number(target)].dimensions = {X: width, Y: height}; asset.data.tile_data[Number(target)] = resized;}
  else throw new Error('Resize the map grid for legacy obstructions and zones');
}
/** Changes the global grid while retaining independently authored art and obstruction bounds. */
export function resizeMapGrid(asset: MapEditableAsset, width: number, height: number) {
  if (asset.map.format_version !== 2) throw new Error('Convert to extended map format before resizing the map grid');
  positive(width); positive(height); asset.map.dimensions = {X: width, Y: height};
  asset.data.zone_data = asset.data.zone_data.filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height);
}
export function setMapTileSize(asset: MapEditableAsset, width: number, height: number) {
  if (asset.map.format_version !== 2) throw new Error('Convert to extended map format before changing the map grid tile size');
  positive(width); positive(height); asset.map.tile_size = {width, height};
}
function uuid() {return globalThis.crypto?.randomUUID?.() ?? `entity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}
export function createEntity(asset: MapEditableAsset, values: Partial<MapEntity> = {}) {
  const entity: MapEntity = {uuid: uuid(), name: 'New entity', filename: Object.keys(asset.sprites ?? {})[0] ?? '', location: {layer: 'Entity Layer (E)', px: 0, py: 0, tx: 0, ty: 0}, animation: 'Idle Down', facing: 'Down', speed: 100, activation_script: '', pays_attention_to_obstructions: false, is_an_obstruction: false, autofaces: false, MAPED_USEDEFAULT: false, wander: {mode: 'Scripted', delay: 0, initial_movestring: ''}, ...clone(values)};
  entity.uuid ||= uuid(); asset.map.entities.push(entity); return entity;
}
export function cloneEntity(asset: MapEditableAsset, id: string) {const source = asset.map.entities.find(entity => entity.uuid === id); if (!source) throw new Error('Entity not found'); return createEntity(asset, {...clone(source), uuid: uuid(), name: `${source.name} copy`});}
export function removeEntity(asset: MapEditableAsset, id: string) {asset.map.entities = asset.map.entities.filter(entity => entity.uuid !== id);}
export function updateEntity(asset: MapEditableAsset, id: string, fields: Partial<MapEntity>) {const entity = asset.map.entities.find(entity => entity.uuid === id); if (entity) Object.assign(entity, clone(fields), {uuid: id});}
export function moveEntity(asset: MapEditableAsset, id: string, px: number, py: number) {const entity = asset.map.entities.find(entity => entity.uuid === id); if (entity) {const tiles = mapTileSize(asset); Object.assign(entity.location, {px, py, tx: Math.floor(px / tiles.width), ty: Math.floor(py / tiles.height)});}}
export function createZone(asset: MapEditableAsset, fields: Record<string, any> = {}) {if (!asset.map.zones.length) asset.map.zones.push({name: 'NULL_ZONE', activation_script: '', activation_chance: 0, can_by_adjacent_activated: false}); asset.map.zones.push({name: 'New zone', activation_script: '', activation_chance: 1, can_by_adjacent_activated: false, ...clone(fields)}); return asset.map.zones.length - 1;}
export function updateZone(asset: MapEditableAsset, index: number, fields: Record<string, any>) {if (asset.map.zones[index]) Object.assign(asset.map.zones[index], clone(fields));}
export function upgradeMap(asset: MapEditableAsset) {
  if (asset.map.format_version === 2) return;
  asset.map.format_version = 2; asset.map.dimensions = clone(dimensions(asset));
  const size = tileSize(asset, asset.map.layers[0]?.vsp ?? 'default'); asset.map.tile_size = {width: size.width, height: size.height};
  asset.map.obstruction_layers = [{...asset.map.obstructions_layer, id: 'legacy', name: 'Obstructions', vsp: asset.map.obstructions_layer?.vsp ?? 'obstructions', dimensions: clone(asset.map.obstructions_layer?.dimensions ?? asset.map.dimensions), offset: clone(asset.map.obstructions_layer?.offset ?? {X: 0, Y: 0})}];
  asset.data.obstruction_data = {...asset.data.obstruction_data, legacy: [...asset.data.legacy_obstruction_data ?? []]};
}
export function addObstructionLayer(asset: MapEditableAsset, name: string, vsp: string) {
  if (asset.map.format_version !== 2) throw new Error('Convert to extended map format before adding obstruction layers');
  const id = uuid(), size = clone(dimensions(asset));
  (asset.map.obstruction_layers ??= []).push({id, name, vsp, dimensions: size, offset: {X: 0, Y: 0}});
  (asset.data.obstruction_data ??= {})[id] = new Array(size.X * size.Y).fill(0); return id;
}
export function removeObstructionLayer(asset: MapEditableAsset, id: string) {
  asset.map.obstruction_layers = asset.map.obstruction_layers?.filter(layer => layer.id !== id);
  if (asset.data.obstruction_data) delete asset.data.obstruction_data[id];
}
export function activationScriptName(name: string) {const result = name.normalize('NFKD').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, ''); return /^\d/.test(result) ? `_${result}` : result || 'Activate';}
export function sullyEntityReference(entity: MapEntity) {return `map.entities.by_name(${JSON.stringify(entity.name)})`;}
export function sullyPosition(px: number, py: number) {return `new Point(${Math.round(px)}, ${Math.round(py)})`;}
export function sullyEntityCode(entity: MapEntity) {const comment = `// ${JSON.stringify(entity.name)}, uuid: ${JSON.stringify(entity.uuid)}`; return entity.activation_script ? `public void ${activationScriptName(entity.activation_script)}( Entity e ) { ${comment}\n\n}\n` : `// no activation script ${comment}\n`;}
export function sullyZoneCode(zone: Record<string, any>, index: number) {const comment = `// Zone #${index}, name: ${JSON.stringify(zone.name)}`; return zone.activation_script ? `public void ${activationScriptName(zone.activation_script)}( ZoneActivationData zad ) { ${comment}\n\n}\n` : `// no activation script ${comment}\n`;}
export function sullyTileCode(clipboard: TileClipboard, x: number, y: number) {return clipboard.layers.filter(layer => /^\d+$/.test(layer.target)).flatMap(layer => layer.tiles.map((tile, index) => `SetTile( ${x + index % clipboard.width}, ${y + Math.floor(index / clipboard.width)}, ${Number(layer.target)}, ${tile} );`)).join('\n');}
