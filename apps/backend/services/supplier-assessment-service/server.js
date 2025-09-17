const express = require("express");
const app = express(); app.use(express.json());
const assessments = new Map(); const runs = new Map();

app.get("/health", (_q,r)=>r.json({ok:true}));
app.get("/api/assessments/health", (_q,r)=>r.json({ok:true}));

// create a simple assessment (optional)
app.post("/api/assessments", (req,res)=>{
  const id = "asm_" + Date.now();
  assessments.set(id, { id, ...req.body });
  res.json({ id, ...req.body });
});

// run an assessment for a supplier
app.post("/api/assessments/run", (req,res)=>{
  const runId = "run_" + Date.now();
  // naive score: sum boolean=1*weight
  const answers = req.body?.responses || [];
  const score = answers.reduce((s,a)=> s + ((a.value===true?1:0) * (a.weight||1)), 0);
  runs.set(runId, { runId, supplier_id: req.body?.supplier_id, score, snapshot: { answers }});
  res.json({ runId, status:"completed", score });
});

app.get("/api/assessments/:id", (req,res)=>{
  const a = assessments.get(req.params.id);
  if(!a) return res.status(404).json({error:"not_found"});
  res.json(a);
});

const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log("supplier-assessment-service on :"+port));