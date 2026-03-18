import { Router } from "express";

import { db, chatLogsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

import { runCopilotQuery } from "../modules/copilot/service";
import { parsePagination } from "../modules/communications/http";
import { getActorContext } from "../modules/communications/security";
import { recordTimelineActivity } from "../modules/timeline";

const router = Router();

function chunkText(value: string, maxChunkSize = 120): string[] {
  const chunks: string[] = [];
  let remaining = value;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxChunkSize));
    remaining = remaining.slice(maxChunkSize);
  }
  return chunks;
}

router.post("/chat", async (req, res) => {
  try {
    const actor = getActorContext(req);
    const payload = req.body as {
      query: string;
      entityType?: string | null;
      entityId?: string | null;
      stream?: boolean;
    };

    if (!payload.query || payload.query.trim().length === 0) {
      res.status(400).json({ error: "bad_request", message: "query is required" });
      return;
    }

    const result = await runCopilotQuery({
      query: payload.query.trim(),
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      userId: actor.userId,
    });

    if (payload.entityType && payload.entityId) {
      await recordTimelineActivity({
        entityType: payload.entityType,
        entityId: payload.entityId,
        activityType: "chat",
        sourceType: "chat",
        sourceId: result.chatLogId,
        title: "AI queried",
        body: payload.query.trim(),
        metadata: {
          intent: result.intent,
          provider: result.provider,
          model: result.model,
        },
        actorId: actor.userId,
      });
    }

    if (payload.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const chunks = chunkText(result.answer);
      for (let idx = 0; idx < chunks.length; idx += 1) {
        res.write(`event: chunk\n`);
        res.write(`data: ${JSON.stringify({ index: idx, text: chunks[idx] })}\n\n`);
      }
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({
        intent: result.intent,
        provider: result.provider,
        model: result.model,
        chatLogId: result.chatLogId,
      })}\n\n`);
      res.end();
      return;
    }

    res.json({
      data: {
        answer: result.answer,
        intent: result.intent,
        provider: result.provider,
        model: result.model,
        chatLogId: result.chatLogId,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/chat/logs", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId.trim() : "";

    const whereClause =
      entityType && entityId ? and(eq(chatLogsTable.entityType, entityType), eq(chatLogsTable.entityId, entityId)) : undefined;

    const rows = await db
      .select()
      .from(chatLogsTable)
      .where(whereClause)
      .orderBy(desc(chatLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
