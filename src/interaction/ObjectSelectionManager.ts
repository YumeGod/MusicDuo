import type { HandControlState, SoundObject } from '../types';
import { GESTURE } from '../config/gestureConfig';
import { GestureStateMachine } from '../gestures/GestureStateMachine';
import { Dwell, clamp } from '../gestures/smoothing';
export class ObjectSelectionManager {
  machine = new GestureStateMachine();
  selectedId?: string;
  hoveredId?: string;
  notice = '';
  noticeAt = 0;
  private selectDwell = new Dwell();
  private releaseDwell = new Dwell();
  private lastHand = 0;
  private inside(h: HandControlState, o: SoundObject) {
    const b = o.bbox,
      m = GESTURE.nearMargin;
    return (
      h.x > b.x - m &&
      h.x < b.x + b.width + m &&
      h.cursorY > b.y - m &&
      h.cursorY < b.y + b.height + m
    );
  }
  detach(objects: SoundObject[], now: number) {
    const o = objects.find((o) => o.id === this.selectedId);
    if (o) {
      o.selectedBy = undefined;
      o.mode = 'CHORD_FOLLOWING';
    }
    this.selectedId = undefined;
    this.machine.reset();
    this.selectDwell.reset();
    this.releaseDwell.reset();
    this.notice = 'DETACHED';
    this.noticeAt = now;
  }
  select(o: SoundObject, objects: SoundObject[], now: number) {
    this.detach(objects, now);
    this.machine.transition('HOVERING');
    this.machine.transition('PINCHING');
    this.machine.transition('SELECTED');
    this.selectedId = o.id;
    o.selectedBy = 'local';
    this.notice = 'LINKED';
    this.noticeAt = now;
  }
  update(
    hand: HandControlState | undefined,
    objects: SoundObject[],
    now: number,
  ) {
    const selected = objects.find((o) => o.id === this.selectedId);
    if (this.selectedId && !selected) this.detach(objects, now);
    if (!hand) {
      if (now - this.lastHand > GESTURE.lostHandMs) {
        if (this.selectedId) this.detach(objects, now);
        else {
          this.machine.reset();
          this.selectDwell.reset();
          this.hoveredId = undefined;
        }
      }
      return;
    }
    this.lastHand = now;
    if (selected) {
      const away =
        !this.inside(hand, selected) &&
        hand.pinchDistance > GESTURE.releaseThreshold;
      if (away) {
        this.machine.transition('RELEASING');
        if (this.releaseDwell.update(true, now, GESTURE.releaseDwellMs)) {
          this.detach(objects, now);
          return;
        }
      } else {
        this.releaseDwell.reset();
        if (this.machine.state === 'RELEASING')
          this.machine.transition(
            selected.mode === 'FREE_LONG_NOTE' ? 'FREE_PITCH' : 'SELECTED',
          );
      }
      selected.volume = clamp(hand.pinchDistance / 1.2);
      selected.sustain = 0.08 + hand.handExpansion * 1.6;
      selected.pitchY = hand.y;
      selected.pitchOffset = Math.floor(hand.y * 3) - 1;
      if (!away) {
        if (hand.handExpansion > GESTURE.freeEnter) {
          selected.mode = 'FREE_LONG_NOTE';
          this.machine.transition('FREE_PITCH');
        } else if (hand.handExpansion < GESTURE.freeExit) {
          selected.mode = 'CHORD_FOLLOWING';
          this.machine.transition('SELECTED');
        }
      }
      return;
    }
    const hovered = objects
      .filter((o) => this.inside(hand, o))
      .sort(
        (a, b) => a.bbox.width * a.bbox.height - b.bbox.width * b.bbox.height,
      )[0];
    if (hovered?.id !== this.hoveredId) {
      this.selectDwell.reset();
      this.machine.reset();
    }
    this.hoveredId = hovered?.id;
    if (!hovered) {
      this.machine.reset();
      return;
    }
    if (this.machine.state === 'IDLE') this.machine.transition('HOVERING');
    if (hand.isSelecting) {
      this.machine.transition('PINCHING');
      if (this.selectDwell.update(true, now, GESTURE.selectDwellMs))
        this.select(hovered, objects, now);
    } else {
      this.selectDwell.reset();
      this.machine.transition('HOVERING');
    }
  }
}
