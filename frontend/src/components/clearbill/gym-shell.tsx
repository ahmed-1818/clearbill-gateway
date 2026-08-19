import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Settings, User } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { hydrateAuth, useAuth } from "@/lib/auth-store";
import { getInitials } from "@/lib/utils";
import { store } from "@/lib/clearbill-store";

const TABS = [
  { to: "/app/gym/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/app/gym/members", label: "Members", icon: Users },
  { to: "/app/gym/settings", label: "Settings", icon: Settings },
] as const;

export function GymShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, hydrated } = useAuth();
  useEffect(() => {
    hydrateAuth();
  }, []);

  useEffect(() => {
    if (user?.workspace_type === "gym") {
      store.hydrateFromServer();
    }
  }, [user]);

  const initials = getInitials(user?.name);
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
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
            {hydrated ? (
              <p className="truncate text-sm font-semibold tracking-tight">
                {user?.institution_name || "ClearBill Workspace"}
              </p>
            ) : (
              <Skeleton className="mt-1 h-5 w-32" />
            )}
          </div>
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background"
            title={user?.name ?? "Account"}
          >
            {initials || <User className="h-4 w-4" />}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-0 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-56 shrink-0 border-r border-border py-8 pr-4 md:block">
          <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Gym Hub
          </p>
          <nav className="flex flex-col gap-1">
            {TABS.map((t) => {
              const active = isActive(t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-0 sm:py-10 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-3">
          {TABS.map((t) => {
            const active = isActive(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-foreground" : ""}`} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
