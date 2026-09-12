export const TEMPLATES = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [1, 4, 0, 5],
];
export const SCALE = [0, 2, 4, 5, 7, 9, 11];
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
  G: 7,
  D: 2,
  A: 9,
  F: 5,
};
export function midiName(n: number) {
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
export function chord(key: string, degree: number) {
  const root = 48 + (KEY_OFFSETS[key] ?? 0) + SCALE[degree];
  const minor = [1, 2, 5].includes(degree),
    diminished = degree === 6;
  return {
    name: NOTE_NAMES[root % 12] + (diminished ? 'dim' : minor ? 'm' : ''),
    notes: [
      root,
      root + (minor || diminished ? 3 : 4),
      root + (diminished ? 6 : 7),
    ].map(midiName),
  };
}
export const frequencyFromY = (y: number, min = 36, max = 84) =>
  440 *
  Math.pow(2, (min + Math.min(1, Math.max(0, y)) * (max - min) - 69) / 12);
