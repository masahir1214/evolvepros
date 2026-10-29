import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errorMessage";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({ onError: (e) => setError(errorMessage(e)) });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords do not match.");
    reset.mutate({ token, password }, { onSuccess: () => toast.success("Password updated. You can sign in now.") });
  };

  return (
    <div className="login-screen">
      <div className="panel login-card">
        <div className="brand-logo-frame"><img src="/evolve-healthcare-logo.png" alt="Evolve Healthcare Marketing" /></div>
        {reset.isSuccess ? (
          <>
            <h1><CheckCircle2 size={22} style={{ verticalAlign: "-3px" }} /> Password updated.</h1>
            <p>Your password was changed and any other signed-in devices were signed out.</p>
            <a className="button button-primary" style={{ width: "100%", marginTop: 12 }} href="/">Go to sign in <ArrowUpRight /></a>
          </>
        ) : !token ? (
          <>
            <h1>Reset link is incomplete.</h1>
            <p>Open the full link from your email, or request a new one from the sign-in page.</p>
            <a className="button button-outline" style={{ width: "100%", marginTop: 12 }} href="/">Back to sign in</a>
          </>
        ) : (
          <>
            <h1>Choose a new password.</h1>
            <p>Use at least {PASSWORD_MIN_LENGTH} characters.</p>
            {error && <div className="page-error" style={{ textAlign: "left" }}>{error}</div>}
            <form style={{ textAlign: "left", marginTop: 16 }} onSubmit={submit}>
              <div className="field"><label htmlFor="rp-password">New password</label><input id="rp-password" className="input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <div className="field"><label htmlFor="rp-confirm">Confirm new password</label><input id="rp-confirm" className="input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
              <Button className="button button-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={reset.isPending}>{reset.isPending ? "Please wait…" : "Update password"} <ArrowUpRight /></Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
