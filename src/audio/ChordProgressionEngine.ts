import type { HarmonyState, MusicalWorld, WorldSyncSnapshot } from '../types';
import { MUSIC } from '../config/musicConfig';
import { DEFAULT_MOOD, PROGRESSIONS } from '../config/sceneConfig';
import { chord, scaleMidiNotes, SCALES } from './harmony';
export class ChordProgressionEngine {
  key = 'C';
  bpm: number = MUSIC.bpm;
  index = 0;
  beat = 0;
  template = 0;
  world: MusicalWorld = {
    key: 'C',
    scale: 'ionian',
    quality: 'major',
    character: 'bright',
    mood: { ...DEFAULT_MOOD },
  };
  private pending = false;
  private pendingKey?: string;
  private pendingWorld?: MusicalWorld;
  private remoteSequence?: number[];
  requestRegenerate() {
    this.pending = true;
  }
  requestKey(key: string) {
    this.pendingKey = key;
  }
  requestWorld(world: MusicalWorld) {
    this.pendingWorld = structuredClone(world);
  }
  sequence() {
    return (
      this.remoteSequence ??
      PROGRESSIONS[this.world.character][
        this.template % PROGRESSIONS[this.world.character].length
      ]
    );
  }
  advance(step: number) {
    this.beat = step % 4;
    this.index = Math.floor(step / 4) % 4;
    if (step % 4 === 0) {
      if (this.index === 0) {
        if (this.pendingWorld) {
          this.world = this.pendingWorld;
          this.key = this.world.key;
          this.template = 0;
          this.remoteSequence = undefined;
          this.pendingWorld = undefined;
        }
        if (this.pending) {
          this.template =
            (this.template + 1) % PROGRESSIONS[this.world.character].length;
          this.remoteSequence = undefined;
          this.pending = false;
        }
      }
      if (this.pendingKey) {
        this.key = this.pendingKey;
        this.pendingKey = undefined;
      }
      this.world = { ...this.world, key: this.key };
    }
    return this.state();
  }
  follow(snapshot: WorldSyncSnapshot, tick = snapshot.tick) {
    this.world = structuredClone(snapshot.world);
    this.key = this.world.key;
    this.bpm = snapshot.bpm;
    this.remoteSequence = [...snapshot.sequence];
    this.pendingWorld = undefined;
    this.pendingKey = undefined;
    this.pending = false;
    this.index = Math.floor(tick / 16) % 4;
    this.beat = Math.floor(tick / 4) % 4;
    return this.state();
  }
  state(): HarmonyState {
    const sequence = this.sequence(),
      current = chord(this.key, sequence[this.index], this.world.scale);
    return {
      key: this.key,
      scale: this.world.scale,
      mode: SCALES[this.world.scale].name,
      quality: this.world.quality,
      sceneMood: this.world.mood,
      scaleNotes: scaleMidiNotes(
        this.key,
        this.world.scale,
        MUSIC.minMidi,
        MUSIC.maxMidi,
      ),
      bpm: this.bpm,
      chordIndex: this.index,
      chordNotes: current.notes,
      chordName: current.name,
      progression: sequence.map(
        (d) => chord(this.key, d, this.world.scale).name,
      ),
      degrees: sequence.map((d) => chord(this.key, d, this.world.scale).roman),
      beat: this.beat,
    };
  }
  snapshot(
    tick: number,
    effectiveAt: number,
    epochId = 'local',
  ): WorldSyncSnapshot {
    return {
      world: { ...this.world, key: this.key },
      sequence: [...this.sequence()],
      bpm: this.bpm,
      tick,
      effectiveAt,
      epochId,
    };
  }
}
