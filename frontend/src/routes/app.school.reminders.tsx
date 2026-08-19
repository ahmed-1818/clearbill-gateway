import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Sparkles,
  Pencil,
  Loader2,
  Info,
  MoonStar,
  RefreshCw,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { SchoolShell, PageHeader } from "@/components/clearbill/school-shell";
import { schoolStore, useSchoolStore } from "@/lib/school-store";
import { rewriteTemplate } from "@/lib/reminder-ai.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/school/reminders")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Reminders · ClearBill School" },
      { name: "description", content: "Automated WhatsApp reminders, templates and response tracking." },
    ],
  }),
  component: RemindersPage,
});

/* ------------------------------ sample data ------------------------------ */

const SAMPLE: Record<string, string> = {
  "{parent_name}": "Kamran Sahab",
  "{student_name}": "Ali Khan",
  "{class}": "Class 8-A",
  "{month}": "July",
  "{due_date}": "10 Jul 2026",
  "{amount}": "13,500",
  "{late_fee}": "700",
};

function render(text: string) {
  return Object.entries(SAMPLE).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    text,
  );
}

type StageKey = "before3" | "onDue" | "after3";

const STAGES: {
  key: StageKey;
  field: "templateBefore" | "templateDue" | "templateAfter";
  label: string;
  tone: string;
  toneClass: string;
}[] = [
  { key: "before3", field: "templateBefore", label: "3 days before due date", tone: "Polite", toneClass: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "onDue", field: "templateDue", label: "On due date", tone: "Standard", toneClass: "bg-blue-50 text-blue-700 ring-blue-200" },
  { key: "after3", field: "templateAfter", label: "3 days after due date", tone: "Escalated", toneClass: "bg-rose-50 text-rose-700 ring-rose-200" },
];

const LAST_RUN: Record<StageKey, { sent: number; delivered: number }> = {
  before3: { sent: 210, delivered: 94 },
  onDue: { sent: 186, delivered: 96 },
  after3: { sent: 74, delivered: 91 },
};

const FUNNEL: Record<StageKey, { sent: number; delivered: number; read: number; paid: number }> = {
  before3: { sent: 210, delivered: 198, read: 154, paid: 61 },
  onDue: { sent: 186, delivered: 179, read: 141, paid: 72 },
  after3: { sent: 74, delivered: 70, read: 58, paid: 33 },
};

const RANGE_STATS: Record<string, { sent: number; responses: number; paid: number }> = {
  month: { sent: 200, responses: 100, paid: 50 },
  d30: { sent: 268, responses: 121, paid: 63 },
  all: { sent: 1840, responses: 812, paid: 402 },
};

/* -------------------------------- page ---------------------------------- */

function RemindersPage() {
  const r = useSchoolStore((s) => s.reminders);
  const branches = useSchoolStore((s) => s.branches);
  const students = useSchoolStore((s) => s.students);
  const academicLevels = useSchoolStore((s) => s.academic_levels);
  const [branchId, setBranchId] = useState("all");
  const [cls, setCls] = useState("all");
  const [confirm, setConfirm] = useState(false);
  const [range, setRange] = useState("month");
  const [editing, setEditing] = useState<StageKey | null>(null);

  const [quietOn, setQuietOn] = useState(true);
  const [quietFrom, setQuietFrom] = useState("21:00");
  const [quietTo, setQuietTo] = useState("08:00");
  const [jummah, setJummah] = useState(true);

  const targets = useMemo(
    () =>
      students.filter((s) => {
        if (branchId !== "all" && s.branchId !== branchId) return false;
        if (cls !== "all" && s.className !== cls) return false;
        return s.status !== "PAID";
      }),
    [students, branchId, cls],
  );

  const unpaidCount = students.filter((s) => s.status !== "PAID").length;
  const stats = RANGE_STATS[range];
  const editingStage = STAGES.find((s) => s.key === editing) ?? null;

  return (
    <SchoolShell>
      <PageHeader eyebrow="Automation" title="WhatsApp Reminders" />

      {/* 1. Summary stats */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Delivery summary</h3>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="d30">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Messages Sent" value={stats.sent} />
          <StatCard
            label="Responses"
            value={stats.responses}
            sub={`${Math.round((stats.responses / stats.sent) * 100)}% response rate`}
          />
          <StatCard
            label="Fees Paid"
            value={stats.paid}
            sub={`${Math.round((stats.paid / stats.sent) * 100)}% conversion`}
            accent="text-emerald-600"
          />
          <StatCard label="Pending" value={unpaidCount} sub="unpaid students" accent="text-rose-600" />
        </div>
      </section>

      {/* 2. Schedule */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Reminder schedule</h3>
        <p className="text-xs text-muted-foreground">Automated messages fire based on each student's due date.</p>
        <div className="mt-4 space-y-3">
          {STAGES.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{row.tone}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Last sent: {LAST_RUN[row.key].sent} msgs · {LAST_RUN[row.key].delivered}% delivered
                </p>
              </div>
              <Switch
                checked={r[row.key]}
                onCheckedChange={(v) => schoolStore.updateReminders({ [row.key]: v } as never)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 3. Template cards */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STAGES.map((s) => (
          <div key={s.key} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${s.toneClass}`}>
                {s.tone}
              </span>
            </div>
            <div className="mt-3">
              <Bubble text={render(r[s.field])} escalated={s.key === "after3"} />
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setEditing(s.key)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit template
            </Button>
          </div>
        ))}
      </section>

      {/* 5. Funnel */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Reminder performance</h3>
        <p className="text-xs text-muted-foreground">Sent → Delivered → Read → Paid, per reminder stage.</p>
        <div className="mt-4 space-y-5">
          {STAGES.map((s) => {
            const f = FUNNEL[s.key];
            const conv = Math.round((f.paid / f.sent) * 100);
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <span className="font-semibold text-emerald-600">{conv}%</span> sent → paid
                  </p>
                </div>
                <div className="mt-2 space-y-1.5">
                  <FunnelBar label="Sent" value={f.sent} total={f.sent} color="bg-slate-300" />
                  <FunnelBar label="Delivered" value={f.delivered} total={f.sent} color="bg-blue-500" />
                  <FunnelBar label="Read" value={f.read} total={f.sent} color="bg-blue-300" />
                  <FunnelBar label="Paid" value={f.paid} total={f.sent} color="bg-emerald-500" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Quiet hours */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MoonStar className="h-4 w-4 text-muted-foreground" /> Quiet hours
            </h3>
            <p className="text-xs text-muted-foreground">
              Reminders scheduled during quiet hours will be queued and sent right after.
            </p>
          </div>
          <Switch checked={quietOn} onCheckedChange={setQuietOn} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">From</Label>
            <Input type="time" value={quietFrom} disabled={!quietOn} onChange={(e) => setQuietFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">To</Label>
            <Input type="time" value={quietTo} disabled={!quietOn} onChange={(e) => setQuietTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
          <p className="text-sm">Pause sending on Fridays 12–2 PM (Jummah)</p>
          <Switch checked={jummah} onCheckedChange={setJummah} />
        </div>
      </section>

      {/* 8. Bulk reminder */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Bulk reminder</h3>
        <p className="text-xs text-muted-foreground">Send an immediate reminder to unpaid parents in scope.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {Array.from(
                new Set(
                  academicLevels
                    .filter((l) => branchId === "all" || l.branch_node_id === branchId)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((l) => l.name),
                ),
              ).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setConfirm(true)} disabled={targets.length === 0}>
            <Send className="mr-1 h-4 w-4" /> Send now ({targets.length})
          </Button>
        </div>
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Send bulk reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send to {targets.length} unpaid parent{targets.length === 1 ? "" : "s"}. Preview a
              sample message below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Bubble text={render(r.templateDue)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toast.success(`Reminder queued to ${targets.length} parents`)}>
              Confirm & send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingStage && (
        <TemplateModal
          key={editingStage.key}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={editingStage.label}
          escalated={editingStage.key === "after3"}
          initial={r[editingStage.field]}
          onSave={(v) => {
            schoolStore.updateReminders({ [editingStage.field]: v } as never);
            setEditing(null);
            toast.success("Template saved");
          }}
        />
      )}
    </SchoolShell>
  );
}

/* ------------------------------ sub-components --------------------------- */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${accent ?? ""}`}>{value.toLocaleString()}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {value} · {pct}%
      </span>
    </div>
  );
}

function Bubble({ text, escalated }: { text: string; escalated?: boolean }) {
  return (
    <div className="rounded-lg bg-[#e5f6d9] p-3">
      <div
        className={`rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-black/5 ${
          escalated ? "border-l-4 border-rose-500" : ""
        }`}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{text}</p>
        <p className="mt-2 text-right text-[10px] text-muted-foreground">10:24 AM · via ClearBill</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Already Paid", "Need Extension", "Talk to Office"].map((q) => (
          <span
            key={q}
            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#0a7cff] shadow-sm ring-1 ring-black/5"
          >
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}

function TemplateModal({
  open,
  onOpenChange,
  title,
  initial,
  escalated,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial: string;
  escalated?: boolean;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const generate = useServerFn(rewriteTemplate);

  const run = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    try {
      const res = await generate({ data: { template: text, instruction: instruction.trim() } });
      setDrafts(res.drafts);
      if (res.drafts.length === 0) toast.error("No drafts returned, try rephrasing.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI rewrite failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit template · {title}</DialogTitle>
          <DialogDescription>
            Tokens are replaced with real student data when each reminder is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[11px]">Template text</Label>
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">
              Tokens: {"{parent_name}"} {"{student_name}"} {"{class}"} {"{month}"} {"{amount}"} {"{due_date}"}{" "}
              {"{late_fee}"}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setAiOpen((v) => !v)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask AI to rewrite
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success("Test message sent to your WhatsApp")}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> Send test to my number
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px]">Live preview</Label>
            <Bubble text={render(text)} escalated={escalated} />
          </div>
        </div>

        {aiOpen && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> AI template assistant
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              AI helps you draft the template. Once saved, the same template is used for all reminders — no live AI
              generation per message.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Describe the tone you want, e.g. firmer but still respectful"
              />
              <Button onClick={run} disabled={loading || !instruction.trim()}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Generate
              </Button>
            </div>

            {drafts.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {drafts.map((d, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Option {i + 1}
                    </p>
                    <div className="mt-2">
                      <Bubble text={render(d)} escalated={escalated} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setText(d);
                          toast.success("Draft applied");
                        }}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Use this
                      </Button>
                      <Button size="sm" variant="outline" onClick={run} disabled={loading}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(text)}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
