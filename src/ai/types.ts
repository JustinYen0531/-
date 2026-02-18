import { GameState, MineType, Unit } from '../types';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export type AIActionType =
    | 'move'
    | 'attack'
    | 'scan'
    | 'sensor_scan'
    | 'place_mine'
    | 'place_tower'
    | 'place_factory'
    | 'place_hub'
    | 'teleport'
    | 'detonate_tower'
    | 'throw_mine'
    | 'pickup_mine'
    | 'drop_mine'
    | 'move_mine'
    | 'convert_mine'
    | 'disarm'
    | 'evolve_a'
    | 'evolve_a_1'
    | 'evolve_a_2'
    | 'evolve_b'
    | 'evolve_b_1'
    | 'evolve_b_2'
    | 'pickup_flag'
    | 'drop_flag'
    | 'end_turn';

export type AIIntent =
    | 'push_flag'
    | 'hunt_flag_carrier'
    | 'control_mines'
    | 'stabilize';

export type AIUnitRole = 'striker' | 'flanker' | 'controller' | 'scout' | 'support';
export type AITuningProfile = 'aggressive' | 'balanced' | 'conservative';
export type AIOpeningPlan =
    | 'center_break'
    | 'lane_pressure'
    | 'mine_screen'
    | 'scout_probe'
    | 'fortress'
    | 'flag_spear';
export type AIEndgameMode = 'none' | 'race' | 'defense' | 'attrition';

export interface AIScoreWeights {
    unitAttackOpportunity: number;
    unitFlagPressure: number;
    unitSurvival: number;
    unitEnergyEfficiency: number;
    actionDamage: number;
    actionFlagPressure: number;
    actionSafety: number;
    actionUtility: number;
    randomJitter: number;
}

export interface AIScoreBreakdown {
    total: number;
    attack?: number;
    flag?: number;
    safety?: number;
    utility?: number;
    energy?: number;
}

export interface AITargetCell {
    kind: 'cell';
    r: number;
    c: number;
}

export interface AITargetUnit {
    kind: 'unit';
    unit: Unit;
}

export interface AITargetMineType {
    kind: 'mineType';
    mineType: MineType;
}

export type AITarget = AITargetCell | AITargetUnit | AITargetMineType;

export interface AICandidateAction {
    unitId: string;
    type: AIActionType;
    target?: AITarget;
    sourceCell?: { r: number; c: number };
    mineType?: MineType;
    energyCost: number;
    score: number;
    lookaheadScore?: number;
    isFeint?: boolean;
    sourceRank?: number;
    scoreBreakdown: AIScoreBreakdown;
}

export type AIRejectedReasonType = 'energy' | 'risk' | 'rules';

export interface AIRejectedReason {
    reason: AIRejectedReasonType;
    action: AIActionType;
    detail: string;
    count: number;
}

export interface AIRejectedReasonSummary {
    energy: number;
    risk: number;
    rules: number;
}

export interface AIDecisionCandidateView {
    rank: number;
    type: AIActionType;
    target?: AITarget;
    score: number;
    lookaheadScore?: number;
    isFeint?: boolean;
    sourceRank?: number;
    breakdown: AIScoreBreakdown;
}

export interface AIDecisionInfo {
    unitId: string;
    action: AIActionType;
    target?: AITarget;
    mineType?: MineType;
    score: number;
    lookaheadScore?: number;
    intent?: AIIntent;
    role?: AIUnitRole;
    tuningProfile?: AITuningProfile;
    openingPlan?: AIOpeningPlan | null;
    endgameMode?: AIEndgameMode;
    endgameUrgency?: number;
    opponentAggression?: number;
    opponentFlagRush?: number;
    opponentMinePressure?: number;
    isFeint?: boolean;
    sourceRank?: number;
    breakdown: AIScoreBreakdown;
    rawTopCandidates?: AIDecisionCandidateView[];
    finalTopCandidates?: AIDecisionCandidateView[];
    rejectedReasons?: AIRejectedReason[];
    rejectedReasonSummary?: AIRejectedReasonSummary;
}

export interface AICandidateUnit {
    unit: Unit;
    score: number;
    scoreBreakdown: AIScoreBreakdown;
}

export interface AIActions {
    attemptMove: (unitId: string, r: number, c: number, cost: number) => void;
    handleAttack: (attackerId: string, targetUnit: Unit) => void;
    handleScanAction: (unit: Unit, r: number, c: number) => void;
    handleSensorScan: (unitId: string, r: number, c: number) => void;
    handleMinePlacement: (unit: Unit, r: number, c: number, mineType: MineType) => void;
    handlePlaceTowerAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceFactoryAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceHubAction: (unit: Unit, r: number, c: number) => void;
    handleTeleportToHubAction: (unit: Unit) => void;
    handleDetonateTowerAction: (unit: Unit) => void;
    handleThrowMineAction: (unit: Unit, r: number, c: number) => void;
    handlePickupMineAt: (unit: Unit, r: number, c: number) => void;
    handleMoveEnemyMineAction: (unit: Unit, fromR: number, fromC: number, toR: number, toC: number) => void;
    handleConvertEnemyMineAction: (unit: Unit, r: number, c: number) => void;
    handleRangerAction: (subAction: 'pickup' | 'drop') => void;
    handleDisarm: (unit: Unit, r: number, c: number) => void;
    handleEvolution: (unitType: Unit['type'], branch: 'a' | 'b', variant?: number) => void;
    handlePickupFlag: () => void;
    handleDropFlag: () => void;
    handleActionComplete: (actedUnitId: string | null) => void;
}

export interface AIExecutorContext {
    state: GameState;
    actions: AIActions;
    selectUnit: (unitId: string) => void;
}

export type AIThreatMap = number[][];

export interface AIOpponentModel {
    aggression: number;
    flagRush: number;
    minePressure: number;
    hotspots: Record<string, number>;
    samples: number;
}

export interface AIHotspotCell {
    r: number;
    c: number;
    weight: number;
}

export interface AIOpeningState {
    isOpening: boolean;
    plan: AIOpeningPlan | null;
    weight: number;
    turn: number;
}

export interface AIEndgameState {
    isEndgame: boolean;
    mode: AIEndgameMode;
    urgency: number;
    ownAlive: number;
    enemyAlive: number;
}

export interface AIPlanningContext {
    intent: AIIntent;
    threatMap: AIThreatMap;
    reserveEnergy: number;
    unitRoles: Record<string, AIUnitRole>;
    opponentModel: AIOpponentModel;
    hotspotCells: AIHotspotCell[];
    opening: AIOpeningState;
    endgame: AIEndgameState;
}
