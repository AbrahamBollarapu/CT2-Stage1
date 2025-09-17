from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any
app = FastAPI()
class MapReq(BaseModel):
    metrics: Dict[str, Any] = {}
@app.get("/health")                 def root(): return {"ok": True}
@app.get("/api/xbrl/health")        def api():  return {"ok": True}
@app.post("/api/xbrl/map")          def map_metrics(req: MapReq):
    return {"mapped": [{"name": k, "lineItem": f"LI_{k.upper()}"} for k in req.metrics.keys()]}