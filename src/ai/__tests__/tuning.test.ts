import { describe, it, expect, vi } from 'vitest';
import {
    AI_TUNING_PROFILES,
    applyTuningToUnitCandidates,
    applyTuningToActionCandidates,
    applyTuningToPlanningContext,
} from '../tuning';
import { createTestUnit } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';
import {
    AICandidateUnit,
    AICandidateAction,
    AIPlanningContext,
    AIIntent,
    AIOpponentModel,
} from '../types';
import { createInitialOpponentModel } from '../opponentModel';

// --- Helpers ---

const makeCandidateUnit = (overrides: Partial<AICandidateUnit> = {}): AICandidateUnit => ({
    unit: createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 12),
    score: 10,
    scoreBreakdown: { total: 10, attack: 2, flag: 3, safety: 1, energy: 1 },
    ...overrides,
});

const makeCandidateAction = (overrides: Partial<AICandidateAction> = {}): AICandidateAction => ({
    unitId: 'P2-General',
    type: 'attack',
    energyCost: 8,
    score: 15,
    scoreBreakdown: { total: 15, attack: 4, flag: 2, safety: 1, utility: 3, energy: 1 },
    ...overrides,
});

const makePlanningContext = (reserveEnergy: number = 10): AIPlanningContext => ({
    intent: 'push_flag' as AIIntent,
    threatMap: [],
    reserveEnergy,
    unitRoles: {},
    opponentModel: createInitialOpponentModel(),
    hotspotCells: [],
    opening: { isOpening: false, plan: null, weight: 0, turn: 0 },
    endgame: { isEndgame: false, mode: 'none', urgency: 0, ownAlive: 5, enemyAlive: 5 },
});

// --- AI_TUNING_PROFILES ---

describe('AI_TUNING_PROFILES', () => {
    it('contains aggressive, balanced, and conservative profiles', () => {
        expect(AI_TUNING_PROFILES).toHaveProperty('aggressive');
        expect(AI_TUNING_PROFILES).toHaveProperty('balanced');
        expect(AI_TUNING_PROFILES).toHaveProperty('conservative');
    });

    it('balanced profile has all zero biases', () => {
        const b = AI_TUNING_PROFILES.balanced;
        expect(b.unitAttackBias).toBe(0);
        expect(b.unitFlagBias).toBe(0);
        expect(b.unitSafetyBias).toBe(0);
        expect(b.actionAttackBias).toBe(0);
        expect(b.actionFlagBias).toBe(0);
        expect(b.actionSafetyBias).toBe(0);
        expect(b.actionUtilityBias).toBe(0);
        expect(b.reserveEnergyDelta).toBe(0);
    });

    it('aggressive profile has positive attack biases and negative safety biases', () => {
        const a = AI_TUNING_PROFILES.aggressive;
        expect(a.unitAttackBias).toBeGreaterThan(0);
        expect(a.actionAttackBias).toBeGreaterThan(0);
        expect(a.unitSafetyBias).toBeLessThan(0);
        expect(a.actionSafetyBias).toBeLessThan(0);
    });

    it('conservative profile has positive safety biases and negative attack biases', () => {
        const c = AI_TUNING_PROFILES.conservative;
        expect(c.unitSafetyBias).toBeGreaterThan(0);
        expect(c.actionSafetyBias).toBeGreaterThan(0);
        expect(c.unitAttackBias).toBeLessThan(0);
        expect(c.actionAttackBias).toBeLessThan(0);
    });

    it('aggressive profile lowers reserve energy', () => {
        expect(AI_TUNING_PROFILES.aggressive.reserveEnergyDelta).toBeLessThan(0);
    });

    it('conservative profile raises reserve energy', () => {
        expect(AI_TUNING_PROFILES.conservative.reserveEnergyDelta).toBeGreaterThan(0);
    });

    it('each profile has multiplier fields', () => {
        for (const key of ['aggressive', 'balanced', 'conservative'] as const) {
            const p = AI_TUNING_PROFILES[key];
            expect(p.lookaheadCounterMultiplier).toBeGreaterThan(0);
            expect(p.lookaheadFollowupMultiplier).toBeGreaterThan(0);
            expect(p.feintChanceMultiplier).toBeGreaterThan(0);
            expect(p.feintMaxDeltaMultiplier).toBeGreaterThan(0);
        }
    });
});

// --- applyTuningToUnitCandidates ---

describe('applyTuningToUnitCandidates', () => {
    it('returns candidates unchanged for balanced profile', () => {
        const candidates = [makeCandidateUnit()];
        const result = applyTuningToUnitCandidates(candidates, 'balanced');
        expect(result).toBe(candidates); // same reference
    });

    it('increases score for aggressive profile with high attack breakdown', () => {
        const candidates = [makeCandidateUnit({ scoreBreakdown: { total: 10, attack: 5, flag: 0, safety: 0, energy: 0 } })];
        const result = applyTuningToUnitCandidates(candidates, 'aggressive');
        // attack=5, unitAttackBias=1.8 => +9.0
        expect(result[0].score).toBeGreaterThan(candidates[0].score);
    });

    it('decreases score for aggressive profile with high safety breakdown', () => {
        const candidates = [makeCandidateUnit({
            score: 10,
            scoreBreakdown: { total: 10, attack: 0, flag: 0, safety: 5, energy: 0 },
        })];
        const result = applyTuningToUnitCandidates(candidates, 'aggressive');
        // safety=5, unitSafetyBias=-1.1 => -5.5
        expect(result[0].score).toBeLessThan(10);
    });

    it('computes correct tuned score for aggressive profile', () => {
        const c = makeCandidateUnit();
        // attack=2, flag=3, safety=1, energy=1
        const cfg = AI_TUNING_PROFILES.aggressive;
        const expected = c.score
            + 2 * cfg.unitAttackBias
            + 3 * cfg.unitFlagBias
            + 1 * cfg.unitSafetyBias
            + 1 * cfg.unitEnergyBias;
        const result = applyTuningToUnitCandidates([c], 'aggressive');
        expect(result[0].score).toBeCloseTo(expected, 5);
    });

    it('updates scoreBreakdown.total to match new score', () => {
        const candidates = [makeCandidateUnit()];
        const result = applyTuningToUnitCandidates(candidates, 'aggressive');
        expect(result[0].scoreBreakdown.total).toBe(result[0].score);
    });

    it('handles undefined breakdown fields as 0', () => {
        const candidates = [makeCandidateUnit({
            score: 5,
            scoreBreakdown: { total: 5 }, // no attack/flag/safety/energy
        })];
        const result = applyTuningToUnitCandidates(candidates, 'aggressive');
        // All biases * 0 = 0, so score stays the same
        expect(result[0].score).toBeCloseTo(5, 5);
    });

    it('applies to multiple candidates independently', () => {
        const c1 = makeCandidateUnit({ score: 10, scoreBreakdown: { total: 10, attack: 3 } });
        const c2 = makeCandidateUnit({ score: 8, scoreBreakdown: { total: 8, attack: 1 } });
        const result = applyTuningToUnitCandidates([c1, c2], 'aggressive');
        expect(result).toHaveLength(2);
        expect(result[0].score).not.toBe(result[1].score);
    });
});

// --- applyTuningToActionCandidates ---

describe('applyTuningToActionCandidates', () => {
    it('returns candidates unchanged for balanced profile', () => {
        const candidates = [makeCandidateAction()];
        const result = applyTuningToActionCandidates(candidates, 'balanced');
        expect(result).toBe(candidates); // same reference
    });

    it('increases score for aggressive profile with high attack breakdown', () => {
        const candidates = [makeCandidateAction({
            score: 10,
            scoreBreakdown: { total: 10, attack: 5, flag: 0, safety: 0, utility: 0, energy: 0 },
        })];
        const result = applyTuningToActionCandidates(candidates, 'aggressive');
        // attack=5, actionAttackBias=2.4 => +12
        expect(result[0].score).toBeGreaterThan(10);
    });

    it('computes correct tuned score for conservative profile', () => {
        const c = makeCandidateAction();
        const cfg = AI_TUNING_PROFILES.conservative;
        const expected = c.score
            + 4 * cfg.actionAttackBias
            + 2 * cfg.actionFlagBias
            + 1 * cfg.actionSafetyBias
            + 3 * cfg.actionUtilityBias
            + 1 * cfg.actionEnergyBias;
        const result = applyTuningToActionCandidates([c], 'conservative');
        expect(result[0].score).toBeCloseTo(expected, 5);
    });

    it('updates scoreBreakdown.total to match new score', () => {
        const candidates = [makeCandidateAction()];
        const result = applyTuningToActionCandidates(candidates, 'aggressive');
        expect(result[0].scoreBreakdown.total).toBe(result[0].score);
    });
});

// --- applyTuningToPlanningContext ---

describe('applyTuningToPlanningContext', () => {
    it('returns context unchanged for balanced profile', () => {
        const ctx = makePlanningContext(10);
        const result = applyTuningToPlanningContext(ctx, 'balanced');
        expect(result).toBe(ctx); // same reference
    });

    it('decreases reserveEnergy for aggressive profile', () => {
        const ctx = makePlanningContext(10);
        const result = applyTuningToPlanningContext(ctx, 'aggressive');
        expect(result.reserveEnergy).toBe(10 + AI_TUNING_PROFILES.aggressive.reserveEnergyDelta);
        expect(result.reserveEnergy).toBeLessThan(10);
    });

    it('increases reserveEnergy for conservative profile', () => {
        const ctx = makePlanningContext(10);
        const result = applyTuningToPlanningContext(ctx, 'conservative');
        expect(result.reserveEnergy).toBe(10 + AI_TUNING_PROFILES.conservative.reserveEnergyDelta);
        expect(result.reserveEnergy).toBeGreaterThan(10);
    });

    it('clamps reserveEnergy to a minimum of 0', () => {
        const ctx = makePlanningContext(1);
        const result = applyTuningToPlanningContext(ctx, 'aggressive');
        // 1 + (-2) = -1, clamped to 0
        expect(result.reserveEnergy).toBe(0);
    });

    it('preserves other context fields', () => {
        const ctx = makePlanningContext(10);
        const result = applyTuningToPlanningContext(ctx, 'conservative');
        expect(result.intent).toBe(ctx.intent);
        expect(result.unitRoles).toBe(ctx.unitRoles);
        expect(result.opponentModel).toBe(ctx.opponentModel);
    });
});
