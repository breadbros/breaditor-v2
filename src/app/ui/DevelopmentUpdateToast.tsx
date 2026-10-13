import React, {useEffect, useState} from 'react';

// @ts-ignore
import css from './DevelopmentUpdateToast.module.css';

declare global {
  interface Window {
    electronAPI?: {
      onDevelopmentUpdate?: (callback: (available: boolean, restartRequired?: boolean) => void) => () => void;
      reloadDevelopment?: () => void;
    };
  }
}

export function DevelopmentUpdateToast() {
  const [update, setUpdate] = useState({available: false, restartRequired: false});

  useEffect(() => window.electronAPI?.onDevelopmentUpdate?.((available, restartRequired = false) => {
    setUpdate({available, restartRequired});
  }), []);

  if (!update.available) return null;

  return (
    <div className={css.toast} role="status" aria-live="polite" aria-atomic="true">
      <span>New changes are available.</span>
      <button type="button" className={css.reload} onClick={() => {
        window.electronAPI?.reloadDevelopment?.();
      }}>
        {update.restartRequired ? 'Restart app' : 'Reload'}
      </button>
    </div>
  );
}
