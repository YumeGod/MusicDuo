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
  subdivision: RhythmicSubdivision;
  appearance?: ObjectAppearance;
}
export interface Detection {
  edgeDensity?: number;
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
  rawExpansion?: number;
  handAngle: number;
  isSelecting: boolean;
  confidence: number;
  landmarks: Point[];
  selectedObjectId?: string;
}
export interface HarmonyState {
  key: string;
  scale: ScaleId;
  mode: string;
  quality: MusicalWorld['quality'];
  scaleNotes: number[];
  sceneMood: SceneMoodState;
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

export type ScaleId =
  | 'ionian'
  | 'natural_minor'
  | 'harmonic_minor'
  | 'melodic_minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian';
export type HarmonicCharacter =
  | 'bright'
  | 'reflective'
  | 'dramatic'
  | 'floating'
  | 'groove'
  | 'complex';
export interface SceneMoodState {
  valence: number;
  energy: number;
  tension: number;
  brightness: number;
  complexity: number;
  confidence: number;
}
export interface MusicalWorld {
  key: string;
  scale: ScaleId;
  quality: 'major' | 'minor' | 'modal';
  character: HarmonicCharacter;
  mood: SceneMoodState;
}
export type RhythmicSubdivision = '16n' | '8n' | '4n';
export interface ObjectAppearance {
  size: number;
  aspectRatio: number;
  complexity: number;
  motion: number;
  confidence: number;
}
export interface ExpansionBounds {
  min: number;
  max: number;
}
export interface WorldSyncSnapshot {
  epochId: string;
  world: MusicalWorld;
  sequence: number[];
  bpm: number;
  tick: number;
  effectiveAt: number;
}
