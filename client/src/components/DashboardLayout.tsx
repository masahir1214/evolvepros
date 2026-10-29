import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import AuthScreen from "@/pages/AuthScreen";
import { ArrowUpRight, BarChart3, ChevronRight, CircleHelp, Database, FileText, LayoutDashboard, LogOut, Menu, Plug, Search, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const navItems = [
  { path: "/", label: "Overview", icon: LayoutDashboard, section: "Workspace" },
  { path: "/search", label: "Find practices", icon: Search },
  { path: "/leads", label: "Lead workspace", icon: Users },
  { path: "/drafts", label: "Email drafts", icon: FileText },
  { path: "/integrations", label: "Integrations", icon: Plug, section: "Connect" },
  { path: "/settings", label: "Credentials", icon: Settings },
];
const pageInfo: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Overview", subtitle: "A clearer view of healthcare practice prospecting." },
  "/search": { title: "Find practices", subtitle: "Discover business prospects by specialty and location." },
  "/leads": { title: "Lead workspace", subtitle: "Clean, enrich, verify, and prepare business leads." },
  "/drafts": { title: "Email drafts", subtitle: "Review and refine personalized outreach before use." },
  "/integrations": { title: "Integrations", subtitle: "See which providers and CRM connections are configured." },
  "/settings": { title: "Credentials", subtitle: "Manage encrypted provider credentials and access." },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = pageInfo[location] ?? pageInfo["/"];

  if (loading) return <div className="login-screen"><div className="loading-line">Opening your secure workspace…</div></div>;
  if (!user) return <AuthScreen />;
  const isAdmin = user.role === "admin";
  const visibleNav = navItems.filter((item) => isAdmin || item.path !== "/settings");

  return (
    <div className="app-shell">
      {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-logo-frame"><img src="/evolve-healthcare-logo.png" alt="Evolve Healthcare Marketing" /></div>
          <div className="brand-word"><strong>Practice Pipeline</strong><span>Evolve · concept demo</span></div>
          <button className="icon-button" style={{ marginLeft: "auto", display: "none" }} aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button>
        </div>
        <div className="side-label">Workspace</div>
        <nav className="side-nav" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const active = location === item.path;
            const Icon = item.icon;
            return <button key={item.path} className={`nav-item ${active ? "active" : ""}`} onClick={() => { setLocation(item.path); setMobileOpen(false); }}>
              <Icon className="nav-icon" /><span>{item.label}</span>{item.path === "/leads" && <span className="nav-pill">CRM</span>}
            </button>;
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="workspace-status">
            <div className="workspace-status-top"><span><i className="online-dot" /> Secure workspace</span><ShieldCheck size={14} color="#7cff6b" /></div>
            <small>Independent concept demo · public business data only</small>
          </div>
          <nav className="sidebar-policy-links" aria-label="Public policies"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="https://ehmresults.com/" target="_blank" rel="noreferrer">Evolve Results site ↗</a></nav>
          <div className="user-card">
            <div className="user-avatar">{(user.name || user.email || "E").charAt(0).toUpperCase()}</div>
            <div className="user-meta"><strong>{user.name || (isAdmin ? "Evolve admin" : "Your account")}</strong><span>{user.email}</span></div>
            <button className="logout-btn" title="Sign out" aria-label="Sign out" onClick={() => void logout()}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={16} /></button>
            <div><h1>{current.title}</h1><p>{current.subtitle}</p></div>
          </div>
          <div className="topbar-right">
            <div className="topbar-tag"><ShieldCheck size={14} color="#7cff6b" /> {isAdmin ? "Administrator" : "Private to your account"}</div>
            <div className="topbar-tag"><BarChart3 size={14} /> Independent demo</div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
