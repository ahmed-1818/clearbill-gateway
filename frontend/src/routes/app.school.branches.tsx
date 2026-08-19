import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Building2, Download, MessageCircle, MapPin, Phone, X, Layers } from "lucide-react";
import { toast } from "sonner";

import { SchoolShell } from "@/components/clearbill/school-shell";
import { schoolStore, useSchoolStore, type Branch } from "@/lib/school-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/app/school/branches")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Branches · ClearBill School" },
      { name: "description", content: "Manage every campus in your institution with a clean overview of collected revenue and outstanding arrears." },
    ],
  }),
  component: BranchesPage,
});

function fmtPkrShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-PK");
}

function fmtPkr(n: number) {
  return "Rs. " + n.toLocaleString("en-PK");
}

function BranchesPage() {
  const branches = useSchoolStore((s) => s.branches);
  const students = useSchoolStore((s) => s.students);
  const history = useSchoolStore((s) => s.history);

  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId],
  );

  return (
    <SchoolShell>
      <div className="-mx-4 -my-6 min-h-screen bg-slate-50/50 px-4 py-6 sm:-mx-8 sm:-my-8 sm:px-8 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Network / Campuses
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Campus Directory
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              A clean overview of every registered branch in your institution.
            </p>
          </div>
          <AddBranch />
        </div>

        {/* Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((b, i) => {
            const rows = students.filter((s) => s.branchId === b.id);
            const collected = history
              .filter((h) => h.branchId === b.id)
              .reduce((acc, h) => acc + h.amount, 0);
            const pending = rows.reduce(
              (acc, s) => acc + (s.status !== "PAID" ? s.monthlyFee + s.arrears : s.arrears),
              0,
            );
            const paidCount = rows.filter((s) => s.status === "PAID").length;
            const rate = rows.length ? Math.round((paidCount / rows.length) * 100) : 0;

            return (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Active
                    </div>
                    <p className="mt-1 truncate text-xl font-bold text-slate-950">{b.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {rows.length} Active {rows.length === 1 ? "Account" : "Accounts"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {b.address}
                    </p>
                  </div>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>

                {/* Metrics */}
                <div className="my-4 grid grid-cols-2 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="pr-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Collected
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600">
                      {fmtPkrShort(collected)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">PKR • MTD</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Pending
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-600">
                      {fmtPkrShort(pending)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">PKR • Arrears</p>
                  </div>
                </div>

                {/* Rate */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">Collection Rate</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900">
                      {rate}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveBranchId(b.id);
                    setActiveIndex(i);
                  }}
                  className="mt-5 w-full rounded-xl border border-slate-200 py-3 text-xs font-medium uppercase tracking-wider text-slate-800 transition-colors hover:bg-slate-100"
                >
                  Manage Campus
                </button>
              </div>
            );
          })}
        </div>

        {/* Drawer */}
        <NodeConfigSheet
          branch={activeBranch}
          index={activeIndex}
          onClose={() => setActiveBranchId(null)}
        />
      </div>
    </SchoolShell>
  );
}


function NodeConfigSheet({
  branch,
  index: _index,
  onClose,
}: {
  branch: Branch | null;
  index: number;
  onClose: () => void;
}) {
  const students = useSchoolStore((s) => s.students);
  const history = useSchoolStore((s) => s.history);

  const rows = branch ? students.filter((s) => s.branchId === branch.id) : [];
  const collected = branch
    ? history.filter((h) => h.branchId === branch.id).reduce((a, h) => a + h.amount, 0)
    : 0;
  const pending = rows.reduce(
    (acc, s) => acc + (s.status !== "PAID" ? s.monthlyFee + s.arrears : s.arrears),
    0,
  );
  const total = collected + pending;

  const exportCsv = () => {
    if (!branch) return;
    const headers = ["Name", "Class", "Section", "Parent", "Phone", "Monthly", "Arrears", "Status"];
    const lines = rows.map((s) =>
      [s.name, s.className, s.section, s.parentName, s.parentPhone, s.monthlyFee, s.arrears, s.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${branch.name.replace(/\s+/g, "_")}_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported", { description: `${rows.length} accounts` });
  };

  return (
    <Sheet open={!!branch} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[700px]"
      >
        {branch && (
          <>
            <SheetHeader className="space-y-3 border-b border-slate-200 px-6 py-5 pr-14">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-lg font-semibold text-slate-950">
                  {branch.name} — Branch Overview
                </SheetTitle>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {branch.address}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {branch.adminPhone}
                </span>
                <span>{rows.length} Active {rows.length === 1 ? "Account" : "Accounts"}</span>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {/* Summary */}
              <section className="px-6 pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Financial Overview
                  </p>
                  <span className="text-[10px] text-slate-400">MTD · Auto-synced</span>
                </div>
                <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Total Billed
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-slate-900">
                      {fmtPkrShort(total)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Combined balance</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Collected
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-emerald-600">
                      {fmtPkrShort(collected)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Collected revenue</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Pending
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-rose-600">
                      {fmtPkrShort(pending)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Outstanding arrears</p>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="mx-6 mt-6 border-t border-dashed border-slate-200" />

              {/* Academic Structure */}
              <section className="px-6 pt-6">
                <AcademicStructure branchNodeId={branch.node_id} />
              </section>

              {/* Divider */}
              <div className="mx-6 mt-6 border-t border-dashed border-slate-200" />


              {/* Sub-ledger */}
              <section className="px-6 py-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Student Ledger · {rows.length} {rows.length === 1 ? "Account" : "Accounts"}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {rows.filter((s) => s.status !== "PAID").length} pending
                  </span>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-2.5">Student</th>
                        <th className="px-4 py-2.5">Class</th>
                        <th className="px-4 py-2.5 text-right">Due</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((s) => {
                        const due = s.status !== "PAID" ? s.monthlyFee + s.arrears : 0;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5">
                              <p className="truncate font-medium text-slate-900">{s.name}</p>
                              <p className="truncate text-xs text-slate-500">{s.parentName}</p>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {s.className} · {s.section}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                              {due ? fmtPkr(due) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <StatusPill status={s.status} />
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                            No students enrolled at this campus yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={exportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={() =>
                  toast.success("Blast dispatched", { description: `${rows.length} parents notified` })
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <MessageCircle className="h-4 w-4" />
                Dispatch WhatsApp Blast
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}


function AcademicStructure({ branchNodeId }: { branchNodeId: string }) {
  const allLevels = useSchoolStore((s) => s.academic_levels);
  const allSections = useSchoolStore((s) => s.academic_sections);
  const [levelName, setLevelName] = useState("");
  const [sectionDraft, setSectionDraft] = useState<Record<string, string>>({});

  const sections = allSections ?? [];
  const sorted = useMemo(
    () =>
      (allLevels ?? [])
        .filter((l) => l.branch_node_id === branchNodeId)
        .sort((a, b) => a.order_index - b.order_index),
    [allLevels, branchNodeId],
  );


  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Academic Structure
        </p>
        <span className="text-[10px] text-slate-400">
          {sorted.length} {sorted.length === 1 ? "level" : "levels"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={levelName}
          onChange={(e) => setLevelName(e.target.value)}
          placeholder="Add level (e.g. Class 8, O-Levels)"
          className="h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && levelName.trim()) {
              schoolStore.addAcademicLevel(branchNodeId, levelName);
              setLevelName("");
            }
          }}
        />
        <Button
          size="sm"
          className="h-9"
          onClick={() => {
            if (!levelName.trim()) return;
            const created = schoolStore.addAcademicLevel(branchNodeId, levelName);
            if (!created) return toast.error("That level already exists.");
            setLevelName("");
            toast.success("Level added", { description: created.name });
          }}
        >
          <Plus className="h-4 w-4" /> Level
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {sorted.map((lv) => {
          const secs = sections.filter((s) => s.level_id === lv.id);
          const draft = sectionDraft[lv.id] ?? "";
          return (
            <div key={lv.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Layers className="h-3.5 w-3.5 text-slate-400" /> {lv.name}
                </p>
                <button
                  onClick={() => {
                    schoolStore.deleteAcademicLevel(lv.id);
                    toast.success("Level removed", { description: lv.name });
                  }}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Delete ${lv.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {secs.map((sc) => (
                  <span
                    key={sc.id}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {sc.name}
                    <button
                      onClick={() => schoolStore.deleteAcademicSection(sc.id)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Delete section ${sc.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {secs.length === 0 && (
                  <span className="text-[11px] text-slate-400">No sections yet</span>
                )}
                <input
                  value={draft}
                  onChange={(e) => setSectionDraft((p) => ({ ...p, [lv.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !draft.trim()) return;
                    const created = schoolStore.addAcademicSection(lv.id, draft);
                    if (!created) toast.error("Section already exists.");
                    setSectionDraft((p) => ({ ...p, [lv.id]: "" }));
                  }}
                  placeholder="+ section"
                  className="w-24 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
            No academic levels configured for this campus yet.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "PAID" | "UNPAID" | "PARTIAL" | "PENDING" }) {
  const cfg = {
    PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    UNPAID: "bg-rose-50 text-rose-700 ring-rose-200",
    PARTIAL: "bg-amber-50 text-amber-700 ring-amber-200",
    PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  }[status];
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${cfg}`}
    >
      {status}
    </span>
  );
}

function AddBranch() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 sm:self-auto">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Initialize New Branch
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initialize new branch</DialogTitle>
          <DialogDescription>Register a new campus node under the institution.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Branch name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gulberg Campus" />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Blvd, Gulberg III, Lahore" />
          </div>
          <div className="space-y-2">
            <Label>Admin WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 321 1234567" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!name || !address || !phone) return toast.error("Fill every field.");
              schoolStore.addBranch({ name, address, adminPhone: phone });
              toast.success("Node initialized", { description: name });
              setName(""); setAddress(""); setPhone(""); setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
