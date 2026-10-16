/** @jest-environment jsdom */
import {mapMaker} from './MapDocument';
import {disposeMapEditorSession, getMapEditorSession} from './mapEditorSession';
import {moveMapRenderPass} from './mapRenderStack';
import {serializeMap} from 'crustacean-map-lib';

test('render ordering, visibility and tall redraw are undoable and serialize without changing layer data', () => {
  const doc = mapMaker('Layer history'), session = getMapEditorSession(doc);
  try {
    const asset = session.asset!;
    asset.map.layers = ['Ground', 'Roof'].map(name => ({name, dimensions: {X: 1, Y: 1}, parallax: {X: 1, Y: 1}, alpha: 1, vsp: 'art'}));
    asset.data.tile_data = [[1], [2], [999]];
    asset.map.renderstring = '1,E,2,R'; asset.map.tallentitylayer = 'Roof';
    session.selectedLayer = '1';
    session.saved = JSON.stringify({map: asset.map, data: asset.data});
    session.edit('Change layer render order', value => moveMapRenderPass(value, 2, 0));
    expect(asset.map.renderstring).toBe('2,1,E,R'); expect(session.dirty).toBe(true);
    expect(session.selectedLayer).toBe('1');
    session.undo(); expect(asset.map.renderstring).toBe('1,E,2,R'); expect(session.dirty).toBe(false);
    session.redo(); expect(asset.map.renderstring).toBe('2,1,E,R');
    session.edit('Layer visibility', value => {value.map.layers[1].MAPED_HIDDEN = true;});
    session.edit('Tall entity redraw layer', value => {value.map.tallentitylayer = 'Ground';});
    session.undo(); expect(asset.map.tallentitylayer).toBe('Roof');
    session.undo(); expect(asset.map.layers[1].MAPED_HIDDEN).toBeUndefined();
    session.redo(); expect(asset.map.layers[1].MAPED_HIDDEN).toBe(true);
    expect(asset.data.tile_data).toEqual([[1], [2], [999]]);
    expect(asset.map.layers.map(layer => layer.name)).toEqual(['Ground', 'Roof']);
    const persisted = serializeMap(asset);
    expect(JSON.parse(persisted.map)).toMatchObject({renderstring: '2,1,E,R', tallentitylayer: 'Roof', layers: [{name: 'Ground'}, {name: 'Roof', MAPED_HIDDEN: true}]});
    expect(JSON.parse(persisted.data).tile_data).toEqual([[1], [2], [999]]);
  } finally {disposeMapEditorSession(doc);}
});
