import type { ObjectInteractionState } from '../types';
export const TRANSITIONS: Record<
  ObjectInteractionState,
  ObjectInteractionState[]
> = {
  IDLE: ['HOVERING'],
  HOVERING: ['IDLE', 'GRABBING'],
  GRABBING: ['HOVERING', 'IDLE', 'SELECTED'],
  SELECTED: ['FREE_PITCH', 'RELEASING', 'IDLE'],
  FREE_PITCH: ['SELECTED', 'RELEASING', 'IDLE'],
  RELEASING: ['SELECTED', 'FREE_PITCH', 'IDLE'],
};
export class GestureStateMachine {
  state: ObjectInteractionState = 'IDLE';
  transition(next: ObjectInteractionState) {
    if (next === this.state) return;
    if (!TRANSITIONS[this.state].includes(next))
      throw new Error(`Invalid transition ${this.state} → ${next}`);
    this.state = next;
  }
  reset() {
    this.state = 'IDLE';
  }
}
