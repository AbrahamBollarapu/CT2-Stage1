from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi import Query
from datetime import datetime
# CHANGE THIS LINE: Remove the dot for absolute import
from storage import save_parquet, read_parquet
import pandas as pd

# Global in-memory store for demo compatibility (keeps your existing logic intact)
POINTS: List[Dict[str, Any]] = getattr(__import__("builtins"), "__dict__").setdefault("_TS_POINTS", [])  # cross-worker safe en

app = FastAPI(title="time-series-service")

@app.get("/points")
def get_points(
    org_id: str, meter: str, unit: str,
    time_from: Optional[str] = Query(None, alias="from"),
    time_to:   Optional[str] = Query(None, alias="to")
):
    # First try to get data from parquet storage
    try:
        filename = f"{org_id}_{meter}.parquet"
        df = read_parquet(filename)
        
        # Apply time filters if provided
        if time_from:
            df = df[df['timestamp'] >= time_from]
        if time_to:
            df = df[df['timestamp'] <= time_to]
            
        # Convert to list of points
        points = [
            {"ts": row['timestamp'], "value": row['value']}
            for _, row in df.iterrows()
            if row['unit'] == unit
        ]
        
        return {"ok": True, "points": points, "source": "parquet"}
        
    except FileNotFoundError:
        # Fallback to in-memory storage if parquet file doesn't exist
        def ts_ok(ts: str) -> bool:
            if time_from and ts < time_from: return False
            if time_to   and ts > time_to:   return False
            return True
        
        data = [p for p in POINTS if p["org_id"]==org_id and p["meter"]==meter and p["unit"]==unit and ts_ok(p["ts"])]
        return {"ok": True, "points": data, "source": "memory"}

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

# Demo ingest endpoint - saves to both memory (for compatibility) and parquet
@app.post("/points")
def points(body: IngestBody):
    # Add to in-memory store for compatibility
    for point in body.points:
        POINTS.append({
            "org_id": body.org_id,
            "meter": body.meter,
            "unit": body.unit,
            "ts": point.ts,
            "value": point.value
        })
    
    # Save to parquet storage
    try:
        filename = f"{body.org_id}_{body.meter}.parquet"
        
        # Prepare new data
        new_data = pd.DataFrame({
            'timestamp': [p.ts for p in body.points],
            'value': [p.value for p in body.points],
            'unit': [body.unit for _ in body.points]
        })
        
        # Read existing data if file exists
        try:
            df_existing = read_parquet(filename)
            df_combined = pd.concat([df_existing, new_data]).drop_duplicates(subset=['timestamp']).sort_values('timestamp')
        except FileNotFoundError:
            df_combined = new_data
        
        # Save back to parquet
        save_parquet(df_combined, filename)
        
    except Exception as e:
        # Don't fail the request if parquet save fails, just log it
        print(f"Warning: Failed to save to parquet: {str(e)}")
    
    return {"ok": True, "count": len(body.points)}

# Optional alias used by smoke script variants
@app.post("/ingest")
def ingest(body: IngestBody):
    return points(body)  # Reuse the same logic