// server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "ct2-dev-key";

app.get("/health", (_req, res) => res.json({ ok: true, ready: true }));

// Simple landing page with a Reports card
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>CT2 Demo</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;background:#0b0c10;color:#e6edf3}
  .card{background:#111318;border:1px solid #1f2329;border-radius:16px;padding:20px;max-width:640px;box-shadow:0 0 0 1px #000 inset}
  button{padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#1f6feb;color:white;cursor:pointer}
  button[disabled]{opacity:.6;cursor:not-allowed}
  .row{display:flex;gap:12px;align-items:center;margin-top:12px}
  a{color:#6ab7ff}
</style>
</head>
<body>
  <h1>CT2 Demo</h1>

  <div class="card">
    <h2>Reports</h2>
    <p>Build the Truststrip PDF, poll for completion, then view.</p>
    <div class="row">
      <button id="buildBtn">Build report</button>
      <span id="status"></span>
    </div>
    <div class="row" id="viewRow" style="display:none">
      <a id="viewLink" target="_blank" rel="noopener">▶ View PDF</a>
    </div>
  </div>

<script>
const API_KEY="${API_KEY}";
const Base = "";

const $ = (id)=>document.getElementById(id);
$("buildBtn").onclick = async () => {
  $("buildBtn").disabled = true;
  $("status").textContent = "Starting build...";
  try {
    const r = await fetch(\`\${Base}/api/reports/build\`, {
      method:"POST",
      headers: { "Content-Type":"application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ template:"truststrip", period:"2024Q4" })
    });
    const { artifactId } = await r.json();
    $("status").textContent = "Queued. Polling status...";
    const deadline = Date.now()+60000;
    let status="queued";
    while (Date.now()<deadline && status!=="completed") {
      await new Promise(r=>setTimeout(r,600));
      const s = await fetch(\`\${Base}/api/reports/status/\${artifactId}\`, { headers: { "x-api-key": API_KEY }});
      const j = await s.json();
      status = j.status || "unknown";
      $("status").textContent = "Status: "+status;
    }
    if (status !== "completed") throw new Error("Timed out");
    $("viewRow").style.display="";
    $("viewLink").href = \`\${Base}/api/reports/artifacts/\${artifactId}\`;
    $("viewLink").textContent = "▶ View PDF";
    $("status").textContent = "Completed.";
  } catch (e) {
    $("status").textContent = "Error: " + e;
  } finally {
    $("buildBtn").disabled = false;
  }
};
</script>
</body></html>`);
});

app.listen(PORT, () => console.log(`dashboards-service listening on :${PORT}`));
