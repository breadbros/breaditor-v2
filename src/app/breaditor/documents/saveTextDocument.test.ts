/** @jest-environment jsdom */
import {saveTextDocument, BrowserTextFileHandle} from './saveTextDocument';
import {textMaker} from './TextDocument';
import {getTextEditorSession, saveTextEditorSession, disposeTextEditorSession} from './textEditorSession';
import type {MonacoApi} from './loadMonaco';

afterEach(() => {
  delete window.electronAPI;
  delete window.showSaveFilePicker;
  jest.restoreAllMocks();
});

test('native Save remembers the selected destination, and cancellation leaves it unchanged', async () => {
  const doc = textMaker('Text B', 'assets/lord-stan/lord_stan.json');
  const save = jest.fn().mockResolvedValueOnce({url: 'file:///D:/saved.json'}).mockResolvedValueOnce(null);
  window.electronAPI = {saveTextFile: save};
  await expect(saveTextDocument(doc, 'first', false)).resolves.toBe('saved');
  expect(save).toHaveBeenLastCalledWith({suggestedName: 'lord_stan.json', sourceUrl: undefined, text: 'first', saveAs: false});
  await expect(saveTextDocument(doc, 'second', true)).resolves.toBe('canceled');
  expect(save).toHaveBeenLastCalledWith({suggestedName: 'saved.json', sourceUrl: 'file:///D:/saved.json', text: 'second', saveAs: true});
  expect(doc.filepath).toBe('file:///D:/saved.json');
});

test('browser saves use the chosen handle again and Save As selects another destination', async () => {
  const doc = textMaker('Text B', 'assets/lord-stan/lord_stan.json');
  const write = jest.fn().mockResolvedValue(undefined);
  const close = jest.fn().mockResolvedValue(undefined);
  const handle: BrowserTextFileHandle = {name: 'saved.json', createWritable: jest.fn().mockResolvedValue({write, close})};
  const picker = jest.fn().mockResolvedValue(handle);
  window.showSaveFilePicker = picker;
  await saveTextDocument(doc, 'first', false);
  await saveTextDocument(doc, 'second', false);
  expect(picker).toHaveBeenCalledTimes(1);
  expect(write.mock.calls).toEqual([['first'], ['second']]);
  expect(close).toHaveBeenCalledTimes(2);
  await saveTextDocument(doc, 'third', true);
  expect(picker).toHaveBeenCalledTimes(2);
});

test('canceling the browser picker is not a save error', async () => {
  window.showSaveFilePicker = jest.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError'));
  await expect(saveTextDocument(textMaker('Untitled'), 'draft', false)).resolves.toBe('canceled');
});

test('browser fallback downloads the UTF-8 snapshot with the source filename', async () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:save-test');
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('lord_stan.json');
    expect(this.href).toBe('blob:save-test');
  });
  jest.useFakeTimers();
  try {
    await expect(saveTextDocument(textMaker('Text B', 'assets/lord-stan/lord_stan.json'), '// draft\n{}', false)).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:save-test');
  } finally {
    jest.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

async function sessionFixture() {
  const doc = textMaker('Draft');
  doc.data = 'original';
  let text = 'original';
  let changed = () => {};
  const model = {
    getValue: () => text, isDisposed: () => false, dispose: jest.fn(),
    onDidChangeContent: (callback: () => void) => { changed = callback; return {dispose: jest.fn()}; },
  };
  const monaco = {Uri: {parse: () => ({with: () => ({})})}, editor: {createModel: () => model}} as unknown as MonacoApi;
  const session = await getTextEditorSession(doc, monaco, document.baseURI);
  return {doc, session, edit: (value: string) => { text = value; changed(); }};
}

test('edits made during a save stay dirty and repeated saves do not overlap', async () => {
  const {doc, session, edit} = await sessionFixture();
  let finish!: (result: {url: string}) => void;
  const save = jest.fn(() => new Promise<{url: string}>(resolve => { finish = resolve; }));
  window.electronAPI = {saveTextFile: save};
  try {
    edit('snapshot');
    const pending = saveTextEditorSession(doc, session);
    expect(session.saving).toBe(true);
    await saveTextEditorSession(doc, session);
    expect(save).toHaveBeenCalledTimes(1);
    edit('newer edit');
    finish({url: 'file:///D:/saved.txt'});
    await pending;
    expect(session.savedText).toBe('snapshot');
    expect(doc.data).toBe('newer edit');
    expect(session.saving).toBe(false);
    expect(session.saveMessage).toBe('Saved');
  } finally { disposeTextEditorSession(doc); }
});

test('failed and canceled saves keep the unsaved baseline; retry records only a successful write', async () => {
  const {doc, session, edit} = await sessionFixture();
  const save = jest.fn().mockRejectedValueOnce(new Error('permission denied')).mockResolvedValueOnce(null).mockResolvedValueOnce({url: 'file:///D:/saved.txt'});
  window.electronAPI = {saveTextFile: save};
  try {
    edit('draft');
    await saveTextEditorSession(doc, session);
    expect(session.saveError).toBe('permission denied');
    expect(session.savedText).toBe('original');
    await saveTextEditorSession(doc, session);
    expect(session.savedText).toBe('original');
    expect(session.saveError).toBeNull();
    await saveTextEditorSession(doc, session);
    expect(session.savedText).toBe('draft');
  } finally { disposeTextEditorSession(doc); }
});
