import { useMutationLock } from "@/lib/use-mutation-lock";
import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState } from "react";
import { MoreHorizontal, MessageCircle, UserRound, BadgeCheck, Ban, Plus, Search, PauseCircle } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { GymShell } from "@/components/clearbill/gym-shell";
import { ClientProfile } from "@/components/clearbill/client-profile";
import { HighlightText, formatDate, formatPkr } from "@/components/clearbill/shared";
import { addDays, store, useStore, type GymMember } from "@/lib/clearbill-store";

export const Route = createFileRoute("/app/gym/members")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("gym"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("gym"),
  head: () => ({
    meta: [
      { title: "Members · Gym Hub · ClearBill" },
      { name: "description", content: "Member ledger, search and status controls." },
    ],
  }),
  component: MembersPage,
});

type FilterKey = "ALL" | "PAID" | "UNPAID" | "INACTIVE";

function MembersPage() {
  const members = useStore((s) => s.gymMembers);
  const allPackages = useStore((s) => s.gymPackages);
  const packages = useMemo(() => allPackages.filter((p) => !p.is_archived), [allPackages]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [currentView, setCurrentView] = useState<"table" | "profile">("table");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return members.filter((m) => {
      if (filter !== "ALL" && m.status !== filter) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        m.phone.toLowerCase().includes(term) ||
        m.packageName.toLowerCase().includes(term)
      );
    });
  }, [members, q, filter]);

  const handleViewProfile = useCallback((memberId: string) => {
    setSelectedMemberId(memberId);
    setCurrentView("profile");
  }, []);

  const handleBackToTable = useCallback(() => {
    setSelectedMemberId(null);
    setCurrentView("table");
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
  }, []);

  const handleFilterChange = useCallback((v: string) => {
    setFilter(v as FilterKey);
  }, []);

  if (currentView === "profile" && selectedMemberId) {
    return (
      <GymShell>
        <ClientProfile memberId={selectedMemberId} onBack={handleBackToTable} />
      </GymShell>
    );
  }

  return (
    <GymShell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Member Ledger
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Members</h1>
        </div>
        <AddMemberDialog packages={packages} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 rounded-lg border border-zinc-200/80 bg-zinc-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/10">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by name, phone or package"
            value={q}
            onChange={handleSearchChange}
            className="border-0 bg-transparent pl-9 text-sm shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList className="flex h-auto w-full items-center gap-1 rounded-lg bg-zinc-100/80 p-1 sm:w-auto">
            <TabsTrigger
              value="ALL"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="PAID"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Paid
            </TabsTrigger>
            <TabsTrigger
              value="UNPAID"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Unpaid
            </TabsTrigger>
            <TabsTrigger
              value="INACTIVE"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              Inactive
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <MembersTable rows={filtered} query={q} onViewProfile={handleViewProfile} />
    </GymShell>
  );
}

type MembersTableProps = {
  rows: GymMember[];
  query: string;
  onViewProfile: (memberId: string) => void;
};

const MembersTable = memo(function MembersTable({ rows, query, onViewProfile }: MembersTableProps) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-zinc-200 bg-zinc-50/80 text-left backdrop-blur-sm">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Member</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Phone</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Package</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Expiry</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Status</th>
              <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Chat</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => {
              const initials = m.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("");
              return (
                <tr key={m.id} className="group relative cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors duration-200">
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onViewProfile(m.id)}
                      className="flex items-center gap-2.5 text-left hover:underline"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200/50 bg-zinc-100 text-[9px] font-bold uppercase tracking-tighter text-zinc-600">
                        {initials}
                      </div>
                      <span className="whitespace-nowrap text-sm font-medium text-zinc-900">
                        <HighlightText text={m.name} query={query} />
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] tracking-tight text-zinc-600 whitespace-nowrap [font-variant-numeric:tabular-nums]">
                    <HighlightText text={m.phone} query={query} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <HighlightText text={m.packageName} query={query} />
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] tracking-tight text-zinc-600 whitespace-nowrap [font-variant-numeric:tabular-nums]">
                    {formatDate(m.expiry)}
                  </td>
                  <td className="px-5 py-3">
                    {m.status === "PAID" ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-wide">
                        PAID
                      </span>
                    ) : m.status === "UNPAID" ? (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 uppercase tracking-wide">
                        UNPAID
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 ring-1 ring-inset ring-zinc-500/20 uppercase tracking-wide">
                        INACTIVE
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${m.phone.replace(/\D/g, "")}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        aria-label={`WhatsApp ${m.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-500 opacity-40 group-hover:opacity-100 hover:bg-emerald-100 transition-all duration-300 focus:outline-none focus:ring-0"
                      >
                        <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActions member={m} onViewProfile={onViewProfile} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No members match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});

type RowActionsProps = { member: GymMember; onViewProfile: (memberId: string) => void };

const RowActions = memo(function RowActions({ member, onViewProfile }: RowActionsProps) {
  const cashLock = useMutationLock();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors focus:outline-none focus:ring-0"
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            store.triggerReminder(member.id);
            toast.success("API Request Sent to Meta", {
              description: `WhatsApp reminder queued for ${member.name}`,
            });
          }}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Trigger Auto-Reminder
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onViewProfile(member.id);
          }}
        >
          <UserRound className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={cashLock.busy}
          onSelect={(e) => {
            e.preventDefault();
            void cashLock.run("gym_cash", async (action_idempotency_key) => {
              // Store pre-flights webhook freshness and rolls back on desync.
              const ok = await store.markMemberPaid(member.id, "cash", action_idempotency_key);
              if (ok) toast.success("Marked as Paid", { description: `${member.name} · Cash` });
            });
          }}
        >
          <BadgeCheck className="mr-2 h-4 w-4" />
          {cashLock.busy ? "Posting…" : "Record Cash Payment"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PauseCircle className="mr-2 h-4 w-4" />
            Pause Membership
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {[7, 15, 30].map((d) => (
              <DropdownMenuItem
                key={d}
                onClick={() => {
                  store.accrueSuspension(member.id, d);
                  toast.success("Membership paused", {
                    description: `${member.name} · expiry extended by ${d} days`,
                  });
                }}
              >
                {d} days
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            store.deactivateMember(member.id);
            toast("Member Deactivated", { description: member.name });
          }}
          className="text-destructive focus:text-destructive"
        >
          <Ban className="mr-2 h-4 w-4" />
          Deactivate Member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

function AddMemberDialog({
  packages,
}: {
  packages: { id: string; name: string; fee: number; days: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");

  const selected = packages.find((p) => p.id === packageId);
  const expiry = selected ? addDays(new Date(), selected.days) : null;

  function normalizePhone(phone: string) {
    return phone.replace(/[\s-()]/g, "");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.24)] transition-all duration-200 hover:bg-zinc-800 hover:shadow-[0_4px_8px_rgba(0,0,0,0.12)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Member</DialogTitle>
          <DialogDescription>
            Assign a pre-made package. Expiry is calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Ahmed Raza" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp Number</Label>
            <Input
              placeholder="+92 321 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Package</Label>
            {packages.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                No active packages found. Create a package in Settings first.
              </div>
            ) : (
              <RadioGroup value={packageId} onValueChange={setPackageId} className="gap-2">
                {packages.map((p) => (
                  <label
                    key={p.id}
                    htmlFor={`pkg-${p.id}`}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={p.id} id={`pkg-${p.id}`} />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.days} days</p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatPkr(p.fee)}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>

          <div className="space-y-2">
            <Label>Calculated Expiry Date</Label>
            <Input readOnly value={expiry ? formatDate(expiry.toISOString()) : "—"} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || !expiry}
            onClick={async () => {
              if (!selected || !expiry) return;
              if (name.trim().length < 2) {
                toast.error("Name required");
                return;
              }
              const clean = normalizePhone(phone);
              if (clean.length < 11) {
                toast.error("Invalid phone format", { description: "Use 923XXXXXXXXX" });
                return;
              }
              // Schema gate lives in the store — invalid rows never reach state.
              const res = await store.addGymMember({
                name,
                phone,
                packageId: selected.id,
                packageName: selected.name,
                fee: selected.fee,
                expiry: expiry!.toISOString(),
              });
              if (!res.ok) return;
              toast.success("Member enrolled", {
                description: `${name} · expires ${formatDate(expiry!.toISOString())}`,
              });
              setName("");
              setPhone("");
              setOpen(false);
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
