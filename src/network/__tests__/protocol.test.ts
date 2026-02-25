import { describe, it, expect, vi } from 'vitest';
import {
    buildActionPacket,
    isActionPacket,
    getAckFor,
    ActionPacket,
} from '../protocol';

// ---------------------------------------------------------------------------
// buildActionPacket
// ---------------------------------------------------------------------------
describe('buildActionPacket', () => {
    it('injects Date.now() as ts when ts is omitted', () => {
        const now = 1700000000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const packet = buildActionPacket({
            type: 'MOVE',
            matchId: 'm1',
            turn: 1,
            payload: { unitId: 'u1', r: 0, c: 0, cost: 3 },
            seq: 0,
        });

        expect(packet.ts).toBe(now);
        vi.restoreAllMocks();
    });

    it('uses the provided ts when explicitly given', () => {
        const packet = buildActionPacket({
            type: 'PING',
            matchId: 'm1',
            turn: 2,
            payload: null,
            seq: 1,
            ts: 42,
        });

        expect(packet.ts).toBe(42);
    });

    it('preserves all other fields from the input', () => {
        const packet = buildActionPacket({
            type: 'ATTACK',
            matchId: 'match-abc',
            turn: 5,
            payload: { attackerId: 'a', targetId: 'b' },
            seq: 99,
            ts: 100,
        });

        expect(packet.type).toBe('ATTACK');
        expect(packet.matchId).toBe('match-abc');
        expect(packet.turn).toBe(5);
        expect(packet.payload).toEqual({ attackerId: 'a', targetId: 'b' });
        expect(packet.seq).toBe(99);
    });

    it('returns a plain object with exactly the ActionPacket shape', () => {
        const packet = buildActionPacket({
            type: 'END_TURN',
            matchId: 'm',
            turn: 0,
            payload: {},
            seq: 0,
            ts: 1,
        });

        expect(Object.keys(packet).sort()).toEqual(
            ['matchId', 'payload', 'seq', 'ts', 'turn', 'type'].sort()
        );
    });

    it('works with ts: 0 (falsy but valid)', () => {
        const packet = buildActionPacket({
            type: 'PONG',
            matchId: 'm',
            turn: 0,
            payload: null,
            seq: 0,
            ts: 0,
        });

        expect(packet.ts).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// isActionPacket
// ---------------------------------------------------------------------------
describe('isActionPacket', () => {
    const validPacket: ActionPacket = {
        type: 'MOVE',
        matchId: 'm1',
        turn: 1,
        payload: {},
        ts: 100,
        seq: 0,
    };

    it('returns true for a valid ActionPacket', () => {
        expect(isActionPacket(validPacket)).toBe(true);
    });

    it('returns true regardless of payload value', () => {
        expect(isActionPacket({ ...validPacket, payload: null })).toBe(true);
        expect(isActionPacket({ ...validPacket, payload: undefined })).toBe(true);
        expect(isActionPacket({ ...validPacket, payload: 'string' })).toBe(true);
    });

    it('returns false for null', () => {
        expect(isActionPacket(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isActionPacket(undefined)).toBe(false);
    });

    it('returns false for a primitive string', () => {
        expect(isActionPacket('hello')).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isActionPacket(42)).toBe(false);
    });

    it('returns false when type is missing', () => {
        const { type, ...rest } = validPacket;
        expect(isActionPacket(rest)).toBe(false);
    });

    it('returns false when matchId is missing', () => {
        const { matchId, ...rest } = validPacket;
        expect(isActionPacket(rest)).toBe(false);
    });

    it('returns false when turn is not a number', () => {
        expect(isActionPacket({ ...validPacket, turn: '1' })).toBe(false);
    });

    it('returns false when ts is not a number', () => {
        expect(isActionPacket({ ...validPacket, ts: 'now' })).toBe(false);
    });

    it('returns false when seq is not a number', () => {
        expect(isActionPacket({ ...validPacket, seq: null })).toBe(false);
    });

    it('returns false for an empty object', () => {
        expect(isActionPacket({})).toBe(false);
    });

    it('returns false for an array', () => {
        expect(isActionPacket([1, 2, 3])).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getAckFor
// ---------------------------------------------------------------------------
describe('getAckFor', () => {
    const makePacket = (overrides: Partial<ActionPacket>): ActionPacket => ({
        type: 'ACK',
        matchId: 'm1',
        turn: 0,
        payload: { ackFor: 5 },
        ts: 100,
        seq: 1,
        ...overrides,
    });

    it('returns the ackFor number for a valid ACK packet', () => {
        expect(getAckFor(makePacket({}))).toBe(5);
    });

    it('returns null when type is not ACK', () => {
        expect(getAckFor(makePacket({ type: 'MOVE' }))).toBeNull();
    });

    it('returns null when payload is null', () => {
        expect(getAckFor(makePacket({ payload: null }))).toBeNull();
    });

    it('returns null when payload is a primitive string', () => {
        expect(getAckFor(makePacket({ payload: 'bad' }))).toBeNull();
    });

    it('returns null when payload.ackFor is not a number', () => {
        expect(getAckFor(makePacket({ payload: { ackFor: '5' } }))).toBeNull();
    });

    it('returns null when payload is an empty object (no ackFor)', () => {
        expect(getAckFor(makePacket({ payload: {} }))).toBeNull();
    });

    it('returns ackFor: 0 correctly (falsy but valid number)', () => {
        expect(getAckFor(makePacket({ payload: { ackFor: 0 } }))).toBe(0);
    });
});
