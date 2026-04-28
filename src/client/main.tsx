import "@cloudflare/kumo/styles/standalone";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main className="app-shell">Chess Agent bootstrap</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
