import express from "express"; import bodyParser from "body-parser";
const app = express(); app.use(bodyParser.json({ limit: "2mb" }));
const PORT=process.env.PORT||8000, HOST=process.env.HOST||"0.0.0.0";
const PREFIX=process.env.SERVICE_PREFIX||"/api/kpi";
const GATEWAY=process.env.GATEWAY_URL||"http://traefik:8081";
let LAST={ at:null, kpis:[] };

app.get(PREFIX+"/health", (_req,res)=>res.json({ok:true,service:"kpi-calculation-service"}));

async function getESG(){ const r=await fetch(`${GATEWAY}/api/esg/metrics`); if(!r.ok) throw new Error(`esg metrics ${r.status}`); return r.json(); }
async function getTS(l=10000){ const r=await fetch(`${GATEWAY}/api/timeseries/query?limit=${l}`); if(!r.ok) throw new Error(`timeseries ${r.status}`); const j=await r.json(); return Array.isArray(j)?j:(j.value||[]); }
const pick=(m,key)=>{ const x=(m.metrics||m).find(y=>y.metric===key); return x?Number(x.value):0; };

app.post(PREFIX+"/compute-demo", async (_req,res)=>{
  try{
    const esg=await getESG(); const pts=await getTS(10000);
    const scope1=pick(esg,"scope1_co2e_demo"), scope2=pick(esg,"scope2_co2e_demo");
    const total=scope1+scope2;
    const grid=pts.filter(p=>p.metric==="grid_kwh").map(p=>Number(p.value));
    const gridAvg=grid.length ? grid.reduce((a,b)=>a+b,0)/grid.length : 0;
    LAST={ at:new Date().toISOString(), kpis:[
      { kpi:"total_co2e_demo", value: total, unit:"co2e" },
      { kpi:"grid_kwh_avg_demo", value: Number(gridAvg.toFixed(3)), unit:"kWh" }
    ]};
    res.json({ ok:true, ...LAST });
  }catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}); }
});
app.get(PREFIX+"/metrics", (_req,res)=>res.json(LAST));
app.listen(PORT,HOST,()=>console.log(`[kpi-calculation-service] listening on ${HOST}:${PORT} (prefix=${PREFIX})`));
