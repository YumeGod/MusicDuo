import type * as Tone from 'tone';
import type { SoundObject } from '../types';
import { SoundObjectVoice } from './SoundObjectVoice';
export class InstrumentManager {
  voices = new Map<string, SoundObjectVoice>();
  constructor(private bus: Tone.Gain) {}
  sync(objects: SoundObject[]) {
    const ids = new Set(objects.map((o) => o.id));
    for (const [id, v] of this.voices)
      if (!ids.has(id)) {
        v.dispose();
        this.voices.delete(id);
      }
    for (const o of objects) {
      let v = this.voices.get(o.id);
      if (v && v.instrumentId !== o.instrumentId) {
        v.dispose();
        this.voices.delete(o.id);
        v = undefined;
      }
      if (!v) {
        v = new SoundObjectVoice(o.instrumentId, this.bus);
        this.voices.set(o.id, v);
      }
      v.update(o);
    }
  }
  play(objects: SoundObject[], notes: string[], step: number, time: number) {
    for (const o of objects) this.voices.get(o.id)?.play(o, notes, step, time);
  }
  dispose() {
    this.voices.forEach((v) => v.dispose());
    this.voices.clear();
  }
}
