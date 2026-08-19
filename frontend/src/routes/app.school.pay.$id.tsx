import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  schoolStore,
  useSchoolStore,
  fmt,
  getParentRollupInvoice,
} from "@/lib/school-store";
import { PayShell, BillCard, BillerBox, SecurityFooter } from "@/components/clearbill/pay";

export const Route = createFileRoute("/app/school/pay/$id")({
  head: () => ({
    meta: [
      { title: "Pay Tuition · ClearBill" },
      { name: "description", content: "Secure parent portal for monthly school tuition." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchoolPayPortal,
});

function SchoolPayPortal() {
  const { id } = Route.useParams();
  const state = useSchoolStore((s) => s);
  const [submitted, setSubmitted] = useState(false);

  const student = state.students.find((s) => s.id === id) ?? state.students[0];
  const branch = state.branches.find((b) => b.node_id === student?.node_id);

  const invoice = useMemo(
    () => getParentRollupInvoice(student?.parent_phone ?? "", state),
    [student, state],
  );

  const self = useMemo(
    () => invoice.lines.find((l) => l.student.id === student?.id) ?? invoice.lines[0],
    [invoice, student],
  );

  const siblingCount = invoice.lines.length;

  if (!student) return null;

  return (
    <PayShell brand={state.settings.institution} tag={branch?.name ?? "Campus"}>
      {submitted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-emerald-900">
            Awaiting gateway confirmation
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Your bank's KuickPay/Raast callback settles this ledger automatically — usually within
            minutes. No receipt upload needed.
          </p>

        </div>
      ) : (
        <>
          <BillCard
            rows={[
              ["Guardian", invoice.parent_name],
              ["WhatsApp", invoice.parent_phone],
              ["Branch", branch?.name ?? ""],
              ["Children billed", String(siblingCount)],
            ]}
            due={invoice.total}
            period={self?.student ? `Consolidated · ${siblingCount} ledger${siblingCount === 1 ? "" : "s"}` : "Consolidated"}
          />

          {/* Sibling roll-up breakdown */}
          <div className="mt-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Family roll-up
              </p>
            </div>

            <ul className="mt-3 divide-y divide-border">
              {invoice.lines.map((l) => (
                <li key={l.student.id} className="py-2.5 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {l.student.full_name}
                        {l.student.id === student.id && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            This link
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.student.className}-{l.student.section} · Roll {l.student.roll_no}
                        {l.days_overdue > 0 && ` · ${l.days_overdue}d overdue`}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums">{fmt(l.base)}</span>
                  </div>

                  <div className="mt-1.5 space-y-1 border-l-2 border-border pl-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Base tuition</span>
                      <span className="font-mono tabular-nums">{fmt(l.tuition)}</span>
                    </div>
                  </div>
                </li>

              ))}
            </ul>

            <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <Row label="Gross tuition" value={fmt(invoice.gross)} />

              {invoice.penalties > 0 && (
                <Row
                  label="Late penalties"
                  value={`+ ${fmt(invoice.penalties)}`}
                  tone="text-rose-600"
                />
              )}
              {invoice.discount > 0 && (
                <Row
                  label={`Sibling discount (${invoice.discount_percentage}%)`}
                  value={`− ${fmt(invoice.discount)}`}
                  tone="text-emerald-600"
                />
              )}
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Total payable
                </span>
                <span className="font-mono text-xl font-semibold tabular-nums tracking-tight">
                  {fmt(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          <BillerBox
            consumerId={`${state.settings.integrations.kuickpay.institution_id}-${invoice.parent_phone.slice(-8)}`}
          />

          <Button
            className="mt-5 h-12 w-full rounded-md text-base font-semibold"
            onClick={() => toast.success("Redirecting to Safepay…", { description: fmt(invoice.total) })}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {fmt(invoice.total)} via Safepay
          </Button>

          <Button
            variant="outline"
            className="mt-3 h-12 w-full rounded-md text-sm font-medium"
            onClick={() => {
              schoolStore.markAwaitingGateway(student.id);
              setSubmitted(true);
            }}
          >
            Pay via KuickPay / Raast in your banking app
          </Button>


          <SecurityFooter />
        </>
      )}
    </PayShell>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
