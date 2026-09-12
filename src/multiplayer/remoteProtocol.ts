import type { SoundObject, WorldSyncSnapshot } from '../types';
import { INSTRUMENTS } from '../config/objectSoundMap';
import { validWorldSnapshot } from './protocol';
export type RemoteRole = 'host' | 'guest';
export type RemotePacket =
  | {
      type: 'signal';
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }
  | { type: 'objects'; objects: SoundObject[] }
  | {
      type: 'world';
      snapshot: WorldSyncSnapshot;
      volume: number;
      reverb: number;
      manual: boolean;
    }
  | { type: 'global'; volume: number; reverb: number };
export const roomCode = (value: string) => value.trim().toUpperCase();
export const validRoomCode = (value: string) =>
  /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(value);
const unit = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export function validRemotePacket(value: unknown): value is RemotePacket {
  if (!value || typeof value !== 'object') return false;
  const p = value as RemotePacket;
  if (p.type === 'global') return unit(p.volume) && unit(p.reverb);
  if (p.type === 'world')
    return (
      validWorldSnapshot(p.snapshot) &&
      unit(p.volume) &&
      unit(p.reverb) &&
      typeof p.manual === 'boolean'
    );
  if (p.type === 'signal')
    return Boolean(
      (p.description &&
        ['offer', 'answer'].includes(p.description.type) &&
        typeof p.description.sdp === 'string' &&
        p.description.sdp.length < 60000) ||
      (p.candidate &&
        typeof p.candidate.candidate === 'string' &&
        p.candidate.candidate.length < 4096),
    );
  if (p.type !== 'objects' || !Array.isArray(p.objects) || p.objects.length > 7)
    return false;
  const ids = new Set<string>();
  return p.objects.every((o) => {
    if (!o || typeof o.id !== 'string' || o.id.length > 80 || ids.has(o.id))
      return false;
    ids.add(o.id);
    return (
      typeof o.label === 'string' &&
      o.label.length <= 80 &&
      Object.hasOwn(INSTRUMENTS, o.instrumentId) &&
      ['CHORD_FOLLOWING', 'FREE_LONG_NOTE'].includes(o.mode) &&
      ['4n', '8n', '16n'].includes(o.subdivision) &&
      unit(o.volume) &&
      unit(o.pitchY) &&
      unit(o.confidence) &&
      Number.isFinite(o.sustain) &&
      o.sustain >= 0.01 &&
      o.sustain <= 4 &&
      Number.isFinite(o.pitchOffset) &&
      Math.abs(o.pitchOffset) <= 4 &&
      typeof o.muted === 'boolean' &&
      o.bbox &&
      [o.bbox.x, o.bbox.y, o.bbox.width, o.bbox.height].every(unit)
    );
  });
}
// Construct fresh objects; peer ownership and timestamps never enter local selection state.
export function guestVoices(
  objects: SoundObject[],
  now: number,
): SoundObject[] {
  return objects.map((o) => ({
    id: `guest:${o.id}`,
    label: o.label,
    confidence: o.confidence,
    bbox: { ...o.bbox },
    instrumentId: o.instrumentId,
    soundType: o.instrumentId === 'pattern' ? 'loop' : 'synth',
    volume: o.volume,
    sustain: o.sustain,
    pitchOffset: o.pitchOffset,
    pitchY: o.pitchY,
    mode: o.mode,
    lastSeen: now,
    observations: 2,
    muted: o.muted,
    subdivision: o.subdivision,
  }));
}
