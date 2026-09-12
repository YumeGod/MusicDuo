import type { InstrumentId } from '../types';
export const OBJECT_SOUND_MAP: Record<string, InstrumentId> = {
  person: 'warmSynth',
  bottle: 'pluck',
  cup: 'pluck',
  chair: 'bass',
  book: 'bell',
  'potted plant': 'warmSynth',
  laptop: 'pattern',
  'cell phone': 'bell',
  keyboard: 'pattern',
  clock: 'membrane',
  bowl: 'texture',
};
export const INSTRUMENTS: Record<
  InstrumentId,
  { name: string; color: string; description: string }
> = {
  warmSynth: {
    name: 'Warm pad',
    color: '#b6a1ff',
    description: 'Soft, rounded waves',
  },
  pluck: {
    name: 'Glass pluck',
    color: '#8fe1c4',
    description: 'Bright, delicate pulses',
  },
  bass: {
    name: 'Sub bass',
    color: '#f4b789',
    description: 'A warm low foundation',
  },
  bell: {
    name: 'FM bells',
    color: '#e9c87b',
    description: 'Shimmering harmonics',
  },
  membrane: {
    name: 'Soft drums',
    color: '#e99db6',
    description: 'A gentle rhythmic pulse',
  },
  texture: {
    name: 'Air texture',
    color: '#a6becf',
    description: 'Breathy percussion',
  },
  pattern: {
    name: 'Arpeggio',
    color: '#9db9ff',
    description: 'A repeating melodic line',
  },
};
export function instrumentFor(label: string): InstrumentId {
  return OBJECT_SOUND_MAP[label] ?? 'warmSynth';
}
