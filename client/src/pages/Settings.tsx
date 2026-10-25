import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { EyeOff, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

type Provider = "googleSearch" | "openai" | "zeroBounce" | "twilio" | "hubspot" | "zoho";
type FieldSpec = { key: string; label: string; placeholder: string; type?: "text" | "password" | "select"; options?: Array<{ value: string; label: string }> };
type ProviderSpec = { id: Provider; title: string; description: string; fields: FieldSpec[] };
const providers: ProviderSpec[] = [
  { id: "googleSearch", title: "Google Search", description: "SerpApi returns Google organic results for new setups; use the legacy Custom Search API only if your account already has access.", fields: [
    { key: "searchProvider", label: "Search API", placeholder: "Choose search API", type: "select", options: [{ value: "serpapi", label: "SerpApi · Google results" }, { value: "customsearch", label: "Google Custom Search · existing accounts only" }] },
    { key: "apiKey", label: "Search provider API key", placeholder: "Enter the API key", type: "password" },
    { key: "engineId", label: "Programmable Search Engine ID", placeholder: "Required for an existing Custom Search account", type: "text" },
  ] },
  { id: "openai", title: "OpenAI", description: "Used on the server to generate editable, lead-specific email drafts.", fields: [{ key: "apiKey", label: "OpenAI API key", placeholder: "Enter the API key", type: "password" }] },
  { id: "zeroBounce", title: "Email verification", description: "Checks independently confirmed business emails through ZeroBounce.", fields: [{ key: "apiKey", label: "ZeroBounce API key", placeholder: "Enter the API key", type: "password" }] },
  { id: "twilio", title: "Phone lookup", description: "Checks number validity and available line-type details through Twilio Lookup.", fields: [{ key: "accountSid", label: "Twilio Account SID", placeholder: "AC…", type: "password" }, { key: "authToken", label: "Twilio Auth Token", placeholder: "Enter the auth token", type: "password" }] },
  { id: "hubspot", title: "HubSpot CRM", description: "Use a private-app token with permission to create company records.", fields: [{ key: "accessToken", label: "Private app access token", placeholder: "Enter the token", type: "password" }] },
  { id: "zoho", title: "Zoho CRM", description: "OAuth refresh credentials for syncing practice accounts. Use the correct Zoho data-center domains for your account.", fields: [{ key: "clientId", label: "OAuth client ID", placeholder: "Enter client ID", type: "password" }, { key: "clientSecret", label: "OAuth client secret", placeholder: "Enter client secret", type: "password" }, { key: "refreshToken", label: "OAuth refresh token", placeholder: "Enter refresh token", type: "password" }, { key: "apiDomain", label: "CRM API domain", placeholder: "https://www.zohoapis.com", type: "text" }, { key: "accountsDomain", label: "Accounts domain", placeholder: "https://accounts.zoho.com", type: "text" }] },
];
const defaults: Partial<Record<Provider, Record<string, string>>> = {
  googleSearch: { searchProvider: "serpapi" },
  zoho: { apiDomain: "https://www.zohoapis.com", accountsDomain: "https://accounts.zoho.com" },
};

function CredentialCard({ spec, configured, encryptionReady }: { spec: ProviderSpec; configured: boolean; encryptionReady: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(defaults[spec.id] ?? {});
  const utils = trpc.useUtils();
  const save = trpc.settings.saveCredentials.useMutation({
    onSuccess: async () => { toast.success(`${spec.title} credentials saved securely.`); setValues(defaults[spec.id] ?? {}); await utils.settings.status.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.settings.removeCredentials.useMutation({
    onSuccess: async () => { toast.success(`${spec.title} credentials removed.`); await utils.settings.status.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const visibleFields = spec.id === "googleSearch" ? spec.fields.filter((field) => field.key !== "engineId" || values.searchProvider === "customsearch") : spec.fields;
  return <section className="panel credential-card">
    <div className="credential-card-header"><div><h3>{spec.title}</h3><p>{spec.description}</p></div><span className={`status-pill ${configured ? "good" : "warn"}`}>{configured ? "Configured" : "Not configured"}</span></div>
    <form onSubmit={(event) => { event.preventDefault(); save.mutate({ provider: spec.id, credentials: values }); }}>
      <div className="credential-fields">{visibleFields.map((field) => <div className="credential-field" key={field.key}><label htmlFor={`${spec.id}-${field.key}`}>{field.label}</label>{field.type === "select" ? <select id={`${spec.id}-${field.key}`} className="select" value={values[field.key] ?? defaults[spec.id]?.[field.key] ?? "serpapi"} onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`${spec.id}-${field.key}`} type={field.type ?? "text"} autoComplete="new-password" value={values[field.key] ?? ""} onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))} placeholder={configured && field.type === "password" ? "Saved securely · enter a new value to replace" : field.placeholder} spellCheck={false} />}</div>)}</div>
      <div className="credential-actions"><button className="button button-primary button-small" type="submit" disabled={!encryptionReady || save.isPending}>{save.isPending ? <RefreshCw className="animate-spin" /> : <LockKeyhole />}Save securely</button>{configured && <button className="button button-danger button-small" type="button" onClick={() => remove.mutate({ provider: spec.id })} disabled={remove.isPending}><Trash2 />Remove</button>}</div>
    </form>
    {configured && <p className="source-note" style={{ margin: "10px 0 0" }}><EyeOff size={12} style={{ verticalAlign: "-2px" }} /> Saved values are never shown again. Enter every required field to replace this provider's credentials.</p>}
  </section>;
}

export default function Settings() {
  const statusQuery = trpc.settings.status.useQuery();
  const data = statusQuery.data;
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-mark" />Admin controls</div><h2>Keep provider access in the backend.</h2><p>Credentials are submitted to the server, encrypted before database storage, and never returned to the browser.</p></div><div className="topbar-tag"><ShieldCheck size={14} color="#7cff6b" />Owner access only</div></div>
    {statusQuery.error && <div className="page-error">Could not read settings: {statusQuery.error.message}. Sign in with the workspace administrator account.</div>}
    {data && !data.encryptionReady && <div className="notice" style={{ marginBottom: 14 }}><strong><KeyRound size={14} style={{ verticalAlign: "-3px" }} /> One-time encryption setup needed.</strong> Before saving provider credentials, set the server secret <code>APP_CREDENTIALS_ENCRYPTION_KEY</code> to a random 32-byte value (base64 or 64-character hex) in the project's protected environment settings. Generate one with <code>openssl rand -base64 32</code>. The app uses it only on the server with AES-256-GCM.</div>}
    {data?.encryptionReady && <div className="notice success" style={{ marginBottom: 14 }}><strong><ShieldCheck size={14} style={{ verticalAlign: "-3px" }} /> Encryption is ready.</strong> Provider credentials are encrypted server-side. Replacing the encryption key without first re-encrypting saved values will make them unreadable.</div>}
    <section className="panel panel-inset" style={{ marginBottom: 14 }}>
      <div className="panel-title-line"><span className="panel-title-icon"><LockKeyhole size={15} /></span><h3 style={{ margin: 0, fontSize: 13 }}>Maps access is provided by the workspace</h3></div>
      <p className="source-note" style={{ margin: "9px 0 0" }}>Google Maps Places requests use the project's server-side proxy. There is no separate Maps key field here. Google Custom Search is closed to new customers and scheduled to end on January 1, 2027; select SerpApi for a new Google-results connection. See <a className="text-link" href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noreferrer">Google's official API notice</a>.</p>
    </section>
    <div className="credentials-grid">{providers.map((spec) => <CredentialCard key={spec.id} spec={spec} configured={data?.providers[spec.id] ?? false} encryptionReady={data?.encryptionReady ?? false} />)}</div>
    <div className="notice" style={{ marginTop: 14 }}><strong>Use only business contact data.</strong> Add provider credentials from the official provider accounts. Avoid patient records or sensitive health information. Email and phone checks describe provider-returned deliverability/number data and do not guarantee consent or reachability.</div>
  </>;
}
