/** @jest-environment jsdom */
import React from 'react';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {validateCrusty} from 'crustacean-sprite-lib';
import {loadSpriteDefinition} from 'crustacean-sprite-lib/load';
import {spriteMaker} from '../documents/SpriteDocument';
import {SpriteInfoPanel} from './SpriteInfoPanel';

jest.mock('crustacean-sprite-lib/load', () => ({loadSpriteDefinition: jest.fn()}));

const definition = validateCrusty({
  version: 1, image: 'atlas.png', dims: [8, 16], hitbox: [1, 2, 6, 12],
  frames: 2, per_row: 2, inner_pad: 0, outer_pad: 1,
  palette: [[0, 0, 0], [255, 128, 64]],
  animations: {walk: [[[0, 70], [1, 150]], 'Looping'], still: [1, 'Static']},
});
const loadDefinition = loadSpriteDefinition as jest.Mock;
const imageUrl = 'file:///D:/Sprite%20Images/atlas%231.png';

beforeEach(() => {
  loadDefinition.mockReset().mockResolvedValue({definition, imageUrl});
  window.electronAPI = {showImageInFolder: jest.fn().mockResolvedValue(undefined)};
});

afterEach(() => { window.electronAPI = undefined; });

test('shows every property with a separate row for each complete animation', async () => {
  render(<SpriteInfoPanel document={spriteMaker('Test', 'test.json')} />);
  const table = await screen.findByRole('table');
  const rows = within(table).getAllByRole('row').slice(1);
  const {animations, ...properties} = definition;
  expect(rows).toHaveLength(Object.keys(properties).length + Object.keys(animations).length);
  for (const [key, value] of Object.entries(properties)) {
    const row = within(table).getByRole('rowheader', {name: key}).closest('tr')!;
    const cell = within(row).getByRole('cell').querySelector('pre')!;
    if (typeof value === 'string') expect(cell.textContent).toBe(value);
    else expect(JSON.parse(cell.textContent!)).toEqual(value);
  }
  for (const [name, animation] of Object.entries(animations)) {
    const row = within(table).getByRole('rowheader', {name: `animations.${name}`}).closest('tr')!;
    expect(JSON.parse(within(row).getByRole('cell').textContent!)).toEqual(animation);
  }
  expect(within(table).queryByRole('rowheader', {name: 'animations'})).not.toBeInTheDocument();
  expect(loadDefinition).toHaveBeenCalledWith('http://localhost/test.json', {
    signal: expect.any(AbortSignal),
  });
});

test('opens the resolved image location from the button beside its value', async () => {
  render(<SpriteInfoPanel document={spriteMaker('Test', 'test.json')} />);
  const imageRow = (await screen.findByRole('rowheader', {name: 'image'})).closest('tr')!;
  await userEvent.setup().click(within(imageRow).getByRole('button', {name: 'Open folder'}));
  expect(window.electronAPI!.showImageInFolder).toHaveBeenCalledWith(imageUrl);
});

test('disables the folder button for remote images', async () => {
  loadDefinition.mockResolvedValue({definition, imageUrl: 'https://example.test/atlas.png'});
  render(<SpriteInfoPanel document={spriteMaker('Remote', 'https://example.test/sprite.json')} />);
  expect(await screen.findByRole('button', {name: 'Open folder'})).toBeDisabled();
});

test('reports folder errors without hiding sprite properties', async () => {
  (window.electronAPI!.showImageInFolder as jest.Mock).mockRejectedValue(new Error('Cannot reveal image'));
  render(<SpriteInfoPanel document={spriteMaker('Test', 'test.json')} />);
  await userEvent.setup().click(await screen.findByRole('button', {name: 'Open folder'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reveal image');
  expect(screen.getByRole('rowheader', {name: 'animations.walk'})).toBeInTheDocument();
});

test('ignores a stale load when the sprite source changes and aborts on unmount', async () => {
  let finishFirst!: (value: any) => void;
  loadDefinition.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  const sprite = spriteMaker('First', 'first.json');
  const {rerender, unmount} = render(<SpriteInfoPanel document={sprite} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading sprite info');
  const firstSignal = loadDefinition.mock.calls[0][1].signal;
  rerender(<SpriteInfoPanel document={spriteMaker('Second', 'second.json')} />);
  await screen.findByRole('table');
  expect(firstSignal.aborted).toBe(true);
  await act(async () => { finishFirst({definition: {...definition, image: 'stale.png'}}); });
  expect(screen.queryByText('stale.png')).not.toBeInTheDocument();
  expect(screen.getByText('atlas.png')).toBeInTheDocument();
  const secondSignal = loadDefinition.mock.calls[1][1].signal;
  unmount();
  expect(secondSignal.aborted).toBe(true);
});

test('shows load errors and clears them when a new sprite source loads', async () => {
  loadDefinition.mockRejectedValueOnce(new Error('Missing sprite.json'));
  const {rerender} = render(<SpriteInfoPanel document={spriteMaker('Missing', 'missing.json')} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Missing sprite.json');
  rerender(<SpriteInfoPanel document={spriteMaker('Available', 'available.json')} />);
  await screen.findByRole('table');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('reloads inline definitions and image overrides without changing the filepath', async () => {
  const sprite = spriteMaker('Inline', 'same.json');
  const {rerender} = render(<SpriteInfoPanel document={sprite} />);
  await screen.findByRole('table');
  rerender(<SpriteInfoPanel document={{...sprite, crustacean_json: '{"version":1}'}} />);
  await waitFor(() => expect(loadDefinition).toHaveBeenCalledTimes(2));
  expect(loadDefinition.mock.calls[1][1].fetch).toEqual(expect.any(Function));
  rerender(<SpriteInfoPanel document={{...sprite, crustacean_image: 'override.png'}} />);
  await waitFor(() => expect(loadDefinition).toHaveBeenCalledTimes(3));
  expect(loadDefinition.mock.calls[2][1].resolveImage('atlas.png', 'http://localhost/same.json'))
    .toBe('http://localhost/override.png');
});
