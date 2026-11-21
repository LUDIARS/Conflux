const pendingByScope = new WeakMap<object, Map<string, Promise<unknown>>>();

/** Serialises a read/modify/write sequence for one record within a store. */
export async function serialByKey<T>(scope: object, key: string, operation: () => Promise<T>): Promise<T> {
  const pending = pendingByScope.get(scope) ?? new Map<string, Promise<unknown>>();
  pendingByScope.set(scope, pending);
  const previous = pending.get(key);
  const current = previous ? previous.then(operation, operation) : Promise.resolve().then(operation);
  pending.set(key, current);
  try {
    return await current;
  } finally {
    if (pending.get(key) === current) pending.delete(key);
  }
}
