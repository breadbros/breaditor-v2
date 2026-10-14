/** @jest-environment jsdom */
import type {MonacoApi} from './loadMonaco';

let loadMonaco: typeof import('./loadMonaco').loadMonaco;
beforeEach(() => {
  jest.resetModules();
  loadMonaco = require('./loadMonaco').loadMonaco;
  document.head.innerHTML = '<base href="https://example.com/breaditor/index.html">';
  delete window.breaditorMonaco;
});
afterEach(() => {
  delete window.breaditorMonaco;
  globalThis.MonacoEnvironment = undefined;
  jest.restoreAllMocks();
});

test('loads local JS and CSS once and waits for both before returning the API', async () => {
  const first = loadMonaco();
  expect(loadMonaco()).toBe(first);
  const script = document.querySelector('script')!;
  const link = document.querySelector('link')!;
  expect(script.src).toBe('https://example.com/breaditor/monaco/monaco.js');
  expect(link.href).toBe('https://example.com/breaditor/monaco/monaco.css');
  const api = {} as MonacoApi;
  window.breaditorMonaco = api;
  let resolved = false;
  void first.then(() => { resolved = true; });
  script.dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(resolved).toBe(false);
  link.dispatchEvent(new Event('load'));
  await expect(first).resolves.toBe(api);
});

test('a failed bundle can be retried', async () => {
  const first = loadMonaco();
  const failed = expect(first).rejects.toThrow('Could not load the text editor');
  document.querySelector('script')!.dispatchEvent(new Event('error'));
  await failed;
  expect(document.querySelector('script')).toBeNull();
  expect(document.querySelector('link')).toBeNull();
  const second = loadMonaco();
  window.breaditorMonaco = {} as MonacoApi;
  document.querySelector('script')!.dispatchEvent(new Event('load'));
  document.querySelector('link')!.dispatchEvent(new Event('load'));
  await expect(second).resolves.toBe(window.breaditorMonaco);
});

test('routes language services to locally bundled classic workers', async () => {
  const worker = jest.fn();
  Object.defineProperty(globalThis, 'Worker', {configurable: true, value: worker});
  const ready = loadMonaco();
  window.breaditorMonaco = {} as MonacoApi;
  document.querySelector('script')!.dispatchEvent(new Event('load'));
  document.querySelector('link')!.dispatchEvent(new Event('load'));
  await ready;
  const expected = {json: 'json', typescript: 'ts', javascript: 'ts', scss: 'css', html: 'html', other: 'editor'};
  for (const [label, name] of Object.entries(expected)) {
    globalThis.MonacoEnvironment!.getWorker!('unused', label);
    expect(worker).toHaveBeenLastCalledWith(new URL(`https://example.com/breaditor/monaco/${name}.worker.js`), {name: label});
  }
});
