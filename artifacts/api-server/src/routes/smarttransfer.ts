import { Router } from "express";
import { db } from "@workspace/db";
import { smartTransferJobsTable, smartTransferMappingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/smarttransfer/jobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const data = await db.select().from(smartTransferJobsTable).orderBy(sql`${smartTransferJobsTable.createdAt} desc`).limit(limit).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(smartTransferJobsTable);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/smarttransfer/jobs", async (req, res) => {
  try {
    const job = await db.insert(smartTransferJobsTable).values({
      ...req.body,
      isDryRun: req.body.isDryRun ? "true" : "false",
    }).returning();
    res.status(201).json(job[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/smarttransfer/jobs/:id", async (req, res) => {
  try {
    const job = await db.select().from(smartTransferJobsTable).where(eq(smartTransferJobsTable.id, req.params.id)).limit(1);
    if (!job[0]) return res.status(404).json({ error: "not_found", message: "Job not found" });
    res.json(job[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/smarttransfer/jobs/:id/run", async (req, res) => {
  try {
    const { isDryRun } = req.body;
    await db.update(smartTransferJobsTable).set({ status: "running", isDryRun: isDryRun ? "true" : "false" }).where(eq(smartTransferJobsTable.id, req.params.id));

    // Simulate async run
    setTimeout(async () => {
      try {
        await db.update(smartTransferJobsTable).set({
          status: "complete",
          processedRecords: 0,
          errorRecords: 0,
          completedAt: new Date(),
        }).where(eq(smartTransferJobsTable.id, req.params.id));
      } catch {}
    }, 2000);

    res.json({ message: isDryRun ? "Dry run started" : "Import job started" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/smarttransfer/mappings", async (req, res) => {
  try {
    const data = await db.select().from(smartTransferMappingsTable).orderBy(sql`${smartTransferMappingsTable.createdAt} desc`);
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
