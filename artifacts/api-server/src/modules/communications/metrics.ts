export interface CommunicationMetricsSnapshot {
  sentSuccess: number;
  sentFailure: number;
  retriesScheduled: number;
  queueProcessed: number;
  queueDeadLetter: number;
  providerWebhookFailures: number;
  inboundOrphans: number;
  attachmentFailures: number;
}

const metrics: CommunicationMetricsSnapshot = {
  sentSuccess: 0,
  sentFailure: 0,
  retriesScheduled: 0,
  queueProcessed: 0,
  queueDeadLetter: 0,
  providerWebhookFailures: 0,
  inboundOrphans: 0,
  attachmentFailures: 0,
};

export function incrementMetric(name: keyof CommunicationMetricsSnapshot, delta = 1): void {
  metrics[name] += delta;
}

export function getMetricsSnapshot(): CommunicationMetricsSnapshot {
  return { ...metrics };
}
