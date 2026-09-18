import type { CollectionName, Database, ProjectRecord, RecordStore } from '../../shared/record-store.ts';

export type Snapshot = Record<CollectionName, ProjectRecord[]>;

/** Record store over an in-memory array. Records are cloned so callers cannot mutate stored state. */
export class ArrayRecordStore<T extends ProjectRecord> implements RecordStore<T> {
  private readonly rows: T[];
  private readonly onChange: () => Promise<void>;

  constructor(rows: T[], onChange: () => Promise<void>) {
    this.rows = rows;
    this.onChange = onChange;
  }

  async listAll(): Promise<readonly T[]> {
    return this.rows.map((r) => structuredClone(r));
  }

  async listByProject(projectCode: string): Promise<readonly T[]> {
    return this.rows.filter((r) => r.projectCode === projectCode).map((r) => structuredClone(r));
  }

  async get(id: string): Promise<T | undefined> {
    const row = this.rows.find((r) => r.id === id);
    return row ? structuredClone(row) : undefined;
  }

  async put(record: T): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === record.id);
    const copy = structuredClone(record);
    if (index >= 0) this.rows[index] = copy;
    else this.rows.push(copy);
    await this.onChange();
  }
}

export function emptySnapshot(): Snapshot {
  return {
    workspaces: [],
    tides: [],
    variants: [],
    revisions: [],
    comments: [],
    ratings: [],
    decisions: [],
    requests: [],
    selections: [],
    builds: [],
    artifacts: [],
    deployments: [],
  };
}

/** Volatile database for tests and explicit in-memory runs. */
export class MemoryDatabase implements Database {
  protected readonly snapshot: Snapshot;

  constructor(snapshot: Snapshot = emptySnapshot()) {
    this.snapshot = snapshot;
  }

  collection<T extends ProjectRecord>(name: CollectionName): RecordStore<T> {
    return new ArrayRecordStore<T>(this.snapshot[name] as T[], () => this.persist());
  }

  protected async persist(): Promise<void> {
    // In-memory: nothing to flush.
  }
}
