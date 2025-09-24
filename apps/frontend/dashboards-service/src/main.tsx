import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function useScrollShadow() {
  React.useEffect(() => {
    const el = document.querySelector(".js-header");
    if (!el) return;
    const onScroll = () => el.classList.toggle("is-scrolled", window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

function Root() {
  useScrollShadow();
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);