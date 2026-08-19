import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Dumbbell,
  GraduationCap,
  Check,
  Check as CheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthVault, type AuthMode } from "@/components/clearbill/auth-vault";


export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ClearBill — Institutional Billing for Gyms & Schools" },
      {
        name: "description",
        content:
          "ClearBill is the mobile-first billing OS for gyms and schools. Automate WhatsApp reminders, track recurring fees and manage multi-campus collections.",
      },
      { property: "og:title", content: "ClearBill — Institutional Billing" },
      {
        property: "og:description",
        content:
          "Automated fee reminders, rolling package expiries, multi-campus tuition — one clean ledger.",
      },
    ],
  }),
});

function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");

  const openAuth = (m: AuthMode) => {
    setMode(m);
    setAuthOpen(true);
  };


  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-zinc-900 text-white text-sm font-bold">
            C
          </div>
          <span className="text-lg font-semibold tracking-tight">ClearBill</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => openAuth("login")}
          >
            Sign In
          </Button>
          <Button
            className="bg-zinc-900 text-white hover:bg-zinc-800"
            onClick={() => openAuth("signup")}
          >
            Create Account
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:pt-20">
        {/* Neural Mesh — animated grid fading into the void */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 animate-mesh bg-[linear-gradient(to_right,#80808014_1px,transparent_1px),linear-gradient(to_bottom,#80808014_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_85%)]"
        />



        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            {/* Live Infrastructure Pill */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200/60 bg-white/40 px-3 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                24/7 ACTIVE BILLING PARTNER{"\u00a0"}
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              The billing OS for institutions
              <br className="hidden sm:block" /> that collect every month.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              A quiet, precise ledger for gyms and schools. Automate reminders, track
              recurring fees and reconcile payments — without the spreadsheet chaos.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.24)] transition-all duration-300 ease-out hover:bg-zinc-800 hover:shadow-[0_8px_16px_rgba(0,0,0,0.14)] active:scale-[0.98]"
                onClick={() => openAuth("signup")}
              >
                {/* The Apple/Linear Inner Refraction Edge */}
                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none"></span>

                {/* The Hover Sweep (Native Tailwind, no custom keyframes) */}
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  <span className="absolute inset-y-0 -inset-x-full block w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </span>

                {/* The Content */}
                <span className="relative flex items-center gap-2">
                  Create Account
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 ease-out group-hover:translate-x-1"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </button>

              <Button
                size="lg"
                variant="ghost"
                className="text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => openAuth("login")}
              >
                I already have an account
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <WhatsAppSequence />
          </div>
        </div>

        <InfrastructureMarquee />

        <div className="relative mt-20">
          {/* Ambient core — spinning gradient orb */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[480px] w-[680px] -translate-x-1/2 -translate-y-1/2 animate-orb rounded-full bg-gradient-to-r from-orange-500/20 via-transparent to-indigo-500/20 blur-[120px]"
          />
          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
            <HighlightCard
              icon={<Dumbbell size={24} strokeWidth={1.5} className="text-zinc-700" />}
              eyebrow="For Gyms & Fitness Studios"
              title="Gym & Fitness Management"
              description="Built for high-churn membership operations."
              glowClass="bg-orange-500/20 group-hover:bg-orange-500/30"
              spotlightColor="255, 138, 76"
              highlights={[
                "Automated WhatsApp fee reminders",
                "Rolling package expiries (30 / 90 days)",
                "Member activity tracking",
              ]}
            />
            <HighlightCard
              icon={<GraduationCap size={24} strokeWidth={1.5} className="text-zinc-700" />}
              eyebrow="For Schools & Academies"
              title="School & Academic Billing"
              description="Built for structured, term-based tuition."
              glowClass="bg-indigo-500/20 group-hover:bg-indigo-500/30"
              spotlightColor="129, 140, 248"
              highlights={[
                "Fixed monthly tuition tracking",
                "Multi-campus management",
                "One-click sibling discounts",
              ]}
            />
          </div>
        </div>

        <ReconciliationTicker />

        <p className="mt-20 text-center text-xs text-zinc-500">
          © 2026 ClearBill · Built for institutional operators
        </p>

      </main>

      <AuthVault
        open={authOpen}
        mode={mode}
        onOpenChange={setAuthOpen}
        onModeChange={setMode}
      />
    </div>
  );
}



function HighlightCard({
  icon,
  eyebrow,
  title,
  description,
  highlights,
  glowClass,
  spotlightColor,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  glowClass: string;
  spotlightColor: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      whileHover={{ scale: 1.02, rotateY: 2, rotateX: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      style={{
        transformStyle: "preserve-3d",
        // @ts-expect-error CSS var
        "--spot": spotlightColor,
      }}
      className="group relative flex flex-col rounded-[24px] border border-zinc-200/60 bg-gradient-to-b from-white to-zinc-50/80 p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] ring-1 ring-inset ring-zinc-900/5 transition-shadow duration-500 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.12)] [perspective:1000px]"
    >
      {/* Spotlight border reveal — follows the cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[24px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at var(--mx,50%) var(--my,50%), rgba(var(--spot), 0.28), transparent 45%)",
          maskImage:
            "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 1,
        }}
      />

      <div className="flex items-center justify-between">
        <div className="relative">
          <div className={`absolute inset-0 -z-10 scale-150 rounded-full blur-xl transition-colors duration-500 ${glowClass}`} />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200/50 bg-white shadow-[0_2px_8px_rgb(0,0,0,0.04),_inset_0_1px_0_rgba(255,255,255,1)]">
            {icon}
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tighter text-zinc-900">
        {title}
      </h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
      <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
      <ul className="space-y-3">
        {highlights.map((h) => (
          <li
            key={h}
            className="group/item flex items-center gap-3 text-sm font-medium text-zinc-700 transition-transform duration-300 hover:translate-x-1"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200/50 bg-zinc-100">
              <Check size={14} strokeWidth={3} className="text-zinc-900" />
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}


function WhatsAppSequence() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setT({ x: nx, y: ny }));
    };
    const onLeave = () => setT({ x: 0, y: 0 });
    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="relative h-[340px] w-full max-w-sm [perspective:1200px]">
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 blur-3xl transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${t.x * 8}px, ${t.y * 8}px, 0)`,
          background:
            "radial-gradient(60% 55% at 55% 45%, rgba(37,211,102,0.18), transparent 70%), radial-gradient(45% 40% at 30% 70%, rgba(59,130,246,0.14), transparent 70%)",
        }}
      />

      <div className="wa-float absolute inset-0 [transform-style:preserve-3d]">
        {/* Component 1 — System invoice */}
        <div
          className="wa-rise absolute left-0 top-4 w-72 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-2xl transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate3d(${t.x * -10}px, ${t.y * -6}px, 0) rotateX(${t.y * -2}deg) rotateY(${t.x * 3}deg)`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#25D366]">
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white" aria-hidden>
                <path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.2 1.6 6L0 24l6.3-1.6a11.9 11.9 0 0 0 5.7 1.5h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.5zM12 21.8h-.1a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 .9-3.6-.2-.4A9.9 9.9 0 0 1 2.2 12 9.8 9.8 0 0 1 12 2.2c2.6 0 5.1 1 6.9 2.9A9.7 9.7 0 0 1 21.8 12c0 5.4-4.4 9.8-9.8 9.8zm5.4-7.3c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.1-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" />
              </svg>
            </span>
            <span className="text-xs text-zinc-400">ClearBill Bot · Just now</span>
          </div>
          <p className="mt-3 text-sm font-medium leading-snug text-zinc-800 whitespace-pre-line">
            Monthly tuition of Rs. 18,500 is due for Ali Ahmed of Class 8-B in 2 days.{"\n"}Click Below to Pay.
          </p>
        </div>

        {/* Component 2 — Success receipt */}
        <div
          className="wa-pop absolute bottom-4 right-0 flex w-64 items-center gap-3 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-2xl transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate3d(${t.x * 16}px, ${t.y * 10}px, 0) rotateX(${t.y * -2}deg) rotateY(${t.x * 3}deg)`,
          }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366]">
            <CheckIcon className="h-5 w-5 text-white" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-zinc-900">
              Invoice Cleared via Kuickpay
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Rs. 18,500 · Ref #KP-8842</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReconciliationTicker() {
  const items = [
    "KP-8842 · Rs. 18,500 · Cleared",
    "1LINK · Rs. 4,200 · Reconciled",
    "Safepay · Rs. 32,000 · Settled",
    "WhatsApp reminder · Class 8-B · Delivered",
    "KP-9021 · Rs. 7,500 · Cleared",
    "1LINK · Rs. 12,800 · Reconciled",
    "Safepay · Rs. 21,400 · Settled",
    "WhatsApp reminder · Iron Gym · Delivered",
  ];
  const loop = [...items, ...items];
  return (
    <div className="mx-auto mt-12 flex w-full max-w-3xl overflow-hidden whitespace-nowrap opacity-40 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
      <div className="flex shrink-0 animate-marquee gap-10 pr-10 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
        {loop.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-zinc-400" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function InfrastructureMarquee() {
  const rails = ["1LINK", "Raast", "Safepay", "Kuickpay", "WhatsApp Business"];
  const loop = [...rails, ...rails, ...rails];
  return (
    <div className="mt-20">
      <p className="mb-4 text-center text-[10px] font-bold tracking-[0.2em] text-zinc-400">
        POWERED BY SECURE FINANCIAL RAILS
      </p>
      <div className="flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        <div className="flex shrink-0 animate-marquee items-center gap-16 pr-16">
          {loop.map((rail, i) => (
            <span
              key={i}
              className="text-lg font-semibold text-zinc-300 opacity-60 grayscale transition-opacity hover:opacity-100"
            >
              {rail}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}



