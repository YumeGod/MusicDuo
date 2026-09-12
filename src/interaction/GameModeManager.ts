import type { GameMode, HandControlState, Role, RoleOverride } from '../types';
export class GameModeManager {
  static facing(mode: GameMode) {
    return mode === 'MOBILE_SHARED' ? 'environment' : 'user';
  }
  static role(
    hand: HandControlState,
    mode: GameMode,
    override: RoleOverride,
  ): Role {
    if (mode === 'MOBILE_SHARED') return 'OBJECT_CONTROLLER';
    if (override === 'GLOBAL_CONTROLLER' || override === 'OBJECT_CONTROLLER')
      return override;
    const right =
      override === 'SWAP'
        ? hand.handedness === 'left'
        : hand.handedness === 'right';
    return right ? 'GLOBAL_CONTROLLER' : 'OBJECT_CONTROLLER';
  }
}
