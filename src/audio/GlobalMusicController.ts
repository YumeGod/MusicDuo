import type { HandControlState } from '../types';
import { KEYS, MUSIC } from '../config/musicConfig';
import { GESTURE } from '../config/gestureConfig';
import { clamp, Dwell } from '../gestures/smoothing';
export class GlobalMusicController {
  volume: number = MUSIC.volume;
  reverb: number = MUSIC.reverb;
  keyGestureEnabled: boolean = MUSIC.keyGestureEnabled;
  private candidate = 1;
  private active = 1;
  private dwell = new Dwell();
  update(h: HandControlState, now: number): string | undefined {
    this.volume = clamp(h.pinchDistance / 1.2);
    this.reverb = clamp(h.handExpansion);
    if (!this.keyGestureEnabled) {
      this.dwell.reset();
      return;
    }
    const region = Math.round(clamp(h.handAngle / 35 + 1, 0, 4));
    if (
      region === this.active ||
      Math.abs(h.handAngle - (this.active - 1) * 35) <
        17.5 + GESTURE.keyHysteresisDegrees
    ) {
      this.dwell.reset();
      return;
    }
    if (region !== this.candidate) {
      this.candidate = region;
      this.dwell.reset();
    }
    if (this.dwell.update(true, now, GESTURE.keyDwellMs)) {
      this.active = region;
      this.dwell.reset();
      return KEYS[region];
    }
  }
}
