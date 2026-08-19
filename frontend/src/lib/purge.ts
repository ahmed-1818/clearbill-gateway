/**
 * Multi-tenant purge.
 *
 * Sign-out MUST leave zero residue of the previous tenant in memory: every
 * reactive store is reset to empty collections BEFORE the app navigates back to
 * the landing page, so a second sign-in can never observe another
 * institution's ledgers, students or branches.
 */

import { store as gymStore } from "./clearbill-store";
import { resetIdempotencyLedger } from "./idempotency";
import { schoolStore } from "./school-store";

type Resettable = { reset: () => void };

const registry: Resettable[] = [schoolStore, gymStore];

/** Register any additional reactive store so logout purges it too. */
export function registerPurgeableStore(s: Resettable) {
  if (!registry.includes(s)) registry.push(s);
}

export function purgeAllData() {
  for (const s of registry) {
    try {
      s.reset();
    } catch {
      /* a failing store must not block the purge of the others */
    }
  }
  resetIdempotencyLedger();

  if (typeof window !== "undefined") {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("clearbill."))
        .forEach((k) => window.localStorage.removeItem(k));
      window.sessionStorage.clear();
    } catch {
      /* storage unavailable */
    }
  }
}
