import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { authStore } from "./auth-store";

import type { CalendarDate } from "./calendar-date";
import {
  calendarToday,
  toUtcTimestamp,
  daysOverdue,
  parseCalendarDate,
  toCalendarDate,
  toLocalCalendarDate,

} from "./calendar-date";
import { claimIdempotencyKey, resetIdempotencyLedger } from "./idempotency";
import { NetworkDesyncError, simulateApiCall, simulateApiRead, snapshotState } from "./network";
import {
  addStudentSchema,
  cashSettlementSchema,
  customChallanSchema,
  firstIssue,
} from "./validation";

/**
 * Relational, multi-tenant school ledger models.
 * `node_id` is the tenant key (campus). `parent_phone` (923XXXXXXXXX) is the
 * sibling grouping key. Legacy display fields are kept as aliases so the
 * existing UI surface stays intact.
 */
export type SchoolBranch = {
  node_id: string;
  name: string;
};

export type SchoolLedger = {
  id: string;
  invoiced_amount: number; // base fee + late penalties
  liquidated_amount: number; // amount actually settled (Udhaar support)
  billing_month: string; // "July 2026"
  due_date: CalendarDate; // strict "YYYY-MM-DD", UTC-anchored
  status: "staged" | "processing" | "settled" | "rejected" | "refunded";
  /** Immutable after staging — the gateway de-duplication hash. */
  readonly idempotency_key: string;
  /** Optimistic concurrency token; incremented on every mutation. */
  version_lock: number;
  payment_method: "safepay" | "kuickpay" | "raast" | "cash";
};

/**
 * Ad-hoc billing document — fully decoupled from the recurring tuition ledger.
 * Own gateway identifiers, own checkout link, own WhatsApp dispatch lifecycle.
 */
export interface CustomChallan {
  id: string;
  student_id: string;
  parent_phone: string;
  title: string; // e.g., "Property Damage Fine", "Field Trip Fee"
  amount: number;
  issue_date: CalendarDate; // strict "YYYY-MM-DD", UTC-anchored
  due_date: CalendarDate; // strict "YYYY-MM-DD", UTC-anchored
  status: "staged" | "processing" | "settled" | "cancelled";
  readonly idempotency_key: string; // immutable after staging
  version_lock: number; // optimistic concurrency token
  kuickpay_consumer_id: string; // distinct from tuition consumer ID
  safepay_checkout_url: string;
  whatsapp_dispatch_status: "queued" | "sent" | "delivered";
}


/* ------------------------------------------------------------------ *
 * Academic Taxonomy Engine — branch-scoped levels + level-scoped sections
 * ------------------------------------------------------------------ */

export interface AcademicLevel {
  id: string;
  branch_node_id: string; // Ties the level to a specific branch
  name: string; // e.g., "Class 8", "O-Levels"
  order_index: number; // For sorting UI dropdowns logically
}

export interface AcademicSection {
  id: string;
  level_id: string; // Ties the section to a specific level
  name: string; // e.g., "A", "Blue", "Boys"
}


export type Branch = {
  id: string;
  node_id: string;
  name: string;
  address: string;
  adminPhone: string;
};

export type CustomFee = {
  id: string;
  label: string; // e.g. "Swimming Club", "Fine"
  amount: number;
};

export type FeeStructure = {
  id: string;
  level_id: string; // relational key → AcademicLevel
  className: string; // denormalized level name for display

  tuition: number;
  admission: number;
  exam: number;
  lab: number;
  transport: number;
  lateFee: number;
  lateAfterDay: number;
  extras?: CustomFee[];
};

export type StudentStatus = "PAID" | "UNPAID" | "PARTIAL" | "PENDING";

export type LifecycleStatus = "enrolled" | "suspended" | "graduated";

/** Display/legacy fields authored in seed data. */
export type StudentSeed = {
  id: string;
  name: string;
  rollNo: string;
  branchId: string;
  className: string; // Class 1..10 or Pre-Nursery/Nursery
  section: string; // A | B | C
  parentName: string;
  parentPhone: string;
  monthlyFee: number;
  customFee: boolean;
  admissionDate: string;
  arrears: number;
  status: StudentStatus;
};

/** Relational student record: seed fields + tenant keys + double-entry ledger. */
export type SchoolStudent = StudentSeed & {
  node_id: string; // === branchId
  full_name: string; // === name
  roll_no: string; // === rollNo
  level_id: string; // relational key → AcademicLevel
  section_id: string; // relational key → AcademicSection
  parent_phone: string; // STRICT 923XXXXXXXXX — sibling grouping key
  fee_structure_id: string;
  lifecycle_status: LifecycleStatus;
  ledger_history: SchoolLedger[];
};

/** Automated billing ledger entry — settled by gateway webhooks, never by slips. */
export interface SchoolLedgerEntry {
  id: string;
  student_id: string;
  parent_phone: string; // 923XXXXXXXXX
  branch_node_id: string;
  billing_period: string; // e.g. "July 2026"
  invoiced_amount: number; // base tuition + late fees − sibling discounts
  liquidated_amount: number; // settled amount
  due_date: CalendarDate; // strict "YYYY-MM-DD", UTC-anchored
  status: "staged" | "processing" | "settled" | "failed";
  payment_method?: "kuickpay" | "safepay" | "raast" | "cash";
  readonly idempotency_key: string; // immutable hash for 1Link/KuickPay webhooks
  version_lock: number; // optimistic concurrency token, starts at 1
  kuickpay_consumer_id: string; // e.g. "88888-00000st1"
  safepay_checkout_url: string;
  whatsapp_dispatch_status: "queued" | "sent" | "delivered" | "failed";
  settled_at?: string; // ISO-8601 UTC ("…Z") — populated by webhook
}

/** Append-only automation feed rendered by the live operations tab. */
export type AutomationEvent = {
  id: string;
  at: string;
  channel: "outbound" | "inbound";
  label: string;
  detail: string;
  ref: string;
};


export type ConfirmedPayment = {
  id: string;
  studentId: string;
  studentName: string;
  branchId: string;
  amount: number;
  at: string;
  method: "KuickPay" | "Safepay" | "Cash";
};

export type ReminderSettings = {
  before3: boolean;
  onDue: boolean;
  after3: boolean;
  templateBefore: string;
  templateDue: string;
  templateAfter: string;
};

export type FeePolicies = {
  grace_period_days: number;
  late_fee_percentage: number;
  sibling_discount_percentage: number;
  discount_applies_to: "second_child_onwards" | "all_children";
};

export type Integrations = {
  whatsapp: {
    encrypted_whatsapp_token: string;
    phone_number_id: string;
    template_id: string;
    enable_ai_messaging: boolean;
    ai_tone: "polite_urdu" | "firm_urdu" | "formal_english";
  };
  safepay: {
    environment: "sandbox" | "production";
    public_key: string;
    encrypted_safepay_secret: string;
    encrypted_safepay_webhook_secret: string;
    is_active: boolean;
  };
  kuickpay: { institution_id: string; encrypted_kuickpay_secret: string; is_active: boolean };
  raast: { merchant_id: string; is_active: boolean };
};

export type TaskQueue = {
  execution_triggers: number[]; // hours of day (node timezone)
  dispatch_suspension_window: { start: string; end: string; enabled: boolean };
};

export type Settings = {
  institution: string;
  contact: string;
  kuickpayBillerId: string;
  safepayKey: string;
  defaultLatePct: number;
  defaultGraceDays: number;
  defaultSiblingPct: number;
  siblingDiscountOn: boolean;
  policies: FeePolicies;
  integrations: Integrations;
  task_queue: TaskQueue;
};

/**
 * Server-computed aggregate row.
 *
 * These numbers are NOT derived in the browser: with database pagination the
 * client only ever holds one page of ledgers, so any client-side Σ would be
 * wrong. The backend compiler must satisfy this shape with a single SQL
 * aggregate (SUM/FILTER) — `fetchGlobalTelemetry()` is the seam.
 */
export type VelocityPoint = { month: string; revenue: number };

export type TelemetryKpis = {
  gross_capital: number;
  liquidated: number;
  arrears: number;
  collection_velocity: number; // %
  /** Server-bucketed settlement series — the chart NEVER computes its own data. */
  collection_velocity_chart: VelocityPoint[];
  settled_count: number;
  open_count: number;
  synced_at: string | null;
  is_syncing: boolean;
  /** True until the first aggregate lands: UI must skeleton, never print "Rs. 0". */
  isLoadingTelemetry: boolean;
};

export const EMPTY_TELEMETRY: TelemetryKpis = {
  gross_capital: 0,
  liquidated: 0,
  arrears: 0,
  collection_velocity: 0,
  collection_velocity_chart: [],
  settled_count: 0,
  open_count: 0,
  synced_at: null,
  is_syncing: false,
  isLoadingTelemetry: true,
};


type State = {
  branches: Branch[];
  academic_levels: AcademicLevel[];
  academic_sections: AcademicSection[];
  feeStructures: FeeStructure[];
  students: SchoolStudent[];
  billing_ledger: SchoolLedgerEntry[];
  automation_feed: AutomationEvent[];
  custom_challans: CustomChallan[];

  history: ConfirmedPayment[];
  reminders: ReminderSettings;
  settings: Settings;
  /** Populated exclusively by `schoolStore.fetchGlobalTelemetry()`. */
  telemetry_kpis: TelemetryKpis;
  isHydrated: boolean;
};

const CLASSES = [
  "Pre-Nursery",
  "Nursery",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
];

const branches: Branch[] = [
  { id: "b1", node_id: "b1", name: "Johar Town Campus", address: "Block J3, Johar Town, Lahore", adminPhone: "+92 321 4000111" },
  { id: "b2", node_id: "b2", name: "DHA Campus", address: "Phase 5, DHA, Lahore", adminPhone: "+92 321 4000222" },
  { id: "b3", node_id: "b3", name: "Model Town Campus", address: "H-Block, Model Town, Lahore", adminPhone: "+92 321 4000333" },
];


/* --------- Academic taxonomy seed (per-branch levels + sections) --------- */

export const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const levelIdFor = (branchId: string, name: string) => `lv-${branchId}-${slugify(name)}`;
export const sectionIdFor = (levelId: string, name: string) => `sc-${levelId}-${slugify(name)}`;

const SEED_SECTIONS: Record<string, string[]> = {
  b1: ["A", "B", "C"],
  b2: ["A", "B"],
  b3: ["A", "B"],
};

const academic_levels: AcademicLevel[] = branches.flatMap((b) =>
  CLASSES.map((name, i) => ({
    id: levelIdFor(b.id, name),
    branch_node_id: b.node_id,
    name,
    order_index: i,
  })),
);

const academic_sections: AcademicSection[] = academic_levels.flatMap((lv) =>
  (SEED_SECTIONS[lv.branch_node_id] ?? ["A", "B"]).map((name) => ({
    id: sectionIdFor(lv.id, name),
    level_id: lv.id,
    name,
  })),
);

const feeStructures: FeeStructure[] = [
  { id: "f1", className: "Pre-Nursery", tuition: 7500, admission: 15000, exam: 1500, lab: 0, transport: 3500, lateFee: 500, lateAfterDay: 10 },
  { id: "f2", className: "Nursery", tuition: 8500, admission: 15000, exam: 1500, lab: 0, transport: 3500, lateFee: 500, lateAfterDay: 10 },
  { id: "f3", className: "Class 1", tuition: 9500, admission: 18000, exam: 2000, lab: 500, transport: 3500, lateFee: 500, lateAfterDay: 10 },
  { id: "f4", className: "Class 3", tuition: 10500, admission: 18000, exam: 2000, lab: 500, transport: 3500, lateFee: 500, lateAfterDay: 10 },
  { id: "f5", className: "Class 5", tuition: 11500, admission: 20000, exam: 2500, lab: 1000, transport: 4000, lateFee: 700, lateAfterDay: 10 },
  { id: "f6", className: "Class 7", tuition: 12500, admission: 22000, exam: 2500, lab: 1500, transport: 4000, lateFee: 700, lateAfterDay: 10 },
  { id: "f7", className: "Class 8", tuition: 13500, admission: 22000, exam: 2500, lab: 1500, transport: 4000, lateFee: 700, lateAfterDay: 10 },
  { id: "f8", className: "Class 9", tuition: 15000, admission: 25000, exam: 3000, lab: 2000, transport: 4500, lateFee: 1000, lateAfterDay: 10 },
  { id: "f9", className: "Class 10", tuition: 16500, admission: 25000, exam: 3000, lab: 2000, transport: 4500, lateFee: 1000, lateAfterDay: 10 },
].map((f) => ({ ...f, level_id: levelIdFor("b1", f.className) }));


const studentSeeds: StudentSeed[] = [
  // Johar Town
  { id: "st1", name: "Ali Khan", rollNo: "8A-14", branchId: "b1", className: "Class 8", section: "A", parentName: "Kamran Khan", parentPhone: "+92 321 8877665", monthlyFee: 13500, customFee: false, admissionDate: "2022-04-11", arrears: 0, status: "UNPAID" },
  { id: "st2", name: "Zara Khan", rollNo: "5B-09", branchId: "b1", className: "Class 5", section: "B", parentName: "Kamran Khan", parentPhone: "+92 321 8877665", monthlyFee: 10350, customFee: true, admissionDate: "2023-04-05", arrears: 0, status: "UNPAID" },
  { id: "st3", name: "Fatima Noor", rollNo: "5A-07", branchId: "b1", className: "Class 5", section: "A", parentName: "Adnan Noor", parentPhone: "+92 333 6655443", monthlyFee: 11500, customFee: false, admissionDate: "2023-04-02", arrears: 0, status: "PAID" },
  { id: "st4", name: "Hassan Iqbal", rollNo: "10A-22", branchId: "b1", className: "Class 10", section: "A", parentName: "Iqbal Rehman", parentPhone: "+92 300 1239876", monthlyFee: 16500, customFee: false, admissionDate: "2018-04-10", arrears: 0, status: "PAID" },
  { id: "st5", name: "Ayesha Siddiqui", rollNo: "3C-11", branchId: "b1", className: "Class 3", section: "C", parentName: "Junaid Siddiqui", parentPhone: "+92 345 9988776", monthlyFee: 10500, customFee: false, admissionDate: "2024-04-01", arrears: 10500, status: "UNPAID" },
  { id: "st6", name: "Bilal Ahmad", rollNo: "7A-05", branchId: "b1", className: "Class 7", section: "A", parentName: "Naeem Ahmad", parentPhone: "+92 302 4433221", monthlyFee: 12500, customFee: false, admissionDate: "2022-04-14", arrears: 0, status: "PENDING" },
  // DHA
  { id: "st7", name: "Sara Rehman", rollNo: "9B-18", branchId: "b2", className: "Class 9", section: "B", parentName: "Farrukh Rehman", parentPhone: "+92 321 7766554", monthlyFee: 15000, customFee: false, admissionDate: "2020-04-08", arrears: 0, status: "PAID" },
  { id: "st8", name: "Hamza Malik", rollNo: "8B-12", branchId: "b2", className: "Class 8", section: "B", parentName: "Tariq Malik", parentPhone: "+92 300 5544332", monthlyFee: 13500, customFee: false, admissionDate: "2021-04-04", arrears: 27000, status: "UNPAID" },
  { id: "st9", name: "Mahnoor Tariq", rollNo: "3A-03", branchId: "b2", className: "Class 3", section: "A", parentName: "Kashif Tariq", parentPhone: "+92 345 6677889", monthlyFee: 10500, customFee: false, admissionDate: "2024-04-11", arrears: 0, status: "PAID" },
  { id: "st10", name: "Ibrahim Yousuf", rollNo: "10B-01", branchId: "b2", className: "Class 10", section: "B", parentName: "Yousuf Ali", parentPhone: "+92 333 1122998", monthlyFee: 16500, customFee: false, admissionDate: "2018-04-11", arrears: 16500, status: "PARTIAL" },
  { id: "st11", name: "Aiman Yousuf", rollNo: "5A-15", branchId: "b2", className: "Class 5", section: "A", parentName: "Yousuf Ali", parentPhone: "+92 333 1122998", monthlyFee: 10350, customFee: true, admissionDate: "2023-04-11", arrears: 0, status: "PAID" },
  { id: "st12", name: "Umer Shahid", rollNo: "N-B-04", branchId: "b2", className: "Nursery", section: "B", parentName: "Shahid Abbas", parentPhone: "+92 302 7788110", monthlyFee: 8500, customFee: false, admissionDate: "2025-04-01", arrears: 0, status: "PAID" },
  // Model Town
  { id: "st13", name: "Zainab Malik", rollNo: "7B-08", branchId: "b3", className: "Class 7", section: "B", parentName: "Faisal Malik", parentPhone: "+92 321 9988001", monthlyFee: 12500, customFee: false, admissionDate: "2022-04-04", arrears: 25000, status: "UNPAID" },
  { id: "st14", name: "Rayan Farooq", rollNo: "1A-06", branchId: "b3", className: "Class 1", section: "A", parentName: "Farooq Anwar", parentPhone: "+92 333 8899220", monthlyFee: 9500, customFee: false, admissionDate: "2025-04-05", arrears: 9500, status: "UNPAID" },
  { id: "st15", name: "Anaya Farooq", rollNo: "PN-A-02", branchId: "b3", className: "Pre-Nursery", section: "A", parentName: "Farooq Anwar", parentPhone: "+92 333 8899220", monthlyFee: 6750, customFee: true, admissionDate: "2026-04-01", arrears: 0, status: "UNPAID" },
  { id: "st16", name: "Ahmed Junaid", rollNo: "9A-13", branchId: "b3", className: "Class 9", section: "A", parentName: "Junaid Zafar", parentPhone: "+92 300 4433110", monthlyFee: 15000, customFee: false, admissionDate: "2020-04-01", arrears: 0, status: "PAID" },
  { id: "st17", name: "Laiba Rizwan", rollNo: "4B-10", branchId: "b3", className: "Class 4", section: "B", parentName: "Rizwan Aslam", parentPhone: "+92 345 3322110", monthlyFee: 10500, customFee: false, admissionDate: "2024-04-01", arrears: 0, status: "PENDING" },
  { id: "st18", name: "Hoorain Saad", rollNo: "2A-05", branchId: "b3", className: "Class 2", section: "A", parentName: "Saad Nazir", parentPhone: "+92 321 2211099", monthlyFee: 9500, customFee: false, admissionDate: "2024-04-01", arrears: 0, status: "PAID" },
];

/* ------------------------------------------------------------------ *
 * Sanitization + deterministic ledger hydration
 * ------------------------------------------------------------------ */

/** Strips +, spaces, dashes and leading zeroes; forces 923XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return ("92" + d).slice(0, 12);
}

/** Stable "today" floored to UTC midnight — keeps SSR and client identical. */
const TODAY_MS = Math.floor(Date.now() / 86_400_000) * 86_400_000;
export const today = () => new Date(TODAY_MS);

const BILLING_MONTHS = ["May 2026", "June 2026", "July 2026"];
const dueDateFor = (idx: number) =>
  toCalendarDate(TODAY_MS - (BILLING_MONTHS.length - 1 - idx) * 30 * 86_400_000);

const METHODS: SchoolLedger["payment_method"][] = ["kuickpay", "safepay", "raast", "cash"];

/** Builds a deterministic double-entry ledger from the seed's status + arrears. */
function hydrate(seed: StudentSeed, i: number): SchoolStudent {
  const method = METHODS[i % METHODS.length]!;
  const ledger_history: SchoolLedger[] = BILLING_MONTHS.map((billing_month, m) => {
    const isCurrent = m === BILLING_MONTHS.length - 1;
    const invoiced = seed.monthlyFee;
    let liquidated = invoiced;
    let status: SchoolLedger["status"] = "settled";

    if (isCurrent) {
      if (seed.status === "PAID") { liquidated = invoiced; status = "settled"; }
      else if (seed.status === "PARTIAL") { liquidated = Math.round(invoiced / 2); status = "processing"; }
      else if (seed.status === "PENDING") { liquidated = 0; status = "processing"; }
      else { liquidated = 0; status = "staged"; }
    } else if (seed.arrears > 0 && m === BILLING_MONTHS.length - 2) {
      liquidated = Math.max(0, invoiced - seed.arrears);
      status = liquidated === 0 ? "staged" : "processing";
    }

    return {
      id: `${seed.id}-lg${m}`,
      invoiced_amount: invoiced,
      liquidated_amount: liquidated,
      billing_month,
      due_date: dueDateFor(m),
      status,
      idempotency_key: `${seed.id}:${billing_month.replace(/\s/g, "-").toLowerCase()}`,
      version_lock: 1,
      payment_method: method,
    };
  });

  return {
    ...seed,
    parentPhone: normalizePhone(seed.parentPhone),
    node_id: seed.branchId,
    full_name: seed.name,
    roll_no: seed.rollNo,
    level_id: levelIdFor(seed.branchId, seed.className),
    section_id: sectionIdFor(levelIdFor(seed.branchId, seed.className), seed.section),
    parent_phone: normalizePhone(seed.parentPhone),
    fee_structure_id: `fs-${seed.className.replace(/\s/g, "-").toLowerCase()}`,
    lifecycle_status: "enrolled",
    ledger_history,
  };
}

const students: SchoolStudent[] = studentSeeds.map(hydrate);



/* ------------------------------------------------------------------ *
 * Automated billing ledger (gateway/webhook driven — no manual slips)
 * ------------------------------------------------------------------ */

const KUICKPAY_BILLER = "88888";

export const consumerIdFor = (studentId: string) =>
  `${KUICKPAY_BILLER}-${studentId.slice(-8).padStart(8, "0")}`;

export const checkoutUrlFor = (studentId: string) =>
  `https://checkout.safepay.pk/clearbill/${studentId}`;

const hash = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
};

export const idempotencyKeyFor = (studentId: string, period: string) =>
  `idm_${hash(`${studentId}:${period}`)}${hash(period)}`.slice(0, 40);

const CURRENT_PERIOD = "July 2026";
const GATEWAYS: NonNullable<SchoolLedgerEntry["payment_method"]>[] = [
  "kuickpay",
  "safepay",
  "raast",
  "cash",
];

function ledgerEntryFor(
  st: SchoolStudent,
  period: string,
  invoiced: number,
  overrides: Partial<SchoolLedgerEntry> = {},
): SchoolLedgerEntry {
  return {
    id: `led-${st.id}-${period.replace(/\s/g, "").toLowerCase()}`,
    student_id: st.id,
    parent_phone: st.parent_phone,
    branch_node_id: st.node_id,
    billing_period: period,
    invoiced_amount: Math.round(invoiced),
    liquidated_amount: 0,
    due_date: toCalendarDate(TODAY_MS + 5 * 86_400_000),
    status: "staged",
    idempotency_key: idempotencyKeyFor(st.id, period),
    version_lock: 1,
    kuickpay_consumer_id: consumerIdFor(st.id),
    safepay_checkout_url: checkoutUrlFor(st.id),
    whatsapp_dispatch_status: "queued",
    ...overrides,
  };
}

/** Deterministic seed: paid students already settled through a gateway webhook. */
const billing_ledger: SchoolLedgerEntry[] = students.map((st, i) => {
  const settled = st.status === "PAID";
  const partial = st.status === "PARTIAL";
  const method = GATEWAYS[i % GATEWAYS.length]!;
  return ledgerEntryFor(st, CURRENT_PERIOD, st.monthlyFee + st.arrears, {
    liquidated_amount: settled ? st.monthlyFee : partial ? Math.round(st.monthlyFee / 2) : 0,
    status: settled ? "settled" : partial ? "processing" : "staged",
    payment_method: settled || partial ? method : undefined,
    whatsapp_dispatch_status: settled ? "delivered" : i % 3 === 0 ? "sent" : "queued",
    ...(settled
      ? { settled_at: new Date(TODAY_MS - (i + 1) * 3_600_000).toISOString() }
      : {}),
  });
});

const automation_feed: AutomationEvent[] = billing_ledger
  .slice(0, 8)
  .map((l, i) =>
    l.status === "settled"
      ? {
          id: `ev-${l.id}`,
          at: new Date(TODAY_MS - (i + 1) * 2_700_000).toISOString(),
          channel: "inbound" as const,
          label: `${(l.payment_method ?? "kuickpay").toUpperCase()} webhook received`,
          detail: `Consumer ${l.kuickpay_consumer_id} settled ${fmt(l.liquidated_amount)}`,
          ref: l.idempotency_key,
        }
      : {
          id: `ev-${l.id}`,
          at: new Date(TODAY_MS - (i + 1) * 2_700_000).toISOString(),
          channel: "outbound" as const,
          label: `WhatsApp invoice ${l.whatsapp_dispatch_status}`,
          detail: `${l.parent_phone} · ${l.billing_period} · ${fmt(l.invoiced_amount)}`,
          ref: l.idempotency_key,
        },
  );


const history: ConfirmedPayment[] = [
  { id: "h1", studentId: "st3", studentName: "Fatima Noor", branchId: "b1", amount: 11500, at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(), method: "KuickPay" },
  { id: "h2", studentId: "st4", studentName: "Hassan Iqbal", branchId: "b1", amount: 16500, at: new Date(Date.now() - 3600 * 1000 * 50).toISOString(), method: "Safepay" },
  { id: "h3", studentId: "st7", studentName: "Sara Rehman", branchId: "b2", amount: 15000, at: new Date(Date.now() - 3600 * 1000 * 70).toISOString(), method: "KuickPay" },
  { id: "h4", studentId: "st9", studentName: "Mahnoor Tariq", branchId: "b2", amount: 10500, at: new Date(Date.now() - 3600 * 1000 * 90).toISOString(), method: "Safepay" },
  { id: "h5", studentId: "st11", studentName: "Aiman Yousuf", branchId: "b2", amount: 10350, at: new Date(Date.now() - 3600 * 1000 * 100).toISOString(), method: "Cash" },
  { id: "h6", studentId: "st16", studentName: "Ahmed Junaid", branchId: "b3", amount: 15000, at: new Date(Date.now() - 3600 * 1000 * 120).toISOString(), method: "KuickPay" },
  { id: "h7", studentId: "st18", studentName: "Hoorain Saad", branchId: "b3", amount: 9500, at: new Date(Date.now() - 3600 * 1000 * 140).toISOString(), method: "Safepay" },
  { id: "h8", studentId: "st12", studentName: "Umer Shahid", branchId: "b2", amount: 8500, at: new Date(Date.now() - 3600 * 1000 * 160).toISOString(), method: "KuickPay" },
];

/** Seed ad-hoc challans — isolated from the recurring tuition ledger. */
const custom_challans: CustomChallan[] = [
  { sid: "st3", title: "Property Damage Fine", amount: 2500, offset: -6, status: "staged" as const, wa: "sent" as const },
  { sid: "st7", title: "Science Museum Field Trip", amount: 1800, offset: 4, status: "processing" as const, wa: "delivered" as const },
  { sid: "st12", title: "Library Late Return Penalty", amount: 600, offset: -12, status: "settled" as const, wa: "delivered" as const },
]
  .map((c, i) => {
    const st = students.find((s) => s.id === c.sid) ?? students[i];
    const seq = i + 1;
    const key = `chl_seed_${st.id}_${seq}`;
    return {
      id: `CHL-${String(seq).padStart(4, "0")}`,
      student_id: st.id,
      parent_phone: st.parent_phone,
      title: c.title,
      amount: c.amount,
      issue_date: toCalendarDate(TODAY_MS - Math.abs(c.offset) * 86_400_000),
      due_date: toCalendarDate(TODAY_MS + c.offset * 86_400_000),
      status: c.status,
      idempotency_key: key,
      version_lock: 1,
      kuickpay_consumer_id: `88888-AH${String(seq).padStart(5, "0")}`,
      safepay_checkout_url: `https://sandbox.api.getsafepay.com/checkout/pay?tracker=${key}`,
      whatsapp_dispatch_status: c.wa,
    };
  });

const initial: State = {
  // Aggregates start empty — the UI must ask the server for them.
  telemetry_kpis: EMPTY_TELEMETRY,
  isHydrated: false,
  branches,
  academic_levels,
  academic_sections,
  feeStructures,
  students,
  billing_ledger,
  automation_feed,
  custom_challans,


  history,
  reminders: {
    before3: true,
    onDue: true,
    after3: true,
    templateBefore: "Assalam-o-Alaikum {parent_name}, yeh {student_name} ({class}) ki {month} fee ka reminder hai. Due date: {due_date}, Amount: Rs. {amount}. Shukriya.",
    templateDue: "Assalam-o-Alaikum, aaj {student_name} ({class}) ki fee due hai. Amount: Rs. {amount}. Pay via KuickPay ya link se.",
    templateAfter: "Reminder: {student_name} ({class}) ki {month} fee 3 din se overdue hai. Amount: Rs. {amount} + Rs. {late_fee} late charges. Kripya jald pay kar dein.",
  },
  settings: {
    institution: "Beaconhouse Johar Town Network",
    contact: "+92 42 3521 4000",
    kuickpayBillerId: "88888",
    safepayKey: "sp_live_••••••••3421",
    defaultLatePct: 5,
    defaultGraceDays: 10,
    defaultSiblingPct: 10,
    siblingDiscountOn: true,
    policies: {
      grace_period_days: 10,
      late_fee_percentage: 5,
      sibling_discount_percentage: 10,
      discount_applies_to: "second_child_onwards",
    },
    integrations: {
      whatsapp: {
        encrypted_whatsapp_token: "EAAG••••••••••••9x2K",
        phone_number_id: "1093882771029384",
        template_id: "clearbill_fee_reminder_v3",
        enable_ai_messaging: true,
        ai_tone: "polite_urdu",
      },
      safepay: {
        environment: "production",
        public_key: "sec_9f2a41c8-77bd-4e1a-9c0f",
        encrypted_safepay_secret: "sk_live_••••••••3421",
        encrypted_safepay_webhook_secret: "whsec_••••••••8810",
        is_active: true,
      },
      kuickpay: { institution_id: "88888", encrypted_kuickpay_secret: "kp_••••••••2290", is_active: true },
      raast: { merchant_id: "PK-RAAST-40021", is_active: false },
    },
    task_queue: {
      execution_triggers: [9, 15, 20],
      dispatch_suspension_window: { start: "21:30", end: "08:00", enabled: true },
    },
  },
};

let state: State = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const schoolStore = {
  hydrateFromServer: async () => {
    const user = authStore.getSnapshot().user;
    if (!user || user.workspace_type !== "school") return;
    try {
      const [studentsRes, challansRes] = await Promise.all([
        supabase.from("students").select("*").eq("workspace_id", user.workspace_id),
        supabase.from("custom_challans").select("*").eq("workspace_id", user.workspace_id)
      ]);
      // For brevity in Phase 2 mock, we just set hydrated true and let the UI work optimistically.
      state = { ...state, isHydrated: true };
      emit();
    } catch (e) {
      console.error(e);
    }
  },
  get: () => state,
  /** Multi-tenant safety: wipes every ledger, roster and branch for this tenant. */
  reset: () => {
    state = {
      ...initial,
      branches: [],
      academic_levels: [],
      academic_sections: [],
      feeStructures: [],
      students: [],
      billing_ledger: [],
      automation_feed: [],
      custom_challans: [],
      history: [],
      telemetry_kpis: EMPTY_TELEMETRY,
    };
    resetIdempotencyLedger();
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /* ---------------- Server-side aggregation seam ---------------- */

  /**
   * Fetches institution-wide KPIs. This is a stub for
   * `SELECT SUM(invoiced_amount), SUM(liquidated_amount) … GROUP BY tenant` —
   * the aggregation MUST run in PostgreSQL, never over a paginated page of
   * rows in the browser.
   */
  fetchGlobalTelemetry: async (): Promise<TelemetryKpis> => {
    state = { ...state, telemetry_kpis: { ...state.telemetry_kpis, is_syncing: true } };
    emit();
    await simulateApiRead(220);
    // ---- server-side SQL simulation (does not run in production) ----
    const rows = aggregateLedgerRows(state);
    const kpis: TelemetryKpis = {
      ...rows,
      synced_at: toUtcTimestamp(),
      is_syncing: false,
    };
    state = { ...state, telemetry_kpis: kpis };
    emit();
    return kpis;
  },

  /**
   * Pre-flight anti-harassment guard. Asks the backend whether the ledger was
   * settled by a gateway webhook while the operator's page was stale.
   * `true` = still open and safe to action.
   */
  verifyLedgerFreshness: async (ledger_id: string): Promise<boolean> => {
    await simulateApiRead(160);
    const entry =
      state.billing_ledger.find((l) => l.id === ledger_id || l.idempotency_key === ledger_id) ??
      state.custom_challans.find((c) => c.id === ledger_id || c.idempotency_key === ledger_id);
    if (!entry) return true; // nothing staged yet — nothing to collide with
    if ("liquidated_amount" in entry) {
      return entry.status !== "settled" && entry.liquidated_amount < entry.invoiced_amount;
    }
    return entry.status !== "settled";
  },

  /** Freshness check for a student's oldest open recurring ledger row. */
  verifyStudentFreshness: async (student_id: string): Promise<boolean> => {
    await simulateApiRead(160);
    const st = state.students.find((s) => s.id === student_id);
    if (!st) return false;
    return getStudentArrears(st) > 0;
  },

  addBranch: (b: Omit<Branch, "id" | "node_id">) => {
    const id = crypto.randomUUID();
    state = { ...state, branches: [...state.branches, { ...b, id, node_id: id }] };
    emit();
  },

  /* ---------------- Academic Taxonomy Engine ---------------- */

  addAcademicLevel: (branch_node_id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return null;
    const id = levelIdFor(branch_node_id, clean);
    if (state.academic_levels.some((l) => l.id === id)) return null;
    const order_index = state.academic_levels.filter((l) => l.branch_node_id === branch_node_id).length;
    const level: AcademicLevel = { id, branch_node_id, name: clean, order_index };
    state = { ...state, academic_levels: [...state.academic_levels, level] };
    emit();
    return level;
  },
  renameAcademicLevel: (level_id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    state = {
      ...state,
      academic_levels: state.academic_levels.map((l) => (l.id === level_id ? { ...l, name: clean } : l)),
      students: state.students.map((s) => (s.level_id === level_id ? { ...s, className: clean } : s)),
      feeStructures: state.feeStructures.map((f) =>
        f.level_id === level_id ? { ...f, className: clean } : f,
      ),
    };
    emit();
  },
  deleteAcademicLevel: (level_id: string) => {
    state = {
      ...state,
      academic_levels: state.academic_levels.filter((l) => l.id !== level_id),
      academic_sections: state.academic_sections.filter((s) => s.level_id !== level_id),
    };
    emit();
  },
  addAcademicSection: (level_id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return null;
    const id = sectionIdFor(level_id, clean);
    if (state.academic_sections.some((s) => s.id === id)) return null;
    const section: AcademicSection = { id, level_id, name: clean };
    state = { ...state, academic_sections: [...state.academic_sections, section] };
    emit();
    return section;
  },
  deleteAcademicSection: (section_id: string) => {
    state = {
      ...state,
      academic_sections: state.academic_sections.filter((s) => s.id !== section_id),
    };
    emit();
  },

  /**
   * Schema-gated enrolment. The payload is parsed BEFORE any state is written,
   * so an invalid parent phone can never reach the wire.
   */
  addStudent: (s: Omit<StudentSeed, "id" | "status">): { ok: true } | { ok: false; error: string } => {
    const parsed = addStudentSchema.safeParse(s);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const seed: StudentSeed = {
      ...parsed.data,
      parentPhone: normalizePhone(parsed.data.parentPhone),
      id: crypto.randomUUID(),
      status: "UNPAID",
    };
    state = { ...state, students: [...state.students, hydrate(seed, state.students.length)] };
    emit();
    const authUser = authStore.getSnapshot().user;
    if (authUser) {
      supabase.from("students").insert({
        id: seed.id,
        workspace_id: authUser.workspace_id,
        full_name: seed.name,
        parent_phone: seed.parentPhone
      }).then();
    }
    return { ok: true };
  },
  markStudentsPaid: (ids: string[]) => {
    const now = toUtcTimestamp();
    const newHistory: ConfirmedPayment[] = [];
    state = {
      ...state,
      students: state.students.map((s) => {
        if (!ids.includes(s.id)) return s;
        newHistory.push({
          id: crypto.randomUUID(),
          studentId: s.id,
          studentName: s.name,
          branchId: s.branchId,
          amount: s.monthlyFee + s.arrears,
          at: now,
          method: "Cash",
        });
        return { ...s, status: "PAID" as StudentStatus, arrears: 0 };
      }),
      history: [...newHistory, ...state.history],
    };
    emit();
  },
  /** Stages ledger entries for every enrolled student of a branch (or all). */
  generateMonthlyBillsAction: (branch_id: string = "all", period: string = CURRENT_PERIOD) => {
    const targets = state.students.filter(
      (s) => s.lifecycle_status === "enrolled" && (branch_id === "all" || s.node_id === branch_id),
    );
    const now = toUtcTimestamp();
    const created: SchoolLedgerEntry[] = [];

    // O(1) membership test instead of a full ledger scan per student.
    const existingKeys = new Set(state.billing_ledger.map((l) => l.idempotency_key));
    // One rollup per household, reused across every sibling in that household.
    const rollupCache = new Map<string, RollupInvoice>();

    for (const st of targets) {
      const key = idempotencyKeyFor(st.id, period);
      if (existingKeys.has(key)) continue; // idempotent
      const phone = normalizePhone(st.parent_phone);
      let rollup = rollupCache.get(phone);
      if (!rollup) {
        rollup = getParentRollupInvoice(phone, state);
        rollupCache.set(phone, rollup);
      }
      const line = rollup.lines.find((l) => l.student.id === st.id);
      const share =
        rollup.gross > 0 && line
          ? Math.round(line.subtotal - (rollup.discount * line.base) / rollup.gross)
          : st.monthlyFee;
      created.push(ledgerEntryFor(st, period, Math.max(0, Math.round(share))));
      existingKeys.add(key);
    }

    const events: AutomationEvent[] = created.slice(0, 6).map((l) => ({
      id: crypto.randomUUID(),
      at: now,
      channel: "outbound",
      label: "Invoice staged",
      detail: `${l.billing_period} · ${l.kuickpay_consumer_id} · ${fmt(l.invoiced_amount)}`,
      ref: l.idempotency_key,
    }));

    state = {
      ...state,
      billing_ledger: [...created, ...state.billing_ledger],
      automation_feed: [...events, ...state.automation_feed].slice(0, 60),
    };
    emit();
    return created.length;
  },

  /** Fires WhatsApp Cloud API payloads (template var {{2}} = AI-toned summary). */
  triggerBulkWhatsAppBillingAction: (branch_id: string = "all") => {
    const wa = state.settings.integrations.whatsapp;
    const now = toUtcTimestamp();
    const targets = state.billing_ledger.filter(
      (l) =>
        l.status !== "settled" &&
        l.whatsapp_dispatch_status !== "delivered" &&
        (branch_id === "all" || l.branch_node_id === branch_id),
    );

    const events: AutomationEvent[] = targets.slice(0, 10).map((l) => ({
      id: crypto.randomUUID(),
      at: now,
      channel: "outbound",
      label: "WhatsApp invoice sent",
      detail: `${l.parent_phone} · template ${wa.template_id} · {{2}} ${wa.ai_tone} · ${fmt(l.invoiced_amount)}`,
      ref: l.idempotency_key,
    }));

    const keys = new Set(targets.map((l) => l.idempotency_key));
    state = {
      ...state,
      billing_ledger: state.billing_ledger.map((l) =>
        keys.has(l.idempotency_key)
          ? { ...l, whatsapp_dispatch_status: "sent" as const, version_lock: l.version_lock + 1 }
          : l,
      ),
      automation_feed: [...events, ...state.automation_feed].slice(0, 60),
    };
    emit();
    return targets.length;
  },

  /** Instant 1Link/KuickPay/Safepay webhook callback: staged → settled. */
  simulateGatewayWebhookSettlement: (
    idempotency_key: string,
    method: NonNullable<SchoolLedgerEntry["payment_method"]> = "kuickpay",
  ) => {
    const entry = state.billing_ledger.find((l) => l.idempotency_key === idempotency_key);
    if (!entry) return false;
    if (entry.status === "settled") return true; // idempotent replay → 200 OK, no mutation

    const now = toUtcTimestamp();
    const st = state.students.find((s) => s.id === entry.student_id);

    state = {
      ...state,
      billing_ledger: state.billing_ledger.map((l) =>
        l.idempotency_key === idempotency_key
          ? {
              ...l,
              status: "settled" as const,
              liquidated_amount: Math.round(l.invoiced_amount),
              payment_method: method,
              settled_at: now,
              version_lock: l.version_lock + 1,
            }
          : l,
      ),
      students: state.students.map((s) =>
        s.id === entry.student_id ? { ...s, status: "PAID" as StudentStatus, arrears: 0 } : s,
      ),
      history: st
        ? [
            {
              id: crypto.randomUUID(),
              studentId: st.id,
              studentName: st.name,
              branchId: st.branchId,
              amount: entry.invoiced_amount,
              at: now,
              method: (method === "safepay" ? "Safepay" : method === "cash" ? "Cash" : "KuickPay") as ConfirmedPayment["method"],
            },
            ...state.history,
          ]
        : state.history,
      automation_feed: [
        {
          id: crypto.randomUUID(),
          at: now,
          channel: "inbound" as const,
          label: `${method.toUpperCase()} webhook received`,
          detail: `Consumer ${entry.kuickpay_consumer_id} settled ${fmt(entry.invoiced_amount)} → status settled`,
          ref: idempotency_key,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit();
    return true;
  },

  /**
   * Counter cash received at the office.
   *
   * Network-hardened: schema gate → pre-flight freshness ping (a webhook may
   * have settled this student already) → optimistic write → simulated API
   * round-trip → rollback to the pre-mutation snapshot on failure.
   */
  recordDirectCashSettlement: async (
    student_id: string,
    amount: number,
    action_idempotency_key?: string,
  ): Promise<boolean> => {
    const parsed = cashSettlementSchema.safeParse({ student_id, amount });
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error));
      return false;
    }
    const st = state.students.find((s) => s.id === student_id);
    if (!st) return false;
    // Double-spend lock: a replayed key is a no-op, so a double-click can never
    // mint a phantom counter-cash entry.
    if (action_idempotency_key && !claimIdempotencyKey(action_idempotency_key)) return false;

    // ---- PRE-FLIGHT: refuse to collect against an already-settled ledger ----
    const fresh = await schoolStore.verifyStudentFreshness(student_id);
    if (!fresh) {
      await schoolStore.fetchGlobalTelemetry(); // auto-refresh the stale row
      emit();
      toast.error("LEDGER ALREADY SETTLED", {
        description: "A gateway webhook cleared this account. Row refreshed.",
      });
      return false;
    }

    const snapshot = snapshotState(state); // deep-cloned rollback anchor
    const now = toUtcTimestamp();
    const open = state.billing_ledger
      .filter((l) => l.student_id === student_id && l.status !== "settled")
      .sort((a, b) => parseCalendarDate(a.due_date) - parseCalendarDate(b.due_date))[0];

    const entry: SchoolLedgerEntry =
      open ??
      ledgerEntryFor(st, CURRENT_PERIOD, amount, { id: `led-cash-${crypto.randomUUID()}` });

    const liquidated = Math.round(entry.liquidated_amount + amount);
    const settled = liquidated >= entry.invoiced_amount;

    const updated: SchoolLedgerEntry = {
      ...entry,
      liquidated_amount: liquidated,
      payment_method: "cash",
      status: settled ? "settled" : "processing",
      whatsapp_dispatch_status: "delivered",
      version_lock: entry.version_lock + 1,
      ...(settled ? { settled_at: now } : {}),
    };

    state = {
      ...state,
      billing_ledger: open
        ? state.billing_ledger.map((l) => (l.id === entry.id ? updated : l))
        : [updated, ...state.billing_ledger],
      students: state.students.map((s) => {
        if (s.id !== student_id) return s;
        // Waterfall the cash across the recurring ledger history (oldest first)
        // so getStudentArrears() reflects the settlement immediately.
        let remaining = amount;
        const history = [...s.ledger_history]
          .sort((a, b) => parseCalendarDate(a.due_date) - parseCalendarDate(b.due_date))
          .map((l) => {
            const owed = l.invoiced_amount - l.liquidated_amount;
            if (remaining <= 0 || owed <= 0) return l;
            const applied = Math.min(owed, remaining);
            remaining -= applied;
            const liq = Math.round(l.liquidated_amount + applied);
            return {
              ...l,
              version_lock: l.version_lock + 1,
              liquidated_amount: liq,
              payment_method: "cash" as const,
              status: (liq >= l.invoiced_amount ? "settled" : l.status) as SchoolLedger["status"],
            };
          });
        const openLeft = history.reduce(
          (sum, l) => sum + (l.invoiced_amount - l.liquidated_amount),
          0,
        );
        return {
          ...s,
          ledger_history: history,
          status: (openLeft <= 0 ? "PAID" : "PARTIAL") as StudentStatus,
          arrears: Math.max(0, openLeft),
        };
      }),

      history: [
        {
          id: crypto.randomUUID(),
          studentId: st.id,
          studentName: st.name,
          branchId: st.branchId,
          amount,
          at: now,
          method: "Cash" as ConfirmedPayment["method"],
        },
        ...state.history,
      ],
      automation_feed: [
        {
          id: crypto.randomUUID(),
          at: now,
          channel: "outbound" as const,
          label: "Cash receipt dispatched",
          detail: `${st.full_name} · ${fmt(amount)} received at counter · WhatsApp receipt sent`,
          ref: updated.idempotency_key,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit(); // optimistic paint

    try {
      const authUser = authStore.getSnapshot().user;
      if (authUser) {
        await supabase.from("school_ledger_entries").upsert({
          id: entry.id,
          workspace_id: authUser.workspace_id,
          student_id: student_id,
          invoiced_amount: entry.invoiced_amount,
          liquidated_amount: liquidated,
          status: settled ? "settled" : "processing",
          payment_method: "cash"
        });
      }
      return true;
    } catch {
      state = snapshot; // zero ghost data
      emit();
      toast.error("NETWORK DESYNC: Settlement Failed", {
        description: "The counter cash was rolled back. Nothing was committed.",
      });
      return false;
    }
  },

  /** Enrol / suspend / graduate a student (excludes them from billing runs). */
  setStudentLifecycle: (student_id: string, lifecycle: LifecycleStatus) => {
    const st = state.students.find((s) => s.id === student_id);
    if (!st) return false;
    state = {
      ...state,
      students: state.students.map((s) =>
        s.id === student_id ? { ...s, lifecycle_status: lifecycle } : s,
      ),
      automation_feed: [
        {
          id: crypto.randomUUID(),
          at: toUtcTimestamp(),
          channel: "outbound" as const,
          label: lifecycle === "suspended" ? "Student suspended" : "Lifecycle updated",
          detail: `${st.full_name} · ${st.className} · ${lifecycle}`,
          ref: st.id,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit();
    return true;
  },


  saveFeeStructure: (f: FeeStructure) => {
    const exists = state.feeStructures.some((x) => x.id === f.id);
    state = {
      ...state,
      feeStructures: exists
        ? state.feeStructures.map((x) => (x.id === f.id ? f : x))
        : [...state.feeStructures, f],
    };
    emit();
  },
  deleteFeeStructure: (id: string) => {
    state = { ...state, feeStructures: state.feeStructures.filter((x) => x.id !== id) };
    emit();
  },
  updateReminders: (r: Partial<ReminderSettings>) => {
    state = { ...state, reminders: { ...state.reminders, ...r } };
    emit();
  },
  updateSettings: (s: Partial<Settings>) => {
    state = { ...state, settings: { ...state.settings, ...s } };
    emit();
  },
  /** Marks a student's open invoice as awaiting gateway confirmation. */
  markAwaitingGateway: (studentId: string) => {
    state = {
      ...state,
      billing_ledger: state.billing_ledger.map((l) =>
        l.student_id === studentId && l.status === "staged"
          ? { ...l, status: "processing" as const }
          : l,
      ),
      students: state.students.map((s) => (s.id === studentId ? { ...s, status: "PENDING" } : s)),
    };
    emit();
  },

  /* ---------------- Ad-hoc "Custom Challan" subsystem ---------------- */

  /**
   * Issues a standalone challan, fully decoupled from recurring tuition.
   * Schema-gated, optimistic, and rolled back on a failed round-trip.
   */
  issueCustomChallan: async (
    student_id: string,
    title: string,
    amount: number,
    due_date: string,
    action_idempotency_key?: string,
  ): Promise<CustomChallan | null> => {
    const parsed = customChallanSchema.safeParse({ student_id, title, amount, due_date });
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error));
      return null;
    }
    const student = state.students.find((s) => s.id === student_id);
    if (!student) return null;
    if (action_idempotency_key && !claimIdempotencyKey(action_idempotency_key)) return null;
    const snapshot = snapshotState(state); // deep-cloned rollback anchor

    const seq = state.custom_challans.length + 1;
    const key = `chl_${student_id}_${seq}_${Date.now()}`;
    const challan: CustomChallan = {
      id: `CHL-${String(seq).padStart(4, "0")}`,
      student_id,
      parent_phone: student.parent_phone,
      title: title.trim(),
      amount: Math.round(amount),
      issue_date: calendarToday(),
      due_date: toCalendarDate(due_date),
      status: "staged",
      idempotency_key: key,
      version_lock: 1,
      kuickpay_consumer_id: `${state.settings.integrations.kuickpay.institution_id}-AH${String(seq).padStart(5, "0")}`,
      safepay_checkout_url: `https://sandbox.api.getsafepay.com/checkout/pay?tracker=${key}`,
      whatsapp_dispatch_status: "queued",
    };

    state = {
      ...state,
      custom_challans: [challan, ...state.custom_challans],
      automation_feed: [
        {
          id: `af_chl_${challan.id}`,
          at: challan.issue_date,
          channel: "outbound" as const,
          label: "Ad-hoc challan issued",
          detail: `${student.full_name} · ${challan.title} · ${fmt(challan.amount)}`,
          ref: challan.idempotency_key,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit(); // optimistic paint

    try {
      const authUser = authStore.getSnapshot().user;
      if (authUser) {
        await supabase.from("custom_challans").insert({
          id: challan.id,
          workspace_id: authUser.workspace_id,
          student_id: student_id,
          title: title.trim(),
          amount: Math.round(amount),
          status: "staged"
        });
      }
      return challan;
    } catch {
      state = snapshot; // zero ghost data
      emit();
      toast.error("NETWORK DESYNC: Challan issuance failed", {
        description: "The challan was rolled back and never issued.",
      });
      return null;
    }
  },

  /**
   * Bulk/cohort issuance — ONE aggregated mutation.
   *
   * The whole cohort is built in a local buffer and committed with a single
   * `state = {...}` + `emit()`, so N students cost exactly one re-render (not
   * N). The wire payload mirrors this: one request carrying `student_ids: []`
   * (see `buildBulkChallanPayload`), never a fetch() loop on the client.
   */
  issueBulkCustomChallans: async (
    student_ids: string[],
    title: string,
    amount: number,
    due_date: string,
    action_idempotency_key?: string,
  ): Promise<CustomChallan[]> => {
    const parsed = customChallanSchema.safeParse({
      student_id: student_ids[0] ?? "",
      title,
      amount,
      due_date,
    });
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error));
      return [];
    }
    const clean = title.trim();
    if (action_idempotency_key && !claimIdempotencyKey(action_idempotency_key)) return [];
    const snapshot = snapshotState(state); // deep-cloned rollback anchor

    const issued: CustomChallan[] = [];
    const events: AutomationEvent[] = [];
    const now = Date.now();
    const issued_on = calendarToday();
    const normalized_due = toCalendarDate(due_date);
    const unique_ids = Array.from(new Set(student_ids));

    unique_ids.forEach((student_id, i) => {
      const student = state.students.find((s) => s.id === student_id);
      if (!student) return;
      const seq = state.custom_challans.length + issued.length + 1;
      const key = `chl_${student_id}_${seq}_${now + i}`;

      const challan: CustomChallan = {
        id: `CHL-${String(seq).padStart(4, "0")}`,
        student_id,
        parent_phone: student.parent_phone,
        title: clean,
        amount: Math.round(amount),
        issue_date: issued_on,
        due_date: normalized_due,
        status: "staged",
        idempotency_key: key,
        version_lock: 1,
        kuickpay_consumer_id: `${state.settings.integrations.kuickpay.institution_id}-AH${String(seq).padStart(5, "0")}`,
        safepay_checkout_url: `https://sandbox.api.getsafepay.com/checkout/pay?tracker=${key}`,
        whatsapp_dispatch_status: "queued",
      };
      issued.push(challan);
      events.push({
        id: `af_chl_${challan.id}`,
        at: challan.issue_date,
        channel: "outbound" as const,
        label: "Ad-hoc challan issued",
        detail: `Queued AI-personalized WhatsApp Challan payload for ${student.full_name}`,
        ref: challan.idempotency_key,
      });
    });

    if (!issued.length) return [];

    state = {
      ...state,
      custom_challans: [...issued.slice().reverse(), ...state.custom_challans],
      automation_feed: [...events.slice().reverse(), ...state.automation_feed].slice(0, 60),
    };
    emit(); // optimistic paint

    try {
      const authUser = authStore.getSnapshot().user;
      if (authUser) {
        const inserts = issued.map(c => ({
          id: c.id,
          workspace_id: authUser.workspace_id,
          student_id: c.student_id,
          title: clean,
          amount: Math.round(amount),
          status: "staged"
        }));
        await supabase.from("custom_challans").insert(inserts);
      }
      return issued;
    } catch {
      state = snapshot; // zero ghost data
      emit();
      toast.error("NETWORK DESYNC: Bulk issuance failed", {
        description: `${issued.length} challans were rolled back.`,
      });
      return [];
    }
  },

  /**
   * Dispatches the isolated `ad_hoc_fee_notice` Meta template for one challan.
   * Anti-harassment: aborts if a webhook already settled the challan.
   */
  dispatchChallanWhatsApp: async (challan_id: string) => {
    const challan = state.custom_challans.find((c) => c.id === challan_id);
    if (!challan) return null;
    const fresh = await schoolStore.verifyLedgerFreshness(challan_id);
    if (!fresh) {
      emit(); // auto-refresh the stale row
      toast.error("DISPATCH ABORTED", {
        description: "This challan was already settled by the gateway.",
      });
      return null;
    }
    const student = state.students.find((s) => s.id === challan.student_id);

    state = {
      ...state,
      custom_challans: state.custom_challans.map((c) =>
        c.id === challan_id
          ? { ...c, whatsapp_dispatch_status: "sent" as const, version_lock: c.version_lock + 1 }
          : c,
      ),
      automation_feed: [
        {
          id: `af_chl_wa_${challan.id}_${Date.now()}`,
          at: toUtcTimestamp(),
          channel: "outbound" as const,
          label: "WhatsApp · ad_hoc_fee_notice",
          detail: `${student?.full_name ?? challan.student_id} · ${challan.title} · ${fmt(challan.amount)} → ${challan.parent_phone}`,
          ref: challan.idempotency_key,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit();
    return {
      to: challan.parent_phone,
      template_id: "ad_hoc_fee_notice",
      challan_id: challan.id,
      amount: challan.amount,
    };
  },

  /** Marks a challan processing (parent tapped pay) — awaits gateway webhook. */
  markChallanProcessing: (challan_id: string) => {
    state = {
      ...state,
      custom_challans: state.custom_challans.map((c) =>
        c.id === challan_id && c.status === "staged"
          ? { ...c, status: "processing" as const, version_lock: c.version_lock + 1 }
          : c,
      ),
    };
    emit();
  },

  /** Gateway webhook settlement, keyed strictly by this challan's idempotency key. */
  settleCustomChallan: (
    challan_id: string,
    method: "safepay" | "kuickpay" | "raast" | "cash" = "kuickpay",
  ) => {
    const challan = state.custom_challans.find((c) => c.id === challan_id);
    if (!challan || challan.status === "settled") return false;
    const student = state.students.find((s) => s.id === challan.student_id);

    state = {
      ...state,
      custom_challans: state.custom_challans.map((c) =>
        c.id === challan_id
          ? {
              ...c,
              status: "settled" as const,
              whatsapp_dispatch_status: "delivered" as const,
              version_lock: c.version_lock + 1,
            }
          : c,
      ),
      automation_feed: [
        {
          id: `af_chl_settle_${challan.id}_${Date.now()}`,
          at: toUtcTimestamp(),
          channel: "inbound" as const,
          label: `Webhook · ${method} settlement`,
          detail: `${student?.full_name ?? challan.student_id} · ${challan.title} · ${fmt(challan.amount)} settled`,
          ref: challan.idempotency_key,
        },
        ...state.automation_feed,
      ].slice(0, 60),
    };
    emit();
    return true;
  },

  cancelCustomChallan: (challan_id: string) => {
    state = {
      ...state,
      custom_challans: state.custom_challans.map((c) =>
        c.id === challan_id
          ? { ...c, status: "cancelled" as const, version_lock: c.version_lock + 1 }
          : c,
      ),
    };
    emit();

  },
};


export function useSchoolStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    schoolStore.subscribe,
    () => selector(state),
    () => selector(initial),
  );
}

export { CLASSES };
export const SECTIONS = ["A", "B", "C"];

/* ---------------- Taxonomy selectors ---------------- */

export const levelsForBranch = (s: State, branch_node_id: string) =>
  s.academic_levels
    .filter((l) => l.branch_node_id === branch_node_id)
    .sort((a, b) => a.order_index - b.order_index);

export const sectionsForLevel = (s: State, level_id: string) =>
  s.academic_sections.filter((x) => x.level_id === level_id);

export const levelName = (s: State, level_id: string) =>
  s.academic_levels.find((l) => l.id === level_id)?.name ?? "—";

export const sectionName = (s: State, section_id: string) =>
  s.academic_sections.find((x) => x.id === section_id)?.name ?? "—";

export function fmt(n: number) {
  return "Rs. " + Math.round(n).toLocaleString("en-PK");
}

/* ================================================================== *
 * COMPUTED GETTERS — the heavy math (pure, memo-friendly)
 * ================================================================== */

export type Friction = {
  days_overdue: number;
  base_due: number;
  penalty: number;
  payable: number;
  billing_month: string;
  ledger: SchoolLedger | null;
};

/** Σ (invoiced − liquidated) across the student's full recurring ledger history. */
export function getStudentArrears(student?: SchoolStudent | null): number {
  return Math.round(
    (student?.ledger_history ?? []).reduce(
      (sum, l) => sum + ((l.invoiced_amount ?? 0) - (l.liquidated_amount ?? 0)),
      0,
    ),
  );
}

/**
 * Days past due on the oldest unsettled ledger entry. When the overdue window
 * exceeds the grace period, the late-fee percentage is added to the payable.
 */
export function calculateTemporalFriction(
  student?: SchoolStudent | null,
  policies: FeePolicies = initial.settings.policies,
): Friction {
  const open = (student?.ledger_history ?? [])
    .filter(
      (l) =>
        l.liquidated_amount < l.invoiced_amount &&
        l.status !== "refunded" &&
        l.status !== "rejected",
    )
    .sort((a, b) => parseCalendarDate(a.due_date) - parseCalendarDate(b.due_date));


  const ledger = open[0] ?? null;
  const base_due = getStudentArrears(student);
  if (!ledger) {
    return { days_overdue: 0, base_due, penalty: 0, payable: base_due, billing_month: "—", ledger: null };
  }

  const days_overdue = daysOverdue(ledger.due_date, TODAY_MS);
  const penalty =
    days_overdue > policies.grace_period_days
      ? Math.round((base_due * policies.late_fee_percentage) / 100)
      : 0;

  return {
    days_overdue,
    base_due,
    penalty,
    payable: Math.round(base_due + penalty),
    billing_month: ledger.billing_month,
    ledger,
  };
}

export type RollupLine = {
  student: SchoolStudent;
  base: number; // recurring tuition due for this child
  tuition: number; // recurring portion only (identical to base — ad-hoc is decoupled)
  penalty: number;
  days_overdue: number;
  subtotal: number;
};

export type RollupInvoice = {
  parent_phone: string;
  parent_name: string;
  lines: RollupLine[];
  gross: number;
  penalties: number;
  discount: number;
  total: number;
  discount_percentage: number;
};

/**
 * Aggregates every sibling sharing a parent_phone into one payable invoice.
 *
 * Single pass: the sibling set is resolved once, friction is computed once per
 * child and reused for sorting AND for the line items (no nested re-scans of
 * the ledger per sibling), and every monetary output is integer rupees.
 */
export function getParentRollupInvoice(parent_phone: string, s: State): RollupInvoice {
  const key = normalizePhone(parent_phone);
  const p = s.settings.policies;

  // One filter over the student table; friction computed exactly once per child.
  const computed = s.students.reduce<{ student: SchoolStudent; friction: Friction }[]>(
    (acc, st) => {
      if (normalizePhone(st.parent_phone ?? st.parentPhone) === key) {
        acc.push({ student: st, friction: calculateTemporalFriction(st, p) });
      }
      return acc;
    },
    [],
  );

  computed.sort((a, b) => {
    const baseDiff = b.friction.base_due - a.friction.base_due;
    if (baseDiff !== 0) return baseDiff;
    return +new Date(a.student.admissionDate) - +new Date(b.student.admissionDate);
  });

  const lines: RollupLine[] = computed.map(({ student, friction }) => {
    const base = Math.round(friction.base_due);
    const penalty = Math.round(friction.penalty);
    return {
      student,
      base,
      tuition: base,
      penalty,
      days_overdue: friction.days_overdue,
      subtotal: base + penalty,
    };
  });

  const gross = lines.reduce((a, l) => a + l.base, 0);
  const penalties = lines.reduce((a, l) => a + l.penalty, 0);

  const discountable =
    p.discount_applies_to === "all_children"
      ? lines
      : lines.slice(1); // second child onwards
  const discount =
    lines.length > 1 && s.settings.siblingDiscountOn
      ? Math.round(discountable.reduce((a, l) => a + l.tuition, 0) * (p.sibling_discount_percentage / 100))
      : 0;

  return {
    parent_phone: key,
    parent_name: computed[0]?.student.parentName ?? "Guardian",
    lines,
    gross: Math.round(gross),
    penalties: Math.round(penalties),
    discount,
    total: Math.max(0, Math.round(gross + penalties - discount)),
    discount_percentage: p.sibling_discount_percentage,
  };
}

/**
 * SERVER-SIDE SIMULATION — do NOT call from a component.
 *
 * Stands in for the SQL aggregate behind `fetchGlobalTelemetry()`. The browser
 * must never sum a paginated ledger; this function exists only so the mock
 * transport has something to answer with.
 */
function aggregateLedgerRows(s: State): Omit<TelemetryKpis, "synced_at" | "is_syncing"> {
  let invoiced = 0;
  let liquidated = 0;
  let settled_count = 0;
  let open_count = 0;

  for (const st of s.students) {
    for (const l of st.ledger_history ?? []) {
      invoiced += l.invoiced_amount;
      liquidated += l.liquidated_amount;
      if (l.liquidated_amount >= l.invoiced_amount) settled_count++;
      else open_count++;
    }
  }

  return {
    gross_capital: Math.round(invoiced),
    liquidated: Math.round(liquidated),
    arrears: Math.max(0, Math.round(invoiced - liquidated)),
    collection_velocity: invoiced === 0 ? 0 : Math.round((liquidated / invoiced) * 1000) / 10,
    collection_velocity_chart: aggregateVelocitySeries(s),
    settled_count,
    open_count,
    isLoadingTelemetry: false,
  };
}

/** SERVER-SIDE SIMULATION of `SELECT date_trunc(...) … GROUP BY 1` (trailing 30 days). */
function aggregateVelocitySeries(s: State): VelocityPoint[] {
  const DAY = 86_400_000;
  const end = TODAY_MS;
  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const k = toLocalCalendarDate(end - i * DAY);
    keys.push(k);
    buckets.set(k, 0);
  }
  const add = (key: string, amount: number) => {
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
  };
  for (const p of s.history) add(toLocalCalendarDate(new Date(p.at)), p.amount);
  for (const st of s.students)
    for (const l of st.ledger_history ?? []) {
      if (l.liquidated_amount <= 0) continue;
      let h = 0;
      for (let i = 0; i < l.id.length; i++) h = (h * 31 + l.id.charCodeAt(i)) % 30;
      add(keys[h]!, l.liquidated_amount);
    }
  return keys.map((k) => ({
    month: new Date(`${k}T00:00:00.000Z`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }),
    revenue: Math.round(buckets.get(k) ?? 0),
  }));
}


/* ================================================================== *
 * Settings sub-writers + automation dispatch
 * ================================================================== */

export const schoolPolicies = {
  updatePolicies: (p: Partial<FeePolicies>) => {
    state = {
      ...state,
      settings: {
        ...state.settings,
        policies: { ...state.settings.policies, ...p },
        defaultLatePct: p.late_fee_percentage ?? state.settings.defaultLatePct,
        defaultGraceDays: p.grace_period_days ?? state.settings.defaultGraceDays,
        defaultSiblingPct: p.sibling_discount_percentage ?? state.settings.defaultSiblingPct,
      },
    };
    emit();
  },
  updateIntegration: <K extends keyof Integrations>(key: K, patch: Partial<Integrations[K]>) => {
    state = {
      ...state,
      settings: {
        ...state.settings,
        integrations: {
          ...state.settings.integrations,
          [key]: { ...state.settings.integrations[key], ...patch },
        },
      },
    };
    emit();
  },
  updateTaskQueue: (patch: Partial<TaskQueue>) => {
    state = { ...state, settings: { ...state.settings, task_queue: { ...state.settings.task_queue, ...patch } } };
    emit();
  },
  /**
   * Queues an outbound WhatsApp payload for a student (mock transport).
   * Anti-harassment pre-flight: never chase a parent whose ledger a webhook
   * has already settled — abort and refresh the row instead.
   */
  dispatchPayload: async (studentId: string) => {
    const st = state.students.find((x) => x.id === studentId);
    if (!st) return null;
    const fresh = await schoolStore.verifyStudentFreshness(studentId);
    if (!fresh) {
      await schoolStore.fetchGlobalTelemetry(); // auto-refresh the stale row
      toast.error("DISPATCH ABORTED", {
        description: `${st.full_name}'s ledger is already settled.`,
      });
      return null;
    }
    const f = calculateTemporalFriction(st, state.settings.policies);
    return {
      to: st.parent_phone,
      template_id: state.settings.integrations.whatsapp.template_id,
      ai_tone: state.settings.integrations.whatsapp.ai_tone,
      amount: f.payable,
      days_overdue: f.days_overdue,
      student: st.full_name,
    };
  },
};

/* ================================================================== *
 * BACKEND HANDOFF PAYLOADS
 * ================================================================== */

export type BulkChallanPayload = {
  student_ids: string[];
  title: string;
  amount: number;
  /** Strict calendar date — never a UTC timestamp. */
  due_date: string;
  issue_date: string;
  action_idempotency_key: string;
};

/**
 * One aggregated network request for a whole cohort. The backend fans out
 * server-side; the client never loops fetch() per student.
 */
export function buildBulkChallanPayload(input: {
  student_ids: string[];
  title: string;
  amount: number;
  due_date: string;
  action_idempotency_key: string;
}): BulkChallanPayload {
  return {
    student_ids: Array.from(new Set(input.student_ids)),
    title: input.title.trim(),
    amount: Math.round(input.amount),
    due_date: toCalendarDate(input.due_date),
    issue_date: calendarToday(),
    action_idempotency_key: input.action_idempotency_key,
  };
}
