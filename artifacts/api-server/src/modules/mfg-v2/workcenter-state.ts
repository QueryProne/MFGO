export type WorkCenterRuntimeStatus = "idle" | "running" | "down" | "maintenance";

const ALLOWED_TRANSITIONS: Record<WorkCenterRuntimeStatus, ReadonlySet<WorkCenterRuntimeStatus>> = {
  idle: new Set<WorkCenterRuntimeStatus>(["running", "down", "maintenance"]),
  running: new Set<WorkCenterRuntimeStatus>(["idle", "down", "maintenance"]),
  down: new Set<WorkCenterRuntimeStatus>(["idle", "maintenance"]),
  maintenance: new Set<WorkCenterRuntimeStatus>(["idle", "down"]),
};

export function canTransitionWorkCenterState(
  current: WorkCenterRuntimeStatus,
  target: WorkCenterRuntimeStatus,
): boolean {
  if (current === target) {
    return false;
  }
  return ALLOWED_TRANSITIONS[current].has(target);
}

export function nextWorkCenterState(
  current: WorkCenterRuntimeStatus,
  target: WorkCenterRuntimeStatus,
): WorkCenterRuntimeStatus {
  if (!canTransitionWorkCenterState(current, target)) {
    throw new Error(`Invalid work center transition: ${current} -> ${target}`);
  }
  return target;
}
