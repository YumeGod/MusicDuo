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

import type { WorldSyncSnapshot } from '../types';
import { KEY_OFFSETS, SCALES } from '../audio/harmony';
import { PROGRESSIONS } from '../config/sceneConfig';
export interface PresenceMessage {
  version: 1;
  kind: 'presence';
  playerId: string;
  sessionId: string;
  timestamp: number;
  priority: number;
}
export interface WorldMessage {
  version: 1;
  kind: 'world';
  playerId: string;
  sessionId: string;
  timestamp: number;
  snapshot: WorldSyncSnapshot;
}
export function validWorldSnapshot(v: unknown): v is WorldSyncSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as WorldSyncSnapshot,
    w = s.world;
  if (
    !w ||
    typeof w !== 'object' ||
    !Object.hasOwn(KEY_OFFSETS, w.key) ||
    !Object.hasOwn(SCALES, w.scale) ||
    !Object.hasOwn(PROGRESSIONS, w.character) ||
    !['major', 'minor', 'modal'].includes(w.quality) ||
    !w.mood
  )
    return false;
  if (
    ![
      'valence',
      'energy',
      'tension',
      'brightness',
      'complexity',
      'confidence',
    ].every((k) => {
      const n = w.mood[k as keyof typeof w.mood];
      return Number.isFinite(n) && n >= 0 && n <= 1;
    })
  )
    return false;
  return (
    typeof s.epochId === 'string' &&
    s.epochId.length > 0 &&
    s.epochId.length <= 100 &&
    Array.isArray(s.sequence) &&
    s.sequence.length === 4 &&
    s.sequence.every((n) => Number.isInteger(n) && n >= 0 && n < 7) &&
    Number.isFinite(s.bpm) &&
    s.bpm >= 50 &&
    s.bpm <= 160 &&
    Number.isSafeInteger(s.tick) &&
    s.tick >= 0 &&
    Number.isFinite(s.effectiveAt)
  );
}
export function validEnvelope(
  v: unknown,
): v is PresenceMessage | WorldMessage | NetworkControlMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as unknown as {
    version: number;
    playerId: string;
    sessionId: string;
    timestamp: number;
    kind: string;
    priority: number;
    snapshot: unknown;
  };
  if (
    m.version !== 1 ||
    typeof m.playerId !== 'string' ||
    m.playerId.length > 100 ||
    typeof m.sessionId !== 'string' ||
    m.sessionId.length > 100 ||
    !Number.isFinite(m.timestamp)
  )
    return false;
  if (m.kind === 'presence')
    return Number.isInteger(m.priority) && m.priority >= 0 && m.priority <= 2;
  if (m.kind === 'world') return validWorldSnapshot(m.snapshot);
  return validMessage(v);
}
