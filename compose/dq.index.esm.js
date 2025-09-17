import express from "express";

function trace(req,res,next){
  const r=()=>Math.random().toString(16).slice(2);
  const inc=req.header("traceparent"); const tid=inc?.split("-")[1]||(r()+r()).slice(0,32).padEnd(32,"0");
  const pid=inc?.split("-")[2]||"".padEnd(16,"0"); const tp=`00-${tid}-${pid}-01`; const corr=req.header("x-correlation-id")||r().slice(0,12);
  req._traceparent=tp; req._corr=corr; res.setHeader("traceparent",tp); res.setHeader("x-correlation-id",corr);
  const t0=Date.now(); res.on("finish",()=>console.log(`[trace=${tp}] [corr=${corr}] ${req.method} ${req.path} ${res.statusCode} ${Date.now()-t0}ms`)); next();
}

const app = express();
app.use(trace); app.use(express.json({limit:"1mb"}));

const PREFIX="/api/data-quality";
const TS_API=process.env.TS_API||"http://time-series-service:8000";

app.get("/health", (_q,r)=>r.json({ok:true, service:"dq", root:true}));
app.get(`${PREFIX}/health`, (_q,r)=>r.json({ok:true, service:"dq"}));

app.post(`${PREFIX}/checks`, async (req,res)=>{
  try{
    const {org_id,meter,unit,from,to}=req.body||{};
    if(!org_id||!meter||!unit) return res.status(400).json({error:"org_id, meter, unit required"});
    const u=new URL("/api/time-series/points", TS_API);
    u.searchParams.set("meter",meter); u.searchParams.set("unit",unit); u.searchParams.set("org_id",org_id);
    if(from) u.searchParams.set("from",from); if(to) u.searchParams.set("to",to);
    const r=await fetch(u,{headers:{traceparent:req._traceparent,"x-correlation-id":req._corr}});
    if(!r.ok) return res.status(r.status).json({error:`TS fetch ${r.status}`});
    const js=await r.json(); const pts=js.points||[];

    const negatives = pts.filter(p=>Number(p.value)<0).map(p=>p.ts);
    const nonNumeric = pts.filter(p=>isNaN(Number(p.value))).map(p=>p.ts);

    res.json({
      ok:true,
      count: pts.length,
      issues: {
        negatives: { count: negatives.length, at: negatives },
        nonNumeric:{ count: nonNumeric.length, at: nonNumeric }
      }
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

const PORT=Number(process.env.PORT||8000);
app.listen(PORT,"0.0.0.0",()=>console.log(`[dq] listening on ${PORT} (TS_API=${TS_API})`));
