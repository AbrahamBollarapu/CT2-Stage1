from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="time-series")
store: Dict[str, List[Dict[str, Any]]] = {}

class Point(BaseModel):
    ts: str
    value: float

class IngestBody(BaseModel):
    org_id: str
    meter: str
    unit: str
    points: List[Point]

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

@app.post("/api/time-series/points")
def points(body: IngestBody):
    key = f"{body.org_id}:{body.meter}:{body.unit}"
    store.setdefault(key, [])
    store[key].extend([p.model_dump() for p in body.points])
    return {"ok": True, "count": len(body.points)}

@app.post("/api/time-series/ingest")
def alias_ingest(body: IngestBody):
    return points(body)
