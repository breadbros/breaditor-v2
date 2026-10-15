import {createHash} from 'crypto';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {readFile, writeFile, mkdir, copyFile} from 'fs/promises';
import {commitMapFiles, fileHash, relativeFileReference} from './mapFiles';

jest.mock('fs/promises', () => ({readFile: jest.fn(), writeFile: jest.fn(), mkdir: jest.fn(), copyFile: jest.fn()}));
const read = readFile as jest.Mock;
const write = writeFile as jest.Mock;
const copy = copyFile as jest.Mock;
const makeDirectory = mkdir as jest.Mock;
const mapUrl = pathToFileURL(path.resolve('map-test/farmsville.map.json')).href;
const dataUrl = pathToFileURL(path.resolve('map-test/farmsville.map.data.json')).href;
const filename = (url: string) => fileURLToPath(url);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
let files: Map<string, Buffer>;

beforeEach(() => {
  jest.clearAllMocks();
  files = new Map([[filename(mapUrl), Buffer.from('old-map')], [filename(dataUrl), Buffer.from('old-data')]]);
  read.mockImplementation(async name => {
    if (!files.has(name)) throw Object.assign(new Error(`Missing ${name}`), {code: 'ENOENT'});
    return files.get(name);
  });
  write.mockImplementation(async (name, bytes) => {files.set(name, Buffer.from(bytes));});
  copy.mockImplementation(async (source, destination) => {
    if (!files.has(source)) throw Object.assign(new Error(`Missing ${source}`), {code: 'ENOENT'});
    files.set(destination, Buffer.from(files.get(source)!));
  });
  makeDirectory.mockResolvedValue(undefined);
});

test('hashing handles absent files and rejects nonlocal destinations', async () => {
  expect(await fileHash(mapUrl)).toBe(hash('old-map'));
  expect(await fileHash(`${mapUrl}.absent`)).toBeNull();
  await expect(fileHash('https://example.test/map.json')).rejects.toThrow('local file URLs');
});

test('source conflict aborts the complete write set before staging or touching destinations', async () => {
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, text: 'new-data'}], {
    [mapUrl]: hash('old-map'), [dataUrl]: hash('someone-else-edited-data'),
  })).rejects.toThrow('Source changed on disk');
  expect(makeDirectory).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(copy).not.toHaveBeenCalled();
  expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
});

test('duplicate destinations, empty writes and remote writes fail before filesystem mutation', async () => {
  await expect(commitMapFiles([])).rejects.toThrow('No map files');
  await expect(commitMapFiles([{url: mapUrl, text: 'a'}, {url: mapUrl, text: 'b'}])).rejects.toThrow('Duplicate');
  await expect(commitMapFiles([{url: 'https://example.test/a.json', text: 'a'}])).rejects.toThrow('local file URLs');
  expect(write).not.toHaveBeenCalled();
  expect(copy).not.toHaveBeenCalled();
});

test('stages every input before changing destinations, preserving originals if a source is missing', async () => {
  const missing = `${dataUrl}.missing`;
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, sourceUrl: missing}])).rejects.toThrow('Missing');
  expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
  expect(files.get(filename(dataUrl))!.toString()).toBe('old-data');
  expect(copy.mock.calls.every(([, destination]) => destination.includes('.breaditor-'))).toBe(true);
});

test('rechecks source hashes after staging and does not overwrite a concurrent edit', async () => {
  write.mockImplementation(async (name, bytes) => {
    files.set(name, Buffer.from(bytes));
    if (name.startsWith(filename(dataUrl)) && name.includes('.breaditor-stage-')) {
      files.set(filename(dataUrl), Buffer.from('external edit during staging'));
    }
  });
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, text: 'new-data'}], {
    [mapUrl]: hash('old-map'), [dataUrl]: hash('old-data'),
  })).rejects.toThrow('Source changed on disk');
  expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
  expect(files.get(filename(dataUrl))!.toString()).toBe('external edit during staging');
});

test('successful multi-file saves retain stages, backups, completed journal and final hashes', async () => {
  const result = await commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, text: 'new-data'}], {
    [mapUrl]: hash('old-map'), [dataUrl]: hash('old-data'),
  });
  expect(result.hashes).toEqual({[mapUrl]: hash('new-map'), [dataUrl]: hash('new-data')});
  const journal = JSON.parse(files.get(filename(result.journal))!.toString());
  expect(journal.status).toBe('complete');
  expect(journal.entries).toHaveLength(2);
  journal.entries.forEach((entry: {stage: string; backup: string; attempted: boolean; written: boolean}, index: number) => {
    expect(entry.attempted && entry.written).toBe(true);
    expect(files.get(entry.stage)!.toString()).toBe(index ? 'new-data' : 'new-map');
    expect(files.get(entry.backup)!.toString()).toBe(index ? 'old-data' : 'old-map');
  });
});

test('a partially failed copy restores both the completed and partially overwritten destinations', async () => {
  copy.mockImplementation(async (source, destination) => {
    if (source.includes('.breaditor-stage-') && destination === filename(dataUrl)) {
      files.set(destination, Buffer.from('partial'));
      throw new Error('disk full');
    }
    files.set(destination, Buffer.from(files.get(source)!));
  });
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, text: 'new-data'}])).rejects.toThrow('Recovery journal:');
  expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
  expect(files.get(filename(dataUrl))!.toString()).toBe('old-data');
  const journalFile = [...files.keys()].find(name => name.includes('.breaditor-recovery-'))!;
  const journal = JSON.parse(files.get(journalFile)!.toString());
  expect(journal.status).toBe('failed');
  expect(journal.entries.map((entry: {attempted: boolean; written: boolean}) => [entry.attempted, entry.written]))
    .toEqual([[true, true], [true, false]]);
});

test('reports destinations whose backup cannot be restored while retaining the recovery evidence', async () => {
  copy.mockImplementation(async (source, destination) => {
    if (source.includes('.breaditor-stage-') && destination === filename(dataUrl)) throw new Error('disk full');
    if (source.includes('.breaditor-backup-') && destination === filename(mapUrl)) throw new Error('file locked');
    files.set(destination, Buffer.from(files.get(source)!));
  });
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}, {url: dataUrl, text: 'new-data'}]))
    .rejects.toThrow(`restore required: ${filename(mapUrl)}`);
  expect([...files.keys()].filter(name => name.includes('.breaditor-backup-'))).toHaveLength(2);
  expect([...files.keys()].some(name => name.includes('.breaditor-recovery-'))).toBe(true);
});

test('copied binary dependencies and new destinations preserve bytes without requiring an original backup', async () => {
  const sourceUrl = `${mapUrl}.png`;
  const destinationUrl = `${dataUrl}.png`;
  files.set(filename(sourceUrl), Buffer.from([0, 255, 128, 7]));
  const result = await commitMapFiles([{url: destinationUrl, sourceUrl}], {[destinationUrl]: null});
  expect(files.get(filename(destinationUrl))).toEqual(Buffer.from([0, 255, 128, 7]));
  expect(JSON.parse(files.get(filename(result.journal))!.toString()).entries[0].backup).toBeNull();
});

test('recovery-journal failure preserves the original save error and retained backup path', async () => {
  let savingFailed = false;
  copy.mockImplementation(async (source, destination) => {
    if (source.includes('.breaditor-stage-')) {
      savingFailed = true;
      throw new Error('destination locked');
    }
    files.set(destination, Buffer.from(files.get(source)!));
  });
  write.mockImplementation(async (name, bytes) => {
    if (savingFailed && name.includes('.breaditor-recovery-')) throw new Error('journal locked');
    files.set(name, Buffer.from(bytes));
  });
  await expect(commitMapFiles([{url: mapUrl, text: 'new-map'}])).rejects.toThrow(/Recovery journal: .*could not update recovery journal:.*journal locked.*destination locked/);
  expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
});

test('Save As references use forward slashes and remain relative to the new map directory', () => {
  const image = pathToFileURL(path.resolve('map-test/images/tiles.png')).href;
  expect(relativeFileReference(mapUrl, image)).toBe('images/tiles.png');
});

test('Save As relative references escape URL-sensitive filename characters without changing the target', () => {
  const image = pathToFileURL(path.resolve('map-test/images #100%/tiles #1%.png')).href;
  const reference = relativeFileReference(mapUrl, image);
  expect(reference).toBe('images%20%23100%25/tiles%20%231%25.png');
  expect(new URL(reference, mapUrl).href).toBe(image);
});

test('overlapping save transactions serialize before checking hashes and reject a stale second document', async () => {
  let stagingStarted!: () => void, releaseStaging!: () => void;
  const started = new Promise<void>(resolve => {stagingStarted = resolve;});
  const staging = new Promise<void>(resolve => {releaseStaging = resolve;});
  let held = false;
  write.mockImplementation(async (name, bytes) => {
    if (name.includes('.breaditor-stage-') && !held) {held = true; stagingStarted(); await staging;}
    files.set(name, Buffer.from(bytes));
  });
  const first = commitMapFiles([{url: mapUrl, text: 'first-map'}, {url: dataUrl, text: 'first-data'}], {[mapUrl]: hash('old-map')});
  await started;
  const readsBeforeSecond = read.mock.calls.length;
  const second = commitMapFiles([{url: dataUrl, text: 'second-data'}], {[dataUrl]: hash('old-data')});
  await Promise.resolve();
  expect(read.mock.calls).toHaveLength(readsBeforeSecond);
  const rejected = expect(second).rejects.toThrow('Source changed on disk');
  releaseStaging();
  await first;
  await rejected;
  expect(files.get(filename(mapUrl))!.toString()).toBe('first-map');
  expect(files.get(filename(dataUrl))!.toString()).toBe('first-data');
});

test('independent write sets can finish while another transaction is still staging', async () => {
  let stagingStarted!: () => void, releaseStaging!: () => void;
  const started = new Promise<void>(resolve => {stagingStarted = resolve;});
  const staging = new Promise<void>(resolve => {releaseStaging = resolve;});
  write.mockImplementation(async (name, bytes) => {
    if (name.startsWith(filename(mapUrl)) && name.includes('.breaditor-stage-')) {stagingStarted(); await staging;}
    files.set(name, Buffer.from(bytes));
  });
  const first = commitMapFiles([{url: mapUrl, text: 'new-map'}]);
  await started;
  try {
    await commitMapFiles([{url: dataUrl, text: 'independent-data'}]);
    expect(files.get(filename(dataUrl))!.toString()).toBe('independent-data');
    expect(files.get(filename(mapUrl))!.toString()).toBe('old-map');
  } finally {releaseStaging(); await first;}
});

test('a failed transaction releases its destination reservation for a subsequent save', async () => {
  const original = write.getMockImplementation()!;
  write.mockImplementationOnce(async () => {throw new Error('stage unavailable');});
  await expect(commitMapFiles([{url: mapUrl, text: 'failed'}])).rejects.toThrow('stage unavailable');
  write.mockImplementation(original);
  await commitMapFiles([{url: mapUrl, text: 'recovered'}], {[mapUrl]: hash('old-map')});
  expect(files.get(filename(mapUrl))!.toString()).toBe('recovered');
});
