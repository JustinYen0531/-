import { useEffect } from 'react';
import { GameState, PlayerID, Unit, Mine, UnitType, MineType, GameLog, Building } from '../types';
import { THINKING_TIMER, TURN_TIMER, EVOLUTION_COSTS, EVOLUTION_CONFIG, UNIT_STATS, GRID_ROWS, GRID_COLS } from '../constants';
import { getUnitName, getActionButtonIndex, getDisplayCost } from '../gameHelpers';
import { TargetMode } from './usePlayerActions';

export interface GameLoopActions {
    handleActionComplete: (actedUnitId: string | null, timedOut?: boolean) => void;
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
    handleRangerAction: (subAction: 'pickup' | 'drop') => void;
    handlePickupFlag: () => void;
    handleDropFlag: () => void;
    handleEvolution: (unitType: UnitType, branch: 'a' | 'b', variant?: number) => void;
    handleScanAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceMineAction: (unit: Unit, r: number, c: number) => void;
    addLog: (messageKey: string, type?: GameLog['type'], params?: Record<string, any>, owner?: PlayerID) => void;
    setShowEvolutionTree: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseGameLoopProps {
    gameStateRef: React.MutableRefObject<GameState>;
    setGameState: (value: React.SetStateAction<GameState>) => void;
    view: 'lobby' | 'game';
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    actions: GameLoopActions;
}

export const useGameLoop = ({
    gameStateRef,
    setGameState,
    view,
    targetMode,
    setTargetMode,
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

            if (state.timeLeft > 0) {
                setGameState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
            } else {
                if (state.phase === 'placement') {
                    actions.finishPlacementPhase();
                } else if (state.phase === 'thinking') {
                    actions.startActionPhase();
                } else if (state.phase === 'action') {
                    actions.handleActionComplete(state.activeUnitId || state.selectedUnitId, true);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [view, actions, setGameState, gameStateRef]);

    // --- Keyboard Control for Unit Selection (Q, W, E, R, T) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;

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
                        actions.addLog('log_skip', 'move', { unit: getUnitName(nextUnit.type) }, nextUnit.owner);
                        actions.handleActionComplete(nextUnit.id);
                    }
                }
                return;
            }

            const player = state.players[state.currentPlayer];
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
    }, [view, actions, setGameState, gameStateRef]);


    // --- Keyboard Control for Action Selection (1, 2, 3, 4, 5...) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;
            if (state.phase !== 'action') return;
            if (!state.selectedUnitId) return;

            const unit = getUnit(state.selectedUnitId, state);
            if (!unit || unit.owner !== state.currentPlayer) return;

            const actionKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
            const keyIndex = actionKeys.indexOf(e.key);
            if (keyIndex === -1) return;

            e.preventDefault();

            // Build the button list dynamically, only including AVAILABLE buttons
            const player = state.players[unit.owner];
            const buttons: Array<{ type: string, action?: string }> = [];

            // Button 1: Move (always first)
            buttons.push({ type: 'move', action: 'move' });

            // Button 2: Placement actions
            const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
            const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
            const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

            if (canPlaceTower) buttons.push({ type: 'place_tower', action: 'place_tower' });
            if (canPlaceFactory) buttons.push({ type: 'place_factory', action: 'place_factory' });
            if (canPlaceHub) buttons.push({ type: 'place_hub', action: 'place_hub' });

            // Button 3: Universal Dismantle
            const isOnEnemyBuilding = state.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
            if (isOnEnemyBuilding) buttons.push({ type: 'custom_dismantle', action: 'custom_dismantle' });

            // Button 4: Teleport
            const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
            const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
            const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && state.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
            if (canTeleport) buttons.push({ type: 'teleport', action: 'teleport' });

            // Button 4+: Unit-specific actions
            if (unit.type === UnitType.GENERAL) {
                const canAttack = !unit.hasFlag || player.evolutionLevels[UnitType.GENERAL].a >= 3;
                if (canAttack) buttons.push({ type: 'attack', action: 'attack' });
            } else if (unit.type === UnitType.MINESWEEPER) {
                buttons.push({ type: 'scan', action: 'scan' });
                if (player.evolutionLevels[UnitType.MINESWEEPER].a === 3 && player.evolutionLevels[UnitType.MINESWEEPER].aVariant === 2) {
                    buttons.push({ type: 'detonate_tower', action: 'detonate_tower' });
                }
            } else if (unit.type === UnitType.MAKER) {
                buttons.push({ type: 'place_mine', action: 'place_mine' });
            } else if (unit.type === UnitType.RANGER) {
                const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
                const pickupRadius = rngLevelB >= 1 ? 1 : 0;
                const mineAtPosition = state.mines.some(m =>
                    (m.r === unit.r && m.c === unit.c) ||
                    (pickupRadius >= 1 && Math.abs(m.r - unit.r) <= 1 && Math.abs(m.c - unit.c) <= 1 && (m.owner === unit.owner || m.revealedTo.includes(unit.owner)))
                );
                // Note: The logic in App.tsx had 'mineAtPosition' checked via 'mineInRange' logic
                // Replicating App.tsx logic for button presence:
                const mineInRange = state.mines.find(m =>
                    Math.abs(m.r - unit.r) <= pickupRadius &&
                    Math.abs(m.c - unit.c) <= pickupRadius &&
                    (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
                );

                if (!unit.carriedMine && mineInRange) buttons.push({ type: 'pickup_mine', action: 'pickup_mine' });
                if (unit.carriedMine) {
                    if (player.evolutionLevels[UnitType.RANGER].b === 3 && player.evolutionLevels[UnitType.RANGER].bVariant === 2) {
                        buttons.push({ type: 'throw_mine', action: 'throw_mine' });
                    }
                    buttons.push({ type: 'drop_mine', action: 'drop_mine' });
                }
            } else if (unit.type === UnitType.DEFUSER) {
                buttons.push({ type: 'disarm', action: 'disarm' });
                if (player.evolutionLevels[UnitType.DEFUSER].b >= 2) buttons.push({ type: 'move_mine_start', action: 'move_mine_start' });
                if (player.evolutionLevels[UnitType.DEFUSER].b === 3 && player.evolutionLevels[UnitType.DEFUSER].bVariant === 1) buttons.push({ type: 'convert_mine', action: 'convert_mine' });
            }

            // Flag actions
            const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
            const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
            const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
            if (canCarryFlag) {
                if (!unit.hasFlag && isAtFlag) buttons.push({ type: 'pickup_flag', action: 'pickup_flag' });
                if (unit.hasFlag) buttons.push({ type: 'drop_flag', action: 'drop_flag' });
            }

            // Evolution buttons
            const levelA = player.evolutionLevels[unit.type].a;
            const levelB = player.evolutionLevels[unit.type].b;
            const questStats = player.questStats;

            const nextThresholdA = EVOLUTION_CONFIG[unit.type].a.thresholds[levelA];
            const nextThresholdB = EVOLUTION_CONFIG[unit.type].b.thresholds[levelB];

            let conditionMetA = false;
            let conditionMetB = false;

            if (unit.type === UnitType.GENERAL) {
                conditionMetA = questStats.generalDamage >= nextThresholdA;
                conditionMetB = questStats.generalFlagSteps >= nextThresholdB;
            } else if (unit.type === UnitType.MINESWEEPER) {
                conditionMetA = questStats.sweeperMinesMarked >= nextThresholdA;
                conditionMetB = questStats.consecutiveSafeRounds >= nextThresholdB;
            } else if (unit.type === UnitType.RANGER) {
                conditionMetA = questStats.rangerSteps >= nextThresholdA;
                conditionMetB = questStats.rangerMinesMoved >= nextThresholdB;
            } else if (unit.type === UnitType.MAKER) {
                conditionMetA = questStats.makerMinesTriggeredByEnemy >= nextThresholdA;
                conditionMetB = questStats.makerMinesPlaced >= nextThresholdB;
            } else if (unit.type === UnitType.DEFUSER) {
                conditionMetA = questStats.defuserMinesSoaked >= nextThresholdA;
                conditionMetB = questStats.defuserMinesDisarmed >= nextThresholdB;
            }

            const canEvolveA = levelA < 3 && player.energy >= EVOLUTION_COSTS[levelA as keyof typeof EVOLUTION_COSTS] && conditionMetA;
            const canEvolveB = levelB < 3 && player.energy >= EVOLUTION_COSTS[levelB as keyof typeof EVOLUTION_COSTS] && conditionMetB;

            const variantA = player.evolutionLevels[unit.type].aVariant;
            const variantB = player.evolutionLevels[unit.type].bVariant;
            const needsVariantA = levelA === 2 && canEvolveA && !variantA;
            const needsVariantB = levelB === 2 && canEvolveB && !variantB;

            if (needsVariantA) {
                buttons.push({ type: 'evolve_a_1', action: 'evolve_a_1' });
                buttons.push({ type: 'evolve_a_2', action: 'evolve_a_2' });
            } else if (canEvolveA) {
                buttons.push({ type: 'evolve_a', action: 'evolve_a' });
            }

            if (needsVariantB) {
                buttons.push({ type: 'evolve_b_1', action: 'evolve_b_1' });
                buttons.push({ type: 'evolve_b_2', action: 'evolve_b_2' });
            } else if (canEvolveB) {
                buttons.push({ type: 'evolve_b', action: 'evolve_b' });
            }

            buttons.push({ type: 'end_turn', action: 'end_turn' });

            if (keyIndex < buttons.length) {
                const buttonAction = buttons[keyIndex];
                switch (buttonAction.action) {
                    case 'move': setTargetMode('move'); break;
                    case 'attack': setTargetMode('attack'); break;
                    case 'scan': setTargetMode('scan'); break;
                    case 'place_mine': setTargetMode('place_mine'); break;
                    case 'disarm': setTargetMode('disarm'); break;
                    case 'place_tower': actions.handlePlaceTowerAction(unit, unit.r, unit.c); break;
                    case 'place_factory': actions.handlePlaceFactoryAction(unit, unit.r, unit.c); break;
                    case 'place_hub': actions.handlePlaceHubAction(unit, unit.r, unit.c); break;
                    case 'teleport': actions.handleTeleportToHubAction(unit); break;
                    case 'custom_dismantle': actions.handleDisarmAction(unit, unit.r, unit.c); break;
                    case 'detonate_tower': actions.handleDetonateTowerAction(unit); break;
                    case 'throw_mine': setTargetMode('throw_mine'); break;
                    case 'move_mine_start': setTargetMode('move_mine_start'); break;
                    case 'convert_mine': setTargetMode('convert_mine'); break;
                    case 'pickup_flag': actions.handlePickupFlag(); break;
                    case 'drop_flag': actions.handleDropFlag(); break;
                    case 'pickup_mine': actions.handleRangerAction('pickup'); break;
                    case 'drop_mine': actions.handleRangerAction('drop'); break;
                    case 'evolve_a_1': actions.handleEvolution(unit.type, 'a', 1); break;
                    case 'evolve_a_2': actions.handleEvolution(unit.type, 'a', 2); break;
                    case 'evolve_a': actions.handleEvolution(unit.type, 'a'); break;
                    case 'evolve_b_1': actions.handleEvolution(unit.type, 'b', 1); break;
                    case 'evolve_b_2': actions.handleEvolution(unit.type, 'b', 2); break;
                    case 'evolve_b': actions.handleEvolution(unit.type, 'b'); break;
                    case 'end_turn': actions.handleActionComplete(unit.id); break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, actions, setGameState, gameStateRef, setTargetMode]);

    // --- Keyboard Control for Movement (Arrow Keys Only) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;
            if (state.phase === 'thinking') return;
            if (state.phase === 'placement') return;

            if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;

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
                case 'ArrowLeft': dc = -1; break;
                case 'ArrowRight': dc = 1; break;
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
    }, [view, targetMode, actions, gameStateRef, setTargetMode]);

    // --- Keyboard Control for Evolution Tree (Space) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ') {
                e.preventDefault();
                actions.setShowEvolutionTree(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, actions]);

};
