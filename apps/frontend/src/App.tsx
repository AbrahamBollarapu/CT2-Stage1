import { useEffect, useMemo, useState } from 'react'
import SuppliersCard from './components/SuppliersCard'

const API = (import.meta.env.VITE_API_BASE as string) || '/api'
const toJSON = (r: Response) => r.json()

function HealthBadge({ name, ok }: { name: string; ok: boolean | null }) {
  const color = ok == null ? 'bg-gray-300' : ok ? 'bg-emerald-500' : 'bg-red-500'
  return <span className={`text-white text-xs px-2 py-1 rounded ${color}`}>{name}</span>
}

export default function App() {
  const [tab, setTab] = useState<'landing'|'demo'>('landing')
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CT2 — Climate Tech Demo</h1>
        <nav className="space-x-2">
          <button className={`px-3 py-1 rounded ${tab==='landing'?'bg-black text-white':'bg-gray-200'}`} onClick={()=>setTab('landing')}>Landing</button>
          <button className={`px-3 py-1 rounded ${tab==='demo'?'bg-black text-white':'bg-gray-200'}`} onClick={()=>setTab('demo')}>Demo</button>
        </nav>
      </header>
      {tab === 'landing' ? <Landing onStart={()=>setTab('demo')} /> : <Demo />}
    </div>
  )
}

function Landing({ onStart }: { onStart: ()=>void }) {
  return (
    <main className="mt-10 space-y-10">
      <section className="bg-white p-6 rounded-2xl shadow">
        <h2 className="text-xl font-semibold mb-2">Measure, Orchestrate, Report</h2>
        <p className="text-gray-600">Ingest time-series, compute KPIs, and orchestrate demo jobs behind Traefik.</p>
        <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded" onClick={onStart}>Try the Demo</button>
      </section>
      <section className="grid sm:grid-cols-3 gap-4">
        {['Ingest','Compute','Report'].map((t,i)=>(
          <div key={i} className="bg-white p-4 rounded-2xl shadow">
            <h3 className="font-medium">{t}</h3>
            <p className="text-sm text-gray-600 mt-1">{i===0?'POST/GET time-series':
              i===1?'Compute KPIs from points':'Orchestrate via jobs-service'}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

function Demo() {
  const [org_id, setOrg] = useState('demo')
  const [meter, setMeter] = useState('grid_kwh')
  const [unit, setUnit] = useState('kWh')
  const [period, setPeriod] = useState('2024Q4')

  const [health, setHealth] = useState<{[k:string]:boolean|null}>({ jobs:null, kpi:null, ts:null })
  const [seeding, setSeeding] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string|undefined>()

  // health checks (best-effort)
  useEffect(()=>{
    Promise.all([
      fetch(`${API}/jobs/health`, { headers: {'x-api-key':'ct2-dev-key'}})
        .then(r=>setHealth(h=>({...h, jobs:r.ok}))).catch(()=>setHealth(h=>({...h, jobs:false}))),
      fetch(`${API}/kpi/health`,  { headers: {'x-api-key':'ct2-dev-key'}})
        .then(r=>setHealth(h=>({...h, kpi:r.ok}))).catch(()=>setHealth(h=>({...h, kpi:false}))),
      fetch(`${API}/time-series/health`, { headers: {'x-api-key':'ct2-dev-key'}})
        .then(r=>setHealth(h=>({...h, ts:r.ok}))).catch(()=>setHealth(h=>({...h, ts:false}))),
    ]).catch(()=>{})
  },[])

  async function seed() {
    setSeeding(true); setError(undefined)
    try{
      const body = { org_id, meter, unit, points: [
        { ts: '2024-11-05T00:00:00Z', value: 118.0 },
        { ts: '2024-11-06T00:00:00Z', value: 121.5 },
      ] }
      const r = await fetch(`${API}/time-series/points`, {
        method:'POST',
        headers: { 'x-api-key':'ct2-dev-key','content-type':'application/json' },
        body: JSON.stringify(body)
      })
      if(!r.ok) throw new Error(`seed failed: ${r.status}`)
    } catch(e:any){ setError(e.message) }
    finally { setSeeding(false) }
  }

  async function run() {
    setRunning(true); setError(undefined); setResult(null)
    try{
      const r = await fetch(`${API}/jobs/run/demo`, {
        method:'POST',
        headers: { 'x-api-key':'ct2-dev-key','content-type':'application/json' },
        body: JSON.stringify({ org_id, period, template:'truststrip', meter, unit })
      }).then(toJSON)
      setResult(r)
    } catch(e:any){ setError(e.message) }
    finally { setRunning(false) }
  }

  const kpis = useMemo(()=>{
    const step = result?.steps?.find((s:any)=>s.step==='kpi.compute')
    return step?.result?.kpis
  },[result])

  return (
    <main className="mt-8 space-y-6">
      <div className="flex gap-2">
        <HealthBadge name="Jobs" ok={health.jobs}/>
        <HealthBadge name="KPI"  ok={health.kpi}/>
        <HealthBadge name="TS"   ok={health.ts}/>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow space-y-3">
          <h3 className="font-semibold">Seed sample points</h3>
          <div className="grid grid-cols-2 gap-2">
            <input className="border p-2 rounded" value={org_id} onChange={e=>setOrg(e.target.value)} placeholder="org_id"/>
            <input className="border p-2 rounded" value={meter} onChange={e=>setMeter(e.target.value)} placeholder="meter"/>
            <input className="border p-2 rounded" value={unit} onChange={e=>setUnit(e.target.value)} placeholder="unit"/>
          </div>
          <button disabled={seeding} onClick={seed} className="px-4 py-2 bg-blue-600 text-white rounded">
            {seeding ? 'Seeding…' : 'Seed 2 points'}
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow space-y-3">
          <h3 className="font-semibold">Run demo orchestrator</h3>
          <input className="border p-2 rounded w-full" value={period} onChange={e=>setPeriod(e.target.value)} placeholder="period e.g. 2024Q4"/>
          <button disabled={running} onClick={run} className="px-4 py-2 bg-emerald-600 text-white rounded">
            {running ? 'Running…' : 'Run demo'}
          </button>
        </div>
      </div>

      {/* Suppliers list for the same org_id */}
      <SuppliersCard org_id={org_id} />

      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      {result && (
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="font-semibold mb-2">Result</h3>
          <div className="text-sm text-gray-700 mb-3">status: {result.status} · ok: {String(result.ok)}</div>
          {kpis ? (
            <div className="grid sm:grid-cols-4 gap-3">
              {Object.entries(kpis).map(([k,v])=>(
                <div key={k} className="border rounded p-3">
                  <div className="text-xs text-gray-500">{k}</div>
                  <div className="text-lg font-semibold">{String(v)}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-500">No KPIs yet.</div>}
          <details className="mt-4">
            <summary className="cursor-pointer">Steps</summary>
            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">{JSON.stringify(result.steps, null, 2)}</pre>
          </details>
        </div>
      )}
    </main>
  )
}
