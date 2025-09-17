import fs from "node:fs";

const f = "/app/server.mjs";
const s0 = fs.readFileSync(f, "utf8");
let s = s0.replace(/\r\n/g, "\n");

// 0) Qualify/quote the JSON column read (harmless if already done)
s = s.replace(/SELECT\s+schema\s+FROM\s+assessments/gi,
              'SELECT "schema" FROM public.assessments');

// 1) Ensure table names are schema-qualified where used
s = s.replace(/INSERT INTO\s+assessment_responses\b/gi,
              'INSERT INTO public.assessment_responses');
s = s.replace(/\bSELECT id FROM supplier_assessments\b/g,
              'SELECT id FROM public.supplier_assessments');
s = s.replace(/\bUPDATE supplier_assessments\b/g,
              'UPDATE public.supplier_assessments');
s = s.replace(/\bFROM\s+supplier_assessments\b/g,
              'FROM public.supplier_assessments');

// 2) AR upsert MUST use the AR named constraint (avoid 42P10 ambiguity)
s = s.replace(
  /(INSERT INTO public\.assessment_responses[\s\S]*?)(ON CONFLICT[\s\S]*?)(DO UPDATE)/m,
  (_m, pre, _conf, tail) =>
    pre + 'ON CONFLICT ON CONSTRAINT assessment_responses_org_sup_assess_uniq\n' + tail
);
// Clean up any accidental SA constraint inside AR block
s = s.replace(
  /(INSERT INTO public\.assessment_responses[\s\S]*?)ON CONFLICT ON CONSTRAINT supplier_assessments_org_sup_assess_uniq([\s\S]*?DO UPDATE)/m,
  (_m, pre, tail) =>
    pre + 'ON CONFLICT ON CONSTRAINT assessment_responses_org_sup_assess_uniq\n' + tail
);

// 3) SA upserts must use the SA named constraint in BOTH blocks
s = s.replace(
  /(INSERT INTO (?:public\.)?supplier_assessments[\s\S]*?VALUES[\s\S]*?)(ON CONFLICT[\s\S]*?)(DO UPDATE)/m,
  (_m, pre, _conf, tail) =>
    pre + 'ON CONFLICT ON CONSTRAINT supplier_assessments_org_sup_assess_uniq\n' + tail
);
s = s.replace(
  /(INSERT INTO (?:public\.)?supplier_assessments[\s\S]*?VALUES[\s\S]*?)(ON CONFLICT[\s\S]*?)DO NOTHING/m,
  (_m, pre, _conf) =>
    pre + 'ON CONFLICT ON CONSTRAINT supplier_assessments_org_sup_assess_uniq DO NOTHING'
);

if (s !== s0) {
  fs.writeFileSync(f, s);
  console.log("Patched /app/server.mjs");
} else {
  console.log("No changes applied.");
}

// Show quick verifications
const dump = (label, a, b) => {
  console.log(`\n== ${label} ==`);
  console.log(s.split("\n").slice(a, b).join("\n"));
};
const showBlock = (reStart, reEnd, label) => {
  const lines = s.split("\n");
  let si = -1, ei = -1;
  for (let i = 0; i < lines.length; i++) { if (reStart.test(lines[i])) { si = i; break; } }
  if (si >= 0) for (let i = si; i < lines.length; i++) { if (reEnd.test(lines[i])) { ei = i+1; break; } }
  if (si >= 0 && ei > si) dump(label, si, Math.min(ei, si+80));
};

showBlock(/INSERT INTO public\.assessment_responses/, /DO UPDATE/, "AR block");
showBlock(/INSERT INTO public\.supplier_assessments/, /DO UPDATE/, "SA (DO UPDATE) block");
showBlock(/INSERT INTO public\.supplier_assessments/, /RETURNING id/, "SA (DO NOTHING) block");

console.log("\n== Check schema SELECT ==");
console.log(/SELECT "schema" FROM public\.assessments/.test(s) ? "OK" : "MISSING");
