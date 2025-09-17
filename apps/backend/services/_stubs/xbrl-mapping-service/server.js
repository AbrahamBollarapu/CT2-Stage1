const express = require("express");
const app = express(); app.use(express.json());
app.get("/api/xbrl/health", (_q,r)=>r.json({ok:true,svc:"xbrl"}));
app.post("/api/xbrl/map", (req,res)=>res.json({ok:true, mapped:true, sample:req.body||{}}));
const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log("xbrl-mapping-service stub on :"+port));