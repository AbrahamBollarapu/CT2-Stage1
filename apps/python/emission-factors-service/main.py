from fastapi import FastAPI
from typing import Dict, Any

app = FastAPI(title="emission-factors")

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

@app.get("/api/factors")
def factors(period: str = "2024Q4") -> Dict[str, Any]:
    return {
        "period": period,
        "factors": [
            {"scope": 2, "meter": "grid_kwh", "unit": "kgCO2e/kWh", "value": 0.82},
            {"scope": 1, "meter": "diesel_litre", "unit": "kgCO2e/L", "value": 2.68}
        ]
    }
