from fastapi import FastAPI

app = FastAPI(title="emission-factors-service")

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

@app.get("/list")
def list_factors():
    return {
        "ok": True,
        "factors": [
            {"code": "GRID_IN", "unit": "kgCO2e/kWh", "value": 0.82},
            {"code": "DIESEL", "unit": "kgCO2e/litre", "value": 2.68},
        ],
    }
