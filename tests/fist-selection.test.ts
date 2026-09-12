import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fistStrength, handGeometry } from '../src/gestures/handGeometry';
import { GestureInterpreter } from '../src/gestures/GestureInterpreter';
import { ObjectSelectionManager } from '../src/interaction/ObjectSelectionManager';
import { ObjectTracker } from '../src/vision/ObjectTracker';
import type { Point, HandControlState } from '../src/types';
function pose(closed: boolean): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  p[0] = { x: 0.5, y: 0.9 };
  for (const [mcp, pip, tip] of [
    [5, 6, 8],
    [9, 10, 12],
    [13, 14, 16],
    [17, 18, 20],
  ]) {
    p[mcp] = { x: 0.5, y: 0.6 };
    p[pip] = { x: 0.5, y: 0.5 };
    p[tip] = { x: 0.5, y: closed ? 0.65 : 0.3 };
  }
  p[4] = { ...p[8] };
  return p;
}
const control = (patch: Partial<HandControlState> = {}): HandControlState => ({
  handedness: 'left',
  x: 0.5,
  cursorY: 0.5,
  y: 0.5,
  pinchDistance: 0.5,
  handExpansion: 0.1,
  handAngle: 0,
  isSelecting: true,
  confidence: 1,
  landmarks: [],
  ...patch,
});
function objects() {
  const t = new ObjectTracker();
  return [
    { label: 'person', bbox: { x: 0, y: 0, width: 1, height: 1 } },
    { label: 'bottle', bbox: { x: 0.4, y: 0.4, width: 0.2, height: 0.25 } },
  ].map((d) => t.create({ ...d, confidence: 1 }, 0));
}
void test('fist is independent of thumb/index pinch and uses palm cursor', () => {
  assert.ok(fistStrength(pose(true)) > 0.72);
  const pinch = pose(false);
  assert.equal(fistStrength(pinch), 0);
  const g = handGeometry(pose(true));
  assert.equal(g.x, 0.5);
  assert.equal(g.cursorY, 0.675);
  const interpreter = new GestureInterpreter();
  assert.equal(
    interpreter.interpret(pinch, 'left', 1, 1000)?.isSelecting,
    false,
  );
  assert.equal(
    new GestureInterpreter().interpret(pose(true), 'left', 1, 1000)
      ?.isSelecting,
    true,
  );
});
void test('one curled finger or transient fist does not latch selection', () => {
  const p = pose(false);
  p[8] = { x: 0.5, y: 0.65 };
  assert.ok(fistStrength(p) < 0.72);
  const g = new GestureInterpreter();
  g.interpret(pose(false), 'left', 1, 1000);
  assert.equal(g.interpret(pose(true), 'left', 1, 1050)?.isSelecting, false);
  for (let t = 1100; t <= 1500; t += 50) g.interpret(pose(true), 'left', 1, t);
  assert.equal(g.interpret(pose(true), 'left', 1, 1550)?.isSelecting, true);
  for (let t = 1600; t <= 2200; t += 50) g.interpret(pose(false), 'left', 1, t);
  assert.equal(g.interpret(pose(false), 'left', 1, 2250)?.isSelecting, false);
});
void test('person cannot be grabbed even before the hand reaches another object', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  for (let t = 0; t <= 1000; t += 100) m.update(control({ x: 0.2 }), o, t);
  assert.equal(m.selectedId, undefined);
  m.update(control(), o, 1100);
  m.update(control(), o, 1300);
  assert.equal(m.selectedId, o[1].id);
});
void test('person exclusion works even when person box is smaller than the object', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  o[0].bbox = { x: 0.48, y: 0.48, width: 0.04, height: 0.04 };
  m.update(control(), o, 1000);
  m.update(control(), o, 1200);
  assert.equal(m.selectedId, o[1].id);
});
void test('person remains manually selectable and linked object survives reopening inside box', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  m.select(o[0], o, 1000);
  assert.equal(m.selectedId, o[0].id);
  m.update(control({ isSelecting: false, pinchDistance: 0.8 }), o, 1100);
  assert.equal(m.selectedId, o[0].id);
});
void test('missing tracking resets pending fist dwell', () => {
  const m = new ObjectSelectionManager(),
    o = objects();
  m.update(control(), o, 1000);
  m.update(undefined, o, 1100);
  m.update(control(), o, 1250);
  assert.equal(m.selectedId, undefined);
  m.update(control(), o, 1450);
  assert.equal(m.selectedId, o[1].id);
});
void test('two right hands have separate smoothing and fist state', () => {
  const g = new GestureInterpreter();
  for (let t = 1000; t <= 1400; t += 50) {
    assert.equal(
      g.interpret(pose(true), 'right', 1, t, 'R1')?.isSelecting,
      true,
    );
    assert.equal(
      g.interpret(pose(false), 'right', 1, t, 'R2')?.isSelecting,
      false,
    );
  }
});
