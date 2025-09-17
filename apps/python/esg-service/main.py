from fastapi import FastAPI
from pydantic import BaseModel
app = FastAPI(title="esg-demo")

class Body(BaseModel):
    account: str
    period: str

@app.get("/health")            # internal
def health(): return {"ok": True, "ready": True}

@app.get("/api/esg/health")    # via Traefik rule prefix
def api_health(): return {"ok": True, "ready": True}

@app.post("/api/esg/compute")
def compute(body: Body):
    return {"ok": True, "account": body.account, "period": body.period, "computed": True}
