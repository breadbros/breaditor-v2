import React, {useEffect, useRef, useState} from 'react';
import type {editor} from 'monaco-editor/esm/vs/editor/editor.api';
import type {TextDocument} from './TextDocument';
import {loadMonaco} from './loadMonaco';
import {getTextEditorSession, saveTextEditorSession, TextEditorSession} from './textEditorSession';
import {DocumentControls} from '../../layout/components/DocumentControls';
// @ts-ignore
import css from './TextDocumentView.module.css';

export function TextDocumentView({document: doc}: {document: TextDocument}) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [currentSession, setCurrentSession] = useState<TextEditorSession | null>(null);
  const [, refresh] = useState(0);

  useEffect(() => {
    let active = true;
    let view: editor.IStandaloneCodeEditor | undefined;
    let session: TextEditorSession | undefined;
    let unsubscribe: (() => void) | undefined;
    setCurrentSession(null);
    setLoading(true);
    setError(null);
    void (async () => {
      const monaco = await loadMonaco();
      if (!active) return;
      session = await getTextEditorSession(doc, monaco, document.baseURI);
      if (!active) return;
      view = monaco.editor.create(host.current!, {
        model: session.model,
        automaticLayout: true,
        theme: 'vs-dark',
        minimap: {enabled: false},
        scrollBeyondLastLine: false,
        ariaLabel: `${doc.info.title} text editor`,
      });
      if (session.viewState) view.restoreViewState(session.viewState);
      unsubscribe = session.subscribe(() => refresh(value => value + 1));
      setCurrentSession(session);
      setLoading(false);
    })().catch(cause => {
      if (!active) return;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      active = false;
      unsubscribe?.();
      if (view && session) session.viewState = view.saveViewState();
      view?.dispose();
    };
  }, [doc, attempt]);

  function save(saveAs = false) {
    if (currentSession) void saveTextEditorSession(doc, currentSession, saveAs);
  }

  const dirty = currentSession && doc.data !== currentSession.savedText;
  return <div className={css.container} aria-label={`${doc.info.title} Text Document`}
    onKeyDownCapture={event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        save(event.shiftKey);
      }
    }}>
    <DocumentControls documentId={doc.info.id}>
    <div className={css.controls}>
      <button type="button" disabled={!currentSession || currentSession.saving} onClick={() => save()}>Save</button>
      <button type="button" disabled={!currentSession || currentSession.saving} onClick={() => save(true)}>Save As…</button>
      <span className={css.filename} title={doc.filepath}>{doc.filepath || doc.name}</span>
      {currentSession && <span role={dirty || currentSession.saving || currentSession.saveMessage ? 'status' : undefined}>
        {currentSession.saving ? 'Saving…' : dirty ? 'Unsaved changes' : currentSession.saveMessage || 'No changes'}
      </span>}
    </div>
    </DocumentControls>
    {currentSession?.saveError && <div className={css.saveError} role="alert">Could not save: {currentSession.saveError}</div>}
    <div className={css.viewport}>
    <div className={css.editor} ref={host} />
    {loading && <div className={css.message} role="status">Loading text editor…</div>}
    {error && <div className={css.message} role="alert">
      <span>{error}</span>
      <button onClick={() => setAttempt(value => value + 1)}>Retry</button>
    </div>}
    </div>
  </div>;
}
