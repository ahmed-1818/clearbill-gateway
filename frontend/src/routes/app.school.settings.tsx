import { requireWorkspace } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SchoolShell, PageHeader } from "@/components/clearbill/school-shell";
import { schoolStore, useSchoolStore, schoolPolicies } from "@/lib/school-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/school/settings")({
  // Session lives in the browser: render client-side so the guard always runs.
  ssr: false,
  beforeLoad: requireWorkspace("school"),
  // Re-asserted in the loader: on a cold direct hit the client pass runs here.
  loader: requireWorkspace("school"),
  head: () => ({
    meta: [
      { title: "Settings · ClearBill School" },
      { name: "description", content: "Institution profile, gateway keys, defaults and templates." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useSchoolStore((x) => x.settings);
  const branches = useSchoolStore((x) => x.branches);
  const r = useSchoolStore((x) => x.reminders);
  const policies = useSchoolStore((x) => x.settings.policies);
  const integrations = useSchoolStore((x) => x.settings.integrations);

  const [institution, setInstitution] = useState(s.institution);
  const [contact, setContact] = useState(s.contact);

  const [grace, setGrace] = useState(policies.grace_period_days);
  const [latePct, setLatePct] = useState(policies.late_fee_percentage);
  const [sibling, setSibling] = useState(policies.sibling_discount_percentage);
  const [scope, setScope] = useState(policies.discount_applies_to);

  const [spEnv, setSpEnv] = useState(integrations.safepay.environment);
  const [spPub, setSpPub] = useState(integrations.safepay.public_key);
  const [spSecret, setSpSecret] = useState(integrations.safepay.encrypted_safepay_secret);
  const [spHook, setSpHook] = useState(integrations.safepay.encrypted_safepay_webhook_secret);
  const [kpId, setKpId] = useState(integrations.kuickpay.institution_id);
  const [kpSecret, setKpSecret] = useState(integrations.kuickpay.encrypted_kuickpay_secret);
  const [raastId, setRaastId] = useState(integrations.raast.merchant_id);

  const [waToken, setWaToken] = useState(integrations.whatsapp.encrypted_whatsapp_token);
  const [waPhoneId, setWaPhoneId] = useState(integrations.whatsapp.phone_number_id);
  const [waTemplate, setWaTemplate] = useState(integrations.whatsapp.template_id);
  const [waAi, setWaAi] = useState(integrations.whatsapp.enable_ai_messaging);
  const [waTone, setWaTone] = useState(integrations.whatsapp.ai_tone);

  const [tBefore, setTBefore] = useState(r.templateBefore);
  const [tDue, setTDue] = useState(r.templateDue);
  const [tAfter, setTAfter] = useState(r.templateAfter);

  return (
    <SchoolShell>
      <PageHeader eyebrow="Configuration" title="Institution Settings" />
      <Tabs defaultValue="profile" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="branches">Branches & Admins</TabsTrigger>
          <TabsTrigger value="gateway">Payment Gateways</TabsTrigger>
          <TabsTrigger value="defaults">Fee Policy</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>


        <TabsContent value="profile" className="mt-4">
          <div className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="space-y-2">
              <Label>Institution name</Label>
              <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Primary contact</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <button className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-4 py-6 text-xs text-muted-foreground hover:bg-accent" onClick={() => toast("Logo upload (mock)")}>
                <Upload className="h-4 w-4" /> Upload logo
              </button>
            </div>
            <Button onClick={() => { schoolStore.updateSettings({ institution, contact }); toast.success("Profile saved"); }}>
              Save changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3 font-medium">Admin WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b, i) => (
                  <tr key={b.id}>
                    <td className="px-5 py-3 font-medium">{b.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.adminPhone}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{i === 0 ? "Super Admin" : "Branch Admin"}</span>
                        <Switch defaultChecked={i === 0} onCheckedChange={() => toast("Role updated (mock)")} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="gateway" className="mt-4">
          <div className="grid max-w-3xl grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Safepay */}
            <div className="space-y-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold tracking-tight">Safepay</p>
                <Switch
                  checked={integrations.safepay.is_active}
                  onCheckedChange={(v) => { schoolPolicies.updateIntegration("safepay", { is_active: v }); toast.success(v ? "Safepay enabled" : "Safepay disabled"); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={spEnv} onValueChange={(v) => setSpEnv(v as typeof spEnv)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Public key</Label>
                <Input className="font-mono text-xs" value={spPub} onChange={(e) => setSpPub(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Secret key</Label>
                <Input className="font-mono text-xs" value={spSecret} onChange={(e) => setSpSecret(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Webhook secret</Label>
                <Input className="font-mono text-xs" value={spHook} onChange={(e) => setSpHook(e.target.value)} />
              </div>
              <Button onClick={() => { schoolPolicies.updateIntegration("safepay", { environment: spEnv, public_key: spPub, encrypted_safepay_secret: spSecret, encrypted_safepay_webhook_secret: spHook }); toast.success("Safepay credentials saved"); }}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Save Safepay
              </Button>
            </div>

            <div className="space-y-4">
              {/* KuickPay */}
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-tight">KuickPay · 1Link</p>
                  <Switch
                    checked={integrations.kuickpay.is_active}
                    onCheckedChange={(v) => { schoolPolicies.updateIntegration("kuickpay", { is_active: v }); toast.success(v ? "KuickPay enabled" : "KuickPay disabled"); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Institution / Biller ID</Label>
                  <Input className="font-mono text-xs" value={kpId} onChange={(e) => setKpId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Secret key</Label>
                  <Input className="font-mono text-xs" value={kpSecret} onChange={(e) => setKpSecret(e.target.value)} />
                </div>
                <Button onClick={() => { schoolPolicies.updateIntegration("kuickpay", { institution_id: kpId, encrypted_kuickpay_secret: kpSecret }); schoolStore.updateSettings({ kuickpayBillerId: kpId }); toast.success("KuickPay credentials saved"); }}>
                  <ShieldCheck className="mr-1 h-4 w-4" /> Save KuickPay
                </Button>
              </div>

              {/* Raast */}
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-tight">Raast</p>
                  <Switch
                    checked={integrations.raast.is_active}
                    onCheckedChange={(v) => { schoolPolicies.updateIntegration("raast", { is_active: v }); toast.success(v ? "Raast enabled" : "Raast disabled"); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Merchant ID</Label>
                  <Input className="font-mono text-xs" value={raastId} onChange={(e) => setRaastId(e.target.value)} />
                </div>
                <Button onClick={() => { schoolPolicies.updateIntegration("raast", { merchant_id: raastId }); toast.success("Raast merchant saved"); }}>
                  <ShieldCheck className="mr-1 h-4 w-4" /> Save Raast
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="defaults" className="mt-4">
          <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-sm font-semibold tracking-tight">Fee policy template</p>
              <p className="text-xs text-muted-foreground">
                Drives late penalties, grace windows and sibling roll-up discounts across every campus.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Grace period (days)</Label>
                <Input type="number" value={grace} onChange={(e) => setGrace(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Late fee %</Label>
                <Input type="number" value={latePct} onChange={(e) => setLatePct(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Sibling discount %</Label>
                <Input type="number" value={sibling} onChange={(e) => setSibling(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Discount applies to</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <SelectTrigger className="sm:max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="second_child_onwards">Second child onwards</SelectItem>
                  <SelectItem value="all_children">All children</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { schoolPolicies.updatePolicies({ grace_period_days: grace, late_fee_percentage: latePct, sibling_discount_percentage: sibling, discount_applies_to: scope }); toast.success("Fee policy updated"); }}>
              Save policy
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-sm font-semibold tracking-tight">Meta WhatsApp Cloud API</p>
              <p className="text-xs text-muted-foreground">
                Outbound reminders dispatch through your approved template.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Bearer token</Label>
              <Input className="font-mono text-xs" value={waToken} onChange={(e) => setWaToken(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone number ID</Label>
                <Input className="font-mono text-xs" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Template ID</Label>
                <Input className="font-mono text-xs" value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
              <div>
                <Label className="text-xs">AI-generated messaging</Label>
                <p className="text-[11px] text-muted-foreground">Injects a Gemini-written line into variable {"{{2}}"}.</p>
              </div>
              <Switch checked={waAi} onCheckedChange={setWaAi} />
            </div>
            <div className="space-y-2">
              <Label>AI tone</Label>
              <Select value={waTone} onValueChange={(v) => setWaTone(v as typeof waTone)}>
                <SelectTrigger className="sm:max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite_urdu">Polite Urdu</SelectItem>
                  <SelectItem value="firm_urdu">Firm Urdu</SelectItem>
                  <SelectItem value="formal_english">Formal English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { schoolPolicies.updateIntegration("whatsapp", { encrypted_whatsapp_token: waToken, phone_number_id: waPhoneId, template_id: waTemplate, enable_ai_messaging: waAi, ai_tone: waTone }); toast.success("WhatsApp integration saved"); }}>
              <ShieldCheck className="mr-1 h-4 w-4" /> Save WhatsApp
            </Button>
          </div>
        </TabsContent>


        <TabsContent value="templates" className="mt-4">
          <div className="grid max-w-3xl grid-cols-1 gap-4 rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Tokens: {"{parent_name}"} {"{student_name}"} {"{class}"} {"{month}"} {"{amount}"} {"{due_date}"} {"{late_fee}"}</p>
            <div className="space-y-2">
              <Label>Before due (polite)</Label>
              <Textarea rows={3} value={tBefore} onChange={(e) => setTBefore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>On due date</Label>
              <Textarea rows={3} value={tDue} onChange={(e) => setTDue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>After due (escalated)</Label>
              <Textarea rows={3} value={tAfter} onChange={(e) => setTAfter(e.target.value)} />
            </div>
            <div>
              <Button onClick={() => { schoolStore.updateReminders({ templateBefore: tBefore, templateDue: tDue, templateAfter: tAfter }); toast.success("Templates saved"); }}>
                Save templates
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </SchoolShell>
  );
}
