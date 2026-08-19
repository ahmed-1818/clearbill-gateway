/**
 * Zero-trust workspace guards.
 *
 * Attached to every admin route via `beforeLoad`, so a `/app/gym/*` URL typed
 * by a school tenant (or a signed-out visitor) never renders — the router
 * redirects to `/` before the component or loader runs. Public parent-portal
 * checkout routes (the `pay` links) are intentionally NOT guarded: guardians

 * have no session.
 */

import { redirect } from "@tanstack/react-router";

import type { WorkspaceType } from "./auth-store";

const STORAGE_KEY = "clearbill.auth.user";

/** Reads the session directly from storage — beforeLoad runs before hydration. */
function sessionWorkspace(): WorkspaceType | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { workspace_type?: WorkspaceType };
    return parsed?.workspace_type ?? null;
  } catch {
    return null;
  }
}

export function requireWorkspace(expected: WorkspaceType) {
  return () => {
    // The session lives in the browser only; SSR/prerender cannot evaluate it,
    // so the check runs on the client pass of this isomorphic lifecycle hook.
    if (typeof window === "undefined") return;
    if (sessionWorkspace() !== expected) {
      throw redirect({ to: "/" });
    }
  };
}
