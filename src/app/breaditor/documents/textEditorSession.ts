import type {editor, IDisposable} from 'monaco-editor/esm/vs/editor/editor.api';
import type {MonacoApi} from './loadMonaco';
import type {TextDocument} from './TextDocument';
import {resolveSpriteUrl} from './spriteSource';
import {saveTextDocument} from './saveTextDocument';

export interface TextEditorSession {
  model: editor.ITextModel;
  viewState: editor.ICodeEditorViewState | null;
  savedText: string;
  saving: boolean;
  saveError: string | null;
  saveMessage: string | null;
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
}

interface SessionEntry {
  pending: Promise<TextEditorSession>;
  abort: AbortController;
  session?: TextEditorSession;
  listener?: IDisposable;
  subscribers: Set<() => void>;
}

const sessions = new WeakMap<TextDocument, SessionEntry>();

export function getTextEditorSession(doc: TextDocument, monaco: MonacoApi, base: string): Promise<TextEditorSession> {
  const existing = sessions.get(doc);
  if (existing) return existing.pending;
  const abort = new AbortController();
  const subscribers = new Set<() => void>();
  const notify = () => subscribers.forEach(listener => listener());
  const entry: SessionEntry = {abort, subscribers, pending: Promise.resolve().then(async () => {
    const source = doc.filepath ? resolveSpriteUrl(doc.filepath, base) : undefined;
    let text = doc.data;
    if (text === undefined && source) {
      const response = await fetch(source, {signal: abort.signal, cache: 'no-store'});
      if (!response.ok) throw new Error(`Could not load ${doc.name}: HTTP ${response.status}`);
      // Preserve the original JSON formatting rather than parse/stringify it.
      text = await response.text();
    }
    if (abort.signal.aborted) throw new Error('Text Document closed.');
    const uri = monaco.Uri.parse(source || `inmemory://breaditor/${doc.info.id || encodeURIComponent(doc.name)}.txt`);
    // Unique model per document, even when the same file is open twice.
    const modelUri = uri.with({query: `breaditor-document=${encodeURIComponent(doc.info.id || doc.name)}`});
    const model = monaco.editor.createModel(text ?? '', undefined, modelUri);
    doc.data = model.getValue();
    entry.listener = model.onDidChangeContent(() => {
      doc.data = model.getValue();
      notify();
    });
    entry.session = {
      model, viewState: null, savedText: doc.data, saving: false, saveError: null, saveMessage: null,
      subscribe: listener => { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
      notify,
    };
    return entry.session;
  }).catch(error => {
    if (sessions.get(doc) === entry) sessions.delete(doc);
    throw error;
  })};
  sessions.set(doc, entry);
  return entry.pending;
}

export function disposeTextEditorSession(doc: TextDocument) {
  const entry = sessions.get(doc);
  if (!entry) return;
  entry.abort.abort();
  entry.subscribers.clear();
  entry.listener?.dispose();
  entry.session?.model.dispose();
  sessions.delete(doc);
}

export async function saveTextEditorSession(doc: TextDocument, session: TextEditorSession, saveAs = false) {
  if (session.saving || session.model.isDisposed()) return;
  const snapshot = session.model.getValue();
  session.saving = true;
  session.saveError = null;
  session.saveMessage = null;
  session.notify();
  try {
    const result = await saveTextDocument(doc, snapshot, saveAs);
    if (result !== 'canceled') {
      // Edits made while this snapshot is being written remain dirty.
      session.savedText = snapshot;
      session.saveMessage = result === 'downloaded' ? 'Downloaded' : 'Saved';
    }
  } catch (cause) {
    session.saveError = cause instanceof Error ? cause.message : String(cause);
  } finally {
    session.saving = false;
    session.notify();
  }
}

export function saveOpenTextDocument(doc: TextDocument, saveAs = false) {
  const session = sessions.get(doc)?.session;
  if (session) void saveTextEditorSession(doc, session, saveAs);
}
