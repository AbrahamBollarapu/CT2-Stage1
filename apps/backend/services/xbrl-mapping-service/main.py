import os, json, glob
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from _shared.fastapi_trace import TraceMiddleware

REPORT_DIR = os.getenv('REPORT_DIR', '/reports')

app = FastAPI()
app.add_middleware(TraceMiddleware)  # tracing & correlation

@app.get('/health')
def h():
    return {"ok": True}

@app.get('/api/xbrl/coverage')
def cov(org_id: str, period: str):
    # demo: read last coverage if exists
    paths = sorted(glob.glob(os.path.join(REPORT_DIR, 'rep_*', 'coverage.json')))
    if not paths:
        return JSONResponse({"score": 5, "errors": 0, "warnings": 0, "log_url": None})

    with open(paths[-1], 'r') as f:
        data = json.load(f)

    # pretend validation.log alongside
    log_url = paths[-1].replace(REPORT_DIR, '/reports').replace('coverage.json', 'validation.log')
    data['log_url'] = log_url
    return data
