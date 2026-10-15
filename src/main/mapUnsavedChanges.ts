import {BrowserWindow, dialog} from 'electron';

/** Electron requires an explicit choice when renderer beforeunload vetoes close. */
export function registerUnsavedMapGuard(window: BrowserWindow) {
  window.webContents.on?.('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question', title: 'Unsaved map changes',
      message: 'Discard unsaved map changes and close the editor?',
      buttons: ['Keep editing', 'Discard changes'], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) event.preventDefault();
  });
}
