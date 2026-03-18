import { randomUUID } from "node:crypto";

import {
  type CommunicationProvider,
  type ParsedWebhookPayload,
  type ProviderSendPayload,
  type ProviderSendResult,
  type ProviderValidationResult,
  ProviderSendError,
} from "../provider";
import type { InboundEmailInput, ProviderDeliveryUpdate } from "../types";

interface MockWebhookPayload {
  deliveryUpdates?: ProviderDeliveryUpdate[];
  inboundEmails?: InboundEmailInput[];
}

export class MockCommunicationProvider implements CommunicationProvider {
  readonly name = "mock";

  async sendEmail(payload: ProviderSendPayload): Promise<ProviderSendResult> {
    const subject = payload.subject.toLowerCase();

    if (subject.includes("[permanent-fail]")) {
      throw new ProviderSendError("Permanent delivery failure requested by test subject", {
        code: "mock_permanent_failure",
        transient: false,
      });
    }

    if (subject.includes("[transient-fail]")) {
      throw new ProviderSendError("Transient delivery failure requested by test subject", {
        code: "mock_transient_failure",
        transient: true,
      });
    }

    const providerMessageId = `mock-${randomUUID()}`;
    const messageId = payload.headers?.["Message-Id"] ?? `<${providerMessageId}@mock.provider>`;

    return {
      accepted: true,
      providerMessageId,
      messageId,
      status: "sent",
      responsePayload: {
        recipientCount: payload.to.length + payload.cc.length + payload.bcc.length,
      },
    };
  }

  async parseWebhook(payload: unknown): Promise<ParsedWebhookPayload> {
    const asPayload = (payload ?? {}) as MockWebhookPayload;
    return {
      deliveryUpdates: asPayload.deliveryUpdates ?? [],
      inboundEmails: asPayload.inboundEmails ?? [],
    };
  }

  async validateConfiguration(config: unknown): Promise<ProviderValidationResult> {
    const asConfig = (config ?? {}) as Record<string, unknown>;
    const errors: string[] = [];

    if (typeof asConfig.apiKey !== "string" || asConfig.apiKey.trim().length === 0) {
      errors.push("apiKey is required for mock provider configuration");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
