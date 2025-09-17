from fastapi import FastAPI
from pydantic import BaseModel
app = FastAPI(title="dq-demo")

class Body(BaseModel):
    account: str
    period: str

@app.get("/health")
def health(): return {"ok": True, "ready": True}

@app.get("/api/data-quality/health")
def api_health(): return {"ok": True, "ready": True}

@app.post("/api/data-quality/evaluate")
def evaluate(body: Body):
    return {"ok": True, "evaluated": True, "account": body.account, "period": body.period}
