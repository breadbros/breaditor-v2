/** @jest-environment jsdom */
import React from 'react';
import {act, render, screen, waitFor, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import {TextDocumentView} from './TextDocumentView';
import {textMaker} from './TextDocument';
import {loadMonaco, MonacoApi} from './loadMonaco';
import {getTextEditorSession} from './textEditorSession';
import {addDocument, removeDocument, _TEST_reset} from '../DocumentManager';

jest.mock('./loadMonaco', () => ({loadMonaco: jest.fn()}));
const load = loadMonaco as jest.MockedFunction<typeof loadMonaco>;
const originalFetch = global.fetch;

function mockMonaco() {
  const models: any[] = [];
  const views: any[] = [];
  const monaco = {
    Uri: {parse: (source: string) => ({with: (parts: any) => ({source, ...parts})})},
    editor: {
      createModel: jest.fn((initial: string, _language: unknown, uri: unknown) => {
        let text = initial;
        let changed = () => {};
        const listener = {dispose: jest.fn()};
        const model = {
          uri, getValue: () => text, dispose: jest.fn(),
          onDidChangeContent: jest.fn(callback => { changed = callback; return listener; }),
          edit: (value: string) => { text = value; changed(); }, listener,
        };
        models.push(model);
        return model;
      }),
      create: jest.fn((_host: HTMLElement, options: any) => {
        const view = {
          options, dispose: jest.fn(), restoreViewState: jest.fn(),
          saveViewState: jest.fn(() => ({cursor: 7, scrollTop: 100})),
        };
        views.push(view);
        return view;
      }),
    },
  };
  return {api: monaco as unknown as MonacoApi, models, views};
}

let monaco: ReturnType<typeof mockMonaco>;
beforeEach(() => {
  _TEST_reset();
  monaco = mockMonaco();
  load.mockReset().mockResolvedValue(monaco.api);
  global.fetch = jest.fn().mockResolvedValue({ok: true, text: async () => '{\n  "name": "Lord Stan"\n}\n'});
});
afterEach(() => {
  _TEST_reset();
  global.fetch = originalFetch;
});

test('loads the original JSON source and attaches an editable, resizing Monaco view', async () => {
  const doc = textMaker('Text B', 'assets/lord-stan/lord_stan.json');
  addDocument(doc);
  render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(monaco.views).toHaveLength(1));
  expect(global.fetch).toHaveBeenCalledWith('http://localhost/assets/lord-stan/lord_stan.json',
    expect.objectContaining({signal: expect.any(AbortSignal), cache: 'no-store'}));
  expect(monaco.models[0].getValue()).toBe('{\n  "name": "Lord Stan"\n}\n');
  expect(monaco.views[0].options).toMatchObject({model: monaco.models[0], automaticLayout: true});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => monaco.models[0].edit('{"edited":true}'));
  expect(doc.data).toBe('{"edited":true}');
});

test('remounting keeps the model, edited text, undo history, and saved view state', async () => {
  const doc = textMaker('Source', 'source.json');
  addDocument(doc);
  const first = render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(monaco.views).toHaveLength(1));
  act(() => monaco.models[0].edit('edited'));
  first.unmount();
  expect(monaco.views[0].dispose).toHaveBeenCalledTimes(1);
  expect(monaco.models[0].dispose).not.toHaveBeenCalled();
  render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(monaco.views).toHaveLength(2));
  expect(monaco.api.editor.createModel).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(monaco.views[1].options.model.getValue()).toBe('edited');
  expect(monaco.views[1].restoreViewState).toHaveBeenCalledWith({cursor: 7, scrollTop: 100});
  act(() => removeDocument(doc));
  expect(monaco.models[0].dispose).toHaveBeenCalledTimes(1);
  expect(monaco.models[0].listener.dispose).toHaveBeenCalledTimes(1);
});

test('opening the same file in two documents gives independent models', async () => {
  const first = textMaker('First', 'source.json');
  const second = textMaker('Second', 'source.json');
  addDocument(first);
  addDocument(second);
  const [a, b] = await Promise.all([
    getTextEditorSession(first, monaco.api, document.baseURI),
    getTextEditorSession(second, monaco.api, document.baseURI),
  ]);
  expect(a.model).not.toBe(b.model);
  expect(a.model.uri).not.toEqual(b.model.uri);
});

test('remounting during a pending load shares the request and attaches only the current view', async () => {
  const doc = textMaker('Pending', 'pending.json');
  addDocument(doc);
  let finish!: (response: unknown) => void;
  (global.fetch as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  first.unmount();
  render(<TextDocumentView document={doc} />);
  await act(async () => { finish({ok: true, text: async () => 'loaded'}); });
  await waitFor(() => expect(monaco.views).toHaveLength(1));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(monaco.api.editor.createModel).toHaveBeenCalledTimes(1);
  expect(monaco.models[0].getValue()).toBe('loaded');
});

test('shows loading errors and retries the source without caching a failed request', async () => {
  const doc = textMaker('Broken', 'missing.json');
  addDocument(doc);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ok: false, status: 404});
  render(<TextDocumentView document={doc} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(() => expect(monaco.views).toHaveLength(1));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('closing during a pending load aborts it and does not create an orphan model', async () => {
  const doc = textMaker('Pending', 'pending.json');
  addDocument(doc);
  let finish!: (response: unknown) => void;
  (global.fetch as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
  view.unmount();
  removeDocument(doc);
  expect(signal.aborted).toBe(true);
  await act(async () => { finish({ok: true, text: async () => 'late text'}); });
  expect(monaco.api.editor.createModel).not.toHaveBeenCalled();
  expect(monaco.api.editor.create).not.toHaveBeenCalled();
});

test('a new empty Text Document opens without fetching a fake file', async () => {
  const doc = textMaker('Untitled');
  addDocument(doc);
  render(<TextDocumentView document={doc} />);
  await waitFor(() => expect(monaco.views).toHaveLength(1));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(monaco.models[0].getValue()).toBe('');
  expect(doc.encoding).toBe('utf-8');
});
