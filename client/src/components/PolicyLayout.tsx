import type { ReactNode } from "react";

export default function PolicyLayout({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return <div className="policy-shell">
    <header className="policy-header">
      <a className="policy-brand" href="/" aria-label="Evolve Practice Prospecting home">
        <span className="policy-logo"><img src="/evolve-healthcare-logo.png" alt="Evolve Healthcare Marketing" /></span>
        <span><strong>Evolve Practice Prospecting</strong><small>Independent concept demo</small></span>
      </a>
      <a className="button button-outline button-small" href="/">Open workspace</a>
    </header>
    <main className="policy-main panel">
      <div className="eyebrow"><span className="eyebrow-mark" />Public policy · Concept demo</div>
      <h1>{title}</h1>
      <p className="policy-updated">Last updated {updatedAt}</p>
      <div className="policy-content">{children}</div>
    </main>
    <footer className="policy-footer">
      <span>Independent prototype · Not an official Evolve Results product or endorsement</span>
      <nav aria-label="Policy links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="https://ehmresults.com/" target="_blank" rel="noreferrer">Evolve Results site ↗</a></nav>
    </footer>
  </div>;
}
