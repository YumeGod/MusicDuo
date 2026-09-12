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
  private fists = new Map<string, boolean>();
  private lastSeen = new Map<string, number>();
  interpret(
    points: Point[],
    handedness: 'left' | 'right',
    confidence: number,
    now: number,
    handId: string = handedness,
  ): HandControlState | undefined {
    if (confidence < GESTURE.minConfidence || points.length < 21) return;
    if (now - (this.lastSeen.get(handId) ?? 0) > GESTURE.lostHandMs) {
      this.fists.delete(handId);
      for (const k of this.filters.keys())
        if (k.startsWith(handId + ':')) this.filters.delete(k);
    }
    for (const [id, last] of this.lastSeen)
      if (now - last > 5000) {
        this.lastSeen.delete(id);
        this.fists.delete(id);
        for (const key of this.filters.keys())
          if (key.startsWith(id + ':')) this.filters.delete(key);
      }
    this.lastSeen.set(handId, now);
    const raw = handGeometry(points);
    this.calibration.observe(handedness, raw.rawExpansion, now);
    raw.handExpansion = normalizeExpansion(
      raw.rawExpansion,
      this.calibration.bounds[handedness],
    );
    const smooth = (key: keyof typeof raw, alpha: number) => {
      const id = handId + ':' + key;
      if (!this.filters.has(id))
        this.filters.set(id, new EMA(alpha, GESTURE.deadZone));
      return this.filters.get(id)!.next(raw[key]);
    };
    const pinchDistance = smooth('pinchDistance', GESTURE.smoothing.pinch);
    const expansion = smooth('handExpansion', GESTURE.smoothing.expansion);
    const fist = smooth('fistStrength', GESTURE.fistSmoothing);
    let selecting = this.fists.get(handId) ?? false;
    if (fist >= GESTURE.fistSelectThreshold) selecting = true;
    else if (fist <= GESTURE.fistReleaseThreshold) selecting = false;
    this.fists.set(handId, selecting);
    return {
      handedness,
      handId,
      fistStrength: fist,
      rawExpansion: raw.rawExpansion,
      x: smooth('x', GESTURE.smoothing.position),
      y: smooth('y', GESTURE.smoothing.position),
      cursorY: smooth('cursorY', GESTURE.smoothing.position),
      pinchDistance,
      handExpansion: expansion < 0.015 ? 0 : expansion > 0.985 ? 1 : expansion,
      handAngle: smooth('handAngle', GESTURE.smoothing.angle),
      isSelecting: selecting,
      confidence,
      landmarks: points,
    };
  }
}
