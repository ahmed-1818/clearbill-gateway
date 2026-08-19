import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Building2, Coins, TrendingUp, AlertTriangle, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { SchoolShell } from "@/components/clearbill/school-shell";
import {
  useSchoolStore,
  fmt,
  calculateTemporalFriction,
  schoolPolicies,
  schoolStore,
  type SchoolStudent,
} from "@/lib/school-store";

export const Route = createFileRoute("/app/school/overview")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Global Telemetry · ClearBill School" },
      {
        name: "description",
        content:
          "Read-only command center: gross capital, liquidated funds, arrears friction and the critical collection pipeline.",
      },
      { property: "og:title", content: "Global Telemetry · ClearBill School" },
      {
        property: "og:description",
        content:
          "Live institutional telemetry: capital, arrears friction and the critical collection pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

function OverviewPage() {
  const branches = useSchoolStore((s) => s.branches);
  const students = useSchoolStore((s) => s.students);
  const history = useSchoolStore((s) => s.history);
  const policies = useSchoolStore((s) => s.settings.policies);

  /**
   * Global KPIs and the settlement series are SERVER-AGGREGATED. The browser
   * only ever holds a page of ledgers, so summing (or bucketing a chart) here
   * would be wrong once pagination lands — we read `telemetry_kpis` instead.
   */
  const kpis = useSchoolStore((s) => s.telemetry_kpis);
  const loading = kpis.isLoadingTelemetry;
  useEffect(() => {
    void schoolStore.fetchGlobalTelemetry();
  }, [students, history]);

  /** Chart data comes straight off the aggregate — zero client-side math. */
  const series = kpis.collection_velocity_chart;

  const pipeline = useMemo(
    () =>
      students
        .map((s) => ({ s, f: calculateTemporalFriction(s, policies) }))
        .filter((r) => r.f.payable > 0)
        .sort((a, b) => b.f.days_overdue - a.f.days_overdue || b.f.payable - a.f.payable)
        .slice(0, 10),
    [students, policies],
  );


  const dispatch = async (s: SchoolStudent) => {
    // Store runs the pre-flight webhook freshness check before queueing.
    const payload = await schoolPolicies.dispatchPayload(s.id);
    if (!payload) return;
    toast.success(`WhatsApp Payload Queued for ${s.full_name}`);
  };

  return (
    <SchoolShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="flex flex-col gap-6"
      >
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Global Telemetry
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Institution-wide capital, friction and collection pipeline · read-only
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Engine Live
          </span>
        </header>

        {/* TOP — KPI BENTO */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={<Coins size={14} />}
            label="Gross Capital (MTD)"
            value={fmt(kpis.gross_capital)}
            sub="Total invoiced this cycle"
            loading={loading}
          />
          <Kpi
            icon={<TrendingUp size={14} />}
            label="Liquidated"
            value={fmt(kpis.liquidated)}
            sub={`${kpis.collection_velocity}% collection velocity`}
            tone="text-emerald-600"
            loading={loading}
          />
          <Kpi
            icon={<AlertTriangle size={14} />}
            label="Friction / Arrears"
            value={fmt(kpis.arrears)}
            sub={`${pipeline.length} accounts in enforcement`}
            tone="text-rose-500"
            loading={loading}
          />
          <Kpi
            icon={<Building2 size={14} />}
            label="Active Nodes"
            value={String(branches.length)}
            sub={`${students.length} enrolled accounts`}
          />

        </section>

        {/* MIDDLE — COLLECTION VELOCITY */}
        <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Collection Velocity</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Last 30 days · settled capital
            </span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="velocity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  cursor={{ stroke: "#d4d4d8" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmt(v), "Settled"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#velocity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* BOTTOM — CRITICAL ARREARS PIPELINE */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900">Critical Arrears Pipeline</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Sorted by temporal friction
            </span>
          </div>

          <div className="hidden grid-cols-[2fr_1fr_1.1fr_1fr_auto] gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500 md:grid">
            <span>Student</span>
            <span>Location</span>
            <span>Temporal Friction</span>
            <span>Capital Owed</span>
            <span className="text-right">Action</span>
          </div>

          {pipeline.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-zinc-500">
              All accounts current. No enforcement required.
            </p>
          )}

          {pipeline.map(({ s, f }) => {
            const branch = branches.find((b) => b.id === s.branchId);
            const initials = s.full_name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div
                key={s.id}
                className="grid grid-cols-1 items-center gap-3 border-b border-zinc-100 px-5 py-3 transition-colors last:border-0 hover:bg-zinc-50/70 md:grid-cols-[2fr_1fr_1.1fr_1fr_auto] md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {s.full_name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {s.parentName} · {s.className}-{s.section}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                    {branch?.name.split(" ")[0] ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="rounded bg-rose-50 px-2 py-1 font-mono text-[11px] font-semibold text-rose-500">
                    {f.days_overdue} Days Overdue
                  </span>
                </div>
                <div className="font-mono text-sm font-bold tracking-tight text-zinc-900 [font-variant-numeric:tabular-nums]">
                  {fmt(f.payable)}
                </div>
                <div className="md:text-right">
                  <button
                    onClick={() => dispatch(s)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-700"
                  >
                    <MessageCircle size={12} /> Dispatch Payload
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </motion.div>
    </SchoolShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = "text-zinc-900",
  loading = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</p>
      </div>
      {/* Never flash "Rs. 0" while the aggregate is still in flight. */}
      {loading ? (
        <Skeleton className="mt-3 h-8 w-[120px]" />
      ) : (
        <p
          className={`mt-3 font-mono text-2xl font-semibold tracking-tight [font-variant-numeric:tabular-nums] ${tone}`}
        >
          {value}
        </p>
      )}
      {loading ? (
        <Skeleton className="mt-2.5 h-3 w-[90px]" />
      ) : (
        <p className="mt-1.5 text-[11px] text-zinc-500">{sub}</p>
      )}
    </div>
  );
}

