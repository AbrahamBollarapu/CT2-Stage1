// apps/backend/services/supplier-service/src/routes/suppliers.ts
import { Router, Request, Response } from "express";
import type { Pool } from "pg";

export default function suppliersRoutes(db: Pool) {
  const router = Router();

  // GET /api/suppliers  (org-scoped read; header wins)
  router.get("/suppliers", async (req: Request, res: Response) => {
    try {
      const orgId =
        req.headers["x-org-id"]?.toString() ??
        req.query.org_id?.toString();

      if (!orgId) {
        return res.status(400).json({ ok: false, error: "org_id required via header or query" });
      }

      const { rows } = await db.query(
        `SELECT id, org_id, name, country, created_at
           FROM public.suppliers
          WHERE org_id = $1
          ORDER BY created_at DESC, id DESC`,
        [orgId]
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(rows);
    } catch (err: any) {
      (req as any).log?.error?.({ err }, "suppliers list failed");
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // POST /api/suppliers  (additive create; org from header>query>body)
  router.post("/suppliers", async (req: Request, res: Response) => {
    try {
      const orgId =
        req.headers["x-org-id"]?.toString() ??
        req.query.org_id?.toString() ??
        (req.body?.org_id ? String(req.body.org_id) : undefined);

      if (!orgId) {
        return res.status(400).json({ ok: false, error: "org_id required via header, query, or body" });
      }

      const name = (req.body?.name ?? "").toString().trim();
      const country = (req.body?.country ?? "").toString().trim().toUpperCase();

      if (!name || !country) {
        return res.status(400).json({ ok: false, error: "name and country are required" });
      }

      const q = `
        INSERT INTO public.suppliers (org_id, name, country)
        VALUES ($1, $2, $3)
        ON CONFLICT ON CONSTRAINT u_suppliers_org_name DO NOTHING
        RETURNING id, org_id, name, country, created_at
      `;
      const { rows } = await db.query(q, [orgId, name, country]);

      if (rows.length === 0) {
        // Duplicate (org_id,name)
        return res.status(409).json({ ok: false, error: "duplicate_name_in_org" });
      }

      return res.status(201).json({ ok: true, supplier: rows[0] });
    } catch (err: any) {
      (req as any).log?.error?.({ err }, "suppliers create failed");
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  return router;
}
