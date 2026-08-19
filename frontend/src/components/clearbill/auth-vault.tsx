import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dumbbell, GraduationCap, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  authStore,
  useAuth,
  workspaceRoute,
  type WorkspaceType,
} from "@/lib/auth-store";

export type AuthMode = "login" | "signup";

const inputCls =
  "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-400";

export function AuthVault({
  open,
  mode,
  onOpenChange,
  onModeChange,
}: {
  open: boolean;
  mode: AuthMode;
  onOpenChange: (v: boolean) => void;
  onModeChange: (m: AuthMode) => void;
}) {
  const navigate = useNavigate();
  const { status, error } = useAuth();
  const pending = status === "pending";

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // register
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceType>("gym");
  const [institution, setInstitution] = useState("");
  const [touched, setTouched] = useState(false);

  const complete = (type: WorkspaceType) => {
    onOpenChange(false);
    navigate({ to: workspaceRoute(type) });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await authStore.login(loginEmail, loginPassword);
      complete(user.workspace_type);
    } catch {
      /* error surfaced from store */
    }
  };

  const registerValid =
    fullName.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(email) &&
    password.length >= 6 &&
    institution.trim().length > 1;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!registerValid) return;
    try {
      const user = await authStore.register({
        name: fullName,
        email,
        password,
        workspace_type: workspace,
        institution_name: institution,
      });
      complete(user.workspace_type);
    } catch (e: any) {
      /* error is handled by authStore and rendered in the UI */
      console.error(e);
    }
  };

  const switchMode = (m: AuthMode) => {
    authStore.clearError();
    setTouched(false);
    onModeChange(m);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) authStore.clearError();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-200/60 bg-white p-0 text-zinc-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.18)] sm:max-w-[500px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(0,0,0,0.04),transparent_70%)]" />

        <div className="relative px-7 pb-7 pt-7">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
              <ShieldCheck size={16} className="text-zinc-600" />
            </div>
            <DialogTitle className="pt-2 text-xl font-semibold tracking-tight text-zinc-900">
              {mode === "signup" ? "Deploy your workspace" : "Access the vault"}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              {mode === "signup"
                ? "Provision a ClearBill ledger for your institution in under a minute."
                : "Authenticate to resume your billing operations."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Demo credentials
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["admin@gym.com", "Gym Hub"],
                      ["admin@school.com", "School Suite"],
                    ] as const
                  ).map(([mail, label]) => (
                    <button
                      key={mail}
                      type="button"
                      onClick={() => {
                        setLoginEmail(mail);
                        setLoginPassword("clearbill");
                        authStore.clearError();
                      }}
                      className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100"
                    >
                      {mail}
                      <span className="ml-1.5 text-zinc-400">· {label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <VField label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputCls}
                />
              </VField>
              <VField label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={inputCls}
                />
              </VField>

              <Button
                type="submit"
                disabled={pending}
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <VField label="Full Name">
                <Input
                  placeholder="Ali Raza"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                />
              </VField>
              <VField label="Work Email">
                <Input
                  type="email"
                  placeholder="admin@institution.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </VField>
              <VField
                label="Password"
                hint={touched && password.length < 6 ? "Minimum 6 characters" : undefined}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                />
              </VField>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-500">
                  Workspace Type
                </Label>
                <RadioGroup
                  value={workspace}
                  onValueChange={(v) => setWorkspace(v as WorkspaceType)}
                  className="mt-2 grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="gym"
                      id="ws-gym"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="ws-gym"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-zinc-600 transition-all hover:bg-zinc-100 hover:border-zinc-300 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-white peer-data-[state=checked]:text-zinc-900"
                    >
                      <Dumbbell className="mb-3 h-8 w-8" strokeWidth={1.5} />
                      <span className="text-sm font-semibold">Gym &amp; Fitness</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="school"
                      id="ws-school"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="ws-school"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-zinc-600 transition-all hover:bg-zinc-100 hover:border-zinc-300 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-white peer-data-[state=checked]:text-zinc-900"
                    >
                      <GraduationCap className="mb-3 h-8 w-8" strokeWidth={1.5} />
                      <span className="text-sm font-semibold">School &amp; Edu</span>
                    </Label>
                  </div>
                </RadioGroup>

              </div>

              <VField label="Institution Name">
                <Input
                  placeholder={
                    workspace === "gym" ? "Iron Core Gym" : "City Grammar School"
                  }
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className={inputCls}
                />
              </VField>

              {touched && !registerValid ? (
                <p className="text-[11px] text-red-600">
                  Complete every field to provision your workspace.
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create & Deploy Workspace"
                )}
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
            className="mt-5 w-full text-center text-xs text-zinc-500 transition-colors hover:text-zinc-900"
          >
            {mode === "signup"
              ? "Already have an account? Log In"
              : "New to ClearBill? Create Account"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium text-zinc-500">{label}</Label>
        {hint ? <span className="text-[11px] text-red-600">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
