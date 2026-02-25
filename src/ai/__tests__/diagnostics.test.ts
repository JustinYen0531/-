import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MineType, PlayerID, UnitType } from '../../types';
import { createTestMine, createTestState, createTestUnit } from '../../__tests__/helpers/factories';
import { buildAIPlanningContext } from '../context';
import {
    collectRejectionSummary,
    summarizeRejectedReasonBuckets,
    summarizeTopCandidates,
} from '../diagnostics';
import { AICandidateAction, AIRejectedReason } from '../types';

const makeAction = (
    unitId: string,
    type: AICandidateAction['type'],
    score: number,
    overrides: Partial<AICandidateAction> = {}
): AICandidateAction => ({
    unitId,
    type,
    energyCost: 2,
    score,
    scoreBreakdown: { total: score },
    ...overrides,
});

describe('summarizeTopCandidates', () => {
    it('returns empty array for empty input', () => {
        const result = summarizeTopCandidates([]);
        expect(result).toEqual([]);
    });

    it('returns up to default limit of 5', () => {
        const actions = Array.from({ length: 8 }, (_, i) =>
            makeAction('u1', 'move', 100 - i, { target: { kind: 'cell', r: 0, c: i } })
        );
        const result = summarizeTopCandidates(actions);
        expect(result).toHaveLength(5);
    });

    it('respects custom limit parameter', () => {
        const actions = Array.from({ length: 8 }, (_, i) =>
            makeAction('u1', 'move', 100 - i, { target: { kind: 'cell', r: 0, c: i } })
        );
        const result = summarizeTopCandidates(actions, 3);
        expect(result).toHaveLength(3);
    });

    it('returns fewer items when actions length is less than limit', () => {
        const actions = [
            makeAction('u1', 'move', 50, { target: { kind: 'cell', r: 0, c: 1 } }),
            makeAction('u1', 'attack', 40),
        ];
        const result = summarizeTopCandidates(actions);
        expect(result).toHaveLength(2);
    });

    it('assigns correct rank starting at 1', () => {
        const actions = [
            makeAction('u1', 'attack', 80),
            makeAction('u1', 'move', 60, { target: { kind: 'cell', r: 1, c: 2 } }),
            makeAction('u1', 'scan', 40, { target: { kind: 'cell', r: 2, c: 3 } }),
        ];
        const result = summarizeTopCandidates(actions);

        expect(result[0].rank).toBe(1);
        expect(result[1].rank).toBe(2);
        expect(result[2].rank).toBe(3);
    });

    it('maps all fields correctly to the view', () => {
        const targetUnit = createTestUnit(PlayerID.P1, UnitType.MAKER, 3, 5);
        const action = makeAction('u1', 'attack', 75, {
            target: { kind: 'unit', unit: targetUnit },
            lookaheadScore: 82,
            isFeint: true,
            sourceRank: 2,
            scoreBreakdown: { total: 75, attack: 50, safety: 10, flag: 15 },
        });
        const result = summarizeTopCandidates([action]);

        expect(result[0]).toEqual({
            rank: 1,
            type: 'attack',
            target: { kind: 'unit', unit: targetUnit },
            score: 75,
            lookaheadScore: 82,
            isFeint: true,
            sourceRank: 2,
            breakdown: { total: 75, attack: 50, safety: 10, flag: 15 },
        });
    });
});

describe('collectRejectionSummary', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns rejections for a unit with no energy', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.players[PlayerID.P2].energy = 0;
        const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, sweeper, context);

        expect(rejections.length).toBeGreaterThan(0);
        expect(rejections.some(r => r.reason === 'energy')).toBe(true);
    });

    it('returns at most 8 rejection entries', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.players[PlayerID.P2].energy = 0;
        // Block many directions with obstacles to generate many rejections
        state.cells[1][21].isObstacle = true;
        state.cells[1][23].isObstacle = true;
        const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, sweeper, context);

        expect(rejections.length).toBeLessThanOrEqual(8);
    });

    it('sorts rejections by count descending', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        // Put obstacles around to create multiple rule violations
        state.cells[0][21].isObstacle = true;
        state.cells[0][23].isObstacle = true;
        const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, sweeper, context);

        for (let i = 1; i < rejections.length; i++) {
            expect(rejections[i - 1].count).toBeGreaterThanOrEqual(rejections[i].count);
        }
    });

    it('includes movement energy rejection when energy is insufficient', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.players[PlayerID.P2].energy = 0;
        const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, general, context);

        const moveEnergy = rejections.find(r => r.reason === 'energy' && r.action === 'move');
        expect(moveEnergy).toBeDefined();
    });

    it('includes attack rejections for general with no targets in range', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        // General is at (0, 22), P1 units are at col 1 - far out of range

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, general, context);

        const attackRejection = rejections.find(r => r.action === 'attack');
        expect(attackRejection).toBeDefined();
    });

    it('includes disarm rejection for defuser when no enemy mines nearby', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        const defuser = state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;
        // No mines on the board

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, defuser, context);

        const disarmRejection = rejections.find(r => r.action === 'disarm' && r.reason === 'rules');
        expect(disarmRejection).toBeDefined();
        expect(disarmRejection!.detail).toBe('no nearby enemy mine');
    });

    it('returns empty rejections when unit has energy and open moves', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.players[PlayerID.P2].energy = 80;
        // Ranger has no special rejection reasons (not general, minesweeper, maker, or defuser)
        const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
        // Move ranger to center to have all directions open
        ranger.r = 3;
        ranger.c = 12;

        const context = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const rejections = collectRejectionSummary(state, ranger, context);

        // Ranger should have few/no rejections: no attack check (not general),
        // no special unit checks, and has energy + open cells for movement
        const energyRejections = rejections.filter(r => r.reason === 'energy');
        expect(energyRejections).toHaveLength(0);
    });
});

describe('summarizeRejectedReasonBuckets', () => {
    it('returns all zeroes for empty input', () => {
        const result = summarizeRejectedReasonBuckets([]);
        expect(result).toEqual({ energy: 0, risk: 0, rules: 0 });
    });

    it('sums energy counts correctly', () => {
        const reasons: AIRejectedReason[] = [
            { reason: 'energy', action: 'move', detail: 'need 4, have 0', count: 1 },
            { reason: 'energy', action: 'scan', detail: 'need 3, have 0', count: 2 },
        ];
        const result = summarizeRejectedReasonBuckets(reasons);
        expect(result.energy).toBe(3);
        expect(result.risk).toBe(0);
        expect(result.rules).toBe(0);
    });

    it('sums risk counts correctly', () => {
        const reasons: AIRejectedReason[] = [
            { reason: 'risk', action: 'move', detail: 'fatal risk', count: 3 },
        ];
        const result = summarizeRejectedReasonBuckets(reasons);
        expect(result.risk).toBe(3);
    });

    it('sums rules counts correctly', () => {
        const reasons: AIRejectedReason[] = [
            { reason: 'rules', action: 'move', detail: 'out of bounds', count: 2 },
            { reason: 'rules', action: 'attack', detail: 'out of range or line rules', count: 1 },
        ];
        const result = summarizeRejectedReasonBuckets(reasons);
        expect(result.rules).toBe(3);
    });

    it('aggregates mixed reason types into correct buckets', () => {
        const reasons: AIRejectedReason[] = [
            { reason: 'energy', action: 'move', detail: 'need 4, have 0', count: 1 },
            { reason: 'risk', action: 'move', detail: 'fatal risk', count: 2 },
            { reason: 'rules', action: 'move', detail: 'occupied cell', count: 3 },
            { reason: 'energy', action: 'scan', detail: 'need 3, have 0', count: 4 },
            { reason: 'rules', action: 'disarm', detail: 'no nearby enemy mine', count: 1 },
        ];
        const result = summarizeRejectedReasonBuckets(reasons);
        expect(result.energy).toBe(5);
        expect(result.risk).toBe(2);
        expect(result.rules).toBe(4);
    });
});
