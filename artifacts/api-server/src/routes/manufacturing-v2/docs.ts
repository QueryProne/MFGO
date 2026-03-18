import { Router } from "express";
import {
  db,
  mfgDocAttachmentsTable,
  mfgDocAuditHistoryTable,
  mfgDocLinksTable,
  mfgDocPagesTable,
  mfgDocPageTagsTable,
  mfgDocPageVersionsTable,
  mfgDocPermissionsTable,
  mfgDocSpacesTable,
  mfgDocTagsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { parsePagination } from "../../modules/mfg-v2/http";
import { asString, ensureDocumentPermission } from "./shared";

const router = Router();

router.get("/spaces", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    const [data, countResult] = await Promise.all([
      db.select().from(mfgDocSpacesTable).orderBy(asc(mfgDocSpacesTable.name)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgDocSpacesTable),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/spaces", async (req, res) => {
  try {
    const body = req.body as { spaceKey: string; name: string; description?: string };

    const allowed = await ensureDocumentPermission(req, "admin", {});
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const [space] = await db
      .insert(mfgDocSpacesTable)
      .values({
        spaceKey: body.spaceKey,
        name: body.name,
        description: body.description ?? null,
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning();

    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/pages", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];

    if (asString(req.query.spaceId)) {
      conditions.push(eq(mfgDocPagesTable.spaceId, String(req.query.spaceId)));
    }
    if (asString(req.query.parentPageId)) {
      conditions.push(eq(mfgDocPagesTable.parentPageId, String(req.query.parentPageId)));
    }

    if (asString(req.query.search)) {
      const pattern = `%${String(req.query.search)}%`;
      conditions.push(sql`${mfgDocPagesTable.title} ilike ${pattern} or ${mfgDocPagesTable.slug} ilike ${pattern}`);
    }

    if (asString(req.query.tag)) {
      const tagRows = await db
        .select({ pageId: mfgDocPageTagsTable.pageId })
        .from(mfgDocPageTagsTable)
        .leftJoin(mfgDocTagsTable, eq(mfgDocPageTagsTable.tagId, mfgDocTagsTable.id))
        .where(eq(mfgDocTagsTable.name, String(req.query.tag)));
      const pageIds = tagRows.map((row) => row.pageId);
      if (pageIds.length === 0) {
        res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
        return;
      }
      conditions.push(inArray(mfgDocPagesTable.id, pageIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select({
          id: mfgDocPagesTable.id,
          spaceId: mfgDocPagesTable.spaceId,
          parentPageId: mfgDocPagesTable.parentPageId,
          title: mfgDocPagesTable.title,
          slug: mfgDocPagesTable.slug,
          status: mfgDocPagesTable.status,
          currentVersion: mfgDocPagesTable.currentVersion,
          createdBy: mfgDocPagesTable.createdBy,
          createdAt: mfgDocPagesTable.createdAt,
          updatedAt: mfgDocPagesTable.updatedAt,
          spaceKey: mfgDocSpacesTable.spaceKey,
          spaceName: mfgDocSpacesTable.name,
        })
        .from(mfgDocPagesTable)
        .leftJoin(mfgDocSpacesTable, eq(mfgDocPagesTable.spaceId, mfgDocSpacesTable.id))
        .where(whereClause)
        .orderBy(desc(mfgDocPagesTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgDocPagesTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/pages", async (req, res) => {
  try {
    const body = req.body as {
      spaceId: string;
      parentPageId?: string | null;
      title: string;
      slug: string;
      contentMarkdown: string;
      changeSummary?: string;
    };

    const allowed = await ensureDocumentPermission(req, "write", { spaceId: body.spaceId, pageId: null });
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const [page] = await db
      .insert(mfgDocPagesTable)
      .values({
        spaceId: body.spaceId,
        parentPageId: body.parentPageId ?? null,
        title: body.title,
        slug: body.slug,
        status: "active",
        currentVersion: 1,
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning();

    if (!page) {
      throw new Error("Failed to create page");
    }

    const [version] = await db
      .insert(mfgDocPageVersionsTable)
      .values({
        pageId: page.id,
        version: 1,
        contentMarkdown: body.contentMarkdown,
        changeSummary: body.changeSummary ?? "Initial version",
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning();

    await db.insert(mfgDocAuditHistoryTable).values({
      pageId: page.id,
      pageVersionId: version?.id,
      action: "create_page",
      performedBy: req.header("x-user") ?? "system-user",
      details: { title: page.title, slug: page.slug },
    });

    res.status(201).json({ ...page, version });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/pages/:id", async (req, res) => {
  try {
    const [page] = await db.select().from(mfgDocPagesTable).where(eq(mfgDocPagesTable.id, req.params.id)).limit(1);
    if (!page) {
      res.status(404).json({ error: "not_found", message: "Page not found" });
      return;
    }

    const [currentVersion, attachments, links, tags] = await Promise.all([
      db
        .select()
        .from(mfgDocPageVersionsTable)
        .where(and(eq(mfgDocPageVersionsTable.pageId, page.id), eq(mfgDocPageVersionsTable.version, page.currentVersion)))
        .limit(1),
      db.select().from(mfgDocAttachmentsTable).where(eq(mfgDocAttachmentsTable.pageId, page.id)).orderBy(desc(mfgDocAttachmentsTable.uploadedAt)),
      db.select().from(mfgDocLinksTable).where(eq(mfgDocLinksTable.pageId, page.id)).orderBy(asc(mfgDocLinksTable.createdAt)),
      db
        .select({ id: mfgDocTagsTable.id, name: mfgDocTagsTable.name })
        .from(mfgDocPageTagsTable)
        .leftJoin(mfgDocTagsTable, eq(mfgDocPageTagsTable.tagId, mfgDocTagsTable.id))
        .where(eq(mfgDocPageTagsTable.pageId, page.id)),
    ]);

    res.json({ ...page, currentVersion: currentVersion[0] ?? null, attachments, links, tags });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});
router.post("/pages/:id/versions", async (req, res) => {
  try {
    const body = req.body as { contentMarkdown: string; changeSummary?: string };
    const [page] = await db.select().from(mfgDocPagesTable).where(eq(mfgDocPagesTable.id, req.params.id)).limit(1);

    if (!page) {
      res.status(404).json({ error: "not_found", message: "Page not found" });
      return;
    }

    const allowed = await ensureDocumentPermission(req, "write", { spaceId: page.spaceId, pageId: page.id });
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const versionNumber = page.currentVersion + 1;
    const [version] = await db
      .insert(mfgDocPageVersionsTable)
      .values({
        pageId: page.id,
        version: versionNumber,
        contentMarkdown: body.contentMarkdown,
        changeSummary: body.changeSummary ?? "Updated content",
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning();

    await db
      .update(mfgDocPagesTable)
      .set({ currentVersion: versionNumber, updatedAt: new Date() })
      .where(eq(mfgDocPagesTable.id, page.id));

    await db.insert(mfgDocAuditHistoryTable).values({
      pageId: page.id,
      pageVersionId: version?.id,
      action: "new_version",
      performedBy: req.header("x-user") ?? "system-user",
      details: { version: versionNumber, changeSummary: body.changeSummary ?? null },
    });

    res.status(201).json(version);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/pages/:id/history", async (req, res) => {
  try {
    const [versions, auditHistory] = await Promise.all([
      db
        .select()
        .from(mfgDocPageVersionsTable)
        .where(eq(mfgDocPageVersionsTable.pageId, req.params.id))
        .orderBy(desc(mfgDocPageVersionsTable.version)),
      db
        .select()
        .from(mfgDocAuditHistoryTable)
        .where(eq(mfgDocAuditHistoryTable.pageId, req.params.id))
        .orderBy(desc(mfgDocAuditHistoryTable.createdAt)),
    ]);

    res.json({ versions, auditHistory });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/pages/:id/attachments", async (req, res) => {
  try {
    const body = req.body as {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      objectKey: string;
      bucket: string;
      etag?: string;
      attachmentVersion?: number;
    };

    const [page] = await db.select().from(mfgDocPagesTable).where(eq(mfgDocPagesTable.id, req.params.id)).limit(1);
    if (!page) {
      res.status(404).json({ error: "not_found", message: "Page not found" });
      return;
    }

    const allowed = await ensureDocumentPermission(req, "write", { spaceId: page.spaceId, pageId: page.id });
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const [attachment] = await db
      .insert(mfgDocAttachmentsTable)
      .values({
        pageId: page.id,
        fileName: body.fileName,
        contentType: body.contentType,
        sizeBytes: Math.max(0, Math.floor(body.sizeBytes)),
        objectKey: body.objectKey,
        bucket: body.bucket,
        etag: body.etag ?? null,
        attachmentVersion: body.attachmentVersion ?? 1,
        uploadedBy: req.header("x-user") ?? "system-user",
      })
      .returning();

    res.status(201).json(attachment);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/pages/:id/tags", async (req, res) => {
  try {
    const body = req.body as { tags: string[] };
    const [page] = await db.select().from(mfgDocPagesTable).where(eq(mfgDocPagesTable.id, req.params.id)).limit(1);
    if (!page) {
      res.status(404).json({ error: "not_found", message: "Page not found" });
      return;
    }

    const allowed = await ensureDocumentPermission(req, "write", { spaceId: page.spaceId, pageId: page.id });
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const normalizedTags = Array.from(new Set(body.tags.map((tag) => tag.trim()).filter(Boolean)));
    const tagIds: string[] = [];

    for (const tagName of normalizedTags) {
      const [existing] = await db.select().from(mfgDocTagsTable).where(eq(mfgDocTagsTable.name, tagName)).limit(1);
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      const [created] = await db.insert(mfgDocTagsTable).values({ name: tagName }).returning({ id: mfgDocTagsTable.id });
      if (created?.id) tagIds.push(created.id);
    }

    if (tagIds.length > 0) {
      await db
        .insert(mfgDocPageTagsTable)
        .values(tagIds.map((tagId) => ({ pageId: page.id, tagId })))
        .onConflictDoNothing();
    }

    res.json({ success: true, tagsAdded: tagIds.length });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/pages/:id/links", async (req, res) => {
  try {
    const body = req.body as { linkType: "bom_item" | "work_center" | "routing_operation"; targetId: string; targetRef?: string; metadata?: Record<string, unknown> };

    const [page] = await db.select().from(mfgDocPagesTable).where(eq(mfgDocPagesTable.id, req.params.id)).limit(1);
    if (!page) {
      res.status(404).json({ error: "not_found", message: "Page not found" });
      return;
    }

    const allowed = await ensureDocumentPermission(req, "write", { spaceId: page.spaceId, pageId: page.id });
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const [link] = await db
      .insert(mfgDocLinksTable)
      .values({ pageId: page.id, linkType: body.linkType, targetId: body.targetId, targetRef: body.targetRef ?? null, metadata: body.metadata ?? null })
      .returning();

    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/permissions", async (req, res) => {
  try {
    const body = req.body as { spaceId?: string | null; pageId?: string | null; role: string; permission: string; granted?: boolean };

    const allowed = await ensureDocumentPermission(req, "admin", {});
    if (!allowed) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permission" });
      return;
    }

    const [permission] = await db
      .insert(mfgDocPermissionsTable)
      .values({
        spaceId: body.spaceId ?? null,
        pageId: body.pageId ?? null,
        role: body.role,
        permission: body.permission,
        granted: body.granted ?? true,
      })
      .returning();

    res.status(201).json(permission);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/search", async (req, res) => {
  try {
    const queryText = asString(req.query.q);
    if (!queryText) {
      res.json({ data: [], total: 0 });
      return;
    }

    const pattern = `%${queryText}%`;

    const contentMatches = await db
      .select({
        pageId: mfgDocPagesTable.id,
        title: mfgDocPagesTable.title,
        slug: mfgDocPagesTable.slug,
        version: mfgDocPageVersionsTable.version,
        snippet: mfgDocPageVersionsTable.changeSummary,
      })
      .from(mfgDocPageVersionsTable)
      .leftJoin(mfgDocPagesTable, eq(mfgDocPageVersionsTable.pageId, mfgDocPagesTable.id))
      .where(sql`${mfgDocPagesTable.title} ilike ${pattern} or ${mfgDocPageVersionsTable.contentMarkdown} ilike ${pattern}`)
      .orderBy(desc(mfgDocPageVersionsTable.createdAt))
      .limit(200);

    res.json({ data: contentMatches, total: contentMatches.length, query: queryText });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/audit", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const pageId = asString(req.query.pageId);

    const whereClause = pageId ? eq(mfgDocAuditHistoryTable.pageId, pageId) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(mfgDocAuditHistoryTable)
        .where(whereClause)
        .orderBy(desc(mfgDocAuditHistoryTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgDocAuditHistoryTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
