import { deliverDueSignals, type SignalDeps } from './signal-use-cases.ts';

export interface SignalDeliveryLoop {
  /** Stops scheduling and waits for the send in flight to store its result. */
  stop(): Promise<void>;
}

/** Runs one delivery pass at a time on a fixed interval; passes never overlap. */
export function startSignalDelivery(
  deps: SignalDeps,
  onError: (error: unknown) => void,
  intervalMs = 10_000,
): SignalDeliveryLoop {
  let running: Promise<void> | null = null;
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped || running) return;
    running = deliverDueSignals(deps)
      .then(() => undefined, onError)
      .finally(() => { running = null; });
  }, intervalMs);
  timer.unref();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
