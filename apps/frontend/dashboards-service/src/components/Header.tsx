import React from "react";

type Props = {
  onGoLive?: () => void;
};

export default function Header({ onGoLive }: Props) {
  return (
    <header
      // `.js-header` + `.header-shadow` are styled in theme.css
      className="js-header header-shadow sticky top-0 z-40 w-full bg-app/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-widest text-app-ink-dim">COGTECHAI · S1 MVP</span>
        </div>

        <button
          className="btn btn-ghost rounded-2xl px-4 py-1.5 text-sm"
          onClick={onGoLive}
        >
          Go Live
        </button>
      </div>
    </header>
  );
}
