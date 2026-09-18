import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COLLECTION_NAMES } from '../../shared/record-store.ts';
import { emptySnapshot, MemoryDatabase, type Snapshot } from './memory-database.ts';

export const STATE_FILE = 'conflux-state.json';
const FORMAT_VERSION = 1;

interface StateDocument {
  readonly version: number;
  readonly collections: Snapshot;
}

function parseDocument(text: string, path: string): Snapshot {
  const doc = JSON.parse(text) as Partial<StateDocument>;
  if (doc.version !== FORMAT_VERSION || typeof doc.collections !== 'object' || doc.collections === null) {
    throw new Error(`Conflux state ${path} has unsupported format version ${String(doc.version)}`);
  }
  const snapshot = emptySnapshot();
  for (const name of COLLECTION_NAMES) {
    const rows = (doc.collections as Partial<Snapshot>)[name];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Conflux state ${path}: collection ${name} is not an array`);
    snapshot[name] = rows ?? [];
  }
  return snapshot;
}

/**
 * Whole-document JSON persistence. Writes are serialised and replace the file atomically
 * (temp file + rename) so a crash never leaves a half-written state.
 */
export class JsonFileDatabase extends MemoryDatabase {
  private readonly path: string;
  private chain: Promise<void> = Promise.resolve();

  private constructor(path: string, snapshot: Snapshot) {
    super(snapshot);
    this.path = path;
  }

  static async open(dataDir: string): Promise<JsonFileDatabase> {
    await mkdir(dataDir, { recursive: true });
    const path = join(dataDir, STATE_FILE);
    let snapshot: Snapshot;
    try {
      snapshot = parseDocument(await readFile(path, 'utf8'), path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      snapshot = emptySnapshot();
    }
    return new JsonFileDatabase(path, snapshot);
  }

  protected override persist(): Promise<void> {
    const doc: StateDocument = { version: FORMAT_VERSION, collections: this.snapshot };
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    const next = this.chain.then(async () => {
      const tmp = `${this.path}.${process.pid}.tmp`;
      await writeFile(tmp, text, { encoding: 'utf8' });
      await rename(tmp, this.path);
    });
    // Keep the chain alive after a failed write; the failure is still returned to this caller.
    this.chain = next.catch(() => undefined);
    return next;
  }
}
