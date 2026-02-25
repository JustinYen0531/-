import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { UnitType, GameState, TargetMode } from '../../types';
import { createTestState } from '../../__tests__/helpers/factories';
import { TURN_TIMER } from '../../constants';
import { useGameLoop, GameLoopActions, UseGameLoopProps } from '../useGameLoop';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createMockActions = (): GameLoopActions => ({
    handleActionComplete: vi.fn(),
    startActionPhase: vi.fn(),
    finishPlacementPhase: vi.fn(),
    handleUnitClick: vi.fn(),
    applyRadarScans: vi.fn((state: GameState) => state.mines),
    attemptMove: vi.fn(),
    handlePlaceTowerAction: vi.fn(),
    handlePlaceFactoryAction: vi.fn(),
    handlePlaceHubAction: vi.fn(),
    handleTeleportToHubAction: vi.fn(),
    handleDisarmAction: vi.fn(),
    handleDetonateTowerAction: vi.fn(),
    handleStealth: vi.fn(),
    handleRangerAction: vi.fn(),
    handlePickupFlag: vi.fn(),
    handleDropFlag: vi.fn(),
    handleEvolution: vi.fn(),
    handleScanAction: vi.fn(),
    handlePlaceMineAction: vi.fn(),
    addLog: vi.fn(),
    setShowEvolutionTree: vi.fn(),
    getLocalizedUnitName: vi.fn((type: UnitType) => type),
    getActionButtonIndex: vi.fn(() => -1),
});

const createHookProps = (
    overrides: Partial<{
        state: GameState;
        view: 'lobby' | 'game';
        targetMode: TargetMode;
        actions: GameLoopActions;
    }> = {}
): UseGameLoopProps => {
    const state = overrides.state ?? (() => {
        const s = createTestState();
        s.timeLeft = TURN_TIMER;
        return s;
    })();
    const gameStateRef = { current: state };

    return {
        gameStateRef,
        setGameState: vi.fn((updater) => {
            if (typeof updater === 'function') {
                gameStateRef.current = updater(gameStateRef.current);
            } else {
                gameStateRef.current = updater;
            }
        }),
        view: overrides.view ?? 'game',
        targetMode: overrides.targetMode ?? null,
        setTargetMode: vi.fn(),
        actions: overrides.actions ?? createMockActions(),
    };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useGameLoop', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ---- 1. Timer counts down -------------------------------------------
    it('counts down timer each 100ms tick', () => {
        const props = createHookProps();

        renderHook(() => useGameLoop(props));

        // Advance 1 second (10 ticks at 100ms)
        vi.advanceTimersByTime(1000);

        // setGameState should have been called to reduce timeLeft
        expect(props.setGameState).toHaveBeenCalled();
    });

    // ---- 2. Timer does not tick in lobby --------------------------------
    it('does not set up timer when view is lobby', () => {
        const props = createHookProps({ view: 'lobby' });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(5000);

        expect(props.setGameState).not.toHaveBeenCalled();
    });

    // ---- 3. Timer pauses when isPaused -----------------------------------
    it('does not decrement timer when isPaused is true', () => {
        const state = createTestState();
        state.timeLeft = 10;
        state.isPaused = true;
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(1000);

        // setGameState should NOT be called for timer updates when paused
        expect(props.setGameState).not.toHaveBeenCalled();
    });

    // ---- 4. Timer pauses when game is over --------------------------------
    it('does not decrement timer when gameOver is true', () => {
        const state = createTestState();
        state.timeLeft = 10;
        state.gameOver = true;
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(1000);

        expect(props.setGameState).not.toHaveBeenCalled();
    });

    // ---- 5. Sandbox timer pause ------------------------------------------
    it('does not decrement timer when isSandboxTimerPaused is true', () => {
        const state = createTestState('sandbox');
        state.timeLeft = 10;
        state.isSandboxTimerPaused = true;
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(1000);

        expect(props.setGameState).not.toHaveBeenCalled();
    });

    // ---- 6. Placement phase transition -----------------------------------
    it('calls finishPlacementPhase when timer reaches 0 in placement phase', () => {
        const state = createTestState();
        state.phase = 'placement';
        state.timeLeft = 0;
        const actions = createMockActions();
        const props = createHookProps({ state, actions });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(200);

        expect(actions.finishPlacementPhase).toHaveBeenCalled();
    });

    // ---- 7. Thinking phase transition -----------------------------------
    it('calls startActionPhase when timer reaches 0 in thinking phase', () => {
        const state = createTestState();
        state.phase = 'thinking';
        state.timeLeft = 0;
        const actions = createMockActions();
        const props = createHookProps({ state, actions });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(200);

        expect(actions.startActionPhase).toHaveBeenCalled();
    });

    // ---- 8. Action phase transition -------------------------------------
    it('calls handleActionComplete when timer reaches 0 in action phase', () => {
        const state = createTestState();
        state.phase = 'action';
        state.timeLeft = 0;
        state.activeUnitId = 'test-unit';
        const actions = createMockActions();
        const props = createHookProps({ state, actions });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(200);

        expect(actions.handleActionComplete).toHaveBeenCalledWith('test-unit');
    });

    // ---- 9. Cleanup on unmount ------------------------------------------
    it('clears interval on unmount', () => {
        const props = createHookProps();

        const { unmount } = renderHook(() => useGameLoop(props));
        unmount();

        const callCountBefore = (props.setGameState as ReturnType<typeof vi.fn>).mock.calls.length;
        vi.advanceTimersByTime(5000);
        const callCountAfter = (props.setGameState as ReturnType<typeof vi.fn>).mock.calls.length;

        expect(callCountAfter).toBe(callCountBefore);
    });

    // ---- 10. Timer steps by 0.1 normally ---------------------------------
    it('decrements timer by 0.1 per tick in normal mode', () => {
        const state = createTestState();
        state.timeLeft = 10;
        state.isTimeFrozen = false;
        state.lastActionTime = undefined;
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(100); // 1 tick

        expect(props.setGameState).toHaveBeenCalled();
        // The callback reduces timeLeft by 0.1
        const updated = props.gameStateRef.current;
        expect(updated.timeLeft).toBeCloseTo(9.9, 1);
    });

    // ---- 11. Time frozen step is 0 ---------------------------------------
    it('does not decrement timer when isTimeFrozen and in slow-mo', () => {
        const state = createTestState();
        state.timeLeft = 10;
        state.isTimeFrozen = true;
        state.lastActionTime = Date.now(); // within 500ms
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(100);

        // Timer should NOT decrease when frozen AND in slow-mo
        expect(props.gameStateRef.current.timeLeft).toBe(10);
    });

    // ---- 12. Keyboard handler registered in game view --------------------
    it('does not crash when rendering with game view', () => {
        const props = createHookProps({ view: 'game' });

        expect(() => {
            renderHook(() => useGameLoop(props));
        }).not.toThrow();
    });

    // ---- 13. Falls back to selectedUnitId when activeUnitId is null ------
    it('uses selectedUnitId for handleActionComplete when activeUnitId is null', () => {
        const state = createTestState();
        state.phase = 'action';
        state.timeLeft = 0;
        state.activeUnitId = null;
        state.selectedUnitId = 'selected-unit';
        const actions = createMockActions();
        const props = createHookProps({ state, actions });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(200);

        expect(actions.handleActionComplete).toHaveBeenCalledWith('selected-unit');
    });

    // ---- 14. Slow-mo period uses step 0.02 --------------------------------
    it('uses slow-mo step when recent action happened within 500ms', () => {
        const state = createTestState();
        state.timeLeft = 10;
        state.isTimeFrozen = false;
        state.lastActionTime = Date.now();
        const props = createHookProps({ state });

        renderHook(() => useGameLoop(props));

        vi.advanceTimersByTime(100);

        // In slow-mo, step is 0.02
        expect(props.gameStateRef.current.timeLeft).toBeCloseTo(9.98, 2);
    });
});
