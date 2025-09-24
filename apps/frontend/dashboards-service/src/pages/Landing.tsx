import React from "react";

type Props = {
  onGoLive?: () => void;
  secondaryCta?: () => void;
};

export default function Landing({ onGoLive, secondaryCta }: Props) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-14 md:py-16">
          <div className="max-w-3xl">
            <div className="kicker mb-2">MVP · S1</div>
            <h1 className="text-display font-semibold tracking-tight mb-3">
              Evidence-in. ESG-out. <span style={{ color: "var(--accent)" }}>Real-time.</span>
            </h1>
            <p className="text-lg text-muted max-w-2xl">
              Live ingestion, clean dashboards, investor-ready visuals—running on our microservices baseline.
            </p>
            <div className="mt-6 flex gap-3">
              <button className="btn btn-primary" onClick={onGoLive}>
                Go Live
              </button>
              <button
                className="btn btn-ghost"
                onClick={secondaryCta || (() => window.open("#", "_self"))}
              >
                View Reports
              </button>
            </div>
          </div>
        </div>

        {/* Background glows */}
        <div
          className="absolute -z-10 inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 400px at 10% -20%, rgba(11,132,255,.12), transparent 60%), radial-gradient(500px 300px at 80% -10%, rgba(0,194,168,.10), transparent 60%)",
          }}
        />
      </section>

      {/* Feature strip */}
      <section className="container pb-16 grid gap-6 md:grid-cols-3">
        <div className="ui-card p-5 shadow-soft">
          <div className="kicker mb-1">Edge</div>
          <div className="text-h2 font-semibold mb-2">Ingest</div>
          <p className="text-sm text-muted">
            Deterministic posting every 5s. Backdated timestamps ensure reads land within window.
          </p>
        </div>
        <div className="ui-card p-5 shadow-soft">
          <div className="kicker mb-1">Time-Series</div>
          <div className="text-h2 font-semibold mb-2">Store</div>
          <p className="text-sm text-muted">
            Auth-open for demo; fast reads over the last 15 minutes for a crisp live feel.
          </p>
        </div>
        <div className="ui-card p-5 shadow-soft">
          <div className="kicker mb-1">Dashboard</div>
          <div className="text-h2 font-semibold mb-2">Visualize</div>
          <p className="text-sm text-muted">
            Hyper-clean sparkline, tight hierarchy, and CTA that “just works”.
          </p>
        </div>
      </section>
    </div>
  );
}
