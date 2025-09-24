import React from "react";
export default function Header({ onGoLive }: { onGoLive?: () => void }) {
  return (
    <header className="js-header sticky top-0 z-40 w-full bg-app/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <span className="text-xs tracking-widest text-app-ink-dim">COGTECHAI · S1 MVP</span>
        <button className="btn btn-ghost rounded-2xl px-4 py-1.5 text-sm" onClick={onGoLive}>
          Go Live
        </button>
      </div>
    </header>
  );
}
