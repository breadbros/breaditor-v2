import {pathToFileURL} from 'url';
import path from 'path';

let api: {showImageInFolder: (url: string) => Promise<void>};
const showItemInFolder = jest.fn();

beforeEach(() => {
  jest.resetModules();
  showItemInFolder.mockReset();
  jest.doMock('electron', () => ({
    shell: {showItemInFolder},
    contextBridge: {exposeInMainWorld: (_name: string, exposed: typeof api) => { api = exposed; }},
    ipcRenderer: {on: jest.fn()},
  }));
  require('./preload.js');
});

test('reveals a local image using its decoded native path', async () => {
  const imagePath = path.resolve('Sprite Images', 'atlas #1.png');
  await api.showImageInFolder(pathToFileURL(imagePath).href);
  expect(showItemInFolder).toHaveBeenCalledWith(imagePath);
});

test.each(['https://example.test/image.png', 'javascript:alert(1)', 'not a URL'])(
  'rejects non-file image locations: %s', async url => {
    await expect(api.showImageInFolder(url)).rejects.toBeDefined();
    expect(showItemInFolder).not.toHaveBeenCalled();
  },
);

test('returns native reveal errors to the caller', async () => {
  showItemInFolder.mockImplementation(() => { throw new Error('Reveal failed'); });
  await expect(api.showImageInFolder(pathToFileURL(path.resolve('atlas.png')).href))
    .rejects.toThrow('Reveal failed');
});
