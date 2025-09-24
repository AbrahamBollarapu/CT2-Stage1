import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import "./styles/theme.css";

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

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Mount element #root not found");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

requestAnimationFrame(installHeaderScrollShadow);
