// src/persistArtifact.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Guess extension from bytes; fallback to provided ext or .bin */
function sniffExt(buf: Buffer, fallback = ".bin"): string {
  if (buf.length >= 4 && buf.slice(0, 4).toString("binary") === "PK\u0003\u0004") return ".zip"; // ZIP
  if (buf.slice(0, 5).toString() === "%PDF-") return ".pdf";                                      // PDF
  const head = buf.slice(0, 120).toString();
  const t = head.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return ".json";
  if (t.startsWith("<?xml")) return head.includes("<xbrl") || head.includes(":xbrl") ? ".xbrl" : ".xml";
  return fallback;
}

export type PersistInput =
  | { artifactId: string; data: Buffer; ext?: string }
  | { artifactId: string; filePath: string; ext?: string };

/**
 * Persist compiled artifact as <artifactId><ext> into ARTIFACT_DIR.
 * Returns { outPath, size, sha256 }.
 */
export async function persistArtifact(
  input: PersistInput
): Promise<{ outPath: string; size: number; sha256: string }> {
  const safeId = input.artifactId.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeId) throw new Error("invalid_artifact_id");

  ensureDir(ARTIFACT_DIR);

  let outPath = "";
  let size = 0;
  let sha256 = "";

  if ("data" in input) {
    const buf = input.data;
    const ext = input.ext || sniffExt(buf, ".zip");
    outPath = path.join(ARTIFACT_DIR, `${safeId}${ext}`);
    await fs.promises.writeFile(outPath, buf);
    size = buf.length;
    sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  } else {
    const src = input.filePath;
    const ext = input.ext || path.extname(src) || ".zip";
    outPath = path.join(ARTIFACT_DIR, `${safeId}${ext}`);
    await fs.promises.copyFile(src, outPath);
    const stat = await fs.promises.stat(outPath);
    size = stat.size;
    sha256 = await new Promise<string>((resolve, reject) => {
      const h = crypto.createHash("sha256");
      fs.createReadStream(outPath)
        .on("data", (d) => h.update(d))
        .on("end", () => resolve(h.digest("hex")))
        .on("error", reject);
    });
  }

  console.log("artifact_written", { artifactId: safeId, outPath, size, sha256, ARTIFACT_DIR });
  return { outPath, size, sha256 };
}
