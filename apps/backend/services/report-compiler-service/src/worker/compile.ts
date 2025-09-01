// Minimal "compiler" placeholder. Replace with your real logic and return bytes.
export async function compileReport(args: {
  template?: string;
  period?: string;
  artifactId: string;
}): Promise<Buffer> {
  // Simulate work
  await new Promise((r) => setTimeout(r, 500));
  const payload = JSON.stringify(
    {
      ok: true,
      compiled: true,
      artifactId: args.artifactId,
      template: args.template ?? null,
      period: args.period ?? null,
      at: new Date().toISOString(),
    },
    null,
    2
  );
  return Buffer.from(payload, "utf8"); // When you output a real zip/pdf, keep ext in persistArtifact in sync
}
