import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useEffect } from "react";
import { getInitials } from "@/lib/utils";
import { hydrateAuth, useAuth } from "@/lib/auth-store";

export function WorkspaceNav({ workspace }: { workspace: string }) {
  const { user } = useAuth();
  useEffect(() => {
    hydrateAuth();
  }, []);
  const initials = getInitials(user?.name);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-xs font-bold">
            C
          </div>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">ClearBill</span>
        </Link>
        <div className="mx-2 h-5 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</p>
          <p className="truncate text-sm font-semibold tracking-tight">{workspace}</p>
        </div>
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background"
          title={user?.name ?? "Account"}
        >
          {initials || <User className="h-4 w-4" />}
        </div>
      </div>
    </header>
  );
}

export function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "paid" | "unpaid";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor:
              accent === "unpaid" ? "var(--status-unpaid-fg)" : "var(--status-paid-fg)",
          }}
        />
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
    </div>
  );
}
