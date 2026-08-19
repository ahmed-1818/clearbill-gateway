import { Copy, ShieldCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import { formatPkr } from "@/components/clearbill/shared";

export function PayShell({
  brand,
  tag,
  children,
}: {
  brand: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-lg flex-col px-4 pb-16 pt-8 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-foreground text-background">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {tag}
            </p>
            <p className="truncate text-base font-semibold tracking-tight">{brand}</p>
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function BillCard({
  rows,
  due,
  period,
}: {
  rows: [string, string][];
  due: number;
  period: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Bill Summary
      </p>
      <ul className="mt-3 divide-y divide-border">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
          </li>
        ))}
        <li className="flex items-center justify-between pt-3 text-sm">
          <span className="text-muted-foreground">Period</span>
          <span className="font-medium">{period}</span>
        </li>
      </ul>
      <div className="mt-4 flex items-end justify-between rounded-md bg-muted/60 px-4 py-3">
        <span className="text-xs text-muted-foreground">Amount Due</span>
        <span className="text-2xl font-semibold tracking-tight">{formatPkr(due)}</span>
      </div>
    </div>
  );
}

export function BillerBox({ consumerId }: { consumerId: string }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Bank Transfer · 1Link · KuickPay
        </p>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
          Recommended
        </span>
      </div>

      <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Consumer ID
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="break-all font-mono text-xl font-semibold tracking-tight sm:text-2xl">
            {consumerId}
          </p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(consumerId).catch(() => {});
              toast.success("Consumer ID copied");
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Log into your banking app (Meezan, HBL, Nayapay), select{" "}
        <span className="font-medium text-foreground">Bill Payment → KuickPay</span>, and enter
        this Consumer ID to pay instantly.
      </p>
    </div>
  );
}

export function SecurityFooter() {
  return (
    <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5" />
      Secured by ClearBill · Payments processed via 1Link & Safepay
    </p>
  );
}
