import type { ObjectAppearance, RhythmicSubdivision } from '../types';
import { RHYTHM } from '../config/rhythmConfig';
import { clamp } from '../gestures/smoothing';
export function rhythmActivity(f: ObjectAppearance, label: string) {
  const w = RHYTHM.weights;
  return clamp(
    clamp(1 - f.size / 0.22) * w.size +
      f.complexity * w.complexity +
      f.motion * w.motion +
      clamp(Math.abs(Math.log2(Math.max(0.1, f.aspectRatio))) / 3) * w.aspect +
      (RHYTHM.categoryActivity[label] ?? 0.35) * w.category,
  );
}
export function appearanceToRhythm(
  f: ObjectAppearance,
  label: string,
): RhythmicSubdivision {
  const activity = rhythmActivity(f, label);
  return activity >= RHYTHM.sixteenthThreshold
    ? '16n'
    : activity >= RHYTHM.eighthThreshold
      ? '8n'
      : '4n';
}
export class ObjectRhythmStabilizer {
  private score?: number;
  private candidate?: RhythmicSubdivision;
  private since = 0;
  private count = 0;
  private lastAt = -Infinity;
  private established = false;
  update(
    f: ObjectAppearance,
    label: string,
    current: RhythmicSubdivision,
    now: number,
  ): RhythmicSubdivision {
    if (f.confidence < 0.55) {
      this.count = 0;
      this.candidate = undefined;
      return current;
    }
    if (now - this.lastAt > 1500) {
      this.count = 0;
      this.candidate = undefined;
    }
    this.lastAt = now;
    const raw = rhythmActivity(f, label);
    this.score =
      this.score === undefined
        ? raw
        : this.score * (1 - RHYTHM.smoothing) + raw * RHYTHM.smoothing;
    let target: RhythmicSubdivision =
      this.score >= RHYTHM.sixteenthThreshold
        ? '16n'
        : this.score >= RHYTHM.eighthThreshold
          ? '8n'
          : '4n';
    if (this.established) {
      const h = RHYTHM.hysteresis;
      if (current === '4n' && this.score < RHYTHM.eighthThreshold + h)
        target = current;
      if (current === '16n' && this.score > RHYTHM.sixteenthThreshold - h)
        target = current;
      if (
        current === '8n' &&
        this.score > RHYTHM.eighthThreshold - h &&
        this.score < RHYTHM.sixteenthThreshold + h
      )
        target = current;
    }
    if (target === current && this.established) {
      this.candidate = undefined;
      this.count = 0;
      return current;
    }
    if (target !== this.candidate) {
      this.candidate = target;
      this.since = now;
      this.count = 0;
    }
    this.count++;
    if (
      this.count >= RHYTHM.minObservations &&
      now - this.since >=
        (this.established ? RHYTHM.changeDwellMs : RHYTHM.initialDwellMs)
    ) {
      this.established = true;
      this.candidate = undefined;
      this.count = 0;
      return target;
    }
    return current;
  }
}
