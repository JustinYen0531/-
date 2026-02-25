import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStartingPositions, createInitialState } from '../gameInit';
import { PlayerID, UnitType, MineType } from '../types';
import {
    GRID_ROWS, GRID_COLS, INITIAL_ENERGY,
    P1_FLAG_POS, P2_FLAG_POS, PLACEMENT_TIMER,
    UNIT_STATS
} from '../constants';

describe('getStartingPositions', () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
        if (randomSpy) randomSpy.mockRestore();
    });

    it('should return exactly 5 positions', () => {
        const positions = getStartingPositions(PlayerID.P1);
        expect(positions).toHaveLength(5);
    });

    it('should return positions with r and c properties', () => {
        const positions = getStartingPositions(PlayerID.P1);
        for (const pos of positions) {
            expect(pos).toHaveProperty('r');
            expect(pos).toHaveProperty('c');
        }
    });

    it('should use columns [0,1,2,3] for P1', () => {
        const positions = getStartingPositions(PlayerID.P1);
        for (const pos of positions) {
            expect(pos.c).toBeGreaterThanOrEqual(0);
            expect(pos.c).toBeLessThanOrEqual(3);
        }
    });

    it('should use columns [20,21,22,23] for P2', () => {
        const positions = getStartingPositions(PlayerID.P2);
        for (const pos of positions) {
            expect(pos.c).toBeGreaterThanOrEqual(20);
            expect(pos.c).toBeLessThanOrEqual(23);
        }
    });

    it('should avoid the flag row (row 3) for P1', () => {
        // Run multiple times to increase confidence since positions are random
        for (let i = 0; i < 20; i++) {
            const positions = getStartingPositions(PlayerID.P1);
            for (const pos of positions) {
                expect(pos.r).not.toBe(P1_FLAG_POS.r);
            }
        }
    });

    it('should avoid the flag row (row 3) for P2', () => {
        for (let i = 0; i < 20; i++) {
            const positions = getStartingPositions(PlayerID.P2);
            for (const pos of positions) {
                expect(pos.r).not.toBe(P2_FLAG_POS.r);
            }
        }
    });

    it('should only use rows from [0,1,2,4,5,6] (excluding row 3)', () => {
        const validRows = [0, 1, 2, 4, 5, 6];
        for (let i = 0; i < 20; i++) {
            const positions = getStartingPositions(PlayerID.P1);
            for (const pos of positions) {
                expect(validRows).toContain(pos.r);
            }
        }
    });

    it('should produce deterministic results when Math.random is mocked', () => {
        let callIndex = 0;
        const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 0.05, 0.10];
        randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            return values[callIndex++ % values.length];
        });

        const positions = getStartingPositions(PlayerID.P1);
        expect(positions).toHaveLength(5);
        for (const pos of positions) {
            expect(pos.r).toBeGreaterThanOrEqual(0);
            expect(pos.r).toBeLessThanOrEqual(6);
            expect(pos.r).not.toBe(3);
            expect(pos.c).toBeGreaterThanOrEqual(0);
            expect(pos.c).toBeLessThanOrEqual(3);
        }
    });
});

describe('createInitialState - pvp mode', () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Use a pseudo-deterministic mock that always returns 0.5
        // This ensures obstacles, ore, and positions are placed predictably
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        randomSpy.mockRestore();
    });

    it('should create a grid with GRID_ROWS rows', () => {
        const state = createInitialState('pvp');
        expect(state.cells).toHaveLength(GRID_ROWS);
    });

    it('should create a grid with GRID_COLS columns per row', () => {
        const state = createInitialState('pvp');
        for (const row of state.cells) {
            expect(row).toHaveLength(GRID_COLS);
        }
    });

    it('should set P1 flag base at P1_FLAG_POS', () => {
        const state = createInitialState('pvp');
        const cell = state.cells[P1_FLAG_POS.r][P1_FLAG_POS.c];
        expect(cell.isFlagBase).toBe(PlayerID.P1);
    });

    it('should set P2 flag base at P2_FLAG_POS', () => {
        const state = createInitialState('pvp');
        const cell = state.cells[P2_FLAG_POS.r][P2_FLAG_POS.c];
        expect(cell.isFlagBase).toBe(PlayerID.P2);
    });

    it('should not mark non-flag cells as flag bases', () => {
        const state = createInitialState('pvp');
        let flagBaseCount = 0;
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (state.cells[r][c].isFlagBase !== null) {
                    flagBaseCount++;
                }
            }
        }
        expect(flagBaseCount).toBe(2);
    });

    it('should place obstacles in columns 4-11 for P1 side', () => {
        randomSpy.mockRestore();
        // Use real random for this test to verify range constraints
        const state = createInitialState('pvp');
        const p1Obstacles = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 4; c < 12; c++) {
                if (state.cells[r][c].isObstacle) {
                    p1Obstacles.push({ r, c });
                }
            }
        }
        expect(p1Obstacles.length).toBeLessThanOrEqual(4);
    });

    it('should place obstacles in columns 12-19 for P2 side', () => {
        randomSpy.mockRestore();
        const state = createInitialState('pvp');
        const p2Obstacles = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 12; c < 20; c++) {
                if (state.cells[r][c].isObstacle) {
                    p2Obstacles.push({ r, c });
                }
            }
        }
        expect(p2Obstacles.length).toBeLessThanOrEqual(4);
    });

    it('should not place obstacles outside columns 4-19', () => {
        randomSpy.mockRestore();
        const state = createInitialState('pvp');
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (c < 4 || c > 19) {
                    expect(state.cells[r][c].isObstacle).toBe(false);
                }
            }
        }
    });

    it('should place ore only in columns 6-17 (c > 5 && c < 18)', () => {
        randomSpy.mockRestore();
        const state = createInitialState('pvp');
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (c <= 5 || c >= 18) {
                    expect(state.cells[r][c].hasEnergyOre).toBe(false);
                }
            }
        }
    });

    it('should assign ore sizes as small, medium, or large', () => {
        randomSpy.mockRestore();
        const state = createInitialState('pvp');
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (state.cells[r][c].hasEnergyOre) {
                    expect(['small', 'medium', 'large']).toContain(state.cells[r][c].oreSize);
                }
            }
        }
    });

    it('should create 5 units for P1', () => {
        const state = createInitialState('pvp');
        expect(state.players[PlayerID.P1].units).toHaveLength(5);
    });

    it('should create 5 units for P2', () => {
        const state = createInitialState('pvp');
        expect(state.players[PlayerID.P2].units).toHaveLength(5);
    });

    it('should create the correct unit types for each player', () => {
        const state = createInitialState('pvp');
        const expectedTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];

        const p1Types = state.players[PlayerID.P1].units.map(u => u.type);
        expect(p1Types).toEqual(expectedTypes);

        const p2Types = state.players[PlayerID.P2].units.map(u => u.type);
        expect(p2Types).toEqual(expectedTypes);
    });

    it('should set unit HP to maxHp from UNIT_STATS', () => {
        const state = createInitialState('pvp');
        for (const unit of state.players[PlayerID.P1].units) {
            expect(unit.hp).toBe(UNIT_STATS[unit.type].maxHp);
            expect(unit.maxHp).toBe(UNIT_STATS[unit.type].maxHp);
        }
    });

    it('should set initial energy to INITIAL_ENERGY for both players', () => {
        const state = createInitialState('pvp');
        expect(state.players[PlayerID.P1].energy).toBe(INITIAL_ENERGY);
        expect(state.players[PlayerID.P2].energy).toBe(INITIAL_ENERGY);
    });

    it('should set phase to placement', () => {
        const state = createInitialState('pvp');
        expect(state.phase).toBe('placement');
    });

    it('should set timeLeft to PLACEMENT_TIMER', () => {
        const state = createInitialState('pvp');
        expect(state.timeLeft).toBe(PLACEMENT_TIMER);
    });

    it('should set gameMode to pvp', () => {
        const state = createInitialState('pvp');
        expect(state.gameMode).toBe('pvp');
    });

    it('should have no mines in pvp mode', () => {
        const state = createInitialState('pvp');
        expect(state.mines).toHaveLength(0);
    });

    it('should have P2 placementMinesPlaced = 0 in pvp mode', () => {
        const state = createInitialState('pvp');
        expect(state.players[PlayerID.P2].placementMinesPlaced).toBe(0);
    });

    it('should set turnCount to 1', () => {
        const state = createInitialState('pvp');
        expect(state.turnCount).toBe(1);
    });

    it('should set currentPlayer to P1', () => {
        const state = createInitialState('pvp');
        expect(state.currentPlayer).toBe(PlayerID.P1);
    });

    it('should set gameOver to false and winner to null', () => {
        const state = createInitialState('pvp');
        expect(state.gameOver).toBe(false);
        expect(state.winner).toBeNull();
    });
});

describe('createInitialState - pve mode', () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
        if (randomSpy) randomSpy.mockRestore();
    });

    it('should set gameMode to pve', () => {
        const state = createInitialState('pve');
        expect(state.gameMode).toBe('pve');
    });

    it('should place up to 3 AI setup mines for P2', () => {
        const state = createInitialState('pve');
        expect(state.mines.length).toBeLessThanOrEqual(3);
        expect(state.mines.length).toBeGreaterThanOrEqual(0);
        for (const mine of state.mines) {
            expect(mine.owner).toBe(PlayerID.P2);
            expect(mine.type).toBe(MineType.NORMAL);
        }
    });

    it('should place AI mines in columns 12-23', () => {
        // Run multiple times since placement is random
        for (let attempt = 0; attempt < 10; attempt++) {
            const state = createInitialState('pve');
            for (const mine of state.mines) {
                expect(mine.c).toBeGreaterThanOrEqual(12);
                expect(mine.c).toBeLessThanOrEqual(23);
            }
        }
    });

    it('should set AI mine ids with setup-ai prefix', () => {
        const state = createInitialState('pve');
        state.mines.forEach((mine, i) => {
            expect(mine.id).toBe(`setup-ai-${i}`);
        });
    });

    it('should set P2 placementMinesPlaced to 3 in pve mode', () => {
        const state = createInitialState('pve');
        expect(state.players[PlayerID.P2].placementMinesPlaced).toBe(3);
    });

    it('should shuffle P2 unit positions (units at indices 1-4 may swap)', () => {
        // With deterministic random, verify the shuffle logic runs
        // The shuffle swaps units at indices 1-4 ten times
        let callIndex = 0;
        const values: number[] = [];
        // Provide enough random values for the entire createInitialState call
        for (let i = 0; i < 500; i++) {
            values.push((i * 0.0037) % 1); // Spread values across [0,1)
        }
        randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            return values[callIndex++ % values.length];
        });

        const state = createInitialState('pve');
        const p2Units = state.players[PlayerID.P2].units;
        // After shuffling, unit types should still be the same set
        const types = p2Units.map(u => u.type).sort();
        const expectedTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER].sort();
        expect(types).toEqual(expectedTypes);
        // All P2 units should still be in valid P2 columns
        for (const unit of p2Units) {
            expect(unit.c).toBeGreaterThanOrEqual(20);
            expect(unit.c).toBeLessThanOrEqual(23);
        }
    });

    it('should not place mines on obstacle cells', () => {
        for (let attempt = 0; attempt < 10; attempt++) {
            const state = createInitialState('pve');
            for (const mine of state.mines) {
                expect(state.cells[mine.r][mine.c].isObstacle).toBe(false);
            }
        }
    });
});

describe('createInitialState - sandbox mode', () => {
    it('should set gameMode to sandbox', () => {
        const state = createInitialState('sandbox');
        expect(state.gameMode).toBe('sandbox');
    });

    it('should place AI setup mines like pve mode', () => {
        const state = createInitialState('sandbox');
        expect(state.mines.length).toBeLessThanOrEqual(3);
        for (const mine of state.mines) {
            expect(mine.owner).toBe(PlayerID.P2);
            expect(mine.type).toBe(MineType.NORMAL);
        }
    });

    it('should set P2 placementMinesPlaced to 3 in sandbox mode', () => {
        const state = createInitialState('sandbox');
        expect(state.players[PlayerID.P2].placementMinesPlaced).toBe(3);
    });

    it('should have sandboxShowAllMines set to false initially', () => {
        const state = createInitialState('sandbox');
        expect(state.sandboxShowAllMines).toBe(false);
    });
});
