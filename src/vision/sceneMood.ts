import type { MusicalWorld, SceneMoodState } from '../types';
import { SCENE, SCENE_PALETTES } from '../config/sceneConfig';
import { clamp } from '../gestures/smoothing';
export function moodToWorld(mood: SceneMoodState): MusicalWorld {
  const t = SCENE.thresholds;
  // Ordered artistic rules; no random tonal decisions.
  let scale: MusicalWorld['scale'];
  if (mood.complexity >= t.complex && mood.valence < t.positive)
    scale = 'melodic_minor';
  else if (mood.tension >= t.tension)
    scale =
      mood.brightness < t.dark && mood.energy < t.calm
        ? 'phrygian'
        : 'harmonic_minor';
  else if (
    mood.brightness >= t.bright &&
    mood.complexity < t.etherealComplexity &&
    mood.energy < t.calm
  )
    scale = 'lydian';
  else if (mood.valence >= t.positive) scale = 'ionian';
  else if (mood.energy >= t.energetic) scale = 'dorian';
  else if (mood.valence < t.reflective)
    scale = mood.energy < t.calm ? 'natural_minor' : 'aeolian';
  else scale = 'mixolydian';
  return { ...SCENE_PALETTES[scale], scale, mood: { ...mood } };
}
export interface SceneFeatures {
  brightness: number;
  contrast: number;
  saturation: number;
  edgeDensity: number;
  motion: number;
  occupancy: number;
  categoryEnergy: number;
}
export function featuresToMood(f: SceneFeatures): SceneMoodState {
  const complexity = clamp(f.edgeDensity * 0.85 + f.occupancy * 0.15);
  return {
    brightness: clamp(f.brightness),
    complexity,
    valence: clamp(
      0.13 + f.brightness * 0.62 + f.saturation * 0.2 - f.contrast * 0.12,
    ),
    energy: clamp(
      f.motion * 0.35 +
        f.saturation * 0.25 +
        complexity * 0.25 +
        f.categoryEnergy * 0.15,
    ),
    tension: clamp(
      f.contrast * 0.5 + complexity * 0.3 + (1 - f.brightness) * 0.2,
    ),
    confidence: clamp(
      0.9 - (f.brightness < 0.025 || f.brightness > 0.985 ? 0.5 : 0),
    ),
  };
}
export function moodDistance(a: SceneMoodState, b: SceneMoodState) {
  return Math.sqrt(
    (Math.pow(a.valence - b.valence, 2) +
      Math.pow(a.energy - b.energy, 2) +
      Math.pow(a.tension - b.tension, 2) +
      Math.pow(a.brightness - b.brightness, 2) +
      Math.pow(a.complexity - b.complexity, 2)) /
      5,
  );
}
export class SceneMoodStabilizer {
  smoothed?: SceneMoodState;
  locked?: MusicalWorld;
  manualLock = false;
  private candidate = '';
  private since = 0;
  private acceptedAt = -Infinity;
  private lastAt = -Infinity;
  private force = false;
  reanalyze() {
    this.force = true;
    this.candidate = '';
    this.since = 0;
  }
  reset() {
    this.smoothed = undefined;
    this.locked = undefined;
    this.candidate = '';
    this.acceptedAt = -Infinity;
    this.lastAt = -Infinity;
    this.force = false;
  }
  update(sample: SceneMoodState, now: number): MusicalWorld | undefined {
    if (
      sample.confidence < SCENE.minConfidence ||
      Object.values(sample).some((v) => !Number.isFinite(v) || v < 0 || v > 1)
    ) {
      this.candidate = '';
      return;
    }
    if (now - this.lastAt > SCENE.maxSampleGapMs) this.candidate = '';
    this.lastAt = now;
    this.smoothed = this.smoothed
      ? (Object.fromEntries(
          Object.entries(sample).map(([k, v]) => [
            k,
            this.smoothed![k as keyof SceneMoodState] * (1 - SCENE.smoothing) +
              v * SCENE.smoothing,
          ]),
        ) as unknown as SceneMoodState)
      : { ...sample };
    if (this.manualLock && !this.force) return;
    const world = moodToWorld(this.smoothed),
      id = world.key + world.scale + world.character;
    if (
      this.locked &&
      !this.force &&
      (now - this.acceptedAt < SCENE.lockMs ||
        moodDistance(this.locked.mood, this.smoothed) < SCENE.changeDistance)
    ) {
      this.candidate = '';
      return;
    }
    if (
      this.locked &&
      !this.force &&
      id === this.locked.key + this.locked.scale + this.locked.character
    ) {
      this.candidate = '';
      return;
    }
    if (this.candidate !== id) {
      this.candidate = id;
      this.since = now;
      return;
    }
    if (
      now - this.since <
      (this.locked && !this.force ? SCENE.changeDwellMs : SCENE.initialDwellMs)
    )
      return;
    this.locked = world;
    this.acceptedAt = now;
    this.force = false;
    this.candidate = '';
    return world;
  }
}
