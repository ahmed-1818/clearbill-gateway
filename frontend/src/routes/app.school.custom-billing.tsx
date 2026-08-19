import { useMutationLock } from "@/lib/use-mutation-lock";
import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Send,
  Copy,
  Link as LinkIcon,
  CheckCheck,
  Ban,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { SchoolShell, PageHeader } from "@/components/clearbill/school-shell";
import {
  schoolStore,
  useSchoolStore,
  fmt,
  buildBulkChallanPayload,
  type CustomChallan,
} from "@/lib/school-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/school/custom-billing")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Ad-Hoc Challans · ClearBill School" },
      {
        name: "description",
        content:
          "Issue one-off fines, trip fees and penalties as standalone challans with their own gateway IDs and WhatsApp dispatch.",
      },
      { property: "og:title", content: "Ad-Hoc Challans · ClearBill School" },
      {
        property: "og:description",
        content: "Standalone ad-hoc billing, decoupled from recurring tuition.",
      },
    ],
  }),
  component: CustomBillingPage,
});

const STATUS: Record<CustomChallan["status"], { cls: string; dot: string; label: string }> = {
  staged: { cls: "bg-slate-50 text-slate-700 border-slate-200/70", dot: "bg-slate-400", label: "Staged" },
  processing: { cls: "bg-amber-50 text-amber-700 border-amber-200/70", dot: "bg-amber-500", label: "Processing" },
  settled: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200/70", dot: "bg-emerald-500", label: "Settled" },
  cancelled: { cls: "bg-rose-50 text-rose-700 border-rose-200/70", dot: "bg-rose-500", label: "Cancelled" },
};

function StatusPill({ status }: { status: CustomChallan["status"] }) {
  const c = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function CustomBillingPage() {
  const challans = useSchoolStore((s) => s.custom_challans);
  const students = useSchoolStore((s) => s.students);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return challans
      .map((c) => ({ c, st: students.find((s) => s.id === c.student_id) }))
      .filter(({ c, st }) =>
        !term
          ? true
          : `${st?.full_name ?? ""} ${c.title} ${c.id} ${c.kuickpay_consumer_id}`
              .toLowerCase()
              .includes(term),
      );
  }, [challans, students, q]);

  const outstanding = challans
    .filter((c) => c.status === "staged" || c.status === "processing")
    .reduce((a, c) => a + c.amount, 0);
  const settled = challans.filter((c) => c.status === "settled").reduce((a, c) => a + c.amount, 0);

  return (
    <SchoolShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Ad-Hoc Billing"
          title="Custom Challans"
          action={
            <Button className="h-9 rounded-lg" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Issue New Challan
            </Button>
          }
        />

        <p className="max-w-2xl text-sm text-muted-foreground">
          One-off fines, trips and penalties billed independently. Recurring tuition ledgers stay
          mathematically untouched — each challan carries its own consumer ID, checkout link and
          <span className="font-mono text-xs"> ad_hoc_fee_notice</span> dispatch.
        </p>

        {/* Bento metric strip */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Open challans" value={String(challans.filter((c) => c.status !== "settled" && c.status !== "cancelled").length)} />
          <Metric label="Outstanding" value={fmt(outstanding)} tone="text-rose-600" />
          <Metric label="Settled to date" value={fmt(settled)} tone="text-emerald-600" />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search student, challan title or gateway ID…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/80 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Gateway ID</th>
                  <th className="px-4 py-2.5 text-right font-medium">Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, st }) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{st?.full_name ?? c.student_id}</p>
                      <p className="font-mono text-[11px] text-slate-500">{c.parent_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.id} · due {new Date(c.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(c.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                        WA · {c.whatsapp_dispatch_status}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          navigator.clipboard?.writeText(c.kuickpay_consumer_id).catch(() => {});
                          toast.success("Consumer ID copied");
                        }}
                      >
                        {c.kuickpay_consumer_id}
                        <Copy className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to="/app/school/pay/challan/$id"
                          params={{ id: c.id }}
                          className="rounded-lg border border-slate-200/60 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Open checkout link"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                          disabled={c.status === "settled" || c.status === "cancelled"}
                          onClick={async () => {
                            // Pre-flight freshness check happens inside the store.
                            const p = await schoolStore.dispatchChallanWhatsApp(c.id);
                            if (p) toast.success("ad_hoc_fee_notice dispatched", { description: `${p.to} · ${fmt(p.amount)}` });
                          }}
                        >
                          <Send className="h-3 w-3" /> WhatsApp
                        </button>
                        <button
                          className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                          aria-label="Simulate gateway settlement"
                          disabled={c.status === "settled" || c.status === "cancelled"}
                          onClick={() => {
                            schoolStore.settleCustomChallan(c.id, "kuickpay");
                            toast.success("Webhook settlement recorded");
                          }}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-lg border border-slate-200/60 bg-slate-50 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          aria-label="Cancel challan"
                          disabled={c.status === "settled" || c.status === "cancelled"}
                          onClick={() => {
                            schoolStore.cancelCustomChallan(c.id);
                            toast("Challan cancelled");
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                      No challans yet — issue one to bill a one-off fine or trip fee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <IssueChallanDialog open={open} onOpenChange={setOpen} />
      </div>
    </SchoolShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight ${tone ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function IssueChallanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const students = useSchoolStore((s) => s.students);
  const branches = useSchoolStore((s) => s.branches);
  const allLevels = useSchoolStore((s) => s.academic_levels);
  const allSections = useSchoolStore((s) => s.academic_sections);

  const [branchId, setBranchId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [sectionId, setSectionId] = useState("all");
  const [studentQ, setStudentQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const issueLock = useMutationLock();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");

  const levels = useMemo(
    () =>
      allLevels
        .filter((l) => l.branch_node_id === branchId)
        .sort((a, b) => a.order_index - b.order_index),
    [allLevels, branchId],
  );
  const sections = useMemo(
    () => allSections.filter((s) => s.level_id === levelId),
    [allSections, levelId],
  );

  const cohort = useMemo(
    () =>
      levelId
        ? students.filter(
            (s) => s.level_id === levelId && (sectionId === "all" || s.section_id === sectionId),
          )
        : [],
    [students, levelId, sectionId],
  );
  const visible = useMemo(() => {
    const t = studentQ.trim().toLowerCase();
    return t ? cohort.filter((s) => s.full_name.toLowerCase().includes(t)) : cohort;
  }, [cohort, studentQ]);

  const allSelected = cohort.length > 0 && cohort.every((s) => selected.includes(s.id));

  const reset = () => {
    setBranchId("");
    setLevelId("");
    setSectionId("all");
    setStudentQ("");
    setSelected([]);
    setTitle("");
    setAmount("");
    setDue("");
  };


  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Ad-Hoc Challan</DialogTitle>
          <DialogDescription>
            Bill one student or an entire cohort — recurring tuition stays untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step A — cascading Branch → Level → Section */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Branch</Label>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  setLevelId("");
                  setSectionId("all");
                  setSelected([]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.node_id} value={b.node_id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Level</Label>
              <Select
                value={levelId}
                onValueChange={(v) => {
                  setLevelId(v);
                  setSectionId("all");
                  setSelected([]);
                  setStudentQ("");
                }}
                disabled={!branchId}
              >
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Section</Label>
              <Select
                value={sectionId}
                onValueChange={(v) => {
                  setSectionId(v);
                  setSelected([]);
                }}
                disabled={!levelId}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step B — student multi-select */}
          {levelId && (
            <div className="space-y-2 rounded-lg border border-slate-200/70 p-2">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-slate-200/70 px-2">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={studentQ}
                    onChange={(e) => setStudentQ(e.target.value)}
                    placeholder="Search students…"
                    className="w-full bg-transparent py-1.5 text-xs outline-none placeholder:text-slate-400"
                  />
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v ? cohort.map((s) => s.id) : [])}
                  />
                  Select all
                </label>
              </div>

              <ScrollArea className="h-40 pr-2">
                <div className="space-y-0.5">
                  {visible.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) =>
                            setSelected((prev) =>
                              v ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                            )
                          }
                        />
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                          {s.full_name.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {s.full_name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{s.roll_no}</span>
                      </label>
                    );
                  })}
                  {visible.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">No students match.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step C — details */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Museum Field Trip"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2000"
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0 || issueLock.busy}
            onClick={() =>
              issueLock.run("bulk_challan", async (action_idempotency_key) => {
                // ONE aggregated payload for the whole cohort — no fetch() loop.
                const payload = buildBulkChallanPayload({
                  student_ids: selected,
                  title,
                  amount: Number(amount),
                  due_date: due,
                  action_idempotency_key,
                });
                const issued = await schoolStore.issueBulkCustomChallans(
                  payload.student_ids,
                  payload.title,
                  payload.amount,
                  payload.due_date,
                  payload.action_idempotency_key,
                );
                const first = issued[0];
                if (!first) return; // store already surfaced the reason
                toast.success(`${issued.length} challan${issued.length > 1 ? "s" : ""} generated`, {
                  description: `${first.title} · ${fmt(first.amount)} each`,
                });
                reset();
                onOpenChange(false);
              })
            }
          >
            {issueLock.busy
              ? "Issuing…"
              : `Issue Challan to ${selected.length} Student${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
