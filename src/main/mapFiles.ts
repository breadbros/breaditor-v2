import {createHash, randomBytes} from 'crypto';
import {readFile, writeFile, mkdir, copyFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

export interface MapFileWrite {url: string; text?: string; sourceUrl?: string}
const activeSaves = new Set<{destinations: Set<string>; done: Promise<void>}>();
async function acquireDestinations(destinations: string[]) {
  const names = new Set(destinations.map(name => path.resolve(name).toLowerCase()));
  const predecessors = [...activeSaves].filter(save => [...names].some(name => save.destinations.has(name)));
  let release!: () => void;
  const reservation = {destinations: names, done: new Promise<void>(resolve => {release = resolve;})};
  activeSaves.add(reservation);
  await Promise.all(predecessors.map(save => save.done));
  return () => {activeSaves.delete(reservation); release();};
}
export async function fileHash(url: string): Promise<string | null> {
  const location = new URL(url);
  if (location.protocol !== 'file:') throw new Error('Map writes require local file URLs.');
  try { return createHash('sha256').update(await readFile(fileURLToPath(location))).digest('hex'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

/** Stage every file first; retain stages, backups and journal for recovery. */
export async function commitMapFiles(writes: MapFileWrite[], expected: Record<string, string | null> = {}) {
  if (!writes.length) throw new Error('No map files to save.');
  const destinations = writes.map(write => {
    const url = new URL(write.url);
    if (url.protocol !== 'file:') throw new Error('Map writes require local file URLs.');
    return fileURLToPath(url);
  });
  if (new Set(destinations.map(name => path.resolve(name).toLowerCase())).size !== destinations.length)
    throw new Error('Duplicate map save destinations.');
  const release = await acquireDestinations(destinations);
  try {return await commitMapTransaction(writes, expected, destinations);}
  finally {release();}
}

async function commitMapTransaction(writes: MapFileWrite[], expected: Record<string, string | null>, destinations: string[]) {
  async function checkSources() {
    for (const [url, hash] of Object.entries(expected))
      if (await fileHash(url) !== hash) throw new Error(`Source changed on disk: ${url}. Reload or Save As.`);
  }
  await checkSources();
  const transaction = `${Date.now()}-${randomBytes(6).toString('hex')}`;
  const entries: Array<{destination: string; stage: string; backup: string | null; attempted: boolean; written: boolean}> = [];
  for (let index = 0; index < writes.length; index++) {
    const destination = destinations[index];
    await mkdir(path.dirname(destination), {recursive: true});
    const stage = `${destination}.breaditor-stage-${transaction}`;
    const backup = `${destination}.breaditor-backup-${transaction}`;
    const originalHash = await fileHash(writes[index].url);
    if (originalHash !== null) await copyFile(destination, backup);
    const write = writes[index];
    if (write.text !== undefined) await writeFile(stage, write.text, 'utf8');
    else if (write.sourceUrl) await copyFile(fileURLToPath(write.sourceUrl), stage);
    else throw new Error('A saved file needs text or a source URL.');
    entries.push({destination, stage, backup: originalHash === null ? null : backup, attempted: false, written: false});
  }
  await checkSources();
  const journal = `${destinations[0]}.breaditor-recovery-${transaction}.json`;
  let status = 'staged';
  const record = () => writeFile(journal, JSON.stringify({status, entries}, null, 2), 'utf8');
  await record();
  try {
    for (const entry of entries) {
      // A failed copy can already have truncated the destination.
      entry.attempted = true;
      await record();
      await copyFile(entry.stage, entry.destination);
      entry.written = true;
      await record();
    }
    status = 'complete';
    await record();
  } catch (cause) {
    status = 'failed';
    const failedRestores: string[] = [];
    for (const entry of entries.filter(entry => entry.attempted && entry.backup)) {
      try { await copyFile(entry.backup!, entry.destination); }
      catch { failedRestores.push(entry.destination); }
    }
    let journalFailure = '';
    try { await record(); }
    catch (error) { journalFailure = `; could not update recovery journal: ${String(error)}`; }
    throw new Error(`Map save failed. Recovery journal: ${journal}${failedRestores.length ? `; restore required: ${failedRestores.join(', ')}` : ''}${journalFailure}. ${String(cause)}`);
  }
  const hashes: Record<string, string | null> = {};
  for (const write of writes) hashes[write.url] = await fileHash(write.url);
  return {hashes, journal: pathToFileURL(journal).href};
}

export function relativeFileReference(fromUrl: string, toUrl: string): string {
  const relative = path.relative(path.dirname(fileURLToPath(fromUrl)), fileURLToPath(toUrl));
  return path.isAbsolute(relative) ? toUrl : relative.split(path.sep).map(segment => encodeURIComponent(segment)).join('/');
}
