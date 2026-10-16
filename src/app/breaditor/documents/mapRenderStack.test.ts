import {mapRenderStack, moveMapRenderPass} from './mapRenderStack';
import type {MapEditableAsset} from './mapEditing';

function asset(renderstring = '1,E,2,R') {
  return {map: {layers: ['Ground', 'Roof', 'Unused'].map(name => ({name, vsp: 'art', dimensions: {X: 1, Y: 1}, parallax: {X: 1, Y: 1}, alpha: 1})),
    vsp: {}, entities: [{uuid: 'tree', name: 'Tree', filename: 'tree.json', location: {layer: 'Ground'}}], zones: [], renderstring, tallentitylayer: 'Roof'},
  data: {tile_data: [[1], [2], [3], [999]], legacy_obstruction_data: [1], zone_data: []}} as MapEditableAsset;
}

test('draw stack is foreground first, retaining original indices and unknown or repeated passes', () => {
  const value = asset('1, E,,2,R, custom ,2');
  expect(mapRenderStack(value)).toEqual([
    {token: '2', renderIndex: 6, layerIndex: 1}, {token: 'custom', renderIndex: 5, layerIndex: undefined},
    {token: 'R', renderIndex: 4, layerIndex: undefined}, {token: '2', renderIndex: 3, layerIndex: 1},
    {token: 'E', renderIndex: 1, layerIndex: undefined}, {token: '1', renderIndex: 0, layerIndex: 0},
  ]);
  expect(value.map.renderstring).toBe('1, E,,2,R, custom ,2');
});

test('moving a pass changes compositing across entities while preserving layer identities and all data', () => {
  const value = asset(), originalLayers = value.map.layers, originalData = JSON.stringify(value.data), originalEntities = JSON.stringify(value.map.entities);
  moveMapRenderPass(value, 0, 2);
  expect(value.map.renderstring).toBe('E,2,1,R');
  expect(mapRenderStack(value).map(pass => pass.token)).toEqual(['R', '1', '2', 'E']);
  expect(value.map.layers).toBe(originalLayers);
  expect(JSON.stringify(value.data)).toBe(originalData);
  expect(JSON.stringify(value.map.entities)).toBe(originalEntities);
  expect(value.map.tallentitylayer).toBe('Roof');
});

test('moving a repeated token affects only that occurrence and retains untouched token spelling', () => {
  const value = asset(' 1 ,E,2,R,2, custom ');
  moveMapRenderPass(value, 4, 1);
  expect(value.map.renderstring).toBe(' 1 ,2,E,2,R, custom ');
});

test('invalid, empty, and same-position moves leave render order unchanged', () => {
  const value = asset('1,,E');
  for (const [from, to] of [[-1, 0], [0, 3], [0, 0], [0.5, 1], [1, 2], [0, 1]]) moveMapRenderPass(value, from, to);
  expect(value.map.renderstring).toBe('1,,E');
});
