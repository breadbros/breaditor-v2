import {MapEditableAsset, addLayer, renameLayer, removeLayer, reorderLayer, resizeLayer, resizeMapGrid, setMapTileSize, paintTiles, fillTiles, copySelection, cutSelection, pasteSelection, getLayerGrid, readTile, createEntity, cloneEntity, moveEntity, updateEntity, createZone, updateZone, upgradeMap, addObstructionLayer, removeObstructionLayer, activationScriptName, sullyEntityCode, sullyZoneCode, sullyTileCode} from './mapEditing';

function fixture(): MapEditableAsset {return {
  map: {name: 'Fixture', layers: [{name: 'Ground', dimensions: {X: 3, Y: 2}, parallax: {X: 1, Y: 1}, alpha: 1, vsp: 'default'}, {name: 'Canopy', dimensions: {X: 2, Y: 3}, parallax: {X: 1, Y: 1}, alpha: 1, vsp: 'default'}], vsp: {default: 'art.vsp.json', obstructions: 'obs.vsp.json'}, renderstring: '1,E,2,R', tallentitylayer: 'Canopy', entities: [{uuid: 'person', name: 'Person', filename: 'person.json', location: {layer: 'Canopy', px: 16, py: 32}}], zones: [{name: 'NULL'}, {name: 'Door', custom: true}], notes: [{text: 'Retain'}], custom: {keep: true}},
  data: {tile_data: [[1, 1, 2, 1, 2, 2], [4, 0, 0, 4, 0, 0], [9, 8, 7]], legacy_obstruction_data: [0, 1, 0, 0, 0, 0, 0, 0, 0], zone_data: [{x: 1, y: 1, z: 1}], custom: ['retain']},
  tilesets: {default: {definition: {tilesize: {width: 8, height: 16}}, imageUrl: 'art.png'}}
};}

test('brush clips writes, keeps legacy surplus arrays and unknown metadata', () => {
  const asset = fixture();
  paintTiles(asset, '0', [{x: -1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}, {x: 0, y: 1, tile: 6}], 5);
  expect(asset.data.tile_data[0]).toEqual([1, 1, 5, 6, 2, 2]);
  expect(asset.data.tile_data[2]).toEqual([9, 8, 7]);
  expect(asset.map.custom).toEqual({keep: true});
  expect(asset.data.custom).toEqual(['retain']);
});

test('flood fill reaches connected cells only and handles same-tile fill', () => {
  const asset = fixture(); fillTiles(asset, '0', 0, 0, 3);
  expect(asset.data.tile_data[0]).toEqual([3, 3, 2, 3, 2, 2]);
  fillTiles(asset, '0', 0, 0, 3); fillTiles(asset, '0', -1, 0, 7);
  expect(asset.data.tile_data[0]).toEqual([3, 3, 2, 3, 2, 2]);
});

test('multilayer cut and paste retains source targets and clips edges', () => {
  const asset = fixture(), rect = {x: 0, y: 0, width: 2, height: 2};
  const clipboard = cutSelection(asset, ['0', '1'], rect);
  expect(clipboard.layers.map(layer => layer.tiles)).toEqual([[1, 1, 1, 2], [4, 0, 0, 4]]);
  expect(asset.data.tile_data[0]).toEqual([0, 0, 2, 0, 0, 2]);
  pasteSelection(asset, clipboard, 1, 1);
  expect(asset.data.tile_data[0]).toEqual([0, 0, 2, 0, 1, 1]);
  expect(asset.data.tile_data[1]).toEqual([0, 0, 0, 4, 0, 0]);
  expect(asset.data.tile_data[2]).toEqual([9, 8, 7]);
});

test('copy is detached and single-layer paste can target another layer', () => {
  const asset = fixture(), clipboard = copySelection(asset, ['0'], {x: 0, y: 0, width: 2, height: 1});
  paintTiles(asset, '0', [{x: 0, y: 0}], 10);
  pasteSelection(asset, clipboard, 0, 2, '1');
  expect(asset.data.tile_data[1].slice(4)).toEqual([1, 1]);
  expect(readTile(asset, '0', -1, 0)).toBe(0);
});

test('adding inserts bound data before orphan arrays; resizing retains coordinates', () => {
  const asset = fixture(), index = addLayer(asset, 'Sky');
  expect(index).toBe(2); expect(asset.map.layers[index].dimensions).toEqual({X: 3, Y: 3});
  expect(asset.data.tile_data[3]).toEqual([9, 8, 7]);
  resizeLayer(asset, '0', 2, 3);
  expect(asset.data.tile_data[0]).toEqual([1, 1, 1, 2, 0, 0]);
  expect(() => resizeLayer(asset, '0', 0, 2)).toThrow('Dimensions');
});

test('renaming updates entity and canopy references and rejects duplicate names', () => {
  const asset = fixture(); renameLayer(asset, 1, 'Leaves');
  expect(asset.map.tallentitylayer).toBe('Leaves'); expect(asset.map.entities[0].location.layer).toBe('Leaves');
  expect(() => renameLayer(asset, 1, 'Ground')).toThrow('unique');
});

test('reordering remaps numeric render tokens without changing visible draw order', () => {
  const asset = fixture(); reorderLayer(asset, 0, 1);
  expect(asset.map.renderstring).toBe('2,E,1,R'); expect(asset.map.layers[0].name).toBe('Canopy');
  expect(asset.data.tile_data[0]).toEqual([4, 0, 0, 4, 0, 0]); expect(asset.data.tile_data[2]).toEqual([9, 8, 7]);
});

test('removing a layer repairs named references and numeric render order', () => {
  const asset = fixture(); removeLayer(asset, 1);
  expect(asset.map.renderstring).toBe('1,E,R'); expect(asset.map.tallentitylayer).toBe('');
  expect(asset.map.entities[0].location.layer).toBe('Entity Layer (E)');
  expect(asset.data.tile_data[1]).toEqual([9, 8, 7]);
});

test('legacy obstruction and zone grids honor independent dimensions and offsets', () => {
  const asset = fixture();
  asset.map.obstructions_layer = {dimensions: {X: 1, Y: 2}, offset: {X: 32, Y: 16}};
  asset.map.zone_layer_size = {X: 4, Y: 5};
  expect(getLayerGrid(asset, 'O:legacy')).toMatchObject({width: 1, height: 2, offsetX: 32, offsetY: 16});
  expect(getLayerGrid(asset, 'Z')).toMatchObject({width: 4, height: 5});
});

test('zone painting preserves sparse storage, unrelated cells, and zero means erase', () => {
  const asset = fixture();
  paintTiles(asset, 'Z', [{x: 0, y: 0}, {x: 1, y: 0}], 1);
  paintTiles(asset, 'Z', [{x: 0, y: 0}], 0);
  expect(asset.data.zone_data).toEqual([{x: 1, y: 1, z: 1}, {x: 1, y: 0, z: 1}]);
  const index = createZone(asset, {name: 'Exit'}); updateZone(asset, index, {activation_script: 'exit'});
  expect(asset.map.zones[index].activation_script).toBe('exit'); expect(asset.map.zones[1].custom).toBe(true);
});

test('explicit upgrade keeps legacy data and edits normalized obstruction layers independently', () => {
  const asset = fixture();
  expect(() => addObstructionLayer(asset, 'Extra', 'obstructions')).toThrow('Convert');
  upgradeMap(asset); expect(asset.map.format_version).toBe(2); expect(asset.map.tile_size).toEqual({width: 8, height: 16});
  expect(asset.map.dimensions).toEqual({X: 3, Y: 3});
  paintTiles(asset, 'O:legacy', [{x: 0, y: 0}], 7);
  expect(asset.data.obstruction_data!.legacy[0]).toBe(7); expect(asset.data.legacy_obstruction_data[0]).toBe(0);
  const id = addObstructionLayer(asset, 'Extra', 'obstructions'); paintTiles(asset, `O:${id}`, [{x: 1, y: 0}], 3);
  expect(getLayerGrid(asset, `O:${id}`).data[1]).toBe(3);
  const before = JSON.stringify(asset); upgradeMap(asset); expect(JSON.stringify(asset)).toBe(before);
});

test('entity clones detach fields and pixel moves synchronize tile positions, including zero', () => {
  const asset = fixture(), copy = cloneEntity(asset, 'person');
  expect(copy.uuid).not.toBe('person'); copy.location.layer = 'Ground'; expect(asset.map.entities[0].location.layer).toBe('Canopy');
  moveEntity(asset, copy.uuid, 0, 48); expect(copy.location).toMatchObject({px: 0, py: 48, tx: 0, ty: 3});
  updateEntity(asset, copy.uuid, {uuid: 'bad', name: 'Renamed'}); expect(copy.uuid).not.toBe('bad');
  expect(createEntity(asset).uuid).not.toBe(copy.uuid);
});

test('read-only grid inspection never creates absent arrays', () => {
  const asset = fixture(); asset.data.tile_data = []; asset.map.format_version = 2; asset.map.obstruction_layers = [{id: 'new', name: 'Empty', vsp: 'obstructions', dimensions: {X: 2, Y: 2}}];
  const before = JSON.stringify(asset); getLayerGrid(asset, '0'); getLayerGrid(asset, 'O:new'); expect(JSON.stringify(asset)).toBe(before);
  paintTiles(asset, 'O:new', [{x: 0, y: 0}], 2); expect(asset.data.obstruction_data!.new).toEqual([2, 0, 0, 0]);
});

test('Sully helpers emit legacy C# script stubs and SetTile calls', () => {
  const asset = fixture(); asset.map.entities[0].activation_script = 'Talk';
  expect(sullyEntityCode(asset.map.entities[0])).toContain('public void Talk( Entity e )');
  expect(sullyZoneCode({name: 'Exit', activation_script: 'exit'}, 3)).toContain('public void exit( ZoneActivationData zad )');
  expect(sullyTileCode(copySelection(asset, ['0'], {x: 0, y: 0, width: 2, height: 1}), 4, 5)).toBe('SetTile( 4, 5, 0, 1 );\nSetTile( 5, 5, 0, 1 );');
  expect(activationScriptName('42 The door!')).toBe('_42_The_door');
});

test('the first zone in a new map is paintable while index zero remains erase', () => {
  const asset = fixture(); asset.map.zones = [];
  const index = createZone(asset, {name: 'First zone'});
  expect(index).toBe(1); expect(asset.map.zones[0].name).toBe('NULL_ZONE');
  paintTiles(asset, 'Z', [{x: 0, y: 0}], index); expect(readTile(asset, 'Z', 0, 0)).toBe(1);
});

test('art layers use their own tileset size and zones use the explicit map grid', () => {
  const asset = fixture(); asset.map.format_version = 2; asset.map.tile_size = {width: 32, height: 24};
  expect(getLayerGrid(asset, '0')).toMatchObject({tileWidth: 8, tileHeight: 16});
  expect(getLayerGrid(asset, 'Z')).toMatchObject({tileWidth: 32, tileHeight: 24});
  moveEntity(asset, 'person', 64, 48); expect(asset.map.entities[0].location).toMatchObject({px: 64, py: 48, tx: 2, ty: 2});
});

test('v2 map grid resizing clips sparse zones without resizing independent layers', () => {
  const asset = fixture(); upgradeMap(asset);
  asset.map.zone_layer_size = {X: 50, Y: 50};
  asset.data.zone_data.push({x: 2, y: 0, z: 1}, {x: -1, y: 0, z: 1});
  const art = JSON.stringify(asset.map.layers), tiles = JSON.stringify(asset.data.tile_data), obstructions = JSON.stringify(asset.map.obstruction_layers), masks = JSON.stringify(asset.data.obstruction_data);
  resizeMapGrid(asset, 2, 2);
  expect(asset.map.dimensions).toEqual({X: 2, Y: 2}); expect(asset.data.zone_data).toEqual([{x: 1, y: 1, z: 1}]);
  expect(JSON.stringify(asset.map.layers)).toBe(art); expect(JSON.stringify(asset.data.tile_data)).toBe(tiles);
  expect(JSON.stringify(asset.map.obstruction_layers)).toBe(obstructions); expect(JSON.stringify(asset.data.obstruction_data)).toBe(masks);
  expect(getLayerGrid(asset, 'Z')).toMatchObject({width: 2, height: 2});
  setMapTileSize(asset, 24, 32); expect(asset.map.tile_size).toEqual({width: 24, height: 32});
  expect(() => resizeMapGrid(asset, -1, 2)).toThrow('Dimensions'); expect(() => setMapTileSize(asset, 0, 2)).toThrow('Dimensions');
});

test('legacy map grid changes require explicit format conversion', () => {
  const asset = fixture(); expect(() => resizeMapGrid(asset, 1, 1)).toThrow('Convert'); expect(() => setMapTileSize(asset, 8, 8)).toThrow('Convert');
});

test('removing an obstruction layer preserves independent art and other masks', () => {
  const asset = fixture(); upgradeMap(asset); const id = addObstructionLayer(asset, 'Extra', 'obstructions');
  paintTiles(asset, `O:${id}`, [{x: 0, y: 0}], 3);
  const art = JSON.stringify(asset.data.tile_data), legacy = [...asset.data.obstruction_data!.legacy];
  removeObstructionLayer(asset, id);
  expect(asset.map.obstruction_layers!.map(layer => layer.id)).toEqual(['legacy']); expect(asset.data.obstruction_data![id]).toBeUndefined();
  expect(asset.data.obstruction_data!.legacy).toEqual(legacy); expect(JSON.stringify(asset.data.tile_data)).toBe(art);
});

test('new entities include independent Sully wander defaults and preserve supplied values', () => {
  const asset = fixture(), first = createEntity(asset), second = createEntity(asset);
  expect(first).toMatchObject({autofaces: false, is_an_obstruction: false, pays_attention_to_obstructions: false, wander: {mode: 'Scripted', delay: 0, initial_movestring: ''}});
  first.wander.delay = 10; expect(second.wander.delay).toBe(0);
  const custom = createEntity(asset, {wander: {mode: 'Zone', delay: 30, custom: 'keep'}}); expect(custom.wander.custom).toBe('keep');
});

test('global grid falls back to the first named art tileset when default is absent', () => {
  const asset = fixture(); asset.tilesets = {art: asset.tilesets!.default}; asset.map.layers.forEach(layer => {layer.vsp = 'art';});
  expect(getLayerGrid(asset, 'Z')).toMatchObject({tileWidth: 8, tileHeight: 16});
  moveEntity(asset, 'person', 24, 48); expect(asset.map.entities[0].location).toMatchObject({tx: 3, ty: 3});
});
