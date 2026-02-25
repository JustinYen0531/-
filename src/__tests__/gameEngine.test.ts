import { describe, it, expect } from 'vitest';
import {
    calculateAttackDamage,
    calculateEnergyIncome,
    applyFlagAuraDamageReduction,
    calculateOreReward,
    shouldTriggerMine,
    calculateMineInteraction,
    checkEnergyCap,
    updateQuestStats,
} from '../gameEngine';
import {
    createTestState,
    createTestUnit,
    createTestMine,
    setEvolution,
} from './helpers/factories';
import { PlayerID, UnitType, MineType, QuestStats } from '../types';
import {
    MINE_DAMAGE,
    P1_FLAG_POS,
    P2_FLAG_POS,
} from '../constants';

// ---------------------------------------------------------------------------
// 1. calculateAttackDamage
// ---------------------------------------------------------------------------
describe('calculateAttackDamage', () => {
    it('returns base damage of 4 (General attackDmg) with no modifiers', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2]);
        expect(result.damage).toBe(4);
        expect(result.logKey).toBeUndefined();
    });

    it('applies flag aura reduction when genLevelB >= 2 and target near flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 2);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        // Place target within Chebyshev distance 2 of P2 flag (r:3, c:23)
        const target = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2]);
        expect(result.damage).toBe(Math.floor(4 * 0.75)); // 3
        expect(result.logKey).toBe('log_evol_gen_b_dmg_reduce');
    });

    it('does NOT apply flag aura when genLevelB < 2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 1);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const target = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 23); // right on the flag
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2]);
        expect(result.damage).toBe(4);
        expect(result.logKey).toBeUndefined();
    });

    it('does NOT apply flag aura when target is far from flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 2);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const target = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 12); // middle of board
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2]);
        expect(result.damage).toBe(4);
    });

    it('sets damage to 0 in god mode', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2], true);
        expect(result.damage).toBe(0);
    });

    it('god mode overrides flag aura reduction (damage still 0)', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 2);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const target = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 23);
        const result = calculateAttackDamage(attacker, target, state.players[PlayerID.P1], state.players[PlayerID.P2], true);
        expect(result.damage).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 2. calculateEnergyIncome
// ---------------------------------------------------------------------------
describe('calculateEnergyIncome', () => {
    it('uses base regen 35 for turns < 4', () => {
        const result = calculateEnergyIncome(0, 1, 0, 0);
        expect(result).toBe(0 + 35 + 0 + 0 + 0); // energy + regen + interest + ore + kill
    });

    it('uses regen 40 for turns 4-7', () => {
        const result = calculateEnergyIncome(0, 4, 0, 0);
        expect(result).toBe(40);
    });

    it('uses regen 45 for turns 8-11', () => {
        const result = calculateEnergyIncome(0, 8, 0, 0);
        expect(result).toBe(45);
    });

    it('uses regen 50 for turns >= 12', () => {
        const result = calculateEnergyIncome(0, 12, 0, 0);
        expect(result).toBe(50);
    });

    it('calculates interest as floor(currentEnergy / 10), capped at MAX_INTEREST', () => {
        // 100 energy -> interest = min(10, 10) = 10
        const result = calculateEnergyIncome(100, 1, 0, 0);
        expect(result).toBe(100 + 35 + 10);
    });

    it('caps interest at MAX_INTEREST (10) for very high energy', () => {
        // 200 energy -> interest = min(20, 10) = 10
        const result = calculateEnergyIncome(200, 1, 0, 0);
        expect(result).toBe(200 + 35 + 10);
    });

    it('interest is 0 when energy < 10', () => {
        const result = calculateEnergyIncome(5, 1, 0, 0);
        expect(result).toBe(5 + 35 + 0);
    });

    it('adds ore income', () => {
        const result = calculateEnergyIncome(50, 1, 7, 0);
        expect(result).toBe(50 + 35 + 5 + 7); // interest = floor(50/10) = 5
    });

    it('adds kill income', () => {
        const result = calculateEnergyIncome(50, 1, 0, 10);
        expect(result).toBe(50 + 35 + 5 + 10);
    });

    it('combines all sources correctly', () => {
        // energy=80, turn=10 (regen 45), ore=5, kill=3
        // interest = min(floor(80/10), 10) = 8
        const result = calculateEnergyIncome(80, 10, 5, 3);
        expect(result).toBe(80 + 45 + 8 + 5 + 3);
    });

    it('handles edge case turnCount exactly 7 (still regen 40)', () => {
        const result = calculateEnergyIncome(0, 7, 0, 0);
        expect(result).toBe(40);
    });

    it('handles edge case turnCount exactly 11 (still regen 45)', () => {
        const result = calculateEnergyIncome(0, 11, 0, 0);
        expect(result).toBe(45);
    });
});

// ---------------------------------------------------------------------------
// 3. applyFlagAuraDamageReduction
// ---------------------------------------------------------------------------
describe('applyFlagAuraDamageReduction', () => {
    it('does not reduce when genLevelB < 2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 1);
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, P1_FLAG_POS.r, P1_FLAG_POS.c);
        const result = applyFlagAuraDamageReduction(10, target, state.players[PlayerID.P1]);
        expect(result.damage).toBe(10);
        expect(result.reduced).toBe(false);
    });

    it('reduces by 25% when genLevelB = 2 and unit on flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 2);
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, P1_FLAG_POS.r, P1_FLAG_POS.c);
        const result = applyFlagAuraDamageReduction(10, target, state.players[PlayerID.P1]);
        expect(result.damage).toBe(7); // floor(10 * 0.75)
        expect(result.reduced).toBe(true);
    });

    it('reduces at Chebyshev distance exactly 2 from flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 2);
        // P1 flag at (3,0); placing unit at (1,2) -> Chebyshev = max(|1-3|, |2-0|) = max(2,2) = 2
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, 1, 2);
        const result = applyFlagAuraDamageReduction(8, target, state.players[PlayerID.P1]);
        expect(result.damage).toBe(6); // floor(8 * 0.75)
        expect(result.reduced).toBe(true);
    });

    it('does NOT reduce at Chebyshev distance 3 from flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 2);
        // P1 flag at (3,0); unit at (0,0) -> Chebyshev = max(3,0) = 3
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0);
        const result = applyFlagAuraDamageReduction(8, target, state.players[PlayerID.P1]);
        expect(result.damage).toBe(8);
        expect(result.reduced).toBe(false);
    });

    it('uses atPos override instead of unit position when provided', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 2);
        // Unit far away but atPos on the flag
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 12);
        const result = applyFlagAuraDamageReduction(8, target, state.players[PlayerID.P1], { r: P1_FLAG_POS.r, c: P1_FLAG_POS.c });
        expect(result.damage).toBe(6);
        expect(result.reduced).toBe(true);
    });

    it('does NOT reduce when atPos is far even if unit is near flag', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 2);
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, P1_FLAG_POS.r, P1_FLAG_POS.c);
        const result = applyFlagAuraDamageReduction(8, target, state.players[PlayerID.P1], { r: 0, c: 12 });
        expect(result.damage).toBe(8);
        expect(result.reduced).toBe(false);
    });

    it('floors the reduced damage (odd damage)', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 3);
        const target = createTestUnit(PlayerID.P1, UnitType.GENERAL, P1_FLAG_POS.r, P1_FLAG_POS.c);
        // 5 * 0.75 = 3.75 -> floor = 3
        const result = applyFlagAuraDamageReduction(5, target, state.players[PlayerID.P1]);
        expect(result.damage).toBe(3);
    });

    it('works for P2 flag position', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 2);
        const target = createTestUnit(PlayerID.P2, UnitType.GENERAL, P2_FLAG_POS.r, P2_FLAG_POS.c);
        const result = applyFlagAuraDamageReduction(12, target, state.players[PlayerID.P2]);
        expect(result.damage).toBe(9); // floor(12 * 0.75)
        expect(result.reduced).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 4. calculateOreReward
// ---------------------------------------------------------------------------
describe('calculateOreReward', () => {
    it('returns base value for small ore (turn < 4)', () => {
        expect(calculateOreReward('small', 1)).toBe(4);
    });

    it('returns base value for medium ore (turn < 4)', () => {
        expect(calculateOreReward('medium', 1)).toBe(7);
    });

    it('returns base value for large ore (turn < 4)', () => {
        expect(calculateOreReward('large', 1)).toBe(10);
    });

    it('applies 1.2x multiplier for turns 4-7 (small)', () => {
        expect(calculateOreReward('small', 4)).toBe(Math.ceil(4 * 1.2)); // 5
    });

    it('applies 1.2x multiplier for turns 4-7 (medium)', () => {
        expect(calculateOreReward('medium', 5)).toBe(Math.ceil(7 * 1.2)); // 9
    });

    it('applies 1.4x multiplier for turns 8-11 (large)', () => {
        expect(calculateOreReward('large', 8)).toBe(Math.ceil(10 * 1.4)); // 14
    });

    it('applies 1.4x multiplier for turns 8-11 (small)', () => {
        expect(calculateOreReward('small', 11)).toBe(Math.ceil(4 * 1.4)); // 6
    });

    it('applies 1.6x multiplier for turns >= 12 (medium)', () => {
        expect(calculateOreReward('medium', 12)).toBe(Math.ceil(7 * 1.6)); // 12
    });

    it('applies 1.6x multiplier for turns >= 12 (large)', () => {
        expect(calculateOreReward('large', 20)).toBe(Math.ceil(10 * 1.6)); // 16
    });

    it('uses Math.ceil for fractional values', () => {
        // small=4, turn=4: 4*1.2 = 4.8 -> ceil = 5
        expect(calculateOreReward('small', 4)).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// 5. shouldTriggerMine
// ---------------------------------------------------------------------------
describe('shouldTriggerMine', () => {
    it('returns false for friendly mine (same owner)', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        const mine = createTestMine(PlayerID.P1, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(false);
    });

    it('returns true for enemy mine', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(true);
    });

    it('returns false when unit id is in immuneUnitIds', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, { id: 'immune-unit' });
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5, { immuneUnitIds: ['immune-unit'] });
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(false);
    });

    it('returns true when unit id is NOT in immuneUnitIds', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, { id: 'other-unit' });
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5, { immuneUnitIds: ['immune-unit'] });
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(true);
    });

    it('returns false for Maker with makerLevelA >= 3 and makerVariantA === 2 (flying)', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 3, 2);
        const unit = createTestUnit(PlayerID.P1, UnitType.MAKER, 3, 5);
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(false);
    });

    it('returns true for Maker with makerLevelA >= 3 but makerVariantA !== 2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 3, 1);
        const unit = createTestUnit(PlayerID.P1, UnitType.MAKER, 3, 5);
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(true);
    });

    it('returns true for Maker with makerLevelA < 3 even with variant 2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 2, 2);
        const unit = createTestUnit(PlayerID.P1, UnitType.MAKER, 3, 5);
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(true);
    });

    it('returns true for non-Maker unit even if Maker evolution is unlocked', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 3, 2);
        const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 5);
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        expect(shouldTriggerMine(unit, mine, state.players[PlayerID.P1])).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 6. calculateMineInteraction
// ---------------------------------------------------------------------------
describe('calculateMineInteraction', () => {
    describe('Normal mine', () => {
        it('deals 8 damage for a Normal mine', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(true);
            expect(result.damage).toBe(MINE_DAMAGE); // 8
            expect(result.isNukeTriggered).toBe(false);
        });

        it('returns not triggered for friendly mine', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P1, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(false);
            expect(result.damage).toBe(0);
        });
    });

    describe('Slow mine', () => {
        it('deals 4 damage and applies moveCostDebuff', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.SLOW, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(true);
            expect(result.damage).toBe(4);
            expect(result.statusUpdates.moveCostDebuff).toBe(2);
            expect(result.statusUpdates.moveCostDebuffDuration).toBe(2);
            expect(result.logKeys).toContain('log_heavy_steps');
        });
    });

    describe('Smoke mine', () => {
        it('deals 7 damage and creates smoke effects', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.SMOKE, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(true);
            expect(result.damage).toBe(7);
            expect(result.createdSmokes.length).toBeGreaterThan(0);
            expect(result.logKeys).toContain('log_smoke_deployed');
        });

        it('creates up to 9 smoke tiles in a 3x3 area (center of board)', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.SMOKE, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.createdSmokes.length).toBe(9);
            // All smokes should have duration 3
            result.createdSmokes.forEach(s => expect(s.duration).toBe(3));
        });

        it('clips smoke tiles at board edges', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0);
            const mine = createTestMine(PlayerID.P2, MineType.SMOKE, 0, 0);
            const result = calculateMineInteraction(unit, [mine], 0, 0, state.players[PlayerID.P1], 1, 0);
            // At corner (0,0): only cells (0,0), (0,1), (1,0), (1,1) are valid = 4 cells
            expect(result.createdSmokes.length).toBe(4);
        });
    });

    describe('Nuke mine', () => {
        it('deals 12 damage on direct contact', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NUKE, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(true);
            expect(result.damage).toBe(12);
            expect(result.isNukeTriggered).toBe(true);
            expect(result.nukeBlastCenter).toEqual({ r: 3, c: 11 });
        });

        it('triggers via proximity (3x3 area) when unit enters adjacent cell', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            // Nuke at (3,12), unit moves to (3,11) which is within 1 Chebyshev of nuke
            // Unit started at (3,10) which is 2 Chebyshev from nuke -> > 1, so proximity triggers
            const mine = createTestMine(PlayerID.P2, MineType.NUKE, 3, 12);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(true);
            expect(result.isNukeTriggered).toBe(true);
            expect(result.damage).toBe(12);
            expect(result.nukeBlastCenter).toEqual({ r: 3, c: 12 });
        });

        it('does NOT trigger via proximity if unit started within the 3x3 range', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 11);
            // Nuke at (3,12), unit starts at (3,11) which is Chebyshev 1 from nuke -> not > 1
            // Unit moves to (3,11) same spot -> no direct contact mine either (mine at 3,12)
            const mine = createTestMine(PlayerID.P2, MineType.NUKE, 3, 12);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 11);
            expect(result.triggered).toBe(false);
        });
    });

    describe('Defuser 50% base reduction', () => {
        it('halves Normal mine damage for Defuser unit', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(Math.floor(MINE_DAMAGE * 0.5)); // 4
        });

        it('halves Nuke mine damage for Defuser unit', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NUKE, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(Math.floor(12 * 0.5)); // 6
        });
    });

    describe('Defuser evolution A1 team reduction', () => {
        it('reduces damage by 1 for non-Defuser at defLevelA >= 1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 1);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(MINE_DAMAGE - 1); // 7
        });

        it('reduces damage by 2 for low-HP non-Defuser at defLevelA >= 1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 1);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10, { hp: 5, maxHp: 16 }); // 5 < 16*0.5=8
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(MINE_DAMAGE - 2); // 6
        });

        it('does NOT apply team reduction to Defuser itself', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 1);
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            // Defuser gets its own 50% reduction only: floor(8 * 0.5) = 4
            expect(result.damage).toBe(4);
        });
    });

    describe('Defuser evolution A3-2 enhanced', () => {
        it('gives team reduction of 2 for non-Defuser at A3-2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(MINE_DAMAGE - 2); // 6
        });

        it('gives team reduction of 3 for low-HP non-Defuser at A3-2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10, { hp: 5, maxHp: 16 });
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(MINE_DAMAGE - 3); // 5
        });

        it('gives Defuser 75% total reduction at A3-2 (halved twice)', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            // 50%: floor(8 * 0.5) = 4, then halved again: floor(4 * 0.5) = 2
            expect(result.damage).toBe(2);
        });
    });

    describe('Defuser evolution A2 team heal', () => {
        it('sets teamHealAmount and teamLowHpHealAmount when Defuser has A2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.teamMaxHpBonus).toBe(0);
            expect(result.teamHealAmount).toBe(1);
            expect(result.teamLowHpHealAmount).toBe(2);
            expect(result.logKeys).toContain('log_evol_def_a_heal');
        });

        it('does NOT set team heal when non-Defuser triggers mine', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.teamHealAmount).toBeUndefined();
        });
    });

    describe('Defuser evolution A3-1 reflected damage', () => {
        it('reflects 2 damage when non-Defuser triggers mine with A3-1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 1);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.reflectedDamage).toBe(2);
        });

        it('reflects 3 damage when Defuser triggers mine with A3-1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 1);
            const unit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.reflectedDamage).toBe(3);
        });

        it('does NOT reflect when variant is 2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'a', 3, 2);
            const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 10);
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.reflectedDamage).toBe(0);
        });
    });

    describe('no mine at target', () => {
        it('returns untriggered result when no mine exists at target', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10);
            const result = calculateMineInteraction(unit, [], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.triggered).toBe(false);
            expect(result.damage).toBe(0);
            expect(result.mineOwnerId).toBeNull();
        });
    });

    describe('mineVulnerability', () => {
        it('adds mineVulnerability to mine damage', () => {
            const state = createTestState();
            const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 10, {
                status: { mineVulnerability: 3, moveCostDebuff: 0 },
            });
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11);
            const result = calculateMineInteraction(unit, [mine], 3, 11, state.players[PlayerID.P1], 3, 10);
            expect(result.damage).toBe(MINE_DAMAGE + 3); // 11
        });
    });
});

// ---------------------------------------------------------------------------
// 7. checkEnergyCap
// ---------------------------------------------------------------------------
describe('checkEnergyCap', () => {
    it('returns true when cost is within the cap', () => {
        // startOfActionEnergy=50, cap = floor(50 * 0.3333) = 16
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 50,
            energyUsedThisTurn: 0,
        });
        expect(checkEnergyCap(unit, 10)).toBe(true);
    });

    it('returns true when cost exactly reaches the cap', () => {
        // cap = floor(50 * 0.3333) = 16
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 50,
            energyUsedThisTurn: 0,
        });
        expect(checkEnergyCap(unit, 16)).toBe(true);
    });

    it('returns false when cost exceeds the cap', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 50,
            energyUsedThisTurn: 0,
        });
        expect(checkEnergyCap(unit, 17)).toBe(false);
    });

    it('accounts for energy already used this turn', () => {
        // cap = 16, already used 10, so only 6 remaining
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 50,
            energyUsedThisTurn: 10,
        });
        expect(checkEnergyCap(unit, 6)).toBe(true);
        expect(checkEnergyCap(unit, 7)).toBe(false);
    });

    it('handles zero startOfActionEnergy (cap = 0)', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 0,
            energyUsedThisTurn: 0,
        });
        expect(checkEnergyCap(unit, 0)).toBe(true);
        expect(checkEnergyCap(unit, 1)).toBe(false);
    });

    it('uses floor for fractional cap', () => {
        // startOfActionEnergy=10, cap = floor(10 * 0.3333) = floor(3.333) = 3
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 0, 0, {
            startOfActionEnergy: 10,
            energyUsedThisTurn: 0,
        });
        expect(checkEnergyCap(unit, 3)).toBe(true);
        expect(checkEnergyCap(unit, 4)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 8. updateQuestStats
// ---------------------------------------------------------------------------
describe('updateQuestStats', () => {
    const baseStats: QuestStats = {
        generalDamage: 0,
        generalFlagSteps: 0,
        sweeperMinesMarked: 0,
        sweeperScansPerformed: 0,
        sweeperScansThisRound: 0,
        sweeperMinesRevealed: 0,
        sweeperDetonatedMines: 0,
        consecutiveSafeRounds: 0,
        rangerSteps: 0,
        rangerMinesMoved: 0,
        makerMinesPlaced: 0,
        makerMinesTriggeredByEnemy: 0,
        defuserMinesSoaked: 0,
        defuserMinesDisarmed: 0,
        triggeredMineThisRound: false,
    };

    it('returns a new object (immutable)', () => {
        const result = updateQuestStats(baseStats, { generalDamage: 5 });
        expect(result).not.toBe(baseStats);
    });

    it('merges a single field update', () => {
        const result = updateQuestStats(baseStats, { generalDamage: 10 });
        expect(result.generalDamage).toBe(10);
        expect(result.rangerSteps).toBe(0); // unchanged
    });

    it('merges multiple field updates', () => {
        const result = updateQuestStats(baseStats, {
            generalDamage: 10,
            rangerSteps: 5,
            triggeredMineThisRound: true,
        });
        expect(result.generalDamage).toBe(10);
        expect(result.rangerSteps).toBe(5);
        expect(result.triggeredMineThisRound).toBe(true);
    });

    it('preserves fields not in the update', () => {
        const initial: QuestStats = { ...baseStats, makerMinesPlaced: 3 };
        const result = updateQuestStats(initial, { defuserMinesSoaked: 2 });
        expect(result.makerMinesPlaced).toBe(3);
        expect(result.defuserMinesSoaked).toBe(2);
    });

    it('returns identical data when updates is empty', () => {
        const result = updateQuestStats(baseStats, {});
        expect(result).toEqual(baseStats);
        expect(result).not.toBe(baseStats); // still a new object
    });
});
