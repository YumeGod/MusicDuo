import type { Point } from '../types';
export interface ObservedHand {
  landmarks: Point[];
  handedness: 'left' | 'right';
  confidence: number;
}
interface Track {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  seen: number;
  handedness: 'left' | 'right';
}
export class HandIdentityTracker {
  private tracks: Track[] = [];
  private counter = 0;
  private counts = { left: 0, right: 0 };
  update(hands: ObservedHand[], now: number) {
    this.tracks = this.tracks.filter((t) => now - t.seen < 500);
    const centers = hands.map((h) => {
      const p = h.landmarks;
      return {
        x: (p[0].x + p[5].x + p[9].x + p[17].x) / 4,
        y: (p[0].y + p[5].y + p[9].y + p[17].y) / 4,
      };
    });
    let bestCost = Infinity,
      best: number[] = [];
    const assign = (
      i: number,
      used: Set<number>,
      indices: number[],
      cost: number,
    ) => {
      if (cost >= bestCost) return;
      if (i === hands.length) {
        bestCost = cost;
        best = indices;
        return;
      }
      assign(i + 1, used, [...indices, -1], cost + 0.3);
      this.tracks.forEach((t, j) => {
        if (used.has(j)) return;
        const dt = Math.min(0.2, (now - t.seen) / 1000),
          d = Math.hypot(
            centers[i].x - (t.x + t.vx * dt),
            centers[i].y - (t.y + t.vy * dt),
          );
        if (d > 0.24) return;
        assign(
          i + 1,
          new Set([...used, j]),
          [...indices, j],
          cost + d + (t.handedness !== hands[i].handedness ? 0.08 : 0),
        );
      });
    };
    assign(0, new Set(), [], 0);
    return hands.map((h, i) => {
      let t = this.tracks[best[i]];
      const c = centers[i];
      if (!t) {
        t = {
          id: `hand-${++this.counter}`,
          label: `${h.handedness === 'right' ? 'R' : 'L'}${++this.counts[h.handedness]}`,
          ...c,
          vx: 0,
          vy: 0,
          seen: now,
          handedness: h.handedness,
        };
        this.tracks.push(t);
      } else {
        const dt = Math.max(0.02, (now - t.seen) / 1000);
        t.vx = (c.x - t.x) / dt;
        t.vy = (c.y - t.y) / dt;
        t.x = c.x;
        t.y = c.y;
        t.seen = now;
      }
      return { ...h, handId: t.id, controlLabel: t.label };
    });
  }
  reset() {
    this.tracks = [];
    this.counts = { left: 0, right: 0 };
  }
}
