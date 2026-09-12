import type { MusicalWorld, ScaleId } from '../types';
import { KEY_OFFSETS, SCALES } from './harmony';
export function manualWorld(
  base: MusicalWorld,
  key: string,
  scale: ScaleId,
): MusicalWorld {
  if (!Object.hasOwn(KEY_OFFSETS, key) || !Object.hasOwn(SCALES, scale))
    throw new Error('Unknown key or scale');
  const quality =
    scale === 'ionian'
      ? 'major'
      : [
            'natural_minor',
            'harmonic_minor',
            'melodic_minor',
            'aeolian',
          ].includes(scale)
        ? 'minor'
        : 'modal';
  const character: MusicalWorld['character'] =
    scale === 'harmonic_minor' || scale === 'phrygian'
      ? 'dramatic'
      : scale === 'melodic_minor'
        ? 'complex'
        : scale === 'lydian'
          ? 'floating'
          : scale === 'dorian' || scale === 'mixolydian'
            ? 'groove'
            : quality === 'minor'
              ? 'reflective'
              : 'bright';
  return { ...base, key, scale, quality, character };
}
