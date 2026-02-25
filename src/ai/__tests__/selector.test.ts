import { describe, it, expect, vi } from 'vitest';
import { selectBestUnit, sortActionsByPriority, selectBestAction } from '../selector';
import { AICandidateAction, AICandidateUnit, AIScoreBreakdown } from '../types';
import { createTestUnit } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';

const makeBreakdown = (total: number, overrides: Partial<AIScoreBreakdown> = {}): AIScoreBreakdown => ({
    total,
    ...overrides,
});

const makeCandidateUnit = (
    owner: PlayerID,
    type: UnitType,
    r: number,
    c: number,
    score: number
): AICandidateUnit => ({
    unit: createTestUnit(owner, type, r, c),
    score,
    scoreBreakdown: makeBreakdown(score),
});

const makeCandidateAction = (
    unitId: string,
    type: AICandidateAction['type'],
    score: number,
    overrides: Partial<AICandidateAction> = {}
): AICandidateAction => ({
    unitId,
    type,
    energyCost: 2,
    score,
    scoreBreakdown: makeBreakdown(score),
    ...overrides,
});

describe('selectBestUnit', () => {
    it('returns null for an empty candidate list', () => {
        expect(selectBestUnit([])).toBeNull();
    });

    it('returns the single candidate when list has one element', () => {
        const candidate = makeCandidateUnit(PlayerID.P2, UnitType.GENERAL, 1, 22, 10);
        const result = selectBestUnit([candidate]);
        expect(result).toBe(candidate);
    });

    it('returns the candidate with the highest score', () => {
        const low = makeCandidateUnit(PlayerID.P2, UnitType.MAKER, 4, 22, 5);
        const high = makeCandidateUnit(PlayerID.P2, UnitType.GENERAL, 1, 22, 15);
        const mid = makeCandidateUnit(PlayerID.P2, UnitType.RANGER, 3, 22, 10);
        const result = selectBestUnit([low, high, mid]);
        expect(result).toBe(high);
    });

    it('returns the first highest-scored candidate when scores are tied', () => {
        const a = makeCandidateUnit(PlayerID.P2, UnitType.GENERAL, 1, 22, 10);
        const b = makeCandidateUnit(PlayerID.P2, UnitType.RANGER, 3, 22, 10);
        const result = selectBestUnit([a, b]);
        // Sort is not stable in all engines, but one of the two should be returned
        expect(result?.score).toBe(10);
    });

    it('handles negative scores correctly', () => {
        const neg = makeCandidateUnit(PlayerID.P2, UnitType.DEFUSER, 5, 22, -5);
        const zero = makeCandidateUnit(PlayerID.P2, UnitType.MAKER, 4, 22, 0);
        const result = selectBestUnit([neg, zero]);
        expect(result).toBe(zero);
    });
});

describe('sortActionsByPriority', () => {
    it('returns empty array for empty input', () => {
        expect(sortActionsByPriority([])).toEqual([]);
    });

    it('sorts actions in descending order by score', () => {
        const a = makeCandidateAction('u1', 'move', 5);
        const b = makeCandidateAction('u1', 'attack', 15);
        const c = makeCandidateAction('u1', 'scan', 10);
        const sorted = sortActionsByPriority([a, b, c]);
        expect(sorted[0].score).toBe(15);
        expect(sorted[1].score).toBe(10);
        expect(sorted[2].score).toBe(5);
    });

    it('uses ACTION_PRIORITY as tiebreaker when scores are equal', () => {
        const moveAction = makeCandidateAction('u1', 'move', 10);
        const attackAction = makeCandidateAction('u1', 'attack', 10);
        const sorted = sortActionsByPriority([moveAction, attackAction]);
        // attack has higher ACTION_PRIORITY (90) than move (35)
        expect(sorted[0].type).toBe('attack');
        expect(sorted[1].type).toBe('move');
    });

    it('does not mutate the original array', () => {
        const a = makeCandidateAction('u1', 'move', 5);
        const b = makeCandidateAction('u1', 'attack', 15);
        const original = [a, b];
        sortActionsByPriority(original);
        expect(original[0]).toBe(a);
        expect(original[1]).toBe(b);
    });

    it('correctly orders multiple tied-score actions by priority', () => {
        const scan = makeCandidateAction('u1', 'scan', 8);         // priority 45
        const disarm = makeCandidateAction('u1', 'disarm', 8);     // priority 55
        const endTurn = makeCandidateAction('u1', 'end_turn', 8);  // priority 0
        const sorted = sortActionsByPriority([endTurn, scan, disarm]);
        expect(sorted[0].type).toBe('disarm');
        expect(sorted[1].type).toBe('scan');
        expect(sorted[2].type).toBe('end_turn');
    });

    it('handles single-element array', () => {
        const a = makeCandidateAction('u1', 'move', 10);
        const sorted = sortActionsByPriority([a]);
        expect(sorted).toHaveLength(1);
        expect(sorted[0]).toEqual(a);
    });
});

describe('selectBestAction', () => {
    it('returns null for an empty candidate list', () => {
        expect(selectBestAction([])).toBeNull();
    });

    it('returns the highest-scored action', () => {
        const low = makeCandidateAction('u1', 'move', 3);
        const high = makeCandidateAction('u1', 'attack', 20);
        const mid = makeCandidateAction('u1', 'scan', 10);
        const result = selectBestAction([low, high, mid]);
        expect(result).toEqual(expect.objectContaining({ type: 'attack', score: 20 }));
    });

    it('returns higher-priority action when scores are tied', () => {
        const move = makeCandidateAction('u1', 'move', 10);       // priority 35
        const pickup = makeCandidateAction('u1', 'pickup_flag', 10); // priority 80
        const result = selectBestAction([move, pickup]);
        expect(result?.type).toBe('pickup_flag');
    });

    it('returns the single candidate when list has one element', () => {
        const a = makeCandidateAction('u1', 'teleport', 7);
        const result = selectBestAction([a]);
        expect(result).toEqual(a);
    });

    it('returns first element from sorted output', () => {
        const a = makeCandidateAction('u1', 'attack', 100);
        const b = makeCandidateAction('u1', 'move', 50);
        const c = makeCandidateAction('u1', 'end_turn', 1);
        const result = selectBestAction([c, b, a]);
        expect(result?.type).toBe('attack');
        expect(result?.score).toBe(100);
    });
});
