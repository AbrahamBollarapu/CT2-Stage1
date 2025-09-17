import express from "express";
const app=express(); app.use(express.json({limit:"1mb"}));
const PREFIX="/api/jobs";
const ESG_API=process.env.ESG_API||"http://esg-service:8000";

app.get(`${PREFIX}/health`,(_q,r)=>r.json({ok:true,service:"jobs"}));

// POST /api/jobs/run { job:"esg_monthly", params:{org_id,meter,unit,from,to} }
app.post(`${PREFIX}/run`, async (req,res)=>{
  try{
    const {job, params}=req.body||{};
    if(job!=="esg_monthly") return res.status(400).json({error:"unknown job"});
    const r=await fetch(`${ESG_API}/api/esg/footprint`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(params||{})});
    const js=await r.json(); if(!r.ok) return res.status(r.status).json(js);
    res.json({ ok:true, job, result: js });
  }catch(e){ res.status(500).json({error:e.message}); }
});
const PORT=Number(process.env.PORT||8000);
app.listen(PORT,"0.0.0.0",()=>console.log(`[jobs] listening on ${PORT} (ESG_API=${ESG_API})`));
