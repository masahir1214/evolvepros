import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, Bot, Building2, Globe2, MapPin, Phone, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

const cards = [
  { id: "googleMaps", title: "Google Maps", group: "Discovery", description: "Supported Places search and business detail lookups through the workspace Maps proxy.", icon: MapPin, noSecret: true },
  { id: "googleSearch", title: "Google Search", group: "Discovery", description: "Google results via SerpApi for new setups, or Custom Search for existing account holders only.", icon: Search },
  { id: "zeroBounce", title: "Email verifier", group: "Contact quality", description: "Check whether business emails are deliverable, invalid, or uncertain.", icon: BadgeCheck },
  { id: "twilio", title: "Phone lookup", group: "Contact quality", description: "Check phone-number validity and available line-type information.", icon: Phone },
  { id: "openai", title: "OpenAI email writer", group: "Personalization", description: "Generate an editable, lead-specific email draft from public business context.", icon: Sparkles },
  { id: "hubspot", title: "HubSpot CRM", group: "CRM sync", description: "Sync a selected practice into HubSpot as a company record.", icon: Building2 },
  { id: "zoho", title: "Zoho CRM", group: "CRM sync", description: "Sync a selected practice into Zoho CRM as an account record.", icon: Globe2 },
] as const;

export default function Integrations() {
  const [_, setLocation] = useLocation();
  const query = trpc.settings.status.useQuery();
  const status = query.data?.providers;
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-mark" />Connect the workflow</div><h2>Know what's ready to run.</h2><p>Provider credentials stay server-side. A configured label means credentials are saved, not that every future provider request is guaranteed to succeed.</p></div><button className="button button-primary" onClick={() => setLocation("/settings")}>Manage credentials <ArrowRight /></button></div>
    {query.error && <div className="page-error">Could not read integration status: {query.error.message}</div>}
    <div className="integration-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        const noSecret = "noSecret" in card && card.noSecret;
        const configured = status?.[card.id] ?? false;
        return <section className="panel integration-card" key={card.id}>
          <div className="integration-top"><div className="integration-brand"><span className="integration-icon"><Icon size={17} /></span><div><h3>{card.title}</h3><p>{card.group}</p></div></div><span className={`status-pill ${configured ? "good" : "warn"}`}>{configured ? (noSecret ? "Available" : "Configured") : "Setup needed"}</span></div>
          <p>{card.description}</p>
          <div className="integration-foot"><small>{noSecret ? "Provided by the project runtime" : configured ? "Stored as encrypted credentials" : "No credential values saved"}</small><button className="button button-outline button-small" onClick={() => setLocation("/settings")}>{noSecret ? "View status" : configured ? "Manage" : "Configure"}<ArrowRight /></button></div>
        </section>;
      })}
    </div>
    <section className="panel panel-inset" style={{ marginTop: 14 }}>
      <div className="panel-title-line"><span className="panel-title-icon"><ShieldCheck size={15} /></span><h3 style={{ margin: 0, fontSize: 13 }}>Safe by default</h3></div>
      <p className="source-note" style={{ margin: "10px 0 0", maxWidth: 800 }}>Credentials are encrypted before database storage and aren't sent back to the browser. Lead verification and CRM sync run only when an operator starts them. This workspace is for public business prospecting, not patient or clinical data.</p>
    </section>
  </>;
}
