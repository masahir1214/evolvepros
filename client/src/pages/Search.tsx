import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ExternalLink, Globe2, MapPin, Search as SearchIcon, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type SearchResult = {
  source: "google_maps" | "google_search";
  sourceId?: string;
  sourceUrl?: string;
  name: string;
  specialty?: string;
  address?: string;
  city?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
};
type CaptureForm = { name: string; specialty: string; address: string; city: string; state: string; country: string; website: string; email: string; phone: string };
const emptyCapture: CaptureForm = { name: "", specialty: "", address: "", city: "", state: "", country: "", website: "", email: "", phone: "" };

export default function Search() {
  const [_, setLocation] = useLocation();
  const [query, setQuery] = useState("Pain management");
  const [location, setLocationValue] = useState("Phoenix, AZ");
  const [source, setSource] = useState<"maps" | "google">("maps");
  const [submitted, setSubmitted] = useState<{ query: string; location: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureForm>(emptyCapture);
  const [googlePlaceId, setGooglePlaceId] = useState<string | undefined>();
  const [confirmedFromWebsite, setConfirmedFromWebsite] = useState(false);
  const mapsQuery = trpc.search.maps.useQuery(
    { query: submitted?.query ?? "Pain management", location: submitted?.location ?? "Phoenix, AZ" },
    { enabled: Boolean(submitted && source === "maps"), retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true },
  );
  const googleQuery = trpc.search.google.useQuery(
    { query: submitted?.query ?? "Pain management", location: submitted?.location ?? "Phoenix, AZ" },
    { enabled: Boolean(submitted && source === "google"), retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true },
  );
  const utils = trpc.useUtils();
  const savePlaces = trpc.leads.saveCandidates.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.added} Place ID reference${result.added === 1 ? "" : "s"} saved · ${result.merged} duplicate${result.merged === 1 ? "" : "s"} merged. Google listing details were not stored.`);
      setSelected(new Set());
      void utils.leads.list.invalidate();
      setLocation("/leads");
    },
    onError: (error) => toast.error(error.message),
  });
  const createVerified = trpc.leads.createVerified.useMutation({
    onSuccess: async (result) => {
      toast.success(result.added ? "Official-website details saved as a lead." : "Matching lead found; verified business details were merged.");
      setCaptureOpen(false);
      setCapture(emptyCapture);
      setGooglePlaceId(undefined);
      setConfirmedFromWebsite(false);
      await utils.leads.list.invalidate();
      setLocation("/leads");
    },
    onError: (error) => toast.error(error.message),
  });
  const results = useMemo(() => (source === "maps" ? mapsQuery.data ?? [] : googleQuery.data ?? []) as SearchResult[], [source, mapsQuery.data, googleQuery.data]);
  const activeQuery = source === "maps" ? mapsQuery : googleQuery;
  const loading = activeQuery.isFetching;
  const error = activeQuery.error?.message;
  const readyToSearch = query.trim().length >= 2 && location.trim().length >= 2;
  const getKey = (result: SearchResult) => result.sourceId || `${result.name}-${result.city ?? ""}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!readyToSearch) return;
    setSelected(new Set());
    setSubmitted({ query: query.trim(), location: location.trim() });
  }

  function toggle(key: string) {
    setSelected((previous) => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  function savePlaceIds() {
    const candidates = results.filter((result) => result.source === "google_maps" && selected.has(getKey(result)));
    if (!candidates.length) { toast.error("Select at least one Google Maps listing reference first."); return; }
    savePlaces.mutate({ candidates });
  }

  function startCapture(placeId?: string) {
    setGooglePlaceId(placeId);
    setCapture({ ...emptyCapture, specialty: submitted?.query ?? query, city: submitted?.location ?? location });
    setConfirmedFromWebsite(false);
    setCaptureOpen(true);
  }

  function submitCapture(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmedFromWebsite) { toast.error("Confirm that you checked the practice's official website first."); return; }
    createVerified.mutate({ ...capture, googlePlaceId, confirmedFromBusinessWebsite: true });
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-mark" />Market discovery</div><h2>Search for a good-fit practice.</h2><p>Find healthcare practice listings, then confirm business details from the practice's own website before saving a usable lead.</p></div>
      <button className="button button-outline" onClick={() => setLocation("/settings")}>Provider setup <ArrowRight /></button>
    </div>
    <section className="panel panel-inset" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 15 }}>
        <div className="source-switch" role="tablist" aria-label="Lead source">
          <button className={`source-tab ${source === "maps" ? "active" : ""}`} role="tab" aria-selected={source === "maps"} onClick={() => setSource("maps")}><MapPin size={14} />Google Maps</button>
          <button className={`source-tab ${source === "google" ? "active" : ""}`} role="tab" aria-selected={source === "google"} onClick={() => setSource("google")}><Globe2 size={14} />Google Search</button>
        </div>
        <span className="source-note">Business prospects only · no patient information</span>
      </div>
      <form className="search-form" onSubmit={submit}>
        <div className="field"><label htmlFor="practice-query">Practice type or specialty</label><input id="practice-query" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. radiology, ABA therapy" /></div>
        <div className="field"><label htmlFor="market-location">City, state, or region</label><input id="market-location" className="input" value={location} onChange={(event) => setLocationValue(event.target.value)} placeholder="e.g. Phoenix, Arizona" /></div>
        <button className="button button-primary" type="submit" disabled={!readyToSearch || loading}><SearchIcon />{loading ? "Searching…" : "Search practices"}</button>
      </form>
      {source === "google" && <p className="source-note" style={{ marginBottom: 0, marginTop: 11 }}>Search results are temporary and not saved as lead data. Use the official website to independently confirm details before adding them. Google Custom Search is closed to new customers and retires Jan 1, 2027; new setups should use SerpApi. <a className="text-link" href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noreferrer">API notice</a>.</p>}
      {source === "maps" && <p className="source-note" style={{ marginBottom: 0, marginTop: 11 }}>Live Maps listings are attributed below. Only a Place ID can be retained as an unverified reference; business names, addresses, contacts, ratings, and websites from the listing are not saved.</p>}
    </section>

    {error && <div className="page-error">{error} {source === "google" && <button className="text-link" style={{ background: "none", border: 0 }} onClick={() => setLocation("/settings")}>Open Credentials</button>}</div>}
    {loading && <div className="panel loading-line">Searching public business sources…</div>}
    {!submitted && <section className="panel empty-state"><div className="empty-state-icon"><SearchIcon size={18} /></div><strong>Choose a specialty and market to begin</strong><p>Try pain management, radiology, ABA therapy, or another practice segment Evolve supports.</p></section>}
    {submitted && !loading && !error && results.length === 0 && <section className="panel empty-state"><div className="empty-state-icon"><MapPin size={18} /></div><strong>No practice listings found for this search</strong><p>Try a broader specialty or nearby city. We won't invent a match when the source has no result.</p></section>}
    {submitted && results.length > 0 && <section className="panel">
      <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><Globe2 size={15} /></span><h3>{results.length} live business results</h3></div><p>{submitted.query} near {submitted.location} · {source === "maps" ? "Google Maps" : "Google Search"}</p></div>{source === "maps" ? <button className="button button-primary button-small" onClick={savePlaceIds} disabled={!selected.size || savePlaces.isPending}><ArrowDownToLine />Save Place IDs only ({selected.size})</button> : <span className="source-note">Search results are not stored</span>}</div>
      <div className="panel-body candidate-list">
        {results.map((result) => {
          const key = getKey(result);
          const checked = selected.has(key);
          return <div className={`candidate-row ${checked ? "selected" : ""}`} key={key} onClick={() => source === "maps" && toggle(key)}>
            {source === "maps" && <input className="candidate-check" type="checkbox" checked={checked} onChange={() => toggle(key)} onClick={(event) => event.stopPropagation()} aria-label={`Select Google Maps Place ID for ${result.name}`} />}
            <div className="candidate-main">
              <div className="candidate-title"><strong>{result.name}</strong>{source === "maps" ? <span className="maps-attribution" translate="no">Google Maps</span> : <span className="source-badge google">Google Search</span>}{source === "maps" && result.rating != null && <span className="rating"><Star size={12} fill="currentColor" />{result.rating.toFixed(1)}{result.reviewCount ? ` · ${result.reviewCount}` : ""}</span>}</div>
              <div className="candidate-sub">{source === "maps" && result.address && <span><MapPin size={11} style={{ verticalAlign: "-2px" }} /> {result.address}</span>}{result.phone && <span>{result.phone}</span>}{source === "google" && <span>{result.city || submitted.location} · temporary result</span>}</div>
              {result.website && <a className="candidate-web" href={result.website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Globe2 size={12} />{result.website.replace(/^https?:\/\//, "").slice(0, 70)} <ArrowUpRight size={11} /></a>}
              <div className="candidate-actions">
                {source === "maps" && result.sourceUrl && <a className="button button-outline button-small" href={result.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink />Open Google Maps listing</a>}
                {source === "google" && result.sourceUrl && <a className="button button-outline button-small" href={result.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink />Open result</a>}
                <button className="button button-outline button-small" onClick={(event) => { event.stopPropagation(); startCapture(source === "maps" ? result.sourceId : undefined); }}>{source === "maps" ? "Add website-confirmed details" : "Capture after confirming site"}<ArrowRight /></button>
              </div>
            </div>
            {checked && <Check size={16} color="#7cff6b" />}
          </div>;
        })}
      </div>
    </section>}
    {captureOpen && <section className="panel capture-panel">
      <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><Globe2 size={15} /></span><h3>Add practice details from its official website</h3></div><p>Nothing from the Google result has been copied into these fields.</p></div><button className="button button-ghost button-small" onClick={() => setCaptureOpen(false)}>Cancel</button></div>
      {googlePlaceId && <div className="notice" style={{ margin: "0 14px 14px" }}>This record will retain the Google Maps Place ID as a source reference only. Maps listing details are not copied or exported.</div>}
      <form className="panel-body capture-form" onSubmit={submitCapture}>
        <div className="capture-grid">
          <div className="field"><label htmlFor="capture-name">Practice name *</label><input id="capture-name" className="input" required value={capture.name} onChange={(event) => setCapture({ ...capture, name: event.target.value })} placeholder="As shown on the practice website" /></div>
          <div className="field"><label htmlFor="capture-specialty">Specialty</label><input id="capture-specialty" className="input" value={capture.specialty} onChange={(event) => setCapture({ ...capture, specialty: event.target.value })} /></div>
          <div className="field"><label htmlFor="capture-website">Official website *</label><input id="capture-website" className="input" type="url" required value={capture.website} onChange={(event) => setCapture({ ...capture, website: event.target.value })} placeholder="https://practice.com" /></div>
          <div className="field"><label htmlFor="capture-email">Business email</label><input id="capture-email" className="input" type="email" value={capture.email} onChange={(event) => setCapture({ ...capture, email: event.target.value })} placeholder="contact@practice.com" /></div>
          <div className="field"><label htmlFor="capture-phone">Business phone</label><input id="capture-phone" className="input" value={capture.phone} onChange={(event) => setCapture({ ...capture, phone: event.target.value })} placeholder="+1 602 555 0134" /></div>
          <div className="field"><label htmlFor="capture-city">City / market</label><input id="capture-city" className="input" value={capture.city} onChange={(event) => setCapture({ ...capture, city: event.target.value })} /></div>
          <div className="field"><label htmlFor="capture-state">State / region</label><input id="capture-state" className="input" value={capture.state} onChange={(event) => setCapture({ ...capture, state: event.target.value })} /></div>
          <div className="field"><label htmlFor="capture-address">Business address</label><input id="capture-address" className="input" value={capture.address} onChange={(event) => setCapture({ ...capture, address: event.target.value })} /></div>
        </div>
        <label className="confirm-row"><input type="checkbox" checked={confirmedFromWebsite} onChange={(event) => setConfirmedFromWebsite(event.target.checked)} /><span>I checked the practice's official website and entered these business details independently—not copied from a Google listing.</span></label>
        <div className="capture-footer"><span className="source-note">No patient data · no automatic outreach</span><button className="button button-primary" type="submit" disabled={!confirmedFromWebsite || createVerified.isPending}>{createVerified.isPending ? "Saving…" : "Save verified business lead"}<ArrowRight /></button></div>
      </form>
    </section>}
    <p className="source-note" style={{ marginTop: 13 }}>Place IDs are retained only as listing references. Confirmed business details are deduplicated and can then be enriched, verified, drafted, exported, or synced. See <a className="text-link" href="/terms">Terms</a> and <a className="text-link" href="/privacy">Privacy</a>.</p>
  </>;
}
