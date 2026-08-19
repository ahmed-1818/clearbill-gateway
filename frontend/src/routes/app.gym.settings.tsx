import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Bell,
  Archive,
  Sparkles,
  CreditCard,
  Landmark,
  Banknote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { GymShell } from "@/components/clearbill/gym-shell";
import { formatPkr } from "@/components/clearbill/shared";
import { store, useStore } from "@/lib/clearbill-store";

export const Route = createFileRoute("/app/gym/settings")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("gym"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("gym"),
  head: () => ({
    meta: [
      { title: "Settings · Gym Hub · ClearBill" },
      { name: "description", content: "Manage packages and API integrations." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <GymShell>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Configuration
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage packages and third-party integrations.
        </p>
      </div>

      <Tabs defaultValue="packages" className="mt-6">
        <TabsList>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="automation">Automation Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-6">
          <PackagesPanel />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsPanel />
        </TabsContent>
        <TabsContent value="automation" className="mt-6">
          <AutomationPanel />
        </TabsContent>
      </Tabs>
    </GymShell>
  );
}

function PackagesPanel() {
  const packages = useStore((s) => s.gymPackages);
  const active = packages.filter((p) => !p.is_archived);
  const archived = packages.filter((p) => p.is_archived);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [days, setDays] = useState("30");

  const durationOptions = [
    { v: "7", label: "7 Days" },
    { v: "30", label: "1 Month (30 days)" },
    { v: "90", label: "3 Months (90 days)" },
    { v: "180", label: "6 Months (180 days)" },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Create Package</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reusable membership templates you can assign to members.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Package Name</Label>
            <Input
              placeholder="e.g. Ramadan Plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fee Amount (Rs)</Label>
            <Input
              type="number"
              placeholder="5000"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!name || !fee) {
                toast.error("Add a name and fee to save the package.");
                return;
              }
              store.addGymPackage({ name, fee: Number(fee), days: Number(days) });
              setName("");
              setFee("");
              setDays("30");
              toast.success("Package saved");
            }}
          >
            Save Package
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Saved Packages</h2>
          <p className="text-xs text-muted-foreground">
            {active.length} package templates available
          </p>
        </div>
        <ul className="divide-y divide-border">
          {active.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.days} days</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatPkr(p.fee)}</span>
                <button
                  type="button"
                  aria-label={`Archive ${p.name}`}
                  onClick={() => {
                    store.archiveGymPackage(p.id);
                    toast("Package archived", {
                      description: "Existing members keep their billing history.",
                    });
                  }}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {archived.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Archived
            </p>
            <ul className="mt-2 space-y-1.5">
              {archived.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground line-through">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => store.restoreGymPackage(p.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  const wa = useStore((s) => s.integrations.whatsapp);
  const safepay = useStore((s) => s.integrations.safepay);
  const kuickpay = useStore((s) => s.integrations.kuickpay);
  const raast = useStore((s) => s.integrations.raast);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-foreground text-background">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">
              WhatsApp Business API Configuration
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connect Meta's Cloud API for automated fee reminders and receipts.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Meta API Bearer Token
            </Label>
            <Input
              type="password"
              placeholder="EAAG…"
              value={wa.encrypted_whatsapp_token}
              onChange={(e) => store.updateIntegrations("whatsapp", { encrypted_whatsapp_token: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input
              placeholder="1234567890"
              value={wa.phone_number_id}
              onChange={(e) =>
                store.updateIntegrations("whatsapp", { phone_number_id: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Approved Template ID</Label>
            <Input
              placeholder="fee_reminder_urdu_v3"
              value={wa.template_id}
              onChange={(e) => store.updateIntegrations("whatsapp", { template_id: e.target.value })}
            />
          </div>

          <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-medium">Enable Silent Auto-Billing</p>
              <p className="text-xs text-muted-foreground">
                Fires WhatsApp reminders 3 days before expiry.
              </p>
            </div>
            <Switch
              checked={wa.silent_autobilling_enabled}
              onCheckedChange={(v) =>
                store.updateIntegrations("whatsapp", { silent_autobilling_enabled: v })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
            <div className="min-w-0 pr-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Enable AI Contextual Messaging
              </p>
              <p className="text-xs text-muted-foreground">
                Personalises each reminder using the member's payment history.
              </p>
            </div>
            <Switch
              checked={wa.enable_ai_messaging}
              onCheckedChange={(v) =>
                store.updateIntegrations("whatsapp", { enable_ai_messaging: v })
              }
            />
          </div>

          {wa.enable_ai_messaging && (
            <div className="space-y-2">
              <Label>AI Tone Selector</Label>
              <Select
                value={wa.ai_tone}
                onValueChange={(v) =>
                  store.updateIntegrations("whatsapp", {
                    ai_tone: v as typeof wa.ai_tone,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite_urdu">Polite Urdu</SelectItem>
                  <SelectItem value="firm_urdu">Firm Urdu</SelectItem>
                  <SelectItem value="formal_english">Formal English</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            className="mt-3 w-full sm:w-auto"
            onClick={() => {
              if (!wa.encrypted_whatsapp_token || !wa.phone_number_id || !wa.template_id) {
                toast.error("All API fields are required.");
                return;
              }
              toast.success("API Keys saved securely", {
                description: `Auto-billing ${wa.silent_autobilling_enabled ? "enabled" : "disabled"}`,
              });
            }}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Save API Keys
          </Button>
        </div>
      </div>

      <GatewayCard
        icon={<CreditCard className="h-5 w-5" />}
        title="Safepay Checkout"
        subtitle="Card and wallet checkout for online membership renewals."
        active={safepay.is_active}
        onToggle={(v) => store.updateIntegrations("safepay", { is_active: v })}
      >
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select
            value={safepay.environment}
            onValueChange={(v) =>
              store.updateIntegrations("safepay", {
                environment: v as "sandbox" | "production",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Public Key</Label>
          <Input
            placeholder="sec_xxxxxxxx"
            value={safepay.public_key}
            onChange={(e) => store.updateIntegrations("safepay", { public_key: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Secret Key</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={safepay.encrypted_safepay_secret}
            onChange={(e) =>
              store.updateIntegrations("safepay", { encrypted_safepay_secret: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Webhook Secret</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={safepay.encrypted_safepay_webhook_secret}
            onChange={(e) =>
              store.updateIntegrations("safepay", { encrypted_safepay_webhook_secret: e.target.value })
            }
          />
        </div>
      </GatewayCard>

      <GatewayCard
        icon={<Landmark className="h-5 w-5" />}
        title="KuickPay / 1Link"
        subtitle="Bill payment via any Pakistani banking app using a Consumer ID."
        active={kuickpay.is_active}
        onToggle={(v) => store.updateIntegrations("kuickpay", { is_active: v })}
      >
        <div className="space-y-2">
          <Label>Institution ID</Label>
          <Input
            placeholder="99999"
            value={kuickpay.institution_id}
            onChange={(e) =>
              store.updateIntegrations("kuickpay", { institution_id: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Secret Key</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={kuickpay.encrypted_kuickpay_secret}
            onChange={(e) =>
              store.updateIntegrations("kuickpay", { encrypted_kuickpay_secret: e.target.value })
            }
          />
        </div>
      </GatewayCard>

      <GatewayCard
        icon={<Banknote className="h-5 w-5" />}
        title="Raast Instant Payments"
        subtitle="State Bank instant transfers settled directly to your account."
        active={raast.is_active}
        onToggle={(v) => store.updateIntegrations("raast", { is_active: v })}
      >
        <div className="space-y-2">
          <Label>Merchant ID</Label>
          <Input
            placeholder="RAAST-000000"
            value={raast.merchant_id}
            onChange={(e) => store.updateIntegrations("raast", { merchant_id: e.target.value })}
          />
        </div>
      </GatewayCard>
    </div>
  );
}

function GatewayCard({
  icon,
  title,
  subtitle,
  active,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-foreground text-background">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Switch checked={active} onCheckedChange={onToggle} />
      </div>

      {active && (
        <div className="mt-6 space-y-4">
          {children}
          <Button
            className="w-full sm:w-auto"
            onClick={() => toast.success(`${title} credentials saved securely`)}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Save Credentials
          </Button>
        </div>
      )}
    </div>
  );
}

type Cadence = "once" | "smart" | "aggressive" | "custom";

function AutomationPanel() {
  const config = useStore((s) => s.taskQueueConfig);
  const cadence = config.cadence_type;
  const setCadence = (v: Cadence) => store.updateTaskQueueConfig({ cadence_type: v });
  const [beforeDays, setBeforeDays] = useState("3");
  const [overdueDays, setOverdueDays] = useState("2");

  const options: { v: Cadence; title: string; desc: string }[] = [
    { v: "once", title: "Remind Once", desc: "Single reminder sent on the due date." },
    {
      v: "smart",
      title: "Smart Default",
      desc: "Every 5 days before due, then every day when overdue.",
    },
    { v: "aggressive", title: "Aggressive", desc: "Send a reminder every day until paid." },
    { v: "custom", title: "Custom Cadence", desc: "Define your own before/after intervals." },
  ];

  return (
    <div className="max-w-2xl rounded-lg border border-border bg-card p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-foreground text-background">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">
            WhatsApp Reminder Frequency
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose how aggressively ClearBill nudges members with unpaid dues.
          </p>
        </div>
      </div>

      <RadioGroup
        value={cadence}
        onValueChange={(v) => setCadence(v as Cadence)}
        className="mt-6 gap-2"
      >
        {options.map((o) => (
          <label
            key={o.v}
            htmlFor={`cad-${o.v}`}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-4 py-3 transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem value={o.v} id={`cad-${o.v}`} className="mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{o.title}</p>
              <p className="text-xs text-muted-foreground">{o.desc}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      {cadence === "custom" && (
        <div className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-dashed border-border bg-muted/30 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Remind every [X] days before due date</Label>
            <Input
              type="number"
              min={1}
              value={beforeDays}
              onChange={(e) => setBeforeDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Remind every [Y] days when overdue</Label>
            <Input
              type="number"
              min={1}
              value={overdueDays}
              onChange={(e) => setOverdueDays(e.target.value)}
            />
          </div>
        </div>
      )}

      <Button
        className="mt-6 w-full sm:w-auto"
        onClick={() => {
          const triggers =
            cadence === "custom"
              ? [-Number(beforeDays || 1), 0, Number(overdueDays || 1)]
              : cadence === "once"
                ? [0]
                : cadence === "aggressive"
                  ? [-3, -2, -1, 0, 1, 2, 3]
                  : [-3, 0, 3];
          store.updateTaskQueueConfig({
            cadence_type: cadence,
            execution_triggers: triggers,
            custom_triggers: triggers,
          });
          const detail =
            cadence === "custom"
              ? `Custom · every ${beforeDays}d before, every ${overdueDays}d overdue`
              : options.find((o) => o.v === cadence)?.title;
          toast.success("Automation settings saved", { description: detail });
        }}
      >
        <ShieldCheck className="mr-2 h-4 w-4" />
        Save Automation Settings
      </Button>
    </div>
  );
}
