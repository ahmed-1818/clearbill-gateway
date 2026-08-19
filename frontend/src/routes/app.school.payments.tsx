import { useMutationLock } from "@/lib/use-mutation-lock";
import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Zap,
  Send,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Search,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { SchoolShell, PageHeader } from "@/components/clearbill/school-shell";
import {
  schoolStore,
  useSchoolStore,
  fmt,
  getParentRollupInvoice,
  type SchoolLedgerEntry,
} from "@/lib/school-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/school/payments")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Payments & Automation · ClearBill School" },
      {
        name: "description",
        content:
          "Automated gateway webhook reconciliation, WhatsApp invoice dispatch, and counter cash settlement.",
      },
      { property: "og:title", content: "Payments & Automation · ClearBill School" },
      {
        property: "og:description",
        content: "Live webhook feed, settled ledger audit log, and counter cash terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <SchoolShell>
      <PageHeader eyebrow="Operations" title="Payments & Automation" />
      <Tabs defaultValue="live" className="mt-6">
        <TabsList>
          <TabsTrigger value="live">Live Operations</TabsTrigger>
          <TabsTrigger value="history">Settled Ledger</TabsTrigger>
          <TabsTrigger value="cash">Counter Cash</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4"><LiveTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><LedgerTab /></TabsContent>
        <TabsContent value="cash" className="mt-4"><CashTab /></TabsContent>
      </Tabs>
    </SchoolShell>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 1 — Live Webhook & Dispatch Feed
 * ------------------------------------------------------------------ */

function LiveTab() {
  const feed = useSchoolStore((s) => s.automation_feed);
  const ledger = useSchoolStore((s) => s.billing_ledger);

  const outbound = feed.filter((e) => e.channel === "outbound");
  const inbound = feed.filter((e) => e.channel === "inbound");

  const staged = ledger.filter((l) => l.status === "staged").length;
  const processing = ledger.filter((l) => l.status === "processing").length;
  const settled = ledger.filter((l) => l.status === "settled").length;

  const nextOpen = ledger.find((l) => l.status !== "settled");
  const billsLock = useMutationLock();

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">Automation control</h3>
          <p className="text-xs text-muted-foreground">
            {staged} staged · {processing} awaiting gateway · {settled} settled
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={billsLock.busy}
            onClick={() =>
              billsLock.run("monthly_bills", () => {
                const n = schoolStore.generateMonthlyBillsAction("all");
                toast.success(n ? `${n} invoices staged` : "All invoices already generated", {
                  description: n
                    ? "Sibling discounts and late fees applied"
                    : "Idempotency keys matched",
                });
              })
            }
          >
            <Zap className="mr-1.5 h-4 w-4" /> Generate Monthly Bills
          </Button>
          <Button
            onClick={() => {
              const n = schoolStore.triggerBulkWhatsAppBillingAction("all");
              toast.success(`${n} WhatsApp invoices dispatched`, {
                description: "Meta template variable {{2}} injected with AI tone",
              });
            }}
          >
            <Send className="mr-1.5 h-4 w-4" /> Dispatch WhatsApp Invoices
          </Button>
        </div>
      </section>

      {/* Telemetry grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FeedColumn
          title="Outbound · WhatsApp API"
          subtitle="Dispatch status stream"
          icon={<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />}
          events={outbound}
          empty="No outbound dispatches yet."
        />
        <FeedColumn
          title="Inbound · Gateway Webhooks"
          subtitle="1Link / KuickPay / Safepay listeners"
          icon={<ArrowDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
          events={inbound}
          empty="Listening for webhook callbacks…"
          action={
            nextOpen ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  schoolStore.simulateGatewayWebhookSettlement(nextOpen.idempotency_key, "kuickpay");
                  toast.success("Webhook received · status settled", {
                    description: nextOpen.kuickpay_consumer_id,
                  });
                }}
              >
                Simulate webhook
              </Button>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function FeedColumn({
  title,
  subtitle,
  icon,
  events,
  empty,
  action,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  events: { id: string; at: string; label: string; detail: string; ref: string }[];
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-start gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{e.label}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{e.detail}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {e.ref}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 2 — Settled ledger / audit log
 * ------------------------------------------------------------------ */

function LedgerTab() {
  const ledger = useSchoolStore((s) => s.billing_ledger);
  const students = useSchoolStore((s) => s.students);
  const branches = useSchoolStore((s) => s.branches);

  const [branchId, setBranchId] = useState("all");
  const [range, setRange] = useState("30");
  const [gateway, setGateway] = useState("all");

  const rows = useMemo(() => {
    const cutoff = Date.now() - Number(range) * 86400 * 1000;
    return ledger
      .filter((l) => l.status === "settled" || l.status === "processing")
      .filter((l) => (branchId === "all" ? true : l.branch_node_id === branchId))
      .filter((l) => (gateway === "all" ? true : l.payment_method === gateway))
      .filter((l) => (l.settled_at ? new Date(l.settled_at).getTime() >= cutoff : true))
      .sort((a, b) => +new Date(b.settled_at ?? b.due_date) - +new Date(a.settled_at ?? a.due_date));
  }, [ledger, branchId, range, gateway]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-[200px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.node_id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={gateway} onValueChange={setGateway}>
            <SelectTrigger className="w-[170px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gateways</SelectItem>
              <SelectItem value="kuickpay">KuickPay</SelectItem>
              <SelectItem value="safepay">Safepay</SelectItem>
              <SelectItem value="raast">Raast</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => toast.success("CSV export queued", { description: `${rows.length} rows` })}
        >
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3 font-medium">Student &amp; Class</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Invoiced</th>
                <th className="px-5 py-3 font-medium">Liquidated</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Gateway Ref</th>
                <th className="px-5 py-3 font-medium">Settled At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No settlements in this window.
                  </td>
                </tr>
              )}
              {rows.map((l) => {
                const st = students.find((s) => s.id === l.student_id);
                const br = branches.find((b) => b.node_id === l.branch_node_id);
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{st?.name ?? l.student_id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {st ? `${st.className}-${st.section}` : l.billing_period}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{br?.name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono tabular-nums">{fmt(l.invoiced_amount)}</td>
                    <td className="px-5 py-3 font-mono tabular-nums">{fmt(l.liquidated_amount)}</td>
                    <td className="px-5 py-3 text-muted-foreground capitalize">
                      {l.payment_method ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                      {l.idempotency_key}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {l.settled_at ? new Date(l.settled_at).toLocaleString("en-PK") : "Awaiting webhook"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 3 — Counter cash terminal
 * ------------------------------------------------------------------ */

function CashTab() {
  const state = useSchoolStore((s) => s);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const cashLock = useMutationLock();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.parent_phone.includes(q.replace(/\D/g, "")),
      )
      .slice(0, 6);
  }, [query, state.students]);

  const student = selected ? state.students.find((s) => s.id === selected) : null;
  const invoice = useMemo(
    () => (student ? getParentRollupInvoice(student.parent_phone, state) : null),
    [student, state],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Find student</h3>
          <p className="text-xs text-muted-foreground">Search by roll number, name, or parent phone.</p>
        </div>
        <div className="p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDone(null); }}
              placeholder="e.g. 8A-14 or Ali Khan"
              className="pl-9"
            />
          </div>
          <ul className="mt-3 divide-y divide-border">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { setSelected(s.id); setDone(null); }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    selected === s.id ? "bg-slate-50" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {s.className}-{s.section} · Roll {s.rollNo}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {s.rollNo}
                  </span>
                </button>
              </li>
            ))}
            {query && matches.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">No student found.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Cash settlement</h3>
          <p className="text-xs text-muted-foreground">
            Instant ledger settlement · WhatsApp receipt fired automatically.
          </p>
        </div>

        {!student || !invoice ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">
            Select a student to load their family roll-up balance.
          </p>
        ) : (
          <div className="p-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <Row label="Student" value={`${student.name} · ${student.className}-${student.section}`} />
              <Row label="Guardian" value={invoice.parent_name} />
              <Row label="WhatsApp" value={invoice.parent_phone} />
              <Row label="Children billed" value={String(invoice.lines.length)} />
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Roll-up balance
                </span>
                <span className="font-mono text-xl font-semibold tabular-nums tracking-tight">
                  {fmt(invoice.total)}
                </span>
              </div>
            </div>

            <label className="mt-4 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Cash received (PKR)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(invoice.total)}
              className="mt-2 font-mono tabular-nums"
            />

            <Button
              className="mt-4 h-11 w-full text-sm font-semibold"
              disabled={!(Number(amount) > 0) || cashLock.busy}
              onClick={() =>
                cashLock.run("cash_settlement", async (action_idempotency_key) => {
                  const value = Number(amount);
                  const ok = await schoolStore.recordDirectCashSettlement(
                    student.id,
                    value,
                    action_idempotency_key,
                  );
                  if (!ok) return;
                  setDone(`${student.name} · ${fmt(value)}`);
                  setAmount("");
                  toast.success("Cash settlement recorded", {
                    description: "Ledger settled · WhatsApp receipt dispatched",
                  });
                })
              }
            >
              <Banknote className="mr-2 h-4 w-4" />
              {cashLock.busy ? "Posting…" : "Record Cash Settlement"}
            </Button>

            {done && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Settled · {done}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

export type { SchoolLedgerEntry };
