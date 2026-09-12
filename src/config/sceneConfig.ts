import type { HarmonicCharacter, ScaleId, SceneMoodState } from '../types';
export const DEFAULT_MOOD: SceneMoodState = {
  valence: 0.65,
  energy: 0.4,
  tension: 0.2,
  brightness: 0.6,
  complexity: 0.3,
  confidence: 0,
};
export const SCENE = {
  sampleMs: 1000,
  width: 64,
  height: 48,
  smoothing: 0.2,
  minConfidence: 0.55,
  initialDwellMs: 4000,
  changeDwellMs: 6000,
  lockMs: 15000,
  changeDistance: 0.2,
  maxSampleGapMs: 2200,
  thresholds: {
    bright: 0.66,
    etherealComplexity: 0.4,
    calm: 0.38,
    dark: 0.3,
    tension: 0.64,
    complex: 0.69,
    positive: 0.62,
    energetic: 0.61,
    reflective: 0.43,
  },
};
export const SCENE_PALETTES: Record<
  ScaleId,
  {
    key: string;
    quality: 'major' | 'minor' | 'modal';
    character: HarmonicCharacter;
  }
> = {
  ionian: { key: 'C', quality: 'major', character: 'bright' },
  natural_minor: { key: 'A', quality: 'minor', character: 'reflective' },
  harmonic_minor: { key: 'A', quality: 'minor', character: 'dramatic' },
  melodic_minor: { key: 'C', quality: 'minor', character: 'complex' },
  dorian: { key: 'D', quality: 'modal', character: 'groove' },
  phrygian: { key: 'E', quality: 'modal', character: 'dramatic' },
  lydian: { key: 'F', quality: 'modal', character: 'floating' },
  mixolydian: { key: 'G', quality: 'modal', character: 'groove' },
  aeolian: { key: 'A', quality: 'modal', character: 'reflective' },
};
export const PROGRESSIONS: Record<HarmonicCharacter, number[][]> = {
  bright: [
    [0, 4, 5, 3],
    [0, 5, 3, 4],
    [1, 4, 0, 5],
  ],
  reflective: [
    [0, 5, 2, 6],
    [0, 3, 6, 0],
    [0, 6, 5, 3],
  ],
  dramatic: [
    [0, 3, 4, 0],
    [0, 1, 4, 0],
    [0, 5, 4, 0],
  ],
  floating: [
    [0, 1, 0, 4],
    [0, 4, 1, 0],
    [0, 2, 1, 4],
  ],
  groove: [
    [0, 3, 0, 6],
    [0, 6, 3, 0],
    [0, 3, 1, 0],
  ],
  complex: [
    [0, 1, 3, 4],
    [0, 3, 5, 1],
    [0, 2, 1, 4],
  ],
};
