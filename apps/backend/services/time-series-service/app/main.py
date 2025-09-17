from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="time-series-service")

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

class Point(BaseModel):
    ts: str
    value: float

class IngestBody(BaseModel):
    org_id: str
    meter: str
    unit: str
    points: List[Point]

# Demo ingest endpoint
@app.post("/points")
def points(body: IngestBody):
    return {"ok": True, "count": len(body.points)}

# Optional alias used by smoke script variants
@app.post("/ingest")
def ingest(body: IngestBody):
    return {"ok": True, "count": len(body.points)}
