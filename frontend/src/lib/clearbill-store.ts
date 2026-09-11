import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { claimIdempotencyKey } from "./idempotency";
import { addGymMemberSchema, firstIssue } from "./validation";
import { supabase } from "./supabase";
import { authStore } from "./auth-store";
import { dispatchOnboardWelcome, dispatchReminderWhatsApp } from "../services/whatsapp-onboarding";
import type { CalendarDate } from "./calendar-date";
import {
  addCalendarDays,
  calendarToday,
  parseCalendarDate,
  toCalendarDate,
  toUtcTimestamp,
} from "./calendar-date";

export type Package = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  is_archived: boolean;
  fee: number;
  days: number;
};

export type GymPackage = Package;
export type TransactionStatus = "staged" | "processing" | "settled" | "rejected";
export type PaymentMethod = "safepay" | "kuickpay" | "raast" | "cash";

export type SubscriptionLedger = {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  invoiced_amount: number;
  liquidated_amount: number;
  billing_period_start: CalendarDate;
  billing_period_end: CalendarDate;
  status: TransactionStatus;
  readonly idempotency_key: string;
  version_lock: number;
  payment_method: PaymentMethod;
};

export type Subscription_Ledger = SubscriptionLedger;

export type Member = {
  id: string;
  node_id: string;
  full_name: string;
  phone_number: string;
  package_id: string;
  activation_date: CalendarDate;
  suspension_days_accrued: number;
  lifecycle_status: "active" | "inactive";
  subscription_history: SubscriptionLedger[];
};

export type GymUser = Member;

export type TaskQueueConfig = {
  enabled: boolean;
  cadence_type: "once" | "smart" | "aggressive" | "custom";
  execution_triggers: number[];
  custom_triggers: number[];
  dispatch_suspension_window: { start: string; end: string; enabled: boolean };
  template_id: string;
};

export type Task_Queue_Config = TaskQueueConfig;

export type IntegrationsConfig = {
  whatsapp: {
    encrypted_whatsapp_token: string;
    phone_number_id: string;
    template_id: string;
    silent_autobilling_enabled: boolean;
    enable_ai_messaging: boolean;
    ai_tone: "polite_urdu" | "firm_urdu" | "formal_english" | "custom";
  };
  safepay: {
    environment: "sandbox" | "production";
    public_key: string;
    encrypted_safepay_secret: string;
    encrypted_safepay_webhook_secret: string;
    is_active: boolean;
  };
  kuickpay: {
    institution_id: string;
    encrypted_kuickpay_secret: string;
    is_active: boolean;
  };
  raast: {
    merchant_id: string;
    is_active: boolean;
  };
};

export type MemberStatus = "PAID" | "UNPAID" | "INACTIVE";

export type GymMember = {
  id: string;
  name: string;
  phone: string;
  packageId: string;
  packageName: string;
  fee: number;
  expiry: string;
  status: MemberStatus;
  lifetimeValue: number;
  suspensionDays: number;
};

export type Student = {
  id: string;
  name: string;
  parentPhone: string;
  grade: string;
  rollNo: string;
  fee: number;
  status: "PAID" | "UNPAID";
};

export type ActivityEvent = {
  id: string;
  memberId?: string;
  at: string;
  kind: "payment" | "whatsapp" | "system" | "status" | "member_added" | "member_deactivated";
  message: string;
};

export type DashboardMetrics = {
  totalCollected: number;
  totalUnpaidValue: number;
  unpaidCount: number;
  paidCount: number;
  activeCount: number;
  unpaidRatio: number;
};

type State = {
  current_node_id: string;
  gymPackages: Package[];
  gymUsers: Member[];
  taskQueueConfig: TaskQueueConfig;
  integrations: IntegrationsConfig;
  daily_collections_chart: number[];
  students: Student[];
  activity: ActivityEvent[];
  telemetry_kpis: GymTelemetryKpis;
  isHydrated: boolean;
};

export type GymTelemetryKpis = {
  mrr: number;
  collected: number;
  outstanding: number;
  active_members: number;
  expiring_soon: number;
  churn_rate: number;
  synced_at: string | null;
  is_syncing: boolean;
  isLoadingTelemetry: boolean;
};

export const EMPTY_GYM_TELEMETRY: GymTelemetryKpis = {
  mrr: 0,
  collected: 0,
  outstanding: 0,
  active_members: 0,
  expiring_soon: 0,
  churn_rate: 0,
  synced_at: null,
  is_syncing: false,
  isLoadingTelemetry: true,
};

type StoreView = State & { gymMembers: GymMember[]; activity_logs: ActivityEvent[] };

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
export { addDays };

const now = Math.floor(Date.now() / 86_400_000) * 86_400_000;
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

export function getPackage(s: Pick<State, "gymPackages">, package_id: string) {
  return s.gymPackages.find((p) => p.id === package_id);
}

export function getExpirationDate(user: Member, pkg?: Package): Date {
  const base = new Date(parseCalendarDate(user.activation_date));
  const total = (pkg?.duration_days ?? 0) + (user.suspension_days_accrued ?? 0);
  return addDays(base, total);
}

export function isExpired(user: Member, pkg?: Package): boolean {
  return getExpirationDate(user, pkg).getTime() < Date.now();
}

export function getMemberLTV(user: Member): number {
  return Math.round(
    (user.subscription_history ?? [])
      .filter((l) => l.status === "settled")
      .reduce((sum, l) => sum + l.liquidated_amount, 0),
  );
}

export function getMemberArrears(user: Member): number {
  return Math.round(
    (user.subscription_history ?? []).reduce(
      (sum, l) => sum + ((l.invoiced_amount ?? 0) - (l.liquidated_amount ?? 0)),
      0,
    ),
  );
}

export const getLifetimeValue = getMemberLTV;

export function getCurrentCycleEntry(user: Member): SubscriptionLedger | undefined {
  return [...(user.subscription_history ?? [])].sort(
    (a, b) =>
      new Date(b.billing_period_start).getTime() - new Date(a.billing_period_start).getTime(),
  )[0];
}

export function getMemberStatus(user: Member, pkg?: Package): MemberStatus {
  if (user.lifecycle_status === "inactive" || isExpired(user, pkg)) return "INACTIVE";
  return getCurrentCycleEntry(user)?.status === "settled" ? "PAID" : "UNPAID";
}

function toMember(user: Member, s: State): GymMember {
  const pkg = getPackage(s, user.package_id);
  return {
    id: user.id,
    name: user.full_name,
    phone: user.phone_number,
    packageId: user.package_id,
    packageName: pkg?.name ?? "—",
    fee: pkg?.price ?? 0,
    expiry: toCalendarDate(getExpirationDate(user, pkg)),
    status: getMemberStatus(user, pkg),
    lifetimeValue: getMemberLTV(user),
    suspensionDays: user.suspension_days_accrued ?? 0,
  };
}

export function getDashboardMetrics(s: State = state): DashboardMetrics {
  const rows = s.gymUsers.map((u) => toMember(u, s));
  const totalCollected = s.gymUsers.reduce((sum, u) => sum + getMemberLTV(u), 0);
  const unpaid = rows.filter((m) => m.status === "UNPAID");
  const paid = rows.filter((m) => m.status === "PAID");
  const active = rows.filter((m) => m.status !== "INACTIVE");
  return {
    totalCollected: Math.round(totalCollected),
    totalUnpaidValue: Math.round(unpaid.reduce((sum, m) => sum + m.fee, 0)),
    unpaidCount: unpaid.length,
    paidCount: paid.length,
    activeCount: active.length,
    unpaidRatio: active.length > 0 ? unpaid.length / active.length : 0,
  };
}

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

const initial: State = {
  current_node_id: "default_node",
  gymPackages: [],
  gymUsers: [],
  taskQueueConfig: {
    enabled: true,
    cadence_type: "smart",
    execution_triggers: [-3, 0, 3],
    custom_triggers: [-3, 0, 3],
    dispatch_suspension_window: { start: "21:00", end: "08:00", enabled: true },
    template_id: "fee_reminder_urdu_v3",
  },
  integrations: {
    whatsapp: {
      encrypted_whatsapp_token: "",
      phone_number_id: "",
      template_id: "fee_reminder_urdu_v3",
      silent_autobilling_enabled: true,
      enable_ai_messaging: false,
      ai_tone: "polite_urdu",
    },
    safepay: {
      environment: "sandbox",
      public_key: "",
      encrypted_safepay_secret: "",
      encrypted_safepay_webhook_secret: "",
      is_active: false,
    },
    kuickpay: { institution_id: "", encrypted_kuickpay_secret: "", is_active: false },
    raast: { merchant_id: "", is_active: false },
  },
  daily_collections_chart: [],
  students: [],
  telemetry_kpis: EMPTY_GYM_TELEMETRY,
  activity: [],
  isHydrated: false,
};

let state: State = initial;
const listeners = new Set<() => void>();
let viewCache: StoreView | null = null;

function view(s: State): StoreView {
  if (viewCache && viewCache.gymUsers === s.gymUsers && viewCache.gymPackages === s.gymPackages) {
    if (
      viewCache.activity === s.activity &&
      viewCache.students === s.students &&
      viewCache.integrations === s.integrations &&
      viewCache.telemetry_kpis === s.telemetry_kpis &&
      viewCache.taskQueueConfig === s.taskQueueConfig
    )
      return viewCache;
    viewCache = { ...s, gymMembers: viewCache.gymMembers, activity_logs: s.activity };
    return viewCache;
  }
  viewCache = { ...s, gymMembers: s.gymUsers.map((u) => toMember(u, s)), activity_logs: s.activity };
  return viewCache;
}

function emit() {
  listeners.forEach((l) => l());
}

function pushActivity(ev: Omit<ActivityEvent, "id" | "at">) {
  state = {
    ...state,
    activity: [
      { ...ev, id: uuid(), at: toUtcTimestamp() },
      ...state.activity,
    ].slice(0, 40),
  };
}

// Deep clone helper
const snapshotState = (s: State): State => JSON.parse(JSON.stringify(s));

export const store = {
  get: () => view(state),
  reset: () => {
    state = { ...initial };
    viewCache = null;
    emit();
  },
  raw: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  metrics: () => getDashboardMetrics(state),

  hydrateFromServer: async () => {
    if (state.isHydrated) return;
    const user = authStore.getSnapshot().user;
    if (!user || user.workspace_type !== "gym") return;

    try {
      const [packagesRes, membersRes, ledgersRes] = await Promise.all([
        supabase.from("packages").select("*").eq("workspace_id", user.workspace_id),
        supabase.from("members").select("*").eq("workspace_id", user.workspace_id),
        supabase.from("subscription_ledger").select("*").eq("workspace_id", user.workspace_id),
      ]);

      const packages = (packagesRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration_days: p.duration_days,
        is_archived: p.is_archived,
        fee: p.price,
        days: p.duration_days
      }));

      const ledgersByMember = (ledgersRes.data || []).reduce((acc: any, l: any) => {
        if (!acc[l.member_id]) acc[l.member_id] = [];
        const pkg = packages.find(p => p.id === l.package_id);
        acc[l.member_id].push({
          id: l.id,
          user_id: l.member_id,
          package_id: l.package_id,
          package_name: pkg ? pkg.name : "Unknown",
          invoiced_amount: l.invoiced_amount,
          liquidated_amount: l.liquidated_amount,
          billing_period_start: l.billing_period_start,
          billing_period_end: l.billing_period_end,
          status: l.status,
          idempotency_key: l.idempotency_key,
          version_lock: l.version_lock,
          payment_method: l.payment_method
        });
        return acc;
      }, {});

      const gymUsers = (membersRes.data || []).map(m => ({
        id: m.id,
        node_id: m.node_id,
        full_name: m.full_name,
        phone_number: m.phone_number,
        package_id: m.package_id,
        activation_date: m.activation_date,
        suspension_days_accrued: m.suspension_days_accrued,
        lifecycle_status: m.lifecycle_status,
        subscription_history: ledgersByMember[m.id] || []
      }));

      state = {
        ...state,
        current_node_id: user.node_id,
        gymPackages: packages,
        gymUsers,
        isHydrated: true,
      };
      
      // Auto-fetch telemetry after hydration
      store.fetchGlobalTelemetry();
      emit();
    } catch (err) {
      console.error("Hydration failed", err);
    }
  },

  addGymPackage: async (p: { name: string; fee: number; days: number }) => {
    const user = authStore.getSnapshot().user;
    if (!user) return;
    const newId = uuid();
    const pkg = { id: newId, name: p.name, price: Math.round(p.fee), duration_days: p.days, is_archived: false, fee: Math.round(p.fee), days: p.days };
    
    // Optimistic UI
    const snapshot = snapshotState(state);
    state = { ...state, gymPackages: [...state.gymPackages, pkg] };
    emit();

    const { error } = await supabase.from("packages").insert({
      id: newId,
      workspace_id: user.workspace_id,
      node_id: user.node_id,
      name: p.name,
      price: Math.round(p.fee),
      duration_days: p.days
    });

    if (error) {
      state = snapshot;
      emit();
      toast.error("Failed to save package");
    }
  },

  archiveGymPackage: async (id: string) => {
    const snapshot = snapshotState(state);
    state = {
      ...state,
      gymPackages: state.gymPackages.map((p) => (p.id === id ? { ...p, is_archived: true } : p)),
    };
    emit();
    const { error } = await supabase.from("packages").update({ is_archived: true }).eq("id", id);
    if (error) { state = snapshot; emit(); toast.error("Update failed"); }
  },

  restoreGymPackage: async (id: string) => {
    const snapshot = snapshotState(state);
    state = {
      ...state,
      gymPackages: state.gymPackages.map((p) => (p.id === id ? { ...p, is_archived: false } : p)),
    };
    emit();
    const { error } = await supabase.from("packages").update({ is_archived: false }).eq("id", id);
    if (error) { state = snapshot; emit(); toast.error("Update failed"); }
  },

  addGymMember: async (m: { name: string; phone: string; packageId: string; packageName: string; fee: number; expiry: string; }) => {
    const parsed = addGymMemberSchema.safeParse({ name: m.name, phone: m.phone, packageId: m.packageId, fee: m.fee, expiry: m.expiry });
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error));
      return { ok: false as const, error: firstIssue(parsed.error) };
    }
    const authUser = authStore.getSnapshot().user;
    if (!authUser) return { ok: false as const, error: "Not logged in" };

    const id = uuid();
    const p = getPackage(state, m.packageId);
    const duration = p?.duration_days ?? 30;
    const activation = toCalendarDate(addDays(new Date(parseCalendarDate(m.expiry)), -duration));
    const ledgerId = uuid();
    const roundedFee = Math.round(p?.price ?? m.fee);

    const user: Member = {
      id,
      node_id: state.current_node_id,
      full_name: m.name,
      phone_number: m.phone,
      package_id: m.packageId,
      activation_date: activation,
      suspension_days_accrued: 0,
      lifecycle_status: "active",
      subscription_history: [
        {
          id: ledgerId,
          user_id: id,
          package_id: m.packageId,
          package_name: p?.name ?? m.packageName,
          invoiced_amount: roundedFee,
          liquidated_amount: roundedFee,
          billing_period_start: activation,
          billing_period_end: toCalendarDate(m.expiry),
          status: "staged",
          idempotency_key: ledgerId, // use uuid as key for simplicity here
          version_lock: 1,
          payment_method: "cash",
        },
      ],
    };

    const snapshot = snapshotState(state);
    state = { ...state, gymUsers: [...state.gymUsers, user] };
    pushActivity({ memberId: id, kind: "member_added", message: `New member enrolled: ${m.name} on ${m.packageName}` });
    emit();

    const { error: memberError } = await supabase.from("members").insert({
      id,
      workspace_id: authUser.workspace_id,
      node_id: authUser.node_id,
      full_name: m.name,
      phone_number: m.phone,
      package_id: m.packageId,
      activation_date: activation,
      lifecycle_status: "active"
    });

    if (memberError) {
      state = snapshot; emit(); toast.error("Failed to add member"); return { ok: false as const, error: "Network Error" };
    }

    const { error: ledgerError } = await supabase.from("subscription_ledger").insert({
      id: ledgerId,
      workspace_id: authUser.workspace_id,
      member_id: id,
      package_id: m.packageId,
      billing_period_start: activation,
      billing_period_end: toCalendarDate(m.expiry),
      invoiced_amount: roundedFee,
      liquidated_amount: roundedFee,
      status: "staged",
      payment_method: "cash",
      idempotency_key: ledgerId
    });

    if (ledgerError) {
      toast.error("Ledger creation failed, member was added though.");
    }
    
    // Fire and forget the automated WhatsApp onboarding
    dispatchOnboardWelcome({
      memberName: m.name,
      phone: m.phone,
      institutionName: authUser?.institution_name || "Iron Gym",
      packageName: p?.name || "Monthly Standard",
      durationDays: p?.duration_days || 30,
      feeAmount: p?.price || m.fee || 5000,
    }).then((res) => {
      if (res?.success) {
        toast.success("Welcome WhatsApp dispatched!");
      } else {
        toast.warning("Member added, but WhatsApp welcome failed.");
      }
    });
    
    return { ok: true as const, id };
  },

  fetchGlobalTelemetry: async (): Promise<GymTelemetryKpis> => {
    state = { ...state, telemetry_kpis: { ...state.telemetry_kpis, is_syncing: true } };
    emit();
    // Simulate server side SQL aggregate (In Phase 3 this becomes an RPC or true view)
    const kpis = aggregateGymRows(state);
    state = { ...state, telemetry_kpis: { ...kpis, synced_at: toUtcTimestamp(), is_syncing: false, isLoadingTelemetry: false } };
    emit();
    return state.telemetry_kpis;
  },

  verifyMemberFreshness: async (member_id: string): Promise<boolean> => {
    // In Phase 2, we actually query Supabase to ensure the row hasn't been changed by a webhook
    const u = state.gymUsers.find((x) => x.id === member_id);
    if (!u) return false;
    const current = getCurrentCycleEntry(u);
    if (!current) return true;

    const { data, error } = await supabase
      .from("subscription_ledger")
      .select("status, liquidated_amount, invoiced_amount")
      .eq("id", current.id)
      .single();
    
    if (error || !data) return true; // If error, just allow optimistic
    return data.status !== "settled" || data.liquidated_amount < data.invoiced_amount;
  },

  markMemberPaid: async (id: string, method: PaymentMethod = "cash", action_idempotency_key?: string): Promise<boolean> => {
    const u = state.gymUsers.find((x) => x.id === id);
    if (!u) return false;
    if (action_idempotency_key && !claimIdempotencyKey(action_idempotency_key)) return false;

    const fresh = await store.verifyMemberFreshness(id);
    if (!fresh) {
      toast.error("CYCLE ALREADY SETTLED", { description: "A gateway webhook cleared this member. Row refreshed." });
      return false;
    }

    const snapshot = snapshotState(state);
    const p = getPackage(state, u.package_id);
    const amount = Math.round(p?.price ?? 0);
    const current = getCurrentCycleEntry(u);
    const start = calendarToday();
    
    let isUpdate = false;
    let targetLedgerId = current?.id;
    let nextVersion = (current?.version_lock ?? 0) + 1;

    const newLedgerId = uuid();
    const newIdempotency = uuid();

    const history = (current && current.status !== "settled")
        ? u.subscription_history.map((l) => {
            if (l.id === current.id) {
              isUpdate = true;
              return { ...l, status: "settled" as TransactionStatus, liquidated_amount: amount, payment_method: method, version_lock: nextVersion };
            }
            return l;
          })
        : [
            ...u.subscription_history,
            {
              id: newLedgerId, user_id: u.id, package_id: u.package_id, package_name: p?.name ?? "—",
              invoiced_amount: amount, liquidated_amount: amount, billing_period_start: start,
              billing_period_end: addCalendarDays(start, p?.duration_days ?? 30), status: "settled" as TransactionStatus,
              idempotency_key: newIdempotency, version_lock: 1, payment_method: method,
            },
          ];

    state = { ...state, gymUsers: state.gymUsers.map((x) => (x.id === id ? { ...x, subscription_history: history } : x)) };
    pushActivity({ memberId: id, kind: "payment", message: `${u.full_name} marked paid (${method}) — Rs. ${amount.toLocaleString("en-PK")}` });
    emit();

    const authUser = authStore.getSnapshot().user;
    if (!authUser) return false;

    if (isUpdate && targetLedgerId) {
      const { error } = await supabase.from("subscription_ledger").update({
        status: "settled",
        liquidated_amount: amount,
        payment_method: method,
        version_lock: nextVersion
      }).eq("id", targetLedgerId).eq("version_lock", current!.version_lock); // Optimistic Concurrency check
      
      if (error) {
        state = snapshot; emit();
        toast.error("NETWORK DESYNC: Settlement Failed");
        return false;
      }
    } else {
      const { error } = await supabase.from("subscription_ledger").insert({
        id: newLedgerId,
        workspace_id: authUser.workspace_id,
        member_id: u.id,
        package_id: u.package_id,
        billing_period_start: start,
        billing_period_end: addCalendarDays(start, p?.duration_days ?? 30),
        invoiced_amount: amount,
        liquidated_amount: amount,
        status: "settled",
        payment_method: method,
        idempotency_key: newIdempotency
      });
      if (error) {
        state = snapshot; emit();
        toast.error("NETWORK DESYNC: Settlement Failed");
        return false;
      }
    }
    return true;
  },

  deactivateMember: async (id: string) => {
    const snapshot = snapshotState(state);
    const u = state.gymUsers.find((x) => x.id === id);
    if (!u) return;
    state = { ...state, gymUsers: state.gymUsers.map((x) => x.id === id ? { ...x, lifecycle_status: "inactive" as const } : x) };
    pushActivity({ memberId: id, kind: "member_deactivated", message: `${u.full_name}'s package expired. Moved to inactive.` });
    emit();
    const { error } = await supabase.from("members").update({ lifecycle_status: "inactive" }).eq("id", id);
    if (error) { state = snapshot; emit(); toast.error("Failed to deactivate"); }
  },

  reactivateMember: async (id: string) => {
    const snapshot = snapshotState(state);
    state = { ...state, gymUsers: state.gymUsers.map((x) => x.id === id ? { ...x, lifecycle_status: "active" as const } : x) };
    emit();
    const { error } = await supabase.from("members").update({ lifecycle_status: "active" }).eq("id", id);
    if (error) { state = snapshot; emit(); toast.error("Failed to reactivate"); }
  },

  accrueSuspension: async (id: string, days: number) => {
    const snapshot = snapshotState(state);
    const u = state.gymUsers.find((x) => x.id === id);
    if (!u) return;
    const newSuspension = (u.suspension_days_accrued ?? 0) + days;
    state = { ...state, gymUsers: state.gymUsers.map((x) => x.id === id ? { ...x, suspension_days_accrued: newSuspension } : x) };
    pushActivity({ memberId: id, kind: "status", message: `${u.full_name}'s membership paused for ${days} days` });
    emit();
    const { error } = await supabase.from("members").update({ suspension_days_accrued: newSuspension }).eq("id", id);
    if (error) { state = snapshot; emit(); toast.error("Failed to suspend"); }
  },

  updateTaskQueueConfig: (patch: Partial<TaskQueueConfig>) => {
    state = { ...state, taskQueueConfig: { ...state.taskQueueConfig, ...patch } };
    emit();
  },

  updateIntegrations: <K extends keyof IntegrationsConfig>(key: K, patch: Partial<IntegrationsConfig[K]>) => {
    state = { ...state, integrations: { ...state.integrations, [key]: { ...state.integrations[key], ...patch } } };
    emit();
  },

  triggerReminder: (id: string) => {
    const u = state.gymUsers.find((x) => x.id === id);
    if (!u) return;
    pushActivity({ memberId: id, kind: "whatsapp", message: `Auto-reminder queued to Meta API for ${u.full_name}` });
    emit();

    const p = getPackage(state, u.package_id);
    const amount = Math.round(p?.price ?? 0);
    const current = getCurrentCycleEntry(u);
    const expiry = current?.billing_period_end ?? "Unknown";

    dispatchReminderWhatsApp({
      memberName: u.full_name,
      phone: u.phone_number,
      institutionName: authStore.getSnapshot().user?.institution_name || "ClearBill Workspace",
      packageName: p?.name ?? "Membership",
      durationDays: p?.duration_days ?? 30,
      startDate: current?.billing_period_start ?? "Unknown",
      expiryDate: expiry,
      feeAmount: amount
    }).then((delivered) => {
      if (delivered) {
        toast.success("WhatsApp Reminder Sent!");
      } else {
        toast.warning("Failed to send WhatsApp reminder.");
      }
    });
  },

  dispatchBulkReminders: (): number => {
    const targets = state.gymUsers.filter((u) => getMemberStatus(u, getPackage(state, u.package_id)) === "UNPAID");
    targets.forEach((u) => pushActivity({ memberId: u.id, kind: "whatsapp", message: `Bulk reminder queued to Meta API for ${u.full_name}` }));
    if (targets.length > 0) pushActivity({ kind: "system", message: `Bulk dispatch executed — ${targets.length} reminder payloads staged` });
    emit();
    return targets.length;
  },

  addStudent: (s: Omit<Student, "id" | "status">) => {
    state = { ...state, students: [...state.students, { ...s, id: uuid(), status: "UNPAID" }] };
    emit();
  },
};

export function useStore<T>(selector: (s: StoreView) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(view(state)), () => selector(view(initial)));
}

function aggregateGymRows(s: State): Omit<GymTelemetryKpis, "synced_at" | "is_syncing" | "isLoadingTelemetry"> {
  let collected = 0; let invoiced = 0; let mrr = 0; let active = 0; let expiring = 0; let inactive = 0;
  const soon = addCalendarDays(calendarToday(), 7);
  for (const u of s.gymUsers) {
    if (u.lifecycle_status === "inactive") inactive += 1;
    else active += 1;
    const p = getPackage(s, u.package_id);
    if (p && u.lifecycle_status === "active") {
      mrr += Math.round((p.price / Math.max(1, p.duration_days)) * 30);
    }
    const current = getCurrentCycleEntry(u);
    if (current && parseCalendarDate(current.billing_period_end) <= parseCalendarDate(soon)) {
      expiring += 1;
    }
    for (const l of u.subscription_history) {
      invoiced += l.invoiced_amount;
      collected += l.liquidated_amount;
    }
  }
  const total = active + inactive;
  return {
    mrr: Math.round(mrr), collected: Math.round(collected), outstanding: Math.max(0, Math.round(invoiced - collected)),
    active_members: active, expiring_soon: expiring, churn_rate: total ? Math.round((inactive / total) * 1000) / 10 : 0,
  };
}
