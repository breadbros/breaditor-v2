/** @jest-environment jsdom */
import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {validateCrusty, SpritePlayer} from 'crustacean-sprite-lib';
import {WebGLSpriteRenderer} from 'crustacean-sprite-lib/webgl';
import {spriteMaker} from './SpriteDocument';
import {SpriteDocumentView} from './SpriteDocumentView';

jest.mock('crustacean-sprite-lib/webgl', () => ({WebGLSpriteRenderer: jest.fn()}));

const definition = validateCrusty({
  version: 1, image: 'atlas.png', dims: [8, 8], hitbox: [0, 0, 8, 8],
  frames: 2, per_row: 2, inner_pad: 0, outer_pad: 0,
  animations: {walk: [[[0, 10], [1, 10]], 'Looping'], still: [1, 'Static']},
});
let asset: any;
let renderer: any;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let resize: () => void;
let observer: {observe: jest.Mock; disconnect: jest.Mock};
let getContext: jest.SpyInstance;
let drawnFrames: number[];
const originalObserver = global.ResizeObserver;
const originalPixelRatio = window.devicePixelRatio;
let watches: {sources: {json?: string; image?: string}; onChange: (kind: 'json' | 'image') => void; stop: jest.Mock}[];

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  drawnFrames = [];
  watches = [];
  window.electronAPI = {watchSpriteFiles: jest.fn((sources, onChange) => {
    const stop = jest.fn();
    watches.push({sources, onChange, stop});
    return stop;
  })};
  asset = {definition, definitionUrl: 'https://example.test/sprite.json', imageUrl: 'https://example.test/atlas.png', dispose: jest.fn()};
  renderer = {
    loadSprite: jest.fn().mockResolvedValue(asset), beginFrame: jest.fn(),
    draw: jest.fn((_asset, player: SpritePlayer) => drawnFrames.push(player.frame)),
    endFrame: jest.fn(), dispose: jest.fn(), contextLost: false,
    restore: jest.fn(() => { renderer.contextLost = false; }),
  };
  (WebGLSpriteRenderer as jest.Mock).mockImplementation(() => renderer);
  getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  observer = {observe: jest.fn(), disconnect: jest.fn()};
  global.ResizeObserver = jest.fn(callback => { resize = callback; return observer; }) as any;
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  Object.defineProperty(window, 'devicePixelRatio', {configurable: true, value: 2});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.ResizeObserver = originalObserver;
  Object.defineProperty(window, 'devicePixelRatio', {configurable: true, value: originalPixelRatio});
  window.electronAPI = undefined;
});

async function mount() {
  const sprite = spriteMaker('Test sprite', 'sprite.json');
  const result = render(<SpriteDocumentView document={sprite} />);
  await waitFor(() => expect(screen.getByRole('button', {name: 'Pause'})).toBeEnabled());
  return {sprite, ...result};
}

function tick(time: number) {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(time));
  });
}

test('loads the document and draws its selected animation centered at device resolution', async () => {
  await mount();
  expect(renderer.loadSprite).toHaveBeenCalledWith('http://localhost/sprite.json', {
    signal: expect.any(AbortSignal), fetch: expect.any(Function), resolveImage: expect.any(Function),
  });
  const canvas = screen.getByLabelText('Test sprite sprite') as HTMLCanvasElement;
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(400);
  expect(renderer.beginFrame).toHaveBeenLastCalledWith({width: 320, height: 200, clearColor: [0, 0, 0, 0]});
  expect(renderer.draw).toHaveBeenLastCalledWith(asset, expect.any(SpritePlayer), {
    x: 160, y: 100, originX: 4, originY: 4, scaleX: 4, scaleY: 4,
  });
  expect(screen.getByLabelText('Animation')).toHaveValue('walk');
  act(() => { resize(); });
  expect(canvas.width).toBe(640);
});

test('retains fractional milliseconds and supports pause, resume, selection, restart, and zoom', async () => {
  await mount();
  const user = userEvent.setup();
  tick(0);
  tick(3.5);
  tick(7);
  tick(10.5);
  expect(drawnFrames[drawnFrames.length - 1]).toBe(1);
  await user.click(screen.getByRole('button', {name: 'Pause'}));
  tick(1000);
  tick(2000);
  expect(screen.getByText('Frame 1 · paused')).toBeInTheDocument();
  await user.click(screen.getByRole('button', {name: 'Resume'}));
  tick(3000);
  tick(3010);
  expect(screen.getByText('Frame 0 · playing')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Animation'), 'still');
  expect(drawnFrames[drawnFrames.length - 1]).toBe(1);
  await user.selectOptions(screen.getByLabelText('Animation'), 'walk');
  tick(4000);
  tick(4010);
  await user.click(screen.getByRole('button', {name: 'Restart animation'}));
  expect(drawnFrames[drawnFrames.length - 1]).toBe(0);
  await user.selectOptions(screen.getByLabelText('Zoom'), '8');
  tick(4020);
  expect(renderer.draw).toHaveBeenLastCalledWith(asset, expect.any(SpritePlayer), expect.objectContaining({scaleX: 8, scaleY: 8}));
  expect(renderer.loadSprite).toHaveBeenCalledTimes(1);
});

test('does not catch up after the view becomes visible or restores a lost graphics context', async () => {
  await mount();
  tick(0);
  tick(5);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  tick(100000);
  expect(drawnFrames[drawnFrames.length - 1]).toBe(0);
  tick(100005);
  expect(drawnFrames[drawnFrames.length - 1]).toBe(1);
  const canvas = screen.getByLabelText('Test sprite sprite');
  renderer.contextLost = true;
  const lost = new Event('webglcontextlost', {cancelable: true});
  act(() => { canvas.dispatchEvent(lost); });
  expect(lost.defaultPrevented).toBe(true);
  expect(screen.getByText('Restoring graphics…')).toBeInTheDocument();
  const draws = renderer.draw.mock.calls.length;
  tick(1000000);
  expect(renderer.draw).toHaveBeenCalledTimes(draws);
  act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
  expect(renderer.restore).toHaveBeenCalledTimes(1);
  tick(2000000);
  expect(drawnFrames[drawnFrames.length - 1]).toBe(1);
  expect(screen.queryByText('Restoring graphics…')).not.toBeInTheDocument();
});

test('aborts loads and releases textures, observers, and the animation loop on unmount', async () => {
  const {unmount} = await mount();
  const signal = renderer.loadSprite.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  expect(asset.dispose).toHaveBeenCalledTimes(1);
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  expect(watches.every(watch => watch.stop.mock.calls.length === 1)).toBe(true);
});

test('disposes a late load after switching documents instead of drawing stale data', async () => {
  let finish: (asset: any) => void = () => {};
  renderer.loadSprite.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const {rerender} = render(<SpriteDocumentView document={spriteMaker('Old sprite', 'old.json')} />);
  const oldSignal = renderer.loadSprite.mock.calls[0][1].signal;
  const oldAsset = {...asset, dispose: jest.fn()};
  rerender(<SpriteDocumentView document={spriteMaker('New sprite', 'new.json')} />);
  await waitFor(() => expect(renderer.draw).toHaveBeenCalled());
  await act(async () => { finish(oldAsset); });
  expect(oldSignal.aborted).toBe(true);
  expect(oldAsset.dispose).toHaveBeenCalledTimes(1);
  expect(renderer.draw.mock.calls.every(([drawn]: any[]) => drawn === asset)).toBe(true);
});

test('shows a recoverable error when WebGL is unavailable', async () => {
  getContext.mockReturnValueOnce(null);
  render(<SpriteDocumentView document={spriteMaker('Unavailable', 'sprite.json')} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('WebGL 2 is unavailable');
  await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(renderer.draw).toHaveBeenCalled());
});

test('surfaces malformed or missing sprite assets without leaving an animation loop running', async () => {
  renderer.loadSprite.mockRejectedValueOnce(new Error('Invalid sprite definition'));
  render(<SpriteDocumentView document={spriteMaker('Broken', 'sprite.json')} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid sprite definition');
  expect(frames.size).toBe(0);
  expect(renderer.draw).not.toHaveBeenCalled();
});

test('reloads changed images while retaining the chosen animation, pause state and zoom', async () => {
  await mount();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Animation'), 'still');
  await user.click(screen.getByRole('button', {name: 'Pause'}));
  await user.selectOptions(screen.getByLabelText('Zoom'), '8');
  const original = asset;
  asset = {...asset, dispose: jest.fn()};
  renderer.loadSprite.mockResolvedValue(asset);
  const watch = watches[watches.length - 1];
  expect(watch.sources).toEqual({json: 'http://localhost/sprite.json', image: original.imageUrl});
  act(() => watch.onChange('image'));
  await waitFor(() => expect(renderer.draw).toHaveBeenLastCalledWith(asset, expect.any(SpritePlayer),
    expect.objectContaining({scaleX: 8, scaleY: 8})));
  expect(original.dispose).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Animation')).toHaveValue('still');
  expect(screen.getByRole('button', {name: 'Resume'})).toBeEnabled();
  expect(screen.getByLabelText('Zoom')).toHaveValue('8');
});

test('JSON edits refresh animation choices and move the image watch to the new atlas', async () => {
  await mount();
  const updated = validateCrusty({
    version: 1, image: 'new.png', dims: [8, 8], hitbox: [0, 0, 8, 8],
    frames: 2, per_row: 2, inner_pad: 0, outer_pad: 0,
    animations: {replacement: [1, 'Static']},
  });
  renderer.loadSprite.mockResolvedValue({...asset, definition: updated, imageUrl: 'file:///D:/new.png', dispose: jest.fn()});
  const previousWatch = watches[watches.length - 1];
  act(() => previousWatch.onChange('json'));
  await waitFor(() => expect(screen.getByLabelText('Animation')).toHaveValue('replacement'));
  expect(screen.queryByRole('option', {name: 'walk'})).not.toBeInTheDocument();
  expect(previousWatch.stop).toHaveBeenCalledTimes(1);
  expect(watches[watches.length - 1].sources.image).toBe('file:///D:/new.png');
});

test('continues watching after a bad save and automatically recovers on the next save', async () => {
  await mount();
  renderer.loadSprite.mockRejectedValueOnce(new Error('Incomplete JSON'));
  act(() => watches[watches.length - 1].onChange('json'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Incomplete JSON');
  act(() => watches[watches.length - 1].onChange('json'));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', {name: 'Pause'})).toBeEnabled());
});

test('watches a missing image as soon as its reference resolves and recovers when it appears', async () => {
  renderer.loadSprite.mockImplementationOnce(async (_url: string, options: any) => {
    options.resolveImage('missing.png', 'file:///D:/sprites/definition.json');
    throw new Error('Missing image');
  });
  render(<SpriteDocumentView document={spriteMaker('Missing', 'file:///D:/sprites/definition.json')} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Missing image');
  expect(watches[watches.length - 1].sources.image).toBe('file:///D:/sprites/missing.png');
  act(() => watches[watches.length - 1].onChange('image'));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Pause'})).toBeEnabled());
});
