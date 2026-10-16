import {ipcMain, dialog, BrowserWindow} from 'electron';
import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {registerMapFileSaving} from './mapFileSaving';
import {commitMapFiles, fileHash} from './mapFiles';

jest.mock('electron', () => ({ipcMain: {handle: jest.fn()}, dialog: {showSaveDialog: jest.fn()}, BrowserWindow: {fromWebContents: jest.fn()}}));
jest.mock('fs/promises', () => ({readFile: jest.fn(), writeFile: jest.fn()}));
jest.mock('./mapFiles', () => ({...jest.requireActual('./mapFiles'), commitMapFiles: jest.fn(), fileHash: jest.fn()}));

const localUrl = (...parts: string[]) => pathToFileURL(path.resolve(...parts)).href;
const rootUrl = `${localUrl('map-handler-test/content')}/`;
const sourceUrl = new URL('maps/farmsville.map.json', rootUrl).href;
const sourceData = new URL('maps/farmsville.map.data.json', rootUrl).href;
const tilesetUrl = new URL('maps/farmsville.vsp.json', rootUrl).href;
const spriteUrl = new URL('sprites/hero.json', rootUrl).href;
const tileImage = new URL('art/tiles.png', rootUrl).href;
const spriteImage = new URL('art/hero.png', rootUrl).href;
const destination = path.resolve('map-handler-test/export/new map#1');
const destinationUrl = `${pathToFileURL(destination).href}.map.json`;
const event = {sender: {}};
let handlers: Record<string, (event: any, request: any) => Promise<any>>;
const commit = commitMapFiles as jest.Mock;
const picker = dialog.showSaveDialog as jest.Mock;

function request(overrides: Record<string, any> = {}) {
  return {sourceUrl, suggestedName: 'farmsville.map.json',
    map: JSON.stringify({name: 'Farmsville', vsp: {default: 'farmsville.vsp.json'}, entities: [{filename: 'sprites/hero.json'}], notes: [{text: 'preserve me'}]}),
    data: '{"tile_data":[[1],[2]],"unknown":"retain"}', saveAs: false,
    contentRootUrl: rootUrl, dependencies: [sourceUrl, sourceData, tilesetUrl, tileImage, spriteUrl, spriteImage],
    expectedHashes: {[sourceUrl]: 'map-hash', [sourceData]: 'data-hash'}, ...overrides};
}

beforeEach(() => {
  jest.clearAllMocks();
  (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
  picker.mockResolvedValue({canceled: false, filePath: destination});
  commit.mockResolvedValue({hashes: {[sourceUrl]: 'written-hash'}, journal: `${sourceUrl}.journal`});
  (fileHash as jest.Mock).mockResolvedValue('hash');
  (writeFile as jest.Mock).mockResolvedValue(undefined);
  (readFile as jest.Mock).mockImplementation(async filename => {
    const url = pathToFileURL(filename).href;
    if (url === tilesetUrl) return JSON.stringify({source_image: '~/art/tiles.png', tilesize: {width: 16, height: 16}});
    if (url === spriteUrl) return JSON.stringify({image: '../art/hero.png', dims: [16, 16]});
    throw new Error(`Missing fixture ${url}`);
  });
  registerMapFileSaving();
  handlers = Object.fromEntries((ipcMain.handle as jest.Mock).mock.calls);
});

test('ordinary save writes the data/map pair together and checks the exact source hashes', async () => {
  const draft = request();
  const result = await handlers['save-map-files'](event, draft);
  expect(picker).not.toHaveBeenCalled();
  const [writes, hashes] = commit.mock.calls[0];
  expect(writes.map((write: {url: string}) => write.url)).toEqual([sourceData, sourceUrl]);
  expect(writes[0].text).toBe(draft.data);
  expect(JSON.parse(writes[1].text)).toEqual(JSON.parse(draft.map));
  expect(hashes).toBe(draft.expectedHashes);
  expect(result).toMatchObject({url: sourceUrl, dataUrl: sourceData, journal: `${sourceUrl}.journal`});
});

test('Save As rebases tilesets and content root while retaining sprite-root references and unknown data', async () => {
  const draft = request({saveAs: true});
  const result = await handlers['save-map-files'](event, draft);
  const [writes, hashes] = commit.mock.calls[0];
  expect(result.url).toBe(destinationUrl);
  expect(result.dataUrl).toBe(destinationUrl.replace(/\.map\.json$/, '.map.data.json'));
  const saved = JSON.parse(writes[1].text);
  expect(new URL(saved.vsp.default, result.url).href).toBe(tilesetUrl);
  expect(new URL(saved.MAPED_CONTENT_ROOT, result.url).href).toBe(rootUrl);
  expect(saved.entities[0].filename).toBe('sprites/hero.json');
  expect(saved.notes).toEqual([{text: 'preserve me'}]);
  expect(writes[0].text).toBe(draft.data);
  expect(hashes).toEqual({});
  expect(readFile).not.toHaveBeenCalled();
});

test('Save As passes the owning window to the picker and preserves an existing map extension', async () => {
  const owner = {id: 17};
  (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(owner);
  picker.mockResolvedValue({canceled: false, filePath: `${destination}.map.json`});
  const result = await handlers['save-map-files'](event, request({saveAs: true}));
  expect(picker).toHaveBeenCalledWith(owner, expect.objectContaining({defaultPath: fileURLToPath(sourceUrl)}));
  expect(result.url).toBe(destinationUrl);
});

test('a new empty map obtains a destination and saves without art or sprite dependencies', async () => {
  const result = await handlers['save-map-files'](event, request({sourceUrl: undefined, saveAs: false,
    map: JSON.stringify({layers: [], vsp: {}, entities: [], zones: [], dimensions: {X: 20, Y: 10}, tile_size: {X: 16, Y: 16}}),
    dependencies: [], expectedHashes: {}}));
  expect(result.url).toBe(destinationUrl);
  expect(commit.mock.calls[0][0]).toHaveLength(2);
  expect(JSON.parse(commit.mock.calls[0][0][1].text).layers).toEqual([]);
  expect(picker).toHaveBeenCalledWith(expect.objectContaining({defaultPath: 'farmsville.map.json'}));
});

test('canceling Save As or project export never reads dependencies or submits writes', async () => {
  picker.mockResolvedValue({canceled: true});
  await expect(handlers['save-map-files'](event, request({saveAs: true}))).resolves.toBeNull();
  await expect(handlers['save-map-files'](event, request({exportProject: true}))).resolves.toBeNull();
  expect(readFile).not.toHaveBeenCalled();
  expect(commit).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
});

test('project export copies a self-contained dependency graph and rebases both image conventions', async () => {
  const result = await handlers['save-map-files'](event, request({exportProject: true, saveAs: true}));
  const [writes] = commit.mock.calls[0];
  const destinations = new Set(writes.map((write: {url: string}) => write.url));
  const savedMap = JSON.parse(writes[1].text);
  expect(destinations.has(new URL(savedMap.vsp.default, result.url).href)).toBe(true);
  expect(new URL(savedMap.MAPED_CONTENT_ROOT, result.url).href).toBe(result.contentRootUrl);
  expect(destinations.has(new URL(savedMap.entities[0].filename, result.contentRootUrl).href)).toBe(true);
  const copiedDefinitions = writes.slice(2).filter((write: {text?: string}) => write.text);
  expect(copiedDefinitions).toHaveLength(2);
  for (const definition of copiedDefinitions) {
    const json = JSON.parse(definition.text);
    const imageUrl = new URL(json.source_image || json.image, definition.url).href;
    expect(destinations.has(imageUrl)).toBe(true);
    expect(imageUrl.startsWith(result.contentRootUrl)).toBe(true);
  }
  const copiedImages = writes.filter((write: {sourceUrl?: string}) => write.sourceUrl);
  expect(copiedImages.map((write: {sourceUrl: string}) => write.sourceUrl).sort()).toEqual([tileImage, spriteImage].sort());
  expect(writes).toHaveLength(6);
  expect(writes.slice(2).every((write: {url: string}) => write.url.startsWith(result.contentRootUrl))).toBe(true);
});

test('project export rejects dependencies outside the content root or remote dependencies before committing', async () => {
  await expect(handlers['save-map-files'](event, request({exportProject: true,
    dependencies: [localUrl('map-handler-test/outside.png')]}))).rejects.toThrow('outside the content root');
  await expect(handlers['save-map-files'](event, request({exportProject: true,
    dependencies: ['https://example.test/art.png']}))).rejects.toThrow('requires local dependencies');
  expect(commit).not.toHaveBeenCalled();
});

test('invalid JSON or unavailable export dependencies never reach the write transaction', async () => {
  await expect(handlers['save-map-files'](event, request({map: '{'}))).rejects.toThrow();
  await expect(handlers['save-map-files'](event, request({data: '{'}))).rejects.toThrow();
  (readFile as jest.Mock).mockRejectedValue(new Error('dependency unavailable'));
  await expect(handlers['save-map-files'](event, request({exportProject: true}))).rejects.toThrow('dependency unavailable');
  expect(commit).not.toHaveBeenCalled();
});

test('transaction errors propagate and an unresolved commit cannot report a saved result', async () => {
  let finish!: (result: any) => void;
  let completed = false;
  commit.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  const saving = handlers['save-map-files'](event, request()).then(result => {completed = true; return result;});
  await Promise.resolve();
  expect(completed).toBe(false);
  finish({hashes: {[sourceUrl]: 'done'}, journal: 'file:///recovery.json'});
  expect((await saving).hashes[sourceUrl]).toBe('done');
  commit.mockRejectedValueOnce(new Error('Map save failed; recovery journal retained'));
  await expect(handlers['save-map-files'](event, request())).rejects.toThrow('recovery journal retained');
});

test('hash lookup ignores remote resources and returns local missing-file results', async () => {
  (fileHash as jest.Mock).mockResolvedValueOnce('local-hash').mockResolvedValueOnce(null);
  const missing = `${sourceUrl}.missing`;
  expect(await handlers['map-file-hashes'](event, [sourceUrl, 'https://example.test/a.png', missing]))
    .toEqual({[sourceUrl]: 'local-hash', [missing]: null});
  expect(fileHash).toHaveBeenCalledTimes(2);
});

(process.platform === 'win32' ? test : test.skip)('cross-drive Save As uses absolute file URLs instead of invalid relative paths', async () => {
  const otherRoot = pathToFileURL('C:\\Sully Content\\').href;
  const otherMap = `${otherRoot}maps/farmsville.map.json`;
  picker.mockResolvedValue({canceled: false, filePath: 'D:\\Saved Maps\\copy.map.json'});
  const result = await handlers['save-map-files'](event, request({sourceUrl: otherMap, saveAs: true, contentRootUrl: otherRoot}));
  const saved = JSON.parse(result.map);
  expect(saved.vsp.default).toBe(`${otherRoot}maps/farmsville.vsp.json`);
  expect(saved.MAPED_CONTENT_ROOT).toBe(otherRoot);
});

test('PNG export validates its data URL, respects cancel and writes the decoded image bytes', async () => {
  await expect(handlers['save-map-image'](event, {dataUrl: 'data:text/plain;base64,AA=='})).rejects.toThrow('Expected PNG');
  picker.mockResolvedValueOnce({canceled: true});
  await expect(handlers['save-map-image'](event, {suggestedName: 'map.png', dataUrl: 'data:image/png;base64,AP+A'})).resolves.toBeNull();
  expect(writeFile).not.toHaveBeenCalled();
  picker.mockResolvedValueOnce({canceled: false, filePath: `${destination}.png`});
  const result = await handlers['save-map-image'](event, {suggestedName: 'map.png', dataUrl: 'data:image/png;base64,AP+A'});
  expect(writeFile).toHaveBeenCalledWith(`${destination}.png`, Buffer.from([0, 255, 128]));
  expect(result.url).toBe(pathToFileURL(`${destination}.png`).href);
});
