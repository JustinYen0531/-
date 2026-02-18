import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, PlayerState, Building, VFXEffect
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
    getUnitName, getEnemyTerritoryEnergyCost, getDisplayCost as getDisplayCostRaw
} from './gameHelpers';
import { useGameAI } from './hooks/useGameAI';
import { useGameLoop } from './hooks/useGameLoop';
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
    const [targetMode, setTargetMode] = useState<'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null>(null);
    const [selectedMineId, setSelectedMineId] = useState<string | null>(null);
    const [showEvolutionTree, setShowEvolutionTree] = useState(false);
    const [language, setLanguage] = useState<Language>('zh_tw');
    const [musicVolume, setMusicVolume] = useState(0.3);
    const [showGameStartAnimation, setShowGameStartAnimation] = useState(false);
    const [showLog, setShowLog] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false); // Independent state for zero-latency feedback
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
                const filtered = prev.vfx.filter(v => now - v.startTime < 1000);
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




    const handlePlaceTowerAction = (unit: Unit, r: number, c: number) => {
        const swpLevelA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].aVariant;

        const baseCost = 8;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const towerLimit = (swpLevelA === 3 && variantA === 1) ? 2 : 1;
            const existingTowers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');

            let filteredBuildings = prev.buildings;
            if (existingTowers.length >= towerLimit) {
                const toRemove = existingTowers[0];
                filteredBuildings = filteredBuildings.filter(b => b.id !== toRemove.id);
            }

            const newBuilding: Building = {
                id: `tower-${unit.owner}-${Date.now()}`,
                type: 'tower',
                owner: unit.owner,
                r, c,
                level: swpLevelA,
                duration: swpLevelA >= 2 ? undefined : 2
            };

            const newMines = prev.mines.map(m => {
                if (Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1) {
                    if (!m.revealedTo.includes(unit.owner)) {
                        return { ...m, revealedTo: [...m.revealedTo, unit.owner] };
                    }
                }
                return m;
            });

            return {
                ...prev,
                buildings: [...filteredBuildings, newBuilding],
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    {
                        turn: prev.turnCount, messageKey: 'log_placed_building', params: {
                            type: '偵測塔'
                        }, owner: unit.owner, type: 'info' as const
                    },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
    };

    const handleDetonateTowerAction = (unit: Unit) => {
        const swpLevelA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].aVariant;
        if (swpLevelA !== 3 || variantA !== 2) return;

        const cost = 2;
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const towers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            if (towers.length === 0) return prev;

            // Detonate all mines (regardless of owner) in 3x3 range of any tower
            const minesToRemove = prev.mines.filter(m =>
                towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
            ).map(m => m.id);

            const remainingBuildings = prev.buildings.filter(b =>
                !(b.owner === unit.owner && b.type === 'tower')
            );

            return {
                ...prev,
                mines: prev.mines.filter(m => !minesToRemove.includes(m.id)),
                buildings: remainingBuildings,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_swp_detonate', 'mine', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
        setTargetMode(null);
    };



    const lockUnit = (unitId: string) => {
        setGameState(prev => {
            const unit = getUnit(unitId, prev);
            if (!unit) return prev;

            const playerState = prev.players[unit.owner];
            const updatedUnits = playerState.units.map(u =>
                u.id === unitId ? { ...u, startOfActionEnergy: playerState.energy } : u
            );

            return {
                ...prev,
                activeUnitId: unitId,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...playerState,
                        startOfActionEnergy: playerState.energy,
                        units: updatedUnits
                    }
                }
            };
        });
    };



    const handleRangerAction = (subAction: 'pickup' | 'drop') => {
        const unitId = gameState.selectedUnitId;
        if (!unitId) return;
        const unit = getUnit(unitId);
        if (!unit || unit.type !== UnitType.RANGER) return;
        const p = gameState.players[unit.owner];

        if (subAction === 'pickup') {
            const rngLevelB = p.evolutionLevels[UnitType.RANGER].b;
            const pickupRadius = rngLevelB >= 1 ? 1 : 0;

            const minesInRange = gameState.mines.filter(m =>
                Math.abs(m.r - unit.r) <= pickupRadius &&
                Math.abs(m.c - unit.c) <= pickupRadius &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );

            if (minesInRange.length === 0) {
                addLog('log_no_mine', 'error');
                return;
            }

            if (minesInRange.length === 1 || pickupRadius === 0) {
                handlePickupMineAt(unit, minesInRange[0].r, minesInRange[0].c);
            } else {
                setTargetMode('pickup_mine_select');
                addLog('log_select_action', 'info');
            }
        } else {
            if (!unit.carriedMine) return;
            const existingMine = gameState.mines.find(m => m.r === unit.r && m.c === unit.c);
            if (existingMine) {
                addLog('log_space_has_mine', 'info');
                return;
            }
            if (gameState.cells[unit.r][unit.c].isObstacle) {
                addLog('log_obstacle', 'info');
                return;
            }

            if (gameState.mines.filter(m => m.owner === unit.owner).length >= MAX_MINES_ON_BOARD) {
                addLog('log_max_mines', 'error');
                return;
            }

            setGameState(prev => {
                const p = prev.players[unit.owner];
                const newUnits = p.units.map(u => u.id === unit.id ? { ...u, carriedMine: null } : u);

                const newMine: Mine = {
                    id: `m-${Date.now()}`,
                    owner: unit.owner,
                    type: unit.carriedMine!.type,
                    r: unit.r,
                    c: unit.c,
                    revealedTo: [unit.owner]
                };

                return {
                    ...prev,
                    mines: [...prev.mines, newMine],
                    players: {
                        ...prev.players,
                        [unit.owner]: { ...p, units: newUnits }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_place_mine', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
            lockUnit(unit.id);
        }
    };

    const handlePickupMineAt = (unit: Unit, r: number, c: number) => {
        const mineIndex = gameState.mines.findIndex(m => m.r === r && m.c === c);
        if (mineIndex === -1) return;
        const mine = gameState.mines[mineIndex];

        setGameState(prev => {
            const newMines = [...prev.mines];
            newMines.splice(mineIndex, 1);
            const p = prev.players[unit.owner];
            const qStats = { ...p.questStats };

            if (!qStats.rangerMinesMovedThisRound) qStats.rangerMinesMovedThisRound = new Set();
            else qStats.rangerMinesMovedThisRound = new Set(qStats.rangerMinesMovedThisRound);

            const mineId = `carried-${unit.id}`;
            if (!qStats.rangerMinesMovedThisRound.has(mineId)) {
                qStats.rangerMinesMoved += 1;
                qStats.rangerMinesMovedThisRound.add(mineId);
            }

            const newUnits = p.units.map(u => u.id === unit.id ? { ...u, carriedMine: mine } : u);

            return {
                ...prev,
                mines: newMines,
                players: { ...prev.players, [unit.owner]: { ...p, units: newUnits, questStats: qStats } },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        addLog('log_pickup_mine', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        lockUnit(unit.id);
        setTargetMode(null);
    };

    const handleStealthAction = (unitId: string) => {
        const unit = getUnit(unitId);
        if (!unit) return;
        const player = gameState.players[unit.owner];

        // Toggle off if already stealthed (No cost)
        if (unit.status.isStealthed) {
            setGameState(prev => {
                const p = prev.players[unit.owner];
                const updatedUnits = p.units.map(u => u.id === unitId ? {
                    ...u,
                    status: { ...u.status, isStealthed: false }
                } : u);
                return {
                    ...prev,
                    players: { ...prev.players, [unit.owner]: { ...p, units: updatedUnits } }
                };
            });
            return;
        }

        const cost = 3;
        if (player.energy < cost) {
            addLog('log_low_energy', 'error', { cost });
            return;
        }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const updatedUnits = p.units.map(u => u.id === unitId ? {
                ...u,
                energyUsedThisTurn: u.energyUsedThisTurn + cost,
                status: { ...u.status, isStealthed: true }
            } : u);

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, energy: p.energy - cost, units: updatedUnits }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        addLog('log_evolved', 'evolution', { unit: getUnitName(unit.type), branch: 'B', level: 2 });
    };


    const handlePlaceHubAction = (unit: Unit, r: number, c: number) => {
        const baseCost = 8;
        const cost = getDisplayCost(unit, baseCost, gameState, 'place_hub');
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const filteredBuildings = prev.buildings.filter(b => !(b.owner === unit.owner && b.type === 'hub'));
            const hubLevelA = p.evolutionLevels[UnitType.RANGER].a;
            const hubVariantA = p.evolutionLevels[UnitType.RANGER].aVariant;
            const newBuilding: Building = {
                id: `hub-${unit.owner}-${Date.now()}`,
                type: 'hub',
                owner: unit.owner,
                r, c,
                level: hubLevelA,
                variant: hubVariantA,
                duration: undefined
            };

            return {
                ...prev,
                buildings: [...filteredBuildings, newBuilding],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '傳送道標' }, owner: unit.owner, type: 'info' as const },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
    };

    const handleTeleportToHubAction = (unit: Unit) => {
        const hub = gameState.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        if (!hub) return;

        const levelA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].aVariant;

        let cost = 6; // Default for others (A3-2)
        if (unit.type === UnitType.RANGER) {
            if (levelA >= 2) {
                if (levelA === 3 && variantA === 2) cost = 4; // A3-2: Ranger Cost 4
                else cost = 0; // A2: Ranger Cost 0 (Consumable)
            } else {
                cost = 4; // Base Ranger? Or cannot teleport?
                // Actually Base Ranger cannot teleport without Hub.
                // Hub allows teleport.
                // If Level 1 Hub? Can trigger move cost reduction.
                // But Action "Teleport" is A2+.
                // If A1 Ranger tries to teleport? Should fail or not be available?
                // Assuming button only available if valid.
            }
        } else {
            // Non-Ranger
            if (!(levelA === 3 && variantA === 2)) return; // Only A3-2 allows others
            cost = 6;
        }

        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        // Check if hub is blocked by another unit
        const isOccupied = gameState.players[PlayerID.P1].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead) ||
            gameState.players[PlayerID.P2].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead);

        if (isOccupied && !(hub.r === unit.r && hub.c === unit.c)) {
            addLog('log_space_has_mine', 'info'); // Reuse 'occupied' error
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const pId = unit.owner;
            const pState = prev.players[pId];

            // Tier 2: Hub disappears when Ranger teleports. Tier 3.2: Hub persists? 
            // Description says "銝??賡?嚗?撱箇?瘨仃" for Lv2 Ranger.
            const levelA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].a;
            const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].aVariant;

            let shouldDestroyHub = true;

            if (levelA === 3 && variantA === 2) {
                shouldDestroyHub = false; // Persistent Hub
            } else if (levelA >= 2 && unit.type === UnitType.RANGER) {
                shouldDestroyHub = true; // Consumable free teleport
            }

            const newBuildings = shouldDestroyHub ? prev.buildings.filter(b => b.id !== hub.id) : prev.buildings;

            return {
                ...prev,
                buildings: newBuildings,
                players: {
                    ...prev.players,
                    [pId]: {
                        ...pState,
                        flagPosition: unit.hasFlag ? { r: hub.r, c: hub.c } : pState.flagPosition,
                        units: pState.units.map(u => u.id === unit.id ? {
                            ...u,
                            r: hub.r,
                            c: hub.c,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost
                        } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evolved', 'evolution', { unit: getUnitName(unit.type), branch: 'A', level: 2 });
        setTargetMode(null);
    };

    const handleThrowMineAction = (unit: Unit, r: number, c: number) => {
        if (!unit.carriedMine) return;
        const baseCost = 4;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        const range = 1; // 3x3 Area (Radius 1) as requested
        const dist = Math.max(Math.abs(unit.r - r), Math.abs(unit.c - c)); // Chebyshev distance for 3x3 grid
        if (dist > range) {
            addLog('log_scan_range', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const newUnits = p.units.map(u => u.id === unit.id ? { ...u, carriedMine: null, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u);

            // Check for immediate unit damage
            const targetUnits = [
                ...prev.players[PlayerID.P1].units,
                ...prev.players[PlayerID.P2].units
            ].filter(u => u.r === r && u.c === c && !u.isDead && u.owner !== unit.owner);

            let newState = {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, units: newUnits }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };

            if (targetUnits.length > 0) {
                targetUnits.forEach(tu => {
                    const dmg = MINE_DAMAGE;
                    const targetPId = tu.owner;
                    const targetP = newState.players[targetPId];
                    const damagedUnits = targetP.units.map(u => {
                        if (u.id === tu.id) {
                            const newHp = Math.max(0, u.hp - dmg);
                            const isDead = newHp === 0;
                            return {
                                ...u,
                                hp: newHp,
                                isDead,
                                respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0
                            };
                        }
                        return u;
                    });
                    newState.players[targetPId] = { ...targetP, units: damagedUnits };
                    addLog('log_hit_mine', 'mine', { unit: getUnitName(tu.type), dmg }, unit.owner);
                });
            } else {
                const newMine: Mine = {
                    id: `m-${Date.now()}`,
                    owner: unit.owner,
                    type: (unit.carriedMine as any).type,
                    r, c,
                    revealedTo: [unit.owner]
                };
                newState.mines = [...prev.mines, newMine];
            }

            return newState;
        });

        addLog('log_place_mine', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
    };

    const handlePlaceFactoryAction = (unit: Unit, r: number, c: number) => {
        const p = gameState.players[unit.owner];
        const mkrLevelB = p.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = p.evolutionLevels[UnitType.MAKER].bVariant;

        const baseCost = (mkrLevelB === 3 && mkrVariantB === 2) ? 4 : 6;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const mkrLevelB = p.evolutionLevels[UnitType.MAKER].b;
            const mkrVariantB = p.evolutionLevels[UnitType.MAKER].bVariant;
            const factoryLimit = (mkrLevelB === 3 && mkrVariantB === 2) ? 2 : 1;

            let existingFactories = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
            if (existingFactories.length >= factoryLimit) {
                existingFactories.shift();
            }


            const newFactory: Building = {
                id: `factory-${unit.owner}-${Date.now()}`,
                type: 'factory',
                owner: unit.owner,
                r, c,
                level: mkrLevelB,
                duration: undefined
            };

            return {
                ...prev,
                buildings: [...prev.buildings.filter(b => b.type !== 'factory' || b.owner !== unit.owner || existingFactories.find(ef => ef.id === b.id)), newFactory],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '工廠' }, owner: unit.owner, type: 'info' as const },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
    };

    const handleDisarmAction = (unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const defLevelB = state.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;

        // Use unit-specific disarm cost if available, otherwise fallback to 3
        const stats = UNIT_STATS[unit.type] as any;
        const baseCost = stats.disarmCost || 3;

        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (state.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        const dr = Math.abs(unit.r - r);
        const dc = Math.abs(unit.c - c);
        const chebyshevDist = Math.max(dr, dc);

        // Range: Defuser Path B LV1 has Range 2, others Range 1.
        // For non-defusers, only Range 0 (on spot) or Range 1.
        let range = (unit.type === UnitType.DEFUSER) ? (defLevelB >= 1 ? 2 : 1) : 0;

        // Custom request: If unit is ON the target (r,c), range is 0. 
        // Logic: if dist > range, fail.
        if (chebyshevDist > range) {
            addLog('log_disarm_range', 'info');
            return;
        }

        const enemyPlayerId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const enemyUnitAtLocation = gameStateRef.current.players[enemyPlayerId].units.find(u => u.r === r && u.c === c && !u.isDead);

        // Priority 1: Revealed Enemy Mines (Only if Defuser OR on spot?)
        // Let's keep it consistent: if in range and revealed/occupied.
        const revealedMineIndex = gameStateRef.current.mines.findIndex(m =>
            m.r === r && m.c === c && m.owner !== unit.owner && (m.revealedTo.includes(unit.owner) || enemyUnitAtLocation)
        );

        if (revealedMineIndex !== -1) {
            if (!checkEnergyCap(unit, gameStateRef.current.players[unit.owner], cost)) return;
            spendEnergy(unit.owner, cost);
            lockUnit(unit.id);
            setGameState(prev => {
                const newMines = prev.mines.filter((_, idx) => idx !== revealedMineIndex);
                const qStats = { ...prev.players[unit.owner].questStats };
                qStats.defuserMinesDisarmed += 1;
                return {
                    ...prev,
                    mines: newMines,
                    players: { ...prev.players, [unit.owner]: { ...prev.players[unit.owner], questStats: qStats, units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_mine_disarmed', 'mine', { r: r + 1, c: c + 1 }, unit.owner);
            setTargetMode(null);
            return;
        }

        // Priority 2: Enemy Buildings
        const buildingIndex = gameStateRef.current.buildings.findIndex(b => b.r === r && b.c === c && b.owner !== unit.owner);
        if (buildingIndex !== -1) {
            if (!checkEnergyCap(unit, gameStateRef.current.players[unit.owner], cost)) return;
            spendEnergy(unit.owner, cost);
            lockUnit(unit.id);
            setGameState(prev => {
                const newBuildings = prev.buildings.filter((_, idx) => idx !== buildingIndex);
                return {
                    ...prev,
                    buildings: newBuildings,
                    players: { ...prev.players, [unit.owner]: { ...prev.players[unit.owner], units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_building_dismantled', 'info', { r: r + 1, c: c + 1 }, unit.owner);
            setTargetMode(null);
            return;
        }

        addLog('log_no_mine', 'info');
    };

    const handleMoveEnemyMineAction = (unit: Unit, fromR: number, fromC: number, toR: number, toC: number) => {
        const defLevelB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;
        const variantB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].bVariant;
        if (defLevelB < 2) return;

        const isVariantDamage = (defLevelB === 3 && variantB === 2);
        const cost = isVariantDamage ? 5 : 2;

        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        // Must be in 5x5 range
        const dr = Math.abs(unit.r - fromR);
        const dc = Math.abs(unit.c - fromC);
        if (dr > 2 || dc > 2) return;

        // Target must be in range too
        const tr = Math.abs(unit.r - toR);
        const tc = Math.abs(unit.c - toC);
        if (tr > 2 || tc > 2) return;

        const mineIndex = gameState.mines.findIndex(m => m.r === fromR && m.c === fromC && m.owner !== unit.owner);
        if (mineIndex === -1) return;

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const mine = prev.mines[mineIndex];
            const newMines = [...prev.mines];

            // Check if moving to enemy unit for damage
            const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const enemyAtTarget = prev.players[enemyId].units.find(u => u.r === toR && u.c === toC && !u.isDead);

            if (isVariantDamage && enemyAtTarget) {
                // Damage Logic
                const dmg = Math.floor(MINE_DAMAGE * 0.4);
                const newHp = Math.max(0, enemyAtTarget.hp - dmg);
                const isDead = newHp === 0;
                let respawnTimer = 0;
                if (isDead && enemyAtTarget.type !== UnitType.GENERAL) {
                    respawnTimer = prev.turnCount <= 10 ? 2 : 3;
                }

                return {
                    ...prev,
                    mines: newMines.filter((_, i) => i !== mineIndex),
                    players: {
                        ...prev.players,
                        [enemyId]: {
                            ...prev.players[enemyId],
                            units: prev.players[enemyId].units.map(u => u.id === enemyAtTarget.id ? { ...u, hp: newHp, isDead, respawnTimer } : u)
                        },
                        [unit.owner]: {
                            ...prev.players[unit.owner],
                            units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                        }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            }

            // Regular Move
            newMines[mineIndex] = { ...mine, r: toR, c: toC };
            return {
                ...prev,
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_def_move_mine', 'mine');
        setTargetMode(null);
    };

    const handleConvertEnemyMineAction = (unit: Unit, r: number, c: number) => {
        const defLevelB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;
        const variantB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].bVariant;
        if (defLevelB !== 3 || variantB !== 1) return;

        const cost = 5;
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        const mineIndex = gameState.mines.findIndex(m => m.r === r && m.c === c && m.owner !== unit.owner);
        if (mineIndex === -1) return;

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const mine = prev.mines[mineIndex];
            const newMines = [...prev.mines];
            newMines[mineIndex] = { ...mine, owner: unit.owner, revealedTo: [unit.owner] };

            return {
                ...prev,
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_def_convert_mine', 'mine', { r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
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


    // --- Helper: Calculate button index for action buttons ---
    const getActionButtonIndex = (actionType: string, unit: Unit | null | undefined): number => {
        if (!unit) return -1;

        let index = 0;

        // Button 1: Move (always first)
        if (actionType === 'move') return 1;
        index = 2;

        const player = gameState.players[unit.owner];

        // Button 2: Placement skills (if available)
        const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
        const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
        const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

        if (canPlaceTower || canPlaceFactory || canPlaceHub) {
            if (actionType === 'place_tower' || actionType === 'place_factory' || actionType === 'place_hub') return index;
            index++;
        }

        // --- Universal Dismantle (If on enemy building) ---
        const isOnEnemyBuilding = gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
        if (isOnEnemyBuilding) {
            if (actionType === 'custom_dismantle') return index;
            index++;
        }

        // Button 3+: Unit-specific actions
        if (unit.type === UnitType.GENERAL) {
            const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
            const canAttack = !unit.hasFlag || genLevelA >= 3;

            if (canAttack) {
                if (actionType === 'attack') return index;
                index++;
            }
        } else if (unit.type === UnitType.MINESWEEPER) {
            if (actionType === 'scan') return index;
            index++;
            // Note: detonate_tower removed - not displayed in ControlPanel
        } else if (unit.type === UnitType.MAKER) {
            if (actionType === 'place_mine') return index;
            index++;
        } else if (unit.type === UnitType.RANGER) {
            const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
            const pickupRadius = rngLevelB >= 1 ? 1 : 0;
            const mineInRange = gameState.mines.find(m =>
                Math.abs(m.r - unit.r) <= pickupRadius &&
                Math.abs(m.c - unit.c) <= pickupRadius &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );
            if (!unit.carriedMine && mineInRange) {
                if (actionType === 'pickup_mine') return index;
                index++;
            }
            if (unit.carriedMine) {
                if (actionType === 'throw_mine') return index;
                index++;
                if (actionType === 'drop_mine') return index;
                index++;
            }
        } else if (unit.type === UnitType.DEFUSER) {
            if (actionType === 'disarm') return index;
            index++;
            const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
            if (defLevelB >= 2) {
                if (actionType === 'move_mine_start') return index;
                index++;
            }
            if (defLevelB === 3 && player.evolutionLevels[UnitType.DEFUSER].bVariant === 1) {
                if (actionType === 'convert_mine') return index;
                index++;
            }
        }

        // --- Teleport Action (Moved After unit-specific skills) ---
        const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
        const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
        const hasHub = gameState.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
        const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && hasHub;
        if (canTeleport) {
            if (actionType === 'teleport') return index;
            index++;
        }

        // Global Pickup/Drop Action (for Flag)
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
        const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
        if (canCarryFlag) {
            if (!unit.hasFlag && isAtFlag) {
                if (actionType === 'pickup_flag') return index;
                index++;
            }
            if (unit.hasFlag) {
                if (actionType === 'drop_flag') return index;
                index++;
            }
        }

        // Flag pickup/drop for non-General units (when Gen B Level 3+)
        if (unit.type !== UnitType.GENERAL) {
            const player = gameState.players[unit.owner];
            const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
            const canCarry = genLevelB >= 3;
            const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;

            if (canCarry) {
                if (!unit.hasFlag && isAtFlag) {
                    if (actionType === 'pickup_flag') return index;
                    index++;
                }
                if (unit.hasFlag) {
                    if (actionType === 'drop_flag') return index;
                    index++;
                }
            }
        }

        // Evolution buttons - no longer need hotkeys (moved to the right)
        if (actionType === 'end_turn') {
            // Evolution buttons are now after end_turn and don't have hotkeys
            // So we don't count them
            return index;
        }

        return -1;
    };



    const getEvolutionButtonStartIndex = (unit: Unit | null | undefined): number => {
        if (!unit) return -1;
        const keys = ['evolve_a_1', 'evolve_a', 'evolve_a_2', 'evolve_b_1', 'evolve_b', 'evolve_b_2'];
        for (const key of keys) {
            const idx = getActionButtonIndex(key, unit);
            if (idx > 0) return idx;
        }
        return -1; // Should not happen if evolution is showing
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






    // Initialize Player Actions
    const playerActions = usePlayerActions({
        setGameState,
        gameStateRef,
        targetMode,
        setTargetMode,
        setSelectedMineType,
        setShowEvolutionTree,
        addVFX,
    });

    const handleCellClick = useCallback((r: number, c: number) => {
        // Immediate Interaction Feedback:
        // If the action is likely to freeze time (move, attack, scan, etc.), we pre-emptively set the visual state.
        // We do this BEFORE the heavy logic to ensure the UI updates in the very first frame.

        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;

        // Preliminary Check for actions that cause Freeze (Move, Attack, Skills)
        // This is a heuristic check to light up the UI immediately.
        let isActionPotentiallyFreezing = false;

        if (targetMode === 'move' || targetMode === 'attack' || targetMode === 'scan' ||
            targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'place_tower' ||
            targetMode === 'place_factory' || targetMode === 'place_hub' || targetMode === 'teleport' ||
            targetMode === 'throw_mine' || targetMode === 'convert_mine') {
            isActionPotentiallyFreezing = true;
        }

        if (isActionPotentiallyFreezing) {
            setIsProcessing(true);
        }

        // Defer actual logic by a minimal amount to allow React to paint the 'isProcessing' state first.
        // This is the key to 'Zero Latency' feel.
        setTimeout(() => {
            // Wrap internal logic in a try-finally to ensure state reset
            try {
                executeCellClickLogic(r, c);
            } finally {
                // Reset local processing state. 
                // Note: setGameState(isTimeFrozen: true) inside logic will take over the visual persistency.
                // We add a small buffer to ensure overlap.
                setTimeout(() => setIsProcessing(false), 50);
            }
        }, 10);
    }, [targetMode, addLog, handleUnitClick, playerActions, selectedMineType, selectedMineId, setSelectedMineId, setTargetMode]); // Re-create when dependencies change to avoid stale closures

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
        if (state.selectedUnitId && (targetMode === 'scan' || targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'teleport' || targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'throw_mine' || targetMode === 'place_factory' || targetMode === 'move_mine_start' || targetMode === 'move_mine_end' || targetMode === 'convert_mine' || targetMode === 'pickup_mine_select')) {
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
                if (targetMode === 'place_mine' && unit.type === UnitType.MAKER) {
                    const currentMineType = selectedMineTypeRef.current;
                    console.log('[DEBUG] App.tsx handleCellClick - selectedMineTypeRef.current:', currentMineType);
                    playerActions.handleMinePlacement(unit, r, c, currentMineType);
                    return;
                }
                if (targetMode === 'disarm' && unit.type === UnitType.DEFUSER) {
                    handleDisarmAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_tower' && unit.type === UnitType.MINESWEEPER) {
                    handlePlaceTowerAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_hub' && unit.type === UnitType.RANGER) {
                    handlePlaceHubAction(unit, r, c);
                    return;
                }
                if (targetMode === 'throw_mine' && unit.type === UnitType.RANGER) {
                    handleThrowMineAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_factory' && unit.type === UnitType.MAKER) {
                    handlePlaceFactoryAction(unit, r, c);
                    return;
                }
                if (targetMode === 'move_mine_start' && unit.type === UnitType.DEFUSER) {
                    const mine = state.mines.find(m => m.r === r && m.c === c && m.owner !== unit.owner);
                    if (mine) {
                        setSelectedMineId(mine.id);
                        setTargetMode('move_mine_end');
                        addLog('log_select_action', 'info'); // Generic 'selected'
                    }
                    return;
                }
                if (targetMode === 'move_mine_end' && unit.type === UnitType.DEFUSER && selectedMineId) {
                    const mine = state.mines.find(m => m.id === selectedMineId);
                    if (mine) {
                        handleMoveEnemyMineAction(unit, mine.r, mine.c, r, c);
                    }
                    setSelectedMineId(null);
                    setTargetMode(null);
                    return;
                }
                if (targetMode === 'convert_mine' && unit.type === UnitType.DEFUSER) {
                    handleConvertEnemyMineAction(unit, r, c);
                    return;
                }
                if (targetMode === 'pickup_mine_select' && unit.type === UnitType.RANGER) {
                    handlePickupMineAt(unit, r, c);
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

    // Initialize Game Loop and Listeners
    const gameLoopActions = {
        ...playerActions,
        handlePlaceMineAction: playerActions.handleMinePlacement,
        addLog,
        startActionPhase,
        finishPlacementPhase,
        handleUnitClick,
        applyRadarScans,
        handlePlaceTowerAction,
        handlePlaceFactoryAction,
        handlePlaceHubAction,
        handleTeleportToHubAction,
        handleDisarmAction,
        handleDetonateTowerAction,
        handleRangerAction,
        setShowEvolutionTree,
    };

    useGameLoop({
        gameStateRef,
        setGameState,
        view,
        targetMode,
        setTargetMode,
        actions: gameLoopActions
    });

    // Use the AI Hook
    useGameAI({ gameState, attemptMove: playerActions.attemptMove, handleActionComplete: playerActions.handleActionComplete });




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
                            <div className="absolute inset-0 opacity-40 mix-blend-screen" style={{ zIndex: 0 }}>
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
                            <div className="absolute inset-0" style={{
                                background: 'radial-gradient(circle at 50% 20%, rgba(150, 50, 255, 0.5) 0%, transparent 50%)',
                                animation: 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                animationDelay: '1s',
                                zIndex: 1
                            }}></div>
                        </div>

                        {/* Content Container */}
                        <div className="flex-1 flex flex-row overflow-hidden relative" style={{ zIndex: 10 }}>

                            {/* Board + Timer Container */}
                            <div className="flex-1 flex flex-col overflow-visible relative">
                                {/* Game Board */}
                                <GameField
                                    gameState={gameState}
                                    targetMode={targetMode}
                                    handleCellClick={handleCellClick}
                                    handleUnitClick={handleUnitClick}
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
                                                // Only apply transition if not at full (avoid refill animation)
                                                const transitionClass = percentage >= 99 ? '' : 'transition-all duration-1000 ease-linear';
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
                                        <div className={`transition-opacity duration-75 ease-in-out ${gameState.isTimeFrozen || isProcessing ? 'opacity-100' : 'opacity-0'}`}>
                                            <Snowflake size={18} className="text-cyan-300 animate-spin-slow" />
                                        </div>
                                        <span className={`font-bold text-lg text-right transition-colors duration-75 ${gameState.isTimeFrozen || isProcessing ? 'text-cyan-300' : 'text-white'}`}>
                                            {gameState.timeLeft}s
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

                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 text-sm scrollbar-thin scrollbar-thumb-white/30">
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
                    </div>

                    {/* Control Panel */}
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
                            handleEvolve: playerActions.handleEvolve,
                            handlePickupFlag: playerActions.handlePickupFlag,
                            handleDropFlag: playerActions.handleDropFlag,
                            handleAttack: playerActions.handleAttack,
                        }}
                        helpers={{
                            getUnit: (id) => id ? (getUnit(id) ?? null) : null,
                            getActionButtonIndex,
                            getEvolutionButtonStartIndex,
                            getDisplayCost,
                            getNextUnitToAct: () => {
                                const player = gameState.players[gameState.currentPlayer];
                                const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
                                for (const type of unitTypes) {
                                    const unit = player.units.find(u => u.type === type);
                                    if (unit && !unit.isDead && !unit.hasActedThisRound) return unit;
                                }
                                return null;
                            }
                        }}
                        phases={{
                            finishPlacementPhase,
                            startActionPhase
                        }}
                        handleUnitClick={handleUnitClick}
                        handleDisarmAction={handleDisarmAction}
                        handlePlaceTowerAction={handlePlaceTowerAction}
                        handleDetonateTowerAction={handleDetonateTowerAction}
                        handlePlaceFactoryAction={handlePlaceFactoryAction}
                        handlePlaceHubAction={handlePlaceHubAction}
                        handleTeleportToHubAction={handleTeleportToHubAction}
                        handleStealthAction={handleStealthAction}
                        handleRangerAction={handleRangerAction}
                    />

                    {/* Sandbox Panel */}
                    {/* Sandbox Panel moved to global overlay */}

                    {/* Sandbox Panel - Only visible in Sandbox Mode */}
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
