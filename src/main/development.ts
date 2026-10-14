import {BrowserWindow, ipcMain} from 'electron';

// Only yarn dev launches Electron with a parent IPC channel.
export function connectDevelopment(getWindow: () => BrowserWindow | undefined) {
  if (!process.send) return;

  process.on('message', (message: unknown) => {
    const update = message as {type?: string; available?: boolean; restartRequired?: boolean} | null;
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    if (update?.type === 'dev-update' && typeof update.available === 'boolean') {
      window.webContents.send('dev-update', update.available, update.restartRequired === true);
    } else if (update?.type === 'dev-reload-renderer') {
      window.webContents.reload();
    }
  });

  for (const channel of ['dev-update-check', 'dev-reload']) {
    ipcMain.on(channel, event => {
      if (event.sender === getWindow()?.webContents && process.connected) {
        process.send?.({type: channel}, (error: Error | null) => {
          if (error) console.error('[dev] Could not contact the development watcher:', error);
        });
      }
    });
  }
}
