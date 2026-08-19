import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { CreditCard, MessageCircle, ShieldCheck, UserPlus, UserMinus, Activity as ActivityIcon, Check, ArrowDown } from "lucide-react";
import { toast } from "sonner";

import { GymShell } from "@/components/clearbill/gym-shell";
import { getDashboardMetrics, store, useStore } from "@/lib/clearbill-store";

export const Route = createFileRoute("/app/gym/overview")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("gym"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("gym"),
  head: () => ({
    meta: [
      { title: "Overview · Gym Hub · ClearBill" },
      { name: "description", content: "Command center for gym collections and member activity." },
    ],
  }),
  component: GymOverview,
});

const CHASSIS =
  "relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/80 backdrop-blur-md shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-white/60 group";

function GymOverview() {
  const members = useStore((s) => s.gymMembers);
  const activity = useStore((s) => s.activity);
  const packages = useStore((s) => s.gymPackages);

  const metrics = useMemo(
    () => getDashboardMetrics(store.raw()),
    // recompute whenever the underlying relational data changes
    [members, packages],
  );

  /**
   * Headline money comes from the SERVER aggregate, not a browser Σ: with a
   * paginated members table any client-side total would be wrong.
   */
  const telemetry = useStore((s) => s.telemetry_kpis);
  useEffect(() => {
    void store.fetchGlobalTelemetry();
  }, [members, packages]);

  const collected = telemetry.synced_at ? telemetry.collected : metrics.totalCollected;

  // Pending payments values
  const unpaidInvoices = metrics.unpaidCount;
  const totalDueThisMonth = metrics.activeCount;
  const totalUnpaidAmount = metrics.totalUnpaidValue;
  const percentage = metrics.unpaidRatio * 100;
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dash = (CIRC * percentage) / 100;

  const dispatchReminders = () => {
    const count = store.dispatchBulkReminders();
    toast.success("Reminders dispatched", {
      description: `${count} WhatsApp payload${count === 1 ? "" : "s"} queued to Meta API`,
    });
  };

  return (
    <GymShell>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Command Center
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time telemetry across collections, churn and automation.
        </p>
      </div>

      <div className="relative mt-6 rounded-3xl bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)]">
          {/* WIDGET 1 — Revenue Engine */}
          <div className={`${CHASSIS} md:col-span-8 p-6`}>
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                  Total Collected · Last 30 Days
                </p>
              </div>
              <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-950 tabular-nums">
                Rs. {collected.toLocaleString("en-PK")}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                  +12.4%
                </span>
                <span>vs previous 30d window</span>
              </div>
            </div>

            {/* Sparkline */}
            <svg
              viewBox="0 0 400 120"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
            >
              <defs>
                <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,90 C40,80 70,60 110,65 C150,70 180,40 220,35 C260,30 290,55 330,45 C360,38 380,25 400,20 L400,120 L0,120 Z"
                fill="url(#spark-fill)"
              />
              <path
                d="M0,90 C40,80 70,60 110,65 C150,70 180,40 220,35 C260,30 290,55 330,45 C360,38 380,25 400,20"
                fill="none"
                stroke="rgb(34 197 94)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* WIDGET 2 — Pending Payments */}
          <div className={`${CHASSIS} md:col-span-4 p-6 flex flex-col`}>
            {unpaidInvoices === 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <p className="text-[11px] font-bold tracking-widest text-emerald-600 uppercase">
                    STATUS · LEDGER CLEARED
                  </p>
                </div>

                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 border-8 border-emerald-100/50 mx-auto my-4">
                  <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
                </div>

                <p className="text-lg font-semibold text-zinc-900 text-center">100% Collection Rate</p>
                <p className="text-sm text-zinc-500 text-center mt-1">
                  All active members have cleared their dues for this billing cycle.
                </p>

                <button
                  type="button"
                  disabled
                  className="mt-auto w-full py-2.5 rounded-xl font-medium bg-zinc-100 text-zinc-400 cursor-not-allowed"
                >
                  No Reminders Needed
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                  <p className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
                    PENDING · OUTSTANDING DUES
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 origin-center">
                      <circle
                        cx="50"
                        cy="50"
                        r={R}
                        fill="none"
                        stroke="currentColor"
                        className="text-zinc-100"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={R}
                        fill="none"
                        stroke="currentColor"
                        className="text-rose-500"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${CIRC}`}
                        strokeDashoffset={0}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-4xl font-bold tracking-tighter text-zinc-950">{unpaidInvoices}</span>
                        <span className="text-xl font-semibold tracking-tight text-zinc-400">/{totalDueThisMonth}</span>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-zinc-900 leading-tight">Unpaid Invoices</p>
                    <p className="text-sm text-zinc-500 mt-1 leading-snug">
                      {"\n"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-rose-50/60 border border-rose-100/80 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <ArrowDown className="h-5 w-5 shrink-0 text-rose-500" strokeWidth={2.5} />
                    <span className="text-xs font-medium text-rose-600 uppercase tracking-wide leading-tight">Total Unpaid<br/>Value</span>
                  </div>
                  <span className="text-base font-bold tracking-tight text-rose-950">
                    Rs. {totalUnpaidAmount.toLocaleString("en-PK")}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={dispatchReminders}
                  className="mt-4 w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-white/10 transition-transform active:scale-[0.98] hover:bg-zinc-800"
                >
                  Dispatch Reminders
                </button>
              </>
            )}
          </div>

          {/* WIDGET 3 — Intelligent Daily Summary */}
          <div className={`${CHASSIS} md:col-span-12 p-6`}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                Recent Activity
              </h2>
            </div>

            <div className="relative mt-4 pl-6 pb-4 [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] before:absolute before:top-2 before:bottom-0 before:left-[11px] before:w-px before:bg-zinc-200">
              {activity.length === 0 && (
                <p className="pl-8 text-sm text-zinc-500">No recent activity yet.</p>
              )}
              {activity.map((ev) => {
                const cfg = eventStyle(ev.kind);
                const Icon = cfg.Icon;
                return (
                  <div key={ev.id} className="relative mb-6 pl-8 group transition-transform duration-300 group-hover:translate-x-1">
                    <div className={`absolute -left-[17px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${cfg.bg} ${cfg.fg}`}>
                      <Icon size={12} />
                    </div>
                    <p className={cfg.text}>{ev.message}</p>
                    <p className="text-[11px] font-semibold tracking-wider text-zinc-400 mt-1 uppercase">{formatTimeAgo(ev.at)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </GymShell>
  );
}

function eventStyle(kind: string) {
  switch (kind) {
    case "payment":
      return { Icon: CreditCard, bg: "bg-emerald-100", fg: "text-emerald-600", text: "text-sm font-medium text-zinc-900" };
    case "whatsapp":
      return { Icon: MessageCircle, bg: "bg-indigo-100", fg: "text-indigo-600", text: "text-sm text-zinc-700" };
    case "member_added":
      return { Icon: UserPlus, bg: "bg-blue-100", fg: "text-blue-600", text: "text-sm font-medium text-zinc-900" };
    case "member_deactivated":
      return { Icon: UserMinus, bg: "bg-orange-100", fg: "text-orange-600", text: "text-sm text-zinc-700" };
    case "status":
      return { Icon: ActivityIcon, bg: "bg-zinc-100", fg: "text-zinc-600", text: "text-sm text-zinc-700" };
    case "system":
    default:
      return { Icon: ShieldCheck, bg: "bg-zinc-100", fg: "text-zinc-600", text: "text-sm text-zinc-700" };
  }
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(diff / 60000));
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  return `${d}D AGO`;
}
