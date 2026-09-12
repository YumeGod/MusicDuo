import type { Point } from '../types';
import { normalizeExpansion } from './ExpansionCalibration';
import { clamp } from './smoothing';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
// A pinch curls at most one finger. A fist curls the four fingers toward the palm.
export function fistStrength(p: Point[]) {
  return (
    [
      [6, 8],
      [10, 12],
      [14, 16],
      [18, 20],
    ].reduce((sum, [pip, tip]) => {
      const ratio =
        distance(p[0], p[tip]) / Math.max(0.02, distance(p[0], p[pip]));
      return sum + clamp((1.25 - ratio) / 0.45);
    }, 0) / 4
  );
}
export function handGeometry(p: Point[]) {
  const palm = Math.max(0.02, distance(p[0], p[9]));
  const center = {
    x: (p[0].x + p[5].x + p[9].x + p[17].x) / 4,
    y: (p[0].y + p[5].y + p[9].y + p[17].y) / 4,
  };
  const spread =
    [8, 12, 16, 20].reduce((sum, i) => sum + distance(p[0], p[i]) / palm, 0) /
    4;
  return {
    x: center.x,
    cursorY: center.y,
    fistStrength: fistStrength(p),
    y: clamp(1 - center.y),
    pinchDistance: clamp(distance(p[4], p[8]) / palm, 0, 1.5),
    rawExpansion: spread,
    handExpansion: normalizeExpansion(spread),
    handAngle: (Math.atan2(p[9].x - p[0].x, p[0].y - p[9].y) * 180) / Math.PI,
  };
}
