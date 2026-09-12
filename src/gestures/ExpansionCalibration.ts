import type { ExpansionBounds } from '../types';
import { clamp } from './smoothing';
export const CALIBRATION = {
  fallback: { min: 1.05, max: 1.8 },
  minRange: 0.25,
  sampleWindowMs: 1200,
  minSamples: 10,
  minDurationMs: 600,
  freshMs: 300,
  storageKey: 'musicduo.hand-calibration.v1',
};
export type CalibrationSide = 'left' | 'right';
export type CalibrationState = {
  step: 'idle' | 'closed' | 'open';
  side: CalibrationSide;
  message: string;
  calibrated: CalibrationSide[];
};
export function validBounds(value: unknown): value is ExpansionBounds {
  if (!value || typeof value !== 'object') return false;
  const b = value as ExpansionBounds;
  return (
    Number.isFinite(b.min) &&
    Number.isFinite(b.max) &&
    b.min >= 0.2 &&
    b.max <= 4 &&
    b.max - b.min >= CALIBRATION.minRange
  );
}
export function normalizeExpansion(
  raw: number,
  bounds: ExpansionBounds = CALIBRATION.fallback,
) {
  const b = validBounds(bounds) ? bounds : CALIBRATION.fallback;
  const margin = (b.max - b.min) * 0.04;
  return clamp((raw - b.min - margin) / (b.max - b.min - 2 * margin));
}
export class ExpansionCalibration {
  bounds: Partial<Record<CalibrationSide, ExpansionBounds>> = {};
  state: CalibrationState = {
    step: 'idle',
    side: 'left',
    message: 'Optional · make a comfortable open hand reach 100%.',
    calibrated: [],
  };
  private samples: { value: number; at: number }[] = [];
  private minimum?: number;
  observe(side: CalibrationSide, value: number, now: number) {
    if (
      this.state.step === 'idle' ||
      side !== this.state.side ||
      !Number.isFinite(value)
    )
      return;
    this.samples = this.samples.filter(
      (s) => now - s.at < CALIBRATION.sampleWindowMs,
    );
    this.samples.push({ value, at: now });
  }
  begin(side: CalibrationSide) {
    this.samples = [];
    this.minimum = undefined;
    this.state = {
      ...this.state,
      side,
      step: 'closed',
      message:
        'Show only this hand. Relax or close it naturally and hold for one second.',
    };
  }
  capture(now: number) {
    const samples = this.samples.filter(
      (s) => now - s.at < CALIBRATION.sampleWindowMs,
    );
    if (
      samples.length < CALIBRATION.minSamples ||
      now - (samples.at(-1)?.at ?? 0) > CALIBRATION.freshMs ||
      samples.at(-1)!.at - samples[0].at < CALIBRATION.minDurationMs
    ) {
      this.state = {
        ...this.state,
        message:
          'Keep the chosen hand visible and still for one second, then capture again.',
      };
      return false;
    }
    const sorted = samples.map((s) => s.value).sort((a, b) => a - b),
      value = sorted[Math.floor(sorted.length / 2)];
    if (this.state.step === 'closed') {
      this.minimum = value;
      this.samples = [];
      this.state = {
        ...this.state,
        step: 'open',
        message: 'Open comfortably. No stretching needed. Hold for one second.',
      };
      return false;
    }
    if (this.state.step !== 'open') return false;
    const bounds = { min: this.minimum ?? value, max: value };
    if (!validBounds(bounds)) {
      this.state = {
        ...this.state,
        message:
          'That range was too small. Open comfortably and capture again, or restart.',
      };
      return false;
    }
    this.bounds[this.state.side] = bounds;
    this.state = {
      ...this.state,
      step: 'idle',
      calibrated: Object.keys(this.bounds) as CalibrationSide[],
      message: 'Calibrated. Your comfortable open hand now reaches 100%.',
    };
    this.samples = [];
    return true;
  }
  cancel() {
    this.samples = [];
    this.state = {
      ...this.state,
      step: 'idle',
      message: 'Calibration cancelled; previous bounds kept.',
    };
  }
  reset() {
    this.bounds = {};
    this.samples = [];
    this.state = {
      ...this.state,
      step: 'idle',
      calibrated: [],
      message: 'Reset to comfortable default bounds.',
    };
  }
  serialize() {
    return JSON.stringify({ version: 1, bounds: this.bounds });
  }
  restore(value: string) {
    try {
      const v = JSON.parse(value) as {
        version: number;
        bounds: Partial<Record<CalibrationSide, ExpansionBounds>>;
      };
      if (v.version !== 1 || !v.bounds) return;
      for (const side of ['left', 'right'] as const)
        if (validBounds(v.bounds[side])) this.bounds[side] = v.bounds[side];
      this.state = {
        ...this.state,
        calibrated: Object.keys(this.bounds) as CalibrationSide[],
      };
    } catch {
      /* Storage is optional. */
    }
  }
}
