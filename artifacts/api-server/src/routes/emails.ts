import { Router } from "express";

import { CommunicationService } from "../modules/communications/service";
import type { AttachToMessageInput } from "../modules/communications/attachments";
import { asBoolean, asDate, asString, parsePagination } from "../modules/communications/http";
import { getActorContext } from "../modules/communications/security";
import { recordTimelineActivity } from "../modules/timeline";

const router = Router();
const communicationService = new CommunicationService("emails-route");

type EmailRecipientSimple = {
  email: string;
  name?: string | null;
};

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

function normalizeRecipients(
  list: EmailRecipientSimple[] | undefined,
  recipientType: "to" | "cc" | "bcc",
) {
  return (list ?? [])
    .filter((recipient) => typeof recipient?.email === "string" && recipient.email.trim().length > 0)
    .map((recipient) => ({
      recipientType,
      emailAddress: recipient.email.trim(),
      displayName: recipient.name ?? null,
    }));
}

router.get("/emails", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, { limit: 50 });
    const result = await communicationService.search(
      {
        tenantId: actor.tenantId,
        companyId: actor.companyId,
        siteId: actor.siteId,
        recordEntityType: asString(req.query.entityType),
        recordEntityId: asString(req.query.entityId),
        sender: asString(req.query.sender),
        recipient: asString(req.query.recipient),
        status: asString(req.query.status) as any,
        templateId: asString(req.query.templateId),
        hasAttachments: asBoolean(req.query.hasAttachments),
        fromDate: asDate(req.query.fromDate),
        toDate: asDate(req.query.toDate),
        q: asString(req.query.search),
      },
      page,
      limit,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/emails/entity/:type/:id", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const result = await communicationService.getRecordHistory({
      entityType: String(req.params.type),
      entityId: String(req.params.id),
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
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/emails", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const payload = req.body as {
      to?: EmailRecipientSimple[];
      cc?: EmailRecipientSimple[];
      bcc?: EmailRecipientSimple[];
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      fromAddress?: string;
      replyTo?: string;
      templateId?: string;
      templateVersionId?: string;
      templateData?: Record<string, unknown>;
      entityType?: string;
      entityId?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      sourceModule?: string;
      sourceAction?: string;
      sendAfter?: string;
      saveAsDraft?: boolean;
      sendImmediately?: boolean;
    };

    const recipients = [
      ...normalizeRecipients(payload.to, "to"),
      ...normalizeRecipients(payload.cc, "cc"),
      ...normalizeRecipients(payload.bcc, "bcc"),
    ];

    const contextLinks =
      payload.entityType && payload.entityId
        ? [
            {
              entityType: payload.entityType,
              entityId: payload.entityId,
              relatedEntityType: payload.relatedEntityType ?? null,
              relatedEntityId: payload.relatedEntityId ?? null,
              linkRole: "primary",
            },
          ]
        : [];

    const draft = await communicationService.createDraft(actor, {
      subject: payload.subject ?? "",
      bodyHtml: payload.bodyHtml ?? null,
      bodyText: payload.bodyText ?? null,
      fromAddress: payload.fromAddress ?? null,
      replyTo: payload.replyTo ?? null,
      templateId: payload.templateId ?? null,
      templateVersionId: payload.templateVersionId ?? null,
      templateData: payload.templateData ?? {},
      recipients,
      contextLinks,
      sourceModule: payload.sourceModule ?? payload.entityType ?? null,
      sourceAction: payload.sourceAction ?? "compose",
      sendAfter: payload.sendAfter ? new Date(payload.sendAfter) : null,
    });

    if (!payload.saveAsDraft && (payload.sendImmediately || payload.sendAfter)) {
      if (payload.sendImmediately) {
        await communicationService.sendNow(actor, draft?.id ?? "");
      } else {
        await communicationService.queueEmail(actor, draft?.id ?? "", {
          sendAt: payload.sendAfter ? new Date(payload.sendAfter) : new Date(),
        });
      }
    }

    if (payload.entityType && payload.entityId) {
      await recordTimelineActivity({
        entityType: payload.entityType,
        entityId: payload.entityId,
        relatedEntityType: payload.relatedEntityType ?? null,
        relatedEntityId: payload.relatedEntityId ?? null,
        activityType: "email",
        sourceType: "email",
        sourceId: draft?.id ?? null,
        title: `Email drafted: ${payload.subject || "(No subject)"}`,
        body: payload.bodyText ?? payload.bodyHtml ?? null,
        metadata: {
          toCount: recipients.filter((recipient) => recipient.recipientType === "to").length,
          ccCount: recipients.filter((recipient) => recipient.recipientType === "cc").length,
          bccCount: recipients.filter((recipient) => recipient.recipientType === "bcc").length,
          sendImmediately: Boolean(payload.sendImmediately),
          sendAfter: payload.sendAfter ?? null,
        },
        actorId: actor.userId,
      });
    }

    const latest = draft?.id ? await communicationService.getConversation(draft.conversationId ?? "", actor.tenantId) : null;
    res.status(201).json({ data: draft, conversation: latest });
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/emails/:id", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const payload = req.body as {
      to?: EmailRecipientSimple[];
      cc?: EmailRecipientSimple[];
      bcc?: EmailRecipientSimple[];
      subject?: string;
      bodyHtml?: string | null;
      bodyText?: string | null;
      fromAddress?: string | null;
      replyTo?: string | null;
      templateId?: string | null;
      templateVersionId?: string | null;
      templateData?: Record<string, unknown>;
      sendAfter?: string | null;
      entityType?: string;
      entityId?: string;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
    };

    const recipients = payload.to || payload.cc || payload.bcc
      ? [
          ...normalizeRecipients(payload.to, "to"),
          ...normalizeRecipients(payload.cc, "cc"),
          ...normalizeRecipients(payload.bcc, "bcc"),
        ]
      : undefined;

    const contextLinks =
      payload.entityType && payload.entityId
        ? [
            {
              entityType: payload.entityType,
              entityId: payload.entityId,
              relatedEntityType: payload.relatedEntityType ?? null,
              relatedEntityId: payload.relatedEntityId ?? null,
              linkRole: "primary",
            },
          ]
        : undefined;

    const updated = await communicationService.updateDraft(actor, String(req.params.id), {
      subject: payload.subject,
      bodyHtml: payload.bodyHtml,
      bodyText: payload.bodyText,
      fromAddress: payload.fromAddress,
      replyTo: payload.replyTo,
      templateId: payload.templateId,
      templateVersionId: payload.templateVersionId,
      templateData: payload.templateData,
      sendAfter: payload.sendAfter ? new Date(payload.sendAfter) : payload.sendAfter === null ? null : undefined,
      recipients,
      contextLinks,
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/emails/:id", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const updated = await communicationService.markStatus(actor, String(req.params.id), "archived", "archived_by_user");
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/:id/queue", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { sendAt?: string; mailboxConfigId?: string; idempotencyKey?: string };
    const queued = await communicationService.queueEmail(actor, String(req.params.id), {
      sendAt: body.sendAt ? new Date(body.sendAt) : new Date(),
      mailboxConfigId: body.mailboxConfigId ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    res.json(queued);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/:id/send", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const sent = await communicationService.sendNow(actor, String(req.params.id));
    res.json(sent);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/:id/retry", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const retried = await communicationService.retryQueuedMessage(actor, String(req.params.id));
    res.json(retried);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/:id/resend", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const body = req.body as { sendImmediately?: boolean };
    const resent = await communicationService.resendFailedMessage(actor, String(req.params.id), body.sendImmediately ?? false);
    res.json(resent);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/:id/attachments", async (req, res) => {
  try {
    const result = await communicationService.addAttachment(req, String(req.params.id), req.body as AttachToMessageInput);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/templates/render", async (req, res) => {
  try {
    const actor = toDraftContext(req);
    const payload = req.body as { templateId: string; templateVersionId?: string; data?: Record<string, unknown> };
    const preview = await communicationService.renderTemplatePreview(actor, {
      templateId: payload.templateId,
      templateVersionId: payload.templateVersionId ?? null,
      data: payload.data ?? {},
    });
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.post("/emails/inbound/webhook/:provider", async (req, res) => {
  try {
    const provider = String(req.params.provider);
    const result = await communicationService.ingestProviderWebhook(
      provider,
      req.body,
      Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
      ),
      {
        tenantId: asString(req.query.tenantId) ?? asString((req.body as Record<string, unknown>).tenantId) ?? undefined,
        companyId: asString(req.query.companyId),
        siteId: asString(req.query.siteId),
      },
    );

    res.json({ status: "accepted", ...result });
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

export default router;
