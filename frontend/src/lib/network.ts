/**
 * Network resilience layer.
 *
 * The stores are written as if every mutation crosses the wire: latency is
 * simulated, a fraction of calls fail, and callers must handle rollback. This
 * keeps the frontend honest about the fact that the browser is NOT the source
 * of truth — PostgreSQL is, and webhooks can settle a ledger behind our back.
 */

export class NetworkDesyncError extends Error {
  constructor(message = "NETWORK DESYNC: Settlement Failed") {
    super(message);
    this.name = "NetworkDesyncError";
  }
}

/** Raised when a pre-flight check finds the row already settled by a webhook. */
export class StaleLedgerError extends Error {
  constructor(message = "LEDGER STALE: already settled by gateway webhook") {
    super(message);
    this.name = "StaleLedgerError";
  }
}

/** Simulated round-trip latency (ms) and failure probability. */
export const NETWORK_LATENCY_MS = 320;
export const NETWORK_FAILURE_RATE = 0.05; // 5% — mirrors real gateway flakiness

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Awaits a simulated API round-trip. Throws `NetworkDesyncError` on the
 * unlucky 5% so every caller is forced to implement a rollback path.
 */
export async function simulateApiCall(latency: number = NETWORK_LATENCY_MS): Promise<void> {
  await sleep(latency);
  if (Math.random() < NETWORK_FAILURE_RATE) throw new NetworkDesyncError();
}

/** Read-only round-trip (aggregations, freshness pings) — never fails hard. */
export async function simulateApiRead(latency: number = NETWORK_LATENCY_MS): Promise<void> {
  await sleep(latency);
}

/**
 * Deep, reference-free snapshot for optimistic rollbacks.
 *
 * A shallow `const prev = state` is NOT a backup: any nested array/object that
 * a mutation touches in place is shared with the "backup", so the rollback
 * restores the corrupted rows. Every rollback anchor must go through here.
 */
export function snapshotState<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      /* fall through to JSON clone */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
