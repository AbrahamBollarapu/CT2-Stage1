const express = require("express");
const { nanoid } = require("nanoid");
const app = express(); app.use(express.json());
app.get("/api/jobs/health", (_q,r)=>r.json({ok:true,svc:"jobs"}));
app.post("/api/jobs/trigger", (req,res)=>res.json({ok:true, jobId:nanoid(8), payload:req.body||{}}));
const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log("jobs-service stub on :"+port));