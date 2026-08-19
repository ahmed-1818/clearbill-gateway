import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { SchoolShell, PageHeader } from "@/components/clearbill/school-shell";
import { schoolStore, useSchoolStore, fmt, type FeeStructure } from "@/lib/school-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/school/fee-structures")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Fee Structures · ClearBill School" },
      { name: "description", content: "Configure tuition, admission, and annual charges per class." },
      { property: "og:title", content: "Fee Structures · ClearBill School" },
      { property: "og:description", content: "Configure tuition, admission, and annual charges per class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeeStructurePage,
});

function Num({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{fmt(value)}</span>;
}

function StackedFee({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 leading-tight">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <Num value={value} className="text-xs" />
    </div>
  );
}

function FeeStructurePage() {
  const rows = useSchoolStore((s) => s.feeStructures);
  const settings = useSchoolStore((s) => s.settings);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.className.toLowerCase().includes(t));
  }, [rows, q]);

  const totals = useMemo(() => {
    const monthly = rows.reduce(
      (a, f) => a + f.tuition + f.transport + (f.extras ?? []).reduce((s, x) => s + x.amount, 0),
      0,
    );
    const annual = rows.reduce((a, f) => a + f.admission + f.exam + f.lab, 0);
    const avgLate = rows.length
      ? Math.round(rows.reduce((a, f) => a + f.lateFee, 0) / rows.length)
      : 0;
    return { monthly, annual, avgLate };
  }, [rows]);

  return (
    <SchoolShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader eyebrow="Configuration" title="Fee Structures" />
        <Button size="sm" className="h-9 shadow-sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create New Fee Structure
        </Button>
      </div>

      {/* Controls + global policies strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.4)]">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search classes…"
              className="h-9 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {filtered.length}/{rows.length}
          </span>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <div className="hidden items-baseline gap-4 sm:flex">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Monthly sum</span>
            <Num value={totals.monthly} className="text-xs" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Annual sum</span>
            <Num value={totals.annual} className="text-xs" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg late</span>
            <Num value={totals.avgLate} className="text-xs" />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.4)]">
          <div className="rounded-lg border border-border bg-muted/50 p-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mr-2">
            <p className="text-xs font-medium leading-tight">Sibling discount</p>
            <p className="text-[11px] text-muted-foreground">
              {settings.defaultSiblingPct}% off younger siblings
            </p>
          </div>
          <Switch
            checked={settings.siblingDiscountOn}
            onCheckedChange={(v) => {
              schoolStore.updateSettings({ siblingDiscountOn: v });
              toast.success(`Sibling discount ${v ? "enabled" : "disabled"}`);
            }}
          />
        </div>
      </div>

      {/* Bento grid of fee structures */}
      {filtered.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border py-14 text-center text-xs text-muted-foreground">
          No matching classes.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => {
            const extras = f.extras ?? [];
            const monthly = f.tuition + f.transport + extras.reduce((a, x) => a + x.amount, 0);
            return (
              <Card
                key={f.id}
                className="overflow-hidden border-border shadow-[inset_0_1px_0_0_hsl(var(--border)/0.4),0_1px_2px_0_rgb(0_0_0/0.04)] transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 border-b border-border py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Node</p>
                    <CardTitle className="text-base leading-tight">{f.className}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(f)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit structure
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          schoolStore.deleteFeeStructure(f.id);
                          toast.success("Structure deleted", { description: f.className });
                        }}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {/* Block A — monthly core */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Monthly recurring
                    </p>
                    <Num value={monthly} className="text-2xl font-semibold" />
                  </div>

                  {/* Block B — breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    <StackedFee label="Tuition" value={f.tuition} />
                    <StackedFee label="Transport" value={f.transport} />
                  </div>

                  {/* Block C — annual */}
                  <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p className="text-[10px] uppercase tracking-widest">Annual / one-time</p>
                    <StackedFee label="Admission" value={f.admission} />
                    <StackedFee label="Exam" value={f.exam} />
                    <StackedFee label="Lab" value={f.lab} />
                  </div>

                  {/* Block D — badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className="rounded-md border-amber-500/20 bg-amber-500/10 font-mono text-[10px] tabular-nums text-amber-600"
                    >
                      Late: Rs. {f.lateFee} · day {f.lateAfterDay}
                    </Badge>
                    {extras.length > 0 && (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-default rounded-md border-primary/20 bg-primary/10 text-[10px] text-primary"
                            >
                              +{extras.length} custom fee{extras.length === 1 ? "" : "s"}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="space-y-1">
                            {extras.map((x) => (
                              <div key={x.id} className="flex items-center justify-between gap-4 text-xs">
                                <span>{x.label}</span>
                                <span className="font-mono tabular-nums">{fmt(x.amount)}</span>
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FeeDialog
        key={editing?.id ?? "new"}
        open={!!editing || creating}
        initial={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </SchoolShell>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Rs.
        </span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pl-10 text-right font-mono tabular-nums"
        />
      </div>
    </div>
  );
}

function FeeDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: FeeStructure | null;
  onClose: () => void;
}) {
  const branches = useSchoolStore((s) => s.branches);
  const allLevels = useSchoolStore((s) => s.academic_levels);

  const initialBranch =
    (initial && allLevels.find((l) => l.id === initial.level_id)?.branch_node_id) ??
    branches[0]?.node_id ??
    "";
  const [branchId, setBranchId] = useState(initialBranch);

  const levels = useMemo(
    () =>
      allLevels
        .filter((l) => l.branch_node_id === branchId)
        .sort((a, b) => a.order_index - b.order_index),
    [allLevels, branchId],
  );

  const [f, setF] = useState<FeeStructure>(
    initial ?? {
      id: crypto.randomUUID(),
      level_id: "",
      className: "",
      tuition: 10000,
      admission: 18000,
      exam: 2000,
      lab: 500,
      transport: 3500,
      lateFee: 500,
      lateAfterDay: 10,
      extras: [],
    },
  );

  const extras = f.extras ?? [];
  const setExtras = (next: typeof extras) => setF({ ...f, extras: next });
  const monthlyTotal = f.tuition + f.transport + extras.reduce((a, x) => a + (x.amount || 0), 0);


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{initial ? "Edit" : "Add"} Fee Structure</DialogTitle>
          <DialogDescription>
            Applies to every student in this class unless overridden.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="core" className="w-full">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="core" className="text-xs">Monthly</TabsTrigger>
              <TabsTrigger value="annual" className="text-xs">Annual</TabsTrigger>
              <TabsTrigger value="penalties" className="text-xs">Penalties</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">Ad-Hoc</TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[45vh] overflow-y-auto px-6 py-5">
            <TabsContent value="core" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Branch (node)</Label>
                  <Select
                    value={branchId}
                    onValueChange={(v) => {
                      setBranchId(v);
                      setF({ ...f, level_id: "", className: "" });
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
                  <Label className="text-xs">Academic level</Label>
                  <Select
                    value={f.level_id}
                    onValueChange={(v) =>
                      setF({
                        ...f,
                        level_id: v,
                        className: levels.find((l) => l.id === v)?.name ?? "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={levels.length ? "Select level" : "No levels yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MoneyInput label="Tuition (monthly)" value={f.tuition} onChange={(n) => setF({ ...f, tuition: n })} />
                <MoneyInput label="Transport (monthly)" value={f.transport} onChange={(n) => setF({ ...f, transport: n })} />
              </div>
            </TabsContent>

            <TabsContent value="annual" className="mt-0 grid grid-cols-2 gap-3">
              <MoneyInput label="Admission" value={f.admission} onChange={(n) => setF({ ...f, admission: n })} />
              <MoneyInput label="Exam" value={f.exam} onChange={(n) => setF({ ...f, exam: n })} />
              <MoneyInput label="Lab" value={f.lab} onChange={(n) => setF({ ...f, lab: n })} />
            </TabsContent>

            <TabsContent value="penalties" className="mt-0 space-y-4">
              <MoneyInput label="Late fee amount" value={f.lateFee} onChange={(n) => setF({ ...f, lateFee: n })} />
              <div className="space-y-2">
                <Label className="text-xs">Grace period — apply after day-of-month</Label>
                <Input
                  type="number"
                  value={f.lateAfterDay}
                  onChange={(e) => setF({ ...f, lateAfterDay: Number(e.target.value) })}
                  className="text-right font-mono tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground">
                  Rs. {f.lateFee} is applied automatically after the {f.lateAfterDay}th.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Add your own heads — fine, swimming, clubs, trips, sports kit, anything.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExtras([...extras, { id: crypto.randomUUID(), label: "", amount: 0 }])}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              {extras.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  No custom charges yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {extras.map((x, i) => (
                    <div key={x.id} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Charge name (e.g. Swimming Club)"
                        value={x.label}
                        onChange={(e) => {
                          const next = [...extras];
                          next[i] = { ...x, label: e.target.value };
                          setExtras(next);
                        }}
                      />
                      <div className="relative w-32">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          Rs.
                        </span>
                        <Input
                          type="number"
                          value={x.amount}
                          className="pl-10 text-right font-mono tabular-nums"
                          onChange={(e) => {
                            const next = [...extras];
                            next[i] = { ...x, amount: Number(e.target.value) };
                            setExtras(next);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setExtras(extras.filter((e) => e.id !== x.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-card px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Total monthly recurring
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">{fmt(monthlyTotal)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!f.level_id}
              onClick={() => {
                const clean = { ...f, extras: extras.filter((x) => x.label.trim()) };
                schoolStore.saveFeeStructure(clean);
                toast.success("Fee structure saved", { description: f.className });
                onClose();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
