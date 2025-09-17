import os, requests, collections, datetime as dt
from fastapi import FastAPI, Request
from _shared.fastapi_trace import TraceMiddleware, fwd_headers

TS_API = os.getenv('TS_API', 'http://time-series-service:8000')

app = FastAPI()
app.add_middleware(TraceMiddleware)  # tracing & correlation

@app.get('/health')
def h():
    return {"ok": True}

@app.get('/api/kpi/values')
def kpis(
    request: Request,
    meter: str,
    unit: str,
    period: str,
    org_id: str = '00000000-0000-0000-0000-000000000000'
):
    y, m = map(int, period.split('-'))
    start = dt.date(y, m, 1)
    end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)

    r = requests.get(
        f"{TS_API}/api/time-series/points",
        params={'meter': meter, 'unit': unit, 'org_id': org_id, 'from': start.isoformat(), 'to': end.isoformat()},
        headers=fwd_headers(request),
        timeout=10
    )
    items = r.json().get('items', [])
    if not items:
        return {'total_kwh': 0, 'avg_daily_kwh': 0, 'peak_day_kwh': 0}

    by_day = collections.defaultdict(float)
    for i in items:
        d = i['ts'][:10]  # YYYY-MM-DD
        by_day[d] += i['value']

    total = sum(by_day.values())
    avg = total / max(1, len(by_day))
    peak = max(by_day.values())

    return {
        'total_kwh': round(total, 2),
        'avg_daily_kwh': round(avg, 2),
        'peak_day_kwh': round(peak, 2)
    }
