import type { HandControlState, Point } from '../types';
import { GESTURE } from '../config/gestureConfig';
import { handGeometry } from './handGeometry';
import { EMA } from './smoothing';
import {
  ExpansionCalibration,
  normalizeExpansion,
} from './ExpansionCalibration';
export class GestureInterpreter {
  calibration = new ExpansionCalibration();
  resetExpansionFilters() {
    for (const key of this.filters.keys())
      if (key.endsWith('handExpansion')) this.filters.delete(key);
  }
  private filters = new Map<string, EMA>();
  private lastSeen = new Map<string, number>();
  interpret(
    points: Point[],
    handedness: 'left' | 'right',
    confidence: number,
    now: number,
  ): HandControlState | undefined {
    if (confidence < GESTURE.minConfidence || points.length < 21) return;
    if (now - (this.lastSeen.get(handedness) ?? 0) > GESTURE.lostHandMs)
      for (const k of this.filters.keys())
        if (k.startsWith(handedness)) this.filters.delete(k);
    this.lastSeen.set(handedness, now);
    const raw = handGeometry(points);
    this.calibration.observe(handedness, raw.rawExpansion, now);
    raw.handExpansion = normalizeExpansion(
      raw.rawExpansion,
      this.calibration.bounds[handedness],
    );
    const smooth = (key: keyof typeof raw, alpha: number) => {
      const id = handedness + key;
      if (!this.filters.has(id))
        this.filters.set(id, new EMA(alpha, GESTURE.deadZone));
      return this.filters.get(id)!.next(raw[key]);
    };
    const pinchDistance = smooth('pinchDistance', GESTURE.smoothing.pinch);
    const expansion = smooth('handExpansion', GESTURE.smoothing.expansion);
    return {
      handedness,
      rawExpansion: raw.rawExpansion,
      x: smooth('x', GESTURE.smoothing.position),
      y: smooth('y', GESTURE.smoothing.position),
      cursorY: smooth('cursorY', GESTURE.smoothing.position),
      pinchDistance,
      handExpansion: expansion < 0.015 ? 0 : expansion > 0.985 ? 1 : expansion,
      handAngle: smooth('handAngle', GESTURE.smoothing.angle),
      isSelecting: pinchDistance < GESTURE.selectThreshold,
      confidence,
      landmarks: points,
    };
  }
}
