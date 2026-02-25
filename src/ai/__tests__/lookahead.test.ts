import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerID, UnitType } from '../../types';
import { createTestState } from '../../__tests__/helpers/factories';
import { rerankActionsWithBeamLookahead } from '../lookahead';
import { AICandidateAction, AIDifficulty } from '../types';

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

describe('rerankActionsWithBeamLookahead', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns empty array when given empty actions', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        const result = rerankActionsWithBeamLookahead(state, [], 'hard', PlayerID.P2);
        expect(result).toEqual([]);
    });

    it('returns single action unchanged', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        const action = makeAction('P2-general', 'move', 10, {
            target: { kind: 'cell', r: 0, c: 21 },
        });
        const result = rerankActionsWithBeamLookahead(state, [action], 'hard', PlayerID.P2);
        expect(result).toHaveLength(1);
        expect(result[0].score).toBe(10);
    });

    it('returns actions unchanged for easy difficulty (beam count <= 1)', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        const actions = [
            makeAction('P2-general', 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction('P2-general', 'move', 10, { target: { kind: 'cell', r: 1, c: 22 } }),
        ];
        const result = rerankActionsWithBeamLookahead(state, actions, 'easy', PlayerID.P2);
        expect(result).toEqual(actions);
    });

    it('assigns lookaheadScore to top-N actions for normal difficulty', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 12, { target: { kind: 'cell', r: 1, c: 22 } }),
            makeAction(p2General.id, 'end_turn', 5),
        ];

        const result = rerankActionsWithBeamLookahead(state, actions, 'normal', PlayerID.P2);
        // Normal beam count is 2, so top 2 should get lookaheadScore
        expect(result[0].lookaheadScore).toBeDefined();
        expect(result[1].lookaheadScore).toBeDefined();
    });

    it('does not assign lookaheadScore to actions beyond beam width', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        // normal beam = 2, so 3rd action should not get lookaheadScore
        const actions = [
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 12, { target: { kind: 'cell', r: 1, c: 22 } }),
            makeAction(p2General.id, 'end_turn', 5),
        ];

        const result = rerankActionsWithBeamLookahead(state, actions, 'normal', PlayerID.P2);
        const thirdAction = result.find(a => a.type === 'end_turn');
        expect(thirdAction?.lookaheadScore).toBeUndefined();
    });

    it('preserves all actions in the output', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 1, c: 22 } }),
            makeAction(p2General.id, 'end_turn', 5),
            makeAction(p2General.id, 'move', 3, { target: { kind: 'cell', r: 0, c: 23 } }),
            makeAction(p2General.id, 'end_turn', 1),
        ];

        const result = rerankActionsWithBeamLookahead(state, actions, 'hard', PlayerID.P2);
        expect(result).toHaveLength(5);
    });

    it('returns sorted by lookaheadScore (or score as fallback)', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 1, c: 22 } }),
        ];

        const result = rerankActionsWithBeamLookahead(state, actions, 'normal', PlayerID.P2);
        const firstScore = result[0].lookaheadScore ?? result[0].score;
        const secondScore = result[1].lookaheadScore ?? result[1].score;
        expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    });

    it('uses hard difficulty beam width of 4', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 18, { target: { kind: 'cell', r: 1, c: 22 } }),
            makeAction(p2General.id, 'move', 16, { target: { kind: 'cell', r: 0, c: 23 } }),
            makeAction(p2General.id, 'move', 14, { target: { kind: 'cell', r: 1, c: 21 } }),
            makeAction(p2General.id, 'end_turn', 2),
        ];

        const result = rerankActionsWithBeamLookahead(state, actions, 'hard', PlayerID.P2);
        // Top 4 should have lookaheadScore, 5th should not
        const withLookahead = result.filter(a => a.lookaheadScore !== undefined);
        expect(withLookahead.length).toBe(4);
    });

    it('defaults to P2 as aiPlayer when not specified', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 1, c: 22 } }),
        ];

        // Should not throw when aiPlayer is not provided (defaults to P2)
        const result = rerankActionsWithBeamLookahead(state, actions, 'normal');
        expect(result).toHaveLength(2);
    });

    it('applies tuning profile to lookahead weights', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.gameMode = 'pve';
        state.turnCount = 4;
        state.players[PlayerID.P2].energy = 80;
        state.players[PlayerID.P1].energy = 80;

        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const actions = [
            makeAction(p2General.id, 'move', 20, { target: { kind: 'cell', r: 0, c: 21 } }),
            makeAction(p2General.id, 'move', 15, { target: { kind: 'cell', r: 1, c: 22 } }),
        ];

        const aggressive = rerankActionsWithBeamLookahead(state, actions, 'hard', PlayerID.P2, 'aggressive');
        const conservative = rerankActionsWithBeamLookahead(state, actions, 'hard', PlayerID.P2, 'conservative');

        // Both should produce valid results with lookahead scores
        expect(aggressive[0].lookaheadScore).toBeDefined();
        expect(conservative[0].lookaheadScore).toBeDefined();
        // Different profiles should produce different lookahead scores
        expect(aggressive[0].lookaheadScore).not.toBe(conservative[0].lookaheadScore);
    });
});
