import {BrowserWindow, dialog, ipcMain} from 'electron';
import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {commitMapFiles, fileHash, MapFileWrite, relativeFileReference} from './mapFiles';

interface SaveRequest {
  sourceUrl?: string; suggestedName: string; map: string; data: string;
  saveAs: boolean; contentRootUrl: string; dependencies: string[];
  expectedHashes: Record<string, string | null>; exportProject?: boolean;
}
export function registerMapFileSaving() {
  ipcMain.handle('map-file-hashes', async (_event, urls: string[]) => {
    const hashes: Record<string, string | null> = {};
    for (const url of urls) if (new URL(url).protocol === 'file:') hashes[url] = await fileHash(url);
    return hashes;
  });
  ipcMain.handle('save-map-files', async (event, request: SaveRequest) => {
    if (!request || typeof request.map !== 'string' || typeof request.data !== 'string') throw new Error('Invalid map save request.');
    const map = JSON.parse(request.map);
    JSON.parse(request.data);
    const source = request.sourceUrl ? new URL(request.sourceUrl) : undefined;
    let filename = source?.protocol === 'file:' ? fileURLToPath(source) : undefined;
    if (request.saveAs || request.exportProject || !filename) {
      const owner = BrowserWindow.fromWebContents(event.sender);
      const options = {defaultPath: filename || request.suggestedName, filters: [{name: 'Crustacean Map', extensions: ['map.json']}]};
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      filename = /\.map\.json$/i.test(result.filePath) ? result.filePath : `${result.filePath}.map.json`;
    }
    const mapUrl = pathToFileURL(filename).href;
    const dataUrl = pathToFileURL(filename.replace(/\.map\.json$/i, '.map.data.json')).href;
    if (dataUrl === mapUrl) throw new Error('Map filename must end in .map.json.');
    const sourceMapUrl = request.sourceUrl || mapUrl;
    const dependencyMap = new Map<string, string>();
    let contentRootUrl = request.contentRootUrl;
    const copies: MapFileWrite[] = [];
    if (request.exportProject) {
      const bundleDirectory = path.join(path.dirname(filename), `${path.basename(filename, '.map.json')}.assets`);
      const root = fileURLToPath(request.contentRootUrl);
      contentRootUrl = pathToFileURL(bundleDirectory + path.sep).href;
      for (const url of request.dependencies) {
        if (url === request.sourceUrl || url.replace(/\.map\.data\.json$/i, '.map.json') === request.sourceUrl) continue;
        if (new URL(url).protocol !== 'file:') throw new Error('Project export currently requires local dependencies.');
        const relative = path.relative(root, fileURLToPath(url));
        if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
          throw new Error(`Project dependency is outside the content root: ${url}`);
        dependencyMap.set(url, pathToFileURL(path.join(bundleDirectory, relative)).href);
      }
      for (const [url, destination] of dependencyMap) {
        if (/\.json$/i.test(new URL(url).pathname)) {
          const json = JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
          const imageKey = typeof json.source_image === 'string' ? 'source_image' : typeof json.image === 'string' ? 'image' : undefined;
          if (imageKey) {
            const reference = json[imageKey].replace(/\\/g, '/');
            const imageUrl = reference.startsWith('~/') ? new URL(reference.slice(2), request.contentRootUrl).href : new URL(reference, url).href;
            const copiedImage = dependencyMap.get(imageUrl);
            if (copiedImage) json[imageKey] = relativeFileReference(destination, copiedImage);
          }
          copies.push({url: destination, text: JSON.stringify(json, null, 2)});
        } else copies.push({url: destination, sourceUrl: url});
      }
    }
    if (mapUrl !== request.sourceUrl || request.exportProject) {
      for (const key of Object.keys(map.vsp || {})) {
        const original = new URL(map.vsp[key].replace(/\\/g, '/'), sourceMapUrl).href;
        map.vsp[key] = relativeFileReference(mapUrl, dependencyMap.get(original) || original);
      }
      map.MAPED_CONTENT_ROOT = relativeFileReference(mapUrl, contentRootUrl);
      if (!map.MAPED_CONTENT_ROOT.endsWith('/')) map.MAPED_CONTENT_ROOT += '/';
    }
    const mapText = JSON.stringify(map, null, 2);
    const writes = [{url: dataUrl, text: request.data}, {url: mapUrl, text: mapText}, ...copies];
    const expected = mapUrl === request.sourceUrl && !request.saveAs ? request.expectedHashes : {};
    const result = await commitMapFiles(writes, expected);
    return {url: mapUrl, dataUrl, map: mapText, contentRootUrl, ...result};
  });
  ipcMain.handle('save-map-image', async (event, request: {suggestedName: string; dataUrl: string}) => {
    if (!/^data:image\/png;base64,/.test(request?.dataUrl)) throw new Error('Expected PNG image.');
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {defaultPath: request.suggestedName, filters: [{name: 'PNG image', extensions: ['png']}]};
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, Buffer.from(request.dataUrl.split(',')[1], 'base64'));
    return {url: pathToFileURL(result.filePath).href};
  });
}
