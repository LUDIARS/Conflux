import { randomUUID } from 'node:crypto';

/** Time source. Injected so rules and use cases stay deterministic under test. */
export interface Clock {
  /** UTC ISO 8601 timestamp. */
  now(): string;
}

/** Identifier source. Injected for the same reason as Clock. */
export interface IdGenerator {
  next(prefix: string): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export const uuidIds: IdGenerator = {
  next: (prefix) => `${prefix}_${randomUUID()}`,
};
