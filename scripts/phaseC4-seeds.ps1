$ErrorActionPreference = "Stop"
function Inject-BeforeListen($file, $block, $tag){
  $raw = Get-Content -Raw $file -Encoding UTF8
  if ($raw -match $tag) { Write-Host "[skip] $file already has $tag" -f Yellow; return }
  $pat = '(?s)(\bapp\s*\.\s*listen\s*\()'
  if ($raw -notmatch $pat) { throw "listen() not found in $file" }
  $new = $raw -replace $pat, "/* $tag */`r`n$block`r`n`$1"
  Set-Content -Path $file -Value $new -NoNewline -Encoding UTF8
  Write-Host "[ok] injected into $file" -f Green
}

# Time-series: add /seed-demo and /demo/series (idempotent)
$ts = "D:\CT2\services\time-series-service\src\index.ts"
$tsBlock = @'
const __TS = (globalThis).__TS || new Map();
(globalThis).__TS = __TS;

// POST /seed-demo -> seeds demo-2024Q4 once
app.post('/seed-demo', async (_req, res) => {
  const key = 'demo-2024Q4';
  if (!__TS.has(key)) {
    __TS.set(key, [
      { ts: '2024-10-01', v: 10 },
      { ts: '2024-11-01', v: 12 },
      { ts: '2024-12-01', v: 20 }
    ]);
  }
  res.json({ ok: true, seeded: true, id: key, points: (__TS.get(key)||[]).length });
});

// GET /demo/series -> returns the seeded series
app.get('/demo/series', (_req, res) => {
  res.json({ ok: true, series: __TS.get('demo-2024Q4') || [] });
});
'@
Inject-BeforeListen $ts $tsBlock "C4:TS-SEED"

# Emission-factors: add /seed-demo and /factors/demo (idempotent)
$emf = "D:\CT2\services\emission-factors-service\src\index.ts"
$emfBlock = @'
const __EMF = (globalThis).__EMF || new Map();
(globalThis).__EMF = __EMF;

// POST /seed-demo -> seeds three sample factors
app.post('/seed-demo', async (_req, res) => {
  if (!__EMF.has('co2e.kg.per.kwh')) {
    __EMF.set('co2e.kg.per.kwh', { key:'co2e.kg.per.kwh', value:0.45, unit:'kg/kWh', source:'demo' });
    __EMF.set('ch4.g.per.m3',     { key:'ch4.g.per.m3',     value:0.8,  unit:'g/m3',    source:'demo' });
    __EMF.set('n2o.g.per.l',      { key:'n2o.g.per.l',      value:0.3,  unit:'g/L',     source:'demo' });
  }
  res.json({ ok:true, seeded:true, count: __EMF.size });
});

// GET /factors/demo -> list
app.get('/factors/demo', (_req,res) => {
  res.json({ ok:true, factors: Array.from(__EMF.values()) });
});
'@
Inject-BeforeListen $emf $emfBlock "C4:EMF-SEED"

Write-Host "C4 patch done. Rebuild + restart the two services:" -f Cyan
