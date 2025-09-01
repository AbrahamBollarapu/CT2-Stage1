import express from "express"; import bodyParser from "body-parser";
const app = express(); app.use(bodyParser.json({ limit: "2mb" }));
const PORT=process.env.PORT||8000, HOST=process.env.HOST||"0.0.0.0";
const PREFIX=process.env.SERVICE_PREFIX||"/api/data-quality";
const GATEWAY=process.env.GATEWAY_URL||"http://traefik:8081";

let RULES=[
  { id:"grid_points_min_6", type:"points-min", metric:"grid_kwh", min:6 },
  { id:"diesel_points_min_6", type:"points-min", metric:"diesel_l", min:6 },
  { id:"no_negatives", type:"non-negative", metrics:["grid_kwh","diesel_l"] }
];

app.get(PREFIX+"/health", (_req,res)=>res.json({ok:true,service:"data-quality-service"}));
app.get(PREFIX+"/rules", (_req,res)=>res.json({ok:true,rules:RULES}));
app.post(PREFIX+"/rules",(req,res)=>{ if(!Array.isArray(req.body)) return res.status(400).json({ok:false,error:"expected array"}); RULES=req.body; res.json({ok:true,count:RULES.length}); });

async function fetchTS(limit=10000){ const r=await fetch(`${GATEWAY}/api/timeseries/query?limit=${limit}`); if(!r.ok) throw new Error(`timeseries ${r.status}`); const j=await r.json(); return Array.isArray(j)?j:(j.value||[]); }
function evalRules(points){
  const by=points.reduce((m,p)=>((m[p.metric]??=[]).push(p),m),{});
  const items=RULES.map(rule=>{
    if(rule.type==="points-min"){ const c=(by[rule.metric]||[]).length; return {id:rule.id,title:`≥${rule.min} points for ${rule.metric}`,status:c>=rule.min?"green":"red",details:{count:c}};}
    if(rule.type==="non-negative"){ const bad=(rule.metrics||[]).flatMap(m=>(by[m]||[]).filter(p=>p.value<0)); return {id:rule.id,title:`no negatives for ${rule.metrics.join(", ")}`,status:bad.length? "red":"green",details:{violations:bad.length}};}
    return {id:rule.id, title:rule.type, status:"unknown"};
  });
  const green=items.filter(i=>i.status==="green").length, red=items.filter(i=>i.status==="red").length;
  return {ok:true, summary:{green,red,total:items.length}, items};
}
app.get(PREFIX+"/heatmap", async (_req,res)=>{ try{ const pts=await fetchTS(10000); res.json(evalRules(pts)); }catch(e){ res.status(500).json({ok:false,error:String(e.message||e)}); }});
app.listen(PORT,HOST,()=>console.log(`[data-quality-service] listening on ${HOST}:${PORT} (prefix=${PREFIX})`));
