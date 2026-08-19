import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Bell,
  Settings as SettingsIcon,
  Wallet,
  ReceiptText,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { hydrateAuth, useAuth } from "@/lib/auth-store";
import { cn, getInitials } from "@/lib/utils";
import { schoolStore, useSchoolStore } from "@/lib/school-store";

const nav = [
  { to: "/app/school/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/app/school/branches", label: "Branches", icon: Building2 },
  { to: "/app/school/students", label: "Students", icon: Users },
  { to: "/app/school/fee-structures", label: "Fee Structures", icon: Wallet },
  { to: "/app/school/payments", label: "Payments", icon: Receipt },
  { to: "/app/school/custom-billing", label: "Ad-Hoc Challans", icon: ReceiptText },
  { to: "/app/school/reminders", label: "Reminders", icon: Bell },
  { to: "/app/school/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function SchoolShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const fallbackInstitution = useSchoolStore((s) => s.settings.institution);
  const { user, hydrated } = useAuth();
  useEffect(() => {
    hydrateAuth();
  }, []);

  useEffect(() => {
    if (user?.workspace_type === "school") {
      schoolStore.hydrateFromServer();
    }
  }, [user]);

  const institution = user?.institution_name || fallbackInstitution || "ClearBill Workspace";
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafbfd] text-foreground">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background text-sm font-bold">
            C
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
              ClearBill · School
            </p>
            {hydrated ? (
              <p className="truncate text-sm font-semibold tracking-tight">{institution}</p>
            ) : (
              <Skeleton className="mt-1 h-5 w-32" />
            )}
          </div>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card"
          onClick={() => setOpenMobile((v) => !v)}
          aria-label="Toggle nav"
        >
          {openMobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-white md:block">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background text-sm font-bold">
              C
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                ClearBill · School
              </p>
              {hydrated ? (
              <p className="truncate text-sm font-semibold tracking-tight">{institution}</p>
            ) : (
              <Skeleton className="mt-1 h-5 w-32" />
            )}
            </div>
          </div>
          <nav className="flex flex-col gap-0.5 p-3">
            {nav.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {openMobile && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpenMobile(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Menu</p>
                <button onClick={() => setOpenMobile(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-col gap-0.5">
                {nav.map((n) => {
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpenMobile(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "PAID" | "UNPAID" | "PARTIAL" | "PENDING";
}) {
  const map = {
    PAID: { bg: "#d1fae5", fg: "#065f46", label: "PAID" },
    UNPAID: { bg: "#ffe4e6", fg: "#9f1239", label: "UNPAID" },
    PARTIAL: { bg: "#fef3c7", fg: "#92400e", label: "PARTIAL" },
    PENDING: { bg: "#e2e8f0", fg: "#334155", label: "PENDING VERIFICATION" },
  } as const;
  const c = map[status];
  return (
    <span
      className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export { Outlet };
