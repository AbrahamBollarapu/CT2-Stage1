// src/worker/buildjob.ts
import fs from "fs";
import path from "path";
import { persistArtifact } from "../persistArtifact";

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

export type PersistArgs =
  | { artifactId: string; data: Buffer; ext?: string }
  | { artifactId: string; filePath: string; ext?: string };

/** Stage-1 helper: write a tiny stub so evidence-store returns 200 immediately. */
export async function writeStage1Stub(artifactId: string): Promise<string> {
  const id = sanitize(artifactId);
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, `${id}.txt`);
  const body = `Artifact ${id} scheduled at ${new Date().toISOString()}\n`;
  await fs.promises.writeFile(file, body);
  const stat = await fs.promises.stat(file);
  console.log("[buildjob] stub_written", { artifactId: id, file, size: stat.size, ARTIFACT_DIR });
  return file;
}

/** Persist the compiled artifact using the shared helper. */
export async function persistCompiledArtifact(args: PersistArgs) {
  const id = "artifactId" in args ? sanitize(args.artifactId) : "";
  if (!id) throw new Error("invalid_artifact_id");

  if ("data" in args) {
    return persistArtifact({ artifactId: id, data: args.data, ext: args.ext });
  } else if ("filePath" in args) {
    return persistArtifact({ artifactId: id, filePath: args.filePath, ext: args.ext });
  }
  throw new Error("invalid_persist_args");
}

/** Simple ID hardening. */
function sanitize(s: string) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]/g, "");
}

/* Optional: tiny self-test when run directly (never runs under normal server start).
   docker exec -e ID=rep_demo ct2-report-compiler-service-1 node -e "require('/app/dist/worker/buildjob').writeStage1Stub(process.env.ID)"
*/
export default { writeStage1Stub, persistCompiledArtifact };
