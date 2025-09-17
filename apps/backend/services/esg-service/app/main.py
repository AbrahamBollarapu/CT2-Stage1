from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ESG Service")

class ComputeRequest(BaseModel):
    account: str
    period: str

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

@app.post("/compute")
def compute(req: ComputeRequest):
    # demo implementation; replace with your real logic
    return {
        "ok": True,
        "account": req.account,
        "period": req.period,
        "metrics": {"co2e": 123.45}
    }
