import type { Express, Request, Response } from "express";

// In-memory job store for Stage-1
type JobStatus = "queued" | "running" | "completed" | "failed";
interface Job {
  jobId: string;
  kind: string;
  status: JobStatus;
  meta?: Record<string, any>;
  error?: string;
  updatedAt: number;
}
const jobStore: Map<string, Job> = new Map();

function now(){ return Date.now(); }
function upsert(job: Job){ job.updatedAt = now(); jobStore.set(job.jobId, job); }

export function registerJobsApi(app: Express) {
  // Create job
  app.post("/create", (req: Request, res: Response) => {
    const body = (req.body || {}) as Partial<Job>;
    const jobId = String(body.jobId || `job_${Date.now()}`);
    const job: Job = {
      jobId,
      kind: String(body.kind || "generic"),
      status: (body.status as JobStatus) || "queued",
      meta: body.meta || {},
      updatedAt: now(),
    };
    upsert(job);
    return res.status(202).json({ ok: true, jobId, status: job.status });
  });

  // Update job
  app.post("/update", (req: Request, res: Response) => {
    const body = (req.body || {}) as Partial<Job>;
    if (!body.jobId) return res.status(400).json({ ok:false, error:"jobId required" });
    const existing = jobStore.get(String(body.jobId));
    if (!existing) return res.status(404).json({ ok:false, error:"job not found" });
    if (body.status) existing.status = body.status as JobStatus;
    if (typeof body.error === "string") existing.error = body.error;
    if (body.meta) existing.meta = { ...(existing.meta||{}), ...(body.meta||{}) };
    upsert(existing);
    return res.json({ ok:true, jobId: existing.jobId, status: existing.status });
  });

  // Get job status
  app.get("/status/:id", (_req: Request, res: Response) => {
    const id = String(_req.params.id);
    const job = jobStore.get(id);
    if (!job) return res.status(404).json({ ok:false, status: "not_found" });
    return res.json({ ok:true, jobId: job.jobId, status: job.status, error: job.error, meta: job.meta, updatedAt: job.updatedAt });
  });
}