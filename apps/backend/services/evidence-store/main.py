import os
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from _shared.fastapi_trace import TraceMiddleware  # <-- tracing

DATABASE_URL = os.getenv('DATABASE_URL')
EVIDENCE_DIR = os.getenv('EVIDENCE_DIR', '/evidence')
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI()
app.add_middleware(TraceMiddleware)  # <-- tracing

class EvidenceIn(BaseModel):
    org_id: str
    sha256: str
    size: int
    mime: str
    path: str

@app.get('/health')
def health():
    with engine.connect() as c:
        c.execute(text('select 1'))
    return {"ok": True}

@app.post('/api/evidence')
def upsert_evidence(e: EvidenceIn):
    sql = '''insert into evidence(org_id, sha256, size, mime, path)
             values(:org_id, :sha256, :size, :mime, :path)
             on conflict(sha256) do update set size=excluded.size, mime=excluded.mime, path=excluded.path
             returning id'''
    with engine.begin() as c:
        rid = c.execute(text(sql), e.model_dump()).scalar()
    return {"id": str(rid)}

@app.head('/api/evidence/{eid}/content')
@app.get('/api/evidence/{eid}/content')
def get_bytes(eid: str):
    sql = 'select path, mime, size from evidence where id=:id'
    with engine.connect() as c:
        row = c.execute(text(sql), {"id": eid}).mappings().first()
    if not row:
        raise HTTPException(404, 'not found')
    path = row['path']
    if not os.path.exists(path):
        raise HTTPException(404, 'blob missing')
    data = b''
    # (HEAD handled by framework; we still compute headers)
    with open(path, 'rb') as f:
        data = f.read() if os.getenv('READ_BODY', '1') == '1' else b''
    headers = {"Content-Type": row['mime'], "Content-Length": str(row['size'])}
    return Response(content=data, headers=headers)
