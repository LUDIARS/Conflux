/**
 * Persistence port shared by all domains. Every record is scoped to a project so
 * a store can never hand one project's data to another project's use case.
 */
export interface ProjectRecord {
  readonly id: string;
  readonly projectCode: string;
}

export interface RecordStore<T extends ProjectRecord> {
  /** Cross-project listing; only for directory views such as the project index. */
  listAll(): Promise<readonly T[]>;
  listByProject(projectCode: string): Promise<readonly T[]>;
  get(id: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
}

/** Collection names are fixed so the stored document shape is explicit. */
export type CollectionName =
  | 'workspaces'
  | 'tides'
  | 'variants'
  | 'revisions'
  | 'comments'
  | 'ratings'
  | 'decisions'
  | 'requests'
  | 'selections'
  | 'builds'
  | 'artifacts'
  | 'deployments';

export const COLLECTION_NAMES: readonly CollectionName[] = [
  'workspaces',
  'tides',
  'variants',
  'revisions',
  'comments',
  'ratings',
  'decisions',
  'requests',
  'selections',
  'builds',
  'artifacts',
  'deployments',
];

export interface Database {
  collection<T extends ProjectRecord>(name: CollectionName): RecordStore<T>;
}
