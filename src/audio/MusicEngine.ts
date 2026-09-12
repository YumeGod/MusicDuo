import * as Tone from 'tone';
import type { HarmonyState, SoundObject, WorldSyncSnapshot } from '../types';
import { MUSIC } from '../config/musicConfig';
import { ChordProgressionEngine } from './ChordProgressionEngine';
import { InstrumentManager } from './InstrumentManager';
import { WorldPlaybackClock } from '../multiplayer/WorldPlaybackClock';
export class MusicEngine {
  harmony = new ChordProgressionEngine();
  private instruments?: InstrumentManager;
  private bus?: Tone.Gain;
  private master?: Tone.Gain;
  private reverb?: Tone.Reverb;
  private send?: Tone.Gain;
  private limiter?: Tone.Limiter;
  private waveform?: Tone.Waveform;
  private event?: number;
  private step = 0;
  private objects: SoundObject[] = [];
  private worldClock = new WorldPlaybackClock();
  private epochId = crypto.randomUUID();
  running = false;
  async start(
    onBeat: (h: HarmonyState) => void,
    onWorld?: (s: WorldSyncSnapshot) => void,
  ) {
    await Tone.start();
    if (this.running) return;
    this.limiter = new Tone.Limiter(-2).toDestination();
    this.master = new Tone.Gain(MUSIC.volume * MUSIC.maxGain).connect(
      this.limiter,
    );
    this.bus = new Tone.Gain(0.8).connect(this.master);
    this.reverb = new Tone.Reverb({ decay: 3, wet: 1 }).connect(this.master);
    this.send = new Tone.Gain(MUSIC.reverb * MUSIC.reverbMax).connect(
      this.reverb,
    );
    this.bus.connect(this.send);
    this.waveform = new Tone.Waveform(128);
    this.master.connect(this.waveform);
    this.instruments = new InstrumentManager(this.bus);
    this.instruments.sync(this.objects, this.harmony.state());
    const transport = Tone.getTransport();
    transport.bpm.value = this.worldClock.bpm ?? this.harmony.bpm;
    this.event = transport.scheduleRepeat((time) => {
      const wallTime = Date.now() + (time - Tone.now()) * 1000;
      let tick = this.step;
      let h: HarmonyState;
      if (this.worldClock.following) {
        const remote = this.worldClock.at(wallTime);
        if (!remote) return;
        tick = remote.tick;
        if (transport.bpm.value !== remote.snapshot.bpm)
          transport.bpm.value = remote.snapshot.bpm;
        h = this.harmony.follow(remote.snapshot, tick);
      } else
        h =
          tick % 4 === 0
            ? this.harmony.advance(Math.floor(tick / 4))
            : this.harmony.state();
      this.instruments?.play(this.objects, h, tick, time);
      this.step = tick + 1;
      if (tick % 4 === 0 && !this.worldClock.following)
        onWorld?.(this.harmony.snapshot(tick, wallTime, this.epochId));
      Tone.getDraw().schedule(() => {
        if (this.running) onBeat(h);
      }, time);
    }, '16n');
    this.running = true;
    transport.start('+0.05');
  }
  sync(objects: SoundObject[]) {
    this.objects = objects;
    this.instruments?.sync(objects, this.harmony.state());
  }
  followWorld(snapshot: WorldSyncSnapshot) {
    this.worldClock.receive(snapshot);
  }
  releaseWorld() {
    this.worldClock.reset();
  }
  controls(volume: number, reverb: number) {
    this.master?.gain.rampTo(volume * MUSIC.maxGain, 0.12);
    this.send?.gain.rampTo(reverb * MUSIC.reverbMax, 0.2);
  }
  bpm(value: number) {
    this.harmony.bpm = value;
    if (this.running) Tone.getTransport().bpm.rampTo(value, 0.3);
  }
  waveformValues() {
    return this.waveform?.getValue();
  }
  dispose() {
    this.running = false;
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    if (this.event !== undefined) transport.clear(this.event);
    this.instruments?.dispose();
    this.bus?.dispose();
    this.send?.dispose();
    this.reverb?.dispose();
    this.master?.dispose();
    this.limiter?.dispose();
    this.waveform?.dispose();
    this.step = 0;
  }
}
