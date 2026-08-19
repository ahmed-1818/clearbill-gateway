/**
 * Idempotency keys for financial mutations.
 *
 * Every manual money mutation (counter cash, challan issuance) carries an
 * `action_idempotency_key`. The store rejects a replay of a key it has already
 * consumed, so a double-click can never generate a phantom cash entry — and the
 * same key is what the backend will de-duplicate against.
 */

export function newIdempotencyKey(scope: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `idk_${scope}_${Date.now().toString(36)}_${rand}`;
}

const consumed = new Set<string>();

/** Returns false when the key was already consumed (a replay). */
export function claimIdempotencyKey(key: string): boolean {
  if (!key) return true;
  if (consumed.has(key)) return false;
  consumed.add(key);
  return true;
}

export function resetIdempotencyLedger() {
  consumed.clear();
}
