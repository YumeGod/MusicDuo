export interface Point {
  x: number;
  y: number;
  z?: number;
}
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type InstrumentId =
  | 'warmSynth'
  | 'pluck'
  | 'bass'
  | 'bell'
  | 'membrane'
  | 'texture'
  | 'pattern';
export type PitchMode = 'CHORD_FOLLOWING' | 'FREE_LONG_NOTE';
export interface SoundObject {
  id: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  soundType: 'loop' | 'synth';
  instrumentId: InstrumentId;
  volume: number;
  sustain: number;
  pitchOffset: number;
  pitchY: number;
  mode: PitchMode;
  selectedBy?: string;
  lastSeen: number;
  observations: number;
  muted: boolean;
}
export interface Detection {
  label: string;
  confidence: number;
  bbox: BoundingBox;
}
export interface HandControlState {
  handedness: 'left' | 'right';
  x: number;
  y: number;
  cursorY: number;
  pinchDistance: number;
  handExpansion: number;
  handAngle: number;
  isSelecting: boolean;
  confidence: number;
  landmarks: Point[];
  selectedObjectId?: string;
}
export interface HarmonyState {
  key: string;
  scale: string;
  chordIndex: number;
  chordNotes: string[];
  chordName: string;
  bpm: number;
  progression: string[];
  degrees: string[];
  beat: number;
}
export type GameMode = 'DESKTOP_DUO' | 'MOBILE_SHARED';
export type Role = 'GLOBAL_CONTROLLER' | 'OBJECT_CONTROLLER';
export type RoleOverride = 'AUTO' | 'SWAP' | Role;
export type ObjectInteractionState =
  | 'IDLE'
  | 'HOVERING'
  | 'PINCHING'
  | 'SELECTED'
  | 'FREE_PITCH'
  | 'RELEASING';
