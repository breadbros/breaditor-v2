/** @jest-environment jsdom */
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MapPanel, MapPanelProps, MapToolbar} from './MapPanels';
import type {MapEditableAsset} from '../documents/mapEditing';

function props(panel: string): MapPanelProps {
  const asset: MapEditableAsset = {map: {layers: [{name: 'Ground', dimensions: {X: 4, Y: 3}, parallax: {X: 1, Y: 1}, vsp: 'art', alpha: 1}], vsp: {art: 'art.json', obstructions: 'obs.json'}, entities: [{uuid: 'villager', name: 'Villager', filename: 'npc.json', location: {layer: 'Ground', tx: 2, ty: 1}}], zones: [{name: 'NULL'}, {name: 'Door'}], renderstring: '1,E'}, data: {tile_data: [new Array(12).fill(0)], zone_data: [], legacy_obstruction_data: []}, tilesets: {art: {definition: {tilesize: {width: 8, height: 16}}, imageUrl: 'art.png'}}};
  return {panel, asset, selectedLayer: '0', selectedEntity: 'villager', tool: 'pan', primaryTile: 1, secondaryTile: 0, onSelectLayer: jest.fn(), onSelectEntity: jest.fn(), onToolChange: jest.fn(), onPrimaryTileChange: jest.fn(), onSecondaryTileChange: jest.fn(), onEdit: jest.fn((_label, mutate) => mutate(asset)), onViewChange: jest.fn()};
}

test('layer forms commit once on blur and reject invalid dimensions', () => {
  const input = props('Layers'); render(<MapPanel {...input} />);
  fireEvent.change(screen.getByLabelText('Layer name'), {target: {value: 'Grass'}});
  expect(input.onEdit).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByLabelText('Layer name'));
  expect(input.asset.map.layers[0].name).toBe('Grass'); expect(input.onEdit).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Layer width'), {target: {value: '0'}}); fireEvent.blur(screen.getByLabelText('Layer width'));
  expect(input.asset.map.layers[0].dimensions.X).toBe(4); expect(input.onEdit).toHaveBeenCalledTimes(1);
});

test('extended format conversion requires an explicit in-panel confirmation', () => {
  const input = props('Layers'); render(<MapPanel {...input} />);
  fireEvent.click(screen.getByText('Convert to extended map…'));
  expect(input.asset.map.format_version).toBeUndefined();
  expect(screen.getByRole('alert')).toHaveTextContent('require Save As');
  fireEvent.click(screen.getByText('Convert format'));
  expect(input.asset.map.format_version).toBe(2); expect(input.asset.map.tile_size).toEqual({width: 8, height: 16});
});

test('entity tile placement uses the map grid even when its art tileset differs', () => {
  const input = props('Entities'); input.asset.map.tile_size = {width: 32, height: 24}; render(<MapPanel {...input} />);
  expect(screen.getByLabelText('Entity pixel X')).toHaveValue(64); expect(screen.getByLabelText('Entity pixel Y')).toHaveValue(24);
  fireEvent.change(screen.getByLabelText('Entity tile X'), {target: {value: '3'}}); fireEvent.blur(screen.getByLabelText('Entity tile X'));
  expect(input.asset.map.entities[0].location).toMatchObject({px: 96, py: 24, tx: 3, ty: 1});
});

test('zone selection switches painting to the sparse zone grid', () => {
  const input = props('Zones'); render(<MapPanel {...input} />);
  fireEvent.click(screen.getByRole('option', {name: '1. Door'}));
  expect(input.onSelectLayer).toHaveBeenCalledWith('Z'); expect(input.onPrimaryTileChange).toHaveBeenCalledWith(1); expect(input.onToolChange).toHaveBeenCalledWith('brush');
});

test('screen rectangle changes are view settings rather than asset edits', () => {
  const input = props('Screenview'); render(<MapPanel {...input} />);
  fireEvent.click(screen.getByLabelText('Show screen rectangle'));
  expect(input.onViewChange).toHaveBeenCalledWith({screenview: {enabled: true, x: 0, y: 0, width: 320, height: 240, opacity: .35}});
  expect(input.onEdit).not.toHaveBeenCalled();
});

test('map toolbar exposes active tool and history availability', () => {
  const onToolChange = jest.fn(); render(<MapToolbar tool="pan" onToolChange={onToolChange} canUndo={false} canRedo />);
  expect(screen.getByText('pan')).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByText('Undo')).toBeDisabled();
  fireEvent.click(screen.getByText('brush')); expect(onToolChange).toHaveBeenCalledWith('brush');
});

test('tile palette drag selects a rectangular stamp in row order and supports clearing', () => {
  const input = props('Tileset'); input.onStampChange = jest.fn();
  const originalPointer = window.PointerEvent;
  Object.defineProperty(window, 'PointerEvent', {configurable: true, value: MouseEvent});
  try {
    render(<MapPanel {...input} />);
    const image = screen.getByAltText('art tile palette');
    Object.defineProperties(image, {naturalWidth: {value: 32}, naturalHeight: {value: 48}});
    fireEvent.load(image); fireEvent.pointerDown(image, {button: 0, clientX: 9, clientY: 17});
    fireEvent.pointerMove(image, {clientX: 25, clientY: 33}); fireEvent.pointerUp(image, {button: 0, clientX: 25, clientY: 33});
    expect(input.onStampChange).toHaveBeenLastCalledWith({width: 3, height: 2, tiles: [5, 6, 7, 9, 10, 11]});
    expect(screen.getByRole('status')).toHaveTextContent('Stamp: 3 × 2');
    fireEvent.click(screen.getByText('Clear stamp')); expect(input.onStampChange).toHaveBeenLastCalledWith(null);
  } finally {Object.defineProperty(window, 'PointerEvent', {configurable: true, value: originalPointer});}
});

test('tileset import reports source errors and keeps the entered reference for retry', async () => {
  const input = props('Tileset'); input.onAddTileset = jest.fn().mockRejectedValue(new Error('Missing source image'));
  render(<MapPanel {...input} />);
  fireEvent.change(screen.getByLabelText('Tileset name'), {target: {value: 'extra'}});
  fireEvent.change(screen.getByLabelText('Tileset JSON reference'), {target: {value: 'extra.vsp.json'}});
  fireEvent.click(screen.getByRole('button', {name: 'Import tileset'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Missing source image'));
  expect(input.onAddTileset).toHaveBeenCalledWith('extra', 'extra.vsp.json'); expect(screen.getByLabelText('Tileset JSON reference')).toHaveValue('extra.vsp.json');
});

test('sprite import assigns the imported reference only after it loads successfully', async () => {
  const input = props('Entities'); input.onAddSprite = jest.fn().mockResolvedValue(undefined);
  render(<MapPanel {...input} />);
  fireEvent.change(screen.getByLabelText('Sprite JSON reference'), {target: {value: 'chrs/new.json'}});
  fireEvent.click(screen.getByRole('button', {name: 'Import sprite'}));
  await waitFor(() => expect(input.asset.map.entities[0].filename).toBe('chrs/new.json'));
  expect(input.onAddSprite).toHaveBeenCalledWith('chrs/new.json');
});

test('empty palette explains how to assign an imported tileset', () => {
  const input = props('Tileset'); input.asset.tilesets = {};
  render(<MapPanel {...input} />); expect(screen.getByRole('status')).toHaveTextContent('Import a VSP JSON file');
});

test('toolbar exposes zone painting and smart picking as distinct actions', () => {
  const onToolChange = jest.fn(), onSmartEyedropper = jest.fn(); render(<MapToolbar tool="pan" onToolChange={onToolChange} onSmartEyedropper={onSmartEyedropper} />);
  fireEvent.click(screen.getByText('zone')); expect(onToolChange).toHaveBeenCalledWith('zone');
  fireEvent.click(screen.getByText('Smart eyedropper')); expect(onSmartEyedropper).toHaveBeenCalledTimes(1);
});

test('v2 Info grid fields resize only the global map grid and clip zones', () => {
  const input = props('Info'); input.asset.map.format_version = 2; input.asset.map.dimensions = {X: 4, Y: 3}; input.asset.map.tile_size = {width: 16, height: 16}; input.asset.data.zone_data = [{x: 3, y: 1, z: 1}];
  render(<MapPanel {...input} />);
  fireEvent.change(screen.getByLabelText('Map grid width'), {target: {value: '2'}}); fireEvent.blur(screen.getByLabelText('Map grid width'));
  expect(input.asset.map.dimensions).toEqual({X: 2, Y: 3}); expect(input.asset.data.zone_data).toEqual([]); expect(input.asset.map.layers[0].dimensions).toEqual({X: 4, Y: 3});
  fireEvent.change(screen.getByLabelText('Map tile height'), {target: {value: '24'}}); fireEvent.blur(screen.getByLabelText('Map tile height'));
  expect(input.asset.map.tile_size).toEqual({width: 16, height: 24});
});

test('legacy Info leaves map grid fields behind explicit format conversion', () => {
  render(<MapPanel {...props('Info')} />); expect(screen.queryByLabelText('Map grid width')).not.toBeInTheDocument();
});

test('obstruction visibility and removal edits retain art data', () => {
  const input = props('Layers'); input.asset.map.format_version = 2; input.asset.map.obstruction_layers = [{id: 'extra', name: 'Extra', vsp: 'obstructions', dimensions: {X: 4, Y: 3}}]; input.asset.data.obstruction_data = {extra: [1, 2]}; input.selectedLayer = 'O:extra';
  render(<MapPanel {...input} />);
  fireEvent.click(screen.getByLabelText('Obstruction layer visible')); expect(input.asset.map.obstruction_layers![0].MAPED_HIDDEN).toBe(true);
  fireEvent.click(screen.getByText('Remove obstruction layer')); expect(input.asset.map.obstruction_layers).toEqual([]); expect(input.asset.data.obstruction_data).toEqual({}); expect(input.asset.data.tile_data[0]).toHaveLength(12);
});

test('editing a note retains its legacy string coordinates and unknown metadata', () => {
  const input = props('Info'); input.asset.map.notes = [{text: 'Original', x: '12', y: '24', custom: 'keep'}];
  render(<MapPanel {...input} />);
  fireEvent.change(screen.getByLabelText('Note 1 text'), {target: {value: 'Updated'}}); fireEvent.blur(screen.getByLabelText('Note 1 text'));
  fireEvent.change(screen.getByLabelText('Note 1 X'), {target: {value: '32'}}); fireEvent.blur(screen.getByLabelText('Note 1 X'));
  expect(input.asset.map.notes[0]).toEqual({text: 'Updated', x: '32', y: '24', custom: 'keep'});
});

test('an extended map with no obstruction layers has no phantom legacy layer', () => {
  const input = props('Layers'); input.asset.map.format_version = 2; input.asset.map.obstruction_layers = []; input.asset.map.vsp = {};
  render(<MapPanel {...input} />);
  expect(screen.queryByRole('option', {name: 'Obstructions'})).not.toBeInTheDocument(); expect(screen.getByText('Add obstruction layer')).toBeDisabled();
});

test('image-only revisions refresh palette pixels without changing canonical asset references', () => {
  const input = props('Tileset'); input.asset.tilesets!.art.imageUrl = 'file:///art/tiles.png?existing=keep';
  const {rerender} = render(<MapPanel {...input} imageRevision={0} />);
  expect(screen.getByAltText('art tile palette').getAttribute('src')).toBe('file:///art/tiles.png?existing=keep');
  rerender(<MapPanel {...input} imageRevision={1} />);
  expect(screen.getByAltText('art tile palette').getAttribute('src')).toBe('file:///art/tiles.png?existing=keep&breaditorRevision=1');
  expect(input.asset.tilesets!.art.imageUrl).toBe('file:///art/tiles.png?existing=keep'); expect(input.onEdit).not.toHaveBeenCalled();
});
