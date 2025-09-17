import express from "express";
const app = express();
app.get("/health", (_,res)=>res.json({ok:true,ready:true}));
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Inter,Arial;padding:24px} .badge{padding:4px 8px;border-radius:8px;background:#e6f4ff;}</style>
</head><body><h1>${title}</h1>${body}<hr/><p><span class="badge">S1</span> <span class="badge">S2</span> <span class="badge">S3</span></p></body></html>`;
app.get("/landing", (_,res)=>res.send(page("CogTechAI — Landing", `<p>Evidence-first ESG → Zero-Error iXBRL</p><a href="/dashboard">Go to Dashboard</a>`)));
app.get("/dashboard", (_,res)=>res.send(page("Dashboard",
  `<ul>
     <li>Ingest: <strong>pending</strong></li>
     <li>ESG: <strong>ready</strong></li>
     <li>DQ: <strong>ready</strong></li>
     <li>Report: <strong>pending</strong></li>
   </ul>
   <form method="post" action="/run"><button type="submit">Run Demo</button></form>`)));
app.post("/run", (_,res)=>res.redirect("/dashboard"));
app.get("/evidence/:id", (req,res)=>res.send(page(\`Evidence \${req.params.id}\`, `<a href="/dashboard">Back</a>`)));
app.get("/suppliers", (_,res)=>res.send(page("Suppliers", `<p>Seeded suppliers will show here.</p>`)));
const port = process.env.PORT || 8000;
app.listen(port, ()=>console.log(`dashboards-service on :${port}`));
