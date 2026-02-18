import { MineType, UnitType } from '../types';

export type ActionPacketType =
    | 'HELLO'
    | 'START_GAME'
    | 'MOVE'
    | 'ATTACK'
    | 'SCAN'
    | 'SENSOR_SCAN'
    | 'PLACE_MINE'
    | 'EVOLVE'
    | 'END_TURN'
    | 'SKIP_TURN'
    | 'STATE_SYNC'
    | 'PLAYER_READY' // 新增 READY 封包類型
    | 'PING'
    | 'PONG'
    | 'ACK';

export interface ActionPacket<TPayload = unknown> {
    type: ActionPacketType;
    matchId: string;
    turn: number;
    payload: TPayload;
    ts: number;
    seq: number;
}

export interface AckPayload {
    ackFor: number;
}

export interface MovePayload {
    unitId: string;
    r: number;
    c: number;
    cost: number;
}

export interface AttackPayload {
    attackerId: string;
    targetId: string;
}

export interface ScanPayload {
    unitId: string;
    r: number;
    c: number;
}

export interface SensorScanPayload {
    unitId: string;
    r: number;
    c: number;
}

export interface PlaceMinePayload {
    unitId: string;
    r: number;
    c: number;
    mineType: MineType;
}

export interface EvolvePayload {
    unitType: UnitType;
    branch: 'a' | 'b';
    variant?: number;
}

export interface EndTurnPayload {
    actedUnitId: string | null;
}

export interface ReadyPayload {
    playerId: string;
    phase: string;
}

export interface StateSyncPayload {
    reason: string;
    state: unknown;
}

export const buildActionPacket = <TPayload>(
    input: Omit<ActionPacket<TPayload>, 'ts'> & { ts?: number }
): ActionPacket<TPayload> => {
    return {
        ...input,
        ts: input.ts ?? Date.now()
    };
};

export const isActionPacket = (value: unknown): value is ActionPacket => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ActionPacket>;
    return (
        typeof candidate.type === 'string' &&
        typeof candidate.matchId === 'string' &&
        typeof candidate.turn === 'number' &&
        typeof candidate.ts === 'number' &&
        typeof candidate.seq === 'number'
    );
};

export const getAckFor = (packet: ActionPacket): number | null => {
    if (packet.type !== 'ACK') {
        return null;
    }

    if (!packet.payload || typeof packet.payload !== 'object') {
        return null;
    }

    const ackPayload = packet.payload as Partial<AckPayload>;
    return typeof ackPayload.ackFor === 'number' ? ackPayload.ackFor : null;
};
