const express = require("express");
const path = require("path");
const app = express();
const pub = path.join(__dirname, "public");
app.use(express.static(pub));
app.get("/health", (_req,res)=>res.json({ok:true}));
app.get("*", (_req,res)=>res.sendFile(path.join(pub,"index.html")));
const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log("dashboards-service on :"+port));