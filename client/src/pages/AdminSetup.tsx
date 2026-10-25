import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function AdminSetup({ name, email, onSignOut }: { name?: string | null; email?: string | null; onSignOut: () => void }) {
  const [token, setToken] = useState("");
  const utils = trpc.useUtils();
  const status = trpc.adminBootstrap.status.useQuery();
  const claim = trpc.adminBootstrap.claim.useMutation({
    onSuccess: async () => { toast.success("Workspace claimed. Opening the admin dashboard…"); setToken(""); await utils.auth.me.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const state = status.data;
  return <div className="setup-screen">
    <section className="panel setup-card">
      <div className="setup-mark"><ShieldCheck size={22} /></div>
      <div className="eyebrow" style={{ justifyContent: "center" }}><span className="eyebrow-mark" /> One-time workspace setup</div>
      <h1>Claim the Evolve workspace.</h1>
      <p className="setup-intro">This account will become the sole initial administrator. Provider credentials and saved business leads stay closed until ownership is claimed.</p>
      <div className="setup-user"><span className="user-avatar">{(name || email || "E").charAt(0).toUpperCase()}</span><div><strong>{name || "Signed-in account"}</strong><small>{email || "Authorized account"}</small></div><button className="text-link" onClick={onSignOut}>Sign out</button></div>
      {status.isLoading && <p className="loading-line">Checking one-time setup status…</p>}
      {status.error && <div className="page-error">Could not check setup status: {status.error.message}</div>}
      {state && !state.claimAvailable && <div className="notice"><strong>Workspace already claimed.</strong> This account is not the registered owner. Ask the administrator to grant access or sign in with the owner account.</div>}
      {state?.claimAvailable && !state.tokenConfigured && <div className="notice"><strong><KeyRound size={14} style={{ verticalAlign: "-3px" }} /> Owner setup key is not configured.</strong> The project owner must add <code>APP_ADMIN_BOOTSTRAP_TOKEN</code> to protected server environment settings, then reload this page. This one-time key is separate from provider API credentials.</div>}
      {state?.claimAvailable && state.tokenConfigured && <form onSubmit={(event) => { event.preventDefault(); claim.mutate({ token }); }}>
        <div className="field" style={{ textAlign: "left", marginTop: 16 }}><label htmlFor="owner-claim-token">One-time owner setup key</label><input id="owner-claim-token" className="input" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter the project owner's setup key" /></div>
        <p className="source-note" style={{ textAlign: "left" }}>The key is checked server-side and is never stored in the lead database. Ownership can be claimed only once.</p>
        <button className="button button-primary" style={{ width: "100%", marginTop: 12 }} type="submit" disabled={claim.isPending || token.length < 16}><LockKeyhole />{claim.isPending ? "Claiming workspace…" : "Claim admin access"}<ArrowRight /></button>
      </form>}
      <div className="divider" />
      <p className="source-note" style={{ marginBottom: 0 }}>Evolve Practice Pipeline · admin-only workspace · public business information only</p>
    </section>
  </div>;
}
