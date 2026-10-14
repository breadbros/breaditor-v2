import type {TextDocument} from './TextDocument';
import {resolveSpriteUrl} from './spriteSource';

export interface BrowserTextFileHandle {
  name: string;
  createWritable(): Promise<{write: (text: string) => Promise<void>; close: () => Promise<void>}>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options: {suggestedName: string}) => Promise<BrowserTextFileHandle>;
  }
}

const browserFiles = new WeakMap<TextDocument, BrowserTextFileHandle>();

export async function saveTextDocument(doc: TextDocument, text: string, saveAs: boolean): Promise<'saved' | 'downloaded' | 'canceled'> {
  const source = doc.filepath ? new URL(resolveSpriteUrl(doc.filepath, document.baseURI)) : undefined;
  const suggestedName = source ? decodeURIComponent(source.pathname.split('/').pop()!) : `${doc.name}.txt`;
  if (window.electronAPI?.saveTextFile) {
    const result = await window.electronAPI.saveTextFile({
      sourceUrl: source?.protocol === 'file:' ? source.href : undefined,
      suggestedName, text, saveAs,
    });
    if (!result) return 'canceled';
    doc.filepath = result.url;
    return 'saved';
  }
  if (window.showSaveFilePicker) {
    let handle = browserFiles.get(doc);
    if (!handle || saveAs) {
      try {
        handle = await window.showSaveFilePicker({suggestedName});
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'canceled';
        throw error;
      }
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    browserFiles.set(doc, handle);
    return 'saved';
  }
  const url = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser time to start consuming the download URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'downloaded';
}
