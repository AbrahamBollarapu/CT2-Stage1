import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0f1221 0%,#0b0e1a 100%)", color: "#fff" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="#76e4f7" strokeWidth="2" />
            <path d="M7 13.5L11 8l3 3 3-1.5" stroke="#76e4f7" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <strong>CogTechAI</strong>
        </div>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link to="/app" style={{ color: "#c7d2fe", textDecoration: "none" }}>Dashboard</Link>
          <Link to="/suppliers" style={{ color: "#c7d2fe", textDecoration: "none" }}>Suppliers</Link>
          <a href="#contact" style={{ color: "#c7d2fe", textDecoration: "none" }}>Contact</a>
        </nav>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "rgba(118,228,247,0.12)", border: "1px solid rgba(118,228,247,0.3)", marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#76e4f7" }} />
              <span style={{ color: "#76e4f7", fontSize: 12 }}>S1 MVP • Live demo</span>
            </div>
            <h1 style={{ fontSize: 42, lineHeight: 1.1, margin: "8px 0 12px" }}>
              Real-time ESG Evidence → <span style={{ color: "#76e4f7" }}>Trust-ready</span> KPIs & Reports
            </h1>
            <p style={{ opacity: 0.9, fontSize: 18, maxWidth: 720 }}>
              Ingest utilities & IoT, compute KPIs, and produce iXBRL-ready outputs. Transparent coverage with our TrustStrip badge.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              <Link to="/app" style={ctaPrimary}>Open Live Dashboard</Link>
              <a href="#contact" style={ctaSecondary}>Talk to us</a>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
              {["Real-time TS", "KPI Engine", "Suppliers", "Reports"].map((t) => (
                <Badge key={t} label={t} />
              ))}
            </div>
          </div>

          <div>
            <div style={glassCard}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Live KPIs</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MiniStat title="Total Suppliers" value="42" />
                <MiniStat title="Compliance Score" value="85.5" />
              </div>
              <div style={{ height: 12 }} />
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Throughput (48h)</div>
              <div style={{ height: 120, background: "linear-gradient(180deg,rgba(118,228,247,0.15),transparent)", borderRadius: 12 }} />
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>* Demo data</div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          <SmallCard title="Evidence-first" text="Every KPI traceable to sources: meters, invoices, and device logs." />
          <SmallCard title="Verifiable" text="iXBRL mapping & TrustStrip coverage badge for investor-grade confidence." />
          <SmallCard title="Deployable" text="Dockerized microservices and Traefik routing for clean ops." />
        </section>
      </main>

      <footer id="contact" style={{ padding: "32px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.85 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>© {new Date().getFullYear()} CogTechAI</div>
          <div>Email: <a style={{ color: "#c7d2fe" }} href="mailto:hello@cogtech.ai">hello@cogtech.ai</a></div>
        </div>
      </footer>
    </div>
  );
}

const ctaPrimary: React.CSSProperties = {
  background: "#76e4f7",
  color: "#081120",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 600,
  textDecoration: "none",
};
const ctaSecondary: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 12,
  textDecoration: "none",
};
const glassCard: React.CSSProperties = {
  background: "linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

function Badge({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 12, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {label}
    </span>
  );
}
function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
function SmallCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.85 }}>{text}</div>
    </div>
  );
}
