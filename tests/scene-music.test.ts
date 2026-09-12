import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moodToWorld,
  SceneMoodStabilizer,
  featuresToMood,
} from '../src/vision/sceneMood';
import { imageFeatures } from '../src/vision/SceneAnalysisEngine';
import { DEFAULT_MOOD } from '../src/config/sceneConfig';
import {
  appearanceToRhythm,
  ObjectRhythmStabilizer,
} from '../src/vision/ObjectRhythm';
import { RHYTHM, SUBDIVISION_TICKS } from '../src/config/rhythmConfig';
import {
  chord,
  pitchTargetFromY,
  scaleMidiNotes,
  SCALES,
  midiFrequency,
} from '../src/audio/harmony';
import { ChordProgressionEngine } from '../src/audio/ChordProgressionEngine';
import {
  ExpansionCalibration,
  normalizeExpansion,
  validBounds,
} from '../src/gestures/ExpansionCalibration';
import { GestureInterpreter } from '../src/gestures/GestureInterpreter';
import { WorldPlaybackClock } from '../src/multiplayer/WorldPlaybackClock';
import { WorldAuthority } from '../src/multiplayer/WorldAuthority';
import { validEnvelope, validWorldSnapshot } from '../src/multiplayer/protocol';
import { MultiplayerSyncManager } from '../src/multiplayer/MultiplayerSyncManager';
import type {
  SceneMoodState,
  ScaleId,
  ObjectAppearance,
  RhythmicSubdivision,
  Point,
  WorldSyncSnapshot,
} from '../src/types';
const mood = (patch: Partial<SceneMoodState> = {}): SceneMoodState => ({
  ...DEFAULT_MOOD,
  confidence: 0.9,
  ...patch,
});
const cases: [ScaleId, Partial<SceneMoodState>][] = [
  ['ionian', { brightness: 0.8, valence: 0.8, energy: 0.7 }],
  ['natural_minor', { brightness: 0.25, valence: 0.2, energy: 0.2 }],
  [
    'harmonic_minor',
    { brightness: 0.4, valence: 0.3, energy: 0.5, tension: 0.8 },
  ],
  ['melodic_minor', { brightness: 0.4, valence: 0.45, complexity: 0.85 }],
  ['dorian', { brightness: 0.5, valence: 0.5, energy: 0.85 }],
  ['phrygian', { brightness: 0.2, valence: 0.25, energy: 0.2, tension: 0.8 }],
  ['lydian', { brightness: 0.85, valence: 0.75, energy: 0.2, complexity: 0.2 }],
  ['mixolydian', { brightness: 0.5, valence: 0.5, energy: 0.4 }],
  ['aeolian', { brightness: 0.4, valence: 0.3, energy: 0.5 }],
];
for (const [scale, features] of cases)
  void test(`scene rules select ${scale} reproducibly`, () => {
    assert.equal(moodToWorld(mood(features)).scale, scale);
    assert.deepEqual(moodToWorld(mood(features)), moodToWorld(mood(features)));
  });
void test('minor systems have distinct seventh and sixth degrees', () => {
  assert.deepEqual(SCALES.natural_minor.intervals, [0, 2, 3, 5, 7, 8, 10]);
  assert.deepEqual(SCALES.harmonic_minor.intervals, [0, 2, 3, 5, 7, 8, 11]);
  assert.deepEqual(SCALES.melodic_minor.intervals, [0, 2, 3, 5, 7, 9, 11]);
});
void test('scene decisions require observation time, ignore exposure jitter and momentary changes', () => {
  const s = new SceneMoodStabilizer(),
    bright = mood(cases[0][1]);
  assert.equal(s.update(bright, 0), undefined);
  for (let t = 1000; t < 4000; t += 1000)
    assert.equal(s.update(bright, t), undefined);
  assert.equal(s.update(bright, 4000)?.scale, 'ionian');
  for (let t = 5000; t <= 40000; t += 1000)
    assert.equal(
      s.update(
        {
          ...bright,
          brightness: bright.brightness + (t % 2000 ? 0.02 : -0.02),
        },
        t,
      ),
      undefined,
    );
  assert.equal(s.update(mood(cases[2][1]), 41000), undefined);
  assert.equal(s.update(bright, 42000), undefined);
  assert.equal(s.locked?.scale, 'ionian');
});
void test('meaningful sustained scene changes unlock only after smoothing, dwell and lock', () => {
  const s = new SceneMoodStabilizer(),
    a = mood(cases[0][1]),
    b = mood(cases[1][1]);
  for (let t = 0; t <= 4000; t += 1000) s.update(a, t);
  for (let t = 5000; t < 19000; t += 1000)
    assert.equal(s.update(b, t), undefined);
  let accepted = false;
  for (let t = 19000; t <= 40000; t += 1000)
    if (s.update(b, t)) accepted = true;
  assert.ok(accepted);
  assert.equal(s.locked?.scale, 'natural_minor');
});
void test('manual scene lock holds; reanalyze still requires a stable window', () => {
  const s = new SceneMoodStabilizer();
  for (let t = 0; t <= 4000; t += 1000) s.update(mood(cases[0][1]), t);
  s.manualLock = true;
  for (let t = 5000; t <= 40000; t += 1000)
    assert.equal(s.update(mood(cases[1][1]), t), undefined);
  s.reanalyze();
  assert.equal(s.update(mood(cases[1][1]), 41000), undefined);
  for (let t = 42000; t <= 45000; t += 1000) s.update(mood(cases[1][1]), t);
  assert.equal(s.locked?.scale, 'natural_minor');
});
void test('low confidence or a missing observation gap cannot complete scene dwell', () => {
  const s = new SceneMoodStabilizer();
  s.update(mood(), 0);
  s.update(mood(), 1000);
  assert.equal(s.update(mood({ confidence: 0.1 }), 2000), undefined);
  assert.equal(s.update(mood(), 4000), undefined);
  assert.equal(s.update(mood(), 12000), undefined);
  assert.equal(s.locked, undefined);
});
void test('pixel features are bounded and uniform exposure changes do not imply motion', () => {
  const pixels = (value: number) =>
    new Uint8ClampedArray(
      Array.from({ length: 16 }, () => [value, value, value, 255]).flat(),
    );
  const first = imageFeatures(pixels(50), 4, 4),
    second = imageFeatures(pixels(80), 4, 4, first.luminance);
  assert.ok(second.brightness > first.brightness);
  assert.ok(second.motion < 1e-6);
  assert.equal(second.edgeDensity, 0);
  assert.ok(
    Object.values(featuresToMood(second)).every((v) => v >= 0 && v <= 1),
  );
});
const large: ObjectAppearance = {
  size: 0.4,
  aspectRatio: 1,
  complexity: 0.05,
  motion: 0,
  confidence: 0.9,
};
const medium: ObjectAppearance = {
  size: 0.08,
  aspectRatio: 1.5,
  complexity: 0.4,
  motion: 0.2,
  confidence: 0.9,
};
const active: ObjectAppearance = {
  size: 0.01,
  aspectRatio: 2,
  complexity: 1,
  motion: 1,
  confidence: 0.9,
};
void test('object size, detail and motion determine quarter, eighth and sixteenth rhythms', () => {
  assert.equal(appearanceToRhythm(large, 'chair'), '4n');
  assert.equal(appearanceToRhythm(medium, 'bottle'), '8n');
  assert.equal(appearanceToRhythm(active, 'cell phone'), '16n');
});
void test('object rhythmic identity survives a single noisy observation', () => {
  const r = new ObjectRhythmStabilizer();
  let rhythm: RhythmicSubdivision = '4n';
  for (let t = 0; t <= 2500; t += 500)
    rhythm = r.update(large, 'chair', rhythm, t);
  assert.equal(r.update(active, 'chair', rhythm, 3000), '4n');
  for (let t = 3500; t <= 5500; t += 500)
    rhythm = r.update(large, 'chair', rhythm, t);
  assert.equal(rhythm, '4n');
  for (let t = 6000; t < 6000 + RHYTHM.changeDwellMs; t += 500)
    rhythm = r.update(active, 'cell phone', rhythm, t);
  assert.equal(rhythm, '4n');
  for (let t = 9000; t <= 16000; t += 500)
    rhythm = r.update(active, 'cell phone', rhythm, t);
  assert.equal(rhythm, '16n');
});
void test('sixteenth transport grid produces 16, 8 and 4 note onsets per bar', () => {
  for (const [rhythm, count] of [
    ['16n', 16],
    ['8n', 8],
    ['4n', 4],
  ] as const)
    assert.equal(
      Array.from({ length: 16 }, (_, tick) => tick).filter(
        (t) => t % SUBDIVISION_TICKS[rhythm] === 0,
      ).length,
      count,
    );
});
void test('every generated triad stays within every supported mode for every tonic', () => {
  for (const scale of Object.keys(SCALES) as ScaleId[])
    for (const key of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      const allowed = scaleMidiNotes(key, scale, 36, 96);
      for (let degree = 0; degree < 7; degree++) {
        const c = chord(key, degree, scale);
        assert.ok(
          c.midis.every((n) => allowed.includes(n)),
          `${key} ${scale} degree ${degree}`,
        );
      }
    }
});
void test('D Dorian allows G major and long-note scale freedom beyond that chord', () => {
  assert.deepEqual(chord('D', 3, 'dorian').notes, ['G3', 'B3', 'D4']);
  const scale = scaleMidiNotes('D', 'dorian');
  assert.ok(scale.includes(pitchTargetFromY(0.5, scale)));
  assert.equal(pitchTargetFromY((65 - 36) / 48, scale), 65);
  assert.ok(
    !chord('D', 3, 'dorian')
      .midis.map((n) => n % 12)
      .includes(65 % 12),
  );
});
void test('pitch targets are bounded, monotonic and in-scale across the full hand range', () => {
  for (const scale of Object.keys(SCALES) as ScaleId[]) {
    const notes = scaleMidiNotes('D', scale);
    let prev = -Infinity;
    for (let y = -0.1; y < 1.11; y += 0.003) {
      const target = pitchTargetFromY(y, notes);
      assert.ok(notes.includes(target));
      assert.ok(target >= 36 && target <= 84);
      assert.ok(target >= prev);
      prev = target;
    }
  }
});
void test('pitch hysteresis damps boundary jitter and never preserves a stale out-of-scale target', () => {
  const notes = scaleMidiNotes('C', 'ionian');
  assert.equal(pitchTargetFromY((61.01 - 36) / 48, notes, 36, 84, 60), 60);
  assert.equal(pitchTargetFromY((61.2 - 36) / 48, notes, 36, 84, 60), 62);
  const minor = scaleMidiNotes('C', 'natural_minor');
  assert.notEqual(pitchTargetFromY((64 - 36) / 48, minor, 36, 84, 64), 64);
  assert.equal(midiFrequency(69), 440);
});
void test('scene world switches at phrase boundary; chord and scale change together', () => {
  const h = new ChordProgressionEngine(),
    world = moodToWorld(mood(cases[3][1]));
  h.requestWorld(world);
  assert.equal(h.advance(4).scale, 'ionian');
  assert.equal(h.advance(12).scale, 'ionian');
  const applied = h.advance(16);
  assert.equal(applied.scale, 'melodic_minor');
  assert.equal(applied.chordNotes[1], 'Eb3');
  assert.deepEqual(applied.scaleNotes, scaleMidiNotes('C', 'melodic_minor'));
});
void test('calibration maps personal endpoints and comfortable fallback to exact 0 and 1', () => {
  assert.equal(normalizeExpansion(1.15, { min: 1.15, max: 1.65 }), 0);
  assert.equal(normalizeExpansion(1.65, { min: 1.15, max: 1.65 }), 1);
  assert.ok(
    Math.abs(normalizeExpansion(1.4, { min: 1.15, max: 1.65 }) - 0.5) < 1e-9,
  );
  assert.equal(normalizeExpansion(1), 0);
  assert.equal(normalizeExpansion(1.8), 1);
  assert.equal(validBounds({ min: 1.3, max: 1.4 }), false);
});
void test('calibration captures two stable poses, persists and resets', () => {
  const c = new ExpansionCalibration();
  c.begin('left');
  for (let t = 0; t <= 1000; t += 50) c.observe('left', 1.1, t);
  assert.equal(c.capture(1000), false);
  assert.equal(c.state.step, 'open');
  for (let t = 1100; t <= 2100; t += 50) c.observe('left', 1.75, t);
  assert.equal(c.capture(2100), true);
  assert.deepEqual(c.bounds.left, { min: 1.1, max: 1.75 });
  const restored = new ExpansionCalibration();
  restored.restore(c.serialize());
  assert.deepEqual(restored.bounds, c.bounds);
  restored.reset();
  assert.deepEqual(restored.bounds, {});
});
void test('calibration rejects the wrong hand, stale samples and uncomfortable tiny ranges', () => {
  const c = new ExpansionCalibration();
  c.begin('right');
  for (let t = 0; t <= 1000; t += 50) c.observe('left', 1.1, t);
  assert.equal(c.capture(1000), false);
  for (let t = 1100; t <= 2100; t += 50) c.observe('right', 1.1, t);
  assert.equal(c.capture(3000), false);
  for (let t = 3100; t <= 4100; t += 50) c.observe('right', 1.1, t);
  c.capture(4100);
  for (let t = 4200; t <= 5200; t += 50) c.observe('right', 1.2, t);
  assert.equal(c.capture(5200), false);
  assert.deepEqual(c.bounds, {});
});
void test('normalization precedes smoothing and smoothed expansion reaches endpoints', () => {
  const g = new GestureInterpreter();
  g.calibration.bounds.left = { min: 1.1, max: 1.8 };
  const points: Point[] = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.6,
  }));
  points[0] = { x: 0.5, y: 0.8 };
  points[9] = { x: 0.5, y: 0.6 };
  for (const i of [8, 12, 16, 20]) points[i] = { x: 0.5, y: 0.44 };
  let hand = g.interpret(points, 'left', 0.99, 1000);
  assert.equal(hand?.handExpansion, 1);
  for (const i of [8, 12, 16, 20]) points[i] = { x: 0.5, y: 0.58 };
  hand = g.interpret(points, 'left', 0.99, 1050);
  assert.ok(hand!.handExpansion > 0 && hand!.handExpansion < 1);
  for (let t = 1100; t < 4000; t += 50)
    hand = g.interpret(points, 'left', 0.99, t);
  assert.equal(hand?.handExpansion, 0);
});
void test('room authority is deterministic, prefers global role, and recovers after departure', () => {
  const a = new WorldAuthority('b', () => 1);
  a.observe('a', 1, 0);
  assert.equal(a.leader(100), 'a');
  a.observe('z', 0, 100);
  assert.equal(a.leader(200), 'z');
  assert.equal(a.leader(6000), 'b');
});
void test('world payload validates scale, mood, progression and safe tempo', () => {
  const h = new ChordProgressionEngine(),
    s = h.snapshot(16, Date.now());
  assert.ok(validWorldSnapshot(s));
  assert.equal(
    validWorldSnapshot({ ...s, world: { ...s.world, scale: 'unknown' } }),
    false,
  );
  assert.equal(validWorldSnapshot({ ...s, sequence: [0, 7, 1, 2] }), false);
  assert.equal(validWorldSnapshot({ ...s, bpm: Infinity }), false);
  assert.ok(
    validEnvelope({
      kind: 'world',
      version: 1,
      playerId: 'a',
      sessionId: 'test',
      timestamp: Date.now(),
      snapshot: s,
    }),
  );
});
void test('follower imports identical tonal world, progression, mood and beat', () => {
  const leader = new ChordProgressionEngine(),
    follower = new ChordProgressionEngine();
  leader.requestWorld(moodToWorld(mood(cases[4][1])));
  leader.advance(16);
  leader.advance(21);
  const snapshot = leader.snapshot(84, Date.now());
  assert.deepEqual(follower.follow(snapshot), leader.state());
});
void test('existing local transport synchronizes a late-joining follower without frames', async () => {
  const leader = new MultiplayerSyncManager(),
    follower = new MultiplayerSyncManager();
  leader.priority = () => 0;
  follower.priority = () => 2;
  const room = `test-${Date.now()}`;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    leader.connect(room, () => {});
    const h = new ChordProgressionEngine();
    h.requestWorld(moodToWorld(mood(cases[2][1])));
    h.advance(16);
    const snapshot = h.snapshot(64, Date.now());
    leader.sendWorld(snapshot);
    const received = await new Promise<WorldSyncSnapshot>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('No shared world received')),
        2500,
      );
      follower.connect(room, () => {}, undefined, undefined, resolve);
    });
    assert.deepEqual(received.world, snapshot.world);
    assert.deepEqual(received.sequence, snapshot.sequence);
    assert.equal(follower.isAuthority(), false);
  } finally {
    if (timeout) clearTimeout(timeout);
    leader.disconnect();
    follower.disconnect();
  }
});

void test('received world waits for boundary while the previous scene keeps playing', () => {
  const h = new ChordProgressionEngine(),
    clock = new WorldPlaybackClock();
  const old = { ...h.snapshot(0, 1000, 'old'), bpm: 60 };
  clock.receive(old);
  assert.equal(clock.at(1000)?.tick, 0);
  const next = {
    ...h.snapshot(16, 5000, 'old'),
    bpm: 60,
    world: moodToWorld(mood(cases[4][1])),
  };
  clock.receive(next);
  assert.equal(clock.at(4750)?.snapshot.world.scale, 'ionian');
  assert.equal(clock.at(5000)?.snapshot.world.scale, 'dorian');
  assert.equal(clock.at(5001), undefined);
});
void test('leader restart resets follower tick guard without silence until the old position', () => {
  const h = new ChordProgressionEngine(),
    clock = new WorldPlaybackClock();
  clock.receive(h.snapshot(1000, 1000, 'first'));
  assert.equal(clock.at(1000)?.tick, 1000);
  clock.receive(h.snapshot(0, 1200, 'restart'));
  assert.equal(clock.at(1200)?.tick, 0);
  clock.reset();
  assert.equal(clock.following, false);
});
