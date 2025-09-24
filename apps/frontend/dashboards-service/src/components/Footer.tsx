import React from "react";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-app-ink-dim">
        © {new Date().getFullYear()} CogTechAI · Demo S1 · Trust • Transparency • Transformation
      </div>
    </footer>
  );
}
