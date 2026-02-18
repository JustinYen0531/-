import { AICandidateAction, AICandidateUnit, AITuningProfile, AIPlanningContext } from './types';

export interface AITuningProfileConfig {
    label: string;
    unitAttackBias: number;
    unitFlagBias: number;
    unitSafetyBias: number;
    unitEnergyBias: number;
    actionAttackBias: number;
    actionFlagBias: number;
    actionSafetyBias: number;
    actionUtilityBias: number;
    actionEnergyBias: number;
    reserveEnergyDelta: number;
    lookaheadCounterMultiplier: number;
    lookaheadFollowupMultiplier: number;
    feintChanceMultiplier: number;
    feintMaxDeltaMultiplier: number;
}

export const AI_TUNING_PROFILES: Record<AITuningProfile, AITuningProfileConfig> = {
    aggressive: {
        label: 'Aggressive',
        unitAttackBias: 1.8,
        unitFlagBias: 1.1,
        unitSafetyBias: -1.1,
        unitEnergyBias: -0.2,
        actionAttackBias: 2.4,
        actionFlagBias: 1.2,
        actionSafetyBias: -1.5,
        actionUtilityBias: 0.4,
        actionEnergyBias: -0.2,
        reserveEnergyDelta: -2,
        lookaheadCounterMultiplier: 0.85,
        lookaheadFollowupMultiplier: 1.2,
        feintChanceMultiplier: 1.2,
        feintMaxDeltaMultiplier: 1.2
    },
    balanced: {
        label: 'Balanced',
        unitAttackBias: 0,
        unitFlagBias: 0,
        unitSafetyBias: 0,
        unitEnergyBias: 0,
        actionAttackBias: 0,
        actionFlagBias: 0,
        actionSafetyBias: 0,
        actionUtilityBias: 0,
        actionEnergyBias: 0,
        reserveEnergyDelta: 0,
        lookaheadCounterMultiplier: 1,
        lookaheadFollowupMultiplier: 1,
        feintChanceMultiplier: 1,
        feintMaxDeltaMultiplier: 1
    },
    conservative: {
        label: 'Conservative',
        unitAttackBias: -0.8,
        unitFlagBias: -0.2,
        unitSafetyBias: 1.7,
        unitEnergyBias: 0.8,
        actionAttackBias: -1.1,
        actionFlagBias: -0.3,
        actionSafetyBias: 2.3,
        actionUtilityBias: 0.6,
        actionEnergyBias: 0.8,
        reserveEnergyDelta: 2,
        lookaheadCounterMultiplier: 1.25,
        lookaheadFollowupMultiplier: 0.9,
        feintChanceMultiplier: 0.7,
        feintMaxDeltaMultiplier: 0.75
    }
};

const read = (value: number | undefined) => value ?? 0;

export const applyTuningToUnitCandidates = (
    candidates: AICandidateUnit[],
    profile: AITuningProfile
) => {
    const cfg = AI_TUNING_PROFILES[profile];
    if (profile === 'balanced') return candidates;

    return candidates.map(candidate => {
        const b = candidate.scoreBreakdown;
        const tunedScore =
            candidate.score +
            read(b.attack) * cfg.unitAttackBias +
            read(b.flag) * cfg.unitFlagBias +
            read(b.safety) * cfg.unitSafetyBias +
            read(b.energy) * cfg.unitEnergyBias;

        return {
            ...candidate,
            score: tunedScore,
            scoreBreakdown: {
                ...b,
                total: tunedScore
            }
        };
    });
};

export const applyTuningToActionCandidates = (
    candidates: AICandidateAction[],
    profile: AITuningProfile
) => {
    const cfg = AI_TUNING_PROFILES[profile];
    if (profile === 'balanced') return candidates;

    return candidates.map(action => {
        const b = action.scoreBreakdown;
        const tunedScore =
            action.score +
            read(b.attack) * cfg.actionAttackBias +
            read(b.flag) * cfg.actionFlagBias +
            read(b.safety) * cfg.actionSafetyBias +
            read(b.utility) * cfg.actionUtilityBias +
            read(b.energy) * cfg.actionEnergyBias;

        return {
            ...action,
            score: tunedScore,
            scoreBreakdown: {
                ...b,
                total: tunedScore
            }
        };
    });
};

export const applyTuningToPlanningContext = (
    context: AIPlanningContext,
    profile: AITuningProfile
): AIPlanningContext => {
    const cfg = AI_TUNING_PROFILES[profile];
    if (cfg.reserveEnergyDelta === 0) return context;
    return {
        ...context,
        reserveEnergy: Math.max(0, context.reserveEnergy + cfg.reserveEnergyDelta)
    };
};
