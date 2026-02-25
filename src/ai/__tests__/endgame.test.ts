import { describe, it, expect, vi } from 'vitest';
import { evaluateEndgameState } from '../endgame';
import { createTestState } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';

const P1_FLAG_POS = { r: 3, c: 0 };
const P2_FLAG_POS = { r: 3, c: 23 };

describe('evaluateEndgameState', () => {
    it('returns non-endgame state for a fresh game with all units alive', () => {
        const state = createTestState('pvp');
        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(false);
        expect(result.mode).toBe('none');
        expect(result.urgency).toBe(0);
    });

    it('defaults aiPlayer to P2 when not specified', () => {
        const state = createTestState('pvp');
        const result = evaluateEndgameState(state);
        expect(result.isEndgame).toBe(false);
        expect(result.ownAlive).toBe(state.players[PlayerID.P2].units.filter(u => !u.isDead).length);
    });

    it('counts alive units correctly', () => {
        const state = createTestState('pvp');
        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.ownAlive).toBe(5);
        expect(result.enemyAlive).toBe(5);
    });

    // --- Low population trigger ---
    it('triggers endgame when total alive units <= 5', () => {
        const state = createTestState('pvp');
        // Kill 4 P1 units and 2 P2 units => 1 + 3 = 4 alive total
        const p1Units = state.players[PlayerID.P1].units;
        p1Units[1].isDead = true;
        p1Units[2].isDead = true;
        p1Units[3].isDead = true;
        p1Units[4].isDead = true;
        const p2Units = state.players[PlayerID.P2].units;
        p2Units[3].isDead = true;
        p2Units[4].isDead = true;

        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
        expect(result.ownAlive).toBe(3);
        expect(result.enemyAlive).toBe(1);
    });

    // --- Late turn trigger ---
    it('triggers endgame when turnCount >= 18', () => {
        const state = createTestState('pvp');
        state.turnCount = 18;
        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
    });

    it('does not trigger endgame at turn 17 with full units', () => {
        const state = createTestState('pvp');
        state.turnCount = 17;
        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(false);
    });

    // --- Flag carrier triggers ---
    it('triggers race mode when own flag carrier exists', () => {
        const state = createTestState('pvp');
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.hasFlag = true;
        p2General.r = 3;
        p2General.c = 10;

        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
        expect(result.mode).toBe('race');
        expect(result.urgency).toBeGreaterThanOrEqual(1);
    });

    it('triggers defense mode when enemy flag carrier exists', () => {
        const state = createTestState('pvp');
        const p1Ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        p1Ranger.hasFlag = true;
        p1Ranger.r = 3;
        p1Ranger.c = 15;

        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
        expect(result.mode).toBe('defense');
        expect(result.urgency).toBeGreaterThanOrEqual(1);
    });

    it('prioritizes race over defense when both carriers exist', () => {
        const state = createTestState('pvp');
        // Own carrier
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.hasFlag = true;
        p2General.r = 3;
        p2General.c = 5;
        // Enemy carrier
        const p1Ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        p1Ranger.hasFlag = true;
        p1Ranger.r = 3;
        p1Ranger.c = 18;

        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
        expect(result.mode).toBe('race');
    });

    // --- Attrition mode ---
    it('triggers attrition mode in late game without flag carriers', () => {
        const state = createTestState('pvp');
        state.turnCount = 22;

        const result = evaluateEndgameState(state, PlayerID.P2);
        expect(result.isEndgame).toBe(true);
        expect(result.mode).toBe('attrition');
        expect(result.urgency).toBeGreaterThan(0);
    });

    // --- Urgency calculations ---
    it('race urgency increases when carrier is closer to enemy flag', () => {
        const state = createTestState('pvp');
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.hasFlag = true;

        // Far from P1 flag
        p2General.r = 3;
        p2General.c = 20;
        const farResult = evaluateEndgameState(state, PlayerID.P2);

        // Close to P1 flag
        p2General.r = 3;
        p2General.c = 2;
        const closeResult = evaluateEndgameState(state, PlayerID.P2);

        expect(closeResult.urgency).toBeGreaterThan(farResult.urgency);
    });

    it('defense urgency increases when enemy carrier is closer to own flag', () => {
        const state = createTestState('pvp');
        const p1Ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        p1Ranger.hasFlag = true;

        // Far from P2 flag
        p1Ranger.r = 3;
        p1Ranger.c = 5;
        const farResult = evaluateEndgameState(state, PlayerID.P2);

        // Close to P2 flag
        p1Ranger.r = 3;
        p1Ranger.c = 21;
        const closeResult = evaluateEndgameState(state, PlayerID.P2);

        expect(closeResult.urgency).toBeGreaterThan(farResult.urgency);
    });

    it('urgency is clamped within expected bounds', () => {
        const state = createTestState('pvp');
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.hasFlag = true;
        p2General.r = P1_FLAG_POS.r;
        p2General.c = P1_FLAG_POS.c;

        const result = evaluateEndgameState(state, PlayerID.P2);
        // Race mode urgency is clamped to [1, 4.2]
        expect(result.urgency).toBeGreaterThanOrEqual(1);
        expect(result.urgency).toBeLessThanOrEqual(4.2);
    });
});
