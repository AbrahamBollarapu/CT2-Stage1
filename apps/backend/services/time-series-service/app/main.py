# D:/CT2/apps/backend/services/time-series-service/app/main.py
from fastapi import FastAPI, APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timezone
import uvicorn

app = FastAPI(title="time-series-service", version="1.1.0")

# --- In-memory store (demo-safe) ---
# Keyed by (org_id, meter, unit) -> list[dict(ts:str, value:float)]
STORE: Dict[Tuple[str, str, str], List[Dict]] = {}

# --- Models ---
class Point(BaseModel):
    ts: str = Field(..., description="ISO8601 (e.g. 2024-11-05T00:00:00Z)")
    value: float

class IngestBody(BaseModel):
    org_id: str
    meter: str
    unit: str
    points: List[Point]

# --- Utilities ---
def _parse_iso(dt: str) -> datetime:
    try:
        if dt.endswith("Z"):
            return datetime.fromisoformat(dt.replace("Z", "+00:00"))
        return datetime.fromisoformat(dt)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid timestamp: {dt}")

def _key(org_id: str, meter: str, unit: str) -> Tuple[str, str, str]:
    return (org_id.strip(), meter.strip(), unit.strip())

def _ingest(body: IngestBody) -> Dict:
    k = _key(body.org_id, body.meter, body.unit)
    series = STORE.setdefault(k, [])
    for p in body.points:
        _ = _parse_iso(p.ts)  # validate
        series.append({"ts": p.ts, "value": float(p.value)})
    series.sort(key=lambda r: _parse_iso(r["ts"]))
    return {"ok": True, "ingested": len(body.points), "series_size": len(series)}

def _read(
    org_id: str,
    meter: str,
    unit: str,
    frm: Optional[str],
    to: Optional[str],
) -> Dict:
    k = _key(org_id, meter, unit)
    series = STORE.get(k, [])

    dt_from = _parse_iso(frm) if frm else None
    dt_to = _parse_iso(to) if to else None

    def _in_window(rec):
        dt = _parse_iso(rec["ts"])
        if dt_from and dt < dt_from:
            return False
        if dt_to and dt > dt_to:
            return False
        return True

    out = [r for r in series if _in_window(r)]
    out.sort(key=lambda r: _parse_iso(r["ts"]))
    return {
        "ok": True,
        "org_id": org_id,
        "meter": meter,
        "unit": unit,
        "count": len(out),
        "points": out,
    }

# --- Routers ---
# Prefixed router (when Traefik does NOT strip)
api_router = APIRouter(prefix="/api/time-series", tags=["time-series"])

# Unprefixed router (compat when Traefik StripPrefix(`/api/time-series`) is enabled)
root_router = APIRouter(tags=["time-series-compat"])

# --- Health ---
@api_router.get("/health")
@root_router.get("/health")  # compatibility
def health():
    return {"ok": True, "service": "time-series", "ts": datetime.now(timezone.utc).isoformat()}

# --- POST /points (ingest) ---
@api_router.post("/points")
@root_router.post("/points")  # compatibility
def ingest_points(body: IngestBody, x_api_key: Optional[str] = Header(None)):  # noqa: ARG002 (demo auth)
    return _ingest(body)

# --- GET /points (reader) ---
@api_router.get("/points")
@root_router.get("/points")  # compatibility
def read_points(
    org_id: str = Query(...),
    meter: str  = Query(...),
    unit: str   = Query(...),
    frm: Optional[str] = Query(None, alias="from"),
    to: Optional[str]  = Query(None),
    x_api_key: Optional[str] = Header(None),  # noqa: ARG002
):
    return _read(org_id, meter, unit, frm, to)

# Mount both routers
app.include_router(api_router)
app.include_router(root_router)

# Optional: local run
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
