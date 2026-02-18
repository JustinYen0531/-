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
    getUnitName, getEnemyTerritoryEnergyCost, getDisplayCost as getDisplayCostRaw
} from './gameHelpers';
import { useGameAI } from './hooks/useGameAI';
import { AIDecisionInfo, AIDifficulty, AITuningProfile } from './ai/types';
import { useGameLoop } from './hooks/useGameLoop';
import { usePlayerActions } from './hooks/usePlayerActions';
import { ChevronLeft, ChevronRight, Info, Snowflake } from './icons';
import { TRANSLATIONS, Language } from './i18n';
import SandboxPanel from './components/SandboxPanel';
import DevToolsPanel from './components/DevToolsPanel';
import GameHeader from './components/GameHeader';
import GameField from './components/GameField';
import ControlPanel from './components/ControlPanel';
import GameModals from './components/GameModals';
import { useConnection } from './network/ConnectionProvider';
import {
    AttackPayload,
    EndTurnPayload,
    EvolvePayload,
    MovePayload,
    PlaceMinePayload,
    ScanPayload,
    SensorScanPayload,
    StateSyncPayload
} from './network/protocol';

const UNIT_TYPES = Object.values(UnitType) as UnitType[];
const MINE_TYPES = Object.values(MineType) as MineType[];

const isUnitTypeValue = (value: unknown): value is UnitType => (
    typeof value === 'string' && UNIT_TYPES.includes(value as UnitType)
);

const isMineTypeValue = (value: unknown): value is MineType => (
    typeof value === 'string' && MINE_TYPES.includes(value as MineType)
);

const isMovePayload = (payload: unknown): payload is MovePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<MovePayload>;
    return (
        typeof candidate.unitId === 'string' &&
        typeof candidate.r === 'number' &&
        typeof candidate.c === 'number' &&
        typeof candidate.cost === 'number'
    );
};

const isAttackPayload = (payload: unknown): payload is AttackPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<AttackPayload>;
    return (
        typeof candidate.attackerId === 'string' &&
        typeof candidate.targetId === 'string'
    );
};

const isScanPayload = (payload: unknown): payload is ScanPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<ScanPayload>;
    return (
        typeof candidate.unitId === 'string' &&
        typeof candidate.r === 'number' &&
        typeof candidate.c === 'number'
    );
};

const isSensorScanPayload = (payload: unknown): payload is SensorScanPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<SensorScanPayload>;
    return (
        typeof candidate.unitId === 'string' &&
        typeof candidate.r === 'number' &&
        typeof candidate.c === 'number'
    );
};

const isPlaceMinePayload = (payload: unknown): payload is PlaceMinePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<PlaceMinePayload>;
    return (
        typeof candidate.unitId === 'string' &&
        typeof candidate.r === 'number' &&
        typeof candidate.c === 'number' &&
        isMineTypeValue(candidate.mineType)
    );
};

const isEvolvePayload = (payload: unknown): payload is EvolvePayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<EvolvePayload>;
    return (
        isUnitTypeValue(candidate.unitType) &&
        (candidate.branch === 'a' || candidate.branch === 'b')
    );
};

const isEndTurnPayload = (payload: unknown): payload is EndTurnPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<EndTurnPayload>;
    return candidate.actedUnitId === null || typeof candidate.actedUnitId === 'string';
};

const isStateSyncPayload = (payload: unknown): payload is StateSyncPayload => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Partial<StateSyncPayload>;
    return typeof candidate.reason === 'string' && candidate.state !== undefined;
};

const serializeSet = (value: unknown): string[] => {
    if (value instanceof Set) {
        return Array.from(value).filter((item): item is string => typeof item === 'string');
    }
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }
    return [];
};

const toSerializableGameState = (state: GameState): unknown => {
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

const fromSerializableGameState = (input: unknown): GameState | null => {
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
    const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
    const [aiTuningProfile, setAiTuningProfile] = useState<AITuningProfile>('balanced');
    const [aiDebug] = useState(false);
    const [aiDecision, setAiDecision] = useState<AIDecisionInfo | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const applyingRemoteActionRef = useRef(false);
    const lastHandledPacketSeqRef = useRef<number | null>(null);
    const {
        isConnected: isNetworkConnected,
        lastIncomingPacket,
        sendActionPacket
    } = useConnection();

    const [sandboxPos, setSandboxPos] = useState({ x: 0, y: 0 });
    const [isSandboxCollapsed, setIsSandboxCollapsed] = useState(false);
    const [showDevTools, setShowDevTools] = useState(false);
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

    const handleStartGame = useCallback((mode: 'pvp' | 'pve' | 'sandbox') => {
        setGameState(createInitialState(mode));
        setView('game');
        setShowGameStartAnimation(true);
        setTargetMode(null);

        // Hide animation after 3 seconds
        setTimeout(() => {
            setShowGameStartAnimation(false);
        }, 3000);
    }, []);

    const handleExitGame = () => {
        setView('lobby');
    };

    const handleRestart = () => {
        setGameState(createInitialState(gameState.gameMode));
        setTargetMode(null);
        setAiDecision(null);
    };

    const selectUnitForAI = useCallback((unitId: string) => {
        setGameState(prev => ({ ...prev, selectedUnitId: unitId }));
    }, []);







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
            const localPlayer = (prev.gameMode === 'pvp' && roomId && isNetworkConnected)
                ? (isHost ? PlayerID.P1 : PlayerID.P2)
                : prev.currentPlayer;

            const currentPlayerState = prev.players[localPlayer];

            // Get placed mines for this player
            const playerMines = prev.mines.filter(m => m.owner === localPlayer);
            const minePositions = playerMines.map(m => `(${m.r + 1},${m.c + 1})`).join(', ');

            // Get unit positions for this player
            const unitPositions = currentPlayerState.units
                .map(u => `${getUnitName(u.type)}(${u.r + 1},${u.c + 1})`)
                .join(', ');

            // Create logs
            const newLogs = [...prev.logs];

            if (unitPositions) {
                newLogs.unshift({
                    turn: 1,
                    messageKey: 'log_placement_units',
                    params: { units: unitPositions },
                    type: 'move' as const,
                    owner: localPlayer
                });
            }

            if (minePositions) {
                newLogs.unshift({
                    turn: 1,
                    messageKey: 'log_placement_mines',
                    params: { mines: minePositions },
                    type: 'move' as const,
                    owner: localPlayer
                });
            }

            // PvP mode: mark this player as ready, only transition when both are ready
            if (prev.gameMode === 'pvp') {
                const newReadyState = {
                    ...prev.pvpReadyState,
                    [localPlayer]: true,
                };
                const bothReady = newReadyState[PlayerID.P1] && newReadyState[PlayerID.P2];

                if (bothReady) {
                    // Both confirmed -> transition to thinking phase
                    return {
                        ...prev,
                        phase: 'thinking',
                        timeLeft: THINKING_TIMER,
                        selectedUnitId: null,
                        targetMode: null,
                        pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
                        logs: [{ turn: 1, messageKey: 'log_planning_phase', params: { round: 1 }, type: 'info' as const }, ...newLogs]
                    };
                } else {
                    // Only this player confirmed -> stay in placement, mark ready
                    return {
                        ...prev,
                        pvpReadyState: newReadyState,
                        logs: newLogs,
                    };
                }
            }

            // Non-PvP: immediate transition
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
                selectedUnitId: null,
                activeUnitId: null,
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
        // Reset targetMode to null when entering action phase
        setTargetMode(null);
    };

    const clearMissMarksImmediatelyAt = (targetR: number, targetC: number) => {
        flushSync(() => {
            setGameState(prev => {
                const filtered = prev.sensorResults.filter(
                    sr => !(sr.kind === 'mark' && sr.owner === prev.currentPlayer && sr.r === targetR && sr.c === targetC && sr.success !== true)
                );
                if (filtered.length === prev.sensorResults.length) return prev;
                return { ...prev, sensorResults: filtered };
            });
        });
    };

    const handleUnitClick = (unit: Unit) => {
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;
        // Lock human input during AI turn in PvE.
        if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;
        if (state.gameMode === 'pvp' && roomId && isNetworkConnected) {
            const localPlayer = isHost ? PlayerID.P1 : PlayerID.P2;
            if (state.currentPlayer !== localPlayer) return;
        }

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

            // REFINED: Disable order adjustment in thinking phase (per user request)
            /* 
            const player = state.players[state.currentPlayer];
            const activeUnitId = player.unitDisplayOrder.find(id => {
                const u = player.units.find(un => un.id === id);
                return u && !u.isDead;
            });

            if (activeUnitId && activeUnitId !== unit.id) {
                swapUnitDisplayOrder(activeUnitId, unit.id);
            }
            */

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

            // In action phase, before committing, allow swapping unit order
            if (state.phase === 'action' && !state.activeUnitId && !state.selectedUnitId) {
                const player = state.players[state.currentPlayer];
                const firstAliveId = player.unitDisplayOrder.find(id => {
                    const u = player.units.find(un => un.id === id);
                    return u && !u.isDead && !u.hasActedThisRound;
                });

                // If clicking a unit that is NOT the current first-in-line, just swap and return
                if (firstAliveId && firstAliveId !== unit.id) {
                    swapUnitDisplayOrder(firstAliveId, unit.id);
                    return; // Don't select, just swap
                }
                // If clicking the first-in-line unit, proceed to select it below
            }

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            // If a unit is already selected, don't allow switching to another unit
            if (state.selectedUnitId) {
                return;
            }

            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            setTargetMode('move');
        } else {
            // General Rule: Cannot select enemy units.
            // Sandbox Exception: You CAN select enemy units to drag them or evolve them!
            if (targetMode === 'attack' && state.selectedUnitId) {
                executeAttackAction(state.selectedUnitId, unit);
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

    // Swap the display order of units in the squad panel (not board positions)
    const swapUnitDisplayOrder = (id1: string, id2: string) => {
        setGameState(prev => {
            const p = prev.players[prev.currentPlayer];
            const order = [...p.unitDisplayOrder];
            const idx1 = order.indexOf(id1);
            const idx2 = order.indexOf(id2);

            if (idx1 === -1 || idx2 === -1) return prev;

            // Swap positions in the display order array
            [order[idx1], order[idx2]] = [order[idx2], order[idx1]];

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [prev.currentPlayer]: { ...p, unitDisplayOrder: order }
                }
            };
        });
    };




    const handlePlaceTowerAction = (unit: Unit, r: number, c: number) => {
        const swpLevelA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].aVariant;

        const baseCost = (swpLevelA === 3 && variantA === 1) ? 5 : 6;
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
                        }, owner: unit.owner, type: 'move' as const
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

        const towers = gameState.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
        if (towers.length === 0) return;

        const hasEnemyMineInTowerRange = gameState.mines.some(m =>
            m.owner !== unit.owner &&
            towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
        );
        if (!hasEnemyMineInTowerRange) {
            addLog('log_no_mine', 'info');
            return;
        }

        const cost = 2;
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);
        towers.forEach(t => addVFX('explosion', t.r, t.c, 'large'));

        setGameState(prev => {
            const towers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            if (towers.length === 0) return prev;

            // Remove enemy mines (disarm behavior) in 3x3 range of any tower.
            const minesToRemove = new Set(prev.mines.filter(m =>
                m.owner !== unit.owner &&
                towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
            ).map(m => m.id));

            const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            let enemyGeneralKilled = false;
            const updatedEnemyUnits = prev.players[enemyId].units.map(u => {
                if (u.isDead) return u;
                const inTowerRange = towers.some(t => Math.abs(u.r - t.r) <= 1 && Math.abs(u.c - t.c) <= 1);
                if (!inTowerRange) return u;

                const newHp = Math.max(0, u.hp - 3);
                const isDead = newHp === 0;
                if (isDead && u.type === UnitType.GENERAL) enemyGeneralKilled = true;

                return {
                    ...u,
                    hp: newHp,
                    isDead,
                    respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0
                };
            });

            const remainingBuildings = prev.buildings.filter(b =>
                !(b.owner === unit.owner && b.type === 'tower')
            );

            return {
                ...prev,
                mines: prev.mines.filter(m => !minesToRemove.has(m.id)),
                buildings: remainingBuildings,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    },
                    [enemyId]: {
                        ...prev.players[enemyId],
                        units: updatedEnemyUnits
                    },
                },
                gameOver: enemyGeneralKilled || prev.gameOver,
                winner: enemyGeneralKilled ? unit.owner : prev.winner,
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
            const pickupRange = rngLevelB >= 1 ? 2 : 0;

            const minesInRange = gameState.mines.filter(m =>
                (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );

            if (minesInRange.length === 0) {
                addLog('log_no_mine', 'error');
                return;
            }

            if (minesInRange.length === 1 || pickupRange === 0) {
                handlePickupMineAt(unit, minesInRange[0].r, minesInRange[0].c);
            } else {
                setTargetMode('pickup_mine_select');
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
        let pickedMine: Mine | null = null;
        let pickedUnitId: string | null = null;

        setGameState(prev => {
            const owner = unit.owner;
            const p = prev.players[owner];
            const liveUnit = p.units.find(u => u.id === unit.id);
            if (!liveUnit || liveUnit.type !== UnitType.RANGER || liveUnit.carriedMine) return prev;

            const rngLevelB = p.evolutionLevels[UnitType.RANGER].b;
            const pickupRange = rngLevelB >= 1 ? 2 : 0;
            const dist = Math.abs(liveUnit.r - r) + Math.abs(liveUnit.c - c);
            if (dist > pickupRange) return prev;

            const pickableMines = prev.mines.filter(m =>
                m.r === r &&
                m.c === c &&
                (m.owner === owner || m.revealedTo.includes(owner))
            );
            if (pickableMines.length === 0) return prev;

            // Prefer picking own mine when multiple mines are stacked in the same cell.
            const mine = pickableMines.find(m => m.owner === owner) ?? pickableMines[0];
            pickedMine = mine;
            pickedUnitId = liveUnit.id;

            const qStats = { ...p.questStats };
            if (!qStats.rangerMinesMovedThisRound) qStats.rangerMinesMovedThisRound = new Set();
            else qStats.rangerMinesMovedThisRound = new Set(qStats.rangerMinesMovedThisRound);

            if (!qStats.rangerMinesMovedThisRound.has(mine.id)) {
                qStats.rangerMinesMoved += 1;
                qStats.rangerMinesMovedThisRound.add(mine.id);
            }

            const newUnits = p.units.map(u => u.id === liveUnit.id ? { ...u, carriedMine: mine } : u);

            return {
                ...prev,
                mines: prev.mines.filter(m => m.id !== mine.id),
                players: { ...prev.players, [owner]: { ...p, units: newUnits, questStats: qStats } },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        if (!pickedMine || !pickedUnitId) {
            addLog('log_no_mine', 'error');
            setTargetMode(null);
            return;
        }

        addLog('log_pickup_mine', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        lockUnit(pickedUnitId);
        setTargetMode(null);
    };

    const handleStealthAction = (unitId: string) => {
        const unit = getUnit(unitId);
        if (!unit) return;

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

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const updatedUnits = p.units.map(u => u.id === unitId ? {
                ...u,
                status: { ...u.status, isStealthed: !u.status.isStealthed }
            } : u);

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, units: updatedUnits }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        addLog('log_evolved', 'move', { unit: getUnitName(unit.type), branch: 'B', level: 2 }, unit.owner);
    };


    const handlePlaceHubAction = (unit: Unit, r: number, c: number) => {
        const baseCost = 4;
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
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '傳送道標' }, owner: unit.owner, type: 'move' as const },
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

        let cost = 5; // Default for others (A3-2)
        if (unit.type === UnitType.RANGER) {
            if (levelA >= 2) {
                if (levelA === 3 && variantA === 2) cost = 3; // A3-2: Ranger Cost 3
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
            cost = 5;
        }

        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        // Check if hub is blocked by another unit
        const isOccupied = gameState.players[PlayerID.P1].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead) ||
            gameState.players[PlayerID.P2].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead);

        if (isOccupied && !(hub.r === unit.r && hub.c === unit.c)) {
            addLog('log_unit_on_hub', 'info');
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

        addLog('log_evolved', 'move', { unit: getUnitName(unit.type), branch: 'A', level: 2 }, unit.owner);
        setTargetMode(null);
    };

    const handleThrowMineAction = (unit: Unit, r: number, c: number) => {
        if (!unit.carriedMine) return;
        const baseCost = 5;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        const range = 2; // Manhattan Distance 2
        const dist = Math.abs(unit.r - r) + Math.abs(unit.c - c);
        if (dist > range) {
            addLog('log_scan_range', 'info');
            return;
        }

        const hasEnemyUnitAtTarget = gameState.players[PlayerID.P1].units
            .concat(gameState.players[PlayerID.P2].units)
            .some(u => u.r === r && u.c === c && !u.isDead && u.owner !== unit.owner);
        const hasMineAtTarget = gameState.mines.some(m => m.r === r && m.c === c);
        if (!hasEnemyUnitAtTarget && hasMineAtTarget) {
            addLog('log_space_has_mine', 'info');
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
        const baseCost = 6;
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
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '自律工坊' }, owner: unit.owner, type: 'move' as const },
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

        const enemyPlayerId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const enemyUnitAtLocation = state.players[enemyPlayerId].units.find(u => u.r === r && u.c === c && !u.isDead);

        // 1. Identify Target & Action Type
        // Mine Priority
        const revealedMineIndex = state.mines.findIndex(m =>
            m.r === r && m.c === c && m.owner !== unit.owner && (m.revealedTo.includes(unit.owner) || enemyUnitAtLocation)
        );
        // Building Priority (if no mine or fallback)
        const buildingIndex = state.buildings.findIndex(b => b.r === r && b.c === c && b.owner !== unit.owner);

        let actionType: 'mine' | 'building' | null = null;
        if (revealedMineIndex !== -1) {
            actionType = 'mine';
        } else if (buildingIndex !== -1) {
            actionType = 'building';
        }

        if (!actionType) {
            addLog('log_no_mine', 'info');
            return;
        }

        // 2. Range & Cost Check
        const dr = Math.abs(unit.r - r);
        const dc = Math.abs(unit.c - c);
        const chebyshevDist = Math.max(dr, dc);
        let baseCost = 2;
        let inRange = false;

        if (actionType === 'mine') {
            const stats = UNIT_STATS[unit.type] as any;
            baseCost = stats.disarmCost || 2;

            // Defuser ranges
            if (unit.type === UnitType.DEFUSER) {
                const range = (defLevelB >= 1) ? 3 : 2;
                const dr = Math.abs(unit.r - r);
                const dc = Math.abs(unit.c - c);
                inRange = (dr + dc) <= range;
            } else {
                // Non-Defuser: Range 0 (must be on top)
                inRange = (chebyshevDist === 0);
            }
        } else {
            // Building Dismantle
            baseCost = 2; // Fixed cost for dismantling buildings
            inRange = (chebyshevDist === 0); // Must be standing on it
        }

        if (!inRange) {
            addLog('log_disarm_range', 'info');
            return;
        }

        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);

        // 3. Energy Check
        if (state.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        if (!checkEnergyCap(unit, state.players[unit.owner], cost)) return;

        // 4. Action Execution
        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        if (actionType === 'mine') {
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
        } else {
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
        }
        setTargetMode(null);
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

        // Must be in Diamond Range (Manhattan distance <= 2)
        const dr = Math.abs(unit.r - fromR);
        const dc = Math.abs(unit.c - fromC);
        if (dr + dc > 2) return;

        // Target must be in range too
        const tr = Math.abs(unit.r - toR);
        const tc = Math.abs(unit.c - toC);
        if (tr + tc > 2) return;

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

                // Add Damage Log
                addLog('log_evol_def_move_mine_dmg', 'combat', { unit: getUnitName(enemyAtTarget.type), dmg }, unit.owner);

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

        addLog('log_evol_def_move_mine', 'move', undefined, unit.owner);
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

        // Range Check: Manhattan distance <= 2
        const dr = Math.abs(unit.r - r);
        const dc = Math.abs(unit.c - c);
        if (dr + dc > 2) return;

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        // Mine Limit Check (5 + 1 Logic)
        const ownMinesCount = gameState.mines.filter(m => m.owner === unit.owner).length;
        if (ownMinesCount >= 6) {
            addLog('log_max_mines', 'error');
            return;
        }

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const mine = prev.mines[mineIndex];
            const newMines = [...prev.mines];
            newMines[mineIndex] = { ...mine, owner: unit.owner, revealedTo: [unit.owner], isConverted: true };

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
            // Sensor Scan (Path B)
            const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
            if (swpLevelB >= 1) {
                if (actionType === 'sensor_scan') return index;
                index++;
            }
            // Detonate Tower (Path A 3-2)
            const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
            const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
            const hasTower = gameState.buildings.some(b => b.owner === unit.owner && b.type === 'tower');
            if (swpLevelA === 3 && swpVariantA === 2 && hasTower) {
                if (actionType === 'detonate_tower') return index;
                index++;
            }
        } else if (unit.type === UnitType.MAKER) {
            if (actionType === 'place_mine') return index;
            index++;
        } else if (unit.type === UnitType.RANGER) {
            const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
            const pickupRange = rngLevelB >= 1 ? 2 : 0;
            const mineInRange = gameState.mines.find(m =>
                (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );
            if (!unit.carriedMine && mineInRange) {
                if (actionType === 'pickup_mine') return index;
                index++;
            }

            // Ghost Steps (Level B2 or B3-2)
            const rngVariantB = player.evolutionLevels[UnitType.RANGER].bVariant;
            if (rngLevelB === 2 || (rngLevelB >= 3 && rngVariantB === 2)) {
                if (actionType === 'stealth') return index;
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
                if (actionType === 'move_mine' || actionType === 'move_mine_start' || actionType === 'move_mine_end') return index;
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
        addLog,
    });

    const getLocalNetworkPlayer = useCallback((): PlayerID | null => {
        if (!roomId || !isNetworkConnected) {
            return null;
        }
        return isHost ? PlayerID.P1 : PlayerID.P2;
    }, [isHost, isNetworkConnected, roomId]);

    const canBroadcastAction = useCallback((owner?: PlayerID): boolean => {
        if (applyingRemoteActionRef.current) {
            return false;
        }
        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp') {
            return false;
        }
        const localPlayer = getLocalNetworkPlayer();
        if (!localPlayer) {
            return false;
        }
        if (state.currentPlayer !== localPlayer) {
            return false;
        }
        if (owner && owner !== localPlayer) {
            return false;
        }
        return true;
    }, [getLocalNetworkPlayer]);

    const sendGameState = useCallback((reason: string) => {
        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp' || !roomId || !isNetworkConnected) {
            return;
        }
        sendActionPacket({
            type: 'STATE_SYNC',
            matchId: roomId,
            turn: state.turnCount,
            payload: {
                reason,
                state: toSerializableGameState(state)
            }
        });
    }, [isNetworkConnected, roomId, sendActionPacket]);

    const sendGameStateDeferred = useCallback((reason: string) => {
        setTimeout(() => {
            sendGameState(reason);
        }, 0);
    }, [sendGameState]);

    const executeMoveAction = useCallback((
        unitId: string,
        r: number,
        c: number,
        cost: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) {
            return;
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'MOVE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId,
                    r,
                    c,
                    cost
                }
            });
        }

        playerActions.attemptMove(unitId, r, c, cost);

        if (shouldBroadcast) {
            sendGameStateDeferred('move');
        }
    }, [canBroadcastAction, getUnit, playerActions.attemptMove, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeAttackAction = useCallback((
        attackerId: string,
        targetUnit: Unit,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const attacker = getUnit(attackerId, state);
        if (!attacker) {
            return;
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(attacker.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'ATTACK',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    attackerId,
                    targetId: targetUnit.id
                }
            });
        }

        playerActions.handleAttack(attackerId, targetUnit);

        if (shouldBroadcast) {
            sendGameStateDeferred('attack');
        }
    }, [canBroadcastAction, getUnit, playerActions.handleAttack, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeScanAction = useCallback((
        unit: Unit,
        r: number,
        c: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SCAN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId: unit.id,
                    r,
                    c
                }
            });
        }

        playerActions.handleScanAction(unit, r, c);

        if (shouldBroadcast) {
            sendGameStateDeferred('scan');
        }
    }, [canBroadcastAction, playerActions.handleScanAction, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeSensorScanAction = useCallback((
        unitId: string,
        r: number,
        c: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) {
            return;
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SENSOR_SCAN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId,
                    r,
                    c
                }
            });
        }

        playerActions.handleSensorScan(unitId, r, c);

        if (shouldBroadcast) {
            sendGameStateDeferred('sensor_scan');
        }
    }, [canBroadcastAction, getUnit, playerActions.handleSensorScan, roomId, sendActionPacket, sendGameStateDeferred]);

    const executePlaceMineAction = useCallback((
        unit: Unit,
        r: number,
        c: number,
        mineType: MineType,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'PLACE_MINE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId: unit.id,
                    r,
                    c,
                    mineType
                }
            });
        }

        playerActions.handleMinePlacement(unit, r, c, mineType);

        if (shouldBroadcast) {
            sendGameStateDeferred('place_mine');
        }
    }, [canBroadcastAction, playerActions.handleMinePlacement, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeEvolveAction = useCallback((
        unitType: UnitType,
        branch: 'a' | 'b',
        variant?: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'EVOLVE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitType,
                    branch,
                    variant
                }
            });
        }

        playerActions.handleEvolution(unitType, branch, variant);

        if (shouldBroadcast) {
            sendGameStateDeferred('evolve');
        }
    }, [canBroadcastAction, playerActions.handleEvolution, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeEndTurnAction = useCallback((
        actedUnitId: string | null,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'END_TURN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    actedUnitId
                }
            });
        }

        playerActions.handleActionComplete(actedUnitId);

        if (shouldBroadcast) {
            sendGameStateDeferred('end_turn');
        }
    }, [canBroadcastAction, playerActions.handleActionComplete, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeSkipTurnAction = useCallback((
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SKIP_TURN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    actedUnitId: null
                }
            });
        }

        playerActions.handleSkipTurn();

        if (shouldBroadcast) {
            sendGameStateDeferred('skip_turn');
        }
    }, [canBroadcastAction, playerActions.handleSkipTurn, roomId, sendActionPacket, sendGameStateDeferred]);

    useEffect(() => {
        if (!lastIncomingPacket) return;
        if (lastHandledPacketSeqRef.current === lastIncomingPacket.seq) return;
        lastHandledPacketSeqRef.current = lastIncomingPacket.seq;

        if (roomId && lastIncomingPacket.matchId !== roomId) {
            return;
        }

        if (lastIncomingPacket.type === 'START_GAME') {
            if (!isHost && view === 'lobby') {
                handleStartGame('pvp');
            }
            return;
        }

        if (view !== 'game') {
            return;
        }

        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp') {
            return;
        }

        const expectedRemoteOwner = isHost ? PlayerID.P2 : PlayerID.P1;

        applyingRemoteActionRef.current = true;
        try {
            const { type, payload } = lastIncomingPacket;

            if (type === 'STATE_SYNC') {
                if (!isStateSyncPayload(payload)) {
                    return;
                }
                const syncedState = fromSerializableGameState(payload.state);
                if (!syncedState) {
                    return;
                }
                setGameState(syncedState);
                return;
            }

            if (type === 'MOVE') {
                if (!isMovePayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner) {
                    return;
                }
                executeMoveAction(payload.unitId, payload.r, payload.c, payload.cost, 'remote');
                return;
            }

            if (type === 'ATTACK') {
                if (!isAttackPayload(payload)) {
                    return;
                }
                const attacker = getUnit(payload.attackerId, state);
                const target = getUnit(payload.targetId, state);
                if (!attacker || !target || attacker.owner !== expectedRemoteOwner) {
                    return;
                }
                executeAttackAction(payload.attackerId, target, 'remote');
                return;
            }

            if (type === 'SCAN') {
                if (!isScanPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MINESWEEPER) {
                    return;
                }
                executeScanAction(unit, payload.r, payload.c, 'remote');
                return;
            }

            if (type === 'SENSOR_SCAN') {
                if (!isSensorScanPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MINESWEEPER) {
                    return;
                }
                executeSensorScanAction(payload.unitId, payload.r, payload.c, 'remote');
                return;
            }

            if (type === 'PLACE_MINE') {
                if (!isPlaceMinePayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MAKER) {
                    return;
                }
                executePlaceMineAction(unit, payload.r, payload.c, payload.mineType, 'remote');
                return;
            }

            if (type === 'EVOLVE') {
                if (!isEvolvePayload(payload)) {
                    return;
                }
                executeEvolveAction(payload.unitType, payload.branch, payload.variant, 'remote');
                return;
            }

            if (type === 'END_TURN') {
                if (!isEndTurnPayload(payload)) {
                    return;
                }
                executeEndTurnAction(payload.actedUnitId, 'remote');
                return;
            }

            if (type === 'SKIP_TURN') {
                executeSkipTurnAction('remote');
            }
        } finally {
            applyingRemoteActionRef.current = false;
        }
    }, [
        executeAttackAction,
        executeEndTurnAction,
        executeEvolveAction,
        executeMoveAction,
        executePlaceMineAction,
        executeScanAction,
        executeSensorScanAction,
        executeSkipTurnAction,
        getUnit,
        handleStartGame,
        isHost,
        lastIncomingPacket,
        roomId,
        setGameState,
        view
    ]);

    const handleCellClick = (r: number, c: number) => {
        // === IMMEDIATE TIME FREEZE - FIRST LINE === 
        // Set frozen state BEFORE any logic to ensure UI updates in the same frame as the click.
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;

        // Manual dismiss for MISS markers: clicking that MISS cell clears it immediately.
        console.log('[DEBUG MISS] handleCellClick called at', r, c, 'sensorResults:', state.sensorResults.filter(sr => sr.kind === 'mark'));
        const clickedCellHasMiss = state.sensorResults.some(
            sr => sr.kind === 'mark' &&
                sr.owner === state.currentPlayer &&
                sr.r === r &&
                sr.c === c &&
                sr.success !== true
        );
        console.log('[DEBUG MISS] clickedCellHasMiss:', clickedCellHasMiss, 'currentPlayer:', state.currentPlayer);
        if (clickedCellHasMiss) {
            console.log('[DEBUG MISS] Clearing miss at', r, c);
            clearMissMarksImmediatelyAt(r, c);
            return;
        }

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
    };

    const executeCellClickLogic = (r: number, c: number) => {
        const state = gameStateRef.current; // Re-fetch current state inside the deferred execution
        if (state.gameOver || state.isPaused) return;
        if (state.gameMode === 'pvp' && roomId && isNetworkConnected && state.phase !== 'placement') {
            const localPlayer = isHost ? PlayerID.P1 : PlayerID.P2;
            if (state.currentPlayer !== localPlayer) return;
        }

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
                    executeScanAction(unit, r, c);
                    return;
                }
                if (targetMode === 'sensor_scan' && unit.type === UnitType.MINESWEEPER) {
                    executeSensorScanAction(unit.id, r, c);
                    return;
                }
                if (targetMode === 'place_mine' && unit.type === UnitType.MAKER) {
                    const currentMineType = selectedMineTypeRef.current;
                    console.log('[DEBUG] App.tsx handleCellClick - selectedMineTypeRef.current:', currentMineType);
                    executePlaceMineAction(unit, r, c, currentMineType);
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
                        addLog('log_select_action', 'info', undefined, unit.owner); // Generic 'selected' with yellow color
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
                    executeMoveAction(unit.id, r, c, finalCost);
                }
            }
        }
    };

    // Initialize Game Loop and Listeners
    const gameLoopActions = {
        ...playerActions,
        attemptMove: executeMoveAction,
        handleAttack: executeAttackAction,
        handleScanAction: executeScanAction,
        handlePlaceMineAction: executePlaceMineAction,
        handleEvolution: executeEvolveAction,
        handleActionComplete: executeEndTurnAction,
        handleSkipTurn: executeSkipTurnAction,
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
    useGameAI({
        gameState,
        difficulty: aiDifficulty,
        tuningProfile: aiTuningProfile,
        selectUnit: selectUnitForAI,
        debug: aiDebug,
        onDecision: (info) => setAiDecision(info),
        actions: {
            attemptMove: executeMoveAction,
            handleAttack: executeAttackAction,
            handleScanAction: executeScanAction,
            handleSensorScan: executeSensorScanAction,
            handleMinePlacement: executePlaceMineAction,
            handlePlaceTowerAction,
            handlePlaceFactoryAction,
            handlePlaceHubAction,
            handleTeleportToHubAction,
            handleDetonateTowerAction,
            handleThrowMineAction,
            handlePickupMineAt,
            handleMoveEnemyMineAction,
            handleConvertEnemyMineAction,
            handleRangerAction,
            handleDisarm: handleDisarmAction,
            handleEvolution: executeEvolveAction,
            handlePickupFlag: playerActions.handlePickupFlag,
            handleDropFlag: playerActions.handleDropFlag,
            handleActionComplete: executeEndTurnAction
        }
    });




    const localNetworkPlayer = getLocalNetworkPlayer();
    const isLocalPlayerTurn = gameState.gameMode === 'pvp'
        ? (localNetworkPlayer === gameState.currentPlayer)
        : (gameState.currentPlayer === PlayerID.P1);

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
                aiDifficulty={aiDifficulty}
                setAiDifficulty={setAiDifficulty}
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
                                    onDismissMiss={clearMissMarksImmediatelyAt}
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
                        targetMode={targetMode}
                        setTargetMode={setTargetMode}
                        selectedMineType={selectedMineType}
                        setSelectedMineType={setSelectedMineType}
                        showEvolutionTree={showEvolutionTree}
                        setShowEvolutionTree={setShowEvolutionTree}
                        language={language}
                        isLocalPlayerTurn={isLocalPlayerTurn}
                        t={t}
                        aiDecision={aiDecision}
                        actions={{
                            handleActionComplete: executeEndTurnAction,
                            handleSkipTurn: executeSkipTurnAction,
                            handleScanAction: executeScanAction,
                            handlePlaceMineAction: executePlaceMineAction,
                            handleEvolve: executeEvolveAction,
                            handlePickupFlag: playerActions.handlePickupFlag,
                            handleDropFlag: playerActions.handleDropFlag,
                            handleAttack: executeAttackAction,
                            handleStealth: handleStealthAction,
                        }}
                        helpers={{
                            getUnit: (id) => id ? (getUnit(id) ?? null) : null,
                            getActionButtonIndex: (action, unit) => unit ? getActionButtonIndex(action, unit) : -1,
                            getEvolutionButtonStartIndex,
                            getDisplayCost,
                            getNextUnitToAct: () => {
                                const player = gameState.players[gameState.currentPlayer];
                                // Use display order so swapping works
                                for (const unitId of player.unitDisplayOrder) {
                                    const unit = player.units.find(u => u.id === unitId);
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
                        swapUnits={swapUnitDisplayOrder}
                    />
                    {view === 'game' && (
                        <DevToolsPanel
                            open={showDevTools}
                            onToggle={() => setShowDevTools(prev => !prev)}
                            aiDecision={aiDecision}
                            aiTuningProfile={aiTuningProfile}
                            setAiTuningProfile={setAiTuningProfile}
                            gameState={gameState}
                        />
                    )}

                    {/* Sandbox Panel */}
                    {/* Sandbox Panel moved to global overlay */}

                    {/* Sandbox Panel - Only visible in Sandbox Mode */}
                    {(gameState.gameMode === 'sandbox' || gameState.gameMode === 'pve') && (
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
