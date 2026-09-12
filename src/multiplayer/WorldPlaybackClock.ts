import type { WorldSyncSnapshot } from '../types';
/** Keeps the old world playing until a received world's scheduled boundary. */
export class WorldPlaybackClock {
  private active?: WorldSyncSnapshot;
  private pending?: WorldSyncSnapshot;
  private lastTick = -1;
  get following() {
    return Boolean(this.active || this.pending);
  }
  get bpm() {
    return this.active?.bpm ?? this.pending?.bpm;
  }
  receive(snapshot: WorldSyncSnapshot) {
    this.pending = snapshot;
  }
  at(
    wallTime: number,
  ): { snapshot: WorldSyncSnapshot; tick: number } | undefined {
    if (this.pending && wallTime >= this.pending.effectiveAt) {
      if (this.active?.epochId !== this.pending.epochId) this.lastTick = -1;
      this.active = this.pending;
      this.pending = undefined;
    }
    if (!this.active) return;
    const tick =
      this.active.tick +
      Math.floor(
        (wallTime - this.active.effectiveAt) / (60000 / this.active.bpm / 4),
      );
    if (tick <= this.lastTick) return;
    this.lastTick = tick;
    return { snapshot: this.active, tick };
  }
  reset() {
    this.active = undefined;
    this.pending = undefined;
    this.lastTick = -1;
  }
}
