import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock PeerJS before importing the provider
// ---------------------------------------------------------------------------
const mockPeerOn = vi.fn();
const mockPeerConnect = vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
    open: true,
    peer: 'remote-peer-id',
    send: vi.fn(),
}));
const mockPeerDestroy = vi.fn();
const mockPeerOnce = vi.fn();

vi.mock('peerjs', () => ({
    default: vi.fn(() => ({
        on: mockPeerOn,
        once: mockPeerOnce,
        connect: mockPeerConnect,
        destroy: mockPeerDestroy,
        id: 'test-peer-id',
    })),
}));

import { ConnectionProvider, useConnection } from '../ConnectionProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConnectionProvider>{children}</ConnectionProvider>
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ConnectionProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ---- 1. Provides context value --------------------------------------
    it('provides context value via useConnection', () => {
        const { result } = renderHook(() => useConnection(), { wrapper });

        expect(result.current).toBeDefined();
        expect(result.current.status).toBe('idle');
        expect(result.current.isConnected).toBe(false);
        expect(result.current.localPeerId).toBeNull();
        expect(result.current.remotePeerId).toBeNull();
        expect(result.current.error).toBeNull();
    });

    // ---- 2. Renders children -------------------------------------------
    it('renders children correctly', () => {
        render(
            <ConnectionProvider>
                <div data-testid="child">Hello</div>
            </ConnectionProvider>
        );

        expect(screen.getByTestId('child')).toBeDefined();
        expect(screen.getByText('Hello')).toBeDefined();
    });

    // ---- 3. useConnection throws outside provider -------------------------
    it('throws when useConnection is used outside provider', () => {
        // Suppress console.error for expected error
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() => useConnection());
        }).toThrow('useConnection must be used within a ConnectionProvider.');

        spy.mockRestore();
    });

    // ---- 4. generatePeerId returns 4-digit string ------------------------
    it('generatePeerId returns a 4-character string', () => {
        const { result } = renderHook(() => useConnection(), { wrapper });

        let peerId: string = '';
        act(() => {
            peerId = result.current.generatePeerId();
        });

        expect(peerId).toHaveLength(4);
        expect(/^\d{4}$/.test(peerId)).toBe(true);
    });

    // ---- 5. disconnect resets remote peer and status ----------------------
    it('disconnect sets status to idle or peer-ready', () => {
        const { result } = renderHook(() => useConnection(), { wrapper });

        act(() => {
            result.current.disconnect();
        });

        // When no peer is open, it should be idle
        expect(['idle', 'peer-ready']).toContain(result.current.status);
        expect(result.current.remotePeerId).toBeNull();
        expect(result.current.error).toBeNull();
    });

    // ---- 6. sendJson returns false when not connected --------------------
    it('sendJson returns false when no connection is open', () => {
        const { result } = renderHook(() => useConnection(), { wrapper });

        let sent = true;
        act(() => {
            sent = result.current.sendJson({ test: 'data' });
        });

        expect(sent).toBe(false);
        expect(result.current.error).toBeDefined();
    });

    // ---- 7. destroyPeer resets all state ---------------------------------
    it('destroyPeer resets all state to initial', () => {
        const { result } = renderHook(() => useConnection(), { wrapper });

        act(() => {
            result.current.destroyPeer();
        });

        expect(result.current.status).toBe('idle');
        expect(result.current.localPeerId).toBeNull();
        expect(result.current.remotePeerId).toBeNull();
        expect(result.current.reconnectAttempt).toBe(0);
        expect(result.current.error).toBeNull();
    });
});
