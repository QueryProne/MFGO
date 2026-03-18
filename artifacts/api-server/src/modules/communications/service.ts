import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { Request } from "express";
import {
  db,
  commEmailAttachmentsTable,
  commEmailContextLinksTable,
  commEmailConversationsTable,
  commEmailMessageAttachmentsTable,
  commEmailMessagesTable,
  commEmailOutboxTable,
  commEmailProviderEventsTable,
  commEmailRecipientsTable,
  commEmailSendAttemptsTable,
  commEmailTemplateVersionsTable,
  commEmailTemplatesTable,
  commInboundMailboxConfigsTable,
  commOutboundMailboxConfigsTable,
} from "@workspace/db";

import { addAttachmentToMessage, listMessageAttachments, type AttachToMessageInput } from "./attachments";
import { writeCommunicationAuditLog } from "./audit";
import { getEmailHistoryForRecord, replaceContextLinks, searchCommunications } from "./context-links";
import { getMetricsSnapshot, incrementMetric } from "./metrics";
import { getCommunicationProvider, mapProviderEventToInternalStatus, type ProviderSendPayload, ProviderSendError } from "./provider";
import { ensureCommunicationProvidersRegistered } from "./providers";
import { getActorContext, enforceRecipientDomainRestrictions } from "./security";
import { renderTemplate } from "./template-engine";
import {
  EMAIL_RECIPIENT_TYPES,
  type CommunicationContextLinkInput,
  type CreateDraftInput,
  type DraftContext,
  type EmailRecipientInput,
  type EmailSearchFilters,
  type InboundEmailInput,
  type ProviderDeliveryUpdate,
  type QueueEmailInput,
  type RetryPolicy,
  type UpdateDraftInput,
  getDefaultRetryPolicy,
  nextRetryDelaySeconds,
} from "./types";

export class CommunicationService {
  private readonly workerId: string;

  constructor(workerId?: string) {
    ensureCommunicationProvidersRegistered();
    this.workerId = workerId ?? `comm-worker-${process.pid}`;
  }

  async createDraft(actor: DraftContext, input: CreateDraftInput) {
    const mailbox = await this.resolveOutboundMailbox(actor.tenantId, input.mailboxConfigId ?? null);

    const templateRender = input.templateId
      ? await this.renderTemplateForMessage(actor, input.templateId, input.templateVersionId ?? null, input.templateData ?? {})
      : null;

    const fromAddress =
      normalizeEmail(input.fromAddress) ??
      normalizeEmail(templateRender?.defaultFromAddress) ??
      normalizeEmail(mailbox?.fromAddress) ??
      "noreply@manufacturing.local";

    const replyTo =
      normalizeEmail(input.replyTo) ??
      normalizeEmail(templateRender?.defaultReplyTo) ??
      normalizeEmail(mailbox?.replyTo) ??
      null;

    const conversationId = await this.resolveConversationId(actor, {
      conversationId: input.conversationId ?? null,
      parentMessageId: input.parentMessageId ?? null,
      subject: input.subject ?? templateRender?.subject ?? null,
    });

    const messageIdHeader = `<${randomUUID()}@${sanitizeForMessageId(actor.tenantId)}.erp.local>`;

    const [inserted] = await db
      .insert(commEmailMessagesTable)
      .values({
        direction: "outbound",
        status: "draft",
        subject: input.subject ?? templateRender?.subject ?? "",
        bodyHtml: input.bodyHtml ?? templateRender?.bodyHtml ?? null,
        bodyText: input.bodyText ?? templateRender?.bodyText ?? null,
        fromAddress,
        replyTo,
        messageId: messageIdHeader,
        inReplyTo: input.inReplyTo ?? null,
        referencesHeader: input.referencesHeader ?? null,
        conversationId,
        parentMessageId: input.parentMessageId ?? null,
        templateId: input.templateId ?? null,
        templateVersionId: input.templateVersionId ?? templateRender?.templateVersionId ?? null,
        mailboxConfigId: input.mailboxConfigId ?? mailbox?.id ?? null,
        providerName: input.providerName ?? mailbox?.providerName ?? "mock",
        idempotencyKey: input.idempotencyKey ?? null,
        approvalStatus: input.requiresApproval ? "pending" : "not_required",
        requiresApproval: input.requiresApproval ?? false,
        sendAfter: input.sendAfter ?? null,
        sourceModule: input.sourceModule ?? null,
        sourceAction: input.sourceAction ?? null,
        createdBy: actor.userId,
        tenantId: actor.tenantId,
        companyId: actor.companyId ?? null,
        siteId: actor.siteId ?? null,
      })
      .returning({ id: commEmailMessagesTable.id, conversationId: commEmailMessagesTable.conversationId });

    if (!inserted) {
      throw new Error("Failed to create draft message");
    }

    if (input.recipients && input.recipients.length > 0) {
      await this.replaceRecipients(inserted.id, input.recipients);
    }

    await replaceContextLinks(inserted.id, actor, input.contextLinks ?? []);
    await this.touchConversation(inserted.conversationId ?? null);

    await writeCommunicationAuditLog({
      action: "draft.create",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId: inserted.id,
      details: {
        templateId: input.templateId ?? null,
        recipientCount: input.recipients?.length ?? 0,
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(inserted.id);
  }

  async updateDraft(actor: DraftContext, messageId: string, input: UpdateDraftInput) {
    const [existing] = await db
      .select()
      .from(commEmailMessagesTable)
      .where(eq(commEmailMessagesTable.id, messageId))
      .limit(1);

    if (!existing) {
      throw new Error("Message not found");
    }

    if (existing.status !== "draft" && existing.status !== "queued") {
      throw new Error("Only draft or queued messages can be edited");
    }

    const templateRender = input.templateId
      ? await this.renderTemplateForMessage(actor, input.templateId, input.templateVersionId ?? null, input.templateData ?? {})
      : null;

    await db
      .update(commEmailMessagesTable)
      .set({
        subject: input.subject ?? templateRender?.subject,
        bodyHtml: input.bodyHtml ?? templateRender?.bodyHtml,
        bodyText: input.bodyText ?? templateRender?.bodyText,
        fromAddress: normalizeEmail(input.fromAddress) ?? undefined,
        replyTo: normalizeEmail(input.replyTo) ?? undefined,
        templateId: input.templateId ?? undefined,
        templateVersionId: input.templateVersionId ?? templateRender?.templateVersionId ?? undefined,
        inReplyTo: input.inReplyTo ?? undefined,
        referencesHeader: input.referencesHeader ?? undefined,
        mailboxConfigId: input.mailboxConfigId ?? undefined,
        providerName: input.providerName ?? undefined,
        sendAfter: input.sendAfter ?? undefined,
        requiresApproval: input.requiresApproval ?? undefined,
        approvalStatus: input.requiresApproval ? "pending" : undefined,
        updatedAt: new Date(),
      })
      .where(eq(commEmailMessagesTable.id, messageId));

    if (input.recipients) {
      await this.replaceRecipients(messageId, input.recipients);
    }
    if (input.contextLinks) {
      await replaceContextLinks(messageId, actor, input.contextLinks);
    }

    await writeCommunicationAuditLog({
      action: "draft.update",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      details: {
        updatedFields: Object.keys(input),
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(messageId);
  }

  async approveDraft(actor: DraftContext, messageId: string, note?: string | null) {
    const [message] = await db
      .select({ id: commEmailMessagesTable.id, requiresApproval: commEmailMessagesTable.requiresApproval })
      .from(commEmailMessagesTable)
      .where(eq(commEmailMessagesTable.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message not found");
    }

    if (!message.requiresApproval) {
      return this.getMessageWithRelations(messageId);
    }

    await db
      .update(commEmailMessagesTable)
      .set({
        approvalStatus: "approved",
        approvedBy: actor.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commEmailMessagesTable.id, messageId));

    await writeCommunicationAuditLog({
      action: "draft.approve",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      details: { note: note ?? null },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(messageId);
  }

  async addAttachment(req: Request, messageId: string, input: AttachToMessageInput) {
    const actor = getActorContext(req);
    const result = await addAttachmentToMessage(req, messageId, actor, input);

    await writeCommunicationAuditLog({
      action: "attachment.add",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      details: {
        attachmentId: result.attachmentId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return result;
  }

  async queueEmail(actor: DraftContext, messageId: string, options?: QueueEmailInput) {
    const [message] = await db
      .select()
      .from(commEmailMessagesTable)
      .where(eq(commEmailMessagesTable.id, messageId))
      .limit(1);

    if (!message) {
      throw new Error("Message not found");
    }
    if (message.direction !== "outbound") {
      throw new Error("Only outbound messages can be queued");
    }
    if (!["draft", "queued", "failed", "bounced"].includes(message.status)) {
      throw new Error(`Message cannot be queued from status ${message.status}`);
    }

    const mailbox = await this.resolveOutboundMailbox(actor.tenantId, options?.mailboxConfigId ?? message.mailboxConfigId);
    const recipients = await db
      .select({ type: commEmailRecipientsTable.recipientType, email: commEmailRecipientsTable.emailAddress })
      .from(commEmailRecipientsTable)
      .where(eq(commEmailRecipientsTable.messageId, messageId));

    const toRecipients = recipients.filter((recipient) => recipient.type === "to");
    if (toRecipients.length === 0) {
      throw new Error("At least one TO recipient is required before queueing");
    }

    const domainCheck = enforceRecipientDomainRestrictions(
      recipients.map((recipient) => recipient.email),
      {
        allowedDomains: extractDomainPolicy(mailbox?.allowedRecipientDomains),
        blockedDomains: extractDomainPolicy(mailbox?.blockedRecipientDomains),
      },
    );

    if (!domainCheck.allowed) {
      throw new Error(`Recipient domain policy violation: ${domainCheck.blockedRecipients.join(", ")}`);
    }

    if (message.requiresApproval && message.approvalStatus !== "approved") {
      throw new Error("Message requires approval before queueing");
    }

    const sendAt = options?.sendAt ?? message.sendAfter ?? new Date();
    const retryPolicy = parseRetryPolicy(mailbox?.retryPolicy);

    await db
      .update(commEmailMessagesTable)
      .set({
        status: "queued",
        queuedAt: new Date(),
        sendAfter: sendAt,
        providerName: mailbox?.providerName ?? message.providerName ?? "mock",
        mailboxConfigId: options?.mailboxConfigId ?? message.mailboxConfigId,
        idempotencyKey: options?.idempotencyKey ?? message.idempotencyKey,
        updatedAt: new Date(),
      })
      .where(eq(commEmailMessagesTable.id, messageId));

    await db
      .insert(commEmailOutboxTable)
      .values({
        messageId,
        status: "queued",
        availableAt: sendAt,
        attemptCount: 0,
        maxAttempts: retryPolicy.maxAttempts,
      })
      .onConflictDoUpdate({
        target: commEmailOutboxTable.messageId,
        set: {
          status: "queued",
          availableAt: sendAt,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: new Date(),
        },
      });

    await writeCommunicationAuditLog({
      action: "email.queue",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      details: {
        sendAt: sendAt.toISOString(),
        mailboxConfigId: options?.mailboxConfigId ?? message.mailboxConfigId ?? null,
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(messageId);
  }

  async sendNow(actor: DraftContext, messageId: string) {
    await this.queueEmail(actor, messageId, { sendAt: new Date() });
    await this.processOutboxBatch(1);
    return this.getMessageWithRelations(messageId);
  }

  async retryQueuedMessage(actor: DraftContext, messageId: string) {
    await db
      .update(commEmailOutboxTable)
      .set({
        status: "queued",
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(commEmailOutboxTable.messageId, messageId));

    await db
      .update(commEmailMessagesTable)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(commEmailMessagesTable.id, messageId));

    await writeCommunicationAuditLog({
      action: "email.retry",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(messageId);
  }

  async resendFailedMessage(actor: DraftContext, messageId: string, sendImmediately = false) {
    const original = await this.getMessageWithRelations(messageId);
    if (!original) {
      throw new Error("Message not found");
    }
    if (!["failed", "bounced"].includes(original.status)) {
      throw new Error("Only failed/bounced messages can be resent");
    }

    const draft = await this.createDraft(actor, {
      subject: original.subject,
      bodyHtml: original.bodyHtml,
      bodyText: original.bodyText,
      fromAddress: original.fromAddress,
      replyTo: original.replyTo,
      templateId: original.templateId,
      templateVersionId: original.templateVersionId,
      conversationId: original.conversationId,
      parentMessageId: messageId,
      sourceModule: original.sourceModule,
      sourceAction: "resend",
      recipients: original.recipients.map((recipient) => ({
        recipientType: normalizeRecipientType(recipient.recipientType),
        emailAddress: recipient.emailAddress,
        displayName: recipient.displayName,
      })),
      contextLinks: original.contextLinks,
      requiresApproval: original.requiresApproval,
    });

    if (!draft) {
      throw new Error("Failed to create resend draft");
    }

    if (original.attachments.length > 0) {
      const attachmentLinks = original.attachments
        .filter((attachment) => typeof attachment.id === "string")
        .map((attachment, idx) => ({
          messageId: draft.id,
          attachmentId: attachment.id as string,
          disposition: attachment.disposition ?? "attachment",
          inlineCid: attachment.inlineCid ?? null,
          sortOrder: idx,
        }));

      if (attachmentLinks.length > 0) {
      await db.insert(commEmailMessageAttachmentsTable).values(
        attachmentLinks,
      );
      }
    }

    if (sendImmediately) {
      await this.sendNow(actor, draft.id);
      return this.getMessageWithRelations(draft.id);
    }

    return draft;
  }

  async processOutboxBatch(maxItems = 25) {
    const now = new Date();
    const due = await db
      .select()
      .from(commEmailOutboxTable)
      .where(
        and(
          or(eq(commEmailOutboxTable.status, "queued"), eq(commEmailOutboxTable.status, "retry_wait")),
          lte(commEmailOutboxTable.availableAt, now),
        ),
      )
      .orderBy(asc(commEmailOutboxTable.availableAt))
      .limit(maxItems);

    let processed = 0;
    for (const candidate of due) {
      const [claimed] = await db
        .update(commEmailOutboxTable)
        .set({
          status: "processing",
          lockedAt: new Date(),
          lockedBy: this.workerId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(commEmailOutboxTable.id, candidate.id),
            or(eq(commEmailOutboxTable.status, "queued"), eq(commEmailOutboxTable.status, "retry_wait")),
          ),
        )
        .returning();

      if (!claimed) {
        continue;
      }

      await this.processOutboxEntry(claimed);
      processed += 1;
    }

    return { processed };
  }

  async getConversation(conversationId: string, tenantId: string) {
    const [conversation] = await db
      .select()
      .from(commEmailConversationsTable)
      .where(and(eq(commEmailConversationsTable.id, conversationId), eq(commEmailConversationsTable.tenantId, tenantId)))
      .limit(1);

    if (!conversation) {
      return null;
    }

    const messages = await db
      .select()
      .from(commEmailMessagesTable)
      .where(eq(commEmailMessagesTable.conversationId, conversationId))
      .orderBy(asc(commEmailMessagesTable.createdAt));

    const messageIds = messages.map((message) => message.id);
    const recipients = messageIds.length
      ? await db
          .select()
          .from(commEmailRecipientsTable)
          .where(inArray(commEmailRecipientsTable.messageId, messageIds))
          .orderBy(asc(commEmailRecipientsTable.sortOrder))
      : [];

    const attachments = messageIds.length
      ? await db
          .select({
            messageId: commEmailMessageAttachmentsTable.messageId,
            attachmentId: commEmailAttachmentsTable.id,
            filename: commEmailAttachmentsTable.filename,
            mimeType: commEmailAttachmentsTable.mimeType,
            byteSize: commEmailAttachmentsTable.byteSize,
            disposition: commEmailMessageAttachmentsTable.disposition,
            inlineCid: commEmailMessageAttachmentsTable.inlineCid,
          })
          .from(commEmailMessageAttachmentsTable)
          .leftJoin(commEmailAttachmentsTable, eq(commEmailMessageAttachmentsTable.attachmentId, commEmailAttachmentsTable.id))
          .where(inArray(commEmailMessageAttachmentsTable.messageId, messageIds))
      : [];

    const contextLinks = messageIds.length
      ? await db.select().from(commEmailContextLinksTable).where(inArray(commEmailContextLinksTable.messageId, messageIds))
      : [];

    return {
      conversation,
      messages: messages.map((message) => ({
        ...message,
        recipients: recipients.filter((recipient) => recipient.messageId === message.id),
        attachments: attachments.filter((attachment) => attachment.messageId === message.id),
        contextLinks: contextLinks.filter((context) => context.messageId === message.id),
      })),
    };
  }

  async getRecordHistory(query: {
    entityType: string;
    entityId: string;
    tenantId: string;
    companyId?: string | null;
    siteId?: string | null;
    page: number;
    limit: number;
    sender?: string | null;
    recipient?: string | null;
    status?: string | null;
    templateId?: string | null;
    hasAttachments?: boolean | null;
    fromDate?: Date | null;
    toDate?: Date | null;
  }) {
    return getEmailHistoryForRecord(query);
  }

  async search(filters: EmailSearchFilters, page: number, limit: number) {
    return searchCommunications(filters, page, limit);
  }

  async markStatus(actor: DraftContext, messageId: string, status: string, error?: string | null) {
    const patch: Record<string, unknown> = {
      status,
      lastError: error ?? null,
      updatedAt: new Date(),
    };
    if (status === "sent") patch.sentAt = new Date();
    if (status === "received") patch.receivedAt = new Date();
    if (status === "archived") patch.archivedAt = new Date();

    await db.update(commEmailMessagesTable).set(patch).where(eq(commEmailMessagesTable.id, messageId));

    await writeCommunicationAuditLog({
      action: "email.mark_status",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      messageId,
      details: { status, error: error ?? null },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getMessageWithRelations(messageId);
  }

  async ingestProviderWebhook(
    providerName: string,
    payload: unknown,
    headers: Record<string, string | undefined>,
    tenantContext?: { tenantId?: string; companyId?: string | null; siteId?: string | null },
  ) {
    const provider = getCommunicationProvider(providerName);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const parsed = await provider.parseWebhook(payload, headers);

    for (const update of parsed.deliveryUpdates) {
      await this.handleDeliveryUpdate(providerName, update, tenantContext);
    }

    for (const inbound of parsed.inboundEmails) {
      await this.ingestInboundEmail(inbound);
    }

    return {
      processedDeliveryUpdates: parsed.deliveryUpdates.length,
      processedInboundEmails: parsed.inboundEmails.length,
    };
  }

  async ingestInboundEmail(input: InboundEmailInput) {
    const parent = await this.findParentMessageByHeaders(input.inReplyTo, input.referencesHeader);

    const conversationId =
      parent?.conversationId ??
      (await this.createConversation(
        {
          tenantId: input.tenantId,
          companyId: input.companyId ?? null,
          siteId: input.siteId ?? null,
          userId: "system-inbound",
          userName: "Inbound Mailbox",
          userRole: "system",
        },
        input.subject ?? "Inbound message",
      ));

    const messageIdHeader = input.messageId ?? `<${randomUUID()}@inbound.${sanitizeForMessageId(input.tenantId)}.erp.local>`;

    const [message] = await db
      .insert(commEmailMessagesTable)
      .values({
        direction: "inbound",
        status: "received",
        subject: input.subject ?? "",
        bodyHtml: input.bodyHtml ?? null,
        bodyText: input.bodyText ?? null,
        fromAddress: normalizeEmail(input.fromAddress) ?? input.fromAddress,
        messageId: messageIdHeader,
        inReplyTo: input.inReplyTo ?? null,
        referencesHeader: input.referencesHeader ?? null,
        conversationId,
        parentMessageId: parent?.id ?? null,
        providerName: input.providerName,
        providerMessageId: input.providerMessageId ?? null,
        tenantId: input.tenantId,
        companyId: input.companyId ?? null,
        siteId: input.siteId ?? null,
        receivedAt: input.receivedAt ?? new Date(),
        createdBy: "system-inbound",
      })
      .returning({ id: commEmailMessagesTable.id });

    if (!message) {
      throw new Error("Failed to persist inbound email");
    }

    await db.insert(commEmailRecipientsTable).values([
      ...input.to.map((email, idx) => ({
        messageId: message.id,
        recipientType: "to",
        emailAddress: normalizeEmail(email) ?? email,
        sortOrder: idx,
      })),
      ...(input.cc ?? []).map((email, idx) => ({
        messageId: message.id,
        recipientType: "cc",
        emailAddress: normalizeEmail(email) ?? email,
        sortOrder: input.to.length + idx,
      })),
      ...(input.bcc ?? []).map((email, idx) => ({
        messageId: message.id,
        recipientType: "bcc",
        emailAddress: normalizeEmail(email) ?? email,
        sortOrder: input.to.length + (input.cc?.length ?? 0) + idx,
      })),
    ]);

    const links = await this.deriveInboundContextLinks(input, parent?.id ?? null);
    if (links.length > 0) {
      await replaceContextLinks(
        message.id,
        {
          tenantId: input.tenantId,
          companyId: input.companyId ?? null,
          siteId: input.siteId ?? null,
          userId: "system-inbound",
        },
        links,
      );
    }

    if (input.attachments && input.attachments.length > 0) {
      const created = await db
        .insert(commEmailAttachmentsTable)
        .values(
          input.attachments.map((attachment) => ({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            byteSize: attachment.byteSize,
            checksum: attachment.checksum ?? null,
            sourceType: "inbound_email",
            sourceId: message.id,
            objectStorageKey: attachment.objectStorageKey,
            objectStorageBucket: attachment.objectStorageBucket ?? null,
            createdBy: "system-inbound",
            tenantId: input.tenantId,
            companyId: input.companyId ?? null,
            siteId: input.siteId ?? null,
          })),
        )
        .returning({ id: commEmailAttachmentsTable.id });

      if (created.length > 0) {
        await db.insert(commEmailMessageAttachmentsTable).values(
          created.map((attachment, idx) => ({
            messageId: message.id,
            attachmentId: attachment.id,
            sortOrder: idx,
          })),
        );
      }
    }

    await this.touchConversation(conversationId);

    await db.insert(commEmailProviderEventsTable).values({
      messageId: message.id,
      providerName: input.providerName,
      providerEventId: input.providerMessageId ?? null,
      eventType: "received",
      eventStatus: "received",
      payload: input.rawPayload ?? null,
      tenantId: input.tenantId,
      companyId: input.companyId ?? null,
      siteId: input.siteId ?? null,
      processedAt: new Date(),
    });

    await writeCommunicationAuditLog({
      action: "inbound.received",
      actorId: "system-inbound",
      actorName: "Inbound Mailbox",
      actorRole: "system",
      messageId: message.id,
      details: {
        providerName: input.providerName,
        fromAddress: input.fromAddress,
      },
      tenantId: input.tenantId,
      companyId: input.companyId,
      siteId: input.siteId,
    });

    return this.getMessageWithRelations(message.id);
  }

  async renderTemplatePreview(actor: DraftContext, input: { templateId: string; templateVersionId?: string | null; data: Record<string, unknown> }) {
    return this.renderTemplateForMessage(actor, input.templateId, input.templateVersionId ?? null, input.data);
  }

  async listTemplates(tenantId: string, includeInactive = true) {
    return db
      .select()
      .from(commEmailTemplatesTable)
      .where(and(eq(commEmailTemplatesTable.tenantId, tenantId), includeInactive ? sql`true` : eq(commEmailTemplatesTable.isActive, true)))
      .orderBy(asc(commEmailTemplatesTable.module), asc(commEmailTemplatesTable.name));
  }

  async createTemplate(
    actor: DraftContext,
    input: {
      code: string;
      name: string;
      category: string;
      module: string;
      description?: string | null;
      companyBranding?: Record<string, unknown> | null;
      defaultFromAddress?: string | null;
      defaultReplyTo?: string | null;
      defaultMailboxConfigId?: string | null;
      initialVersion: {
        subjectTemplate: string;
        bodyHtmlTemplate?: string | null;
        bodyTextTemplate?: string | null;
        placeholderSchema?: Record<string, unknown> | null;
        changeNotes?: string | null;
      };
    },
  ) {
    const [template] = await db
      .insert(commEmailTemplatesTable)
      .values({
        code: input.code,
        name: input.name,
        category: input.category,
        module: input.module,
        description: input.description ?? null,
        companyBranding: input.companyBranding ?? null,
        defaultFromAddress: normalizeEmail(input.defaultFromAddress) ?? null,
        defaultReplyTo: normalizeEmail(input.defaultReplyTo) ?? null,
        defaultMailboxConfigId: input.defaultMailboxConfigId ?? null,
        tenantId: actor.tenantId,
        companyId: actor.companyId ?? null,
        siteId: actor.siteId ?? null,
        createdBy: actor.userId,
      })
      .returning();

    if (!template) {
      throw new Error("Failed to create template");
    }

    const version = await this.createTemplateVersion(actor, template.id, {
      version: 1,
      subjectTemplate: input.initialVersion.subjectTemplate,
      bodyHtmlTemplate: input.initialVersion.bodyHtmlTemplate ?? null,
      bodyTextTemplate: input.initialVersion.bodyTextTemplate ?? null,
      placeholderSchema: input.initialVersion.placeholderSchema ?? null,
      changeNotes: input.initialVersion.changeNotes ?? "Initial version",
      activate: true,
    });

    await writeCommunicationAuditLog({
      action: "template.create",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      templateId: template.id,
      details: {
        code: input.code,
        module: input.module,
        activeVersionId: version.id,
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getTemplateWithVersions(template.id);
  }

  async createTemplateVersion(
    actor: DraftContext,
    templateId: string,
    input: {
      version?: number;
      subjectTemplate: string;
      bodyHtmlTemplate?: string | null;
      bodyTextTemplate?: string | null;
      placeholderSchema?: Record<string, unknown> | null;
      changeNotes?: string | null;
      activate?: boolean;
    },
  ) {
    const [template] = await db
      .select()
      .from(commEmailTemplatesTable)
      .where(eq(commEmailTemplatesTable.id, templateId))
      .limit(1);

    if (!template) {
      throw new Error("Template not found");
    }

    const [latest] = await db
      .select({ latestVersion: sql<number>`coalesce(max(${commEmailTemplateVersionsTable.version}), 0)` })
      .from(commEmailTemplateVersionsTable)
      .where(eq(commEmailTemplateVersionsTable.templateId, templateId));

    const versionNumber = input.version ?? Number(latest?.latestVersion ?? 0) + 1;

    const [version] = await db
      .insert(commEmailTemplateVersionsTable)
      .values({
        templateId,
        version: versionNumber,
        status: input.activate ? "active" : "draft",
        isActive: input.activate ?? false,
        subjectTemplate: input.subjectTemplate,
        bodyHtmlTemplate: input.bodyHtmlTemplate ?? null,
        bodyTextTemplate: input.bodyTextTemplate ?? null,
        placeholderSchema: input.placeholderSchema ?? null,
        changeNotes: input.changeNotes ?? null,
        createdBy: actor.userId,
      })
      .returning();

    if (!version) {
      throw new Error("Failed to create template version");
    }

    if (input.activate) {
      await this.activateTemplateVersion(actor, templateId, version.id);
    }

    await writeCommunicationAuditLog({
      action: "template.version.create",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      templateId,
      details: {
        versionId: version.id,
        versionNumber,
        activate: input.activate ?? false,
      },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return version;
  }

  async activateTemplateVersion(actor: DraftContext, templateId: string, versionId: string) {
    await db
      .update(commEmailTemplateVersionsTable)
      .set({ isActive: false, status: "inactive" })
      .where(eq(commEmailTemplateVersionsTable.templateId, templateId));

    await db
      .update(commEmailTemplateVersionsTable)
      .set({ isActive: true, status: "active" })
      .where(and(eq(commEmailTemplateVersionsTable.id, versionId), eq(commEmailTemplateVersionsTable.templateId, templateId)));

    await db
      .update(commEmailTemplatesTable)
      .set({ activeVersionId: versionId, updatedAt: new Date() })
      .where(eq(commEmailTemplatesTable.id, templateId));

    await writeCommunicationAuditLog({
      action: "template.version.activate",
      actorId: actor.userId,
      actorName: actor.userName,
      actorRole: actor.userRole,
      templateId,
      details: { versionId },
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      siteId: actor.siteId,
    });

    return this.getTemplateWithVersions(templateId);
  }

  async listOutboundMailboxes() {
    return db.select().from(commOutboundMailboxConfigsTable).orderBy(asc(commOutboundMailboxConfigsTable.name));
  }

  async createOutboundMailbox(
    actor: DraftContext,
    input: {
      name: string;
      providerName: string;
      fromAddress: string;
      replyTo?: string | null;
      providerConfig?: Record<string, unknown> | null;
      authConfig?: Record<string, unknown> | null;
      allowedRecipientDomains?: string[];
      blockedRecipientDomains?: string[];
      retryPolicy?: Partial<RetryPolicy>;
      requireApprovalForExternal?: boolean;
      isActive?: boolean;
    },
  ) {
    const provider = getCommunicationProvider(input.providerName);
    if (!provider) {
      throw new Error(`Provider not registered: ${input.providerName}`);
    }

    const validation = await provider.validateConfiguration(input.providerConfig ?? {});
    if (!validation.valid) {
      throw new Error(`Provider configuration invalid: ${validation.errors.join(", ")}`);
    }

    const [mailbox] = await db
      .insert(commOutboundMailboxConfigsTable)
      .values({
        name: input.name,
        providerName: input.providerName,
        isActive: input.isActive ?? true,
        fromAddress: normalizeEmail(input.fromAddress) ?? input.fromAddress,
        replyTo: normalizeEmail(input.replyTo) ?? null,
        providerConfig: input.providerConfig ?? null,
        authConfig: input.authConfig ?? null,
        allowedRecipientDomains: input.allowedRecipientDomains ?? null,
        blockedRecipientDomains: input.blockedRecipientDomains ?? null,
        retryPolicy: normalizeRetryPolicy(input.retryPolicy),
        requireApprovalForExternal: input.requireApprovalForExternal ?? false,
        defaultTenantId: actor.tenantId,
        defaultCompanyId: actor.companyId ?? null,
        defaultSiteId: actor.siteId ?? null,
        createdBy: actor.userId,
      })
      .returning();

    return mailbox;
  }

  async listInboundMailboxes() {
    return db.select().from(commInboundMailboxConfigsTable).orderBy(asc(commInboundMailboxConfigsTable.name));
  }

  async createInboundMailbox(
    actor: DraftContext,
    input: {
      name: string;
      providerName: string;
      mailboxAddress: string;
      connectionConfig?: Record<string, unknown> | null;
      authConfig?: Record<string, unknown> | null;
      routingRules?: Record<string, unknown> | null;
      allowedSenderDomains?: string[];
      isActive?: boolean;
    },
  ) {
    const [mailbox] = await db
      .insert(commInboundMailboxConfigsTable)
      .values({
        name: input.name,
        providerName: input.providerName,
        mailboxAddress: normalizeEmail(input.mailboxAddress) ?? input.mailboxAddress,
        connectionConfig: input.connectionConfig ?? null,
        authConfig: input.authConfig ?? null,
        routingRules: input.routingRules ?? null,
        allowedSenderDomains: input.allowedSenderDomains ?? null,
        isActive: input.isActive ?? true,
        defaultTenantId: actor.tenantId,
        defaultCompanyId: actor.companyId ?? null,
        defaultSiteId: actor.siteId ?? null,
        createdBy: actor.userId,
      })
      .returning();

    return mailbox;
  }

  async getMetrics() {
    const [queued, deadLetter] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(commEmailOutboxTable)
        .where(or(eq(commEmailOutboxTable.status, "queued"), eq(commEmailOutboxTable.status, "retry_wait"))),
      db.select({ count: sql<number>`count(*)` }).from(commEmailOutboxTable).where(eq(commEmailOutboxTable.status, "dead_letter")),
    ]);

    return {
      ...getMetricsSnapshot(),
      queueDepth: Number(queued[0]?.count ?? 0),
      deadLetterDepth: Number(deadLetter[0]?.count ?? 0),
    };
  }

  private async processOutboxEntry(entry: typeof commEmailOutboxTable.$inferSelect) {
    const [message] = await db
      .select()
      .from(commEmailMessagesTable)
      .where(eq(commEmailMessagesTable.id, entry.messageId))
      .limit(1);

    if (!message) {
      await db
        .update(commEmailOutboxTable)
        .set({ status: "dead_letter", lastError: "message_not_found", lockedAt: null, lockedBy: null, updatedAt: new Date() })
        .where(eq(commEmailOutboxTable.id, entry.id));
      incrementMetric("queueDeadLetter");
      return;
    }

    if (message.status === "sent" || message.status === "delivered") {
      await db
        .update(commEmailOutboxTable)
        .set({ status: "completed", lockedAt: null, lockedBy: null, updatedAt: new Date() })
        .where(eq(commEmailOutboxTable.id, entry.id));
      return;
    }

    const recipients = await db
      .select({
        recipientType: commEmailRecipientsTable.recipientType,
        emailAddress: commEmailRecipientsTable.emailAddress,
        displayName: commEmailRecipientsTable.displayName,
      })
      .from(commEmailRecipientsTable)
      .where(eq(commEmailRecipientsTable.messageId, message.id))
      .orderBy(asc(commEmailRecipientsTable.sortOrder));

    if (recipients.length === 0) {
      await this.failOutboxEntry(entry, message.id, "recipient_missing", "No recipients on queued message", false, message.providerName ?? "mock");
      return;
    }

    const attachments = await listMessageAttachments(message.id);
    const mailbox = message.mailboxConfigId
      ? await this.resolveOutboundMailbox(message.tenantId, message.mailboxConfigId)
      : await this.resolveOutboundMailbox(message.tenantId, null);

    const providerName = message.providerName ?? mailbox?.providerName ?? "mock";
    const provider = getCommunicationProvider(providerName);
    if (!provider) {
      await this.failOutboxEntry(entry, message.id, "provider_missing", `No registered provider for ${providerName}`, false, providerName);
      return;
    }

    await db
      .update(commEmailMessagesTable)
      .set({ status: "sending", updatedAt: new Date(), providerName })
      .where(eq(commEmailMessagesTable.id, message.id));

    const providerAttachments = attachments.flatMap((attachment) => {
      if (
        typeof attachment.filename !== "string" ||
        typeof attachment.mimeType !== "string" ||
        typeof attachment.byteSize !== "number" ||
        typeof attachment.objectStorageKey !== "string"
      ) {
        return [];
      }

      return [
        {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          byteSize: attachment.byteSize,
          objectStorageKey: attachment.objectStorageKey,
          objectStorageBucket: attachment.objectStorageBucket,
          checksum: attachment.checksum,
        },
      ];
    });

    const payload: ProviderSendPayload = {
      messageId: message.id,
      fromAddress: message.fromAddress,
      replyTo: message.replyTo,
      subject: message.subject,
      bodyHtml: message.bodyHtml,
      bodyText: message.bodyText,
      to: recipients
        .filter((recipient): recipient is { recipientType: string; emailAddress: string; displayName: string | null } => recipient.recipientType === "to")
        .map((recipient) => ({
          recipientType: "to" as const,
          emailAddress: recipient.emailAddress,
          displayName: recipient.displayName,
        })),
      cc: recipients
        .filter((recipient): recipient is { recipientType: string; emailAddress: string; displayName: string | null } => recipient.recipientType === "cc")
        .map((recipient) => ({
          recipientType: "cc" as const,
          emailAddress: recipient.emailAddress,
          displayName: recipient.displayName,
        })),
      bcc: recipients
        .filter((recipient): recipient is { recipientType: string; emailAddress: string; displayName: string | null } => recipient.recipientType === "bcc")
        .map((recipient) => ({
          recipientType: "bcc" as const,
          emailAddress: recipient.emailAddress,
          displayName: recipient.displayName,
        })),
      attachments: providerAttachments,
      headers: {
        "Message-Id": message.messageId ?? `<${randomUUID()}@${sanitizeForMessageId(message.tenantId)}.erp.local>`,
      },
    };

    const startedAt = Date.now();

    try {
      const response = await provider.sendEmail(payload);
      const latencyMs = Date.now() - startedAt;
      const now = new Date();

      await db.insert(commEmailSendAttemptsTable).values({
        messageId: message.id,
        attemptNumber: entry.attemptCount + 1,
        providerName,
        providerMessageId: response.providerMessageId ?? null,
        status: "success",
        requestPayload: {
          fromAddress: payload.fromAddress,
          recipientCounts: {
            to: payload.to.length,
            cc: payload.cc.length,
            bcc: payload.bcc.length,
          },
          attachmentCount: payload.attachments.length,
        },
        responsePayload: response.responsePayload ?? null,
        latencyMs,
      });

      await db
        .update(commEmailMessagesTable)
        .set({
          status: response.status === "queued" ? "queued" : "sent",
          providerName,
          providerMessageId: response.providerMessageId ?? null,
          messageId: response.messageId ?? message.messageId,
          sentAt: response.status === "sent" ? now : message.sentAt,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(commEmailMessagesTable.id, message.id));

      await db
        .update(commEmailOutboxTable)
        .set({
          status: response.status === "queued" ? "queued" : "completed",
          availableAt: response.status === "queued" ? new Date(Date.now() + 10_000) : entry.availableAt,
          attemptCount: entry.attemptCount + 1,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(commEmailOutboxTable.id, entry.id));

      await this.touchConversation(message.conversationId);
      incrementMetric("sentSuccess");
      incrementMetric("queueProcessed");

      await writeCommunicationAuditLog({
        action: "email.sent",
        actorId: this.workerId,
        actorName: "Communication Worker",
        actorRole: "system",
        messageId: message.id,
        details: {
          providerName,
          providerMessageId: response.providerMessageId ?? null,
          latencyMs,
        },
        tenantId: message.tenantId,
        companyId: message.companyId,
        siteId: message.siteId,
        source: "worker",
      });
    } catch (error) {
      const providerError = toProviderError(error);
      await this.failOutboxEntry(
        entry,
        message.id,
        providerError.code,
        providerError.message,
        providerError.transient,
        providerName,
        providerError.details ?? undefined,
        mailbox?.retryPolicy,
      );
    }
  }

  private async failOutboxEntry(
    entry: typeof commEmailOutboxTable.$inferSelect,
    messageId: string,
    errorCode: string,
    errorMessage: string,
    transient: boolean,
    providerName: string,
    details?: Record<string, unknown>,
    retryPolicyRaw?: unknown,
  ) {
    const policy = parseRetryPolicy(retryPolicyRaw);
    const attemptNumber = entry.attemptCount + 1;
    const shouldRetry = transient && attemptNumber < Math.max(policy.maxAttempts, entry.maxAttempts);
    const now = new Date();

    await db.insert(commEmailSendAttemptsTable).values({
      messageId,
      attemptNumber,
      providerName,
      status: shouldRetry ? "transient_failure" : "permanent_failure",
      errorCode,
      errorMessage,
      responsePayload: details ?? null,
      nextRetryAt: shouldRetry ? new Date(Date.now() + nextRetryDelaySeconds(policy, attemptNumber) * 1000) : null,
    });

    if (shouldRetry) {
      const retryAt = new Date(Date.now() + nextRetryDelaySeconds(policy, attemptNumber) * 1000);
      await db
        .update(commEmailOutboxTable)
        .set({
          status: "retry_wait",
          availableAt: retryAt,
          attemptCount: attemptNumber,
          lastError: `${errorCode}: ${errorMessage}`,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        })
        .where(eq(commEmailOutboxTable.id, entry.id));

      await db
        .update(commEmailMessagesTable)
        .set({
          status: "queued",
          lastError: `${errorCode}: ${errorMessage}`,
          updatedAt: now,
        })
        .where(eq(commEmailMessagesTable.id, messageId));

      incrementMetric("retriesScheduled");
    } else {
      await db
        .update(commEmailOutboxTable)
        .set({
          status: "dead_letter",
          attemptCount: attemptNumber,
          lastError: `${errorCode}: ${errorMessage}`,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        })
        .where(eq(commEmailOutboxTable.id, entry.id));

      await db
        .update(commEmailMessagesTable)
        .set({
          status: "failed",
          lastError: `${errorCode}: ${errorMessage}`,
          updatedAt: now,
        })
        .where(eq(commEmailMessagesTable.id, messageId));

      incrementMetric("queueDeadLetter");
    }

    incrementMetric("sentFailure");

    const [message] = await db.select().from(commEmailMessagesTable).where(eq(commEmailMessagesTable.id, messageId)).limit(1);

    await writeCommunicationAuditLog({
      action: "email.send_failed",
      actorId: this.workerId,
      actorName: "Communication Worker",
      actorRole: "system",
      messageId,
      details: {
        transient,
        errorCode,
        errorMessage,
        attemptNumber,
      },
      tenantId: message?.tenantId ?? "default",
      companyId: message?.companyId ?? null,
      siteId: message?.siteId ?? null,
      source: "worker",
    });
  }

  private async handleDeliveryUpdate(
    providerName: string,
    update: ProviderDeliveryUpdate,
    tenantContext?: { tenantId?: string; companyId?: string | null; siteId?: string | null },
  ) {
    let messageId = update.messageId ?? null;

    if (!messageId && update.providerMessageId) {
      const [byProviderMessage] = await db
        .select({ id: commEmailMessagesTable.id })
        .from(commEmailMessagesTable)
        .where(eq(commEmailMessagesTable.providerMessageId, update.providerMessageId))
        .limit(1);
      messageId = byProviderMessage?.id ?? null;
    }

    const eventStatus = update.eventStatus ?? update.eventType;

    await db.insert(commEmailProviderEventsTable).values({
      messageId,
      providerName,
      providerEventId: update.providerEventId ?? null,
      eventType: update.eventType,
      eventStatus,
      payload: update.payload ?? null,
      headers: update.headers ?? null,
      tenantId: tenantContext?.tenantId ?? "default",
      companyId: tenantContext?.companyId ?? null,
      siteId: tenantContext?.siteId ?? null,
      processedAt: new Date(),
    });

    if (!messageId) {
      incrementMetric("inboundOrphans");
      return;
    }

    const internalStatus = mapProviderEventToInternalStatus(update.eventType);
    const patch: Record<string, unknown> = {
      status: internalStatus,
      updatedAt: new Date(),
      providerName,
      providerMessageId: update.providerMessageId ?? undefined,
    };

    if (internalStatus === "delivered") {
      patch.sentAt = new Date();
    }

    await db.update(commEmailMessagesTable).set(patch).where(eq(commEmailMessagesTable.id, messageId));

    if (internalStatus === "delivered" || internalStatus === "opened" || internalStatus === "bounced") {
      await db
        .update(commEmailRecipientsTable)
        .set({
          deliveryStatus: internalStatus,
          deliveredAt: internalStatus === "delivered" ? new Date() : undefined,
          openedAt: internalStatus === "opened" ? new Date() : undefined,
          bounceReason: internalStatus === "bounced" ? update.eventStatus ?? "bounced" : undefined,
        })
        .where(eq(commEmailRecipientsTable.messageId, messageId));
    }
  }

  private async getTemplateWithVersions(templateId: string) {
    const [template, versions] = await Promise.all([
      db.select().from(commEmailTemplatesTable).where(eq(commEmailTemplatesTable.id, templateId)).limit(1),
      db
        .select()
        .from(commEmailTemplateVersionsTable)
        .where(eq(commEmailTemplateVersionsTable.templateId, templateId))
        .orderBy(desc(commEmailTemplateVersionsTable.version)),
    ]);

    if (!template[0]) {
      return null;
    }

    return { ...template[0], versions };
  }

  private async getMessageWithRelations(messageId: string) {
    const [message] = await db.select().from(commEmailMessagesTable).where(eq(commEmailMessagesTable.id, messageId)).limit(1);
    if (!message) {
      return null;
    }

    const [recipients, attachments, contextLinks] = await Promise.all([
      db
        .select({
          recipientType: commEmailRecipientsTable.recipientType,
          emailAddress: commEmailRecipientsTable.emailAddress,
          displayName: commEmailRecipientsTable.displayName,
          deliveryStatus: commEmailRecipientsTable.deliveryStatus,
        })
        .from(commEmailRecipientsTable)
        .where(eq(commEmailRecipientsTable.messageId, messageId))
        .orderBy(asc(commEmailRecipientsTable.sortOrder)),
      listMessageAttachments(messageId),
      db.select().from(commEmailContextLinksTable).where(eq(commEmailContextLinksTable.messageId, messageId)),
    ]);

    return {
      ...message,
      recipients,
      attachments,
      contextLinks: contextLinks.map((link) => ({
        entityType: link.entityType,
        entityId: link.entityId,
        relatedEntityType: link.relatedEntityType,
        relatedEntityId: link.relatedEntityId,
        linkRole: link.linkRole,
      })),
    };
  }

  private async replaceRecipients(messageId: string, recipients: EmailRecipientInput[]) {
    const normalized = recipients
      .filter((recipient) => EMAIL_RECIPIENT_TYPES.includes(recipient.recipientType))
      .map((recipient) => ({
        recipientType: recipient.recipientType,
        emailAddress: normalizeEmail(recipient.emailAddress) ?? recipient.emailAddress,
        displayName: recipient.displayName ?? null,
      }));

    await db.delete(commEmailRecipientsTable).where(eq(commEmailRecipientsTable.messageId, messageId));
    if (normalized.length === 0) {
      return;
    }

    await db.insert(commEmailRecipientsTable).values(
      normalized.map((recipient, index) => ({
        messageId,
        recipientType: recipient.recipientType,
        emailAddress: recipient.emailAddress,
        displayName: recipient.displayName,
        sortOrder: index,
      })),
    );
  }

  private async resolveConversationId(
    actor: DraftContext,
    input: { conversationId?: string | null; parentMessageId?: string | null; subject?: string | null },
  ): Promise<string> {
    if (input.conversationId) {
      return input.conversationId;
    }

    if (input.parentMessageId) {
      const [parent] = await db
        .select({ conversationId: commEmailMessagesTable.conversationId })
        .from(commEmailMessagesTable)
        .where(eq(commEmailMessagesTable.id, input.parentMessageId))
        .limit(1);
      if (parent?.conversationId) {
        return parent.conversationId;
      }
    }

    return this.createConversation(actor, input.subject ?? "");
  }

  private async createConversation(actor: DraftContext, subject: string): Promise<string> {
    const conversationKey = randomUUID();

    const [conversation] = await db
      .insert(commEmailConversationsTable)
      .values({
        conversationKey,
        subject,
        tenantId: actor.tenantId,
        companyId: actor.companyId ?? null,
        siteId: actor.siteId ?? null,
        createdBy: actor.userId,
        lastMessageAt: new Date(),
      })
      .returning({ id: commEmailConversationsTable.id });

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }
    return conversation.id;
  }

  private async touchConversation(conversationId: string | null) {
    if (!conversationId) {
      return;
    }
    await db
      .update(commEmailConversationsTable)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(commEmailConversationsTable.id, conversationId));
  }

  private async resolveOutboundMailbox(tenantId: string, mailboxConfigId: string | null | undefined) {
    if (mailboxConfigId) {
      const [byId] = await db
        .select()
        .from(commOutboundMailboxConfigsTable)
        .where(eq(commOutboundMailboxConfigsTable.id, mailboxConfigId))
        .limit(1);
      return byId ?? null;
    }

    const [byTenant] = await db
      .select()
      .from(commOutboundMailboxConfigsTable)
      .where(and(eq(commOutboundMailboxConfigsTable.defaultTenantId, tenantId), eq(commOutboundMailboxConfigsTable.isActive, true)))
      .orderBy(desc(commOutboundMailboxConfigsTable.createdAt))
      .limit(1);

    if (byTenant) {
      return byTenant;
    }

    const [anyActive] = await db
      .select()
      .from(commOutboundMailboxConfigsTable)
      .where(eq(commOutboundMailboxConfigsTable.isActive, true))
      .orderBy(desc(commOutboundMailboxConfigsTable.createdAt))
      .limit(1);

    return anyActive ?? null;
  }

  private async renderTemplateForMessage(
    actor: DraftContext,
    templateId: string,
    templateVersionId: string | null,
    data: Record<string, unknown>,
  ) {
    const [template] = await db
      .select()
      .from(commEmailTemplatesTable)
      .where(and(eq(commEmailTemplatesTable.id, templateId), eq(commEmailTemplatesTable.tenantId, actor.tenantId)))
      .limit(1);

    if (!template) {
      throw new Error("Template not found");
    }

    const conditions = [eq(commEmailTemplateVersionsTable.templateId, templateId)];
    if (templateVersionId) {
      conditions.push(eq(commEmailTemplateVersionsTable.id, templateVersionId));
    } else if (template.activeVersionId) {
      conditions.push(eq(commEmailTemplateVersionsTable.id, template.activeVersionId));
    } else {
      conditions.push(eq(commEmailTemplateVersionsTable.isActive, true));
    }

    const [version] = await db
      .select()
      .from(commEmailTemplateVersionsTable)
      .where(and(...conditions))
      .orderBy(desc(commEmailTemplateVersionsTable.version))
      .limit(1);

    if (!version) {
      throw new Error("Template version not found");
    }

    const rendered = renderTemplate({
      version,
      templateData: data,
      branding: (template.companyBranding as Record<string, unknown> | null) ?? null,
    });

    return {
      ...rendered,
      templateVersionId: version.id,
      defaultFromAddress: template.defaultFromAddress,
      defaultReplyTo: template.defaultReplyTo,
    };
  }

  private async findParentMessageByHeaders(inReplyTo: string | null | undefined, referencesHeader: string | null | undefined) {
    if (!inReplyTo && !referencesHeader) {
      return null;
    }

    const candidates = [inReplyTo, ...extractReferences(referencesHeader)].filter((value): value is string => Boolean(value));
    if (candidates.length === 0) {
      return null;
    }

    const [parent] = await db
      .select({
        id: commEmailMessagesTable.id,
        conversationId: commEmailMessagesTable.conversationId,
      })
      .from(commEmailMessagesTable)
      .where(or(inArray(commEmailMessagesTable.messageId, candidates), inArray(commEmailMessagesTable.providerMessageId, candidates)))
      .orderBy(desc(commEmailMessagesTable.createdAt))
      .limit(1);

    return parent ?? null;
  }

  private async deriveInboundContextLinks(input: InboundEmailInput, parentMessageId: string | null): Promise<CommunicationContextLinkInput[]> {
    const links: CommunicationContextLinkInput[] = [];
    const textSource = [input.subject, input.bodyText, input.bodyHtml].filter((value): value is string => Boolean(value)).join("\n");

    const tokenPattern = /\[ctx:([a-zA-Z0-9_\-]+):([a-zA-Z0-9_.:\-]+)\]/g;
    let match: RegExpExecArray | null;

    while (true) {
      match = tokenPattern.exec(textSource);
      if (!match) {
        break;
      }
      links.push({ entityType: match[1] as string, entityId: match[2] as string });
    }

    if (links.length > 0) {
      return dedupeLinks(links);
    }
    if (!parentMessageId) {
      return links;
    }

    const parentLinks = await db
      .select({
        entityType: commEmailContextLinksTable.entityType,
        entityId: commEmailContextLinksTable.entityId,
        relatedEntityType: commEmailContextLinksTable.relatedEntityType,
        relatedEntityId: commEmailContextLinksTable.relatedEntityId,
        linkRole: commEmailContextLinksTable.linkRole,
      })
      .from(commEmailContextLinksTable)
      .where(eq(commEmailContextLinksTable.messageId, parentMessageId));

    return dedupeLinks(parentLinks);
  }
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeForMessageId(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]/g, "-");
}

function extractReferences(referencesHeader: string | null | undefined): string[] {
  if (!referencesHeader) return [];
  return referencesHeader
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function parseRetryPolicy(rawPolicy: unknown): RetryPolicy {
  const fallback = getDefaultRetryPolicy();
  if (!rawPolicy || typeof rawPolicy !== "object") {
    return fallback;
  }

  const policy = rawPolicy as Record<string, unknown>;
  return {
    maxAttempts: toInteger(policy.maxAttempts, fallback.maxAttempts, 1, 25),
    initialDelaySeconds: toInteger(policy.initialDelaySeconds, fallback.initialDelaySeconds, 5, 3600),
    maxDelaySeconds: toInteger(policy.maxDelaySeconds, fallback.maxDelaySeconds, 30, 3600 * 24),
    backoffMultiplier: toNumber(policy.backoffMultiplier, fallback.backoffMultiplier, 1, 5),
  };
}

function normalizeRetryPolicy(rawPolicy: Partial<RetryPolicy> | undefined): RetryPolicy {
  return parseRetryPolicy(rawPolicy ?? null);
}

function extractDomainPolicy(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function toInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeRecipientType(value: string): "to" | "cc" | "bcc" {
  if (value === "cc") return "cc";
  if (value === "bcc") return "bcc";
  return "to";
}

function dedupeLinks(links: CommunicationContextLinkInput[]): CommunicationContextLinkInput[] {
  const keySet = new Set<string>();
  const deduped: CommunicationContextLinkInput[] = [];
  for (const link of links) {
    const key = `${link.entityType}|${link.entityId}|${link.relatedEntityType ?? ""}|${link.relatedEntityId ?? ""}|${link.linkRole ?? "primary"}`;
    if (keySet.has(key)) continue;
    keySet.add(key);
    deduped.push(link);
  }
  return deduped;
}

function toProviderError(error: unknown): ProviderSendError {
  if (error instanceof ProviderSendError) {
    return error;
  }

  if (error instanceof Error) {
    return new ProviderSendError(error.message, {
      code: "provider_unknown_error",
      transient: true,
      details: { name: error.name },
    });
  }

  return new ProviderSendError("Unknown provider send error", {
    code: "provider_unknown_error",
    transient: true,
  });
}
