import * as Tone from 'tone';
import type { HarmonyState, SoundObject } from '../types';
import { MUSIC } from '../config/musicConfig';
import { midiFrequency, pitchTargetFromY } from './harmony';
import { SUBDIVISION_TICKS } from '../config/rhythmConfig';
export class SoundObjectVoice {
  gain: Tone.Gain;
  synth: Tone.Synth | Tone.FMSynth | Tone.MembraneSynth | Tone.NoiseSynth;
  private free: Tone.Synth;
  private sustaining = false;
  private targetMidi?: number;
  private rhythm: SoundObject['subdivision'] = '4n';
  constructor(
    public instrumentId: SoundObject['instrumentId'],
    bus: Tone.Gain,
  ) {
    this.gain = new Tone.Gain(MUSIC.voiceGain).connect(bus);
    const envelope = { attack: 0.02, decay: 0.2, sustain: 0.45, release: 0.7 };
    if (instrumentId === 'bell')
      this.synth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 4,
        envelope: { ...envelope, attack: 0.005, sustain: 0.1, release: 1.4 },
      });
    else if (instrumentId === 'membrane')
      this.synth = new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 3 });
    else if (instrumentId === 'texture')
      this.synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.03, decay: 0.15, sustain: 0, release: 0.15 },
      });
    else
      this.synth = new Tone.Synth({
        oscillator: {
          type:
            instrumentId === 'bass'
              ? 'sine'
              : instrumentId === 'pluck'
                ? 'triangle'
                : 'sine',
        },
        envelope: {
          ...envelope,
          attack: instrumentId === 'warmSynth' ? 0.2 : 0.006,
          decay: instrumentId === 'pluck' ? 0.35 : 0.2,
          sustain: instrumentId === 'pluck' ? 0 : 0.5,
        },
      });
    this.synth.connect(this.gain);
    this.free = new Tone.Synth({
      oscillator: { type: instrumentId === 'bass' ? 'sine' : 'triangle' },
      envelope: { attack: 0.15, decay: 0.1, sustain: 1, release: 0.3 },
      portamento: MUSIC.glideSeconds,
    }).connect(this.gain);
  }
  update(o: SoundObject, harmony: HarmonyState, time?: number) {
    this.gain.gain.rampTo(o.muted ? 0 : o.volume * MUSIC.voiceGain, 0.1);
    if (o.mode === 'FREE_LONG_NOTE' && !o.muted) {
      const target = pitchTargetFromY(
        o.pitchY,
        harmony.scaleNotes,
        MUSIC.minMidi,
        MUSIC.maxMidi,
        this.targetMidi,
      );
      const frequency = midiFrequency(target);
      if (!this.sustaining) {
        this.synth.triggerRelease();
        this.free.triggerAttack(frequency, time);
        this.targetMidi = target;
        this.sustaining = true;
      } else if (target !== this.targetMidi) {
        this.free.frequency.rampTo(frequency, MUSIC.glideSeconds, time);
        this.targetMidi = target;
      }
    } else if (this.sustaining) {
      this.free.triggerRelease();
      this.sustaining = false;
      this.targetMidi = undefined;
    }
  }
  play(o: SoundObject, notes: string[], step: number, time: number) {
    if (o.muted || o.mode === 'FREE_LONG_NOTE') return;
    if (step % 16 === 0) this.rhythm = o.subdivision;
    const rhythm = SUBDIVISION_TICKS[this.rhythm];
    if (step % rhythm !== 0) return;
    const note = Tone.Frequency(
      notes[
        (Math.floor(step / rhythm) + Number(o.id.replace(/\D/g, ''))) %
          notes.length
      ],
    )
      .transpose((this.instrumentId === 'bass' ? -12 : 0) + o.pitchOffset * 12)
      .toFrequency();
    if (this.synth instanceof Tone.NoiseSynth)
      this.synth.triggerAttackRelease(Math.min(0.2, o.sustain), time, 0.4);
    else
      this.synth.triggerAttackRelease(
        note,
        Math.min(o.sustain, Tone.Time(this.rhythm).toSeconds() * 0.85),
        time,
        0.6,
      );
  }
  dispose() {
    this.synth.dispose();
    this.free.dispose();
    this.gain.dispose();
  }
}
