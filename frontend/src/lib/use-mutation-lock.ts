import { useCallback, useRef, useState } from "react";

import { newIdempotencyKey } from "./idempotency";

/**
 * Double-spend lock for financial mutations.
 *
 * `busy` drives the button's `disabled` state instantly, while a ref guard
 * blocks the second click of a double-click even before React re-renders. Each
 * run receives a fresh `action_idempotency_key` to attach to the payload.
 */
export function useMutationLock() {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const run = useCallback(
    async (scope: string, fn: (action_idempotency_key: string) => void | Promise<void>) => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      try {
        await fn(newIdempotencyKey(scope));
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, run };
}
