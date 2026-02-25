import { describe, it, expect } from 'vitest';
import { PlayerID, UnitType, MineType, GameLog } from '../types';
import {
    createTestState,
    createTestMine,
    createTestUnit,
} from './helpers/factories';
import {
    isPlayerId,
    isReadyPayload,
    isMovePayload,
    isAttackPayload,
    isScanPayload,
    isSensorScanPayload,
    isPlaceMinePayload,
    isFlagActionPayload,
    isEvolvePayload,
    isEndTurnPayload,
    isStateSyncPayload,
    isUnitTypeValue,
    isMineTypeValue,
    isInteger,
    isBoardCoordinate,
    serializeSet,
    serializeLogParams,
    dedupeLogsBySignature,
    ENEMY_MINE_LOG_KEYS,
    PRIVATE_HINT_LOG_KEYS,
    ONCE_PER_TURN_HINT_LOG_KEYS,
    toSerializableGameState,
    fromSerializableGameState,
    mergePlacementMines,
    getSetupMines,
    unionPlacementMines,
    upsertPlacementLogs,
} from '../appHelpers';

// ---------------------------------------------------------------------------
// isPlayerId
// ---------------------------------------------------------------------------
describe('isPlayerId', () => {
    it('returns true for PlayerID.P1', () => {
        expect(isPlayerId(PlayerID.P1)).toBe(true);
    });

    it('returns true for PlayerID.P2', () => {
        expect(isPlayerId(PlayerID.P2)).toBe(true);
    });

    it('returns false for an arbitrary string', () => {
        expect(isPlayerId('P3')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isPlayerId(null)).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isPlayerId(1)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isReadyPayload
// ---------------------------------------------------------------------------
describe('isReadyPayload', () => {
    it('returns true for a valid placement payload without setupMines', () => {
        expect(isReadyPayload({ playerId: PlayerID.P1, phase: 'placement' })).toBe(true);
    });

    it('returns true for a valid thinking payload', () => {
        expect(isReadyPayload({ playerId: PlayerID.P2, phase: 'thinking' })).toBe(true);
    });

    it('returns true with valid setupMines array', () => {
        expect(isReadyPayload({
            playerId: PlayerID.P1,
            phase: 'placement',
            setupMines: [{ r: 0, c: 0 }, { r: 6, c: 23 }],
        })).toBe(true);
    });

    it('returns true with empty setupMines array', () => {
        expect(isReadyPayload({
            playerId: PlayerID.P1,
            phase: 'placement',
            setupMines: [],
        })).toBe(true);
    });

    it('returns false when playerId is invalid', () => {
        expect(isReadyPayload({ playerId: 'P3', phase: 'placement' })).toBe(false);
    });

    it('returns false when phase is invalid', () => {
        expect(isReadyPayload({ playerId: PlayerID.P1, phase: 'action' })).toBe(false);
    });

    it('returns false when setupMines contains out-of-bounds coords', () => {
        expect(isReadyPayload({
            playerId: PlayerID.P1,
            phase: 'placement',
            setupMines: [{ r: -1, c: 0 }],
        })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isReadyPayload(null)).toBe(false);
    });

    it('returns false for a non-object', () => {
        expect(isReadyPayload('ready')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isMovePayload
// ---------------------------------------------------------------------------
describe('isMovePayload', () => {
    it('returns true for a valid move payload', () => {
        expect(isMovePayload({ unitId: 'u1', r: 3, c: 12, cost: 3 })).toBe(true);
    });

    it('returns true with cost 0', () => {
        expect(isMovePayload({ unitId: 'u1', r: 0, c: 0, cost: 0 })).toBe(true);
    });

    it('returns false when unitId is missing', () => {
        expect(isMovePayload({ r: 0, c: 0, cost: 3 })).toBe(false);
    });

    it('returns false when r is out of board range', () => {
        expect(isMovePayload({ unitId: 'u1', r: 7, c: 0, cost: 3 })).toBe(false);
    });

    it('returns false when c is out of board range', () => {
        expect(isMovePayload({ unitId: 'u1', r: 0, c: 24, cost: 3 })).toBe(false);
    });

    it('returns false when cost is negative', () => {
        expect(isMovePayload({ unitId: 'u1', r: 0, c: 0, cost: -1 })).toBe(false);
    });

    it('returns false when cost is a float', () => {
        expect(isMovePayload({ unitId: 'u1', r: 0, c: 0, cost: 1.5 })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isMovePayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isAttackPayload
// ---------------------------------------------------------------------------
describe('isAttackPayload', () => {
    it('returns true for a valid attack payload', () => {
        expect(isAttackPayload({ attackerId: 'a', targetId: 'b' })).toBe(true);
    });

    it('returns false when attackerId is missing', () => {
        expect(isAttackPayload({ targetId: 'b' })).toBe(false);
    });

    it('returns false when targetId is not a string', () => {
        expect(isAttackPayload({ attackerId: 'a', targetId: 123 })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isAttackPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isScanPayload
// ---------------------------------------------------------------------------
describe('isScanPayload', () => {
    it('returns true for valid scan payload', () => {
        expect(isScanPayload({ unitId: 'u1', r: 3, c: 10 })).toBe(true);
    });

    it('returns false when r is a float', () => {
        expect(isScanPayload({ unitId: 'u1', r: 1.5, c: 0 })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isScanPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isSensorScanPayload
// ---------------------------------------------------------------------------
describe('isSensorScanPayload', () => {
    it('returns true for valid sensor scan payload', () => {
        expect(isSensorScanPayload({ unitId: 'u1', r: 6, c: 23 })).toBe(true);
    });

    it('returns false when unitId is not a string', () => {
        expect(isSensorScanPayload({ unitId: 42, r: 0, c: 0 })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isSensorScanPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isPlaceMinePayload
// ---------------------------------------------------------------------------
describe('isPlaceMinePayload', () => {
    it('returns true for a valid payload with Normal mine', () => {
        expect(isPlaceMinePayload({ unitId: 'u1', r: 2, c: 5, mineType: MineType.NORMAL })).toBe(true);
    });

    it('returns true for every valid MineType', () => {
        for (const mt of Object.values(MineType)) {
            expect(isPlaceMinePayload({ unitId: 'u1', r: 0, c: 0, mineType: mt })).toBe(true);
        }
    });

    it('returns false for an invalid mineType string', () => {
        expect(isPlaceMinePayload({ unitId: 'u1', r: 0, c: 0, mineType: 'Explosive' })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isPlaceMinePayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isFlagActionPayload
// ---------------------------------------------------------------------------
describe('isFlagActionPayload', () => {
    it('returns true when unitId is a string', () => {
        expect(isFlagActionPayload({ unitId: 'general-1' })).toBe(true);
    });

    it('returns false when unitId is a number', () => {
        expect(isFlagActionPayload({ unitId: 123 })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isFlagActionPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isEvolvePayload
// ---------------------------------------------------------------------------
describe('isEvolvePayload', () => {
    it('returns true for valid evolve payload with branch a', () => {
        expect(isEvolvePayload({ unitType: UnitType.GENERAL, branch: 'a' })).toBe(true);
    });

    it('returns true for valid evolve payload with branch b', () => {
        expect(isEvolvePayload({ unitType: UnitType.RANGER, branch: 'b' })).toBe(true);
    });

    it('returns false for invalid unitType', () => {
        expect(isEvolvePayload({ unitType: 'Tank', branch: 'a' })).toBe(false);
    });

    it('returns false for invalid branch', () => {
        expect(isEvolvePayload({ unitType: UnitType.MAKER, branch: 'c' })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isEvolvePayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isEndTurnPayload
// ---------------------------------------------------------------------------
describe('isEndTurnPayload', () => {
    it('returns true when actedUnitId is a string', () => {
        expect(isEndTurnPayload({ actedUnitId: 'u1' })).toBe(true);
    });

    it('returns true when actedUnitId is null', () => {
        expect(isEndTurnPayload({ actedUnitId: null })).toBe(true);
    });

    it('returns false when actedUnitId is undefined (key absent)', () => {
        expect(isEndTurnPayload({})).toBe(false);
    });

    it('returns false for null input', () => {
        expect(isEndTurnPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isStateSyncPayload
// ---------------------------------------------------------------------------
describe('isStateSyncPayload', () => {
    it('returns true for valid state sync payload', () => {
        expect(isStateSyncPayload({ reason: 'reconnect', state: {} })).toBe(true);
    });

    it('returns true when state is null (not undefined)', () => {
        expect(isStateSyncPayload({ reason: 'init', state: null })).toBe(true);
    });

    it('returns false when state is undefined', () => {
        expect(isStateSyncPayload({ reason: 'init' })).toBe(false);
    });

    it('returns false when reason is not a string', () => {
        expect(isStateSyncPayload({ reason: 42, state: {} })).toBe(false);
    });

    it('returns false for null input', () => {
        expect(isStateSyncPayload(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isUnitTypeValue
// ---------------------------------------------------------------------------
describe('isUnitTypeValue', () => {
    it('returns true for every UnitType enum value', () => {
        for (const ut of Object.values(UnitType)) {
            expect(isUnitTypeValue(ut)).toBe(true);
        }
    });

    it('returns false for an arbitrary string', () => {
        expect(isUnitTypeValue('Tank')).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isUnitTypeValue(1)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isMineTypeValue
// ---------------------------------------------------------------------------
describe('isMineTypeValue', () => {
    it('returns true for every MineType enum value', () => {
        for (const mt of Object.values(MineType)) {
            expect(isMineTypeValue(mt)).toBe(true);
        }
    });

    it('returns false for an arbitrary string', () => {
        expect(isMineTypeValue('Explosive')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isMineTypeValue(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isInteger
// ---------------------------------------------------------------------------
describe('isInteger', () => {
    it('returns true for 0', () => {
        expect(isInteger(0)).toBe(true);
    });

    it('returns true for negative integers', () => {
        expect(isInteger(-5)).toBe(true);
    });

    it('returns false for a float', () => {
        expect(isInteger(1.5)).toBe(false);
    });

    it('returns false for NaN', () => {
        expect(isInteger(NaN)).toBe(false);
    });

    it('returns false for a string', () => {
        expect(isInteger('3')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isBoardCoordinate
// ---------------------------------------------------------------------------
describe('isBoardCoordinate', () => {
    it('returns true for (0, 0)', () => {
        expect(isBoardCoordinate(0, 0)).toBe(true);
    });

    it('returns true for max valid coords (6, 23)', () => {
        expect(isBoardCoordinate(6, 23)).toBe(true);
    });

    it('returns false for r = 7 (out of bounds)', () => {
        expect(isBoardCoordinate(7, 0)).toBe(false);
    });

    it('returns false for c = 24 (out of bounds)', () => {
        expect(isBoardCoordinate(0, 24)).toBe(false);
    });

    it('returns false for negative r', () => {
        expect(isBoardCoordinate(-1, 0)).toBe(false);
    });

    it('returns false for float r', () => {
        expect(isBoardCoordinate(1.5, 0)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// serializeSet
// ---------------------------------------------------------------------------
describe('serializeSet', () => {
    it('converts a Set of strings to a string array', () => {
        expect(serializeSet(new Set(['a', 'b']))).toEqual(['a', 'b']);
    });

    it('filters out non-string items in a Set', () => {
        const mixed = new Set([1, 'ok', null] as any);
        expect(serializeSet(mixed)).toEqual(['ok']);
    });

    it('converts an array of strings to a string array', () => {
        expect(serializeSet(['x', 'y'])).toEqual(['x', 'y']);
    });

    it('filters non-string items from an array', () => {
        expect(serializeSet([1, 'a', true, 'b'] as any)).toEqual(['a', 'b']);
    });

    it('returns empty array for a non-iterable value', () => {
        expect(serializeSet(42)).toEqual([]);
    });

    it('returns empty array for null', () => {
        expect(serializeSet(null)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// serializeLogParams
// ---------------------------------------------------------------------------
describe('serializeLogParams', () => {
    it('serializes given params to JSON', () => {
        expect(serializeLogParams({ a: 1 })).toBe('{"a":1}');
    });

    it('returns "{}" when params is undefined', () => {
        expect(serializeLogParams(undefined)).toBe('{}');
    });

    it('returns "{}" when called with no arguments', () => {
        expect(serializeLogParams()).toBe('{}');
    });
});

// ---------------------------------------------------------------------------
// dedupeLogsBySignature
// ---------------------------------------------------------------------------
describe('dedupeLogsBySignature', () => {
    const baseLog: GameLog = {
        turn: 1,
        messageKey: 'log_move',
        params: { from: 'a' },
        owner: PlayerID.P1,
        type: 'move',
    };

    it('returns a single log when given two identical logs', () => {
        expect(dedupeLogsBySignature([baseLog, { ...baseLog }])).toHaveLength(1);
    });

    it('preserves the first occurrence', () => {
        const result = dedupeLogsBySignature([baseLog, { ...baseLog }]);
        expect(result[0]).toBe(baseLog);
    });

    it('keeps both logs when messageKey differs', () => {
        const other: GameLog = { ...baseLog, messageKey: 'log_attack' };
        expect(dedupeLogsBySignature([baseLog, other])).toHaveLength(2);
    });

    it('keeps both logs when owner differs', () => {
        const other: GameLog = { ...baseLog, owner: PlayerID.P2 };
        expect(dedupeLogsBySignature([baseLog, other])).toHaveLength(2);
    });

    it('treats undefined owner as "global" in signature', () => {
        const a: GameLog = { turn: 1, messageKey: 'k', type: 'info' };
        const b: GameLog = { turn: 1, messageKey: 'k', type: 'info' };
        expect(dedupeLogsBySignature([a, b])).toHaveLength(1);
    });

    it('returns empty array for empty input', () => {
        expect(dedupeLogsBySignature([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Constant sets
// ---------------------------------------------------------------------------
describe('ENEMY_MINE_LOG_KEYS', () => {
    it('contains exactly 6 keys', () => {
        expect(ENEMY_MINE_LOG_KEYS.size).toBe(6);
    });

    it('includes log_placement_mines', () => {
        expect(ENEMY_MINE_LOG_KEYS.has('log_placement_mines')).toBe(true);
    });
});

describe('PRIVATE_HINT_LOG_KEYS', () => {
    it('is a Set with the expected size', () => {
        expect(PRIVATE_HINT_LOG_KEYS.size).toBeGreaterThanOrEqual(22);
    });

    it('includes log_energy_cap', () => {
        expect(PRIVATE_HINT_LOG_KEYS.has('log_energy_cap')).toBe(true);
    });
});

describe('ONCE_PER_TURN_HINT_LOG_KEYS', () => {
    it('contains exactly 4 keys', () => {
        expect(ONCE_PER_TURN_HINT_LOG_KEYS.size).toBe(4);
    });

    it('includes log_unit_acted', () => {
        expect(ONCE_PER_TURN_HINT_LOG_KEYS.has('log_unit_acted')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// toSerializableGameState / fromSerializableGameState round-trip
// ---------------------------------------------------------------------------
describe('toSerializableGameState', () => {
    it('converts Set fields to arrays', () => {
        const state = createTestState();
        state.players[PlayerID.P1].questStats.rangerMinesMovedThisRound = new Set(['m1', 'm2']);
        state.players[PlayerID.P1].questStats.flagSpiritDamageTakenThisTurn = new Set(['u1']);

        const serialized = toSerializableGameState(state) as any;

        expect(Array.isArray(serialized.players[PlayerID.P1].questStats.rangerMinesMovedThisRound)).toBe(true);
        expect(serialized.players[PlayerID.P1].questStats.rangerMinesMovedThisRound).toEqual(['m1', 'm2']);
    });

    it('produces arrays for P2 as well', () => {
        const state = createTestState();
        state.players[PlayerID.P2].questStats.rangerMinesMovedThisRound = new Set(['x']);
        state.players[PlayerID.P2].questStats.flagSpiritDamageTakenThisTurn = new Set();

        const serialized = toSerializableGameState(state) as any;

        expect(Array.isArray(serialized.players[PlayerID.P2].questStats.rangerMinesMovedThisRound)).toBe(true);
        expect(serialized.players[PlayerID.P2].questStats.flagSpiritDamageTakenThisTurn).toEqual([]);
    });
});

describe('fromSerializableGameState', () => {
    it('hydrates arrays back to Sets', () => {
        const state = createTestState();
        state.players[PlayerID.P1].questStats.rangerMinesMovedThisRound = new Set(['m1']);
        state.players[PlayerID.P1].questStats.flagSpiritDamageTakenThisTurn = new Set(['u1']);

        const serialized = toSerializableGameState(state);
        const hydrated = fromSerializableGameState(serialized)!;

        expect(hydrated.players[PlayerID.P1].questStats.rangerMinesMovedThisRound).toBeInstanceOf(Set);
        expect(hydrated.players[PlayerID.P1].questStats.rangerMinesMovedThisRound).toEqual(new Set(['m1']));
    });

    it('returns null for null input', () => {
        expect(fromSerializableGameState(null)).toBeNull();
    });

    it('returns null for a non-object input', () => {
        expect(fromSerializableGameState('bad')).toBeNull();
    });

    it('returns null when players are missing', () => {
        expect(fromSerializableGameState({ turnCount: 1 })).toBeNull();
    });

    it('round-trips a full state correctly', () => {
        const state = createTestState();
        state.players[PlayerID.P1].questStats.rangerMinesMovedThisRound = new Set(['m1']);
        state.players[PlayerID.P2].questStats.flagSpiritDamageTakenThisTurn = new Set(['u2']);

        const roundTripped = fromSerializableGameState(toSerializableGameState(state))!;

        expect(roundTripped.turnCount).toBe(state.turnCount);
        expect(roundTripped.players[PlayerID.P1].questStats.rangerMinesMovedThisRound).toEqual(new Set(['m1']));
        expect(roundTripped.players[PlayerID.P2].questStats.flagSpiritDamageTakenThisTurn).toEqual(new Set(['u2']));
    });
});

// ---------------------------------------------------------------------------
// mergePlacementMines
// ---------------------------------------------------------------------------
describe('mergePlacementMines', () => {
    it('merges non-overlapping mines', () => {
        const local = [createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'a' })];
        const synced = [createTestMine(PlayerID.P1, MineType.NORMAL, 1, 1, { id: 'b' })];
        const result = mergePlacementMines(local, synced);
        expect(result).toHaveLength(2);
    });

    it('deduplicates by id', () => {
        const mine = createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'dup' });
        const result = mergePlacementMines([mine], [mine]);
        expect(result).toHaveLength(1);
    });

    it('deduplicates by cell position (same owner, r, c)', () => {
        const local = createTestMine(PlayerID.P1, MineType.NORMAL, 2, 3, { id: 'local-1' });
        const synced = createTestMine(PlayerID.P1, MineType.SLOW, 2, 3, { id: 'synced-1' });
        const result = mergePlacementMines([local], [synced]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('synced-1'); // synced wins
    });

    it('allows same cell for different owners', () => {
        const local = createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'p1-mine' });
        const synced = createTestMine(PlayerID.P2, MineType.NORMAL, 0, 0, { id: 'p2-mine' });
        const result = mergePlacementMines([local], [synced]);
        expect(result).toHaveLength(2);
    });

    it('returns synced mines when local is empty', () => {
        const synced = [createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 's1' })];
        expect(mergePlacementMines([], synced)).toEqual(synced);
    });

    it('returns local mines when synced is empty', () => {
        const local = [createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'l1' })];
        expect(mergePlacementMines(local, [])).toEqual(local);
    });
});

// ---------------------------------------------------------------------------
// getSetupMines
// ---------------------------------------------------------------------------
describe('getSetupMines', () => {
    it('returns only mines with id starting with pm-', () => {
        const mines = [
            createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'pm-1' }),
            createTestMine(PlayerID.P1, MineType.NORMAL, 1, 1, { id: 'mine-1' }),
            createTestMine(PlayerID.P1, MineType.NORMAL, 2, 2, { id: 'pm-2' }),
        ];
        const result = getSetupMines(mines);
        expect(result).toHaveLength(2);
        expect(result.every(m => m.id.startsWith('pm-'))).toBe(true);
    });

    it('returns empty array when no mines match', () => {
        const mines = [createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'regular-1' })];
        expect(getSetupMines(mines)).toEqual([]);
    });

    it('returns empty array for empty input', () => {
        expect(getSetupMines([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// unionPlacementMines (alias for mergePlacementMines)
// ---------------------------------------------------------------------------
describe('unionPlacementMines', () => {
    it('behaves identically to mergePlacementMines', () => {
        const a = [createTestMine(PlayerID.P1, MineType.NORMAL, 0, 0, { id: 'a1' })];
        const b = [createTestMine(PlayerID.P1, MineType.NORMAL, 1, 1, { id: 'b1' })];
        expect(unionPlacementMines(a, b)).toEqual(mergePlacementMines(a, b));
    });
});

// ---------------------------------------------------------------------------
// upsertPlacementLogs
// ---------------------------------------------------------------------------
describe('upsertPlacementLogs', () => {
    it('adds placement unit log based on state units', () => {
        const state = createTestState();
        const result = upsertPlacementLogs([], state, PlayerID.P1);
        const unitLog = result.find(l => l.messageKey === 'log_placement_units');
        expect(unitLog).toBeDefined();
        expect(unitLog!.owner).toBe(PlayerID.P1);
    });

    it('replaces existing stale placement logs for the same player', () => {
        const state = createTestState();
        const staleLogs: GameLog[] = [
            { turn: 1, messageKey: 'log_placement_units', params: { units: 'old' }, type: 'move', owner: PlayerID.P1 },
            { turn: 1, messageKey: 'log_placement_mines', params: { mines: 'old' }, type: 'move', owner: PlayerID.P1 },
        ];
        const result = upsertPlacementLogs(staleLogs, state, PlayerID.P1);
        const unitLogs = result.filter(l => l.messageKey === 'log_placement_units' && l.owner === PlayerID.P1);
        expect(unitLogs).toHaveLength(1);
        // Params should be refreshed, not 'old'
        expect(unitLogs[0].params!.units).not.toBe('old');
    });

    it('preserves logs belonging to other players', () => {
        const state = createTestState();
        const otherLog: GameLog = {
            turn: 1, messageKey: 'log_placement_units',
            params: { units: 'P2-stuff' }, type: 'move', owner: PlayerID.P2,
        };
        const result = upsertPlacementLogs([otherLog], state, PlayerID.P1);
        expect(result.some(l => l.owner === PlayerID.P2 && l.messageKey === 'log_placement_units')).toBe(true);
    });

    it('adds mine placement log when state has mines', () => {
        const state = createTestState();
        state.mines = [createTestMine(PlayerID.P1, MineType.NORMAL, 2, 3)];
        const result = upsertPlacementLogs([], state, PlayerID.P1);
        const mineLog = result.find(l => l.messageKey === 'log_placement_mines');
        expect(mineLog).toBeDefined();
    });

    it('does not add mine log when player has no mines', () => {
        const state = createTestState();
        state.mines = [];
        const result = upsertPlacementLogs([], state, PlayerID.P1);
        const mineLog = result.find(l => l.messageKey === 'log_placement_mines' && l.owner === PlayerID.P1);
        expect(mineLog).toBeUndefined();
    });
});
