import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";

import {
  db,
  commEmailOutboxTable,
  commEmailProviderEventsTable,
} from "@workspace/db";

import { CommunicationService } from "../modules/communications/service";
import type { AttachToMessageInput } from "../modules/communications/attachments";
import { asBoolean, asDate, asString, parsePagination } from "../modules/communications/http";
import { getActorContext, requireCommunicationPermission } from "../modules/communications/security";
import type { CreateDraftInput, EmailSearchFilters, UpdateDraftInput } from "../modules/communications/types";

const router = Router();
const communicationService = new CommunicationService();

function toDraftContext(req: Parameters<typeof getActorContext>[0]) {
  const actor = getActorContext(req);
  return {
    tenantId: actor.tenantId,
    companyId: actor.companyId,
    siteId: actor.siteId,
    userId: actor.userId,
    userName: actor.userName,
    userRole: actor.userRole,
  };
}

router.get("/communications/versions", async (_req, res) => {
  res.json({
    data: {
      module: "communications",
      version: "1.0.0",
      capabilities: {
        drafts: true,
        threading: true,
        queueing: true,
        inbound: true,
        templates: true,
        providerAbstraction: true,
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

router.post("/communications/emails/drafts", requireCommunicationPermission("communications.compose"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as CreateDraftInput;
    const draft = await communicationService.createDraft(actor, body);
    res.status(201).json(draft);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/communications/emails/:id", requireCommunicationPermission("communications.compose"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as UpdateDraftInput;
    const updated = await communicationService.updateDraft(actor, String(req.params.id), body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/approve", requireCommunicationPermission("communications.approve"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { note?: string };
    const approved = await communicationService.approveDraft(actor, String(req.params.id), body.note ?? null);
    res.json(approved);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/queue", requireCommunicationPermission("communications.send"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { mailboxConfigId?: string; sendAt?: string; idempotencyKey?: string };
    const queued = await communicationService.queueEmail(actor, String(req.params.id), {
      mailboxConfigId: body.mailboxConfigId ?? null,
      sendAt: body.sendAt ? new Date(body.sendAt) : null,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    res.json(queued);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/send", requireCommunicationPermission("communications.send"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const sent = await communicationService.sendNow(actor, String(req.params.id));
    res.json(sent);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/attachments", requireCommunicationPermission("communications.attach"), async (req, res) => {
  try {
    const result = await communicationService.addAttachment(req, String(req.params.id), req.body as AttachToMessageInput);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/resend", requireCommunicationPermission("communications.resend"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { sendImmediately?: boolean };
    const resent = await communicationService.resendFailedMessage(actor, String(req.params.id), body.sendImmediately ?? false);
    res.json(resent);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/emails/:id/retry", requireCommunicationPermission("communications.retry"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const retried = await communicationService.retryQueuedMessage(actor, String(req.params.id));
    res.json(retried);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/communications/emails/:id/status", requireCommunicationPermission("communications.manage_status"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { status: string; error?: string };
    const updated = await communicationService.markStatus(actor, String(req.params.id), body.status, body.error ?? null);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/templates/render", requireCommunicationPermission("communications.templates.view"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { templateId: string; templateVersionId?: string; data?: Record<string, unknown> };
    const preview = await communicationService.renderTemplatePreview(actor, {
      templateId: body.templateId,
      templateVersionId: body.templateVersionId ?? null,
      data: body.data ?? {},
    });
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/communications/records/:entityType/:entityId/emails", requireCommunicationPermission("communications.view"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });

    const history = await communicationService.getRecordHistory({
      entityType: String(req.params.entityType),
      entityId: String(req.params.entityId),
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
      page,
      limit,
      sender: asString(req.query.sender),
      recipient: asString(req.query.recipient),
      status: asString(req.query.status),
      templateId: asString(req.query.templateId),
      hasAttachments: asBoolean(req.query.hasAttachments),
      fromDate: asDate(req.query.fromDate),
      toDate: asDate(req.query.toDate),
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/communications/conversations/:conversationId", requireCommunicationPermission("communications.view"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const conversation = await communicationService.getConversation(String(req.params.conversationId), actor.tenantId);
    if (!conversation) {
      res.status(404).json({ error: "not_found", message: "Conversation not found" });
      return;
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/communications/inbound/webhook/:provider", async (req, res) => {
  try {
    const provider = String(req.params.provider);
    const result = await communicationService.ingestProviderWebhook(
      provider,
      req.body,
      Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
      {
        tenantId: asString(req.query.tenantId) ?? asString((req.body as Record<string, unknown>).tenantId) ?? undefined,
        companyId: asString(req.query.companyId) ?? null,
        siteId: asString(req.query.siteId) ?? null,
      },
    );

    res.json({ status: "accepted", ...result });
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/communications/search", requireCommunicationPermission("communications.view"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });

    const filters: EmailSearchFilters = {
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
      recordEntityType: asString(req.query.recordEntityType),
      recordEntityId: asString(req.query.recordEntityId),
      sender: asString(req.query.sender),
      recipient: asString(req.query.recipient),
      status: asString(req.query.status) as EmailSearchFilters["status"],
      templateId: asString(req.query.templateId),
      hasAttachments: asBoolean(req.query.hasAttachments),
      fromDate: asDate(req.query.fromDate),
      toDate: asDate(req.query.toDate),
      q: asString(req.query.q),
    };

    const result = await communicationService.search(filters, page, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/communications/admin/templates", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const includeInactive = asBoolean(req.query.includeInactive) ?? true;
    const data = await communicationService.listTemplates(actor.tenantId, includeInactive);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/communications/admin/templates", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const created = await communicationService.createTemplate(actor, req.body as Parameters<typeof communicationService.createTemplate>[1]);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/admin/templates/:templateId/versions", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const created = await communicationService.createTemplateVersion(
      actor,
      String(req.params.templateId),
      req.body as Parameters<typeof communicationService.createTemplateVersion>[2],
    );
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/communications/admin/templates/:templateId/activate/:versionId", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const updated = await communicationService.activateTemplateVersion(
      actor,
      String(req.params.templateId),
      String(req.params.versionId),
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/communications/admin/mailboxes/outbound", requireCommunicationPermission("communications.admin"), async (_req, res) => {
  try {
    const data = await communicationService.listOutboundMailboxes();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/communications/admin/mailboxes/outbound", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const created = await communicationService.createOutboundMailbox(actor, req.body as Parameters<typeof communicationService.createOutboundMailbox>[1]);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/communications/admin/mailboxes/inbound", requireCommunicationPermission("communications.admin"), async (_req, res) => {
  try {
    const data = await communicationService.listInboundMailboxes();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/communications/admin/mailboxes/inbound", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const created = await communicationService.createInboundMailbox(actor, req.body as Parameters<typeof communicationService.createInboundMailbox>[1]);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/communications/admin/provider-events", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const data = await db
      .select()
      .from(commEmailProviderEventsTable)
      .orderBy(desc(commEmailProviderEventsTable.receivedAt))
      .limit(limit)
      .offset(offset);

    res.json({ data, meta: { page, limit, total: data.length } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/communications/admin/outbox", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const status = asString(req.query.status);

    const data = status
      ? await db
          .select()
          .from(commEmailOutboxTable)
          .where(eq(commEmailOutboxTable.status, status))
          .orderBy(asc(commEmailOutboxTable.availableAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(commEmailOutboxTable)
          .orderBy(asc(commEmailOutboxTable.availableAt))
          .limit(limit)
          .offset(offset);

    res.json({ data, meta: { page, limit, total: data.length } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/communications/admin/queue/process", requireCommunicationPermission("communications.admin"), async (req, res) => {
  try {
    const body = req.body as { maxItems?: number };
    const result = await communicationService.processOutboxBatch(body.maxItems ?? 25);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/communications/admin/metrics", requireCommunicationPermission("communications.admin"), async (_req, res) => {
  try {
    const metrics = await communicationService.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
