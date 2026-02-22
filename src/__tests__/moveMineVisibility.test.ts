import { describe, it, expect } from 'vitest';

type PlayerID = 'P1' | 'P2';

interface Mine {
    id: string;
    owner: PlayerID;
    r: number;
    c: number;
    revealedTo: PlayerID[];
    isConverted?: boolean;
}

interface Unit {
    id: string;
    owner: PlayerID;
    r: number;
    c: number;
}

interface SensorResult {
    r: number;
    c: number;
    count: number;
    kind?: 'count' | 'mark';
    success?: boolean;
    owner: PlayerID;
    createdTurn: number;
}

interface State {
    mines: Mine[];
    sensorResults: SensorResult[];
}

const canSelectEnemyMineForMoveStart = (state: State, unit: Unit, r: number, c: number): boolean => {
    return !!state.mines.find(m =>
        m.r === r &&
        m.c === c &&
        m.owner !== unit.owner &&
        m.revealedTo.includes(unit.owner)
    );
};

const tryMoveEnemyMine = (
    state: State,
    unit: Unit,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number
): { ok: boolean; next: State } => {
    const idx = state.mines.findIndex(m =>
        m.r === fromR &&
        m.c === fromC &&
        m.owner !== unit.owner &&
        m.revealedTo.includes(unit.owner)
    );
    if (idx === -1) return { ok: false, next: state };

    const nextMines = [...state.mines];
    nextMines[idx] = { ...nextMines[idx], r: toR, c: toC };
    return {
        ok: true,
        next: {
            ...state,
            mines: nextMines
        }
    };
};

const tryConvertEnemyMine = (
    state: State,
    unit: Unit,
    r: number,
    c: number
): { ok: boolean; next: State } => {
    const idx = state.mines.findIndex(m =>
        m.r === r &&
        m.c === c &&
        m.owner !== unit.owner &&
        m.revealedTo.includes(unit.owner)
    );
    if (idx === -1) return { ok: false, next: state };

    const nextMines = [...state.mines];
    nextMines[idx] = { ...nextMines[idx], owner: unit.owner, revealedTo: [unit.owner], isConverted: true };
    return {
        ok: true,
        next: {
            ...state,
            mines: nextMines
        }
    };
};

const clearScanMarksAtCells = (sensorResults: SensorResult[], cells: Array<{ r: number; c: number }>): SensorResult[] => {
    if (!cells.length) return sensorResults;
    const keys = new Set(cells.map(cell => `${cell.r},${cell.c}`));
    return sensorResults.filter(sr => !(sr.kind === 'mark' && keys.has(`${sr.r},${sr.c}`)));
};

const hasPickupMineButton = (state: State, ranger: Unit, rangerLevelB: number): boolean => {
    const pickupRadius = rangerLevelB >= 1 ? 2 : 0;
    return !!state.mines.find(m =>
        Math.abs(m.r - ranger.r) + Math.abs(m.c - ranger.c) <= pickupRadius &&
        (m.owner === ranger.owner || m.revealedTo.includes(ranger.owner))
    );
};

describe('Mine visibility hardening', () => {
    it('blocks move_mine_start for hidden enemy mine', () => {
        const state: State = {
            mines: [{ id: 'm1', owner: 'P2', r: 5, c: 5, revealedTo: [] }],
            sensorResults: []
        };
        const defuser: Unit = { id: 'u1', owner: 'P1', r: 4, c: 5 };
        const before = JSON.stringify(state);

        const canStart = canSelectEnemyMineForMoveStart(state, defuser, 5, 5);

        expect(canStart).toBe(false);
        expect(JSON.stringify(state)).toBe(before);
    });

    it('blocks move_mine execution bypass for hidden enemy mine', async () => {
        const state: State = {
            mines: [{ id: 'm1', owner: 'P2', r: 6, c: 6, revealedTo: [] }],
            sensorResults: []
        };
        const defuser: Unit = { id: 'u1', owner: 'P1', r: 6, c: 4 };

        const result = await Promise.resolve().then(() => tryMoveEnemyMine(state, defuser, 6, 6, 7, 7));

        expect(result.ok).toBe(false);
        expect(result.next.mines[0].r).toBe(6);
        expect(result.next.mines[0].c).toBe(6);
    });

    it('blocks convert_mine for hidden enemy mine', () => {
        const state: State = {
            mines: [{ id: 'm1', owner: 'P2', r: 3, c: 3, revealedTo: [] }],
            sensorResults: []
        };
        const defuser: Unit = { id: 'u1', owner: 'P1', r: 3, c: 2 };

        const result = tryConvertEnemyMine(state, defuser, 3, 3);

        expect(result.ok).toBe(false);
        expect(result.next.mines[0].owner).toBe('P2');
    });

    it('clears stale mark when mine cell changes', () => {
        const sensorResults: SensorResult[] = [
            { r: 2, c: 2, count: 0, kind: 'mark', success: false, owner: 'P1', createdTurn: 1 },
            { r: 4, c: 4, count: 1, kind: 'mark', success: true, owner: 'P2', createdTurn: 1 },
            { r: 2, c: 2, count: 3, kind: 'count', owner: 'P1', createdTurn: 1 }
        ];

        const cleaned = clearScanMarksAtCells(sensorResults, [{ r: 2, c: 2 }]);

        expect(cleaned).toHaveLength(2);
        expect(cleaned.some(sr => sr.kind === 'mark' && sr.r === 2 && sr.c === 2)).toBe(false);
        expect(cleaned.some(sr => (sr.kind ?? 'count') === 'count' && sr.r === 2 && sr.c === 2)).toBe(true);
    });

    it('uses Manhattan-2 pickup rule for Ranger B1+ button availability', () => {
        const ranger: Unit = { id: 'r1', owner: 'P1', r: 5, c: 5 };
        const state: State = {
            mines: [
                { id: 'm-edge', owner: 'P1', r: 7, c: 5, revealedTo: [] }, // Manhattan 2, should be reachable
                { id: 'm-far', owner: 'P1', r: 8, c: 5, revealedTo: [] }   // Manhattan 3, should not matter
            ],
            sensorResults: []
        };

        expect(hasPickupMineButton(state, ranger, 1)).toBe(true);
        const onlyFarState: State = { ...state, mines: [state.mines[1]] };
        expect(hasPickupMineButton(onlyFarState, ranger, 1)).toBe(false);
    });
});

