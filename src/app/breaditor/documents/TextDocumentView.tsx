import React, {useEffect, useRef, useState} from 'react';
import type {editor} from 'monaco-editor/esm/vs/editor/editor.api';
import type {TextDocument} from './TextDocument';
import {loadMonaco} from './loadMonaco';
import {getTextEditorSession, TextEditorSession} from './textEditorSession';
// @ts-ignore
import css from './TextDocumentView.module.css';

export function TextDocumentView({document: doc}: {document: TextDocument}) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let view: editor.IStandaloneCodeEditor | undefined;
    let session: TextEditorSession | undefined;
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
      setLoading(false);
    })().catch(cause => {
      if (!active) return;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      active = false;
      if (view && session) session.viewState = view.saveViewState();
      view?.dispose();
    };
  }, [doc, attempt]);

  return <div className={css.container} aria-label={`${doc.info.title} Text Document`}>
    <div className={css.editor} ref={host} />
    {loading && <div className={css.message} role="status">Loading text editor…</div>}
    {error && <div className={css.message} role="alert">
      <span>{error}</span>
      <button onClick={() => setAttempt(value => value + 1)}>Retry</button>
    </div>}
  </div>;
}
