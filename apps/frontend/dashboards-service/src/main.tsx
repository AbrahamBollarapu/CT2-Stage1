import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import "./styles/theme.css";

// Find #root or #app. Create #root if missing.
function getMountNode(): HTMLElement {
  const el = document.querySelector<HTMLElement>("#root, #app");
  if (el) return el;
  const created = document.createElement("div");
  created.id = "root";
  document.body.appendChild(created);
  return created;
}

function installHeaderScrollShadow() {
  const handler = () => {
    const h = document.querySelector<HTMLElement>(".js-header");
    if (!h) return;
    if (window.scrollY > 8) h.classList.add("is-scrolled");
    else h.classList.remove("is-scrolled");
  };
  window.removeEventListener("scroll", handler);
  window.addEventListener("scroll", handler, { passive: true });
  handler();
}

const mount = () => {
  const node = getMountNode();
  const root = ReactDOM.createRoot(node);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  requestAnimationFrame(installHeaderScrollShadow);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
