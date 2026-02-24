import {
    GameState, PlayerID, Mine, UnitType,
    MineType, GameLog
} from './types';
import { GRID_ROWS, GRID_COLS } from './constants';
import { getUnitNameKey } from './gameHelpers';
import {
    AttackPayload,
    EndTurnPayload,
    EvolvePayload,
    FlagActionPayload,
    MovePayload,
    PlaceMinePayload,
    ScanPayload,
    SensorScanPayload,
    StateSyncPayload,
    ReadyPayload,
} from './network/protocol';

const UNIT_TYPES = Object.values(UnitType) as UnitType[];
const MINE_TYPES = Object.values(MineType) as MineType[];

export const isUnitTypeValue = (value: unknown): value is UnitType => (
    typeof value === 'string' && UNIT_TYPES.includes(value as UnitType)
);

export const isMineTypeValue = (value: unknown): value is MineType => (
    typeof value === 'string' && MINE_TYPES.includes(value as MineType)
);

export const isInteger = (value: unknown): value is number => (
    typeof value === 'number' && Number.isInteger(value)
);

export const isBoardCoordinate = (r: unknown, c: unknown): boolean => (
    isInteger(r) &&
    isInteger(c) &&
    r >= 0 &&
    r < GRID_ROWS &&
    c >= 0 &&
    c < GRID_COLS
);

export const isPlayerId = (value: unknown): value is PlayerID => (
    value === PlayerID.P1 || value === PlayerID.P2
);

export const isReadyPayload = (payload: unknown): payload is ReadyPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<ReadyPayload>;
    const hasValidSetupMines = candidate.setupMines === undefined || (
        Array.isArray(candidate.setupMines) &&
        candidate.setupMines.every(m => isBoardCoordinate(m?.r, m?.c))
    );
    return (
        isPlayerId(candidate.playerId) &&
        (candidate.phase === 'placement' || candidate.phase === 'thinking') &&
        hasValidSetupMines
    );
};

export const isMovePayload = (payload: unknown): payload is MovePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<MovePayload>;
    return (
        typeof candidate.unitId === 'string' &&
        isBoardCoordinate(candidate.r, candidate.c) &&
        isInteger(candidate.cost) &&
        candidate.cost >= 0
    );
};

export const isAttackPayload = (payload: unknown): payload is AttackPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<AttackPayload>;
    return (
        typeof candidate.attackerId === 'string' &&
        typeof candidate.targetId === 'string'
    );
};

export const isScanPayload = (payload: unknown): payload is ScanPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<ScanPayload>;
    return (
        typeof candidate.unitId === 'string' &&
        isBoardCoordinate(candidate.r, candidate.c)
    );
};

export const isSensorScanPayload = (payload: unknown): payload is SensorScanPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<SensorScanPayload>;
    return (
        typeof candidate.unitId === 'string' &&
        isBoardCoordinate(candidate.r, candidate.c)
    );
};

export const isPlaceMinePayload = (payload: unknown): payload is PlaceMinePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<PlaceMinePayload>;
    return (
        typeof candidate.unitId === 'string' &&
        isBoardCoordinate(candidate.r, candidate.c) &&
        isMineTypeValue(candidate.mineType)
    );
};

export const isFlagActionPayload = (payload: unknown): payload is FlagActionPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<FlagActionPayload>;
    return typeof candidate.unitId === 'string';
};

export const isEvolvePayload = (payload: unknown): payload is EvolvePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<EvolvePayload>;
    return (
        isUnitTypeValue(candidate.unitType) &&
        (candidate.branch === 'a' || candidate.branch === 'b')
    );
};

export const isEndTurnPayload = (payload: unknown): payload is EndTurnPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<EndTurnPayload>;
    return candidate.actedUnitId === null || typeof candidate.actedUnitId === 'string';
};

export const isStateSyncPayload = (payload: unknown): payload is StateSyncPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<StateSyncPayload>;
    return typeof candidate.reason === 'string' && candidate.state !== undefined;
};

export const serializeSet = (value: unknown): string[] => {
    if (value instanceof Set) {
        return Array.from(value).filter((item): item is string => typeof item === 'string');
    }
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }
    return [];
};

export const serializeLogParams = (params?: Record<string, any>) => JSON.stringify(params ?? {});

export const dedupeLogsBySignature = (logs: GameLog[]): GameLog[] => {
    const seen = new Set<string>();
    const deduped: GameLog[] = [];
    for (const log of logs) {
        const signature = `${log.turn}|${log.messageKey}|${log.owner ?? 'global'}|${serializeLogParams(log.params)}|${log.type}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        deduped.push(log);
    }
    return deduped;
};

export const ENEMY_MINE_LOG_KEYS = new Set([
    'log_placement_mines',
    'log_place_mine',
    'log_pickup_mine',
    'log_mine_placed',
    'log_mine_limit',
    'log_mine_zone'
]);

export const PRIVATE_HINT_LOG_KEYS = new Set([
    'log_energy_cap',
    'log_low_energy',
    'log_low_energy_attack',
    'log_low_energy_evolve',
    'log_out_of_range',
    'log_unit_acted',
    'log_committed',
    'log_scan_range',
    'log_disarm_range',
    'log_no_mine',
    'log_space_has_mine',
    'log_obstacle',
    'log_maker_range',
    'log_mine_limit',
    'log_mine_zone',
    'log_own_mine',
    'log_mine_not_revealed',
    'log_general_flag_move_limit',
    'log_flag_move_limit',
    'log_hidden_mine',
    'log_max_mines',
    'log_max_buildings',
    'log_unit_on_hub',
    'log_scan_smoke_blocked'
]);

export const ONCE_PER_TURN_HINT_LOG_KEYS = new Set([
    'log_energy_cap',
    'log_unit_acted',
    'log_general_flag_move_limit',
    'log_flag_move_limit'
]);

export const toSerializableGameState = (state: GameState): unknown => {
    const serializePlayer = (player: GameState['players'][PlayerID]) => ({
        ...player,
        questStats: {
            ...player.questStats,
            rangerMinesMovedThisRound: serializeSet(player.questStats.rangerMinesMovedThisRound),
            flagSpiritDamageTakenThisTurn: serializeSet(player.questStats.flagSpiritDamageTakenThisTurn)
        }
    });

    return {
        ...state,
        players: {
            [PlayerID.P1]: serializePlayer(state.players[PlayerID.P1]),
            [PlayerID.P2]: serializePlayer(state.players[PlayerID.P2])
        }
    };
};

export const fromSerializableGameState = (input: unknown): GameState | null => {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const candidate = input as Partial<GameState> & {
        players?: Record<string, any>;
    };

    if (!candidate.players?.[PlayerID.P1] || !candidate.players?.[PlayerID.P2]) {
        return null;
    }

    const hydratePlayer = (player: any) => ({
        ...player,
        questStats: {
            ...player.questStats,
            rangerMinesMovedThisRound: new Set(serializeSet(player.questStats?.rangerMinesMovedThisRound)),
            flagSpiritDamageTakenThisTurn: new Set(serializeSet(player.questStats?.flagSpiritDamageTakenThisTurn))
        }
    });

    return {
        ...(candidate as GameState),
        players: {
            [PlayerID.P1]: hydratePlayer(candidate.players[PlayerID.P1]),
            [PlayerID.P2]: hydratePlayer(candidate.players[PlayerID.P2])
        }
    };
};

export const mergePlacementMines = (localMines: Mine[], syncedMines: Mine[]): Mine[] => {
    const merged = [...syncedMines];
    const seenIds = new Set(merged.map(m => m.id));
    const seenCells = new Set(merged.map(m => `${m.owner}:${m.r},${m.c}`));
    for (const mine of localMines) {
        const cellKey = `${mine.owner}:${mine.r},${mine.c}`;
        if (seenIds.has(mine.id) || seenCells.has(cellKey)) continue;
        merged.push(mine);
        seenIds.add(mine.id);
        seenCells.add(cellKey);
    }
    return merged;
};

export const getSetupMines = (mines: Mine[]): Mine[] => mines.filter(m => m.id.startsWith('pm-'));

export const unionPlacementMines = (a: Mine[], b: Mine[]): Mine[] => mergePlacementMines(a, b);

export const upsertPlacementLogs = (logs: GameLog[], state: GameState, playerId: PlayerID): GameLog[] => {
    const playerState = state.players[playerId];
    const unitPositions = playerState.units
        .map(u => `${getUnitNameKey(u.type)}(${u.r + 1},${u.c + 1})`)
        .join(', ');
    const playerMines = state.mines.filter(m => m.owner === playerId);
    const minePositions = playerMines.map(m => `(${m.r + 1},${m.c + 1})`).join(', ');

    const filteredLogs = logs.filter(log =>
        !(
            log.owner === playerId &&
            (log.messageKey === 'log_placement_units' || log.messageKey === 'log_placement_mines')
        )
    );

    const newPlacementLogs: GameLog[] = [];
    if (unitPositions) {
        newPlacementLogs.push({
            turn: 1,
            messageKey: 'log_placement_units',
            params: { units: unitPositions },
            type: 'move',
            owner: playerId
        });
    }
    if (minePositions) {
        newPlacementLogs.push({
            turn: 1,
            messageKey: 'log_placement_mines',
            params: { mines: minePositions },
            type: 'move',
            owner: playerId
        });
    }

    return [...newPlacementLogs, ...filteredLogs];
};
