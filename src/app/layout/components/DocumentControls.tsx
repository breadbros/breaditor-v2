import React, {createContext, ReactNode, useContext, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';

interface ControlsTarget {
  documentId: string | null;
  label: string;
  element: HTMLDivElement | null;
  setElement: (element: HTMLDivElement | null) => void;
}

export const DocumentControlsContext = createContext<ControlsTarget | null>(null);

export function DocumentControlsProvider({documentId, label = 'Sprite controls', children}: {documentId: string | null; label?: string; children: ReactNode}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const target = useMemo(() => ({documentId, label, element, setElement}), [documentId, label, element]);
  return <DocumentControlsContext.Provider value={target}>{children}</DocumentControlsContext.Provider>;
}

// Keep controls bound to their view while displaying only the active
// document's controls in the shared property bar, including in split layouts.
export function DocumentControls({documentId, children}: {documentId: string; children: ReactNode}) {
  const target = useContext(DocumentControlsContext);
  return target?.element && target.documentId === documentId ? createPortal(children, target.element) : null;
}
