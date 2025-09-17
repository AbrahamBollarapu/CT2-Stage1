from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Data Quality Service")

class EvaluateRequest(BaseModel):
    account: str
    period: str

@app.get("/health")
def health():
    return {"ok": True, "ready": True}

@app.post("/evaluate")
def evaluate(req: EvaluateRequest):
    # demo implementation; replace with your real checks
    return {
        "ok": True,
        "account": req.account,
        "period": req.period,
        "score": 0.98,
        "issues": []
    }
