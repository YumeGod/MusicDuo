import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectTracker } from '../src/vision/ObjectTracker';
import { ObjectSelectionManager } from '../src/interaction/ObjectSelectionManager';
import { ChordProgressionEngine } from '../src/audio/ChordProgressionEngine';
import { GlobalMusicController } from '../src/audio/GlobalMusicController';
import { GameModeManager } from '../src/interaction/GameModeManager';
import { frequencyFromY } from '../src/audio/harmony';
import { validMessage } from '../src/multiplayer/protocol';
import { EMA } from '../src/gestures/smoothing';
import type { HandControlState } from '../src/types';
const d = {
  label: 'bottle',
  confidence: 0.9,
  bbox: { x: 0.2, y: 0.2, width: 0.2, height: 0.3 },
};
const hand = (overrides: Partial<HandControlState> = {}): HandControlState => ({
  handedness: 'left',
  x: 0.3,
  y: 0.6,
  cursorY: 0.3,
  pinchDistance: 0.1,
  handExpansion: 0.4,
  handAngle: 0,
  isSelecting: true,
  confidence: 0.9,
  landmarks: [],
  ...overrides,
});
function objects() {
  const t = new ObjectTracker();
  t.update([d], 100);
  t.update([d], 200);
  return t.stable();
}
void test('objects become stable after observations, keep identity, expire after timeout', () => {
  const t = new ObjectTracker();
  assert.equal(t.update([d], 0).length, 0);
  const id = t.update([d], 450)[0].id;
  assert.equal(
    t.update([{ ...d, bbox: { ...d.bbox, x: 0.21 } }], 900)[0].id,
    id,
  );
  assert.equal(t.update([], 5000).length, 1);
  assert.equal(t.update([], 5500).length, 0);
});
void test('same-class objects receive distinct persistent identities', () => {
  const t = new ObjectTracker();
  const detections = [d, { ...d, bbox: { ...d.bbox, x: 0.7 } }];
  t.update(detections, 0);
  const first = t.update(detections, 450);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].id, first[1].id);
  assert.deepEqual(
    t.update(detections, 900).map((o) => o.id),
    first.map((o) => o.id),
  );
});
void test('one noisy pinch cannot select; dwell can', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  m.update(hand(), o, 1000);
  assert.equal(m.machine.state, 'PINCHING');
  m.update(hand({ isSelecting: false }), o, 1100);
  assert.equal(m.selectedId, undefined);
  m.update(hand(), o, 1200);
  m.update(hand(), o, 1400);
  assert.equal(m.selectedId, o[0].id);
  assert.equal(m.machine.state, 'SELECTED');
});
void test('free mode has hysteresis and release requires open-away dwell', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  m.select(o[0], o, 1000);
  m.update(hand({ handExpansion: 0.9 }), o, 1100);
  assert.equal(o[0].mode, 'FREE_LONG_NOTE');
  m.update(hand({ handExpansion: 0.72 }), o, 1200);
  assert.equal(o[0].mode, 'FREE_LONG_NOTE');
  m.update(hand({ handExpansion: 0.5 }), o, 1300);
  assert.equal(o[0].mode, 'CHORD_FOLLOWING');
  const away = hand({ x: 0.9, pinchDistance: 0.8, isSelecting: false });
  m.update(away, o, 1500);
  assert.equal(m.machine.state, 'RELEASING');
  m.update(away, o, 2000);
  assert.ok(m.selectedId);
  m.update(away, o, 2200);
  assert.equal(m.selectedId, undefined);
  assert.equal(o[0].selectedBy, undefined);
});
void test('losing a hand safely releases a sustained note', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  m.select(o[0], o, 1000);
  m.update(hand({ handExpansion: 1 }), o, 1100);
  m.update(undefined, o, 2400);
  assert.equal(m.selectedId, undefined);
  assert.equal(o[0].mode, 'CHORD_FOLLOWING');
});
void test('harmony changes only at bar boundaries and regeneration at phrase boundaries', () => {
  const h = new ChordProgressionEngine();
  assert.deepEqual(h.state().progression, ['C', 'G', 'Am', 'F']);
  h.requestKey('G');
  assert.equal(h.advance(1).key, 'C');
  assert.equal(h.advance(4).key, 'G');
  h.requestRegenerate();
  h.advance(8);
  assert.equal(h.template, 0);
  h.advance(16);
  assert.notEqual(h.template, 0);
});
void test('free pitch is logarithmic, four octaves, and bounded', () => {
  const low = frequencyFromY(0),
    high = frequencyFromY(1);
  assert.ok(Math.abs(high / low - 16) < 1e-9);
  assert.ok(Math.abs(frequencyFromY(0.5) / low - 4) < 1e-9);
  assert.equal(frequencyFromY(-1), low);
  assert.equal(frequencyFromY(2), high);
});
void test('key gesture requires dwell and neutral angle preserves C', () => {
  const g = new GlobalMusicController();
  g.keyGestureEnabled = true;
  assert.equal(g.update(hand({ handAngle: 0 }), 1000), undefined);
  assert.equal(g.update(hand({ handAngle: 35 }), 1500), undefined);
  assert.equal(g.update(hand({ handAngle: 35 }), 3000), 'G');
  assert.equal(g.update(hand({ handAngle: 34 }), 4500), undefined);
});
void test('roles support mirror correction and single hand mobile play', () => {
  assert.equal(
    GameModeManager.role(hand(), 'DESKTOP_DUO', 'AUTO'),
    'OBJECT_CONTROLLER',
  );
  assert.equal(
    GameModeManager.role(hand(), 'DESKTOP_DUO', 'SWAP'),
    'GLOBAL_CONTROLLER',
  );
  assert.equal(
    GameModeManager.role(
      hand({ handedness: 'right' }),
      'MOBILE_SHARED',
      'AUTO',
    ),
    'OBJECT_CONTROLLER',
  );
});
void test('EMA damps sudden input changes', () => {
  const e = new EMA(0.2);
  assert.equal(e.next(0), 0);
  assert.equal(e.next(1), 0.2);
  assert.equal(e.next(1), 0.36000000000000004);
});
void test('network validation rejects malformed and out-of-range controls', () => {
  const m = {
    version: 1,
    sessionId: 'room',
    playerId: 'player',
    role: 'OBJECT_CONTROLLER',
    timestamp: Date.now(),
    controls: { x: 0.5, y: 0.5 },
  };
  assert.ok(validMessage(m));
  assert.equal(validMessage({ ...m, controls: { x: Infinity } }), false);
  assert.equal(validMessage({ ...m, controls: { isSelecting: 'yes' } }), false);
  assert.equal(validMessage({ ...m, role: 'BAD' }), false);
});
