import type { ScaleId } from '../types';
export const TEMPLATES = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [1, 4, 0, 5],
];
export const SCALES: Record<ScaleId, { name: string; intervals: number[] }> = {
  ionian: { name: 'Ionian', intervals: [0, 2, 4, 5, 7, 9, 11] },
  natural_minor: { name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonic_minor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  melodic_minor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  aeolian: { name: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
};
export const SCALE = SCALES.ionian.intervals;
export const ROMANS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];
export const KEY_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};
export function midiName(n: number) {
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
export function chord(key: string, degree: number, scale: ScaleId = 'ionian') {
  const intervals = SCALES[scale].intervals,
    tonic = 48 + (KEY_OFFSETS[key] ?? 0);
  const tone = (d: number) => tonic + intervals[d % 7] + Math.floor(d / 7) * 12;
  const midis = [degree, degree + 2, degree + 4].map(tone),
    third = midis[1] - midis[0],
    fifth = midis[2] - midis[0];
  const suffix =
    fifth === 6 ? 'dim' : fifth === 8 ? 'aug' : third === 3 ? 'm' : '';
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree];
  return {
    name: NOTE_NAMES[midis[0] % 12] + suffix,
    notes: midis.map(midiName),
    midis,
    roman:
      (third === 3 ? roman.toLowerCase() : roman) +
      (suffix === 'dim' ? '°' : suffix === 'aug' ? '+' : ''),
  };
}
export function scaleMidiNotes(
  key: string,
  scale: ScaleId,
  min = 36,
  max = 84,
) {
  const tonic = KEY_OFFSETS[key] ?? 0,
    pcs = SCALES[scale].intervals.map((i) => (tonic + i) % 12);
  const notes: number[] = [];
  for (let midi = Math.ceil(min); midi <= max; midi++)
    if (pcs.includes(((midi % 12) + 12) % 12)) notes.push(midi);
  return notes;
}
export function pitchTargetFromY(
  y: number,
  notes: readonly number[],
  min = 36,
  max = 84,
  previous?: number,
  hysteresis = 0.12,
) {
  const valid = notes.filter((n) => n >= min && n <= max);
  if (!valid.length) throw new Error('Pitch range contains no scale notes');
  const raw = min + Math.max(0, Math.min(1, y)) * (max - min);
  const nearest = valid.reduce(
    (best, n) => (Math.abs(n - raw) < Math.abs(best - raw) ? n : best),
    valid[0],
  );
  if (
    previous !== undefined &&
    valid.includes(previous) &&
    Math.abs(raw - previous) <= Math.abs(raw - nearest) + hysteresis
  )
    return previous;
  return nearest;
}
export const midiFrequency = (midi: number) =>
  440 * Math.pow(2, (midi - 69) / 12);
// Kept for callers requiring unconstrained frequency, not used by musical voices.
export const frequencyFromY = (y: number, min = 36, max = 84) =>
  midiFrequency(min + Math.min(1, Math.max(0, y)) * (max - min));
