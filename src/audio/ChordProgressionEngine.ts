import type { HarmonyState } from '../types';
import { MUSIC } from '../config/musicConfig';
import { chord, ROMANS, TEMPLATES } from './harmony';
export class ChordProgressionEngine {
  key = 'C';
  bpm: number = MUSIC.bpm;
  index = 0;
  beat = 0;
  template = 0;
  private pending = false;
  private pendingKey?: string;
  requestRegenerate() {
    this.pending = true;
  }
  requestKey(key: string) {
    this.pendingKey = key;
  }
  advance(step: number) {
    this.beat = step % 4;
    if (step % 4 === 0) {
      if (this.pendingKey) {
        this.key = this.pendingKey;
        this.pendingKey = undefined;
      }
      this.index = Math.floor(step / 4) % 4;
      if (this.index === 0 && this.pending) {
        this.template =
          (this.template + 1 + Math.floor(Math.random() * 2)) %
          TEMPLATES.length;
        this.pending = false;
      }
    }
    return this.state();
  }
  state(): HarmonyState {
    const sequence = TEMPLATES[this.template],
      current = chord(this.key, sequence[this.index]);
    return {
      key: this.key,
      scale: 'major',
      bpm: this.bpm,
      chordIndex: this.index,
      chordNotes: current.notes,
      chordName: current.name,
      progression: sequence.map((d) => chord(this.key, d).name),
      degrees: sequence.map((d) => ROMANS[d]),
      beat: this.beat,
    };
  }
}
