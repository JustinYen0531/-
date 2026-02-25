import { describe, it, expect, vi } from 'vitest';
import { deriveAIIntent, buildThreatMap, calculateReserveEnergy, buildAIPlanningContext } from '../context';
import { createInitialOpponentModel } from '../opponentModel';
import { createTestState, createTestMine } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType, MineType } from '../../types';
import { AIOpponentModel } from '../types';

const makeOpponentModel = (overrides: Partial<AIOpponentModel> = {}): AIOpponentModel => ({
    ...createInitialOpponentModel(),
    ...overrides,
});

describe('deriveAIIntent', () => {
    it('returns hunt_flag_carrier when an enemy unit has the flag', () => {
        const state = createTestState();
        const enemyRanger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        enemyRanger.hasFlag = true;

        expect(deriveAIIntent(state)).toBe('hunt_flag_carrier');
    });

    it('returns push_flag when own unit has the flag', () => {
        const state = createTestState();
        const ownGeneral = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        ownGeneral.hasFlag = true;

        expect(deriveAIIntent(state)).toBe('push_flag');
    });

    it('hunt_flag_carrier takes priority over push_flag when both sides carry', () => {
        const state = createTestState();
        const enemyRanger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        enemyRanger.hasFlag = true;
        const ownGeneral = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        ownGeneral.hasFlag = true;

        expect(deriveAIIntent(state)).toBe('hunt_flag_carrier');
    });

    it('returns control_mines when enemy mine is within manhattan distance 2 of own unit', () => {
        const state = createTestState();
        // P2 general is at r=0, c=22. Place enemy mine at r=0, c=21 (dist=1)
        state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 0, 21));

        expect(deriveAIIntent(state)).toBe('control_mines');
    });

    it('returns control_mines when opponent model mine pressure >= 4.5', () => {
        const state = createTestState();
        const model = makeOpponentModel({ minePressure: 4.5 });

        expect(deriveAIIntent(state, PlayerID.P2, model)).toBe('control_mines');
    });

    it('returns stabilize when 2+ own units are fragile (hp/maxHp <= 0.45)', () => {
        const state = createTestState();
        const p2Units = state.players[PlayerID.P2].units;
        // Make two units fragile
        p2Units[0].hp = Math.floor(p2Units[0].maxHp * 0.4);
        p2Units[1].hp = Math.floor(p2Units[1].maxHp * 0.4);

        expect(deriveAIIntent(state)).toBe('stabilize');
    });

    it('returns stabilize when own energy <= 12', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 12;

        expect(deriveAIIntent(state)).toBe('stabilize');
    });

    it('returns stabilize when opponent aggression >= 5.5', () => {
        const state = createTestState();
        const model = makeOpponentModel({ aggression: 5.5 });

        expect(deriveAIIntent(state, PlayerID.P2, model)).toBe('stabilize');
    });

    it('returns hunt_flag_carrier when opponent flagRush >= 5.2 and no other triggers', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 50; // ensure not stabilize
        const model = makeOpponentModel({ flagRush: 5.2 });

        expect(deriveAIIntent(state, PlayerID.P2, model)).toBe('hunt_flag_carrier');
    });

    it('returns push_flag as default when no special conditions apply', () => {
        const state = createTestState();
        expect(deriveAIIntent(state)).toBe('push_flag');
    });

    it('respects aiPlayer parameter for P1', () => {
        const state = createTestState();
        // Give P2 unit the flag - this is "enemy" from P1's perspective
        const p2Ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
        p2Ranger.hasFlag = true;

        expect(deriveAIIntent(state, PlayerID.P1)).toBe('hunt_flag_carrier');
    });
});

describe('buildThreatMap', () => {
    it('returns a 7x24 grid of numbers', () => {
        const state = createTestState();
        const map = buildThreatMap(state);

        expect(map.length).toBe(7);
        expect(map[0].length).toBe(24);
    });

    it('marks obstacle cells as 999', () => {
        const state = createTestState();
        state.cells[2][5].isObstacle = true;

        const map = buildThreatMap(state);
        expect(map[2][5]).toBe(999);
    });

    it('adds +90 risk on cells with direct enemy mine', () => {
        const state = createTestState();
        state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 10));

        const map = buildThreatMap(state);
        // At (3,10) should include 90 for direct mine
        expect(map[3][10]).toBeGreaterThanOrEqual(90);
    });

    it('adds +65 risk for nuke mine proximity (within 1 cell chebyshev)', () => {
        const state = createTestState();
        state.mines.push(createTestMine(PlayerID.P1, MineType.NUKE, 3, 10));

        const map = buildThreatMap(state);
        // Adjacent cell diagonally should get nuke proximity bonus
        expect(map[2][9]).toBeGreaterThanOrEqual(65);
        // The mine cell itself gets both direct (90) + nuke proximity (65)
        expect(map[3][10]).toBeGreaterThanOrEqual(155);
    });

    it('adds +9 risk for enemy units at manhattan distance 1', () => {
        const state = createTestState();
        // P1 general is at r=0, c=1. Cell r=0, c=2 is distance 1
        const map = buildThreatMap(state);
        // r=0, c=2 should have at least 9 from the adjacent P1 general
        expect(map[0][2]).toBeGreaterThanOrEqual(9);
    });

    it('adds +4 risk for enemy units at manhattan distance 2', () => {
        const state = createTestState();
        // P1 general at r=0, c=1. Cell r=0, c=3 is distance 2
        const map = buildThreatMap(state);
        expect(map[0][3]).toBeGreaterThanOrEqual(4);
    });

    it('scales risk by 1.15 on hard difficulty', () => {
        const state = createTestState();
        state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 10));

        const normalMap = buildThreatMap(state, PlayerID.P2, 'normal');
        const hardMap = buildThreatMap(state, PlayerID.P2, 'hard');

        // Hard should be scaled by 1.15 vs normal's 1.0
        expect(hardMap[3][10]).toBeCloseTo(normalMap[3][10] * 1.15, 0);
    });

    it('scales risk by 0.9 on easy difficulty', () => {
        const state = createTestState();
        state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 10));

        const normalMap = buildThreatMap(state, PlayerID.P2, 'normal');
        const easyMap = buildThreatMap(state, PlayerID.P2, 'easy');

        expect(easyMap[3][10]).toBeCloseTo(normalMap[3][10] * 0.9, 0);
    });
});

describe('calculateReserveEnergy', () => {
    it('uses difficulty base from config (easy=4, normal=6, hard=8)', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 100;

        const easyReserve = calculateReserveEnergy(state, 'push_flag', 'easy');
        const normalReserve = calculateReserveEnergy(state, 'push_flag', 'normal');
        const hardReserve = calculateReserveEnergy(state, 'push_flag', 'hard');

        // push_flag adds +1 to base
        expect(easyReserve).toBe(5);    // 4 + 1
        expect(normalReserve).toBe(7);  // 6 + 1
        expect(hardReserve).toBe(9);    // 8 + 1
    });

    it('adds +2 for hunt_flag_carrier intent', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 100;

        const reserve = calculateReserveEnergy(state, 'hunt_flag_carrier', 'normal');
        expect(reserve).toBe(8); // 6 + 2
    });

    it('adds +2 for stabilize intent', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 100;

        const reserve = calculateReserveEnergy(state, 'stabilize', 'normal');
        expect(reserve).toBe(8); // 6 + 2
    });

    it('adds +1 for control_mines intent', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 100;

        const reserve = calculateReserveEnergy(state, 'control_mines', 'normal');
        expect(reserve).toBe(7); // 6 + 1
    });

    it('caps reserve at 55% of current energy', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 10;

        const reserve = calculateReserveEnergy(state, 'hunt_flag_carrier', 'hard');
        // hard base=8 + hunt=2 = 10, but cap = floor(10 * 0.55) = 5
        expect(reserve).toBe(5);
    });

    it('returns 0 when energy is 0', () => {
        const state = createTestState();
        state.players[PlayerID.P2].energy = 0;

        const reserve = calculateReserveEnergy(state, 'push_flag', 'normal');
        expect(reserve).toBe(0);
    });
});

describe('buildAIPlanningContext', () => {
    it('returns all expected properties', () => {
        const state = createTestState();
        const ctx = buildAIPlanningContext(state, 'normal');

        expect(ctx).toHaveProperty('intent');
        expect(ctx).toHaveProperty('threatMap');
        expect(ctx).toHaveProperty('reserveEnergy');
        expect(ctx).toHaveProperty('unitRoles');
        expect(ctx).toHaveProperty('opponentModel');
        expect(ctx).toHaveProperty('hotspotCells');
        expect(ctx).toHaveProperty('opening');
        expect(ctx).toHaveProperty('endgame');
    });

    it('sets opening.isOpening=true for early turns without flag carriers or endgame', () => {
        const state = createTestState();
        state.turnCount = 3;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.opening.isOpening).toBe(true);
        expect(ctx.opening.plan).not.toBeNull();
    });

    it('sets opening.isOpening=false when turnCount > 6', () => {
        const state = createTestState();
        state.turnCount = 7;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.opening.isOpening).toBe(false);
        expect(ctx.opening.plan).toBeNull();
    });

    it('sets opening.isOpening=false when a flag carrier exists', () => {
        const state = createTestState();
        state.turnCount = 2;
        state.players[PlayerID.P2].units[0].hasFlag = true;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.opening.isOpening).toBe(false);
    });

    it('calculates opening weight that decreases as turn count increases', () => {
        const state1 = createTestState();
        state1.turnCount = 1;
        const ctx1 = buildAIPlanningContext(state1, 'normal');

        const state3 = createTestState();
        state3.turnCount = 5;
        const ctx3 = buildAIPlanningContext(state3, 'normal');

        expect(ctx1.opening.weight).toBeGreaterThan(ctx3.opening.weight);
    });

    it('opening weight is 0 when not in opening phase', () => {
        const state = createTestState();
        state.turnCount = 10;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.opening.weight).toBe(0);
    });

    it('uses provided openingPlan when given', () => {
        const state = createTestState();
        state.turnCount = 2;

        const ctx = buildAIPlanningContext(state, 'normal', PlayerID.P2, createInitialOpponentModel(), 'flag_spear');
        expect(ctx.opening.plan).toBe('flag_spear');
    });

    it('hotspotCells are derived from opponent model and sorted by weight descending', () => {
        const state = createTestState();
        const model = makeOpponentModel({
            hotspots: { '1,2': 3.5, '3,4': 7.0, '5,6': 1.2 },
        });

        const ctx = buildAIPlanningContext(state, 'normal', PlayerID.P2, model);
        expect(ctx.hotspotCells.length).toBe(3);
        expect(ctx.hotspotCells[0].weight).toBe(7.0);
        expect(ctx.hotspotCells[0].r).toBe(3);
        expect(ctx.hotspotCells[0].c).toBe(4);
    });

    it('hotspotCells are capped at 8 entries', () => {
        const state = createTestState();
        const hotspots: Record<string, number> = {};
        for (let i = 0; i < 12; i++) {
            hotspots[`${i % 7},${i}`] = i + 1;
        }
        const model = makeOpponentModel({ hotspots });

        const ctx = buildAIPlanningContext(state, 'normal', PlayerID.P2, model);
        expect(ctx.hotspotCells.length).toBe(8);
    });

    it('endgame.isEndgame is true in late turns', () => {
        const state = createTestState();
        state.turnCount = 20;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.endgame.isEndgame).toBe(true);
        expect(ctx.endgame.mode).toBe('attrition');
    });

    it('endgame.isEndgame is false in early game with all units alive', () => {
        const state = createTestState();
        state.turnCount = 2;

        const ctx = buildAIPlanningContext(state, 'normal');
        expect(ctx.endgame.isEndgame).toBe(false);
        expect(ctx.endgame.mode).toBe('none');
    });
});
