import express from "express";
const app=express(); app.use(express.json({limit:"1mb"}));
const PREFIX="/api/kpi"; const TS_API=process.env.TS_API||"http://time-series-service:8000";
app.get("/health",(_q,r)=>r.json({ok:true,service:"kpi",root:true}));
app.get(`${PREFIX}/health`,(_q,r)=>r.json({ok:true,service:"kpi"}));

function toIso(v){ if(!v)return; if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+"T00:00:00Z").toISOString(); const d=new Date(v); if(isNaN(d.getTime())) throw new Error("bad ts"); return d.toISOString(); }

// GET /api/kpi/energy?org_id=&meter=&unit=&from=&to=
app.get(`${PREFIX}/energy`, async (req,res)=>{
  try{
    const {org_id,meter,unit,from,to}=req.query;
    if(!org_id||!meter||!unit) return res.status(400).json({error:"org_id, meter, unit required"});
    const u=new URL("/api/time-series/points", TS_API);
    u.searchParams.set("org_id",org_id); u.searchParams.set("meter",meter); u.searchParams.set("unit",unit);
    if(from) u.searchParams.set("from",String(from)); if(to) u.searchParams.set("to",String(to));
    const r=await fetch(u); if(!r.ok) return res.status(r.status).json({error:`TS ${r.status}`});
    const js=await r.json(); const kWh=(js.points||[]).reduce((s,p)=>s+Number(p.value||0),0);
    res.json({ ok:true, meter, unit, from:from?toIso(from):undefined, to:to?toIso(to):undefined, energy_kWh:kWh });
  }catch(e){ res.status(500).json({error:e.message}); }
});

const PORT=Number(process.env.PORT||8000);
app.listen(PORT,"0.0.0.0",()=>console.log(`[kpi] listening on ${PORT} (TS_API=${TS_API})`));
