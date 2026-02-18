import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, PlayerState, Building, VFXEffect, TargetMode
} from './types';

import {
    UNIT_STATS, ENERGY_CAP_RATIO, MINE_DAMAGE,
    TURN_TIMER, THINKING_TIMER,
    PLACEMENT_MINE_LIMIT,
    MAX_MINES_ON_BOARD
} from './constants';

import {
    createInitialState
} from './gameInit';
import {
    checkEnergyCap as engineCheckEnergyCap
} from './gameEngine';
import {
    getUnitName, getEnemyTerritoryEnergyCost, getDisplayCost as getDisplayCostRaw,
    getActionButtonIndex as getActionButtonIndexRaw, getEvolutionButtonStartIndex as getEvolutionButtonStartIndexRaw
} from './gameHelpers';
import { useGameAI } from './hooks/useGameAI';
import { useGameLoop, GameLoopActions } from './hooks/useGameLoop';
import { usePlayerActions } from './hooks/usePlayerActions';
import { ChevronLeft, ChevronRight, Info, Snowflake } from './icons';
import { TRANSLATIONS, Language } from './i18n';
import SandboxPanel from './components/SandboxPanel';
import GameHeader from './components/GameHeader';
import GameField from './components/GameField';
import ControlPanel from './components/ControlPanel';
import GameModals from './components/GameModals';



export default function App() {
    const [view, setView] = useState<'lobby' | 'game'>('lobby');
    const [gameState, setGameState] = useState<GameState>(createInitialState('pvp'));
    const [targetMode, setTargetMode] = useState<TargetMode>(null);
    const [selectedMineId, setSelectedMineId] = useState<string | null>(null);
    const [showEvolutionTree, setShowEvolutionTree] = useState(false);
    const [language, setLanguage] = useState<Language>('zh_tw');
    const [musicVolume, setMusicVolume] = useState(0.3);
    const [showGameStartAnimation, setShowGameStartAnimation] = useState(false);
    const [showLog, setShowLog] = useState(true);
    // Lobby state managed in GameModals, but Room ID/Host raised to App for persistence/networking
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [selectedMineType, setSelectedMineType] = useState<MineType>(MineType.NORMAL);
    const audioRef = useRef<HTMLAudioElement>(null);

    const [sandboxPos, setSandboxPos] = useState({ x: 0, y: 0 });
    const [isSandboxCollapsed, setIsSandboxCollapsed] = useState(false);
    const sandboxDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

    const onSandboxDragStart = (e: React.MouseEvent) => {
        sandboxDragRef.current = {
            isDragging: true,
            startX: e.clientX - sandboxPos.x,
            startY: e.clientY - sandboxPos.y,
        };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!sandboxDragRef.current.isDragging) return;

            // Direct state update for zero-latency response
            setSandboxPos({
                x: e.clientX - sandboxDragRef.current.startX,
                y: e.clientY - sandboxDragRef.current.startY,
            });
        };
        const onMouseUp = () => {
            sandboxDragRef.current.isDragging = false;
        };

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);




    const t = useCallback((key: string, params?: Record<string, any>) => {
        let text = (TRANSLATIONS[language] as any)[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{{${k}}}`, String(v));
            });
        }
        return text;
    }, [language]);

    const gameStateRef = useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // Reset selected mine type on mount to prevent persistence
    useEffect(() => {
        setSelectedMineType(MineType.NORMAL);
    }, []);

    // Ref to always get latest selectedMineType (avoids stale closure in useCallback)
    const selectedMineTypeRef = useRef(selectedMineType);
    useEffect(() => {
        selectedMineTypeRef.current = selectedMineType;
    }, [selectedMineType]);


    // --- Timer Logic ---
    // --- Timer Logic (Moved to useGameLoop) ---
    // See useGameLoop hook at the bottom of the component

    const playerActions = usePlayerActions({
        setGameState,
        gameStateRef,
        targetMode,
        setTargetMode,
        setSelectedMineType,
        setShowEvolutionTree,
        addVFX,
        addLog,
    });


    const addLog = (messageKey: string, type: GameLog['type'] = 'info', params?: Record<string, any>, owner?: PlayerID) => {
        setGameState(prev => ({
            ...prev,
            logs: [{ turn: prev.turnCount, messageKey, params, type, owner }, ...prev.logs].slice(0, 100)
        }));
    };

    const addVFX = (type: VFXEffect['type'], r: number, c: number, size: VFXEffect['size'] = 'medium') => {
        setGameState(prev => ({
            ...prev,
            vfx: [...prev.vfx, {
                id: `vfx-${Date.now()}-${Math.random()}`,
                type, r, c, size,
                startTime: Date.now()
            }]
        }));
    };

    // VFX Cleanup Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setGameState(prev => {
                if (prev.vfx.length === 0) return prev;
                const filtered = prev.vfx.filter(v => now - v.startTime < 2000);
                if (filtered.length === prev.vfx.length) return prev;
                return { ...prev, vfx: filtered };
            });
        }, 500);
        return () => clearInterval(timer);
    }, []);

    const getUnit = (id: string, state: GameState = gameState) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };


    const handleStartGame = (mode: 'pvp' | 'pve' | 'sandbox') => {
        setGameState(createInitialState(mode));
        setView('game');
        setShowGameStartAnimation(true);
        setTargetMode(null);

        // Hide animation after 3 seconds
        setTimeout(() => {
            setShowGameStartAnimation(false);
        }, 3000);
    };

    const handleExitGame = () => {
        setView('lobby');
    };

    const handleRestart = () => {
        setGameState(createInitialState(gameState.gameMode));
        setTargetMode(null);
    };







    // --- Helper: Get display cost for UI ---
    const getDisplayCost = (unit: Unit | null, baseCost: number, state: GameState = gameState, actionType: string = 'move') => {
        return getDisplayCostRaw(unit, baseCost, state, actionType);
    };

    // Rule 1: Energy Cap Check
    const checkEnergyCap = (unit: Unit, _player: PlayerState, cost: number) => {
        if (!engineCheckEnergyCap(unit, cost)) {
            const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
            addLog('log_energy_cap', 'error', { cap });
            return false;
        }
        return true;
    };

    const spendEnergy = (pid: PlayerID, amount: number) => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                [pid]: {
                    ...prev.players[pid],
                    energy: prev.players[pid].energy - amount
                }
            }
        }));
    };



    const finishPlacementPhase = () => {
        setGameState(prev => {
            const currentPlayer = prev.players[prev.currentPlayer];

            // Get placed mines for current player
            const playerMines = prev.mines.filter(m => m.owner === prev.currentPlayer);
            const minePositions = playerMines.map(m => `(${m.r + 1},${m.c + 1})`).join(', ');

            // Get unit positions for current player with separator
            const unitPositions = currentPlayer.units
                .map(u => `${getUnitName(u.type)}(${u.r + 1},${u.c + 1})`)
                .join(', ');

            // Create logs
            const newLogs = [...prev.logs];

            // Add unit positions log
            if (unitPositions) {
                newLogs.unshift({
                    turn: 1,
                    messageKey: 'log_placement_units',
                    params: { units: unitPositions },
                    type: 'move' as const,
                    owner: prev.currentPlayer
                });
            }

            // Add mines log
            if (minePositions) {
                newLogs.unshift({
                    turn: 1,
                    messageKey: 'log_placement_mines',
                    params: { mines: minePositions },
                    type: 'move' as const,
                    owner: prev.currentPlayer
                });
            }

            return {
                ...prev,
                phase: 'thinking',
                timeLeft: THINKING_TIMER,
                selectedUnitId: null,
                targetMode: null,
                logs: [{ turn: 1, messageKey: 'log_planning_phase', params: { round: 1 }, type: 'info' as const }, ...newLogs]
            };
        });
    };

    const applyRadarScans = (state: GameState): Mine[] => {
        const newMines = [...state.mines];
        state.buildings.filter(b => b.type === 'tower').forEach(tower => {
            newMines.forEach((m, idx) => {
                if (Math.abs(m.r - tower.r) <= 1 && Math.abs(m.c - tower.c) <= 1) {
                    if (!m.revealedTo.includes(tower.owner)) {
                        newMines[idx] = { ...m, revealedTo: [...m.revealedTo, tower.owner] };
                    }
                }
            });
        });
        return newMines;
    };

    const startActionPhase = () => {
        setGameState(prev => {
            const updatedMines = applyRadarScans(prev);
            return {
                ...prev,
                phase: 'action',
                timeLeft: TURN_TIMER,
                mines: updatedMines,
                players: {
                    ...prev.players,
                    [PlayerID.P1]: {
                        ...prev.players[PlayerID.P1],
                        startOfActionEnergy: prev.players[PlayerID.P1].energy,
                        units: prev.players[PlayerID.P1].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P1].energy }))
                    },
                    [PlayerID.P2]: {
                        ...prev.players[PlayerID.P2],
                        startOfActionEnergy: prev.players[PlayerID.P2].energy,
                        units: prev.players[PlayerID.P2].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P2].energy }))
                    }
                },
                logs: [{ turn: prev.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...prev.logs]
            };
        });
        // Set default targetMode to 'move' when entering action phase
        setTargetMode('move');
    };

    const handleUnitClick = (unit: Unit) => {
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;

        // Placement Phase Logic for Units
        if (state.phase === 'placement') {
            if (unit.owner !== state.currentPlayer) return;

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            if (state.selectedUnitId) {
                const selected = getUnit(state.selectedUnitId);
                if (selected && selected.owner === unit.owner && selected.id !== unit.id) {
                    // Swap!
                    swapUnits(selected.id, unit.id);
                    return;
                }
            }
            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            return;
        }

        if (state.gameMode === 'pve' && unit.owner === PlayerID.P2 && state.currentPlayer === PlayerID.P1 && targetMode !== 'attack') {
            return;
        }

        if (state.phase === 'thinking') {
            // During planning phase, only allow selecting own units
            if (unit.owner !== state.currentPlayer) return;

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            setTargetMode(null);
            return;
        }

        if (unit.hasActedThisRound && unit.owner === state.currentPlayer) {
            addLog('log_unit_acted', 'info');
            return;
        }

        if (state.activeUnitId && state.activeUnitId !== unit.id) {
            if (unit.owner === state.currentPlayer) {
                addLog('log_committed', 'info');
                return;
            }
            // Allow attacking enemy units even if another unit is active
            if (unit.owner !== state.currentPlayer && targetMode === 'attack' && state.selectedUnitId) {
                // Continue to attack logic below
            } else {
                return;
            }
        }

        if (unit.owner === state.currentPlayer) {
            if (unit.isDead) return;

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            setTargetMode('move');
        } else {
            // General Rule: Cannot select enemy units.
            // Sandbox Exception: You CAN select enemy units to drag them or evolve them!
            if (targetMode === 'attack' && state.selectedUnitId) {
                playerActions.handleAttack(state.selectedUnitId, unit);
            }
        }
    };

    const swapUnits = (id1: string, id2: string) => {
        setGameState(prev => {
            const p = prev.players[prev.currentPlayer];
            const u1Index = p.units.findIndex(u => u.id === id1);
            const u2Index = p.units.findIndex(u => u.id === id2);
            if (u1Index === -1 || u2Index === -1) return prev;

            const newUnits = [...p.units];
            const u1 = newUnits[u1Index];
            const u2 = newUnits[u2Index];

            // Swap coords
            const tempR = u1.r;
            const tempC = u1.c;
            newUnits[u1Index] = { ...u1, r: u2.r, c: u2.c };
            newUnits[u2Index] = { ...u2, r: tempR, c: tempC };

            return {
                ...prev,
                selectedUnitId: null,
                players: {
                    ...prev.players,
                    [prev.currentPlayer]: { ...p, units: newUnits }
                }
            }
        });
        addLog('log_swap', 'info');
    };







    const handlePause = () => {
        setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    };

    // --- Background Music Control ---
    useEffect(() => {
        if (!audioRef.current) return;

        if (view === 'game') {
            if (gameState.isPaused || musicVolume === 0) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked, user can click to start
                });
            }
        } else if (view === 'lobby') {
            // Play music in lobby
            if (musicVolume === 0) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked, user can click to start
                });
            }
        }
    }, [gameState.isPaused, musicVolume, view]);

    // --- Initialize Background Music ---
    useEffect(() => {
        if (!audioRef.current) return;

        audioRef.current.loop = true;
        audioRef.current.volume = musicVolume;

        if (musicVolume > 0) {
            if (view === 'game' && !gameState.isPaused) {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked
                });
            } else if (view === 'lobby') {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked
                });
            }
        }
    }, [view, musicVolume, gameState.isPaused]);

    // --- Keyboard Control for Unit Selection (Q, W, E, R, T) ---
    // --- Keyboard Control for Unit Selection (Moved to useGameLoop) ---



    // --- Helper: Calculate button index for action buttons (Moved to gameHelpers.ts, keeping legacy reference if needed by old calls, but now unused) ---
    // const getActionButtonIndex = ... (Removed)
    actions.push('end_turn');


    const idx = actions.indexOf(actionType);
    return idx !== -1 ? idx + 1 : -1;
};
// --- Keyboard Control for Action Selection (Moved to useGameLoop) ---


// --- Keyboard Control for Movement (Moved to useGameLoop) ---


// --- Keyboard Control for Evolution Tree (Moved to useGameLoop) ---






/*
// Apply Reflection Damage (Defuser A3-1)
if (reflectDmg > 0) {
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const enemyState = nextStatePlayers[enemyId];
    if (enemyState.units.length > 0) {
        // Find lowest HP living enemy
        const livingEnemies = enemyState.units.filter(u => !u.isDead);
        if (livingEnemies.length > 0) {
            // Sort by HP, then ID (stability)
            livingEnemies.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
            const target = livingEnemies[0];
 
            const newEnemyHp = Math.max(0, target.hp - reflectDmg);
            const isEnemyDead = newEnemyHp === 0;
            let respawnTimer = 0;
            if (isEnemyDead && target.type !== UnitType.GENERAL) {
                respawnTimer = nextTurn <= 10 ? 2 : 3;
            }
 
            // Update Enemy
            nextStatePlayers[enemyId] = {
                ...enemyState,
                units: enemyState.units.map(u => u.id === target.id ? { ...u, hp: newEnemyHp, isDead: isEnemyDead, respawnTimer } : u)
            };
 
            // Add Log
            newLogs.unshift({
                turn: nextTurn,
                messageKey: 'log_evol_def_reflect_hit', // Make sure this key exists or use generic
                params: { unit: getUnitName(target.type), dmg: reflectDmg },
                type: 'combat' as const,
                owner: unit.owner
            });
        }
    }
}
 
// Apply Unit Update (HP, MaxHP, Position, Energy)
const pState = nextStatePlayers[unit.owner];
nextStatePlayers[unit.owner] = {
    ...pState,
    units: pState.units.map(u => u.id === unit.id ? {
        ...u,
        r, c,
        hp: newHp,
        maxHp: newMaxHp, // Update MaxHP
        isDead,
        energyUsedThisTurn: u.energyUsedThisTurn + totalCost,
        status: appliedStatus,
        carriedMine: appliedStatus.carriedMine !== undefined ? appliedStatus.carriedMine : u.carriedMine
    } : u),
    questStats: qStats
};
 
return {
    ...prevState,
    turnCount: nextTurn, // Why nextTurn? attemptMove does NOT increment turn count. 
    // Wait, logic above was using turnCount. attemptMove logic:
    // "nextTurn" was typically used for "Start New Round".
    // Here we are inside "attemptMove", which does NOT change turnCount.
    // Oh, I see "nextTurn" usage in the previous code block (Step 997).
    // Line 3400: `respawnTimer = nextTurn <= 10...`
    // Wait, `nextTurn` is NOT defined in `attemptMove`.
    // `attemptMove` uses `currentState.turnCount`.
    // I should use `currentState.turnCount`.
    // But wait, the previous `startNewRound` function defined `nextTurn`.
    // `attemptMove` is separate.
    // I must replace usage of `nextTurn` with `currentState.turnCount`.
 
    // Correction: `attemptMove` shouldn't update `turnCount`. 
    // I should just update players.
 
    phase: 'action', // Ensure we stay in action
    timeLeft: prevState.timeLeft, // Keep time
    activeUnitId: unit.id, // Set active? Or just move?
    // Usually move -> lock unit -> done.
    cells: prevState.cells, // Cells don't change unless obstacle? (Mine removal is in mines)
    mines: newMines,
    buildings: currentBuildings, // Update buildings (Hub removal) (Wait, Hub removal was in `handleTeleport`?)
    // `currentBuildings` defined in `attemptMove` logic earlier? Yes line 3528.
 
    movements: [...prevState.movements, { unitId: unit.id, from: { r: unit.r, c: unit.c }, to: { r, c } }],
    players: nextStatePlayers,
    logs: [...newLogs, ...prevState.logs]
};
    });
};
*/







// --- Player Actions & Game Loop ---
const playerActions = usePlayerActions({
    setGameState,
    gameStateRef,
    targetMode,
    setTargetMode,
    setSelectedMineType,
    setShowEvolutionTree,
    addVFX,
    addLog,
});

const gameLoopActions: GameLoopActions = {
    ...playerActions,
    handlePlaceMineAction: playerActions.handleMinePlacement,
    handlePlaceTowerAction: playerActions.handlePlaceTower,
    handlePlaceFactoryAction: playerActions.handlePlaceFactory,
    handlePlaceHubAction: playerActions.handlePlaceHub,
    handleTeleportToHubAction: playerActions.handleTeleportToHub,
    handleDisarmAction: playerActions.handleDisarm,
    handleDetonateTowerAction: playerActions.handleDetonateTower,
    handleRangerAction: playerActions.handleRanger,
    addLog,
    startActionPhase: () => startActionPhase(),
    finishPlacementPhase: () => finishPlacementPhase(),
    handleUnitClick: (u) => handleUnitClick(u),
    applyRadarScans: (s) => applyRadarScans(s),
    setShowEvolutionTree,
};

useGameLoop({
    gameStateRef,
    setGameState,
    view,
    targetMode,
    setTargetMode,
    actions: gameLoopActions,
});

useGameAI({
    gameState,
    attemptMove: playerActions.attemptMove,
    handleActionComplete: playerActions.handleActionComplete,
});

const handleCellClick = useCallback((r: number, c: number) => {
    // === IMMEDIATE TIME FREEZE - FIRST LINE === 
    // Set frozen state BEFORE any logic to ensure UI updates in the same frame as the click.
    const state = gameStateRef.current;
    if (state.gameOver || state.isPaused) return;

    // Check if this action will cause time freeze
    const isActionPotentiallyFreezing =
        targetMode === 'move' || targetMode === 'attack' || targetMode === 'scan' ||
        targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'place_tower' ||
        targetMode === 'place_factory' || targetMode === 'place_hub' || targetMode === 'teleport' ||
        targetMode === 'throw_mine' || targetMode === 'convert_mine';

    // GUARD CLAUSE: Only freeze if NOT already frozen (prevents state overlapping)
    if (isActionPotentiallyFreezing && !state.isTimeFrozen) {
        // INSTANT FREEZE: Set both ref (for immediate UI) and state (for timer logic) 
        // Use flushSync to guarantee DOM update happens NOW, not on next tick
        flushSync(() => {
            setGameState(prev => ({
                ...prev,
                isTimeFrozen: true,
                lastActionTime: Date.now()
            }));
        });
    }

    // Execute logic synchronously - no delays
    executeCellClickLogic(r, c);
}, [targetMode, playerActions, selectedMineType, setTargetMode, setGameState]); // Re-create when dependencies change

const executeCellClickLogic = (r: number, c: number) => {
    const state = gameStateRef.current; // Re-fetch current state inside the deferred execution
    if (state.gameOver || state.isPaused) return;

    const cell = state.cells[r][c];
    const unitInCell = state.players[PlayerID.P1].units.find(u => u.r === r && u.c === c && !u.isDead) ||
        state.players[PlayerID.P2].units.find(u => u.r === r && u.c === c && !u.isDead);

    // Placement Phase
    if (state.phase === 'placement') {
        if (targetMode === 'place_setup_mine') {
            // Valid Zone Check
            const isP1Zone = c < 12;
            const isMyZone = state.currentPlayer === PlayerID.P1 ? isP1Zone : !isP1Zone;

            if (!isMyZone) {
                addLog('log_mine_zone', 'error');
                return;
            }

            if (cell.isObstacle || unitInCell) {
                addLog('log_obstacle', 'error');
                return;
            }

            const player = state.players[state.currentPlayer];
            if (player.placementMinesPlaced >= PLACEMENT_MINE_LIMIT) {
                addLog('log_mine_limit', 'error');
                return;
            }

            setGameState(prev => {
                const p = prev.players[prev.currentPlayer];
                return {
                    ...prev,
                    mines: [...prev.mines, { id: `pm-${Date.now()}`, owner: prev.currentPlayer, type: MineType.NORMAL, r, c, revealedTo: [] }],
                    players: {
                        ...prev.players,
                        [prev.currentPlayer]: { ...p, placementMinesPlaced: p.placementMinesPlaced + 1 }
                    }
                }
            });
            return;
        }

        // Rule 4: "Cannot move to other places, can only swap"
        // If clicking empty cell, DO NOTHING in placement phase (unless placing mine above)
        if (!unitInCell) {
            return;
        }
        // If clicking own unit, handle selection (which leads to swap logic in handleUnitClick)
        if (unitInCell.owner === state.currentPlayer) {
            handleUnitClick(unitInCell);
        }
        return;
    }

    // Thinking Phase
    if (state.phase === 'thinking') return;

    if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;

    // Handle Skill Targeting - MUST BE BEFORE unitInCell CHECK
    if (state.selectedUnitId && (targetMode === 'scan' || targetMode === 'sensor_scan' || targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'teleport' || targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'throw_mine' || targetMode === 'place_factory' || targetMode === 'move_mine_start' || targetMode === 'move_mine_end' || targetMode === 'convert_mine' || targetMode === 'pickup_mine_select')) {
        const unit = getUnit(state.selectedUnitId);
        if (unit) {
            if (targetMode === 'teleport') {
                // Sandbox Teleport: Move unit anywhere instantly
                setGameState(prev => {
                    const pId = unit.owner;
                    const pState = prev.players[pId];
                    const newUnits = pState.units.map(u => u.id === unit.id ? { ...u, r, c } : u);
                    return {
                        ...prev,
                        players: { ...prev.players, [pId]: { ...pState, units: newUnits } }
                    };
                });
                setTargetMode(null);
                return;
            }
            if (targetMode === 'scan' && unit.type === UnitType.MINESWEEPER) {
                playerActions.handleScanAction(unit, r, c);
                return;
            }
            if (targetMode === 'sensor_scan' && unit.type === UnitType.MINESWEEPER) {
                playerActions.handleSensorScan(unit.id, r, c);
                return;
            }
            if (targetMode === 'place_mine' && unit.type === UnitType.MAKER) {
                const currentMineType = selectedMineTypeRef.current;
                console.log('[DEBUG] App.tsx handleCellClick - selectedMineTypeRef.current:', currentMineType);
                playerActions.handleMinePlacement(unit, r, c, currentMineType);
                return;
            }
            if (targetMode === 'disarm' && unit.type === UnitType.DEFUSER) {
                playerActions.handleDisarm(unit, r, c);
                return;
            }
            if (targetMode === 'place_tower' && unit.type === UnitType.MINESWEEPER) {
                playerActions.handlePlaceTower(unit, r, c);
                return;
            }
            if (targetMode === 'place_hub' && unit.type === UnitType.RANGER) {
                playerActions.handlePlaceHub(unit, r, c);
                return;
            }
            if (targetMode === 'throw_mine' && unit.type === UnitType.RANGER) {
                playerActions.handleThrowMine(unit, r, c);
                return;
            }
            if (targetMode === 'place_factory' && unit.type === UnitType.MAKER) {
                playerActions.handlePlaceFactory(unit, r, c);
                return;
            }
            if (targetMode === 'move_mine_start' && unit.type === UnitType.DEFUSER) {
                const mine = state.mines.find(m => m.r === r && m.c === c && m.owner !== unit.owner);
                if (mine) {
                    setSelectedMineId(mine.id);
                    setTargetMode('move_mine_end');
                    // addLog('log_select_action', 'info'); // Generic 'selected' - handled by UI or redundant
                }
                return;
            }
            if (targetMode === 'move_mine_end' && unit.type === UnitType.DEFUSER && selectedMineId) {
                const mine = state.mines.find(m => m.id === selectedMineId);
                if (mine) {
                    playerActions.handleMoveEnemyMine(unit, mine.id, r, c);
                }
                setSelectedMineId(null);
                setTargetMode(null);
                return;
            }
            if (targetMode === 'convert_mine' && unit.type === UnitType.DEFUSER) {
                playerActions.handleConvertEnemyMine(unit, r, c);
                return;
            }
            if (targetMode === 'pickup_mine_select' && unit.type === UnitType.RANGER) {
                playerActions.handlePickupMine(unit, r, c);
                return;
            }
        }
    }

    if (unitInCell) {
        if (unitInCell.owner === state.currentPlayer) {
            handleUnitClick(unitInCell);
            return;
        }
        if (targetMode === 'attack' && state.selectedUnitId) {
            handleUnitClick(unitInCell);
            return;
        }
    }

    if (state.selectedUnitId) {
        const unit = getUnit(state.selectedUnitId);
        if (!unit || unit.owner !== state.currentPlayer) return;

        if (targetMode === 'move') {
            const dist = Math.abs(unit.r - r) + Math.abs(unit.c - c);
            if (dist === 1 && !unitInCell && !state.cells[r][c].isObstacle) {
                // --- General Evolution Logic: Path B (Reduce Flag Move Cost) ---
                const player = state.players[unit.owner];
                const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;

                let baseCost = UNIT_STATS[unit.type].moveCost;
                if (unit.hasFlag) {
                    if (unit.type === UnitType.GENERAL) {
                        // Gen Path B Level 3: Cost reduced to 4 (normally 5)
                        baseCost = (genLevelB >= 3) ? 4 : UNIT_STATS[UnitType.GENERAL].flagMoveCost;
                    } else if (genLevelB >= 3) {
                        // Gen Path B Level 3: Any unit can carry flag, cost is 4
                        baseCost = 4;
                    } else {
                        // Should technically not happen if only General can carry, but fail safe
                        baseCost = 5;
                    }
                } else if (unit.type === UnitType.RANGER && unit.carriedMine) {
                    // Ranger carrying mine costs 3 to move
                    baseCost = 3;
                }

                // Apply debuffs and territory costs via getDisplayCost
                const finalCost = getDisplayCost(unit, baseCost, state);
                playerActions.attemptMove(unit.id, r, c, finalCost);
            }
        }
    }
};


return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none">
        {/* Background Music */}
        <audio
            ref={audioRef}
            src={view === 'lobby' ? '/日常を描いたbgmdailyフリー素材.mp3' : '/the-final-boss-battle-158700.mp3'}
            loop
        />

        {/* Modals & Lobby System */}
        <GameModals
            view={view}
            gameState={gameState}
            language={language}
            setLanguage={setLanguage}
            onStartGame={handleStartGame}
            onExitGame={handleExitGame}
            onRestart={handleRestart}
            onPauseToggle={handlePause}
            isHost={isHost}
            setIsHost={setIsHost}
            roomId={roomId}
            setRoomId={setRoomId}
            t={t}
        />

        {view === 'game' && (
            <>
                {/* Game Start Animation */}
                {showGameStartAnimation && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 animate-fade-out" style={{
                        animation: 'fadeOut 3s ease-in-out forwards'
                    }}>
                        <style>{`
                @keyframes fadeOut {
                  0% { opacity: 1; }
                  70% { opacity: 1; }
                  100% { opacity: 0; }
                }
              `}</style>
                        <div className="text-center">
                            <div className="text-6xl font-black text-white mb-4 animate-pulse">
                                開始
                            </div>
                            <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                                BATTLE START
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Header */}
                {/* Game Header */}
                <GameHeader
                    gameState={gameState}
                    language={language}
                    setLanguage={setLanguage}
                    musicVolume={musicVolume}
                    setMusicVolume={setMusicVolume}
                    onPauseToggle={handlePause}
                    onExitGame={handleExitGame}
                    t={t}
                />

                {/* Main Game Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative"
                    style={{
                        background: 'linear-gradient(135deg, #0a0e27 0%, #1a0033 25%, #0a0e27 50%, #1a0033 75%, #0a0e27 100%)',
                        backgroundSize: '400% 400%',
                        animation: 'gradientShift 15s ease infinite'
                    }}>
                    {/* Neon Grid Background */}
                    <div className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: `
                       linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent),
                       linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent)
                     `,
                            backgroundSize: '60px 60px',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}>
                    </div>

                    {/* Meteors - Behind Board */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9 }}>
                        <style>{`
                                @keyframes meteorFall {
                                    0% {
                                        transform: translateY(-200px) translateX(0);
                                        opacity: 0;
                                    }
                                    10% {
                                        opacity: 1;
                                    }
                                    90% {
                                        opacity: 1;
                                    }
                                    100% {
                                        transform: translateY(calc(100vh + 200px)) translateX(400px);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                        {Array.from({ length: 25 }).map((_, i) => (
                            <div
                                key={`meteor-${i}`}
                                className="absolute"
                                style={{
                                    left: `${(i * 13 + 7) % 100}%`,
                                    top: '-200px',
                                    animation: `meteorFall ${3 + (i % 5)}s linear infinite`,
                                    animationDelay: `${i * 0.5}s`,
                                    opacity: 0
                                }}
                            >
                                <div style={{
                                    width: '2px',
                                    height: `${80 + (i % 6) * 20}px`,
                                    background: 'linear-gradient(to bottom, rgba(0, 255, 255, 0), rgba(200, 255, 255, 0.8))',
                                    boxShadow: '0 0 15px rgba(0, 255, 255, 0.6)',
                                    transform: 'rotate(-25deg)',
                                    transformOrigin: 'bottom center'
                                }} />
                            </div>
                        ))}
                    </div>

                    {/* Background Decorative Elements */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
                        {/* Aurora Effect */}
                        <div className="absolute inset-[-50%]" style={{
                            background: 'linear-gradient(45deg, transparent 40%, rgba(0, 255, 128, 0.3) 50%, transparent 60%)',
                            filter: 'blur(60px)',
                            animation: 'aurora-flow 8s ease-in-out infinite alternate',
                            transformOrigin: 'center'
                        }}></div>
                        <div className="absolute inset-[-50%]" style={{
                            background: 'linear-gradient(-45deg, transparent 40%, rgba(50, 255, 100, 0.2) 50%, transparent 60%)',
                            filter: 'blur(40px)',
                            animation: 'aurora-flow 12s ease-in-out infinite alternate-reverse',
                            transformOrigin: 'center',
                            animationDelay: '-4s'
                        }}></div>
                    </div>

                    {/* Animated Energy Waves - Blue - Slower */}
                    <div className="absolute inset-0" style={{
                        background: 'radial-gradient(circle at 30% 40%, rgba(0, 150, 255, 0.6) 0%, transparent 50%)',
                        animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        zIndex: 1
                    }}></div>

                    {/* Animated Energy Waves - Red - Slower */}
                    <div className="absolute inset-0" style={{
                        background: 'radial-gradient(circle at 70% 60%, rgba(255, 50, 100, 0.5) 0%, transparent 50%)',
                        animation: 'pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        animationDelay: '0.5s',
                        zIndex: 1
                    }}></div>

                    {/* Animated Energy Waves - Purple - Slower */}
                </div>

                {/* Content Container (Layered above the background) */}
                <div className="flex-1 flex flex-col overflow-hidden relative" style={{ zIndex: 10 }}>
                    <div className="flex-1 flex flex-row overflow-hidden relative">

                        {/* Board + Timer Container */}
                        <div className="flex-1 flex flex-col overflow-visible relative">
                            {/* Game Board */}
                            <GameField
                                gameState={gameState}
                                targetMode={targetMode}
                                handleCellClick={handleCellClick}
                                handleUnitClick={(u) => setGameState(prev => ({ ...prev, selectedUnitId: u.id }))}
                            />

                            {/* Timer Bar Below Board */}
                            <div className="w-full px-8 py-3 flex items-center justify-center gap-6 relative z-20">
                                <span className="text-white font-bold text-lg min-w-[80px]">
                                    {gameState.phase === 'placement' ? t('placement_phase') : gameState.phase === 'thinking' ? t('planning_phase') : t('action_phase')}
                                </span>
                                <div className="flex-1 max-w-2xl">
                                    <div className="w-full h-5 bg-slate-900 rounded-full overflow-hidden border-2 border-white/50 shadow-lg">
                                        {(() => {
                                            const maxTime = gameState.phase === 'placement' ? 45 : gameState.phase === 'thinking' ? 30 : 15;
                                            const percentage = (gameState.timeLeft / maxTime) * 100;
                                            // 顏色邏輯
                                            const color = percentage >= 67 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/60' :
                                                percentage >= 34 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/60' :
                                                    'bg-red-500 shadow-lg shadow-red-500/60';
                                            // Sync transition with time freeze: 
                                            // If frozen, use very fast transition to halt visual movement instantly.
                                            // Normal: 1s linear transition for smooth countdown.
                                            const transitionClass = percentage >= 99
                                                ? ''
                                                : gameState.isTimeFrozen
                                                    ? 'transition-none'
                                                    : 'transition-all duration-150 ease-linear';
                                            return (
                                                <div
                                                    className={`h-full ${color} ${transitionClass}`}
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end min-w-[80px]">
                                    <div
                                        className={`transition-opacity duration-75 ease-in-out ${gameState.isTimeFrozen ? 'opacity-100' : 'opacity-0'}`}
                                    >
                                        <Snowflake size={18} className="text-cyan-300 animate-spin-slow" />
                                    </div>
                                    <span className={`font-bold text-lg text-right transition-colors duration-75 ${gameState.isTimeFrozen ? 'text-cyan-300' : 'text-white'}`}>
                                        {Math.ceil(gameState.timeLeft)}s
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Log Panel Container */}
                        <div className={`shrink-0 z-20 relative transition-all duration-500 ease-in-out flex flex-row ${showLog ? 'w-80' : 'w-0'}`}>

                            {/* Toggle Button - Floating on the left edge of the panel */}
                            <button
                                onClick={() => setShowLog(!showLog)}
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-8 h-24 bg-slate-900 border-2 border-white border-r-0 rounded-l-2xl flex flex-col items-center justify-center text-white hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] z-30 group"
                                title={showLog ? t('hide_log') : t('show_log')}
                            >
                                {showLog ? <ChevronRight size={20} className="group-hover:scale-125 transition-transform" /> : <ChevronLeft size={20} className="group-hover:scale-125 transition-transform" />}
                                <div className="text-[10px] font-black uppercase vertical-text mt-1 opacity-50 group-hover:opacity-100 transition-opacity">LOG</div>
                            </button>

                            {/* Log Panel Content */}
                            <div className={`w-80 h-full bg-slate-900 border-l-4 border-white flex flex-col text-sm transition-all duration-500 ${!showLog ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                <div className="shrink-0 p-3 font-black border-b-2 border-white bg-slate-800 flex items-center gap-2 text-white">
                                    <Info size={18} />
                                    <span className="text-lg whitespace-nowrap overflow-hidden">{t('update_log')}</span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2 text-sm scrollbar-thin scrollbar-thumb-white/30 text-white">
                                    {gameState.logs.map((log, i) => {
                                        // Determine color based on type and owner
                                        // Blue = P1 (always viewer), Red = P2 (always enemy)
                                        let bgColor = 'bg-slate-800/50 border-white text-white';

                                        if (log.type === 'error') {
                                            bgColor = 'bg-slate-700/40 border-slate-500 text-slate-300';
                                        } else if (log.type === 'evolution') {
                                            bgColor = 'bg-purple-950/40 border-purple-500 text-purple-200';
                                        } else if (log.type === 'combat' || log.type === 'mine' || log.type === 'move') {
                                            // Combat/Mine/Move: Blue if P1, Red if P2
                                            if (log.owner === PlayerID.P1) {
                                                bgColor = 'bg-blue-950/40 border-blue-500 text-blue-200';
                                            } else if (log.owner === PlayerID.P2) {
                                                bgColor = 'bg-red-950/40 border-red-500 text-red-200';
                                            }
                                        } else {
                                            // Info/System: Yellow
                                            bgColor = 'bg-yellow-950/40 border-yellow-500 text-yellow-200';
                                        }

                                        return (
                                            <div key={i} className={`p-2 rounded border-l-4 leading-tight font-bold text-xs ${bgColor}`}>
                                                <span className="opacity-60 text-[10px] mr-2 font-bold text-gray-400">[{log.turn}]</span>
                                                {t(log.messageKey, log.params)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Control Panel (Sticks to bottom) */}
                    <ControlPanel
                        gameState={gameState}
                        setGameState={setGameState}
                        targetMode={targetMode}
                        setTargetMode={setTargetMode}
                        selectedMineType={selectedMineType}
                        setSelectedMineType={setSelectedMineType}
                        showEvolutionTree={showEvolutionTree}
                        setShowEvolutionTree={setShowEvolutionTree}
                        language={language}
                        t={t}
                        actions={{
                            handleActionComplete: playerActions.handleActionComplete,
                            handleScanAction: playerActions.handleScanAction,
                            handlePlaceMineAction: playerActions.handleMinePlacement,
                            handleEvolve: playerActions.handleEvolution,
                            handlePickupFlag: playerActions.handlePickupFlag,
                            handleDropFlag: playerActions.handleDropFlag,
                            handleAttack: playerActions.handleAttack,
                            handleStealth: playerActions.handleStealth,
                        }}
                        helpers={{
                            getUnit: (id) => id ? (gameState.players[PlayerID.P1].units.concat(gameState.players[PlayerID.P2].units).find(u => u.id === id) ?? null) : null,
                            getActionButtonIndex: (action, unit) => unit ? getActionButtonIndexRaw(action, unit, gameState) : -1,
                            getEvolutionButtonStartIndex: (unit) => getEvolutionButtonStartIndexRaw(unit, gameState),
                            getDisplayCost: (unit, cost) => getDisplayCostRaw(unit, cost, gameState),
                            getNextUnitToAct: () => {
                                const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
                                for (const type of unitTypes) {
                                    const unit = gameState.players[gameState.currentPlayer].units.find(u => u.type === type);
                                    if (unit && !unit.isDead && !unit.hasActedThisRound) return unit;
                                }
                                return null;
                            }
                        }}
                        phases={{
                            finishPlacementPhase: () => { },
                            startActionPhase: () => { }
                        }}
                        handleUnitClick={(u) => setGameState(prev => ({ ...prev, selectedUnitId: u.id }))}
                        handleDisarmAction={playerActions.handleDisarm}
                        handlePlaceTowerAction={playerActions.handlePlaceTower}
                        handleDetonateTowerAction={playerActions.handleDetonateTower}
                        handlePlaceFactoryAction={playerActions.handlePlaceFactory}
                        handlePlaceHubAction={playerActions.handlePlaceHub}
                        handleTeleportToHubAction={playerActions.handleTeleportToHub}
                        handleStealthAction={playerActions.handleStealth}
                        handleRangerAction={playerActions.handleRanger}
                    />
                </div>

                {/* Sandbox Panel Overlay */}
                {gameState.gameMode === 'sandbox' && (
                    <SandboxPanel
                        gameState={gameState}
                        setGameState={setGameState}
                        startNewRound={playerActions.startNewRound}
                        language={language}
                        isSandboxCollapsed={isSandboxCollapsed}
                        setIsSandboxCollapsed={setIsSandboxCollapsed}
                        sandboxPos={sandboxPos}
                        onSandboxDragStart={onSandboxDragStart}
                        targetMode={targetMode}
                        setTargetMode={setTargetMode}
                    />
                )}
            </>
        )}
    </div>
);
        }
