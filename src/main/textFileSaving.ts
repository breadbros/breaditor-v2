import {BrowserWindow, dialog, ipcMain} from 'electron';
import {writeFile} from 'fs/promises';
import {fileURLToPath, pathToFileURL} from 'url';

export function registerTextFileSaving() {
  ipcMain.handle('save-text-file', async (event, request: {
    sourceUrl?: string; suggestedName: string; text: string; saveAs: boolean;
  }) => {
    if (!request || typeof request.text !== 'string' || typeof request.suggestedName !== 'string') {
      throw new Error('Invalid text save request.');
    }
    let filepath: string | undefined;
    if (request.sourceUrl) {
      const source = new URL(request.sourceUrl);
      if (source.protocol !== 'file:') throw new Error('Only local files can be overwritten.');
      filepath = fileURLToPath(source);
    }
    if (request.saveAs || !filepath) {
      const owner = BrowserWindow.fromWebContents(event.sender);
      const options = {defaultPath: filepath || request.suggestedName};
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      filepath = result.filePath;
    }
    await writeFile(filepath, request.text, 'utf8');
    return {url: pathToFileURL(filepath).href};
  });
}
