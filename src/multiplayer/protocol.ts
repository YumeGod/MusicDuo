import type { HandControlState, Role } from '../types';
export interface NetworkControlMessage {
  version: 1;
  sessionId: string;
  playerId: string;
  role: Role;
  timestamp: number;
  controls: Partial<HandControlState>;
}
export function validMessage(v: unknown): v is NetworkControlMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as NetworkControlMessage;
  if (
    m.version !== 1 ||
    typeof m.playerId !== 'string' ||
    typeof m.sessionId !== 'string' ||
    !['GLOBAL_CONTROLLER', 'OBJECT_CONTROLLER'].includes(m.role) ||
    !Number.isFinite(m.timestamp) ||
    !m.controls ||
    typeof m.controls !== 'object'
  )
    return false;
  for (const key of ['x', 'y', 'cursorY', 'handExpansion'] as const) {
    const n = m.controls[key];
    if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 1))
      return false;
  }
  for (const key of ['pinchDistance', 'handAngle'] as const) {
    const n = m.controls[key];
    if (
      n !== undefined &&
      (!Number.isFinite(n) || Math.abs(n) > (key === 'handAngle' ? 180 : 1.5))
    )
      return false;
  }
  if (
    m.controls.isSelecting !== undefined &&
    typeof m.controls.isSelecting !== 'boolean'
  )
    return false;
  return true;
}
