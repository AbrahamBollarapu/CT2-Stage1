import fs from "node:fs";

const file = "/app/server.mjs";
let s = fs.readFileSync(file, "utf8");
const before = s;

// Replace the unquoted schema select with a quoted + schema-qualified form
s = s.replace(
  /SELECT schema FROM assessments WHERE id = \$1/g,
  'SELECT "schema" FROM public.assessments WHERE id = $1'
);

if (s !== before) {
  fs.writeFileSync(file, s);
  console.log("Patched SELECT \"schema\" line.");
} else {
  console.log("Pattern not found. Showing the 120..185 block for context:");
  const lines = before.split("\n").slice(119, 185).map((l,i)=>`${i+120}: ${l}`).join("\n");
  console.log(lines);
}
