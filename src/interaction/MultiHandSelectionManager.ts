import type { HandControlState, SoundObject, HandObjectLink } from '../types';
import { ObjectSelectionManager } from './ObjectSelectionManager';
export class MultiHandSelectionManager {
  readonly managers = new Map<string, ObjectSelectionManager>();
  private focusId = 'pointer';
  private labels = new Map<string, string>();
  notice = '';
  noticeAt = 0;
  manager(id: string) {
    if (!this.managers.has(id))
      this.managers.set(id, new ObjectSelectionManager(id));
    return this.managers.get(id)!;
  }
  get focused() {
    return this.manager(this.focusId);
  }
  owner(hand: HandControlState) {
    return hand.handId ?? hand.handedness;
  }
  isLinked(hand: HandControlState) {
    return Boolean(this.managers.get(this.owner(hand))?.selectedId);
  }
  update(hands: HandControlState[], objects: SoundObject[], now: number) {
    const seen = new Set<string>();
    for (const h of hands) {
      const id = this.owner(h);
      seen.add(id);
      this.labels.set(id, h.controlLabel ?? h.handedness);
      const m = this.manager(id),
        before = m.selectedId;
      m.update(h, objects, now);
      if (before !== m.selectedId) {
        if (m.selectedId) this.focusId = id;
        this.notice = m.notice;
        this.noticeAt = now;
      }
    }
    for (const [id, m] of this.managers) {
      if (id === 'pointer' || seen.has(id)) continue;
      const before = m.selectedId;
      m.update(undefined, objects, now);
      if (before && !m.selectedId) {
        this.notice = m.notice;
        this.noticeAt = now;
      }
      if (!m.selectedId && m.machine.state === 'IDLE') {
        this.managers.delete(id);
        this.labels.delete(id);
      }
    }
  }
  select(
    object: SoundObject,
    objects: SoundObject[],
    hands: HandControlState[],
    now: number,
  ) {
    if (object.selectedBy) {
      this.focusId = object.selectedBy;
      return;
    }
    const center = {
      x: object.bbox.x + object.bbox.width / 2,
      y: object.bbox.y + object.bbox.height / 2,
    };
    const closest = [...hands].sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.cursorY - center.y) -
        Math.hypot(b.x - center.x, b.cursorY - center.y),
    )[0];
    this.focusId = closest ? this.owner(closest) : 'pointer';
    if (closest)
      this.labels.set(this.focusId, closest.controlLabel ?? closest.handedness);
    this.focused.select(object, objects, now);
    this.notice = 'LINKED';
    this.noticeAt = now;
  }
  detach(objects: SoundObject[], now: number) {
    this.focused.detach(objects, now);
    this.notice = 'DETACHED';
    this.noticeAt = now;
  }
  reset(objects: SoundObject[], now: number) {
    for (const m of this.managers.values()) m.detach(objects, now);
    this.managers.clear();
    this.labels.clear();
    this.focusId = 'pointer';
    this.notice = '';
    this.noticeAt = 0;
  }
  links(objects: SoundObject[], hands: HandControlState[]): HandObjectLink[] {
    return objects.flatMap((o) => {
      if (!o.selectedBy) return [];
      return [
        {
          objectId: o.id,
          handId: o.selectedBy,
          label: this.labels.get(o.selectedBy) ?? 'Pointer',
          hand: hands.find((h) => this.owner(h) === o.selectedBy),
        },
      ];
    });
  }
}
