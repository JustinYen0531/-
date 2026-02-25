import { describe, it, expect, vi } from 'vitest';
import { createInitialOpponentModel, updateOpponentModel } from '../opponentModel';
import { createTestState, createTestMine } from '../../__tests__/helpers/factories';
import { MineType, PlayerID, UnitType } from '../../types';

describe('createInitialOpponentModel', () => {
    it('returns aggression = 0', () => {
        const model = createInitialOpponentModel();
        expect(model.aggression).toBe(0);
    });

    it('returns flagRush = 0', () => {
        const model = createInitialOpponentModel();
        expect(model.flagRush).toBe(0);
    });

    it('returns minePressure = 0', () => {
        const model = createInitialOpponentModel();
        expect(model.minePressure).toBe(0);
    });

    it('returns empty hotspots', () => {
        const model = createInitialOpponentModel();
        expect(model.hotspots).toEqual({});
    });

    it('returns samples = 0', () => {
        const model = createInitialOpponentModel();
        expect(model.samples).toBe(0);
    });
});

describe('updateOpponentModel', () => {
    it('returns prevModel unchanged when prevState is null', () => {
        const model = createInitialOpponentModel();
        const nextState = createTestState();
        const result = updateOpponentModel(model, null, nextState);
        expect(result).toBe(model);
    });

    it('increments samples by 1', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        expect(result.samples).toBe(1);
    });

    it('decays existing aggression by 0.8', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        const model = { ...createInitialOpponentModel(), aggression: 5 };
        const result = updateOpponentModel(model, prevState, nextState);
        // No HP loss or kills: result = 5 * 0.8 + 0 = 4.0
        expect(result.aggression).toBeCloseTo(4.0, 5);
    });

    it('increases aggression by 0.08 per HP loss on AI units', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Default aiPlayer is P2, so AI units are P2 units
        // Inflict 10 HP damage on the P2 General
        const p2General = nextState.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.hp = p2General.maxHp - 10;
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // aggression = 0 * 0.8 + 10 * 0.08 = 0.8
        expect(result.aggression).toBeCloseTo(0.8, 5);
    });

    it('increases aggression by 1.5 per killed AI unit', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Kill P2 General in nextState
        const p2General = nextState.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        p2General.isDead = true;
        p2General.hp = 0;
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // HP loss = maxHp (28), kill = 1
        // aggression = 0 * 0.8 + 28 * 0.08 + 1 * 1.5 = 2.24 + 1.5 = 3.74
        expect(result.aggression).toBeCloseTo(3.74, 5);
    });

    it('increases flagRush when enemy moves toward AI flag', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // aiPlayer defaults to P2, so enemy is P1
        // AI flag is P2 flag position
        const aiFlag = nextState.players[PlayerID.P2].flagPosition;
        // Move P1 General closer to P2 flag in nextState
        const p1GenPrev = prevState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const p1GenNext = nextState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        // prev position: far from flag
        p1GenPrev.r = 3;
        p1GenPrev.c = 10;
        // next position: closer to flag
        p1GenNext.r = 3;
        p1GenNext.c = 11;
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // 1 unit moved closer: flagRush = 0 * 0.8 + 1 * 0.9 = 0.9
        expect(result.flagRush).toBeCloseTo(0.9, 5);
    });

    it('adds 1.7 to flagRush when enemy has flag carrier', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Make a P1 unit carry the flag
        const p1Ranger = nextState.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        p1Ranger.hasFlag = true;
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // flagRush = 0 * 0.8 + 0 * 0.9 (no unit moved closer) + 1.7 = 1.7
        expect(result.flagRush).toBeCloseTo(1.7, 5);
    });

    it('increases minePressure by 1.4 per new enemy mine', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Enemy is P1 (since aiPlayer defaults to P2)
        // Add 2 mines owned by P1 in nextState
        nextState.mines = [
            createTestMine(PlayerID.P1, MineType.NORMAL, 3, 10),
            createTestMine(PlayerID.P1, MineType.SLOW, 4, 12),
        ];
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // minePressure = 0 * 0.8 + 2 * 1.4 = 2.8
        expect(result.minePressure).toBeCloseTo(2.8, 5);
    });

    it('adds hotspot entries for enemy unit positions', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Enemy is P1 (aiPlayer defaults to P2)
        // P1 General is at row=0, col=1 by default
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        // Each non-flag-carrying enemy unit adds 1.2 at their position
        const p1General = nextState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const key = `${p1General.r},${p1General.c}`;
        expect(result.hotspots[key]).toBeCloseTo(1.2, 5);
    });

    it('adds 2.4 hotspot weight for flag-carrying enemy units', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        const p1Ranger = nextState.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        p1Ranger.hasFlag = true;
        const model = createInitialOpponentModel();
        const result = updateOpponentModel(model, prevState, nextState);
        const key = `${p1Ranger.r},${p1Ranger.c}`;
        expect(result.hotspots[key]).toBeCloseTo(2.4, 5);
    });

    it('decays existing hotspot values by 0.86 and filters below 0.35', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Create a model with a pre-existing hotspot that will decay below threshold
        const model = {
            ...createInitialOpponentModel(),
            hotspots: {
                '6,6': 0.4,   // 0.4 * 0.86 = 0.344 < 0.35 -> filtered out
                '5,5': 1.0,   // 1.0 * 0.86 = 0.86 >= 0.35 -> kept
            },
        };
        const result = updateOpponentModel(model, prevState, nextState);
        expect(result.hotspots['6,6']).toBeUndefined();
        expect(result.hotspots['5,5']).toBeCloseTo(0.86, 5);
    });

    it('clamps hotspot values to a maximum of 12', () => {
        const prevState = createTestState();
        const nextState = createTestState();
        // Place a P1 unit at a hotspot that's already near max
        const p1General = nextState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        p1General.r = 3;
        p1General.c = 5;
        // Also update prevState so the unit exists in both
        const p1GenPrev = prevState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        p1GenPrev.r = 3;
        p1GenPrev.c = 5;

        const model = {
            ...createInitialOpponentModel(),
            hotspots: { '3,5': 11.5 },
        };
        const result = updateOpponentModel(model, prevState, nextState);
        // 11.5 * 0.86 = 9.89 + 1.2 = 11.09 (still under 12)
        // But if we push it higher:
        const model2 = {
            ...createInitialOpponentModel(),
            hotspots: { '3,5': 12 },
        };
        const result2 = updateOpponentModel(model2, prevState, nextState);
        // 12 * 0.86 = 10.32 + 1.2 = 11.52, clamped to 12? No, 11.52 < 12
        // Let's use hasFlag to get +2.4
        p1General.hasFlag = true;
        const model3 = {
            ...createInitialOpponentModel(),
            hotspots: { '3,5': 12 },
        };
        const result3 = updateOpponentModel(model3, prevState, nextState);
        // 12 * 0.86 = 10.32 + 2.4 = 12.72, clamped to 12
        expect(result3.hotspots['3,5']).toBe(12);
    });
});
