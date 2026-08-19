import { useMutationLock } from "@/lib/use-mutation-lock";
import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  MoreHorizontal,
  Wallet,
  ScrollText,
  ReceiptText,
  Ban,
  RotateCcw,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { SchoolShell } from "@/components/clearbill/school-shell";
import { HighlightText } from "@/components/clearbill/shared";
import {
  schoolStore,
  useSchoolStore,
  fmt,
  normalizePhone,
  getStudentArrears,
  type SchoolStudent,
  type SchoolLedgerEntry,
} from "@/lib/school-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export const Route = createFileRoute("/app/school/students")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Students · ClearBill School" },
      {
        name: "description",
        content:
          "High-density student directory with live dues, ledger history and state-aware settlement controls.",
      },
      { property: "og:title", content: "Students · ClearBill School" },
      {
        property: "og:description",
        content: "Search, filter and settle student ledgers across every campus node.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentsPage,
});

type StatusKey = "ALL" | "UNPAID" | "PAID";

const HEAD =
  "px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500 whitespace-nowrap";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function StatusBadge({ label, tone }: { label: string; tone: "paid" | "unpaid" | "muted" }) {
  const cls =
    tone === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : tone === "unpaid"
        ? "bg-rose-50 text-rose-700 ring-rose-600/20"
        : "bg-zinc-100 text-zinc-500 ring-zinc-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function StudentsPage() {
  const branches = useSchoolStore((s) => s.branches);
  const students = useSchoolStore((s) => s.students);
  const ledger = useSchoolStore((s) => s.billing_ledger);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusKey>("ALL");
  const [branchId, setBranchId] = useState("all");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [cashFor, setCashFor] = useState<string | null>(null);
  const [suspendFor, setSuspendFor] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .map((s) => {
        const dues = Math.max(0, getStudentArrears(s));
        const openCycle = ledger
          .filter((l) => l.student_id === s.id && l.status !== "settled")
          .sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date))[0] as
          | SchoolLedgerEntry
          | undefined;
        return { s, dues, openCycle };
      })
      .filter(({ s, dues }) => {
        if (branchId !== "all" && s.node_id !== branchId) return false;
        if (status === "PAID" && dues > 0) return false;
        if (status === "UNPAID" && dues <= 0) return false;
        if (!q) return true;
        return [s.full_name, s.parent_phone, s.roll_no, s.parentName]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [students, ledger, branchId, status, query]);

  const activeStudent = historyId ? students.find((s) => s.id === historyId) ?? null : null;
  const cashStudent = cashFor ? students.find((s) => s.id === cashFor) ?? null : null;
  const suspendStudent = suspendFor ? students.find((s) => s.id === suspendFor) ?? null : null;

  const totalDues = rows.reduce((a, r) => a + r.dues, 0);

  return (
    <SchoolShell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Ledger / Students
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"} in view ·{" "}
            <span className="font-mono [font-variant-numeric:tabular-nums]">{fmt(totalDues)}</span>{" "}
            outstanding
          </p>
        </div>
        <AddStudent />
      </div>

      {/* Filtering engine */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 rounded-lg border border-zinc-200/80 bg-zinc-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/10">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by student name, parent phone or roll no"
            className="border-0 bg-transparent pl-9 pr-9 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
          <TabsList className="flex h-auto w-full items-center gap-1 rounded-lg bg-zinc-100/80 p-1 sm:w-auto">
            {(
              [
                ["ALL", "All"],
                ["UNPAID", "Unpaid"],
                ["PAID", "Paid"],
              ] as const
            ).map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="h-9 w-full rounded-lg border-zinc-200/80 bg-white text-sm lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.node_id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data grid */}
      <section className="mt-6 rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-left backdrop-blur-sm">
                <th className={HEAD}>Student</th>
                <th className={HEAD}>Grade &amp; Branch</th>
                <th className={HEAD}>Parent (Roll-Up Key)</th>
                <th className={`${HEAD} text-right`}>Current Dues</th>
                <th className={HEAD}>Status</th>
                <th className={`${HEAD} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No students match your filters.
                  </td>
                </tr>
              )}
              {rows.map(({ s, dues, openCycle }) => {
                const branch = branches.find((b) => b.node_id === s.node_id);
                const suspended = s.lifecycle_status === "suspended";
                return (
                  <tr
                    key={s.id}
                    className="group transition-colors duration-200 hover:bg-zinc-50/60"
                  >
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setHistoryId(s.id)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200/60 bg-zinc-100 text-[9px] font-bold uppercase tracking-tighter text-zinc-600">
                          {initialsOf(s.full_name)}
                        </div>
                        <div>
                          <p className="whitespace-nowrap text-sm font-medium text-zinc-900 group-hover:underline">
                            <HighlightText text={s.full_name} query={query} />
                          </p>
                          <p className="font-mono text-[11px] text-zinc-500 [font-variant-numeric:tabular-nums]">
                            <HighlightText text={s.roll_no} query={query} />
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-sm text-zinc-800">
                        {s.className} · {s.section}
                      </p>
                      <p className="text-[11px] text-zinc-500">{branch?.name ?? s.node_id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-[11px] tracking-tight text-zinc-700 [font-variant-numeric:tabular-nums]">
                        <HighlightText text={s.parent_phone} query={query} />
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        <HighlightText text={s.parentName} query={query} />
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`font-mono text-[13px] font-semibold [font-variant-numeric:tabular-nums] ${
                          dues > 0 ? "text-rose-600" : "text-zinc-400"
                        }`}
                      >
                        {dues > 0 ? fmt(dues) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {suspended ? (
                        <StatusBadge label="Suspended" tone="muted" />
                      ) : dues > 0 ? (
                        <StatusBadge label="Unpaid" tone="unpaid" />
                      ) : (
                        <StatusBadge label="Paid" tone="paid" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowActions
                        student={s}
                        dues={dues}
                        cycleSettled={!openCycle}
                        onLedger={() => setHistoryId(s.id)}
                        onCash={() => setCashFor(s.id)}
                        onSuspend={() => setSuspendFor(s.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <LedgerSheet
        student={activeStudent}
        open={!!historyId}
        onClose={() => setHistoryId(null)}
      />

      <CashDialog student={cashStudent} onClose={() => setCashFor(null)} />

      <AlertDialog open={!!suspendFor} onOpenChange={(v) => !v && setSuspendFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendStudent?.lifecycle_status === "suspended" ? "Reinstate" : "Suspend"}{" "}
              {suspendStudent?.full_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendStudent?.lifecycle_status === "suspended"
                ? "The student re-enters monthly billing runs and automated WhatsApp dispatch."
                : "Suspended students are excluded from monthly billing runs and reminder dispatch. Existing dues remain on the ledger."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!suspendStudent) return;
                const next =
                  suspendStudent.lifecycle_status === "suspended" ? "enrolled" : "suspended";
                schoolStore.setStudentLifecycle(suspendStudent.id, next);
                toast.success(
                  next === "suspended" ? "Student suspended" : "Student reinstated",
                  { description: suspendStudent.full_name },
                );
                setSuspendFor(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SchoolShell>
  );
}

/* ------------------------------- Row actions ------------------------------ */

function RowActions({
  student,
  dues,
  cycleSettled,
  onLedger,
  onCash,
  onSuspend,
}: {
  student: SchoolStudent;
  dues: number;
  cycleSettled: boolean;
  onLedger: () => void;
  onCash: () => void;
  onSuspend: () => void;
}) {
  const cashDisabled = dues <= 0 || cycleSettled;
  const suspended = student.lifecycle_status === "suspended";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none"
          aria-label={`Actions for ${student.full_name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate">{student.full_name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {dues > 0 ? fmt(dues) : "SETTLED"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cashDisabled} onClick={() => !cashDisabled && onCash()}>
          <Wallet className="mr-2 h-4 w-4" />
          Record Cash Settlement
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLedger();
          }}
        >
          <ScrollText className="mr-2 h-4 w-4" />
          View Ledger / Profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/school/custom-billing">
            <ReceiptText className="mr-2 h-4 w-4" />
            Issue Custom Challan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            window.open(
              `https://wa.me/${student.parent_phone.replace(/\D/g, "")}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Message Parent
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={suspended ? undefined : "text-destructive focus:text-destructive"}
          onSelect={(e) => {
            e.preventDefault();
            onSuspend();
          }}
        >
          {suspended ? (
            <RotateCcw className="mr-2 h-4 w-4" />
          ) : (
            <Ban className="mr-2 h-4 w-4" />
          )}
          {suspended ? "Reinstate Student" : "Suspend Student"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------ Ledger sheet ------------------------------ */

function LedgerSheet({
  student,
  open,
  onClose,
}: {
  student: SchoolStudent | null;
  open: boolean;
  onClose: () => void;
}) {
  const dues = student ? Math.max(0, getStudentArrears(student)) : 0;
  const history = [...(student?.ledger_history ?? [])].sort(
    (a, b) => +new Date(b.due_date) - +new Date(a.due_date),
  );
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pr-14">
          <SheetTitle>{student?.full_name}</SheetTitle>
          <SheetDescription>
            {student?.className} · {student?.section} · Roll {student?.roll_no}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-6 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-zinc-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Current dues
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-zinc-900 [font-variant-numeric:tabular-nums]">
                {fmt(dues)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-zinc-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Monthly fee
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-zinc-900 [font-variant-numeric:tabular-nums]">
                {fmt(student?.monthlyFee ?? 0)}
              </p>
            </div>
          </div>
          <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Recurring ledger history
          </p>
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No billing cycles recorded yet.</p>
          )}
          {history.map((l) => {
            const owed = l.invoiced_amount - l.liquidated_amount;
            return (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{l.billing_month}</p>
                  <p className="font-mono text-[11px] text-zinc-500 [font-variant-numeric:tabular-nums]">
                    {fmt(l.liquidated_amount)} / {fmt(l.invoiced_amount)} · {l.payment_method}
                  </p>
                </div>
                <StatusBadge
                  label={owed <= 0 ? "Settled" : l.status}
                  tone={owed <= 0 ? "paid" : "unpaid"}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------ Cash dialog ------------------------------- */

function CashDialog({ student, onClose }: { student: SchoolStudent | null; onClose: () => void }) {
  const dues = student ? Math.max(0, getStudentArrears(student)) : 0;
  const [amount, setAmount] = useState<string>("");
  const value = Number(amount || dues);
  const cashLock = useMutationLock();

  return (
    <Dialog
      open={!!student}
      onOpenChange={(v) => {
        if (!v) {
          setAmount("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record cash settlement</DialogTitle>
          <DialogDescription>
            Counter cash for {student?.full_name} · outstanding {fmt(dues)}. A WhatsApp receipt is
            dispatched instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Amount received (Rs)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={amount}
            placeholder={String(dues)}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Partial amounts are supported — the balance stays as Udhaar on the ledger.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={cashLock.busy}
            onClick={() =>
              cashLock.run("cash_settlement", async (action_idempotency_key) => {
                if (!student) return;
                if (!(value > 0)) return void toast.error("Enter a valid amount.");
                const posted = Math.min(value, dues);
                const ok = await schoolStore.recordDirectCashSettlement(
                  student.id,
                  posted,
                  action_idempotency_key,
                );
                if (!ok) return;
                toast.success("Cash settlement recorded", {
                  description: `${student.full_name} · ${fmt(posted)}`,
                });
                setAmount("");
                onClose();
              })
            }
          >
            {cashLock.busy ? "Posting…" : "Settle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Add student ------------------------------ */

function AddStudent() {
  const [open, setOpen] = useState(false);
  const branches = useSchoolStore((s) => s.branches);
  const structs = useSchoolStore((s) => s.feeStructures);
  const allLevels = useSchoolStore((s) => s.academic_levels);
  const allSections = useSchoolStore((s) => s.academic_sections);
  const [name, setName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  const levels = useMemo(
    () =>
      allLevels
        .filter((l) => l.branch_node_id === branchId)
        .sort((a, b) => a.order_index - b.order_index),
    [allLevels, branchId],
  );
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const sections = useMemo(
    () => allSections.filter((s) => s.level_id === levelId),
    [allSections, levelId],
  );
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");

  const cls = allLevels.find((l) => l.id === levelId)?.name ?? "";
  const section = allSections.find((s) => s.id === sectionId)?.name ?? "";
  const [roll, setRoll] = useState("");
  const structFee = structs.find((f) => f.className === cls)?.tuition ?? 10000;
  const [fee, setFee] = useState<number>(structFee);
  const [custom, setCustom] = useState(false);


  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setFee(structFee);
          setCustom(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="self-start gap-2 sm:self-auto">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll Student</DialogTitle>
          <DialogDescription>Add a student to the monthly tuition ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Student name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Khan" />
            </div>
            <div className="space-y-2">
              <Label>Roll no</Label>
              <Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="8A-14" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parent name</Label>
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Kamran Khan"
              />
            </div>
            <div className="space-y-2">
              <Label>Parent WhatsApp</Label>
              <Input
                value={phone}
                inputMode="numeric"
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                placeholder="923211234567"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Relational key for sibling roll-ups · forced to 923XXXXXXXXX
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  setLevelId("");
                  setSectionId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select
                value={levelId}
                onValueChange={(v) => {
                  setLevelId(v);
                  setSectionId("");
                  const nm = allLevels.find((l) => l.id === v)?.name;
                  const nf = structs.find((f) => f.className === nm)?.tuition ?? 10000;
                  if (!custom) setFee(nf);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={levels.length ? "Select level" : "No levels"} />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId} disabled={!levelId}>
                <SelectTrigger>
                  <SelectValue placeholder={levelId ? "Select section" : "Pick level"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Section {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Monthly tuition (Rs)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Default from fee structure for {cls || "—"}: {fmt(structFee)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Custom (sibling)</span>
                <Switch
                  checked={custom}
                  onCheckedChange={(v) => {
                    setCustom(v);
                    if (!v) setFee(structFee);
                  }}
                />
              </div>
            </div>

            <Input
              type="number"
              className="mt-2"
              value={fee}
              disabled={!custom}
              onChange={(e) => setFee(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const clean = normalizePhone(phone);
              if (!name || !parentName || !phone || !roll) return toast.error("Fill every field.");
              if (!levelId || !sectionId) return toast.error("Select a level and section.");
              if (clean.length !== 12)
                return toast.error("Parent phone must be 923XXXXXXXXX (12 digits).");
              const result = schoolStore.addStudent({
                name,
                parentName,
                parentPhone: clean,
                branchId,
                className: cls,
                section,
                rollNo: roll,
                monthlyFee: fee,
                customFee: custom,
                admissionDate: new Date().toISOString().slice(0, 10),
                arrears: 0,
              });
              if (!result.ok) return toast.error(result.error);
              toast.success("Student enrolled", { description: name });
              setName("");
              setParentName("");
              setPhone("");
              setRoll("");
              setOpen(false);
            }}
          >
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
