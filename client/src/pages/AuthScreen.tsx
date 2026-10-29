import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errorMessage";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { ArrowUpRight, KeyRound, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "register" | "forgot";

export default function AuthScreen() {
  const utils = trpc.useUtils();
  const status = trpc.auth.setupStatus.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const fail = (error: { message: string }) => toast.error(errorMessage(error));
  const signedIn = async () => { setPassword(""); setConfirm(""); setToken(""); await utils.auth.me.invalidate(); };
  const login = trpc.auth.login.useMutation({ onSuccess: signedIn, onError: fail });
  const register = trpc.auth.register.useMutation({ onSuccess: async () => { toast.success("Account created. Welcome!"); await signedIn(); }, onError: fail });
  const setup = trpc.auth.setup.useMutation({ onSuccess: async () => { toast.success("Admin account created."); await signedIn(); }, onError: fail });
  const forgot = trpc.auth.requestPasswordReset.useMutation({ onSuccess: () => setResetSent(true), onError: fail });

  const state = status.data;
  const setupMode = Boolean(state?.setupRequired);
  const signupOpen = Boolean(state?.signupOpen);
  const busy = login.isPending || register.isPending || setup.isPending || forgot.isPending;
  const activeMode: Mode = mode === "register" && !signupOpen ? "login" : mode;

  const switchTo = (next: Mode) => { setMode(next); setPassword(""); setConfirm(""); setResetSent(false); };

  const heading = setupMode ? "Create the admin account."
    : activeMode === "register" ? "Create your account."
    : activeMode === "forgot" ? "Reset your password."
    : "Lead with better context.";
  const intro = setupMode ? "This first account becomes the workspace administrator. It needs the setup key from the server's APP_ADMIN_BOOTSTRAP_TOKEN."
    : activeMode === "register" ? "Sign up with your email to get a private workspace for your own leads and drafts."
    : activeMode === "forgot" ? "Enter your account email and we will send you a link to choose a new password."
    : "Sign in to your practice-prospecting workspace.";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (setupMode) return setup.mutate({ name, email, password, token });
    if (activeMode === "register") {
      if (password !== confirm) return toast.error("The two passwords do not match.");
      return register.mutate({ name, email, password });
    }
    if (activeMode === "forgot") return forgot.mutate({ email });
    login.mutate({ email, password });
  };

  const showPassword = activeMode !== "forgot" || setupMode;
  const creating = setupMode || activeMode === "register";

  return (
    <div className="login-screen">
      <div className="panel login-card">
        <div className="brand-logo-frame"><img src="/evolve-healthcare-logo.png" alt="Evolve Healthcare Marketing" /></div>
        <div className="eyebrow" style={{ justifyContent: "center" }}><span className="eyebrow-mark" /> {setupMode ? "One-time workspace setup" : "Practice intelligence"}</div>
        <h1>{heading}</h1>
        <p>{intro}</p>

        {status.isLoading && <p className="loading-line">Checking workspace…</p>}
        {status.error && <div className="page-error">Could not reach the workspace: {status.error.message}</div>}
        {state && !state.sessionConfigured && <div className="notice"><strong>SESSION_SECRET is not configured.</strong> Add a random 32+ character value to the server environment, then restart.</div>}
        {setupMode && state && !state.tokenConfigured && <div className="notice"><strong><KeyRound size={14} style={{ verticalAlign: "-3px" }} /> Setup key is not configured.</strong> Add <code>APP_ADMIN_BOOTSTRAP_TOKEN</code> (16+ characters) to the server environment, then restart.</div>}

        {state && !setupMode && activeMode !== "forgot" && signupOpen && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }} role="tablist" aria-label="Account">
            <Button type="button" role="tab" aria-selected={activeMode === "login"} className={`button button-small ${activeMode === "login" ? "button-primary" : "button-outline"}`} style={{ flex: 1 }} onClick={() => switchTo("login")}>Sign in</Button>
            <Button type="button" role="tab" aria-selected={activeMode === "register"} className={`button button-small ${activeMode === "register" ? "button-primary" : "button-outline"}`} style={{ flex: 1 }} onClick={() => switchTo("register")}>Create account</Button>
          </div>
        )}

        {state && activeMode === "forgot" && resetSent ? (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <div className="notice success"><strong><MailCheck size={14} style={{ verticalAlign: "-3px" }} /> Check your email.</strong> If an account exists for {email}, a reset link is on its way. It works for one hour.</div>
            <Button type="button" className="button button-outline" style={{ width: "100%", marginTop: 12 }} onClick={() => switchTo("login")}>Back to sign in</Button>
          </div>
        ) : state && (
          <form style={{ textAlign: "left", marginTop: 16 }} onSubmit={submit}>
            {creating && <div className="field"><label htmlFor="auth-name">Your name</label><input id="auth-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
            <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            {showPassword && <div className="field"><label htmlFor="auth-password">Password{creating ? ` (min. ${PASSWORD_MIN_LENGTH} characters)` : ""}</label><input id="auth-password" className="input" type="password" autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={creating ? PASSWORD_MIN_LENGTH : 1} required /></div>}
            {activeMode === "register" && !setupMode && <div className="field"><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={PASSWORD_MIN_LENGTH} required /></div>}
            {setupMode && <div className="field"><label htmlFor="auth-token">Setup key</label><input id="auth-token" className="input" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} minLength={16} required /></div>}
            <Button className="button button-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={busy}>
              {busy ? "Please wait…" : setupMode ? "Create admin account" : activeMode === "register" ? "Create account" : activeMode === "forgot" ? "Send reset link" : "Sign in"} <ArrowUpRight />
            </Button>
            {!setupMode && activeMode === "login" && <p style={{ textAlign: "center", marginTop: 12 }}><button type="button" className="text-link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => switchTo("forgot")}>Forgot your password?</button></p>}
            {!setupMode && activeMode === "forgot" && <p style={{ textAlign: "center", marginTop: 12 }}><button type="button" className="text-link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => switchTo("login")}>Back to sign in</button></p>}
          </form>
        )}

        <p className="source-note" style={{ marginTop: 16 }}>Independent concept demo · not an official Evolve Results product or endorsement.</p>
        <nav className="sidebar-policy-links" style={{ justifyContent: "center", marginTop: 8 }} aria-label="Public policies"><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav>
      </div>
    </div>
  );
}
