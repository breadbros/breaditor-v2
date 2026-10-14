import {loadSpriteDefinition} from 'crustacean-sprite-lib/load';
import {spriteMaker} from './SpriteDocument';
import {spriteLiveLoadRequest, SpriteSourceCache} from './spriteLiveSource';

const originalFetch = global.fetch;
const sprite = spriteMaker('Watched', 'file:///D:/sprites/sprite.json');
const source = {
  version: 1, image: 'atlas.png', dims: [8, 8], hitbox: [0, 0, 8, 8],
  frames: 1, per_row: 1, inner_pad: 0, outer_pad: 0, animations: {still: [0, 'Static']},
};

afterEach(() => { global.fetch = originalFetch; });

test('image reloads reuse JSON but fetch fresh pixels; JSON reloads read both sources anew', async () => {
  let json = JSON.stringify(source);
  const fetchFile = jest.fn(async (input: any) => new Response(String(input).endsWith('.json') ? json : 'pixels'));
  global.fetch = fetchFile;
  const cache: SpriteSourceCache = {};
  const onImage = jest.fn();
  async function load(imageOnly: boolean) {
    const {url, options} = spriteLiveLoadRequest(sprite, 'file:///D:/app/index.html', new AbortController().signal,
      cache, imageOnly, onImage);
    const loaded = await loadSpriteDefinition(url, options);
    await options.fetch!(loaded.imageUrl, {signal: options.signal});
    return loaded;
  }
  await load(false);
  json = JSON.stringify({...source, image: 'replacement.png', dims: [16, 16]});
  const imageReload = await load(true);
  expect(imageReload.definition.width).toBe(8);
  expect(fetchFile.mock.calls.filter(([url]) => url === sprite.filepath)).toHaveLength(1);
  expect(fetchFile.mock.calls.filter(([url]) => url === 'file:///D:/sprites/atlas.png')).toHaveLength(2);
  const jsonReload = await load(false);
  expect(jsonReload.definition.width).toBe(16);
  expect(jsonReload.imageUrl).toBe('file:///D:/sprites/replacement.png');
  expect(onImage).toHaveBeenLastCalledWith(jsonReload.imageUrl);
  for (const [, options] of (fetchFile.mock.calls as any[])) expect(options.cache).toBe('no-store');
});

test('an aborted old request cannot replace the definition cached by a newer reload', async () => {
  let finish!: (response: Response) => void;
  const fetchFile = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue(new Response('new JSON'));
  global.fetch = fetchFile;
  const cache: SpriteSourceCache = {};
  const oldAbort = new AbortController();
  const old = spriteLiveLoadRequest(sprite, 'file:///D:/', oldAbort.signal, cache, false, jest.fn());
  const pending = old.options.fetch!(old.url);
  oldAbort.abort();
  const current = spriteLiveLoadRequest(sprite, 'file:///D:/', new AbortController().signal, cache, false, jest.fn());
  await current.options.fetch!(current.url);
  finish(new Response('old JSON'));
  await pending;
  const imageOnly = spriteLiveLoadRequest(sprite, 'file:///D:/', new AbortController().signal, cache, true, jest.fn());
  expect(await (await imageOnly.options.fetch!(imageOnly.url)).text()).toBe('new JSON');
  expect(fetchFile).toHaveBeenCalledTimes(2);
});

test('cached JSON remains readable after aborting the fetch that originally loaded it', async () => {
  global.fetch = originalFetch;
  const text = JSON.stringify(source);
  const dataSprite = spriteMaker('Data', 'data:application/json,' + encodeURIComponent(text));
  const cache: SpriteSourceCache = {};
  const abort = new AbortController();
  const first = spriteLiveLoadRequest(dataSprite, 'file:///D:/', abort.signal, cache, false, jest.fn());
  await (await first.options.fetch!(first.url, {signal: abort.signal})).text();
  abort.abort();
  const reload = spriteLiveLoadRequest(dataSprite, 'file:///D:/', new AbortController().signal, cache, true, jest.fn());
  expect(await (await reload.options.fetch!(reload.url)).text()).toBe(text);
});

test('cached definitions retain the response URL used to resolve relative image paths', async () => {
  const response = new Response(JSON.stringify(source));
  Object.defineProperty(response, 'url', {value: 'file:///D:/resolved/sprite.json'});
  global.fetch = jest.fn().mockResolvedValue(response);
  const cache: SpriteSourceCache = {};
  const first = spriteLiveLoadRequest(sprite, 'file:///D:/', new AbortController().signal, cache, false, jest.fn());
  await loadSpriteDefinition(first.url, first.options);
  const reload = spriteLiveLoadRequest(sprite, 'file:///D:/', new AbortController().signal, cache, true, jest.fn());
  const loaded = await loadSpriteDefinition(reload.url, reload.options);
  expect(loaded.definitionUrl).toBe('file:///D:/resolved/sprite.json');
  expect(loaded.imageUrl).toBe('file:///D:/resolved/atlas.png');
});
