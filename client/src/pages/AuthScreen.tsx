import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AuthScreen() {
  const utils = trpc.useUtils();
  const status = trpc.auth.setupStatus.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const onSuccess = async () => { setPassword(""); setToken(""); await utils.auth.me.invalidate(); };
  const login = trpc.auth.login.useMutation({ onSuccess, onError: (error) => toast.error(error.message) });
  const setup = trpc.auth.setup.useMutation({
    onSuccess: async () => { toast.success("Admin account created."); await onSuccess(); },
    onError: (error) => toast.error(error.message),
  });

  const state = status.data;
  const setupMode = Boolean(state?.setupRequired);
  const busy = login.isPending || setup.isPending;

  return (
    <div className="login-screen">
      <div className="panel login-card">
        <div className="brand-logo-frame"><img src="/evolve-healthcare-logo.png" alt="Evolve Healthcare Marketing" /></div>
        <div className="eyebrow" style={{ justifyContent: "center" }}><span className="eyebrow-mark" /> {setupMode ? "One-time workspace setup" : "Practice intelligence"}</div>
        <h1>{setupMode ? "Create the admin account." : "Lead with better context."}</h1>
        <p>{setupMode
          ? "This first account becomes the workspace administrator. It needs the setup key from the server's APP_ADMIN_BOOTSTRAP_TOKEN."
          : "Sign in to your practice-prospecting workspace. Access is restricted to its administrator."}</p>

        {status.isLoading && <p className="loading-line">Checking workspace…</p>}
        {status.error && <div className="page-error">Could not reach the workspace: {status.error.message}</div>}
        {state && !state.sessionConfigured && <div className="notice"><strong>SESSION_SECRET is not configured.</strong> Add a random 32+ character value to the server environment, then restart.</div>}
        {setupMode && state && !state.tokenConfigured && <div className="notice"><strong><KeyRound size={14} style={{ verticalAlign: "-3px" }} /> Setup key is not configured.</strong> Add <code>APP_ADMIN_BOOTSTRAP_TOKEN</code> (16+ characters) to the server environment, then restart.</div>}

        {state && (
          <form
            style={{ textAlign: "left", marginTop: 16 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (setupMode) setup.mutate({ name, email, password, token });
              else login.mutate({ email, password });
            }}
          >
            {setupMode && <div className="field"><label htmlFor="auth-name">Your name</label><input id="auth-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
            <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="field"><label htmlFor="auth-password">Password{setupMode ? ` (min. ${PASSWORD_MIN_LENGTH} characters)` : ""}</label><input id="auth-password" className="input" type="password" autoComplete={setupMode ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={setupMode ? PASSWORD_MIN_LENGTH : 1} required /></div>
            {setupMode && <div className="field"><label htmlFor="auth-token">Setup key</label><input id="auth-token" className="input" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} minLength={16} required /></div>}
            <Button className="button button-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={busy}>
              {busy ? "Please wait…" : setupMode ? "Create admin account" : "Sign in"} <ArrowUpRight />
            </Button>
          </form>
        )}

        <p className="source-note" style={{ marginTop: 16 }}>Independent concept demo · not an official Evolve Results product or endorsement.</p>
        <nav className="sidebar-policy-links" style={{ justifyContent: "center", marginTop: 8 }} aria-label="Public policies"><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav>
      </div>
    </div>
  );
}
