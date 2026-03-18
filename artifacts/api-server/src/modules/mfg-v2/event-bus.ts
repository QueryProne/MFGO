import { EventEmitter } from "node:events";

export type ManufacturingEventType = "job.released" | "operation.completed" | "machine.downtime";

export interface ManufacturingEvent {
  eventType: ManufacturingEventType;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

type ManufacturingEventHandler = (event: ManufacturingEvent) => void | Promise<void>;

const emitter = new EventEmitter();

export function onManufacturingEvent(eventType: ManufacturingEventType | "*", handler: ManufacturingEventHandler): () => void {
  emitter.on(eventType, handler);
  return () => emitter.off(eventType, handler);
}

export function publishManufacturingEvent(event: ManufacturingEvent): void {
  emitter.emit(event.eventType, event);
  emitter.emit("*", event);
}