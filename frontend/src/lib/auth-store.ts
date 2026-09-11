import { useSyncExternalStore } from "react";
import { purgeAllData } from "./purge";
import { supabase } from "./supabase";

export type WorkspaceType = "gym" | "school";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  workspace_type: WorkspaceType;
  workspace_id: string;
  node_id: string;
  institution_name: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  workspace_type: WorkspaceType;
  institution_name: string;
}

interface AuthState {
  user: AuthUser | null;
  status: "idle" | "pending";
  error: string | null;
  hydrated: boolean;
}

let state: AuthState = { user: null, status: "idle", error: null, hydrated: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  if (typeof window !== "undefined" && patch.user !== undefined) {
    if (patch.user === null) {
      window.localStorage.removeItem("clearbill.auth.user");
    } else {
      window.localStorage.setItem("clearbill.auth.user", JSON.stringify(patch.user));
    }
  }
  emit();
}

export function hydrateAuth() {
  if (typeof window === "undefined" || state.hydrated) return;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      authStore.fetchProfile(session.user.id, session.user.email!).then((u) => {
        setState({ user: u, hydrated: true });
      }).catch(() => {
        setState({ hydrated: true });
      });
    } else {
      setState({ hydrated: true });
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      authStore.logout({ redirect: true, callSupabase: false });
    } else if (event === "SIGNED_IN" && session?.user && !state.user) {
       authStore.fetchProfile(session.user.id, session.user.email!).then((u) => {
        setState({ user: u });
      }).catch(console.error);
    }
  });
}

const slug = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "node";

export const workspaceRoute = (t: WorkspaceType) =>
  t === "gym" ? "/app/gym/overview" : "/app/school/overview";

export const authStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => state,

  async fetchProfile(userId: string, email: string): Promise<AuthUser> {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*, workspaces(*)")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      throw new Error("Profile not found. " + error?.message);
    }

    const ws = profile.workspaces;
    
    // Fetch the primary node for this workspace if one isn't explicitly assigned
    let actualNodeId = profile.assigned_node_id;
    if (!actualNodeId) {
      const { data: nodes } = await supabase
        .from("branch_nodes")
        .select("id")
        .eq("workspace_id", ws.id)
        .limit(1);
      
      if (nodes && nodes.length > 0) {
        actualNodeId = nodes[0].id;
      } else {
        console.warn("No branch nodes found for workspace", ws.id, "- auto-healing...");
        // Auto-heal: Create a default branch node if they somehow skipped it during registration
        const { data: newBranch } = await supabase
          .from("branch_nodes")
          .insert({
            workspace_id: ws.id,
            name: "Main Campus",
            code: "MAIN-" + Math.floor(Math.random() * 10000)
          })
          .select()
          .single();
          
        if (newBranch) {
          actualNodeId = newBranch.id;
        } else {
          // Absolute fallback so it doesn't crash Postgres with a null UUID
          actualNodeId = "00000000-0000-0000-0000-000000000000";
        }
      }
    }

    return {
      id: userId,
      name: profile.full_name,
      email: email,
      workspace_type: ws.workspace_type as WorkspaceType,
      workspace_id: ws.id,
      node_id: actualNodeId,
      institution_name: ws.name,
    };
  },

  async login(email: string, password: string): Promise<AuthUser> {
    setState({ status: "pending", error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      const user = await this.fetchProfile(data.user.id, data.user.email!);
      setState({ user, status: "idle", error: null, hydrated: true });
      return user;
    } catch (err: any) {
      setState({ status: "idle", error: err.message || "Login failed" });
      throw err;
    }
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    setState({ status: "pending", error: null });
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign up failed");

      const userId = authData.user.id;

      // Create Workspace
      const { data: wsData, error: wsError } = await supabase
        .from("workspaces")
        .insert({
          name: payload.institution_name,
          workspace_type: payload.workspace_type,
          primary_email: payload.email,
          primary_phone: "-"
        })
        .select()
        .single();
      
      if (wsError) throw wsError;

      // Create Profile
      const { data: profileData, error: profError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          workspace_id: wsData.id,
          full_name: payload.name,
          role: "owner"
        })
        .select()
        .single();

      if (profError) throw profError;

      // Optionally create a default branch node if needed for node_id
      const { data: branchData, error: branchError } = await supabase
        .from("branch_nodes")
        .insert({
          workspace_id: wsData.id,
          name: "Main Campus",
          code: "MAIN"
        })
        .select()
        .single();

      const user: AuthUser = {
        id: userId,
        name: payload.name,
        email: payload.email,
        workspace_type: payload.workspace_type,
        workspace_id: wsData.id,
        node_id: branchData ? branchData.id : "default_node",
        institution_name: payload.institution_name,
      };

      setState({ user, status: "idle", error: null, hydrated: true });
      return user;
    } catch (err: any) {
      setState({ status: "idle", error: err.message || "Registration failed" });
      throw err;
    }
  },

  async logout({ redirect = true, callSupabase = true }: { redirect?: boolean, callSupabase?: boolean } = {}) {
    purgeAllData();
    if (callSupabase) {
      await supabase.auth.signOut();
    }
    setState({ user: null, status: "idle", error: null, hydrated: true });
    if (redirect && typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.assign("/");
    }
  },

  clearError() {
    if (state.error) setState({ error: null });
  },
};

export function useAuth() {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot,
  );
}
