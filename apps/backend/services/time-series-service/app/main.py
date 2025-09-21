# apps/backend/services/time-series-service/app/main.py
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import os
import pandas as pd

app = FastAPI(title="time-series-service")

DATA_DIR = os.environ.get("DATA_DIR", "/data")
PARQUET_PATH = os.path.join(DATA_DIR, "points.parquet")
JSONL_PATH = os.path.join(DATA_DIR, "points.jsonl")

# -----------------------------
# Models
# -----------------------------
class InPoint(BaseModel):
    ts: datetime
    metric: str
    value: float

class IngestRequest(BaseModel):
    org_id: str
    meter: str
    unit: str
    points: List[InPoint]

class QueryPoint(BaseModel):
    ts: datetime
    metric: str
    value: float
    org_id: str
    meter: Optional[str] = None
    unit: Optional[str] = None

class QueryResponse(BaseModel):
    ok: bool = True
    count: int
    points: List[QueryPoint]

# -----------------------------
# Helpers
# -----------------------------
def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def _df_from_storage() -> pd.DataFrame:
    """
    Read whichever store exists; prefer Parquet if present.
    Expected columns: org_id, meter, unit, metric, value, ts (datetime64[ns, UTC])
    """
    if os.path.exists(PARQUET_PATH):
        df = pd.read_parquet(PARQUET_PATH)
    elif os.path.exists(JSONL_PATH):
        df = pd.read_json(JSONL_PATH, lines=True)
    else:
        # empty frame with correct dtypes
        df = pd.DataFrame(
            columns=["org_id", "meter", "unit", "metric", "value", "ts"]
        )

    if "ts" in df.columns and not pd.api.types.is_datetime64_any_dtype(df["ts"]):
        df["ts"] = pd.to_datetime(df["ts"], utc=True, errors="coerce")
    return df

def _append_to_storage(df: pd.DataFrame):
    _ensure_dir()
    # write Parquet as canonical; keep JSONL as backup/inspection
    if len(df) == 0:
        return
    # Append logic: read old, concat, dropna on ts, sort
    old = _df_from_storage()
    all_df = pd.concat([old, df], ignore_index=True)
    all_df = all_df.dropna(subset=["ts"])
    all_df = all_df.sort_values("ts")
    all_df.to_parquet(PARQUET_PATH, index=False)
    # also write/overwrite jsonl (not strictly append to keep it simple)
    all_df.to_json(JSONL_PATH, orient="records", lines=True, date_format="iso")

def _parse_range(range_str: Optional[str]) -> datetime:
    """Return a UTC 'since' timestamp from compact ranges like 15m, 1h, 24h, 7d…"""
    now = datetime.now(timezone.utc)
    if not range_str:
        return now - timedelta(hours=24)

    try:
        num = int(range_str[:-1])
        unit = range_str[-1].lower()
        if unit == "m":
            return now - timedelta(minutes=num)
        if unit == "h":
            return now - timedelta(hours=num)
        if unit == "d":
            return now - timedelta(days=num)
        if unit == "w":
            return now - timedelta(weeks=num)
        # fall back to hours if weird unit
        return now - timedelta(hours=int(range_str))
    except Exception:
        # Accept ISO-8601 “range” fallback like “PT1H”? If unrecognized, default 24h
        return now - timedelta(hours=24)

# -----------------------------
# Routes
# -----------------------------
@app.get("/health")
def health():
    return {"ok": True, "service": "time-series", "ts": datetime.now(timezone.utc).isoformat()}

@app.post("/api/time-series/points")
def ingest_points(body: IngestRequest):
    # normalize payload to DF
    rows = []
    for p in body.points:
        rows.append({
            "org_id": body.org_id,
            "meter": body.meter,
            "unit": body.unit,
            "metric": p.metric,
            "value": float(p.value),
            "ts": pd.to_datetime(p.ts, utc=True)
        })
    df = pd.DataFrame(rows)
    _append_to_storage(df)
    return {"ok": True, "ingested": len(df), "series_size": len(_df_from_storage())}

@app.get("/api/time-series/query", response_model=QueryResponse)
def query_points(
    org_id: str = Query(..., description="Organization id"),
    metric: str = Query(..., description="Metric name (e.g., demo.kwh)"),
    meter: Optional[str] = Query(None, description="Optional meter id"),
    since: Optional[datetime] = Query(None, description="ISO-8601 timestamp"),
    range: Optional[str] = Query(None, description="Window like 15m,1h,24h,7d"),
    limit: int = Query(1000, ge=1, le=10000),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    df = _df_from_storage()
    if df.empty:
        return {"ok": True, "count": 0, "points": []}

    # filters
    df = df[df["org_id"] == org_id]
    df = df[df["metric"] == metric]
    if meter:
        df = df[df["meter"] == meter]

    # time filter
    if since:
        since_dt = pd.to_datetime(since, utc=True, errors="coerce")
    else:
        since_dt = _parse_range(range)

    if pd.notna(since_dt):
        df = df[df["ts"] >= since_dt]

    if df.empty:
        return {"ok": True, "count": 0, "points": []}

    # sort & limit
    df = df.sort_values("ts", ascending=(order == "asc")).head(limit)

    # shape response
    points = [
        QueryPoint(
            ts=row.ts.to_pydatetime().replace(tzinfo=timezone.utc),
            metric=row.metric,
            value=float(row.value),
            org_id=row.org_id,
            meter=row.meter if "meter" in df.columns else None,
            unit=row.unit if "unit" in df.columns else None,
        ) for row in df.itertuples(index=False)
    ]

    return {"ok": True, "count": len(points), "points": points}
# --- add below the existing /health route in apps/backend/services/time-series-service/app/main.py ---

@app.get("/api/time-series/health")
def health_alias():
    # reuse the same data as /health
    return health()
