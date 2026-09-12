import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MultiHandSelectionManager } from '../src/interaction/MultiHandSelectionManager';
import { HandIdentityTracker } from '../src/vision/HandIdentityTracker';
import { ObjectTracker } from '../src/vision/ObjectTracker';
import type { HandControlState } from '../src/types';
const hand = (
  id: string,
  x: number,
  patch: Partial<HandControlState> = {},
): HandControlState => ({
  handId: id,
  controlLabel: id,
  handedness: 'right',
  x,
  cursorY: 0.5,
  y: 0.5,
  pinchDistance: 0.3,
  handExpansion: 0.2,
  handAngle: 0,
  isSelecting: true,
  confidence: 1,
  landmarks: [],
  ...patch,
});
function setup() {
  const m = new MultiHandSelectionManager(),
    t = new ObjectTracker();
  const objects = [0.2, 0.7].map((x, i) =>
    t.create(
      {
        label: i ? 'book' : 'bottle',
        confidence: 1,
        bbox: { x, y: 0.4, width: 0.15, height: 0.2 },
      },
      0,
    ),
  );
  const hands = [hand('R1', 0.25), hand('R2', 0.75)];
  m.update(hands, objects, 1000);
  m.update(hands, objects, 1250);
  return { m, objects, hands };
}
void test('two right hands grab and independently control different objects', () => {
  const { m, objects, hands } = setup();
  assert.deepEqual(
    objects.map((o) => o.selectedBy),
    ['R1', 'R2'],
  );
  m.update(
    [
      { ...hands[0], pinchDistance: 0.24, handExpansion: 0.95, y: 0.8 },
      { ...hands[1], pinchDistance: 0.96, handExpansion: 0.2, y: 0.2 },
    ],
    objects,
    1300,
  );
  assert.equal(objects[0].volume, 0.2);
  assert.equal(objects[1].volume, 0.8);
  assert.equal(objects[0].mode, 'FREE_LONG_NOTE');
  assert.equal(objects[1].mode, 'CHORD_FOLLOWING');
  assert.equal(objects[0].pitchY, 0.8);
  assert.equal(objects[1].pitchY, 0.2);
  assert.equal(m.links(objects, hands).length, 2);
});
void test('one hand releasing does not release its partner', () => {
  const { m, objects, hands } = setup();
  const release = {
    ...hands[0],
    isSelecting: false,
    x: 0.01,
    pinchDistance: 0.9,
  };
  m.update([release, hands[1]], objects, 1500);
  m.update([release, hands[1]], objects, 2200);
  assert.equal(objects[0].selectedBy, undefined);
  assert.equal(objects[1].selectedBy, 'R2');
});
void test('tracking loss detaches only the missing hand', () => {
  const { m, objects, hands } = setup();
  m.update([hands[1]], objects, 2600);
  assert.equal(objects[0].selectedBy, undefined);
  assert.equal(objects[1].selectedBy, 'R2');
});
void test('occupied objects cannot be stolen by another fist or manual manager', () => {
  const { m, objects, hands } = setup();
  m.update([hands[0], hands[1], hand('R3', 0.25)], objects, 1500);
  m.update([hands[0], hands[1], hand('R3', 0.25)], objects, 1800);
  m.manager('R3').select(objects[0], objects, 1900);
  assert.equal(objects[0].selectedBy, 'R1');
  assert.equal(m.manager('R3').selectedId, undefined);
});
const observed = (x: number) => ({
  landmarks: Array.from({ length: 21 }, () => ({ x, y: 0.5 })),
  handedness: 'right' as const,
  confidence: 1,
});
void test('same-handed track identities survive reversed detection order', () => {
  const t = new HandIdentityTracker();
  const first = t.update([observed(0.2), observed(0.8)], 1000);
  const second = t.update([observed(0.78), observed(0.22)], 1050);
  assert.equal(second[0].handId, first[1].handId);
  assert.equal(second[1].handId, first[0].handId);
  assert.notEqual(first[0].handId, first[1].handId);
});
void test('velocity prediction preserves tracks crossing with visible landmarks', () => {
  const t = new HandIdentityTracker();
  const first = t.update([observed(0.3), observed(0.7)], 1000);
  t.update([observed(0.4), observed(0.6)], 1100);
  const crossed = t.update([observed(0.48), observed(0.52)], 1250);
  assert.equal(crossed[0].handId, first[1].handId);
  assert.equal(crossed[1].handId, first[0].handId);
});
void test('a brief occlusion retains identity but a long disappearance reacquires safely', () => {
  const t = new HandIdentityTracker();
  const [first] = t.update([observed(0.3)], 1000);
  t.update([], 1100);
  assert.equal(t.update([observed(0.31)], 1200)[0].handId, first.handId);
  assert.notEqual(t.update([observed(0.31)], 2000)[0].handId, first.handId);
});
void test('network carries two simultaneous same-role hand streams independently', async () => {
  const { MultiplayerSyncManager } =
    await import('../src/multiplayer/MultiplayerSyncManager');
  const a = new MultiplayerSyncManager(),
    b = new MultiplayerSyncManager(),
    room = crypto.randomUUID();
  const ids: string[] = [];
  try {
    a.connect(room, () => {});
    b.connect(room, (m) => ids.push(m.controls.handId!));
    a.send({ role: 'OBJECT_CONTROLLER', controls: { handId: 'R1', x: 0.2 } });
    a.send({ role: 'OBJECT_CONTROLLER', controls: { handId: 'R2', x: 0.8 } });
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(ids, ['R1', 'R2']);
  } finally {
    a.disconnect();
    b.disconnect();
  }
});
