import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowRight, FileText, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Drafts() {
  const [_, setLocation] = useLocation();
  const draftsQuery = trpc.drafts.list.useQuery();
  const drafts = draftsQuery.data ?? [];
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = useMemo(() => drafts.find((draft) => draft.id === activeId) ?? drafts[0], [drafts, activeId]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();
  const saveMutation = trpc.drafts.update.useMutation({
    onSuccess: async () => { toast.success("Draft saved. It has not been sent."); await utils.drafts.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => { if (active) { setActiveId(active.id); setSubject(active.subject); setBody(active.body); } }, [active?.id, active?.subject, active?.body]);

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-mark" />Personalized outreach</div><h2>Draft thoughtfully. Review before use.</h2><p>AI drafts use the selected practice's public business details. Every message stays editable and no email is sent from this workspace.</p></div><button className="button button-outline" onClick={() => setLocation("/leads")}>Open lead workspace <ArrowRight /></button></div>
    {draftsQuery.error && <div className="page-error">Could not load drafts: {draftsQuery.error.message}</div>}
    <div className="draft-layout">
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><FileText size={15} /></span><h3>Saved drafts</h3></div><p>{drafts.length} editable message{drafts.length === 1 ? "" : "s"}</p></div></div>
        <div className="draft-list">
          {drafts.map((draft) => <button key={draft.id} className={`draft-list-item ${active?.id === draft.id ? "active" : ""}`} onClick={() => setActiveId(draft.id)}><strong>{draft.subject}</strong><span>{draft.lead?.name ?? "Lead removed"} · {new Date(draft.updatedAt).toLocaleDateString()}</span></button>)}
          {!draftsQuery.isLoading && drafts.length === 0 && <div className="empty-state"><div className="empty-state-icon"><Sparkles size={18} /></div><strong>No drafts yet</strong><p>Open a lead and generate an AI email draft using the business details available.</p><button className="button button-outline button-small" onClick={() => setLocation("/leads")}>Go to leads <ArrowRight /></button></div>}
        </div>
      </section>
      <section className="panel">
        {active ? <>
          <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><Sparkles size={15} /></span><h3>Review draft</h3></div><p>For {active.lead?.name ?? "selected practice"} · {active.status === "edited" ? "Edited" : "AI draft"}</p></div><span className="status-pill warn">Not sent</span></div>
          <form className="draft-editor" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate({ id: active.id, subject, body }); }}>
            <div className="field"><label htmlFor="draft-subject">Subject</label><input id="draft-subject" className="input" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={500} /></div>
            <div className="field"><label htmlFor="draft-body">Email body</label><textarea id="draft-body" className="textarea" value={body} onChange={(event) => setBody(event.target.value)} maxLength={12000} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span className="source-note">Always review personalization and applicable outreach rules before sending elsewhere.</span><button className="button button-primary" type="submit" disabled={saveMutation.isPending || !subject.trim() || !body.trim()}><Save />Save changes</button></div>
          </form>
        </> : <div className="empty-state"><div className="empty-state-icon"><FileText size={18} /></div><strong>Select or create a draft</strong><p>Generated drafts appear here for review.</p></div>}
      </section>
    </div>
  </>;
}
