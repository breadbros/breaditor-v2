import {registerTextFileSaving} from './textFileSaving';
import {ipcMain, dialog} from 'electron';
import {writeFile} from 'fs/promises';
import path from 'path';
import os from 'os';
import {pathToFileURL} from 'url';

const existingPath = path.join(os.tmpdir(), 'Sprite Files', 'stan#1.json');
const selectedPath = path.join(os.tmpdir(), 'Saved Files', 'new.json');
const existingUrl = pathToFileURL(existingPath).href;

jest.mock('electron', () => ({
  ipcMain: {handle: jest.fn()},
  dialog: {showSaveDialog: jest.fn()},
  BrowserWindow: {fromWebContents: jest.fn(() => null)},
}));
jest.mock('fs/promises', () => ({writeFile: jest.fn()}));

let save: (event: any, request: any) => Promise<any>;
beforeEach(() => {
  jest.clearAllMocks();
  registerTextFileSaving();
  save = (ipcMain.handle as jest.Mock).mock.calls[0][1];
  (writeFile as jest.Mock).mockResolvedValue(undefined);
});

test('writes UTF-8 to a decoded local source without showing a dialog', async () => {
  const result = await save({sender: {}}, {
    sourceUrl: existingUrl, suggestedName: 'stan#1.json', text: '// source\r\n{}\r\n', saveAs: false,
  });
  expect(writeFile).toHaveBeenCalledWith(existingPath, '// source\r\n{}\r\n', 'utf8');
  expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  expect(result.url).toBe(existingUrl);
});

test('Save As writes the selected path and returns its URL', async () => {
  (dialog.showSaveDialog as jest.Mock).mockResolvedValue({canceled: false, filePath: selectedPath});
  const result = await save({sender: {}}, {suggestedName: 'lord_stan.json', text: '{"saved":true}', saveAs: true});
  expect(dialog.showSaveDialog).toHaveBeenCalledWith({defaultPath: 'lord_stan.json'});
  expect(writeFile).toHaveBeenCalledWith(selectedPath, '{"saved":true}', 'utf8');
  expect(result.url).toBe(pathToFileURL(selectedPath).href);
});

test('canceling the picker never writes a file', async () => {
  (dialog.showSaveDialog as jest.Mock).mockResolvedValue({canceled: true});
  await expect(save({sender: {}}, {suggestedName: 'untitled.txt', text: 'draft', saveAs: false})).resolves.toBeNull();
  expect(writeFile).not.toHaveBeenCalled();
});

test('rejects remote overwrite targets and malformed content', async () => {
  await expect(save({sender: {}}, {sourceUrl: 'https://example.com/file', suggestedName: 'file', text: 'draft'})).rejects.toThrow('Only local');
  await expect(save({sender: {}}, {suggestedName: 'file', text: {}})).rejects.toThrow('Invalid text save');
  expect(writeFile).not.toHaveBeenCalled();
});

test('propagates write failures instead of reporting success', async () => {
  (writeFile as jest.Mock).mockRejectedValue(new Error('disk full'));
  await expect(save({sender: {}}, {sourceUrl: existingUrl, suggestedName: 'file.txt', text: 'draft', saveAs: false})).rejects.toThrow('disk full');
});
