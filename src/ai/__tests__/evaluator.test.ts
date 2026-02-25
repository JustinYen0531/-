import { describe, it, expect } from 'vitest';
import { canGeneralAttack, evaluateTargetCellRisk, evaluateActionCandidate } from '../evaluator';
import { createTestState, createTestMine, setEvolution } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType, MineType } from '../../types';
import { GRID_ROWS, GRID_COLS } from '../../constants';

// ---------------------------------------------------------------------------
// canGeneralAttack
// ---------------------------------------------------------------------------

describe('canGeneralAttack', () => {
    it('returns true when General attacks adjacent cardinal enemy', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(true);
    });

    it('returns false for non-General attacker', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when target is dead', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        target.isDead = true;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when target is same owner', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when target is diagonal (not cardinal)', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 4;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when target is out of range (distance 2, no evo)', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 7;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns true when evo A>=2 extends attack range to 2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 2);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 7;
        expect(canGeneralAttack(attacker, target, state)).toBe(true);
    });

    it('returns false when attacker has flag and no qualifying evo', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        attacker.hasFlag = true;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns true when attacker has flag and evo A>=3 variant=1', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 3, 1);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        attacker.hasFlag = true;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(true);
    });

    it('returns false when attacker has flag and evo A>=3 but variant=2', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 3, 2);
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        attacker.hasFlag = true;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when player has insufficient energy', () => {
        const state = createTestState();
        state.players[PlayerID.P1].energy = 0;
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns false when energy cap is exceeded', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        // startOfActionEnergy * 0.3333 = cap; set it very low so cap is exceeded
        attacker.startOfActionEnergy = 10;
        attacker.energyUsedThisTurn = 3; // cap would be ~3, so 3+8=11 > 3
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 3;
        target.c = 6;
        expect(canGeneralAttack(attacker, target, state)).toBe(false);
    });

    it('returns true for vertical cardinal (same column)', () => {
        const state = createTestState();
        const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        attacker.r = 3;
        attacker.c = 5;
        const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        target.r = 4;
        target.c = 5;
        expect(canGeneralAttack(attacker, target, state)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// evaluateTargetCellRisk
// ---------------------------------------------------------------------------

describe('evaluateTargetCellRisk', () => {
    it('returns 999 for out of bounds (negative row)', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, -1, 0)).toBe(999);
    });

    it('returns 999 for out of bounds (row >= GRID_ROWS)', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, GRID_ROWS, 0)).toBe(999);
    });

    it('returns 999 for out of bounds (negative col)', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, 0, -1)).toBe(999);
    });

    it('returns 999 for out of bounds (col >= GRID_COLS)', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, 0, GRID_COLS)).toBe(999);
    });

    it('returns 999 for obstacle cell', () => {
        const state = createTestState();
        state.cells[3][10].isObstacle = true;
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, 3, 10)).toBe(999);
    });

    it('returns 999 for occupied cell', () => {
        const state = createTestState();
        // P2 general is at (0, 22) by default
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(evaluateTargetCellRisk(state, unit, 0, 22)).toBe(999);
    });

    it('returns 0 for empty safe cell without threats', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        // Cell (3, 10) should be empty and safe
        expect(evaluateTargetCellRisk(state, unit, 3, 10)).toBe(0);
    });

    it('adds 90 for enemy mine on cell (no threatMap)', () => {
        const state = createTestState();
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 10);
        state.mines.push(mine);
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const risk = evaluateTargetCellRisk(state, unit, 3, 10);
        expect(risk).toBeGreaterThanOrEqual(90);
    });

    it('adds 70 for nearby enemy nuke mine (no threatMap)', () => {
        const state = createTestState();
        // Place nuke mine at (3, 11), evaluate risk of cell (3, 10) - adjacent
        // Unit is at default position (0, 1), so max(abs(3-0), abs(11-1)) = 10 > 1 => condition met
        const mine = createTestMine(PlayerID.P2, MineType.NUKE, 3, 11);
        state.mines.push(mine);
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const risk = evaluateTargetCellRisk(state, unit, 3, 10);
        expect(risk).toBeGreaterThanOrEqual(70);
    });

    it('does not add nuke risk when unit is already adjacent to nuke', () => {
        const state = createTestState();
        // Place nuke mine at (1, 2), unit at (0, 1) - already within radius 1 of nuke
        const mine = createTestMine(PlayerID.P2, MineType.NUKE, 1, 2);
        state.mines.push(mine);
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        // unit is at (0, 1) and we evaluate (1, 1) which is adjacent to nuke at (1, 2)
        // max(abs(1-0), abs(2-1)) = 1, so condition NOT met (must be > 1)
        const risk = evaluateTargetCellRisk(state, unit, 1, 1);
        // Should not include the 70-point nuke penalty
        expect(risk).toBeLessThan(70);
    });

    it('adds risk for adjacent enemies with high hp', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        unit.r = 3;
        unit.c = 5;
        // Place an enemy next to the target cell (3, 10)
        const enemy = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        enemy.r = 3;
        enemy.c = 11; // adjacent to (3, 10)
        const risk = evaluateTargetCellRisk(state, unit, 3, 10);
        expect(risk).toBeGreaterThan(0);
    });

    it('adds more risk for adjacent enemies when unit hp is low', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        unit.r = 3;
        unit.c = 5;
        unit.hp = 1; // very low hp
        const enemy = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        enemy.r = 3;
        enemy.c = 11;
        const riskLowHp = evaluateTargetCellRisk(state, unit, 3, 10);

        // Reset and test with full hp
        unit.hp = unit.maxHp;
        const riskFullHp = evaluateTargetCellRisk(state, unit, 3, 10);

        expect(riskLowHp).toBeGreaterThan(riskFullHp);
    });

    it('adds risk when entering enemy general B3 variant 2 aura', () => {
        const state = createTestState();
        setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 3, 2);
        // P2 flag at (3, 23)
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        unit.r = 3;
        unit.c = 20; // outside the flag aura
        // Evaluate moving to (3, 22) which is within 1 of (3, 23)
        const risk = evaluateTargetCellRisk(state, unit, 3, 22);
        expect(risk).toBeGreaterThanOrEqual(18);
    });

    it('uses threatMap value when provided', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const threatMap: number[][] = Array.from({ length: GRID_ROWS }, () =>
            Array.from({ length: GRID_COLS }, () => 0)
        );
        threatMap[3][10] = 42;
        const risk = evaluateTargetCellRisk(state, unit, 3, 10, threatMap);
        expect(risk).toBeGreaterThanOrEqual(42);
    });
});

// ---------------------------------------------------------------------------
// evaluateActionCandidate
// ---------------------------------------------------------------------------

describe('evaluateActionCandidate', () => {
    describe('move action', () => {
        it('rewards moving toward enemy flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 10;
            // P2 flag at (3, 23) - moving right gets closer
            const towardFlag = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 3
            );
            const awayFromFlag = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 9 },
                'normal', 3
            );
            expect(towardFlag.total).toBeGreaterThan(awayFromFlag.total);
        });

        it('rewards moving toward flag more when unit has flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 10;
            unit.hasFlag = false;
            const noFlagScore = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 3
            );
            unit.hasFlag = true;
            const hasFlagScore = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 3
            );
            expect(hasFlagScore.flag!).toBeGreaterThan(noFlagScore.flag!);
        });

        it('rewards moving onto energy ore cell', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 10;
            state.cells[3][11].hasEnergyOre = true;
            state.cells[3][11].oreSize = 'medium';
            const withOre = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 3
            );
            state.cells[3][11].hasEnergyOre = false;
            state.cells[3][11].oreSize = null;
            const withoutOre = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 3
            );
            expect(withOre.utility!).toBeGreaterThan(withoutOre.utility!);
        });

        it('safety score penalizes risky cells', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 5;
            // Place an enemy adjacent to target cell
            const enemy = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            enemy.r = 3;
            enemy.c = 7;
            const riskyMove = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 6 },
                'normal', 3
            );
            const safeMove = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 4 },
                'normal', 3
            );
            expect(safeMove.safety!).toBeGreaterThan(riskyMove.safety!);
        });

        it('penalizes oscillating back to previous position', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 6;
            // Simulate a previous move from (3, 5) to (3, 6)
            state.movements.push({
                unitId: unit.id,
                from: { r: 3, c: 5 },
                to: { r: 3, c: 6 },
            } as any);
            const backtrack = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 5 },
                'normal', 3
            );
            const forward = evaluateActionCandidate(
                state, unit, 'move',
                { kind: 'cell', r: 3, c: 7 },
                'normal', 3
            );
            expect(forward.total).toBeGreaterThan(backtrack.total);
        });
    });

    describe('attack action', () => {
        it('scores attack based on damage dealt', () => {
            const state = createTestState();
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            attacker.r = 3;
            attacker.c = 5;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = 3;
            target.c = 6;
            const score = evaluateActionCandidate(
                state, attacker, 'attack',
                { kind: 'unit', unit: target },
                'normal', 8
            );
            expect(score.attack!).toBeGreaterThan(0);
            expect(score.safety!).toBe(7);
        });

        it('gives kill bonus when target will die', () => {
            const state = createTestState();
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            attacker.r = 3;
            attacker.c = 5;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = 3;
            target.c = 6;
            target.hp = 1; // Will die from attack
            const killScore = evaluateActionCandidate(
                state, attacker, 'attack',
                { kind: 'unit', unit: target },
                'normal', 8
            );
            target.hp = target.maxHp; // Won't die
            const noKillScore = evaluateActionCandidate(
                state, attacker, 'attack',
                { kind: 'unit', unit: target },
                'normal', 8
            );
            expect(killScore.attack!).toBeGreaterThan(noKillScore.attack!);
        });

        it('gives flag bonus when target carries flag', () => {
            const state = createTestState();
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            attacker.r = 3;
            attacker.c = 5;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = 3;
            target.c = 6;
            target.hasFlag = true;
            const flagScore = evaluateActionCandidate(
                state, attacker, 'attack',
                { kind: 'unit', unit: target },
                'normal', 8
            );
            target.hasFlag = false;
            const noFlagScore = evaluateActionCandidate(
                state, attacker, 'attack',
                { kind: 'unit', unit: target },
                'normal', 8
            );
            expect(flagScore.attack!).toBeGreaterThan(noFlagScore.attack!);
        });
    });

    describe('scan action', () => {
        it('returns base utility of at least 6', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            unit.r = 3;
            unit.c = 5;
            const score = evaluateActionCandidate(
                state, unit, 'scan',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 3
            );
            expect(score.utility!).toBeGreaterThanOrEqual(6);
            expect(score.safety!).toBe(6);
        });

        it('adds bonus for nearby unrevealed enemy mines', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            unit.r = 3;
            unit.c = 5;
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 10);
            state.mines.push(mine);
            const withMine = evaluateActionCandidate(
                state, unit, 'scan',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 3
            );
            state.mines = [];
            const withoutMine = evaluateActionCandidate(
                state, unit, 'scan',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 3
            );
            expect(withMine.utility!).toBeGreaterThan(withoutMine.utility!);
        });
    });

    describe('place_mine action', () => {
        it('rewards placing mine near enemy flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            unit.r = 3;
            unit.c = 20;
            // P2 flag at (3, 23) - within distance 4
            const nearFlag = evaluateActionCandidate(
                state, unit, 'place_mine',
                { kind: 'cell', r: 3, c: 21 },
                'normal', 5, MineType.NORMAL
            );
            // Far from flag
            unit.r = 3;
            unit.c = 5;
            const farFromFlag = evaluateActionCandidate(
                state, unit, 'place_mine',
                { kind: 'cell', r: 3, c: 6 },
                'normal', 5, MineType.NORMAL
            );
            expect(nearFlag.utility!).toBeGreaterThan(farFromFlag.utility!);
        });

        it('rewards placing nuke near clustered enemies', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            unit.r = 3;
            unit.c = 10;
            // Place two enemies near target
            const e1 = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            e1.r = 3;
            e1.c = 12;
            const e2 = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            e2.r = 4;
            e2.c = 11;
            const nukeScore = evaluateActionCandidate(
                state, unit, 'place_mine',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 9, MineType.NUKE
            );
            expect(nukeScore.utility!).toBeGreaterThan(0);
        });
    });

    describe('place_tower action', () => {
        it('returns utility with base of 8', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            unit.r = 3;
            unit.c = 10;
            const score = evaluateActionCandidate(
                state, unit, 'place_tower',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 6
            );
            expect(score.utility!).toBeGreaterThanOrEqual(8);
            expect(score.safety!).toBe(6.5);
        });

        it('rewards enemy mines in coverage area', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            unit.r = 3;
            unit.c = 10;
            state.mines.push(createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11));
            const withMine = evaluateActionCandidate(
                state, unit, 'place_tower',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 6
            );
            state.mines = [];
            const withoutMine = evaluateActionCandidate(
                state, unit, 'place_tower',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 6
            );
            expect(withMine.utility!).toBeGreaterThan(withoutMine.utility!);
        });
    });

    describe('pickup_flag action', () => {
        it('gives high flag and utility score', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const score = evaluateActionCandidate(
                state, unit, 'pickup_flag',
                undefined, 'normal', 0
            );
            expect(score.flag!).toBe(25);
            expect(score.utility!).toBe(12);
        });
    });

    describe('drop_flag action', () => {
        it('gives higher utility under heavy enemy pressure', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 10;
            unit.hasFlag = true;
            // Place 2 enemies nearby
            const e1 = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            e1.r = 3;
            e1.c = 11;
            const e2 = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            e2.r = 4;
            e2.c = 10;
            const pressureScore = evaluateActionCandidate(
                state, unit, 'drop_flag',
                undefined, 'normal', 0
            );
            expect(pressureScore.utility!).toBe(7);
            expect(pressureScore.safety!).toBe(10);
        });

        it('gives low utility without enemy pressure', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 10;
            unit.hasFlag = true;
            // No enemies nearby (defaults are at c=22)
            const safeScore = evaluateActionCandidate(
                state, unit, 'drop_flag',
                undefined, 'normal', 0
            );
            expect(safeScore.utility!).toBe(2);
            expect(safeScore.safety!).toBe(3);
        });
    });

    describe('evolution actions', () => {
        it('scores evolve_a with utility based on next level', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            // Level 0 => next level 1, utility = 7 + 1*2.2 = 9.2
            const score = evaluateActionCandidate(
                state, unit, 'evolve_a',
                undefined, 'normal', 10
            );
            expect(score.utility!).toBeCloseTo(9.2, 1);
            expect(score.attack!).toBeGreaterThan(0); // General A branch adds attack
        });

        it('scores evolve_b for General with flag bonus', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const score = evaluateActionCandidate(
                state, unit, 'evolve_b',
                undefined, 'normal', 10
            );
            expect(score.flag!).toBe(4.5);
        });

        it('adds extra utility for variant choices (evolve_a_1, evolve_a_2)', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const variantScore = evaluateActionCandidate(
                state, unit, 'evolve_a_1',
                undefined, 'normal', 30
            );
            const baseScore = evaluateActionCandidate(
                state, unit, 'evolve_a',
                undefined, 'normal', 30
            );
            expect(variantScore.utility!).toBeGreaterThan(baseScore.utility!);
        });
    });

    describe('end_turn action', () => {
        it('returns minimal scores', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const score = evaluateActionCandidate(
                state, unit, 'end_turn',
                undefined, 'normal', 0
            );
            expect(score.utility!).toBe(0.5);
            expect(score.safety!).toBe(1.5);
            expect(score.energy!).toBe(1);
        });
    });

    describe('teleport action', () => {
        it('rewards teleporting toward enemy flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.r = 3;
            unit.c = 5;
            // Teleporting to (3, 15) is closer to P2 flag (3, 23)
            const score = evaluateActionCandidate(
                state, unit, 'teleport',
                { kind: 'cell', r: 3, c: 15 },
                'normal', 0
            );
            expect(score.flag!).toBeGreaterThan(0);
            expect(score.utility!).toBeGreaterThan(6);
        });

        it('gives bigger flag bonus when unit has flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.r = 3;
            unit.c = 5;
            unit.hasFlag = false;
            const noFlagScore = evaluateActionCandidate(
                state, unit, 'teleport',
                { kind: 'cell', r: 3, c: 15 },
                'normal', 0
            );
            unit.hasFlag = true;
            const hasFlagScore = evaluateActionCandidate(
                state, unit, 'teleport',
                { kind: 'cell', r: 3, c: 15 },
                'normal', 0
            );
            expect(hasFlagScore.flag!).toBeGreaterThan(noFlagScore.flag!);
        });
    });

    describe('disarm action', () => {
        it('returns base utility of at least 9', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            unit.r = 3;
            unit.c = 10;
            const score = evaluateActionCandidate(
                state, unit, 'disarm',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 2
            );
            expect(score.utility!).toBeGreaterThanOrEqual(9);
            expect(score.safety!).toBe(7);
        });
    });

    describe('energy scoring', () => {
        it('lower energy cost means higher energy score', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const cheap = evaluateActionCandidate(
                state, unit, 'end_turn',
                undefined, 'normal', 0
            );
            // end_turn overrides energy to 1, so use a different action type
            const cheapMove = evaluateActionCandidate(
                state, unit, 'scan',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 2
            );
            const expensiveMove = evaluateActionCandidate(
                state, unit, 'scan',
                { kind: 'cell', r: 3, c: 10 },
                'normal', 8
            );
            expect(cheapMove.energy!).toBeGreaterThan(expensiveMove.energy!);
        });
    });

    describe('difficulty weights', () => {
        it('hard difficulty produces different total than easy', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 5;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = 3;
            target.c = 6;
            const easyScore = evaluateActionCandidate(
                state, unit, 'attack',
                { kind: 'unit', unit: target },
                'easy', 8
            );
            const hardScore = evaluateActionCandidate(
                state, unit, 'attack',
                { kind: 'unit', unit: target },
                'hard', 8
            );
            expect(easyScore.total).not.toBe(hardScore.total);
        });
    });

    describe('place_factory action', () => {
        it('rewards factory near enemy flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            unit.r = 3;
            unit.c = 20;
            const nearFlag = evaluateActionCandidate(
                state, unit, 'place_factory',
                { kind: 'cell', r: 3, c: 20 },
                'normal', 6
            );
            unit.r = 3;
            unit.c = 5;
            const farFromFlag = evaluateActionCandidate(
                state, unit, 'place_factory',
                { kind: 'cell', r: 3, c: 5 },
                'normal', 6
            );
            expect(nearFlag.utility!).toBeGreaterThan(farFromFlag.utility!);
        });
    });

    describe('throw_mine action', () => {
        it('rewards throwing at enemy unit', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.r = 3;
            unit.c = 10;
            const enemy = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            enemy.r = 3;
            enemy.c = 12;
            const atEnemy = evaluateActionCandidate(
                state, unit, 'throw_mine',
                { kind: 'cell', r: 3, c: 12 },
                'normal', 5
            );
            const atEmpty = evaluateActionCandidate(
                state, unit, 'throw_mine',
                { kind: 'cell', r: 3, c: 11 },
                'normal', 5
            );
            expect(atEnemy.attack!).toBeGreaterThan(atEmpty.attack!);
        });
    });

    describe('convert_mine action', () => {
        it('rewards converting mines near enemy flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            unit.r = 3;
            unit.c = 20;
            const nearFlag = evaluateActionCandidate(
                state, unit, 'convert_mine',
                { kind: 'cell', r: 3, c: 21 },
                'normal', 5
            );
            unit.r = 3;
            unit.c = 5;
            const farFromFlag = evaluateActionCandidate(
                state, unit, 'convert_mine',
                { kind: 'cell', r: 3, c: 6 },
                'normal', 5
            );
            expect(nearFlag.utility!).toBeGreaterThan(farFromFlag.utility!);
        });
    });
});
