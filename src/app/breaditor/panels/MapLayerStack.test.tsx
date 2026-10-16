/** @jest-environment jsdom */
import React, {useReducer, useState} from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MapPanel, MapPanelProps, MapViewSettings} from './MapPanels';
import type {MapEditableAsset} from '../documents/mapEditing';

function asset(): MapEditableAsset {
  return {map: {layers: ['Ground', 'Roof', 'Unused'].map(name => ({name, dimensions: {X: 1, Y: 1}, parallax: {X: 1, Y: 1}, alpha: 1, vsp: 'art'})),
    vsp: {art: 'art.json'}, entities: [], zones: [], renderstring: '1,E,2,R', tallentitylayer: 'Roof'},
  data: {tile_data: [[1], [2], [3], [999]], zone_data: [], legacy_obstruction_data: [1]}};
}

function setup(value = asset()) {
  const selected = jest.fn(), edit = jest.fn((_label: string, mutate: (value: MapEditableAsset) => void) => mutate(value));
  function Harness() {
    const [, refresh] = useReducer(n => n + 1, 0), [layer, selectLayer] = useState('0');
    const [view, setView] = useState<MapViewSettings>({showEntities: true, showZones: false, showObstructions: false});
    const props: MapPanelProps = {panel: 'Layers', asset: value, selectedLayer: layer, tool: 'pan', primaryTile: 0, secondaryTile: 0,
      onSelectLayer: target => {selected(target); selectLayer(target);}, onSelectEntity: jest.fn(), onToolChange: jest.fn(),
      onPrimaryTileChange: jest.fn(), onSecondaryTileChange: jest.fn(), onEdit: (label, mutate) => {edit(label, mutate); refresh();},
      view, onViewChange: next => setView(previous => ({...previous, ...next}))};
    return <MapPanel {...props} />;
  }
  render(<Harness />);
  return {value, selected, edit};
}
function order() {return [...screen.getByRole('listbox', {name: 'Map layers'}).querySelectorAll('[data-render-token]')].map(row => row.getAttribute('data-render-token'));}

test('lists foreground first and button moves alter draw order across entity and render-hook passes', () => {
  const {value, selected, edit} = setup();
  expect(order()).toEqual(['R', '2', 'E', '1']);
  expect(screen.getByRole('button', {name: 'Move Custom render hook (R) up'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Move Ground down'})).toBeDisabled();
  const moveGround = screen.getByRole('button', {name: 'Move Ground up'});
  moveGround.focus(); fireEvent.click(moveGround);
  expect(value.map.renderstring).toBe('E,1,2,R');
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Move Ground up'}));
  expect(order()).toEqual(['R', '2', '1', 'E']);
  expect(value.data.tile_data).toEqual([[1], [2], [3], [999]]);
  expect(selected).not.toHaveBeenCalled();
  expect(edit).toHaveBeenCalledWith('Change layer render order', expect.any(Function));
  fireEvent.click(screen.getByRole('button', {name: 'Move Custom render hook (R) down'}));
  expect(value.map.renderstring).toBe('E,1,R,2');
});

test('dragging moves the chosen pass and ignores drops from another source', () => {
  const {value} = setup();
  const dataTransfer = {setData: jest.fn(), effectAllowed: '', dropEffect: ''};
  let roof = screen.getByRole('listbox', {name: 'Map layers'}).querySelector('[data-layer-name="Roof"]')!;
  const ground = screen.getByRole('listbox', {name: 'Map layers'}).querySelector('[data-layer-name="Ground"]')!;
  fireEvent.drop(ground, {dataTransfer});
  expect(value.map.renderstring).toBe('1,E,2,R');
  fireEvent.dragStart(roof, {dataTransfer}); fireEvent.dragOver(ground, {dataTransfer}); fireEvent.drop(ground, {dataTransfer});
  expect(value.map.renderstring).toBe('2,1,E,R');
  expect(order()).toEqual(['R', 'E', '1', '2']);
  roof = screen.getByRole('listbox', {name: 'Map layers'}).querySelector('[data-layer-name="Roof"]')!;
  fireEvent.dragEnd(roof, {dataTransfer});
  expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '2');
});

test('art and entity eyeballs remain independent, do not select a layer, and synchronize with properties', () => {
  const {value, selected} = setup();
  fireEvent.click(screen.getByRole('button', {name: 'Hide entities on Ground'}));
  expect(value.map.layers[0].maped_HIDE_ENTS).toBe(true);
  expect(screen.getByLabelText('Layer entities visible')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', {name: 'Hide Ground layer'}));
  expect(value.map.layers[0].MAPED_HIDDEN).toBe(true);
  expect(screen.getByRole('button', {name: 'Show entities on Ground'})).toBeDisabled();
  expect(screen.getByLabelText('Layer visible')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', {name: 'Show Ground layer'}));
  expect(screen.getByRole('button', {name: 'Show entities on Ground'})).toBeEnabled();
  expect(value.map.layers[0].maped_HIDE_ENTS).toBe(true);
  fireEvent.click(screen.getByRole('button', {name: 'Hide all entities'}));
  expect(screen.getByRole('button', {name: 'Show entities on Ground'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Show all entities'}));
  expect(screen.getByRole('button', {name: 'Show entities on Ground'})).toBeEnabled();
  expect(selected).not.toHaveBeenCalled();
});

test('tall badge tracks reassignment and omitted layers are not inserted into render order', () => {
  const {value} = setup();
  expect(screen.getAllByLabelText('Tall entities redraw on this layer')).toHaveLength(1);
  expect(screen.getByLabelText('Tall entities redraw on this layer').closest('button')).toHaveTextContent('Roof');
  expect(screen.getByText('Not in render order')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Move Unused up'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Redraw tall entities here'));
  expect(value.map.tallentitylayer).toBe('Ground');
  expect(screen.getByLabelText('Tall entities redraw on this layer').closest('button')).toHaveTextContent('Ground');
  expect(value.map.renderstring).toBe('1,E,2,R');
  fireEvent.click(screen.getByLabelText('Redraw tall entities here'));
  expect(screen.queryByLabelText('Tall entities redraw on this layer')).not.toBeInTheDocument();
});

test('zone and obstruction eyes are view controls and per-mask hiding preserves collision data', () => {
  const value = asset(); value.map.format_version = 2;
  value.map.obstruction_layers = [{id: 'walls', name: 'Walls', vsp: 'art', dimensions: {X: 1, Y: 1}}];
  value.data.obstruction_data = {walls: [7]};
  const {edit, selected} = setup(value), before = JSON.stringify(value.data);
  expect(screen.getByRole('button', {name: 'Hide Walls obstruction layer'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Show zones'}));
  fireEvent.click(screen.getByRole('button', {name: 'Show obstruction overlay'}));
  expect(screen.getByRole('button', {name: 'Hide zones'})).toHaveAttribute('aria-pressed', 'true');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Hide Walls obstruction layer'}));
  expect(value.map.obstruction_layers[0].MAPED_HIDDEN).toBe(true);
  expect(JSON.stringify(value.data)).toBe(before);
  expect(selected).not.toHaveBeenCalled();
});

test('an empty stack still exposes entity and overlay controls without inventing art layers', () => {
  const value = asset(); value.map.layers = []; value.map.renderstring = '';
  setup(value);
  expect(order()).toEqual([]);
  expect(within(screen.getByRole('listbox', {name: 'Map layers'})).getByRole('option', {name: /Entities/})).toBeInTheDocument();
  expect(screen.getByRole('option', {name: 'Obstructions'})).toBeInTheDocument();
});

test('a render order changed during dragging invalidates the stale drag indices', () => {
  const {value, edit} = setup(), dataTransfer = {setData: jest.fn(), effectAllowed: '', dropEffect: ''};
  const stack = screen.getByRole('listbox', {name: 'Map layers'});
  fireEvent.dragStart(stack.querySelector('[data-layer-name="Roof"]')!, {dataTransfer});
  fireEvent.click(screen.getByRole('button', {name: 'Move Ground up'}));
  const orderAfterEdit = value.map.renderstring;
  fireEvent.drop(stack.querySelector('[data-layer-name="Ground"]')!, {dataTransfer});
  expect(value.map.renderstring).toBe(orderAfterEdit);
  expect(edit).toHaveBeenCalledTimes(1);
});

test('the tall-redraw badge also recognizes legacy numeric layer references', () => {
  const value = asset(); (value.map as Record<string, unknown>).tallentitylayer = 0;
  setup(value);
  expect(screen.getByLabelText('Tall entities redraw on this layer').closest('button')).toHaveTextContent('Ground');
  expect(screen.getByLabelText('Redraw tall entities here')).toBeChecked();
});
