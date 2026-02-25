import { useEffect } from 'react';
import { GameState, PlayerID, Unit, UnitType, GameLog, Mine, MineType, TargetMode } from '../types';
import { UNIT_STATS, GRID_ROWS, GRID_COLS } from '../constants';
import { getDisplayCost } from '../gameHelpers';

export interface GameLoopActions {
    handleActionComplete: (actedUnitId: string | null) => void;
    startActionPhase: () => void;
    finishPlacementPhase: () => void;
    handleUnitClick: (unit: Unit) => void;
    applyRadarScans: (state: GameState) => Mine[];
    attemptMove: (unitId: string, r: number, c: number, cost: number) => void;
    handlePlaceTowerAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceFactoryAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceHubAction: (unit: Unit, r: number, c: number) => void;
    handleTeleportToHubAction: (unit: Unit) => void;
    handleDisarmAction: (unit: Unit, r: number, c: number) => void;
    handleDetonateTowerAction: (unit: Unit) => void;
    handleStealth: (unitId: string) => void;
    handleRangerAction: (subAction: 'pickup' | 'drop') => void;
    handlePickupFlag: () => void;
    handleDropFlag: () => void;
    handleEvolution: (unitType: UnitType, branch: 'a' | 'b', variant?: number) => void;
    handleScanAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceMineAction: (unit: Unit, r: number, c: number, mineType: MineType) => void;
    addLog: (messageKey: string, type?: GameLog['type'], params?: Record<string, any>, owner?: PlayerID) => void;
    setShowEvolutionTree: React.Dispatch<React.SetStateAction<boolean>>;
    getLocalizedUnitName: (type: UnitType) => string;
    getActionButtonIndex: (actionType: string, unit: Unit | null | undefined, state: GameState) => number;
}

export interface UseGameLoopProps {
    gameStateRef: React.MutableRefObject<GameState>;
    setGameState: (value: React.SetStateAction<GameState>) => void;
    view: 'lobby' | 'game';
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    isBoardFlippedForLocal?: boolean;
    localPlayerId?: PlayerID | null;
    actions: GameLoopActions;
}

export const useGameLoop = ({
    gameStateRef,
    setGameState,
    view,
    targetMode,
    setTargetMode,
    isBoardFlippedForLocal = false,
    localPlayerId = null,
    actions
}: UseGameLoopProps) => {

    const getUnit = (id: string, state: GameState = gameStateRef.current) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };



    // --- Timer Logic ---
    useEffect(() => {
        if (view !== 'game') return;

        const timer = setInterval(() => {
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused || state.isSandboxTimerPaused) return;
            const now = Date.now();
            // Check if we're in slow-mo period (action happened within 500ms)
            const timeSinceLastAction = state.lastActionTime ? (now - state.lastActionTime) : Infinity;
            const isInSlowMoPeriod = timeSinceLastAction < 500;

            // === UNFREEZE LOGIC ===
            // If frozen but slow-mo period has ended, unfreeze immediately
            if (state.isTimeFrozen && !isInSlowMoPeriod) {
                setGameState(prev => ({ ...prev, isTimeFrozen: false }));
            }

            // Timer tick logic - HIGH PRECISION
            let step: number;
            if (state.isTimeFrozen) {
                step = 0; // Absolute halt during freeze
            } else if (isInSlowMoPeriod) {
                step = 0.02;
            } else {
                step = 0.1;
            }

            if (state.timeLeft > 0) {
                setGameState(prev => ({
                    ...prev,
                    timeLeft: Math.max(0, prev.timeLeft - step)
                }));
            } else {
                if (state.phase === 'placement') {
                    actions.finishPlacementPhase();
                } else if (state.phase === 'thinking') {
                    actions.startActionPhase();
                } else if (state.phase === 'action') {
                    actions.handleActionComplete(state.activeUnitId || state.selectedUnitId);
                }
            }
        }, 100);

        return () => clearInterval(timer);
    }, [view, actions, setGameState, gameStateRef]);

    // --- Keyboard Control for Unit Selection (Q, W, E, R, T) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;
            if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;
            if (state.gameMode === 'pvp' && state.phase !== 'placement' && localPlayerId && state.currentPlayer !== localPlayerId) return;

            // ENTER - Ready/Skip Turn
            if (e.key === 'Enter') {
                e.preventDefault();
                if (state.phase === 'thinking') {
                    actions.startActionPhase();
                } else if (state.phase === 'action') {
                    // Skip turn logic
                    const nextUnit = state.players[state.currentPlayer].units.find(u => !u.isDead && !u.hasActedThisRound);
                    if (nextUnit) {
                        setGameState(prev => {
                            const nextMines = actions.applyRadarScans(prev);
                            return {
                                ...prev,
                                mines: nextMines,
                                activeUnitId: null,
                                selectedUnitId: null, // Deselect when skipping
                            };
                        });
                        actions.addLog('log_pass_turn', 'move', { unit: actions.getLocalizedUnitName(nextUnit.type) }, nextUnit.owner);
                        actions.handleActionComplete(nextUnit.id);
                    }
                }
                return;
            }

            const player = state.players[state.currentPlayer];

            // If a unit is already selected (showing action buttons), don't allow switching via hotkeys
            if (state.selectedUnitId) return;

            let unitIndex = -1;

            switch (e.key.toLowerCase()) {
                case 'q': unitIndex = 0; break; // General
                case 'w': unitIndex = 1; break; // Minesweeper
                case 'e': unitIndex = 2; break; // Ranger
                case 'r': unitIndex = 3; break; // Maker
                case 't': unitIndex = 4; break; // Defuser
                default: return;
            }

            if (unitIndex >= player.units.length) return;

            const unit = player.units[unitIndex];
            if (!unit) return;

            e.preventDefault();
            actions.handleUnitClick(unit);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, actions, setGameState, gameStateRef, localPlayerId]);


    // --- Keyboard Control for Action Selection (1, 2, 3, 4, 5...) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;
            if (state.phase !== 'action') return;
            if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;
            if (state.gameMode === 'pvp' && localPlayerId && state.currentPlayer !== localPlayerId) return;
            if (!state.selectedUnitId) return;

            const unit = getUnit(state.selectedUnitId, state);
            if (!unit || unit.owner !== state.currentPlayer) return;

            const actionKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
            const keyIndex = actionKeys.indexOf(e.key);
            if (keyIndex === -1) return;

            e.preventDefault();

            const hotkeyActions = [
                'move',
                'place_tower',
                'place_factory',
                'place_hub',
                'custom_dismantle',
                'attack',
                'scan',
                'sensor_scan',
                'detonate_tower',
                'place_mine',
                'pickup_mine',
                'stealth',
                'throw_mine',
                'drop_mine',
                'disarm',
                'move_mine_start',
                'convert_mine',
                'teleport',
                'pickup_flag',
                'drop_flag',
                'end_turn',
            ] as const;

            const actionByIndex = new Map<number, (typeof hotkeyActions)[number]>();
            hotkeyActions.forEach(actionType => {
                const idx = actions.getActionButtonIndex(actionType, unit, state);
                if (idx > 0 && !actionByIndex.has(idx)) {
                    actionByIndex.set(idx, actionType);
                }
            });

            const actionForKey = actionByIndex.get(keyIndex + 1);
            if (!actionForKey) return;

            switch (actionForKey) {
                case 'move': setTargetMode('move'); break;
                case 'attack': setTargetMode('attack'); break;
                case 'scan': setTargetMode('scan'); break;
                case 'sensor_scan': setTargetMode('sensor_scan'); break;
                case 'place_mine': setTargetMode('place_mine'); break;
                case 'disarm': setTargetMode('disarm'); break;
                case 'place_tower': actions.handlePlaceTowerAction(unit, unit.r, unit.c); break;
                case 'place_factory': actions.handlePlaceFactoryAction(unit, unit.r, unit.c); break;
                case 'place_hub': actions.handlePlaceHubAction(unit, unit.r, unit.c); break;
                case 'teleport': actions.handleTeleportToHubAction(unit); break;
                case 'custom_dismantle': actions.handleDisarmAction(unit, unit.r, unit.c); break;
                case 'detonate_tower': actions.handleDetonateTowerAction(unit); break;
                case 'stealth': actions.handleStealth(unit.id); break;
                case 'throw_mine': setTargetMode('throw_mine'); break;
                case 'move_mine_start': setTargetMode('move_mine_start'); break;
                case 'convert_mine': setTargetMode('convert_mine'); break;
                case 'pickup_flag': actions.handlePickupFlag(); break;
                case 'drop_flag': actions.handleDropFlag(); break;
                case 'pickup_mine': actions.handleRangerAction('pickup'); break;
                case 'drop_mine': actions.handleRangerAction('drop'); break;
                case 'end_turn': actions.handleActionComplete(unit.id); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, actions, setGameState, gameStateRef, setTargetMode, localPlayerId]);

    // --- Keyboard Control for Movement (Arrow Keys Only) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;
            if (state.phase === 'thinking') return;
            if (state.phase === 'placement') return;

            if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;
            if (state.gameMode === 'pvp' && localPlayerId && state.currentPlayer !== localPlayerId) return;

            if (!state.selectedUnitId) return;

            const unit = getUnit(state.selectedUnitId, state);
            if (!unit || unit.owner !== state.currentPlayer) return;
            if (unit.isDead || unit.hasActedThisRound) return;

            if (state.activeUnitId && state.activeUnitId !== unit.id) return;

            let dr = 0;
            let dc = 0;

            switch (e.key) {
                case 'ArrowUp': dr = -1; break;
                case 'ArrowDown': dr = 1; break;
                case 'ArrowLeft': dc = isBoardFlippedForLocal ? 1 : -1; break;
                case 'ArrowRight': dc = isBoardFlippedForLocal ? -1 : 1; break;
                default: return;
            }

            e.preventDefault();
            const targetR = unit.r + dr;
            const targetC = unit.c + dc;

            if (targetR < 0 || targetR >= GRID_ROWS || targetC < 0 || targetC >= GRID_COLS) return;

            const isOccupied =
                state.players[PlayerID.P1].units.some(u => u.r === targetR && u.c === targetC && !u.isDead) ||
                state.players[PlayerID.P2].units.some(u => u.r === targetR && u.c === targetC && !u.isDead);
            if (isOccupied) return;

            let cost = UNIT_STATS[unit.type].moveCost;
            if (unit.type === UnitType.GENERAL && unit.hasFlag) {
                const player = state.players[unit.owner];
                const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                cost = (genLevelB >= 3) ? 4 : UNIT_STATS[UnitType.GENERAL].flagMoveCost;
            } else if (unit.hasFlag) {
                cost = 4;
            } else if (unit.type === UnitType.RANGER && unit.carriedMine) {
                cost = 3;
            }

            // Apply debuffs and territory costs
            const finalCost = getDisplayCost(unit, cost, state);
            if (targetMode !== 'move') setTargetMode('move');
            actions.attemptMove(unit.id, targetR, targetC, finalCost);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, targetMode, actions, gameStateRef, setTargetMode, isBoardFlippedForLocal, localPlayerId]);

    // --- Keyboard Control for Evolution Tree (Space) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (e.key === ' ') {
                e.preventDefault();
                actions.setShowEvolutionTree(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, actions]);

};
