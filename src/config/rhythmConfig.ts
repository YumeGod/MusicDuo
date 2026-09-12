import type { RhythmicSubdivision } from '../types';
export const RHYTHM = {
  smoothing: 0.22,
  initialDwellMs: 900,
  changeDwellMs: 2500,
  minObservations: 4,
  hysteresis: 0.1,
  eighthThreshold: 0.34,
  sixteenthThreshold: 0.66,
  categoryActivity: {
    person: 0.65,
    book: 0.25,
    bottle: 0.35,
    chair: 0.1,
    'potted plant': 0.2,
    'cell phone': 0.8,
    laptop: 0.7,
    clock: 0.55,
  } as Record<string, number>,
  weights: {
    size: 0.4,
    complexity: 0.25,
    motion: 0.2,
    aspect: 0.05,
    category: 0.1,
  },
};
export const SUBDIVISION_TICKS: Record<RhythmicSubdivision, number> = {
  '16n': 1,
  '8n': 2,
  '4n': 4,
};
export const RHYTHM_LABELS: Record<RhythmicSubdivision, string> = {
  '16n': '1/16',
  '8n': '1/8',
  '4n': '1/4',
};
