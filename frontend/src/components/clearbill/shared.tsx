import { Badge } from "@/components/ui/badge";

export type BadgeStatus = "PAID" | "UNPAID" | "INACTIVE";

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const map: Record<BadgeStatus, { bg: string; fg: string }> = {
    PAID: { bg: "var(--status-paid-bg)", fg: "var(--status-paid-fg)" },
    UNPAID: { bg: "var(--status-unpaid-bg)", fg: "var(--status-unpaid-fg)" },
    INACTIVE: { bg: "#e2e8f0", fg: "#475569" },
  };
  const c = map[status];
  return (
    <Badge
      className="rounded-md border-0 px-2 py-0.5 text-[10px] font-semibold tracking-wider"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {status}
    </Badge>
  );
}

export function formatPkr(n: number) {
  return "Rs. " + n.toLocaleString("en-PK");
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HighlightText({ text, query }: { text: string; query: string }) {
  const term = query.trim().toLowerCase();
  if (!term) return <>{text}</>;

  const parts: { text: string; match: boolean }[] = [];
  let remaining = text;
  while (remaining.length) {
    const idx = remaining.toLowerCase().indexOf(term);
    if (idx === -1) {
      parts.push({ text: remaining, match: false });
      break;
    }
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), match: false });
    parts.push({ text: remaining.slice(idx, idx + term.length), match: true });
    remaining = remaining.slice(idx + term.length);
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 font-medium text-inherit dark:bg-yellow-300/70"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
