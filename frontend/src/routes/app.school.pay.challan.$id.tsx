import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, CheckCircle2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { schoolStore, useSchoolStore, fmt } from "@/lib/school-store";
import { PayShell, BillCard, BillerBox, SecurityFooter } from "@/components/clearbill/pay";

export const Route = createFileRoute("/app/school/pay/challan/$id")({
  head: () => ({
    meta: [
      { title: "Pay Challan · ClearBill" },
      { name: "description", content: "Secure checkout for a one-off school challan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChallanPayPortal,
});

function ChallanPayPortal() {
  const { id } = Route.useParams();
  const state = useSchoolStore((s) => s);
  const [submitted, setSubmitted] = useState(false);

  const challan = state.custom_challans.find((c) => c.id === id);
  const student = state.students.find((s) => s.id === challan?.student_id);
  const branch = state.branches.find((b) => b.node_id === student?.node_id);

  if (!challan || !student) {
    return (
      <PayShell brand={state.settings.institution} tag="Ad-Hoc Challan">
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          This challan link is no longer valid.
        </div>
      </PayShell>
    );
  }

  const settled = challan.status === "settled";

  return (
    <PayShell brand={state.settings.institution} tag={branch?.name ?? "Campus"}>
      {settled || submitted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-emerald-900">
            {settled ? "Challan settled" : "Awaiting gateway confirmation"}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Reference {challan.id} · {fmt(challan.amount)}. Settlement posts automatically via the
            KuickPay/Raast callback — no receipt upload needed.
          </p>
        </div>
      ) : (
        <>
          <BillCard
            rows={[
              ["Student", student.full_name],
              ["Class", `${student.className}-${student.section}`],
              ["Branch", branch?.name ?? ""],
              ["Challan", challan.id],
            ]}
            due={challan.amount}
            period={`One-off charge · due ${new Date(challan.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
          />

          <div className="mt-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Charge detail
              </p>
            </div>
            <div className="mt-3 flex items-start justify-between border-t border-border pt-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{challan.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  Issued {new Date(challan.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums">{fmt(challan.amount)}</span>
            </div>
            <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              This challan is billed separately from monthly tuition. Paying it does not affect your
              regular fee invoice.
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Total payable
              </span>
              <span className="font-mono text-xl font-semibold tabular-nums tracking-tight">
                {fmt(challan.amount)}
              </span>
            </div>
          </div>

          <BillerBox consumerId={challan.kuickpay_consumer_id} />

          <Button
            className="mt-5 h-12 w-full rounded-md text-base font-semibold"
            onClick={() => {
              schoolStore.markChallanProcessing(challan.id);
              toast.success("Redirecting to Safepay…", { description: `${challan.id} · ${fmt(challan.amount)}` });
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {fmt(challan.amount)} via Safepay
          </Button>

          <Button
            variant="outline"
            className="mt-3 h-12 w-full rounded-md text-sm font-medium"
            onClick={() => {
              schoolStore.markChallanProcessing(challan.id);
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
