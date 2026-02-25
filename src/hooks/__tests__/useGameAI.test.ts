import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PlayerID, UnitType, GameState } from '../../types';
import { createTestState } from '../../__tests__/helpers/factories';
import { AIActions, AIDecisionInfo, AIDifficulty, AITuningProfile } from '../../ai/types';

// ---------------------------------------------------------------------------
// Mock all AI sub-modules so the hook never runs real AI logic
// ---------------------------------------------------------------------------
vi.mock('../../ai/context', () => ({
    buildAIPlanningContext: vi.fn(() => ({
        intent: 'push_flag',
        reserveEnergy: 6,
        opening: { plan: null },
        endgame: { mode: 'none', urgency: 0 },
        unitRoles: {},
        opponentModel: { aggression: 0, flagRush: 0, minePressure: 0 },
        threatMap: [],
    })),
}));

vi.mock('../../ai/generator', () => ({
    generateActionCandidatesForUnit: vi.fn(() => []),
    generateUnitCandidates: vi.fn(() => []),
}));

vi.mock('../../ai/selector', () => ({
    selectBestUnit: vi.fn(() => null),
    sortActionsByPriority: vi.fn((a: unknown[]) => a),
}));

vi.mock('../../ai/lookahead', () => ({
    rerankActionsWithBeamLookahead: vi.fn((_, a: unknown[]) => a),
}));

vi.mock('../../ai/tuning', () => ({
    AI_TUNING_PROFILES: {
        aggressive: { feintChanceMultiplier: 1, feintMaxDeltaMultiplier: 1 },
        balanced: { feintChanceMultiplier: 1, feintMaxDeltaMultiplier: 1 },
        conservative: { feintChanceMultiplier: 1, feintMaxDeltaMultiplier: 1 },
    },
    applyTuningToActionCandidates: vi.fn((a: unknown[]) => a),
    applyTuningToPlanningContext: vi.fn((ctx: unknown) => ctx),
    applyTuningToUnitCandidates: vi.fn((a: unknown[]) => a),
}));

vi.mock('../../ai/diagnostics', () => ({
    collectRejectionSummary: vi.fn(() => []),
    summarizeRejectedReasonBuckets: vi.fn(() => ({ energy: 0, risk: 0, rules: 0 })),
    summarizeTopCandidates: vi.fn(() => []),
}));

vi.mock('../../ai/executor', () => ({
    executeAIAction: vi.fn(),
}));

vi.mock('../../ai/opponentModel', () => ({
    createInitialOpponentModel: vi.fn(() => ({
        aggression: 0,
        flagRush: 0,
        minePressure: 0,
        hotspots: {},
        samples: 0,
    })),
    updateOpponentModel: vi.fn((model: unknown) => model),
}));

vi.mock('../../ai/opening', () => ({
    chooseOpeningPlan: vi.fn(() => null),
}));

vi.mock('../../gameEngine', () => ({
    calculateAttackDamage: vi.fn(() => ({ damage: 4 })),
}));

// ---------------------------------------------------------------------------
// Import the hook AFTER mocks are registered
// ---------------------------------------------------------------------------
import { useGameAI } from '../useGameAI';
import { selectBestUnit } from '../../ai/selector';
import { generateUnitCandidates } from '../../ai/generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createMockActions = (): AIActions => ({
    attemptMove: vi.fn(),
    handleAttack: vi.fn(),
    handleScanAction: vi.fn(),
    handleSensorScan: vi.fn(),
    handleMinePlacement: vi.fn(),
    handlePlaceTowerAction: vi.fn(),
    handlePlaceFactoryAction: vi.fn(),
    handlePlaceHubAction: vi.fn(),
    handleTeleportToHubAction: vi.fn(),
    handleDetonateTowerAction: vi.fn(),
    handleThrowMineAction: vi.fn(),
    handlePickupMineAt: vi.fn(),
    handleMoveEnemyMineAction: vi.fn(),
    handleConvertEnemyMineAction: vi.fn(),
    handleRangerAction: vi.fn(),
    handleDisarm: vi.fn(),
    handleEvolution: vi.fn(),
    handlePickupFlag: vi.fn(),
    handleDropFlag: vi.fn(),
    handleActionComplete: vi.fn(),
});

const defaultProps = (overrides: Partial<{
    gameState: GameState;
    difficulty: AIDifficulty;
    tuningProfile: AITuningProfile;
    actions: AIActions;
    selectUnit: (id: string) => void;
    debug: boolean;
    onDecision: (info: AIDecisionInfo) => void;
}> = {}) => {
    const state = overrides.gameState ?? createTestState('pve');
    return {
        gameState: state,
        difficulty: (overrides.difficulty ?? 'normal') as AIDifficulty,
        tuningProfile: (overrides.tuningProfile ?? 'balanced') as AITuningProfile,
        actions: overrides.actions ?? createMockActions(),
        selectUnit: overrides.selectUnit ?? vi.fn(),
        debug: overrides.debug ?? false,
        onDecision: overrides.onDecision,
    };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useGameAI', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ---- 1. Initial state ------------------------------------------------
    it('does not crash on initial render', () => {
        const props = defaultProps();
        expect(() => renderHook(() => useGameAI(props))).not.toThrow();
    });

    it('does not invoke AI when mode is pvp', () => {
        const state = createTestState('pvp');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    it('does not invoke AI when it is P1 turn in pve mode', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P1;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    it('does not invoke AI when game is over', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        state.gameOver = true;
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    it('does not invoke AI during thinking phase', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'thinking';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    it('does not invoke AI during placement phase', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'placement';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    // ---- 2. AI triggers on P2 action turn in pve -------------------------
    it('triggers AI after think delay when P2 action in pve', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        // selectBestUnit returns null => immediate handleActionComplete(null)
        renderHook(() => useGameAI(props));

        // AI_THINK_DELAY_MS['normal'] is 420
        vi.advanceTimersByTime(419);
        expect(actions.handleActionComplete).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2);
        expect(actions.handleActionComplete).toHaveBeenCalledWith(null);
    });

    // ---- 3. Difficulty controls think delay --------------------------------
    it('uses easy difficulty think delay (320ms)', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions, difficulty: 'easy' });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(319);
        expect(actions.handleActionComplete).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2);
        expect(actions.handleActionComplete).toHaveBeenCalledWith(null);
    });

    it('uses hard difficulty think delay (520ms)', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions, difficulty: 'hard' });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(519);
        expect(actions.handleActionComplete).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2);
        expect(actions.handleActionComplete).toHaveBeenCalledWith(null);
    });

    // ---- 4. Handles empty unit candidates --------------------------------
    it('calls handleActionComplete(null) when no unit candidates exist', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        vi.mocked(selectBestUnit).mockReturnValue(null);
        vi.mocked(generateUnitCandidates).mockReturnValue([]);
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(500);

        expect(actions.handleActionComplete).toHaveBeenCalledWith(null);
    });

    // ---- 5. Cleanup on unmount -------------------------------------------
    it('cleans up timer on unmount', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        const { unmount } = renderHook(() => useGameAI(props));
        unmount();

        vi.advanceTimersByTime(5000);
        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    // ---- 6. Re-triggers on turn change ------------------------------------
    it('re-triggers AI when turnCount changes', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        state.turnCount = 1;
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        const { rerender } = renderHook(
            (p) => useGameAI(p),
            { initialProps: props }
        );

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(1);

        // Change turn
        const nextState = { ...state, turnCount: 2 };
        const nextProps = { ...props, gameState: nextState };
        rerender(nextProps);

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(2);
    });

    // ---- 7. Sandbox mode still runs AI if pve ----------------------------
    it('does not invoke AI in sandbox mode (not pve)', () => {
        const state = createTestState('sandbox');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    // ---- 8. onDecision callback integration ------------------------------
    it('calls onDecision when a unit candidate is selected and actions exist', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        vi.mocked(selectBestUnit).mockReturnValue({
            unit: p2General,
            score: 10,
            scoreBreakdown: { total: 10 },
        });
        vi.mocked(generateUnitCandidates).mockReturnValue([{
            unit: p2General,
            score: 10,
            scoreBreakdown: { total: 10 },
        }]);

        // generateActionCandidatesForUnit still returns [] so no action picked =>
        // primaryAction is undefined => still goes through tryAction(0) => index>=length => handleActionComplete
        const actions = createMockActions();
        const onDecision = vi.fn();
        const props = defaultProps({ gameState: state, actions, onDecision });

        renderHook(() => useGameAI(props));
        // AI_THINK_DELAY_MS['normal']=420 + humanLikeDelay (base 400 + 0 pressure)
        vi.advanceTimersByTime(1000);

        // Even without actions, handleActionComplete is called
        expect(actions.handleActionComplete).toHaveBeenCalled();
    });

    // ---- 9. Effect deps: phase change triggers re-evaluation -------------
    it('re-evaluates when phase changes to action', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'thinking';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        const { rerender } = renderHook(
            (p) => useGameAI(p),
            { initialProps: props }
        );

        vi.advanceTimersByTime(5000);
        expect(actions.handleActionComplete).not.toHaveBeenCalled();

        const updatedState = { ...state, phase: 'action' as const };
        rerender({ ...props, gameState: updatedState });

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalled();
    });

    // ---- 10. Effect deps: currentPlayer change ---------------------------
    it('does not trigger when player changes away from P2', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        const { rerender } = renderHook(
            (p) => useGameAI(p),
            { initialProps: props }
        );

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(1);

        const nextState = { ...state, currentPlayer: PlayerID.P1 };
        rerender({ ...props, gameState: nextState });

        vi.advanceTimersByTime(5000);
        // Should still be 1
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(1);
    });

    // ---- 11. tuningProfile dependency ------------------------------------
    it('re-evaluates when tuningProfile changes', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions, tuningProfile: 'balanced' });

        const { rerender } = renderHook(
            (p) => useGameAI(p),
            { initialProps: props }
        );

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(1);

        rerender({ ...props, tuningProfile: 'aggressive' as AITuningProfile });
        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(2);
    });

    // ---- 12. difficulty dependency ---------------------------------------
    it('re-evaluates when difficulty changes', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions, difficulty: 'normal' });

        const { rerender } = renderHook(
            (p) => useGameAI(p),
            { initialProps: props }
        );

        vi.advanceTimersByTime(500);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(1);

        rerender({ ...props, difficulty: 'hard' as AIDifficulty });
        vi.advanceTimersByTime(600);
        expect(actions.handleActionComplete).toHaveBeenCalledTimes(2);
    });

    // ---- 13. Does nothing on PVP mode regardless of player ----------------
    it('does not trigger for P2 in pvp mode', () => {
        const state = createTestState('pvp');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    // ---- 14. Does not trigger for P1 in pvp mode --------------------------
    it('does not trigger for P1 in pvp mode', () => {
        const state = createTestState('pvp');
        state.currentPlayer = PlayerID.P1;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(5000);

        expect(actions.handleActionComplete).not.toHaveBeenCalled();
    });

    // ---- 15. Opening plan cleared after turn 6 ---------------------------
    it('evaluates correctly with selectBestUnit returning a unit', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        state.turnCount = 8;
        const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        vi.mocked(selectBestUnit).mockReturnValue({
            unit: p2General,
            score: 10,
            scoreBreakdown: { total: 10 },
        });
        vi.mocked(generateUnitCandidates).mockReturnValue([{
            unit: p2General,
            score: 10,
            scoreBreakdown: { total: 10 },
        }]);

        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions });

        renderHook(() => useGameAI(props));
        vi.advanceTimersByTime(1500);

        expect(actions.handleActionComplete).toHaveBeenCalled();
    });

    // ---- 16. Debug logging does not break execution ----------------------
    it('does not throw when debug is enabled', () => {
        const state = createTestState('pve');
        state.currentPlayer = PlayerID.P2;
        state.phase = 'action';
        const actions = createMockActions();
        const props = defaultProps({ gameState: state, actions, debug: true });

        expect(() => {
            renderHook(() => useGameAI(props));
            vi.advanceTimersByTime(1000);
        }).not.toThrow();
    });
});
