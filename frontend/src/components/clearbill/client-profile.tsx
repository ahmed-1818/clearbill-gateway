import { memo, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Activity,
  Phone,
  Package as PackageIcon,
  UserPlus,
  UserMinus,
} from "lucide-react";

import { StatusBadge, formatDate, formatPkr, formatRelative } from "@/components/clearbill/shared";
import { useStore } from "@/lib/clearbill-store";

const iconFor = {
  payment: CreditCard,
  whatsapp: MessageCircle,
  system: ShieldCheck,
  status: Activity,
  member_added: UserPlus,
  member_deactivated: UserMinus,
} as const;

type Props = { memberId: string; onBack: () => void };

function ClientProfileImpl({ memberId, onBack }: Props) {
  const member = useStore(useCallback((s) => s.gymMembers.find((m) => m.id === memberId), [memberId]));
  const allActivity = useStore((s) => s.activity);
  const activity = useMemo(
    () => allActivity.filter((a) => a.memberId === memberId),
    [allActivity, memberId],
  );

  if (!member) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm font-semibold">Member not found</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Members
        </button>
      </div>
    );
  }

  const activeStatus = member?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Members
      </button>

      <header className="mt-4 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Client Profile
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {member?.name ?? "—"}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {member?.phone ?? "—"}
            </p>
          </div>
          <div
            className="shrink-0 rounded-md px-4 py-2 text-center"
            style={{
              backgroundColor: activeStatus === "ACTIVE" ? "var(--status-paid-bg)" : "#e2e8f0",
              color: activeStatus === "ACTIVE" ? "var(--status-paid-fg)" : "#475569",
            }}
          >
            <p className="text-[9px] font-medium uppercase tracking-widest opacity-80">Status</p>
            <p className="text-lg font-bold tracking-tight sm:text-xl">{activeStatus}</p>
          </div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Lifetime Value
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {formatPkr(member?.lifetimeValue ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total revenue collected to date</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Current Package
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-lg font-semibold tracking-tight">
                <PackageIcon className="h-4 w-4 shrink-0" /> {member?.packageName ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Expires {member?.expiry ? formatDate(member.expiry) : "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold">{formatPkr(member?.fee ?? 0)}</p>
              <div className="mt-1">
                <StatusBadge status={member?.status ?? "INACTIVE"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight">History Timeline</h2>
          <p className="text-xs text-muted-foreground">Invoices and API communication logs</p>
        </div>
        <ol className="relative px-5 py-5">
          <div className="absolute left-[34px] top-0 h-full w-px bg-border" aria-hidden />
          {activity.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No history recorded yet.
            </li>
          )}
          {activity.map((ev) => {
            const Icon = iconFor[ev.kind];
            return (
              <li key={ev.id} className="relative flex gap-4 py-3">
                <div className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ev.message}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(ev.at)} · {formatRelative(ev.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export const ClientProfile = memo(ClientProfileImpl);
