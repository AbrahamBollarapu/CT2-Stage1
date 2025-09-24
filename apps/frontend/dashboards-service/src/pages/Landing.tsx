// apps/frontend/dashboards-service/src/pages/Landing.tsx
import React from "react";
import { AppShell } from "../components/layout/AppShell";
import { Page } from "../components/ui";
import { Button, Card, SectionHeader, Badge } from "../components/ui";

export default function Landing() {
  return (
    <AppShell>
      <section className="bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950">
        <Page>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                ESG/MRV that <span className="underline decoration-2 decoration-neutral-300">proves</span> your claims.
              </h1>
              <p className="mt-3 text-neutral-600 dark:text-neutral-300">
                Live data ingestion from devices, supplier-grade evidence, and KPI dashboards—with iXBRL-ready outputs.
              </p>
              <div className="mt-5 flex gap-3">
                <Button as="a" href="/app">Open Dashboard</Button>
                <Button variant="secondary" as="a" href="#pipeline">Live Pipeline</Button>
              </div>
              <div className="mt-4 flex gap-2">
                <Badge tone="success">Device feed live</Badge>
                <Badge>Investor-ready</Badge>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-2 blur-2xl opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black to-transparent" />
              <Card title="Live Throughput" subtitle="Edge → API → Time-Series → Dashboard">
                <div className="h-28 grid place-items-center text-sm text-neutral-500">Chart renders in /app</div>
              </Card>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Card><div className="text-xs">Suppliers<br/><span className="text-lg font-semibold">42</span></div></Card>
                <Card><div className="text-xs">Compliance<br/><span className="text-lg font-semibold">85.5%</span></div></Card>
                <Card><div className="text-xs">Devices Online<br/><span className="text-lg font-semibold">1</span></div></Card>
              </div>
            </div>
          </div>
        </Page>
      </section>

      <section id="pipeline" className="py-10">
        <Page>
          <SectionHeader title="Live pipeline" subtitle="Hardware → Gateway → API → Time-Series → KPIs → Dashboard" />
          <div className="grid md:grid-cols-5 gap-3">
            {["Hardware", "Edge Gateway", "API", "Time-Series", "Dashboard"].map((x, i) => (
              <Card key={x} className="text-center">
                <div className="text-sm font-medium">{x}</div>
                {i < 4 && <div className="mt-2 text-xs text-neutral-500">passes data</div>}
              </Card>
            ))}
          </div>
        </Page>
      </section>
    </AppShell>
  );
}
