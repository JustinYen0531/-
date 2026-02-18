import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    GameState, PlayerID, Unit, Cell, Mine, UnitType,
    MineType, GameLog, PlayerState, QuestStats, EvolutionLevels, Building, Coordinates
} from './types';
import {
    GRID_ROWS, GRID_COLS, UNIT_STATS, INITIAL_ENERGY,
    ENERGY_REGEN, MAX_INTEREST, ENERGY_CAP_RATIO,
    P1_FLAG_POS, P2_FLAG_POS, ORE_REWARDS, MINE_DAMAGE, TURN_TIMER, THINKING_TIMER,
    EVOLUTION_CONFIG, EVOLUTION_COSTS, PLACEMENT_TIMER, PLACEMENT_MINE_LIMIT,
    MAX_MINES_ON_BOARD
} from './constants';
import GridCell from './components/GridCell';
import {
    ArrowRight, Skull, Zap, Swords, Info,
    Bomb, Eye, Shield, Footprints, Crown, Flag, CheckCircle, Play, Pause, LogOut, Cpu, Users, ArrowDownToLine,
    Dna, Unlock, X, Globe, Star, Hand, ChevronLeft, ChevronRight, DoorOpen, FlaskConical, Radio, ShieldAlert, RefreshCw, Ghost, Volume2, VolumeX
} from 'lucide-react';
import { TRANSLATIONS, Language } from './i18n';

// --- Helper Functions ---

const getUnitTypeAbbr = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return 'gen';
        case UnitType.MINESWEEPER: return 'swp';
        case UnitType.RANGER: return 'rng';
        case UnitType.MAKER: return 'mkr';
        case UnitType.DEFUSER: return 'def';
        default: return '';
    }
};

const getMineBaseCost = (type: MineType): number => {
    switch (type) {
        case MineType.SLOW: return 2;
        case MineType.SMOKE: return 3;
        case MineType.NUKE: return 10;
        case MineType.CHAIN: return 5;
        default: return 3;
    }
};

const getUnitIcon = (type: UnitType, size: number = 18, tier: number = 0) => {
    if (type === UnitType.GENERAL && tier > 0) {
        return (
            <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{
                filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))',
                strokeWidth: '3px',
                stroke: 'currentColor'
            }} />
        );
    }

    switch (type) {
        case UnitType.GENERAL: return <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MINESWEEPER: return <Eye size={size} className="text-cyan-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.RANGER: return <Footprints size={size} className="text-emerald-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MAKER: return <Bomb size={size} className="text-red-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(252, 165, 165, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.DEFUSER: return <Shield size={size} className="text-blue-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        default: return null;
    }
};

const getUnitName = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return '撠?';
        case UnitType.MINESWEEPER: return '?';
        case UnitType.RANGER: return '??';
        case UnitType.MAKER: return '鋆賡';
        case UnitType.DEFUSER: return '閫?';
        default: return '?芰';
    }
};

// --- Helper: Get Starting Positions for Units ---
const getStartingPositions = (pid: PlayerID) => {
    const positions: { r: number, c: number }[] = [];
    const isP1 = pid === PlayerID.P1;
    const cols = isP1 ? [0, 1, 2, 3] : [20, 21, 22, 23];
    const flagPos = isP1 ? P1_FLAG_POS : P2_FLAG_POS;

    // ????謅??選?????
    const possibleRows = [0, 1, 2, 3, 4, 5, 6].filter(r => r !== flagPos.r);

    // ?冽??豢? 5 ??嚗??撟?嚗?
    const shuffledRows = [...possibleRows].sort(() => Math.random() - 0.5).slice(0, 5);
    // ????鞊? 5 ???????謅???4 ?????????湛蹓???
    const shuffledCols = [...cols].sort(() => Math.random() - 0.5);

    // ??5 ????選??????菜捕??伍??????謅???祈????
    for (let i = 0; i < 5; i++) {
        const r = shuffledRows[i];
        const c = shuffledCols[i % shuffledCols.length];
        positions.push({ r, c });
    }
    return positions;
};

const createInitialState = (mode: 'pvp' | 'pve' | 'sandbox'): GameState => {
    // 1. Create Empty Grid
    const cells: Cell[][] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        const row: Cell[] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            row.push({
                r, c,
                isObstacle: false,
                isFlagBase: (r === P1_FLAG_POS.r && c === P1_FLAG_POS.c) ? PlayerID.P1 :
                    (r === P2_FLAG_POS.r && c === P2_FLAG_POS.c) ? PlayerID.P2 : null,
                hasEnergyOre: false,
                oreSize: null
            });
        }
        cells.push(row);
    }

    // 2. Obstacle Generation (Non-symmetric, 4 per player)
    let p1Obstacles = 0;
    let p2Obstacles = 0;
    let attempts = 0;

    const hasNeighborObstacle = (r: number, c: number) => {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                    if (cells[nr][nc].isObstacle) return true;
                }
            }
        }
        return false;
    };

    // Generate obstacles for P1 (left side, columns 4-11)
    while (p1Obstacles < 4 && attempts < 500) {
        attempts++;
        const r = Math.floor(Math.random() * GRID_ROWS);
        const c = Math.floor(Math.random() * (12 - 4) + 4);

        if (!cells[r][c].isObstacle && !cells[r][c].isFlagBase) {
            if (!hasNeighborObstacle(r, c)) {
                cells[r][c].isObstacle = true;
                p1Obstacles++;
            }
        }
    }

    // Generate obstacles for P2 (right side, columns 12-19)
    attempts = 0;
    while (p2Obstacles < 4 && attempts < 500) {
        attempts++;
        const r = Math.floor(Math.random() * GRID_ROWS);
        const c = Math.floor(Math.random() * (20 - 12) + 12);

        if (!cells[r][c].isObstacle && !cells[r][c].isFlagBase) {
            if (!hasNeighborObstacle(r, c)) {
                cells[r][c].isObstacle = true;
                p2Obstacles++;
            }
        }
    }

    // 3. Ore Generation
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (!cells[r][c].isObstacle && !cells[r][c].isFlagBase) {
                if (c > 5 && c < 18 && Math.random() < 0.05) {
                    cells[r][c].hasEnergyOre = true;
                    const rand = Math.random();
                    cells[r][c].oreSize = rand < 0.6 ? 'small' : rand < 0.9 ? 'medium' : 'large';
                }
            }
        }
    }

    const createUnits = (pid: PlayerID): Unit[] => {
        const types = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
        const positions = getStartingPositions(pid);
        return types.map((t, i) => ({
            id: `${pid}-${t}`,
            type: t,
            owner: pid,
            hp: UNIT_STATS[t].maxHp,
            maxHp: UNIT_STATS[t].maxHp,
            r: positions[i].r,
            c: positions[i].c,
            hasFlag: false,
            carriedMine: null,
            energyUsedThisTurn: 0,
            startOfActionEnergy: INITIAL_ENERGY,
            isDead: false,
            respawnTimer: 0,
            hasActedThisRound: false,
            status: { mineVulnerability: 0, moveCostDebuff: 0 },
            stats: { damageDealt: 0, minesSwept: 0, stepsTaken: 0, minesPlaced: 0, minesTriggered: 0, kills: 0, deaths: 0, damageTaken: 0, flagCaptures: 0, flagReturns: 0 }
        }));
    };

    const initialQuestStats: QuestStats = {
        generalDamage: 0,
        generalFlagSteps: 0,
        sweeperMinesMarked: 0,
        sweeperScansPerformed: 0,
        sweeperMinesRevealed: 0,
        sweeperDetonatedMines: 0,
        consecutiveSafeRounds: 0,
        rangerSteps: 0,
        rangerMinesMoved: 0,
        makerMinesTriggeredByEnemy: 0,
        makerMinesPlaced: 0,
        defuserMinesSoaked: 0,
        defuserMinesDisarmed: 0,
        triggeredMineThisRound: false,
    };

    const initialEvolutionLevels: EvolutionLevels = {
        [UnitType.GENERAL]: { a: 0, b: 0, aVariant: null, bVariant: null },
        [UnitType.MINESWEEPER]: {
            a: 0, b: 0, aVariant: null, bVariant: null
        },
        [UnitType.RANGER]: {
            a: 0, b: 0, aVariant: null, bVariant: null
        },
        [UnitType.MAKER]: {
            a: 0, b: 0, aVariant: null, bVariant: null
        },
        [UnitType.DEFUSER]: {
            a: 0, b: 0, aVariant: null, bVariant: null
        },
    };

    // PVE Auto-setup (AI)
    let initialMines: Mine[] = [];
    let p2Units = createUnits(PlayerID.P2);

    if (mode === 'pve' || mode === 'sandbox') {
        // 1. Swap Units Randomly (k times)
        for (let k = 0; k < 10; k++) {
            const idx1 = Math.floor(Math.random() * 4) + 1; // 1-4
            const idx2 = Math.floor(Math.random() * 4) + 1;
            const u1 = p2Units[idx1];
            const u2 = p2Units[idx2];
            const tr = u1.r, tc = u1.c;
            u1.r = u2.r; u1.c = u2.c;
            u2.r = tr; u2.c = tc;
        }
        // 2. Place 3 Mines
        for (let m = 0; m < 3; m++) {
            // Attempt placement
            for (let t = 0; t < 20; t++) {
                const mr = Math.floor(Math.random() * 7);
                const mc = Math.floor(Math.random() * 12) + 12; // 12-23
                const obs = cells[mr][mc].isObstacle;
                const occupied = p2Units.some(u => u.r === mr && u.c === mc);
                const hasMine = initialMines.some(x => x.r === mr && x.c === mc);
                if (!obs && !occupied && !hasMine) {
                    initialMines.push({
                        id: `setup-ai-${m}`,
                        owner: PlayerID.P2,
                        type: MineType.NORMAL,
                        r: mr, c: mc,
                        revealedTo: []
                    });
                    break;
                }
            }
        }
    }

    return {
        turnCount: 1,
        currentPlayer: PlayerID.P1,
        phase: 'placement',
        gameMode: mode,
        isPaused: false,
        isSandboxTimerPaused: false,
        cells,
        mines: initialMines,
        buildings: [],
        smokes: [],
        players: {
            [PlayerID.P1]: {
                id: PlayerID.P1,
                energy: INITIAL_ENERGY,
                startOfRoundEnergy: INITIAL_ENERGY,
                startOfActionEnergy: INITIAL_ENERGY,
                energyFromKills: 0,
                placementMinesPlaced: 0,
                flagPosition: { ...P1_FLAG_POS },
                basePosition: { ...P1_FLAG_POS },
                units: createUnits(PlayerID.P1),
                movesMadeThisTurn: 0,
                flagMovesMadeThisTurn: 0,
                nonGeneralFlagMovesMadeThisTurn: 0,
                hasResurrectedGeneral: false,
                questStats: { ...initialQuestStats },
                evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
                evolutionPoints: 0,
            },
            [PlayerID.P2]: {
                id: PlayerID.P2,
                energy: INITIAL_ENERGY,
                startOfRoundEnergy: INITIAL_ENERGY,
                startOfActionEnergy: INITIAL_ENERGY,
                energyFromKills: 0,
                placementMinesPlaced: (mode === 'pve' || mode === 'sandbox') ? 3 : 0,
                flagPosition: { ...P2_FLAG_POS },
                basePosition: { ...P2_FLAG_POS },
                units: p2Units,
                movesMadeThisTurn: 0,
                flagMovesMadeThisTurn: 0,
                nonGeneralFlagMovesMadeThisTurn: 0,
                hasResurrectedGeneral: false,
                questStats: { ...initialQuestStats },
                evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
                evolutionPoints: 0,
            },
        },
        selectedUnitId: null,
        activeUnitId: null,
        logs: [{ turn: 1, messageKey: 'log_placement_phase', type: 'info' as const }],
        gameOver: false,
        winner: null,
        timeLeft: PLACEMENT_TIMER,
        movements: [],
        sandboxShowAllMines: false,
    };
};

// Room Interface
interface RoomInfo {
    id: string;
    name: string;
    status: 'waiting' | 'playing';
    players: number;
    maxPlayers: number;
}

// Mock Data for Room List
const MOCK_ROOMS: RoomInfo[] = [
    { id: 'R001', name: 'Elite Arena', status: 'waiting', players: 1, maxPlayers: 2 },
    { id: 'R002', name: 'Noobs Only', status: 'playing', players: 2, maxPlayers: 2 },
    { id: 'R003', name: 'Test Room', status: 'waiting', players: 0, maxPlayers: 2 },
    { id: 'R004', name: 'Championship', status: 'playing', players: 2, maxPlayers: 2 },
    { id: 'R005', name: 'Casual Play', status: 'waiting', players: 1, maxPlayers: 2 },
    { id: 'R006', name: 'Late Night', status: 'waiting', players: 1, maxPlayers: 2 },
];

export default function App() {
    const [view, setView] = useState<'lobby' | 'game'>('lobby');
    const [gameState, setGameState] = useState<GameState>(createInitialState('pvp'));
    const [targetMode, setTargetMode] = useState<'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null>(null);
    const [selectedMineId, setSelectedMineId] = useState<string | null>(null);
    const [showEvolutionTree, setShowEvolutionTree] = useState(false);
    const [language, setLanguage] = useState<Language>('zh_tw');
    const [musicVolume, setMusicVolume] = useState(0.3);
    const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
    const [showGameStartAnimation, setShowGameStartAnimation] = useState(false);
    const [showLog, setShowLog] = useState(true);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinMode, setJoinMode] = useState<'join' | 'create'>('join');
    const [roomCode, setRoomCode] = useState('');
    const [createRoomId, setCreateRoomId] = useState('');
    const [createRoomName, setCreateRoomName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [createRoomPassword, setCreateRoomPassword] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [selectedMineType, setSelectedMineType] = useState<MineType>(MineType.NORMAL);
    const audioRef = useRef<HTMLAudioElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
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


    const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
        if (!boardRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        // Subtle tilt: max 2 degrees
        const rotateX = ((y - centerY) / centerY) * -2;
        const rotateY = ((x - centerX) / centerX) * 2;
        boardRef.current.style.transform = `perspective(2000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        boardRef.current.style.transition = 'transform 0.1s ease-out';
    }, []);

    const handleBoardMouseLeave = useCallback(() => {
        if (!boardRef.current) return;
        boardRef.current.style.transform = `perspective(2000px) rotateX(0deg) rotateY(0deg)`;
        boardRef.current.style.transition = 'transform 0.5s ease-out';
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
                    finishPlacementPhase();
                } else if (state.phase === 'thinking') {
                    startActionPhase();
                } else if (state.phase === 'action') {
                    handleActionComplete(state.activeUnitId || state.selectedUnitId, true);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [view]);

    const addLog = (messageKey: string, type: GameLog['type'] = 'info', params?: Record<string, any>, owner?: PlayerID) => {
        setGameState(prev => ({
            ...prev,
            logs: [{ turn: prev.turnCount, messageKey, params, type, owner }, ...prev.logs].slice(0, 100)
        }));
    };

    const getUnit = (id: string, state: GameState = gameState) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };

    const handleStartGame = (mode: 'pvp' | 'pve' | 'sandbox') => {
        setGameState(createInitialState(mode));
        setView('game');
        setShowGameStartAnimation(true);
        setFlippedCardId(null);
        setTargetMode(null);

        // Hide animation after 3 seconds
        setTimeout(() => {
            setShowGameStartAnimation(false);
        }, 3000);
    };

    const handleExitGame = () => {
        setView('lobby');
    };

    const handleCellClick = (r: number, c: number) => {
        const state = gameStateRef.current;
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
                    handleScanAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_mine' && unit.type === UnitType.MAKER) {
                    handlePlaceMineAction(unit, r, c);
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
                    const finalCost = getDisplayCost(unit, baseCost);
                    attemptMove(unit.id, r, c, finalCost);
                }
            }
        }
    };

    // --- Helper: Calculate cost increase for enemy territory ---
    const getEnemyTerritoryEnergyCost = (unit: Unit, baseCost: number): number => {
        const isP1 = unit.owner === PlayerID.P1;
        const isInEnemyTerritory = isP1 ? unit.c >= 12 : unit.c < 12;

        if (!isInEnemyTerritory) return baseCost;

        if (baseCost < 5) {
            return baseCost + 1;
        } else {
            return baseCost + 2;
        }
    };

    // --- Helper: Get display cost for UI ---
    const getDisplayCost = (unit: Unit | null, baseCost: number, state: GameState = gameState, actionType: string = 'move'): number => {
        if (!unit) return baseCost;
        const player = state.players[unit.owner];

        let cost = baseCost;

        // 1. unit/evolution reductions (standard movement modifiers)
        // (Ranger global move cost reduction removed as per user request)
        if (actionType === 'move') {
            const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
            if (rngLevelB >= 3 && unit.type === UnitType.RANGER) {
                cost = 2; // Ranger B3-1: Permanent stealth and move cost 2
            }
        }

        // Hub discount applies to both MOVE and PLACE_HUB
        if (actionType === 'move' || actionType === 'place_hub') {
            const hub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
            if (hub && Math.abs(hub.r - unit.r) <= 1 && Math.abs(hub.c - unit.c) <= 1) {
                cost = Math.max(1, cost - 1);
            }
        }

        // Ranger Enforce Minimum Cost of 2
        if (unit.type === UnitType.RANGER && actionType === 'move') {
            cost = Math.max(2, cost);
        }

        // 2. moveCostDebuff additions (Double cost is implemented as +BaseCost)
        // ONLY apply for move action
        if (actionType === 'move' && unit.status.moveCostDebuff > 0) {
            cost += unit.status.moveCostDebuff;
        }

        // 3. territory cost
        cost = getEnemyTerritoryEnergyCost(unit, cost);

        return cost;
    };

    // Rule 1: Energy Cap Check
    const checkEnergyCap = (unit: Unit, _player: PlayerState, cost: number) => {
        const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
        if (unit.energyUsedThisTurn + cost > cap) {
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

    const handleAttack = (attackerId: string, targetUnit: Unit) => {
        const state = gameStateRef.current;
        const attacker = getUnit(attackerId, state);
        if (!attacker) return;

        // Only General can attack
        if (attacker.type !== UnitType.GENERAL) return;

        // --- General Evolution Logic: Path A (Range) ---
        const genLevelA = state.players[attacker.owner].evolutionLevels[UnitType.GENERAL].a;
        const attackRange = (attacker.type === UnitType.GENERAL && genLevelA >= 2) ? 2 : 1;

        const dist = Math.abs(attacker.r - targetUnit.r) + Math.abs(attacker.c - targetUnit.c);

        // Only allow cardinal directions (up, down, left, right), not diagonal
        const dr = Math.abs(attacker.r - targetUnit.r);
        const dc = Math.abs(attacker.c - targetUnit.c);
        const isCardinalDirection = dr === 0 || dc === 0;

        if (dist > attackRange || !isCardinalDirection) {
            addLog('log_out_of_range', 'info');
            return;
        }
        // --- General Evolution Logic: Path A (Attack with Flag) ---
        // If not lvl 3 Variant 1, cannot attack with flag
        // A3-1: "Flag Attack"
        const genVariantA = state.players[attacker.owner].evolutionLevels[UnitType.GENERAL].aVariant;
        if (attacker.hasFlag && !(attacker.type === UnitType.GENERAL && genLevelA >= 3 && genVariantA === 1)) {
            return;
        }

        const baseCost = UNIT_STATS[UnitType.GENERAL].attackCost;
        const cost = getEnemyTerritoryEnergyCost(attacker, baseCost);
        const player = state.players[attacker.owner];
        if (player.energy < cost) {
            addLog('log_low_energy_attack', 'info');
            return;
        }

        // Rule 1: Energy Cap
        if (!checkEnergyCap(attacker, player, cost)) return;

        spendEnergy(attacker.owner, cost);
        // Lock unit for turn

        let dmg = UNIT_STATS[UnitType.GENERAL].attackDmg;

        // --- General Evolution Logic: Path A (Damage Scaling) ---
        if (attacker.type === UnitType.GENERAL) {
            if (genLevelA >= 1) dmg = 6;   // Level 1+: 6 damage (no further scaling)
        }

        // --- General Evolution Logic: Path B (Damage Reduction Aura) ---
        const targetOwnerState = state.players[targetUnit.owner];
        const genLevelB_Target = targetOwnerState.evolutionLevels[UnitType.GENERAL].b;
        if (genLevelB_Target >= 2) {
            // 5x5 Aura around Flag
            const flag = targetOwnerState.flagPosition;
            const distToFlag = Math.max(Math.abs(targetUnit.r - flag.r), Math.abs(targetUnit.c - flag.c)); // Chebyshev distance for square
            if (distToFlag <= 2) { // 5x5 area implies radius 2
                dmg = Math.floor(dmg * 0.7); // 30% reduction
                addLog('log_evol_gen_b_dmg_reduce', 'evolution');
            }
        }

        if (state.isGodMode) dmg = 0;
        let newHp = targetUnit.hp - dmg;
        let isDead = false;
        let killReward = 0;

        const qStats = { ...state.players[attacker.owner].questStats };
        if (attacker.type === UnitType.GENERAL) {
            qStats.generalDamage += dmg;
        }

        if (newHp <= 0) {
            newHp = 0;
            isDead = true;
            // Kill Reward Logic: 3 + 15% of Enemy Current Energy
            const targetPlayer = state.players[targetUnit.owner];
            killReward = 3 + Math.floor(targetPlayer.energy * 0.15);
        }

        setGameState(prev => {
            const pStats = prev.players[attacker.owner];
            const tStats = prev.players[targetUnit.owner];

            let attackerHeal = 0;
            // --- General Evolution Logic: Path A (Heal on Attack with Flag) ---
            if (attacker.type === UnitType.GENERAL && genLevelA >= 3 && attacker.hasFlag && genVariantA === 1) {
                attackerHeal = 2;
                addLog('log_evol_gen_a_heal', 'evolution');
            }

            const updatedTargetUnits = tStats.units.map(u => {
                if (u.id === targetUnit.id) {
                    // --- General Evolution Logic: Path A (Debuffs) ---
                    let newStatus = { ...u.status };
                    if (attacker.type === UnitType.GENERAL) {
                        // A1 (Mine Vulnerability) is a SELF debuff, so we DON'T apply it to enemy here.

                        // A2 (Heavy Steps)
                        if (genLevelA >= 2) {
                            newStatus.moveCostDebuff = (newStatus.moveCostDebuff ?? 0) + 2;
                            newStatus.moveCostDebuffDuration = 3; // Lasts current, opponent, and next action turn
                            addLog('log_heavy_steps', 'evolution', undefined, attacker.owner);
                            addLog('log_evol_gen_a_debuff_lv2', 'evolution');
                        }
                    }

                    // Resurrection Timer Logic
                    let respawnTimer = 0;
                    if (isDead && u.type !== UnitType.GENERAL) {
                        respawnTimer = prev.turnCount <= 10 ? 2 : 3;
                    }

                    // Knockback logic (Tier 3-2 Variant)
                    let finalR = targetUnit.r;
                    let finalC = targetUnit.c;
                    const genVariantA = prev.players[attacker.owner].evolutionLevels[UnitType.GENERAL].aVariant;
                    if (attacker.type === UnitType.GENERAL && genLevelA === 3 && genVariantA === 2 && !isDead) {
                        const dr = targetUnit.r - attacker.r;
                        const dc = targetUnit.c - attacker.c;
                        const tr = targetUnit.r + dr;
                        const tc = targetUnit.c + dc;

                        if (tr >= 0 && tr < GRID_ROWS && tc >= 0 && tc < GRID_COLS && !prev.cells[tr][tc].isObstacle) {
                            // Check if occupied by another unit
                            const isKnockbackOccupied = prev.players[PlayerID.P1].units.some(ou => ou.r === tr && ou.c === tc && !ou.isDead) ||
                                prev.players[PlayerID.P2].units.some(ou => ou.r === tr && ou.c === tc && !ou.isDead);
                            if (!isKnockbackOccupied) {
                                finalR = tr;
                                finalC = tc;
                            }
                        }
                    }

                    return { ...u, hp: newHp, isDead, r: finalR, c: finalC, hasFlag: false, respawnTimer, status: newStatus };
                }
                return u;
            });

            // Rule 1: Update energyUsedThisTurn for attacker & Heal
            const updatedAttackerUnits = pStats.units.map(u => {
                if (u.id === attacker.id) {
                    // Dash Logic (A3-2): Move to target's original pos if Dash active
                    // Check if Dash conditions met
                    let dashR = u.r;
                    let dashC = u.c;
                    // A3-2: Attack Shift (Dash)
                    if (attacker.type === UnitType.GENERAL && genLevelA === 3 && genVariantA === 2) {
                        // Move to target's ORIGINAL position (targetUnit.r, targetUnit.c)
                        // But only if target was KNOCKED BACK or DIED (space is handled)
                        // The logic above sets target's finalR/finalC.
                        // We can assume we dash INTO the space.
                        // But we must ensure it's not occupied by the target itself (if it didn't move).
                        // Target moved if finalR != targetUnit.r || finalC != targetUnit.c
                        // OR if target died.
                        // Note: We need to access the updated target position from updatedTargetUnits? 
                        // No, we have the logic above. We need to duplicate collision check?
                        // Ideally we simply move to targetUnit.r/c.
                        dashR = targetUnit.r;
                        dashC = targetUnit.c;
                    }

                    return {
                        ...u,
                        r: dashR,
                        c: dashC,
                        hp: Math.min(u.maxHp, u.hp + attackerHeal),
                        energyUsedThisTurn: u.energyUsedThisTurn + cost
                    };
                }
                return u;
            });

            let newFlagPos = tStats.flagPosition;
            if (targetUnit.hasFlag && isDead) {
                newFlagPos = { r: targetUnit.r, c: targetUnit.c };
            }

            // Check if General died (Game Over)
            let gameOver = false;
            let winner = null;
            if (isDead && targetUnit.type === UnitType.GENERAL) {
                gameOver = true;
                winner = attacker.owner;
            }

            return {
                ...prev,
                gameOver,
                winner,
                players: {
                    ...prev.players,
                    [attacker.owner]: {
                        ...pStats,
                        energy: pStats.energy, // Don't award energy immediately
                        energyFromKills: pStats.energyFromKills + killReward, // Track for next round
                        questStats: qStats,
                        units: updatedAttackerUnits
                    },
                    [targetUnit.owner]: {
                        ...tStats,
                        units: updatedTargetUnits,
                        flagPosition: newFlagPos
                    }
                }
            };
        });

        addLog('log_attack_hit', 'combat', { attacker: getUnitName(attacker.type), target: getUnitName(targetUnit.type), dmg }, attacker.owner);
        if (killReward > 0) {
            addLog('log_kill_reward', 'info', { amount: killReward });
        }

        // Add death log if unit died
        if (isDead && targetUnit.type !== UnitType.GENERAL) {
            const resurrectionRounds = gameState.turnCount <= 10 ? 2 : 3;
            addLog('log_unit_died', 'info', { unit: getUnitName(targetUnit.type), rounds: resurrectionRounds }, targetUnit.owner);
        }

        // --- General Path A Tier 3-2: Attack with movement and knockback ---
        if (attacker.type === UnitType.GENERAL && genLevelA >= 3) {
            // Calculate direction from attacker to target
            const dr = targetUnit.r - attacker.r;
            const dc = targetUnit.c - attacker.c;

            // Normalize direction
            const dirR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
            const dirC = dc === 0 ? 0 : dc > 0 ? 1 : -1;

            // Attacker moves 1 step towards target
            const newAttackerR = attacker.r + dirR;
            const newAttackerC = attacker.c + dirC;

            // Target is knocked back 1 step away from attacker
            const newTargetR = targetUnit.r + dirR;
            const newTargetC = targetUnit.c + dirC;

            // Check if new positions are valid (bounds, obstacles, and no other units)
            const state = gameStateRef.current;
            const isAttackerPosValid = newAttackerR >= 0 && newAttackerR < GRID_ROWS && newAttackerC >= 0 && newAttackerC < GRID_COLS &&
                !state.cells[newAttackerR][newAttackerC].isObstacle &&
                !state.players[PlayerID.P1].units.find(u => u.r === newAttackerR && u.c === newAttackerC && !u.isDead) &&
                !state.players[PlayerID.P2].units.find(u => u.r === newAttackerR && u.c === newAttackerC && !u.isDead);

            const isTargetPosValid = newTargetR >= 0 && newTargetR < GRID_ROWS && newTargetC >= 0 && newTargetC < GRID_COLS &&
                !state.cells[newTargetR][newTargetC].isObstacle &&
                !state.players[PlayerID.P1].units.find(u => u.r === newTargetR && u.c === newTargetC && !u.isDead && u.id !== targetUnit.id) &&
                !state.players[PlayerID.P2].units.find(u => u.r === newTargetR && u.c === newTargetC && !u.isDead && u.id !== targetUnit.id);

            if (isAttackerPosValid && isTargetPosValid) {
                setGameState(prev => {
                    const pStats = prev.players[attacker.owner];
                    const tStats = prev.players[targetUnit.owner];

                    // Move attacker
                    const updatedAttackerUnits = pStats.units.map(u =>
                        u.id === attacker.id ? { ...u, r: newAttackerR, c: newAttackerC } : u
                    );

                    // Knockback target
                    const updatedTargetUnits = tStats.units.map(u =>
                        u.id === targetUnit.id ? { ...u, r: newTargetR, c: newTargetC } : u
                    );

                    return {
                        ...prev,
                        players: {
                            ...prev.players,
                            [attacker.owner]: { ...pStats, units: updatedAttackerUnits },
                            [targetUnit.owner]: { ...tStats, units: updatedTargetUnits }
                        }
                    };
                });

                addLog('log_evol_gen_a_knockback', 'evolution');
            }
        }

        setTargetMode(null);
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
                handleAttack(state.selectedUnitId, unit);
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

    const handleScanAction = (unit: Unit, r: number, c: number) => {
        const swpLevelB = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].b;
        const variantB = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].bVariant;
        let baseCost = 5; // Tier 1 Cost
        if (swpLevelB >= 2) baseCost = 4; // Tier 2 Cost
        if (swpLevelB === 3 && variantB === 1) baseCost = 3; // Tier 3-1 Cost
        if (swpLevelB === 3 && variantB === 2) baseCost = 6; // Tier 3-2 Cost

        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        const dist = Math.abs(unit.r - r) + Math.abs(unit.c - c);
        if (dist > 3) {
            addLog('log_scan_range', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const player = prev.players[unit.owner];
            const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
            const variantB = player.evolutionLevels[UnitType.MINESWEEPER].bVariant;

            let newMines = [...prev.mines];
            let revealedCount = 0;

            if (swpLevelB === 3 && variantB === 2) {
                // Variant 2: Pull mines to center 3x3 -> center
                newMines = prev.mines.map(m => {
                    const dr = Math.abs(m.r - r);
                    const dc = Math.abs(m.c - c);
                    if (dr <= 1 && dc <= 1) {
                        return { ...m, r, c }; // Pull all to center
                    }
                    return m;
                });
                addLog('log_evolved', 'evolution', { unit: getUnitName(unit.type), branch: 'B', level: 3 });
            } else if (swpLevelB >= 2) {
                prev.mines.forEach((m, idx) => {
                    if (Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1) {
                        if (!m.revealedTo.includes(unit.owner)) {
                            newMines[idx] = { ...m, revealedTo: [...m.revealedTo, unit.owner] };
                            revealedCount++;
                        }
                    }
                });

                if (swpLevelB === 3 && variantB === 1) {
                    // Variant 1: Also show floor count
                    const count = prev.mines.filter(m => Math.abs(m.r - unit.r) <= 1 && Math.abs(m.c - unit.c) <= 1).length;
                    addLog('log_scan_count', 'info', { count, r: unit.r + 1, c: unit.c + 1 }, unit.owner);
                }
            } else if (swpLevelB >= 1) {
                const count = prev.mines.filter(m => Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1).length;
                addLog('log_scan_count', 'info', { count, r: r + 1, c: c + 1 }, unit.owner);
            } else {
                newMines = prev.mines.map(m => {
                    if (m.r === r && m.c === c) {
                        if (!m.revealedTo.includes(unit.owner)) {
                            revealedCount++;
                            return { ...m, revealedTo: [...m.revealedTo, unit.owner] };
                        }
                    }
                    return m;
                });
            }

            const qStats = { ...player.questStats };
            qStats.sweeperMinesMarked += revealedCount;

            return {
                ...prev,
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...player,
                        questStats: qStats,
                        units: player.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                }
            };
        });

        addLog('log_scan_area', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
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
                            type: 'Factory'
                        }, owner: unit.owner, type: 'info' as const
                    },
                    ...prev.logs
                ]
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
                }
            };
        });

        addLog('log_evol_swp_detonate', 'mine', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
        setTargetMode(null);
    };

    const handlePlaceMineAction = (unit: Unit, targetR: number, targetC: number) => {
        // Use Ref for latest state to ensure evolution levels are fresh immediately after upgrade
        const state = gameStateRef.current;
        const player = state.players[unit.owner];

        const mkrLevelA = player.evolutionLevels[UnitType.MAKER].a;
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;
        const currentMinesCount = state.mines.filter(m => m.owner === unit.owner).length;

        const factories = state.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const isInFactoryRange = factories.some(f =>
            Math.max(Math.abs(f.r - targetR), Math.abs(f.c - targetC)) <= (f.level >= 2 ? 2 : 1)
        );

        // Validate Mine Type
        let effectiveMineType = selectedMineType;
        if (effectiveMineType === MineType.SMOKE && !(mkrLevelA >= 1 || mkrLevelB >= 2)) effectiveMineType = MineType.NORMAL;
        if (effectiveMineType === MineType.SLOW && !(mkrLevelA >= 2 || mkrLevelB >= 2)) effectiveMineType = MineType.NORMAL;

        // Level 3 Validation
        if ((effectiveMineType === MineType.CHAIN || effectiveMineType === MineType.NUKE) && mkrLevelA < 3) {
            effectiveMineType = MineType.NORMAL;
        } else if (mkrLevelA >= 3) {
            const mkrVariantA = player.evolutionLevels[UnitType.MAKER].aVariant;
            // Variant 1 is Chain, Variant 2 is Nuke
            if (effectiveMineType === MineType.CHAIN && mkrVariantA !== 1) effectiveMineType = MineType.NORMAL;
            if (effectiveMineType === MineType.NUKE && mkrVariantA !== 2) effectiveMineType = MineType.NORMAL;
        }

        const isFree = mkrLevelB === 3 && mkrVariantB === 1 && isInFactoryRange;
        const baseCost = isFree ? 0 : getMineBaseCost(effectiveMineType);
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);

        if (player.energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        let allowed = false;
        const manhattanDist = Math.abs(unit.r - targetR) + Math.abs(unit.c - targetC);

        // Default: Range 1 (Adjacent Manhattan)
        if (manhattanDist <= 1) allowed = true;

        // Level B1+: Range 3x3 (Adjacent Chebyshev)
        if (!allowed && mkrLevelB >= 1) {
            const chebyshevDist = Math.max(Math.abs(unit.r - targetR), Math.abs(unit.c - targetC));
            if (chebyshevDist <= 1) allowed = true;
        }

        if (!allowed && !isInFactoryRange) {
            addLog(currentMinesCount >= 5 ? 'log_maker_range' : 'log_maker_range_base', 'info');
            return;
        }

        if (state.cells[targetR][targetC].isObstacle) {
            addLog('log_obstacle', 'info');
            return;
        }

        // Prevent placing mine on occupied unit
        const unitAtTarget = [...state.players[PlayerID.P1].units, ...state.players[PlayerID.P2].units]
            .find(u => u.r === targetR && u.c === targetC && !u.isDead);

        if (unitAtTarget) {
            addLog('log_obstacle', 'info'); // Using log_obstacle for simplicity ("Cannot place here")
            return;
        }

        const maxLimit = (() => {
            if (factories.length === 0) return 5;
            if (mkrLevelB === 3) {
                if (mkrVariantB === 2) return 5 + (factories.length * 2); // 5 + 2 + 2 = 9
                return 5 + 3; // 5 + 3 = 8
            }
            return 5 + mkrLevelB; // 5 + 1 or 5 + 2
        })();

        if (currentMinesCount >= maxLimit) {
            addLog('log_max_mines', 'error');
            return;
        }

        const minesOutsideRange = state.mines.filter(m =>
            m.owner === unit.owner &&
            !factories.some(f => Math.max(Math.abs(f.r - m.r), Math.abs(f.c - m.c)) <= (f.level >= 2 ? 2 : 1))
        ).length;

        // Rule: Max 5 mines outside factory range
        if (!isInFactoryRange && minesOutsideRange >= 5) {
            addLog('log_maker_range', 'error');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const qStats = { ...p.questStats };
            qStats.makerMinesPlaced += 1;

            return {
                ...prev,
                activeUnitId: unit.id,
                mines: [...prev.mines, {
                    id: `m-${Date.now()}`,
                    owner: unit.owner,
                    type: effectiveMineType,
                    r: targetR,
                    c: targetC,
                    revealedTo: [],
                    immuneUnitIds: [
                        ...gameState.players[PlayerID.P1].units.filter(u => u.r === targetR && u.c === targetC).map(u => u.id),
                        ...gameState.players[PlayerID.P2].units.filter(u => u.r === targetR && u.c === targetC).map(u => u.id)
                    ]
                }],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        questStats: qStats,
                        units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                }
            };
        });
        addLog('log_mine_placed', 'mine', { r: targetR + 1, c: targetC + 1 }, unit.owner);
        setTargetMode(null);
        setSelectedMineType(MineType.NORMAL);
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

    const handlePickupFlag = () => {
        const unit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : null;
        if (!unit) return;

        const player = gameState.players[unit.owner];
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;

        // B3-1: All Carry Flag
        const canPickUp = unit.type === UnitType.GENERAL || (genLevelB >= 3 && genVariantB === 1);
        if (!canPickUp) return;

        if (unit.r !== player.flagPosition.r || unit.c !== player.flagPosition.c) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const newUnits = p.units.map(u => u.id === unit.id ? { ...u, hasFlag: true } : u);
            return {
                ...prev,
                activeUnitId: unit.id,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, units: newUnits }
                }
            };
        });
        addLog('log_committed', 'info');
        addLog('log_flag_pickup', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
    };

    const handleDropFlag = () => {
        const unit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : null;
        if (!unit || !unit.hasFlag) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const newUnits = p.units.map(u => u.id === unit.id ? { ...u, hasFlag: false } : u);
            return {
                ...prev,
                activeUnitId: unit.id,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        units: newUnits,
                        flagPosition: { r: unit.r, c: unit.c }
                    }
                }
            };
        });
        addLog('log_committed', 'info');
        addLog('log_flag_drop', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
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
                    }
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
                players: { ...prev.players, [unit.owner]: { ...p, units: newUnits, questStats: qStats } }
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
                }
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
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '樞紐' }, owner: unit.owner, type: 'info' as const },
                    ...prev.logs
                ]
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
            // Description says "????鞈????梁???剁?隞? for Lv2 Ranger.
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
                }
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
                }
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
                ]
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
                    players: { ...prev.players, [unit.owner]: { ...prev.players[unit.owner], questStats: qStats, units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } }
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
                    players: { ...prev.players, [unit.owner]: { ...prev.players[unit.owner], units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } }
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
                    }
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
                }
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
                }
            };
        });

        addLog('log_evol_def_convert_mine', 'mine', { r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
    };

    const handleEvolve = (unitType: UnitType, branch: 'a' | 'b') => {
        const player = gameState.players[gameState.currentPlayer];
        const currentLevel = player.evolutionLevels[unitType][branch];
        const cost = EVOLUTION_COSTS[currentLevel as keyof typeof EVOLUTION_COSTS];

        if (player.energy < cost) {
            addLog('log_low_energy_evolve', 'info');
            return;
        }

        setGameState(prev => {
            const p = prev.players[prev.currentPlayer];
            const currentLevel = p.evolutionLevels[unitType][branch];

            if (currentLevel >= 3) return prev; // Maxed out

            const newLevels = { ...p.evolutionLevels };
            newLevels[unitType] = { ...newLevels[unitType], [branch]: currentLevel + 1 };

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [prev.currentPlayer]: {
                        ...p,
                        energy: p.energy - cost,
                        evolutionLevels: newLevels
                    },
                    // Retroactive Building Updates (Maker Path B)
                    buildings: (unitType === UnitType.MAKER && branch === 'b')
                        ? prev.buildings.map(b => (b.owner === p.id && b.type === 'factory') ? { ...b, level: currentLevel + 1 } : b)
                        : prev.buildings
                },
                activeUnitId: prev.selectedUnitId,
                logs: [
                    {
                        turn: prev.turnCount,
                        messageKey: 'log_committed',
                        type: 'info'
                    },
                    {
                        turn: prev.turnCount,
                        messageKey: 'log_evolved',
                        params: { unit: getUnitName(unitType), branch: branch.toUpperCase(), level: currentLevel + 1 },
                        type: 'evolution'
                    },
                    ...prev.logs
                ]
            };
        });
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
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            if (state.gameOver || state.isPaused) return;

            // ENTER - Ready/Skip Turn
            if (e.key === 'Enter') {
                e.preventDefault();
                if (state.phase === 'thinking') {
                    startActionPhase();
                } else if (state.phase === 'action') {
                    // Skip turn logic
                    const nextUnit = state.players[state.currentPlayer].units.find(u => !u.isDead && !u.hasActedThisRound);
                    if (nextUnit) {
                        setGameState(prev => {
                            const nextMines = applyRadarScans(prev);
                            return {
                                ...prev,
                                mines: nextMines,
                                activeUnitId: null,
                                selectedUnitId: null,
                            };
                        });
                        addLog('log_skip', 'move', { unit: getUnitName(nextUnit.type) }, nextUnit.owner);
                        handleActionComplete(nextUnit.id);
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
            handleUnitClick(unit);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view]);

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
            if (actionType === 'detonate_tower') return index;
            index++;
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

        // Evolution buttons - count them
        if (actionType === 'end_turn') {
            const player = gameState.players[unit.owner];
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

            // Count evolution buttons
            if (needsVariantA) index += 2;
            else if (canEvolveA) index += 1;

            if (needsVariantB) index += 2;
            else if (canEvolveB) index += 1;

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

            // Button 1: Move (always first and always available)
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
            const canTeleport = (unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2);
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
                const mineAtPosition = state.mines.find(m => m.r === unit.r && m.c === unit.c);
                if (!unit.carriedMine && mineAtPosition) buttons.push({ type: 'pickup_mine', action: 'pickup_mine' });
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

            // Add evolution buttons
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

            // Last button: End turn
            buttons.push({ type: 'end_turn', action: 'end_turn' });

            // Get the action for this key
            if (keyIndex < buttons.length) {
                const buttonAction = buttons[keyIndex];

                switch (buttonAction.action) {
                    case 'move':
                        setTargetMode('move');
                        break;
                    case 'attack':
                        setTargetMode('attack');
                        break;
                    case 'scan':
                        setTargetMode('scan');
                        break;
                    case 'place_mine':
                        setTargetMode('place_mine');
                        break;
                    case 'disarm':
                        setTargetMode('disarm');
                        break;
                    case 'place_tower':
                        handlePlaceTowerAction(unit, unit.r, unit.c);
                        break;
                    case 'place_factory':
                        handlePlaceFactoryAction(unit, unit.r, unit.c);
                        break;
                    case 'place_hub':
                        handlePlaceHubAction(unit, unit.r, unit.c);
                        break;
                    case 'teleport':
                        handleTeleportToHubAction(unit);
                        break;
                    case 'custom_dismantle':
                        handleDisarmAction(unit, unit.r, unit.c);
                        break;
                    case 'detonate_tower':
                        handleDetonateTowerAction(unit);
                        break;
                    case 'throw_mine':
                        setTargetMode('throw_mine');
                        break;
                    case 'move_mine_start':
                        setTargetMode('move_mine_start');
                        break;
                    case 'convert_mine':
                        setTargetMode('convert_mine');
                        break;
                    case 'pickup_flag':
                        handlePickupFlag();
                        break;
                    case 'drop_flag':
                        handleDropFlag();
                        break;
                    case 'pickup_mine':
                        handleRangerAction('pickup');
                        break;
                    case 'drop_mine':
                        handleRangerAction('drop');
                        break;
                    case 'evolve_a_1':
                        setGameState(prev => {
                            const p = prev.players[prev.currentPlayer];
                            const newLevels = { ...p.evolutionLevels };
                            newLevels[unit.type] = { ...newLevels[unit.type], a: 3, aVariant: 1 };
                            return {
                                ...prev,
                                activeUnitId: prev.selectedUnitId,
                                players: {
                                    ...prev.players,
                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                },
                                logs: [
                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'A', level: 3 }, type: 'evolution' as const },
                                    ...prev.logs
                                ]
                            };
                        });
                        break;
                    case 'evolve_a_2':
                        setGameState(prev => {
                            const p = prev.players[prev.currentPlayer];
                            const newLevels = { ...p.evolutionLevels };
                            newLevels[unit.type] = { ...newLevels[unit.type], a: 3, aVariant: 2 };
                            return {
                                ...prev,
                                activeUnitId: prev.selectedUnitId,
                                players: {
                                    ...prev.players,
                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                },
                                logs: [
                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'A', level: 3 }, type: 'evolution' as const },
                                    ...prev.logs
                                ]
                            };
                        });
                        break;
                    case 'evolve_a':
                        handleEvolve(unit.type, 'a');
                        break;
                    case 'evolve_b_1':
                        setGameState(prev => {
                            const p = prev.players[prev.currentPlayer];
                            const newLevels = { ...p.evolutionLevels };
                            newLevels[unit.type] = { ...newLevels[unit.type], b: 3, bVariant: 1 };
                            return {
                                ...prev,
                                activeUnitId: prev.selectedUnitId,
                                players: {
                                    ...prev.players,
                                    [prev.currentPlayer]: {
                                        ...p,
                                        evolutionLevels: newLevels,
                                        energy: p.energy - EVOLUTION_COSTS[2],
                                        units: p.units.map(u => (unit.type === UnitType.RANGER && u.type === UnitType.RANGER) ? { ...u, status: { ...u.status, isStealthed: true } } : u)
                                    }
                                },
                                logs: [
                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'B', level: 3 }, type: 'evolution' as const },
                                    ...prev.logs
                                ]
                            };
                        });
                        break;
                    case 'evolve_b_2':
                        setGameState(prev => {
                            const p = prev.players[prev.currentPlayer];
                            const newLevels = { ...p.evolutionLevels };
                            newLevels[unit.type] = { ...newLevels[unit.type], b: 3, bVariant: 2 };
                            return {
                                ...prev,
                                activeUnitId: prev.selectedUnitId,
                                players: {
                                    ...prev.players,
                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                },
                                logs: [
                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'B', level: 3 }, type: 'evolution' as const },
                                    ...prev.logs
                                ]
                            };
                        });
                        break;
                    case 'evolve_b':
                        handleEvolve(unit.type, 'b');
                        break;
                    case 'end_turn':
                        handleActionComplete(state.selectedUnitId);
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view]);

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
            const finalCost = getDisplayCost(unit, cost);
            if (targetMode !== 'move') setTargetMode('move');
            attemptMove(unit.id, targetR, targetC, finalCost);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, targetMode]);

    // --- Keyboard Control for Evolution Tree (Space) ---
    useEffect(() => {
        if (view !== 'game') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ') {
                e.preventDefault();
                setShowEvolutionTree(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view]);

    const checkVictory = useCallback(() => {
        const state = gameStateRef.current;
        const p1State = state.players[PlayerID.P1];
        const p2State = state.players[PlayerID.P2];

        if (p1State.flagPosition.r === P2_FLAG_POS.r && p1State.flagPosition.c === P2_FLAG_POS.c) {
            setGameState(prev => ({ ...prev, gameOver: true, winner: PlayerID.P1 }));
            addLog('log_victory', 'info', { player: 'Player 1' });
        }
        if (p2State.flagPosition.r === P1_FLAG_POS.r && p2State.flagPosition.c === P1_FLAG_POS.c) {
            setGameState(prev => ({ ...prev, gameOver: true, winner: PlayerID.P2 }));
            addLog('log_victory', 'info', { player: 'Player 2' });
        }
    }, []);

    const handleActionComplete = (actedUnitId: string | null, timedOut: boolean = false) => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        let unitToMarkId = actedUnitId;
        let passLog = null;

        if (timedOut) {
            addLog('log_timeout', 'info', { player: state.currentPlayer });
        }

        // Check if unit was selected but didn't perform any action
        if (actedUnitId && !timedOut) {
            const unit = getUnit(actedUnitId, state);
            if (unit && unit.owner === state.currentPlayer && !unit.hasActedThisRound) {
                // Unit was selected but no action was taken
                // Check if any movements were made by this unit OR if energy was spent
                const unitMoved = state.movements.some(m => m.unitId === actedUnitId);
                const unitSpentEnergy = unit.energyUsedThisTurn > 0;

                if (!unitMoved && !unitSpentEnergy) {
                    // No movement and no energy spent - log as pass turn
                    passLog = {
                        turn: state.turnCount,
                        messageKey: 'log_pass_turn',
                        params: { unit: getUnitName(unit.type) },
                        type: 'move' as const,
                        owner: unit.owner
                    };
                }
            }
        }

        if (!unitToMarkId) {
            const units = state.players[state.currentPlayer].units;
            const available = units.find(u => !u.isDead && !u.hasActedThisRound);
            if (available) {
                unitToMarkId = available.id;
                addLog('log_pass', 'info', { player: state.currentPlayer, unit: getUnitName(available.type) });
            }
        }

        let nextState = { ...state };
        let healedUnits: Array<{ unitId: string; unitType: UnitType; amount: number; owner: PlayerID }> = [];

        if (unitToMarkId) {
            const u = getUnit(unitToMarkId, state);
            if (u) {
                nextState = {
                    ...nextState,
                    selectedUnitId: null,
                    activeUnitId: null,
                    players: {
                        ...nextState.players,
                        [u.owner]: {
                            ...nextState.players[u.owner],
                            units: nextState.players[u.owner].units.map(unit => {
                                if (unit.id === u.id) {
                                    let updatedUnit = { ...unit, hasActedThisRound: true };

                                    // ???????選??????肅 3 ?葡????圈???餅蔭?????蹇?
                                    if (!state.movements.some(m => m.unitId === u.id) && unit.energyUsedThisTurn === 0) {
                                        const healAmount = 3;
                                        const newHp = Math.min(unit.maxHp, unit.hp + healAmount);
                                        const actualHeal = newHp - unit.hp;
                                        updatedUnit.hp = newHp;

                                        if (actualHeal > 0) {
                                            healedUnits.push({ unitId: u.id, unitType: unit.type, amount: actualHeal, owner: u.owner });
                                        }
                                    }

                                    return updatedUnit;
                                }
                                return unit;
                            })
                        }
                    }
                };
            }
        }

        const p1Units = nextState.players[PlayerID.P1].units;
        const p2Units = nextState.players[PlayerID.P2].units;

        const p1Done = p1Units.every(u => u.isDead || u.hasActedThisRound);
        const p2Done = p2Units.every(u => u.isDead || u.hasActedThisRound);

        if (p1Done && p2Done) {
            startNewRound(nextState);
            setTargetMode(null);
        } else {
            let nextPlayer = state.currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const nextPlayerHasMoves = nextState.players[nextPlayer].units.some(u => !u.isDead && !u.hasActedThisRound);
            if (!nextPlayerHasMoves) {
                nextPlayer = state.currentPlayer;
            }

            // Add movement logs before switching players
            let newLogs = [...nextState.logs];

            // Add pass turn log if applicable
            if (passLog) {
                newLogs.unshift(passLog);
            }

            // Add healing logs
            healedUnits.forEach(healed => {
                newLogs.unshift({
                    turn: nextState.turnCount,
                    messageKey: 'log_passive_heal',
                    params: { unit: getUnitName(healed.unitType), amount: healed.amount },
                    type: 'move' as const,
                    owner: healed.owner
                });
            });

            // Group movements by unitId and only log first->last position
            const movementsByUnit: Record<string, { unitId: string; from: Coordinates; to: Coordinates; }> = {};
            nextState.movements.forEach(movement => {
                if (!movementsByUnit[movement.unitId]) {
                    // First movement for this unit - record starting position
                    movementsByUnit[movement.unitId] = {
                        unitId: movement.unitId,
                        from: { ...movement.from },
                        to: { ...movement.to }
                    };
                } else {
                    // Update ending position to the latest
                    movementsByUnit[movement.unitId].to = { ...movement.to };
                }
            });

            // Log consolidated movements
            Object.values(movementsByUnit).forEach(movement => {
                const unit = getUnit(movement.unitId, nextState);
                if (unit) {
                    newLogs.unshift({
                        turn: nextState.turnCount,
                        messageKey: 'log_move_action',
                        params: { unit: getUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
                        type: 'move' as const,
                        owner: unit.owner
                    });
                }
            });

            // Update startOfActionEnergy for the next player if switching to same player's next unit
            let updatedPlayers = { ...nextState.players };
            if (nextPlayer === state.currentPlayer) {
                const nextPlayerState = updatedPlayers[nextPlayer];
                // Find the next unit that hasn't acted yet (from the updated state)
                const nextUnit = nextPlayerState.units.find(u => !u.isDead && !u.hasActedThisRound);

                if (nextUnit) {
                    // Use the current energy from nextState
                    const currentEnergy = nextPlayerState.energy;
                    updatedPlayers[nextPlayer] = {
                        ...nextPlayerState,
                        startOfActionEnergy: currentEnergy,
                        units: nextPlayerState.units.map(u =>
                            u.id === nextUnit.id ? { ...u, startOfActionEnergy: currentEnergy } : u
                        )
                    };
                }
            } else {
                // Switching to opponent, update all their units' startOfActionEnergy
                const nextPlayerState = updatedPlayers[nextPlayer];
                updatedPlayers[nextPlayer] = {
                    ...nextPlayerState,
                    startOfActionEnergy: nextPlayerState.energy,
                    units: nextPlayerState.units.map(u =>
                        !u.isDead && !u.hasActedThisRound ? { ...u, startOfActionEnergy: nextPlayerState.energy } : u
                    )
                };
            }

            setGameState({
                ...nextState,
                currentPlayer: nextPlayer,
                activeUnitId: null,
                selectedUnitId: null,
                timeLeft: TURN_TIMER,
                movements: [],
                logs: newLogs,
                players: updatedPlayers,
            });
            setTargetMode(null);

            // AI Turn for PvE
            if (nextState.gameMode === 'pve' && nextPlayer === PlayerID.P2) {
                setTimeout(() => performAITurn(), 1000);
            }
        }
    };

    const getNextUnitToAct = (state: GameState = gameState) => {
        const player = state.players[state.currentPlayer];
        const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];

        for (const type of unitTypes) {
            const unit = player.units.find(u => u.type === type);
            if (unit && !unit.isDead && !unit.hasActedThisRound) {
                return unit;
            }
        }
        return null;
    };


    const performAITurn = () => {
        const state = gameStateRef.current;
        if (state.gameMode !== 'pve' || state.currentPlayer !== PlayerID.P2 || state.gameOver) return;

        const p2Units = state.players[PlayerID.P2].units.filter(u => !u.isDead && !u.hasActedThisRound);
        if (p2Units.length === 0) {
            handleActionComplete(null);
            return;
        }

        // Simple AI: Pick random unit and random action
        const unit = p2Units[Math.floor(Math.random() * p2Units.length)];

        // 60% chance to move, 40% chance to pass
        if (Math.random() < 0.6) {
            // Try to move towards enemy flag
            const targetFlag = state.players[PlayerID.P1].flagPosition;
            const directions = [
                { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
            ];

            let bestDir = directions[0];
            let bestDist = Math.abs(unit.r + bestDir.r - targetFlag.r) + Math.abs(unit.c + bestDir.c - targetFlag.c);

            for (const dir of directions) {
                const newR = unit.r + dir.r;
                const newC = unit.c + dir.c;
                if (newR >= 0 && newR < GRID_ROWS && newC >= 0 && newC < GRID_COLS) {
                    const dist = Math.abs(newR - targetFlag.r) + Math.abs(newC - targetFlag.c);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestDir = dir;
                    }
                }
            }

            const newR = unit.r + bestDir.r;
            const newC = unit.c + bestDir.c;

            if (newR >= 0 && newR < GRID_ROWS && newC >= 0 && newC < GRID_COLS) {
                const baseCost = UNIT_STATS[unit.type].moveCost;
                const cost = getDisplayCost(unit, baseCost, gameState);
                attemptMove(unit.id, newR, newC, cost);
                return;
            }
        }

        handleActionComplete(unit.id);
    };

    const startNewRound = (prevState: GameState) => {
        const nextTurn = prevState.turnCount + 1;
        const p1 = prevState.players[PlayerID.P1];
        const p2 = prevState.players[PlayerID.P2];

        const newSmokes = prevState.smokes
            .map(s => ({ ...s, duration: s.duration - 1 }))
            .filter(s => s.duration > 0);

        const newCells = prevState.cells.map(row => row.map(cell => ({ ...cell })));

        // Ore Consumption Logic
        const calculateOreIncomeAndConsume = (units: Unit[]) => {
            let income = 0;
            units.forEach(u => {
                if (!u.isDead) {
                    const cell = newCells[u.r][u.c]; // Use the mutable newCells
                    if (cell.hasEnergyOre && cell.oreSize) {
                        income += ORE_REWARDS[cell.oreSize];
                        // Consume
                        cell.hasEnergyOre = false;
                        cell.oreSize = null;
                    }
                }
            });
            return income;
        };

        const p1OreIncome = calculateOreIncomeAndConsume(p1.units);
        const p2OreIncome = calculateOreIncomeAndConsume(p2.units);

        // Rule 2: Dynamic Regen
        let currentRegen = ENERGY_REGEN; // Default 35
        if (nextTurn >= 12) currentRegen = 50;
        else if (nextTurn >= 8) currentRegen = 45;
        else if (nextTurn >= 4) currentRegen = 40;

        const calcEnergy = (current: number, oreIncome: number, killIncome: number) => {
            const interest = Math.min(Math.floor(current / 10), MAX_INTEREST);
            return current + currentRegen + interest + oreIncome + killIncome;
        };

        const updatePlayerQuest = (player: PlayerState, oreIncome: number) => {
            let newQuestStats = { ...player.questStats };
            // Sweeper Branch B: Safe rounds (not consecutive)
            // Increment if no mine was triggered this round, or if only defuser soaked/disarmed mines
            // Does not reset even if a mine was triggered
            if (!newQuestStats.triggeredMineThisRound) {
                newQuestStats.consecutiveSafeRounds += 1;
            }
            // Reset the flag for next round
            newQuestStats.triggeredMineThisRound = false;
            // Reset Ranger mines moved tracking for next round
            newQuestStats.rangerMinesMovedThisRound = new Set();

            const newEnergy = calcEnergy(player.energy, oreIncome, player.energyFromKills);

            return {
                ...player,
                energy: newEnergy,
                startOfRoundEnergy: newEnergy, // Rule 1: Reset startOfRoundEnergy
                startOfActionEnergy: newEnergy, // Reset startOfActionEnergy for new round
                energyFromKills: 0, // Reset Kills Tracker per round
                movesMadeThisTurn: 0, // Reset moves counter for new round
                flagMovesMadeThisTurn: 0, // Reset flag moves counter for new round
                nonGeneralFlagMovesMadeThisTurn: 0, // Reset non-General flag moves counter for new round
                questStats: newQuestStats,
            };
        };

        const resetUnits = (units: Unit[], playerState: PlayerState, playerLogs: GameLog[]) => {
            const resurrectedUnits: string[] = [];

            const updated = units.map((u, unitIndex) => {
                const newDuration = Math.max(0, (u.status.moveCostDebuffDuration || 0) - 1);
                let newU = {
                    ...u,
                    hasActedThisRound: false,
                    energyUsedThisTurn: 0,
                    startOfActionEnergy: playerState.energy,
                    status: {
                        ...u.status,
                        moveCostDebuffDuration: newDuration,
                        moveCostDebuff: newDuration > 0 ? u.status.moveCostDebuff : 0
                    }
                };

                // Resurrection Logic
                if (newU.isDead && newU.respawnTimer > 0) {
                    newU.respawnTimer -= 1;
                }

                // Check if unit should resurrect
                if (newU.isDead && newU.respawnTimer === 0 && newU.type !== UnitType.GENERAL) {
                    // Find respawn location
                    const spawnPositions = getStartingPositions(playerState.id);
                    const originalSpawnPos = spawnPositions[unitIndex];
                    let respawnPos = originalSpawnPos;

                    // Check if original position is occupied
                    const isOccupied = units.some((unit, idx) =>
                        idx !== unitIndex && unit.r === originalSpawnPos.r && unit.c === originalSpawnPos.c && !unit.isDead
                    );

                    if (isOccupied) {
                        // Try 3x3 area around original position
                        const candidates: { r: number, c: number }[] = [];
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = originalSpawnPos.r + dr;
                                const nc = originalSpawnPos.c + dc;
                                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                    const cellOccupied = units.some((unit, idx) =>
                                        idx !== unitIndex && unit.r === nr && unit.c === nc && !unit.isDead
                                    );
                                    const cellObstacle = newCells[nr][nc].isObstacle;
                                    if (!cellOccupied && !cellObstacle) {
                                        candidates.push({ r: nr, c: nc });
                                    }
                                }
                            }
                        }

                        if (candidates.length > 0) {
                            respawnPos = candidates[Math.floor(Math.random() * candidates.length)];
                        } else {
                            // All 3x3 occupied, try other units' spawn positions
                            const availableSpawns = spawnPositions.filter((pos, _) =>
                                !units.some((unit, uidx) =>
                                    uidx !== unitIndex && unit.r === pos.r && unit.c === pos.c && !unit.isDead
                                )
                            );
                            if (availableSpawns.length > 0) {
                                respawnPos = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
                            }
                        }
                    }

                    newU.isDead = false;
                    newU.hp = newU.maxHp;
                    newU.r = respawnPos.r;
                    newU.c = respawnPos.c;
                    newU.respawnTimer = 0;

                    // Track resurrection for logging
                    resurrectedUnits.push(getUnitName(newU.type));
                    playerLogs.unshift({
                        turn: nextTurn,
                        messageKey: 'log_unit_resurrected',
                        params: { unit: getUnitName(newU.type), r: respawnPos.r + 1, c: respawnPos.c + 1 },
                        type: 'info' as const,
                        owner: playerState.id
                    });
                }

                // --- General Evolution Logic: Path B Level 1 (Heal allies behind flag) ---
                const genLevelB = playerState.evolutionLevels[UnitType.GENERAL].b;
                if (genLevelB >= 1 && !newU.isDead) {
                    const flagPos = playerState.flagPosition;
                    // Check if unit is "behind" flag (in the entire area behind the flag's row)
                    const isP1 = playerState.id === PlayerID.P1;
                    const isBehind = isP1 ? newU.c < flagPos.c : newU.c > flagPos.c;

                    if (isBehind) {
                        newU.hp = Math.min(newU.maxHp, newU.hp + 1);
                    }
                }

                return newU;
            });

            return updated;
        };

        // Spawn new Ore logic
        let oresSpawned = 0;
        for (let i = 0; i < 2; i++) {
            const r = Math.floor(Math.random() * GRID_ROWS);
            const c = Math.floor(Math.random() * (17 - 6) + 6);
            const cell = newCells[r][c];
            if (!cell.isObstacle && !cell.hasEnergyOre && !cell.isFlagBase) {
                cell.hasEnergyOre = true;
                const rand = Math.random();
                let mediumThreshold = 0.6;
                let largeThreshold = 0.9;
                if (nextTurn > 3) { mediumThreshold = 0.4; largeThreshold = 0.8; }
                if (nextTurn > 8) { mediumThreshold = 0.3; largeThreshold = 0.6; }

                cell.oreSize = rand < mediumThreshold ? 'small' : rand < largeThreshold ? 'medium' : 'large';
                oresSpawned++;
            }
        }

        const p1Updated = updatePlayerQuest(p1, p1OreIncome);
        const p2Updated = updatePlayerQuest(p2, p2OreIncome);

        let newMines = [...prevState.mines];

        // Add movement logs at end of turn
        let newLogs = [...prevState.logs];
        // Group movements by unitId and only log first->last position
        const movementsByUnit: Record<string, { unitId: string; from: Coordinates; to: Coordinates; }> = {};
        prevState.movements.forEach(movement => {
            if (!movementsByUnit[movement.unitId]) {
                movementsByUnit[movement.unitId] = {
                    unitId: movement.unitId,
                    from: { ...movement.from },
                    to: { ...movement.to }
                };
            } else {
                movementsByUnit[movement.unitId].to = { ...movement.to };
            }
        });

        // Log consolidated movements
        Object.values(movementsByUnit).forEach(movement => {
            const unit = getUnit(movement.unitId, prevState);
            if (unit) {
                newLogs.unshift({
                    turn: prevState.turnCount,
                    messageKey: 'log_move_action',
                    params: { unit: getUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
                    type: 'move' as const,
                    owner: unit.owner
                });
            }
        });

        // Reset units and handle resurrections
        const p1Logs = [...newLogs];
        const p2Logs = [...newLogs];
        const p1ResetUnits = resetUnits(p1.units, p1Updated, p1Logs);
        const p2ResetUnits = resetUnits(p2.units, p2Updated, p2Logs);

        // Combine logs from both players
        newLogs = [...p1Logs, ...p2Logs.filter(log => !p1Logs.includes(log))];

        // --- General Evolution Logic: Path B Level 3-2 (Damage zone around flag) & Level 1 (Heal behind flag) ---
        let updatedP1Units = p1ResetUnits;
        let updatedP2Units = p2ResetUnits;

        // P1 Gen B Logic
        const p1GenLevelB = p1Updated.evolutionLevels[UnitType.GENERAL].b;
        const p1GenVariantB = p1Updated.evolutionLevels[UnitType.GENERAL].bVariant;
        const p1FlagPos = p1Updated.flagPosition;

        if (p1GenLevelB >= 1) {
            updatedP1Units = updatedP1Units.map(u => {
                if (!u.isDead && u.c <= p1FlagPos.c) { // Behind flag (Left side or same column)
                    const newHp = Math.min(u.maxHp, u.hp + 1);
                    if (newHp > u.hp) {
                        newLogs.unshift({
                            turn: nextTurn,
                            messageKey: 'log_evol_gen_b_heal',
                            type: 'evolution' as const,
                            owner: PlayerID.P1
                        });
                    }
                    return { ...u, hp: newHp };
                }
                return u;
            });
        }

        // P2 Gen B Logic
        const p2GenLevelB = p2Updated.evolutionLevels[UnitType.GENERAL].b;
        const p2GenVariantB = p2Updated.evolutionLevels[UnitType.GENERAL].bVariant;
        const p2FlagPos = p2Updated.flagPosition;

        if (p2GenLevelB >= 1) {
            updatedP2Units = updatedP2Units.map(u => {
                if (!u.isDead && u.c >= p2FlagPos.c) { // Behind flag (Right side or same column)
                    const newHp = Math.min(u.maxHp, u.hp + 1);
                    if (newHp > u.hp) {
                        newLogs.unshift({
                            turn: nextTurn,
                            messageKey: 'log_evol_gen_b_heal',
                            type: 'evolution' as const,
                            owner: PlayerID.P2
                        });
                    }
                    return { ...u, hp: newHp };
                }
                return u;
            });
        }
        // Apply damage zone for P1's flag to P2 units
        if (p1GenLevelB >= 3 && p1GenVariantB === 2) {
            const p1FlagPos = p1Updated.flagPosition;
            updatedP2Units = updatedP2Units.map(u => {
                if (!u.isDead) {
                    const distToFlag = Math.max(Math.abs(u.r - p1FlagPos.r), Math.abs(u.c - p1FlagPos.c));
                    if (distToFlag <= 1) { // 3x3 area (radius 1)
                        const newHp = Math.max(0, u.hp - 4);
                        if (newHp !== u.hp) {
                            newLogs.unshift({
                                turn: nextTurn,
                                messageKey: 'log_evol_gen_b_damage_zone',
                                params: { unit: getUnitName(u.type), dmg: u.hp - newHp },
                                type: 'evolution' as const,
                                owner: PlayerID.P2
                            });
                        }
                        const isDead = newHp === 0;
                        let respawnTimer = 0;
                        if (isDead && u.type !== UnitType.GENERAL) {
                            respawnTimer = nextTurn <= 10 ? 2 : 3;
                        }
                        return { ...u, hp: newHp, isDead, respawnTimer };
                    }
                }
                return u;
            });
        }

        // Apply damage zone for P2's flag to P1 units
        if (p2GenLevelB >= 3 && p2GenVariantB === 2) {
            const p2FlagPos = p2Updated.flagPosition;
            updatedP1Units = updatedP1Units.map(u => {
                if (!u.isDead) {
                    const distToFlag = Math.max(Math.abs(u.r - p2FlagPos.r), Math.abs(u.c - p2FlagPos.c));
                    if (distToFlag <= 1) { // 3x3 area (radius 1)
                        const newHp = Math.max(0, u.hp - 4);
                        if (newHp !== u.hp) {
                            newLogs.unshift({
                                turn: nextTurn,
                                messageKey: 'log_evol_gen_b_damage_zone',
                                params: { unit: getUnitName(u.type), dmg: u.hp - newHp },
                                type: 'evolution' as const,
                                owner: PlayerID.P1
                            });
                        }
                        const isDead = newHp === 0;
                        let respawnTimer = 0;
                        if (isDead && u.type !== UnitType.GENERAL) {
                            respawnTimer = nextTurn <= 10 ? 2 : 3;
                        }
                        return { ...u, hp: newHp, isDead, respawnTimer };
                    }
                }
                return u;
            });
        }

        setGameState({
            ...prevState,
            turnCount: nextTurn,
            currentPlayer: PlayerID.P1,
            phase: 'thinking',
            timeLeft: THINKING_TIMER,
            activeUnitId: null,
            cells: newCells,
            mines: newMines,
            smokes: newSmokes,
            movements: [],
            players: {
                [PlayerID.P1]: { ...p1Updated, units: updatedP1Units },
                [PlayerID.P2]: { ...p2Updated, units: updatedP2Units }
            },
            logs: [{ turn: nextTurn, messageKey: 'log_round_start', params: { round: nextTurn }, type: 'info' as const }, ...newLogs]
        });
    };

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

    const attemptMove = (unitId: string, r: number, c: number, cost: number) => {
        const currentState = gameStateRef.current;
        if (currentState.phase === 'thinking') return;
        if (currentState.phase === 'placement') return;

        const unit = getUnit(unitId, currentState);
        if (!unit) return;
        if (unit.hasActedThisRound) return;

        // Note: cost already includes debuffs and territory modifiers via getDisplayCost
        let totalCost = cost;

        const player = currentState.players[unit.owner];
        if (player.energy < totalCost) {
            addLog('log_low_energy', 'info', { cost: totalCost });
            return;
        }

        // Rule 1: Energy Cap
        if (!checkEnergyCap(unit, player, totalCost)) return;

        // Rule: Flag Move Limit (5 moves per turn)
        if (unit.hasFlag) {
            if (unit.type === UnitType.GENERAL) {
                if (player.flagMovesMadeThisTurn >= 5) {
                    addLog('log_general_flag_move_limit', 'error');
                    return;
                }
            } else {
                if (player.nonGeneralFlagMovesMadeThisTurn >= 5) {
                    addLog('log_flag_move_limit', 'error', { unit: getUnitName(unit.type) });
                    return;
                }
            }
        }

        if (currentState.cells[r][c].isObstacle) return;

        const isOccupied = currentState.players[PlayerID.P1].units.some(u => u.r === r && u.c === c && !u.isDead) ||
            currentState.players[PlayerID.P2].units.some(u => u.r === r && u.c === c && !u.isDead);
        if (isOccupied) return;

        // --- Prepare atomic update data locally ---

        let newMines = [...currentState.mines]; // Copy of mines
        let newSmokes = [...currentState.smokes]; // Copy of smokes
        let newHp = unit.hp;
        let newMaxHp = unit.maxHp;
        let isDead = false;
        let reflectDmg = 0; // For Defuser A3-1

        // Track quest stats
        let qStats = { ...player.questStats };
        if (unit.type === UnitType.RANGER) {
            qStats.rangerSteps += 1;
            // If carrying a mine, count it as moved (only once per round per mine)
            if (unit.carriedMine) {
                if (!qStats.rangerMinesMovedThisRound) {
                    qStats.rangerMinesMovedThisRound = new Set();
                } else {
                    qStats.rangerMinesMovedThisRound = new Set(qStats.rangerMinesMovedThisRound);
                }
                // Use a unique identifier for the carried mine
                const mineId = `carried-${unit.id}`;
                if (!qStats.rangerMinesMovedThisRound.has(mineId)) {
                    qStats.rangerMinesMoved += 1;
                    qStats.rangerMinesMovedThisRound.add(mineId);
                }
            }
        }
        if (unit.hasFlag) {
            qStats.generalFlagSteps += 1;
        }

        // Mine Logic Calculation
        let mineTriggered = false;
        let mineOwnerId: PlayerID | null = null;
        let appliedStatus = { ...unit.status };
        let currentBuildings = [...currentState.buildings];
        let nukeAoeVictims: { unitId: string, owner: PlayerID, newHp: number, isDead: boolean, respawnTimer: number }[] = [];
        let nukeMineTriggered = false; // Flag to indicate if a Nuke mine was triggered

        // 1. Check for Proximity Mines (Nuke) first, then Direct Contact
        // Nuke Mine Trigger: 3x3 Proximity (Chebyshev Dist <= 1)
        const proximityNukeIndex = currentState.mines.findIndex(m =>
            m.type === MineType.NUKE &&
            m.owner !== unit.owner && // Triggered by enemy
            Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1
        );

        let activeMineIndex = -1;
        let mineToTrigger: typeof currentState.mines[0] | undefined;

        if (proximityNukeIndex !== -1) {
            activeMineIndex = proximityNukeIndex;
            mineToTrigger = currentState.mines[activeMineIndex];
            // If a proximity Nuke is found, the unit is moving into its 3x3 range.
            // The unit itself is not necessarily on the mine, but it triggers it.
            // The 'r' and 'c' here are the unit's target position.
            // The mine's position is mineToTrigger.r, mineToTrigger.c.
            // We will use mineToTrigger.r, mineToTrigger.c as the center of the blast.
            nukeMineTriggered = true;
        } else {
            // Fallback to direct contact for other mines
            const directContactMineIndex = currentState.mines.findIndex(m => m.r === r && m.c === c);
            if (directContactMineIndex !== -1) {
                activeMineIndex = directContactMineIndex;
                mineToTrigger = currentState.mines[activeMineIndex];
                if (mineToTrigger.type === MineType.NUKE) {
                    nukeMineTriggered = true;
                }
            }
        }

        if (activeMineIndex !== -1 && mineToTrigger) {
            const mine = mineToTrigger; // Use the identified mine

            // Only trigger if mine is NOT owned by the unit (or logic above for Nuke handled it)
            // Note: proximityNuke check already ensured owner !== unit.owner
            // For direct contact, we check again:
            if (mine.owner !== unit.owner && (!mine.immuneUnitIds || !mine.immuneUnitIds.includes(unit.id))) {
                mineTriggered = true;
                mineOwnerId = mine.owner;

                // Break stealth for Ranger B2. B3-1 stays.
                const rngLevelB = currentState.players[unit.owner].evolutionLevels[UnitType.RANGER].b;
                if (unit.type === UnitType.RANGER && rngLevelB === 2) {
                    appliedStatus.isStealthed = false;
                }

                let newStatus = { ...appliedStatus };
                let dmg = MINE_DAMAGE;

                dmg += (unit.status.mineVulnerability || 0);

                if (unit.type !== UnitType.DEFUSER) {
                    qStats.triggeredMineThisRound = true;
                }

                // --- General Evolution Logic: Path A Tier 1 (Self-Debuff) ---
                if (unit.type === UnitType.GENERAL) {
                    const genLevelA = currentState.players[unit.owner].evolutionLevels[UnitType.GENERAL].a;
                    if (genLevelA >= 1) {
                        dmg += 2;
                        addLog('log_evol_gen_a_mine_vuln', 'evolution');
                    }
                }

                // --- General Evolution Logic: Path B Tier 2 (Damage Reduction Aura) ---
                // Aura from owner's flag
                const unitOwnerState = currentState.players[unit.owner];
                const genLevelB = unitOwnerState.evolutionLevels[UnitType.GENERAL].b;
                if (genLevelB >= 2) {
                    const flag = unitOwnerState.flagPosition;
                    const distToFlag = Math.max(Math.abs(unit.r - flag.r), Math.abs(unit.c - flag.c));
                    if (distToFlag <= 2) { // 5x5 area (radius 2)
                        dmg = Math.floor(dmg * 0.7); // 30% reduction
                        addLog('log_evol_gen_b_dmg_reduce', 'evolution');
                    }
                }

                // --- Defuser Evolution Logic ---
                if (unit.type === UnitType.DEFUSER) {
                    const defLevels = unitOwnerState.evolutionLevels[UnitType.DEFUSER];
                    const defLevelA = defLevels.a;
                    const defVariantA = defLevels.aVariant;

                    // A1: Reduce damage by 1 (or 2 if HP < 50%)
                    if (defLevelA >= 1) {
                        const lowHpThreshold = unit.maxHp * 0.5;
                        let reduction = 1;
                        if (unit.hp < lowHpThreshold) reduction = 2;

                        // A3-2 (Variant 2): Reduce by 3 (or 4 if Low HP)
                        if (defLevelA >= 3 && defVariantA === 2) {
                            reduction = 3;
                            if (unit.hp < lowHpThreshold) reduction = 4;
                        }

                        dmg = Math.max(0, dmg - reduction);
                    }

                    // A2: Trigger mine -> MaxHP +2, Heal 1
                    if (defLevelA >= 2) {
                        newMaxHp += 2;
                        newHp = Math.min(newMaxHp, newHp + 1);
                        addLog('log_evol_def_a_heal', 'evolution');
                    }

                    // A3-1 (Variant 1): Reflect 2 DMG to lowest HP enemy
                    // A3-2 (Variant 2): Take 75% less damage (FINAL multiplier)
                    if (defLevelA >= 3) {
                        if (defVariantA === 1) {
                            reflectDmg = 2; // Handled in setGameState
                            addLog('log_evol_def_reflect', 'evolution');
                        } else if (defVariantA === 2) {
                            dmg = Math.floor(dmg * 0.25);
                            addLog('log_defuser_reduce', 'mine', undefined, unit.owner);
                        }
                    }

                    qStats.defuserMinesSoaked += 1;
                }

                if (mine.type === MineType.SMOKE) {
                    dmg = 5;
                    // Create persistent smoke in 3x3 area
                    const smokeIdBase = `smoke-${Date.now()}`;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                newSmokes.push({
                                    id: `${smokeIdBase}-${dr}-${dc}`,
                                    r: nr, c: nc,
                                    owner: mine.owner,
                                    duration: 3 // Lasts for 3 rounds
                                });
                            }
                        }
                    }
                    addLog('log_smoke_deployed', 'mine', { r: r + 1, c: c + 1 }, mine.owner);
                } else if (mine.type === MineType.SLOW) {
                    dmg = 3;
                    const baseMove = UNIT_STATS[unit.type].moveCost;
                    newStatus.moveCostDebuff = (newStatus.moveCostDebuff || 0) + baseMove;
                    newStatus.moveCostDebuffDuration = 3; // Lasts current, opponent, and next action turn
                    addLog('log_heavy_steps', 'mine', undefined, mine.owner);
                    // Note: unit.status assignment is handled in the setGameState below via status: newStatus
                } else if (mine.type === MineType.NUKE) {
                    // The unit triggering the Nuke takes 12 damage.
                    // Other units in the 3x3 blast radius take 6 damage.
                    const nukeBlastDamage = 6;
                    dmg = 12; // Damage for the unit that triggered it

                    // 1. Destroy ALL mines in 3x3 (including the nuke itself)
                    newMines = newMines.filter(m =>
                        !(Math.abs(m.r - mine.r) <= 1 && Math.abs(m.c - mine.c) <= 1)
                    );

                    // 2. Destroy ALL buildings in 3x3 (FRIENDLY AND ENEMY)
                    currentBuildings = currentBuildings.filter(b =>
                        !(Math.abs(b.r - mine.r) <= 1 && Math.abs(b.c - mine.c) <= 1)
                    );

                    // 3. Deal AOE Damage to ALL units in 3x3 (FRIENDLY AND ENEMY)
                    const allUnits = [
                        ...currentState.players[PlayerID.P1].units,
                        ...currentState.players[PlayerID.P2].units
                    ];

                    allUnits.forEach(targetUnit => {
                        if (!targetUnit.isDead && Math.abs(targetUnit.r - mine.r) <= 1 && Math.abs(targetUnit.c - mine.c) <= 1) {
                            let damageToApply = nukeBlastDamage;
                            if (targetUnit.id === unit.id) {
                                // The unit that triggered the mine takes the full 'dmg' (12)
                                // This 'dmg' will be applied to 'newHp' later for the moving unit.
                                // For other units, we apply nukeBlastDamage.
                                return; // Skip, as 'unit' will be handled by 'newHp -= dmg' below
                            }

                            let targetNewHp = Math.max(0, targetUnit.hp - damageToApply);
                            let targetIsDead = targetNewHp === 0;
                            let targetRespawnTimer = 0;
                            if (targetIsDead && targetUnit.type !== UnitType.GENERAL) {
                                targetRespawnTimer = currentState.turnCount <= 10 ? 2 : 3;
                            }

                            nukeAoeVictims.push({
                                unitId: targetUnit.id,
                                owner: targetUnit.owner,
                                newHp: targetNewHp,
                                isDead: targetIsDead,
                                respawnTimer: targetRespawnTimer
                            });
                            addLog('log_evol_nuke_blast_hit', 'combat', { unit: getUnitName(targetUnit.type), dmg: damageToApply }, mine.owner);
                        }
                    });

                } else if (mine.type === MineType.CHAIN) {
                    dmg = 6;
                    // Chain reaction: trigger other ANY mines in 5x5 (radius 2)
                    const subMines = newMines.filter(m =>
                        m.id !== mine.id && Math.abs(m.r - r) <= 2 && Math.abs(m.c - c) <= 2
                    );
                    subMines.forEach(sm => {
                        addLog('log_evol_mkr_chain', 'mine', { r: sm.r + 1, c: sm.c + 1 });
                        dmg += 2; // Flat bonus damage for each chain

                        // TRIGGER sub-mine effects
                        if (sm.type === MineType.SMOKE) {
                            const smokeIdBase = `smoke-chain-${Date.now()}-${sm.id}`;
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    const nr = sm.r + dr, nc = sm.c + dc;
                                    if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                        newSmokes.push({
                                            id: `${smokeIdBase}-${dr}-${dc}`,
                                            r: nr, c: nc,
                                            owner: sm.owner,
                                            duration: 3
                                        });
                                    }
                                }
                            }
                        } else if (sm.type === MineType.SLOW) {
                            newStatus.moveCostDebuff = (newStatus.moveCostDebuff || 0) + 6;
                        } else if (sm.type === MineType.NUKE) {
                            // Chain-triggered Nuke also destroys all mines/buildings in its 3x3
                            newMines = newMines.filter(m =>
                                !(Math.abs(m.r - sm.r) <= 1 && Math.abs(m.c - sm.c) <= 1)
                            );
                            currentBuildings = currentBuildings.filter(b =>
                                !(Math.abs(b.r - sm.r) <= 1 && Math.abs(b.c - sm.c) <= 1)
                            );
                            // AOE damage for chain-triggered nuke is not implemented here for simplicity,
                            // as it would require recursive state updates.
                        }
                    });
                    newMines = newMines.filter(m => !subMines.includes(m) && m.id !== mine.id);
                } else {
                    // Normal Mine
                    dmg = MINE_DAMAGE;
                }

                if (currentState.isGodMode) dmg = 0;

                newHp -= dmg; // Apply damage to the moving unit
                addLog('log_hit_mine', 'mine', { unit: getUnitName(unit.type), dmg }, unit.owner);
                // Remove the triggered mine from the list, unless it was a Nuke mine which is handled by the 3x3 filter
                if (!nukeMineTriggered) {
                    newMines.splice(newMines.findIndex(m => m.id === mine.id), 1);
                }
                appliedStatus = newStatus;
            }
        }

        if (newHp <= 0) {
            isDead = true;
            newHp = 0;
        }

        // --- Single Atomic State Update ---
        setGameState(prev => {
            const prevPlayerState = prev.players[unit.owner];
            const updatedUnits = prevPlayerState.units.map(u => {
                if (u.id !== unit.id) return u;
                return {
                    ...u,
                    r, c,
                    hp: newHp,
                    maxHp: newMaxHp, // Update MaxHP (Defuser A2)
                    isDead,
                    respawnTimer: (newHp <= 0 && unit.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0,
                    hasFlag: unit.hasFlag,
                    hasActedThisRound: false, // Allow more moves
                    energyUsedThisTurn: u.energyUsedThisTurn + totalCost,
                    status: appliedStatus,
                    startOfActionEnergy: u.energyUsedThisTurn === 0 ? prevPlayerState.energy : u.startOfActionEnergy,
                    stats: {
                        ...u.stats,
                        stepsTaken: u.stats.stepsTaken + 1,
                        minesTriggered: u.stats.minesTriggered + (mineTriggered ? 1 : 0)
                    }
                };
            });

            // Apply Reflection Damage (Defuser A3-1)
            let playersUpdates = { [unit.owner]: { ...prevPlayerState, units: updatedUnits } };

            if (reflectDmg > 0) {
                const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                const enemyState = prev.players[enemyId];
                if (enemyState.units.length > 0) {
                    const livingEnemies = enemyState.units.filter(u => !u.isDead);
                    if (livingEnemies.length > 0) {
                        livingEnemies.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
                        const target = livingEnemies[0];
                        const newEnemyHp = Math.max(0, target.hp - reflectDmg);
                        const isEnemyDead = newEnemyHp === 0;

                        const enemyUpdatedUnits = enemyState.units.map(u =>
                            u.id === target.id ? {
                                ...u,
                                hp: newEnemyHp,
                                isDead: isEnemyDead,
                                respawnTimer: (isEnemyDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0
                            } : u
                        );

                        playersUpdates[enemyId] = { ...enemyState, units: enemyUpdatedUnits };
                        addLog('log_evol_def_reflect_hit', 'combat', { unit: getUnitName(target.type), dmg: reflectDmg }, unit.owner);
                    }
                }
            } else {
                // Ensure opponent state is preserved or updated if needed
                const opponentId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                playersUpdates[opponentId] = prev.players[opponentId];
            }

            // Opponent Quest Stats (Maker Trigger)
            let finalP1 = playersUpdates[PlayerID.P1];
            let finalP2 = playersUpdates[PlayerID.P2];

            const mineOwnerIdLocal = mineOwnerId; // Closure capture
            if (mineTriggered && mineOwnerIdLocal) {
                if (mineOwnerIdLocal === PlayerID.P1) {
                    finalP1 = { ...finalP1, questStats: { ...finalP1.questStats, makerMinesTriggeredByEnemy: finalP1.questStats.makerMinesTriggeredByEnemy + 1 } };
                } else {
                    finalP2 = { ...finalP2, questStats: { ...finalP2.questStats, makerMinesTriggeredByEnemy: finalP2.questStats.makerMinesTriggeredByEnemy + 1 } };
                }
            }

            // Ensure current player stats updated (energy etc)
            const pId = unit.owner;
            const finalCurrentPlayer = pId === PlayerID.P1 ? finalP1 : finalP2;

            const finalPState = {
                ...finalCurrentPlayer,
                energy: prevPlayerState.energy - totalCost,
                questStats: qStats,
                flagPosition: (unit.hasFlag) ? { r, c } : prevPlayerState.flagPosition,
                movesMadeThisTurn: prevPlayerState.movesMadeThisTurn + 1,
                flagMovesMadeThisTurn: (unit.hasFlag && unit.type === UnitType.GENERAL) ? prevPlayerState.flagMovesMadeThisTurn + 1 : prevPlayerState.flagMovesMadeThisTurn,
                nonGeneralFlagMovesMadeThisTurn: (unit.hasFlag && unit.type !== UnitType.GENERAL) ? prevPlayerState.nonGeneralFlagMovesMadeThisTurn + 1 : prevPlayerState.nonGeneralFlagMovesMadeThisTurn,
                // units already in finalP1/P2
            };

            if (pId === PlayerID.P1) finalP1 = finalPState;
            else finalP2 = finalPState;

            // Apply Nuke Aoe Victims
            nukeAoeVictims.forEach(v => {
                let targetP = v.owner === PlayerID.P1 ? finalP1 : finalP2;
                const newUnits = targetP.units.map(u => {
                    if (u.id === v.unitId) {
                        return {
                            ...u,
                            hp: v.newHp,
                            isDead: v.isDead,
                            respawnTimer: v.respawnTimer
                        };
                    }
                    return u;
                });
                if (v.owner === PlayerID.P1) finalP1 = { ...finalP1, units: newUnits };
                else finalP2 = { ...finalP2, units: newUnits };
            });



            // Add death log if unit died from mine
            if (isDead && unit.type !== UnitType.GENERAL) {
                const resurrectionRounds = prev.turnCount <= 10 ? 2 : 3;
                addLog('log_unit_died', 'info', { unit: getUnitName(unit.type), rounds: resurrectionRounds }, unit.owner);
            }

            return {
                ...prev,
                activeUnitId: unit.id, // Lock unit
                mines: newMines, // Update mines list (with removal)
                smokes: newSmokes, // Update smokes list
                buildings: currentBuildings, // Update buildings list (potential nuke destruction)
                movements: [...prev.movements, { unitId: unit.id, from: { r: unit.r, c: unit.c }, to: { r, c }, energy: totalCost }],
                players: {
                    [PlayerID.P1]: finalP1,
                    [PlayerID.P2]: finalP2
                }
            };
        });

        setTimeout(() => {
            checkVictory();
        }, 100);
    };

    const renderEvolutionTree = () => {
        const p = gameState.players[gameState.currentPlayer];
        const stats = p.questStats;
        const levels = p.evolutionLevels;

        const getProgress = (unitType: UnitType, branch: 'a' | 'b') => {
            switch (unitType) {
                case UnitType.GENERAL: return branch === 'a' ? stats.generalDamage : stats.generalFlagSteps;
                case UnitType.MINESWEEPER: return branch === 'a' ? stats.sweeperMinesMarked : stats.consecutiveSafeRounds;
                case UnitType.RANGER: return branch === 'a' ? stats.rangerSteps : stats.rangerMinesMoved;
                case UnitType.MAKER: return branch === 'a' ? stats.makerMinesTriggeredByEnemy : stats.makerMinesPlaced;
                case UnitType.DEFUSER: return branch === 'a' ? stats.defuserMinesSoaked : stats.defuserMinesDisarmed;
                default: return 0;
            }
        };

        return (
            <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center pointer-events-auto">
                <div className="w-[95%] max-w-6xl max-h-[85vh] bg-gray-900 border-2 border-indigo-500 rounded-lg shadow-2xl flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 shrink-0">
                        <h2 className="text-2xl font-bold text-indigo-400 flex items-center gap-2"><Dna size={24} /> {t('evolution_tree')}</h2>
                        <button onClick={() => setShowEvolutionTree(false)} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><X size={24} /></button>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="space-y-4">
                            {Object.entries(EVOLUTION_CONFIG).map(([typeStr, config]) => {
                                const type = typeStr as UnitType;
                                return (
                                    <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                        <div className="flex items-center gap-2 mb-4 text-indigo-300 font-bold border-b border-gray-700 pb-3">
                                            {getUnitIcon(type, 24)} <span className="text-lg">{type}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {['a', 'b'].map((branchKey) => {
                                                const branch = branchKey as 'a' | 'b';
                                                const currentVal = getProgress(type, branch);
                                                const maxVal = config[branch].thresholds[2];
                                                const currentLevel = levels[type][branch];
                                                const variantKey = branch === 'a' ? 'aVariant' : 'bVariant';
                                                const selectedVariant = levels[type][variantKey];

                                                let barColor = 'bg-gray-600';
                                                if (currentLevel === 1) barColor = 'bg-blue-500';
                                                if (currentLevel === 2) barColor = 'bg-purple-500';
                                                if (currentLevel === 3) barColor = 'bg-yellow-400';

                                                return (
                                                    <div key={branch} className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <div className="text-sm text-gray-300 font-bold flex items-center gap-2">
                                                                <span className={`w-2.5 h-2.5 rounded-full ${branch === 'a' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                                                <span>{t(branch === 'a' ? 'path_a' : 'path_b')}</span>
                                                                <span className="text-xs text-gray-400 font-normal">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_subtitle`)}</span>
                                                                {currentLevel < 3 && currentVal >= config[branch].thresholds[currentLevel] && (
                                                                    <span className="text-[10px] text-green-400 font-bold animate-pulse">??READY</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 font-mono">{currentVal} / {maxVal}</div>
                                                        </div>

                                                        <div className="flex h-2">
                                                            {(() => {
                                                                const t1 = config[branch].thresholds[0];
                                                                const t2 = config[branch].thresholds[1];
                                                                const seg1Width = (t1 / maxVal) * 100;
                                                                const seg2Width = ((t2 - t1) / maxVal) * 100;
                                                                const seg3Width = ((maxVal - t2) / maxVal) * 100;

                                                                return (
                                                                    <>
                                                                        <div style={{ width: `${seg1Width}%` }} className="bg-gray-700/50 rounded-l-full overflow-hidden border-r border-gray-900/50">
                                                                            <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, (currentVal / t1) * 100)}%` }} />
                                                                        </div>
                                                                        <div style={{ width: `${seg2Width}%` }} className="bg-gray-700/50 overflow-hidden border-r border-gray-900/50">
                                                                            <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: currentVal > t1 ? `${Math.min(100, ((currentVal - t1) / (t2 - t1)) * 100)}%` : '0%' }} />
                                                                        </div>
                                                                        <div style={{ width: `${seg3Width}%` }} className="bg-gray-700/50 rounded-r-full overflow-hidden">
                                                                            <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: currentVal > t2 ? `${Math.min(100, ((currentVal - t2) / (maxVal - t2)) * 100)}%` : '0%' }} />
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>

                                                        <div className="flex items-center h-24">
                                                            {/* LV1 Card */}
                                                            <div className="flex-1 relative h-full">
                                                                {(() => {
                                                                    const cardId = `${type}-${branch}-1`;
                                                                    const isFlipped = flippedCardId === cardId;
                                                                    const isUnlocked = currentLevel >= 1;
                                                                    return (
                                                                        <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                            className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#0a0f1a] border-indigo-400 shadow-2xl overflow-visible' : `h-full ${isUnlocked ? 'bg-blue-950/40 border-blue-600/80 text-blue-100' : 'bg-gray-800/50 border-gray-600 text-gray-500 opacity-60'}`}`}>
                                                                            {isFlipped ? (
                                                                                <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-blue-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_detail`)}</div>
                                                                            ) : (
                                                                                <div className="flex justify-between items-center w-full">
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <div className="font-bold mb-0.5 opacity-70">LV1</div>
                                                                                        <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[0])}</div>
                                                                                    </div>
                                                                                    <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                        {isUnlocked && <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>}
                                                                                        <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_req`)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {/* Connection 1 */}
                                                            <div className="w-8 h-0.5 bg-gray-700/80 shrink-0" />

                                                            {/* LV2 Card */}
                                                            <div className="flex-1 relative h-full">
                                                                {(() => {
                                                                    const cardId = `${type}-${branch}-2`;
                                                                    const isFlipped = flippedCardId === cardId;
                                                                    const isUnlocked = currentLevel >= 2;
                                                                    return (
                                                                        <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                            className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1a0a1f] border-indigo-400 shadow-2xl' : `h-full ${isUnlocked ? 'bg-purple-950/40 border-purple-600/80 text-purple-100' : 'bg-gray-800/50 border-gray-600 text-gray-500 opacity-60'}`}`}>
                                                                            {isFlipped ? (
                                                                                <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-purple-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_detail`)}</div>
                                                                            ) : (
                                                                                <div className="flex justify-between items-center w-full">
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <div className="font-bold mb-0.5 opacity-70">LV2</div>
                                                                                        <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[1])}</div>
                                                                                    </div>
                                                                                    <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                        {isUnlocked && <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>}
                                                                                        <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_req`)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {/* Connection 2 or Branch */}
                                                            {
                                                                currentLevel === 3 && selectedVariant ? (
                                                                    <>
                                                                        <div className="w-8 h-0.5 bg-gray-700/80 shrink-0" />
                                                                        <div className="flex-1 relative h-full">
                                                                            {(() => {
                                                                                const subLevel = selectedVariant;
                                                                                const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                                const isFlipped = flippedCardId === cardId;
                                                                                const cardIdx = (selectedVariant + 1);
                                                                                return (
                                                                                    <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                                        className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1f100a] border-indigo-400 shadow-2xl' : 'h-full bg-orange-950/40 border-orange-500 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.15)]'}`}>
                                                                                        {isFlipped ? (
                                                                                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-orange-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}</div>
                                                                                        ) : (
                                                                                            <div className="flex justify-between items-center w-full">
                                                                                                <div className="flex flex-col min-w-0">
                                                                                                    <div className="font-bold mb-0.5 opacity-70">LV3-{subLevel}</div>
                                                                                                    <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[cardIdx])}</div>
                                                                                                </div>
                                                                                                <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>
                                                                                                    <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_req`)}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex flex-col items-center justify-center text-gray-700/80 w-8 shrink-0">
                                                                            <svg width="32" height="80" viewBox="0 0 32 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                                <path d="M0 40H8C12 40 14 39 14 36V18C14 15 16 14 24 14H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                                                <path d="M14 44V62C14 65 16 66 24 66H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                                                <circle cx="14" cy="40" r="2.5" fill="currentColor" className="animate-pulse" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="flex flex-col flex-1 gap-1.5 h-full">
                                                                            {[2, 3].map((idx) => {
                                                                                const subLevel = idx - 1;
                                                                                const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                                const isOtherVariantSelected = selectedVariant !== null && selectedVariant !== undefined && selectedVariant !== subLevel;
                                                                                const isUnlocked = currentLevel === 3 && selectedVariant !== null && selectedVariant === subLevel;
                                                                                const isFlipped = flippedCardId === cardId;
                                                                                return (
                                                                                    <div key={idx} className="relative h-[46px]">
                                                                                        <div onClick={() => {
                                                                                            if (isOtherVariantSelected) return;
                                                                                            setFlippedCardId(isFlipped ? null : cardId);
                                                                                        }} className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1a1a1a] border-indigo-400 shadow-2xl' : `h-full ${isUnlocked ? 'bg-orange-950/40 border-orange-500 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : isOtherVariantSelected ? 'bg-transparent border-gray-800 text-gray-700 opacity-20 grayscale pointer-events-none' : 'bg-gray-800/40 border-gray-600/50 text-gray-500 hover:border-gray-500'}`}`}>
                                                                                            {isFlipped ? (
                                                                                                <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-gray-100">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}</div>
                                                                                            ) : (
                                                                                                <div className="flex justify-between items-center h-full">
                                                                                                    <div className="flex flex-col justify-center min-w-0">
                                                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                                                            <span className={`text-[9px] ${isUnlocked ? 'text-orange-400' : 'text-gray-500'} font-bold`}>LV3-{subLevel}</span>
                                                                                                            {isUnlocked && <span className="text-[7px] px-1 bg-orange-600 text-white rounded-sm font-black animate-pulse">ACTIVED</span>}
                                                                                                        </div>
                                                                                                        <div className="text-[10px] leading-tight truncate font-bold">{t(config[branch].rewardText[idx])}</div>
                                                                                                    </div>
                                                                                                    <div className="text-[10px] text-gray-400 font-bold italic shrink-0 ml-2 text-right leading-tight">
                                                                                                        {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_req`)}
                                                                                                        {!selectedVariant && currentLevel === 2 && currentVal >= config[branch].thresholds[2] && <div className="text-green-400 font-black animate-bounce mt-0.5 text-[8px]">SELECT</div>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </>
                                                                )}
                                                        </div >
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderControlPanel = () => {
        const player = gameState.players[gameState.currentPlayer];
        const isThinking = gameState.phase === 'thinking';
        const isPlacement = gameState.phase === 'placement';

        // Calculate detailed income breakdown
        const interest = Math.min(Math.floor(player.energy / 10), MAX_INTEREST);

        // Calculate Passive Ore Income
        const currentOreIncome = player.units.reduce((acc, u) => {
            if (u.isDead) return acc;
            const cell = gameState.cells[u.r][u.c];
            if (cell.hasEnergyOre && cell.oreSize) {
                return acc + ORE_REWARDS[cell.oreSize];
            }
            return acc;
        }, 0);

        // Dynamic regen based on turn
        let currentRegen = ENERGY_REGEN; // Default 35
        if (gameState.turnCount >= 12) currentRegen = 50;
        else if (gameState.turnCount >= 8) currentRegen = 45;
        else if (gameState.turnCount >= 4) currentRegen = 40;

        const totalIncome = currentRegen + interest + currentOreIncome + player.energyFromKills;

        return (
            <div className="h-56 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-t-4 border-white flex shrink-0 z-20 shadow-2xl shadow-white/10">
                <div className="flex w-full">
                    {/* Energy & Timer Panel */}
                    <div className="flex-[3] flex flex-col p-3 border-r-2 border-white/30 min-w-[200px] bg-slate-800/50 gap-2">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Zap size={20} className="text-yellow-400 drop-shadow-lg" />
                                <span className="text-4xl font-black text-yellow-400 drop-shadow-lg">{player.energy}</span>
                            </div>

                            <div className="text-xs text-white space-y-1 font-semibold">
                                <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded border border-emerald-500/30">
                                    <span className="text-white/80 text-xs">下回合預計收益</span>
                                    <span className="text-emerald-400 font-black text-lg">+{totalIncome}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900/30 p-1.5 rounded border border-white/20">
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                            基礎
                                        </span>
                                        <span className="text-blue-300 font-bold">+{currentRegen}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                            利息
                                        </span>
                                        <span className="text-emerald-300 font-bold">+{interest}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            領地/礦石
                                        </span>
                                        <span className="text-yellow-300 font-bold">+{currentOreIncome}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                            擊殺
                                        </span>
                                        <span className="text-red-300 font-bold">+{player.energyFromKills}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowEvolutionTree(true)}
                            className="mt-auto py-1 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded font-black text-[11px] flex items-center justify-center gap-1 border-2 border-purple-400 shadow-lg shadow-purple-500/50 transition-all hover:scale-105 text-white"
                        >
                            <Dna size={14} /> 進化樹
                        </button>
                    </div>

                    {/* Squad Selection */}
                    <div className="flex-[7] flex flex-col border-l-2 border-white/30 px-4 items-center h-full justify-center bg-slate-800/30">
                        <div className="text-sm text-white mb-2 uppercase tracking-widest text-center w-full flex justify-between px-4 font-bold">
                            <span className="text-base">小隊選單</span>
                            <span className="text-yellow-400 font-black text-base">
                                {isPlacement ? `${t('round')} ${gameState.turnCount}` : `${t('round')} ${gameState.turnCount}-${player.units.filter(u => u.hasActedThisRound).length + 1}`}
                            </span>
                        </div>

                        <div className="flex gap-4 justify-center w-full">
                            {player.units.map((u) => {
                                // Calculate Tier for Visuals
                                const levelA = player.evolutionLevels[u.type].a;
                                const levelB = player.evolutionLevels[u.type].b;
                                const tier = Math.max(levelA, levelB);

                                // Check if this unit can be swapped (placement phase)
                                const canSwap = isPlacement && gameState.selectedUnitId && gameState.selectedUnitId !== u.id;

                                return (
                                    <div key={u.id} className="flex flex-col items-center gap-1">
                                        <button
                                            disabled={u.isDead || u.hasActedThisRound}
                                            onClick={() => handleUnitClick(u)}
                                            className={`
                                        relative flex flex-col items-center justify-between w-20 h-24 rounded-lg border-2 transition-all
                                        ${u.isDead ? 'opacity-30 grayscale cursor-not-allowed bg-red-950/50 border-red-600' : ''}
                                        ${u.hasActedThisRound ? `opacity-50 cursor-not-allowed border-red-500 ${u.owner === PlayerID.P1 ? 'bg-cyan-900/40' : 'bg-red-900/40'}` : ''}
                                        ${canSwap
                                                    ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                                    : gameState.selectedUnitId === u.id
                                                        ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)] scale-110 z-10'
                                                        : u.owner === PlayerID.P1
                                                            ? 'bg-cyan-900/40 border-slate-600 hover:bg-cyan-900/60 hover:border-cyan-500'
                                                            : 'bg-red-900/40 border-slate-600 hover:bg-red-900/60 hover:border-red-500'
                                                }
                                    `}
                                        >
                                            {/* Evolution Stars - Top Right */}
                                            <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                                                {/* Path A Stars (Blue) - Top */}
                                                {levelA > 0 && (
                                                    <div className="flex gap-0.5">
                                                        {Array.from({ length: levelA }).map((_, i) => {
                                                            const variantA = player.evolutionLevels[u.type].aVariant;
                                                            let colorClass = "text-blue-400 fill-blue-400";
                                                            // If Level 3 is reached with a variant, make ALL stars that color
                                                            if (levelA === 3 && variantA) {
                                                                if (variantA === 1) colorClass = "text-cyan-400 fill-cyan-400"; // 3-1 Light Blue
                                                                else if (variantA === 2) colorClass = "text-purple-400 fill-purple-400"; // 3-2 Purple
                                                            } else if (i === 2 && variantA) {
                                                                // Fallback for partial data if level is 3 but variant only applies to last
                                                                if (variantA === 1) colorClass = "text-cyan-400 fill-cyan-400";
                                                                else if (variantA === 2) colorClass = "text-purple-400 fill-purple-400";
                                                            }
                                                            return <Star key={`a-${i}`} size={8} className={`${colorClass} drop-shadow-sm`} />;
                                                        })}
                                                    </div>
                                                )}
                                                {/* Path B Stars (Orange) - Bottom */}
                                                {levelB > 0 && (
                                                    <div className="flex gap-0.5">
                                                        {Array.from({ length: levelB }).map((_, i) => {
                                                            const variantB = player.evolutionLevels[u.type].bVariant;
                                                            let colorClass = "text-orange-400 fill-orange-400";
                                                            // If Level 3 is reached with a variant, make ALL stars that color
                                                            if (levelB === 3 && variantB) {
                                                                if (variantB === 1) colorClass = "text-yellow-400 fill-yellow-400"; // 3-1 Light Yellow
                                                                else if (variantB === 2) colorClass = "text-rose-500 fill-rose-500"; // 3-2 Red
                                                            } else if (i === 2 && variantB) {
                                                                if (variantB === 1) colorClass = "text-yellow-400 fill-yellow-400";
                                                                else if (variantB === 2) colorClass = "text-rose-500 fill-rose-500";
                                                            }
                                                            return <Star key={`b-${i}`} size={8} className={`${colorClass} drop-shadow-sm`} />;
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Keyboard Shortcut Indicator */}
                                            <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">
                                                {u.type === UnitType.GENERAL ? 'Q' : u.type === UnitType.MINESWEEPER ? 'W' : u.type === UnitType.RANGER ? 'E' : u.type === UnitType.MAKER ? 'R' : 'T'}
                                            </div>

                                            {u.isDead && <Skull size={40} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white z-20 drop-shadow-lg" />}
                                            {canSwap && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <svg className="w-10 h-10 text-emerald-300 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                                                        <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                                                    </svg>
                                                </div>
                                            )}

                                            {/* Main Content Area - Flex-1 to push everything down */}
                                            <div className="flex-1 flex flex-col items-center justify-center w-full pt-1">
                                                <div className={`${u.owner === PlayerID.P1 ? 'text-cyan-400 drop-shadow-lg' : 'text-red-400 drop-shadow-lg'} flex items-center justify-center`}>
                                                    {getUnitIcon(u.type, 30, tier)}
                                                </div>
                                            </div>

                                            {/* Health Bar, HP Text - Compact Bottom Section */}
                                            <div className="flex flex-col items-center gap-0.5 pb-0">
                                                <div className="w-12 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-600">
                                                    <div
                                                        className={`h-full transition-all ${u.hp < u.maxHp * 0.3 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'}`}
                                                        style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="text-[8px] font-black text-white font-mono">
                                                    HP:{u.hp}
                                                </div>
                                            </div>

                                            {/* Unit Name - Fixed at bottom */}
                                            <div className="text-[9px] font-black text-slate-300 pb-0.5">
                                                {getUnitName(u.type)}
                                            </div>

                                            {/* Resurrection Timer Display */}
                                            {u.isDead && u.respawnTimer > 0 && (
                                                <div className="text-[10px] font-black text-red-500 font-mono">
                                                    復活:{u.respawnTimer}
                                                </div>
                                            )}
                                        </button>

                                        {/* Energy Cap Display */}
                                        <div className="text-[10px] font-black text-cyan-300 font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                            {u.energyUsedThisTurn}/{Math.floor(u.startOfActionEnergy * ENERGY_CAP_RATIO)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Buttons & End Turn */}
                    <div className="flex-[4] flex flex-col border-l-2 border-white/30 px-4 items-center justify-between h-full py-1 bg-slate-800/30">
                        {/* Placement Phase Overlay Controls */}
                        {isPlacement ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                <div className="text-sm font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">{t('placement_phase')}</div>
                                <div className="text-[10px] text-white text-center font-semibold">{t('placement_guide')}</div>
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => setTargetMode(targetMode === 'place_setup_mine' ? null : 'place_setup_mine')}
                                        className={`flex-1 py-2 px-1 rounded font-black text-xs flex items-center justify-center gap-1 border-2 transition-all ${targetMode === 'place_setup_mine' ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/50' : 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-purple-500 text-slate-300'}`}
                                    >
                                        <Bomb size={14} /> {t('place_setup_mine')} ({player.placementMinesPlaced}/{PLACEMENT_MINE_LIMIT})
                                    </button>
                                    <button
                                        onClick={finishPlacementPhase}
                                        className="flex-1 py-2 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-black text-xs flex items-center justify-center gap-1 border-2 border-emerald-400 shadow-lg shadow-emerald-500/50 transition-all"
                                    >
                                        <CheckCircle size={14} /> {t('confirm_placement')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-base text-white uppercase tracking-widest text-center w-full font-bold mt-6">
                                    {gameState.selectedUnitId ? t('select_action') : t('select_unit')}
                                </div>

                                <div className="flex-1 flex flex-col justify-center w-full">
                                    <div className="w-full flex flex-col justify-center gap-2 items-center relative min-w-[150px]">
                                        {isThinking ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-white font-black animate-pulse uppercase tracking-widest text-xs drop-shadow-lg">{t('planning_phase')}</span>
                                                <button
                                                    onClick={() => startActionPhase()}
                                                    className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-black shadow-lg shadow-cyan-500/50 flex items-center gap-2 border-2 border-cyan-400 transition-all"
                                                >
                                                    <Play size={20} fill="currentColor" /> {t('ready')}
                                                </button>
                                            </div>
                                        ) : gameState.selectedUnitId ? (
                                            <div className="flex gap-2 justify-center flex-wrap">
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => setTargetMode('move')}
                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'move' ? 'bg-emerald-600 shadow-lg shadow-emerald-500/50 scale-105 border-emerald-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-emerald-500 text-slate-300'}`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('move', getUnit(gameState.selectedUnitId))}</div>
                                                        <ArrowRight size={20} />
                                                        <span className="text-[10px]">{t('move')}</span>
                                                    </button>
                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                        <span>{(() => {
                                                            const unit = getUnit(gameState.selectedUnitId);
                                                            if (!unit) return 3;

                                                            let baseCost = 3;

                                                            // Any unit with flag costs 4 (if Gen B Lvl 3+) or 5 (General only)
                                                            if (unit.hasFlag) {
                                                                const player = gameState.players[unit.owner];
                                                                const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                                                                if (genLevelB >= 3) {
                                                                    baseCost = 4;
                                                                } else if (unit.type === UnitType.GENERAL) {
                                                                    baseCost = 5;
                                                                }
                                                            }

                                                            // Ranger with mine costs 3
                                                            else if (unit.type === UnitType.RANGER && unit.carriedMine) {
                                                                baseCost = 3;
                                                            }
                                                            // Default move cost
                                                            else {
                                                                baseCost = UNIT_STATS[unit.type].moveCost;
                                                            }

                                                            return getDisplayCost(unit, baseCost);
                                                        })()}</span>
                                                    </div>
                                                </div>

                                                {(() => {
                                                    const unit = getUnit(gameState.selectedUnitId);
                                                    if (!unit || unit.owner !== gameState.currentPlayer) return null;

                                                    const player = gameState.players[unit.owner];
                                                    const buttons = [];

                                                    // Removed Teleport from early push

                                                    // General specific actions
                                                    if (unit.type === UnitType.GENERAL) {
                                                        const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
                                                        const canAttack = !unit.hasFlag || genLevelA >= 3;
                                                        if (canAttack || gameState.isGodMode) {
                                                            buttons.push(
                                                                <div key="attack" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => setTargetMode('attack')}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'attack' ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-105 border-red-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-red-500 text-slate-300'}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('attack', unit)}</div>
                                                                        <Swords size={20} />
                                                                        <span className="text-[10px]">{t('attack')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // --- Universal Dismantle Button (If on enemy building) ---
                                                    if (unit.type !== UnitType.DEFUSER) {
                                                        const isOnEnemyBuilding = gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
                                                        if (isOnEnemyBuilding) {
                                                            buttons.push(
                                                                <div key="custom_dismantle" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleDisarmAction(unit, unit.r, unit.c)}
                                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('custom_dismantle', unit)}</div>
                                                                        <Unlock size={20} />
                                                                        <span className="text-[10px]">{language === 'zh_tw' ? '拆除敵方建築' : 'Dismantle'}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, 3)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Flag pickup/drop for General
                                                    if (unit.type === UnitType.GENERAL) {
                                                        const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
                                                        if (!unit.hasFlag && isAtFlag) {
                                                            buttons.push(
                                                                <div key="pickup" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={handlePickupFlag}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600/70 hover:bg-yellow-600 border-yellow-500 cursor-pointer`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('pickup_flag', unit)}</div>
                                                                        <Flag size={20} />
                                                                        <span className="text-[10px]">{t('take')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>0</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.hasFlag) {
                                                            buttons.push(
                                                                <div key="drop" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={handleDropFlag}
                                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600/70 hover:bg-yellow-600 font-bold border-2 border-yellow-500"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('drop_flag', unit)}</div>
                                                                        <ArrowDownToLine size={20} />
                                                                        <span className="text-[10px]">{t('drop')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>0</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Minesweeper Actions
                                                    if (unit.type === UnitType.MINESWEEPER) {
                                                        const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
                                                        const variantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
                                                        const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;

                                                        // Path A: Place Tower (Lvl 1+)
                                                        if (swpLevelA >= 1) {
                                                            buttons.push(
                                                                <div key="place_tower" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handlePlaceTowerAction(unit, unit.r, unit.c)}
                                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('place_tower', getUnit(gameState.selectedUnitId))}</div>
                                                                        <Radio size={20} />
                                                                        <span className="text-[10px]">{language === 'zh_tw' ? '部署掃雷塔' : 'Deploy Tower'}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            );

                                                            // Path A Lvl 3-2: Detonate Tower
                                                            if (swpLevelA === 3 && variantA === 2) {
                                                                buttons.push(
                                                                    <div key="detonate_tower" className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleDetonateTowerAction(unit)}
                                                                            className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold bg-red-600 hover:bg-red-500 border-2 border-red-400 text-white shadow-lg"
                                                                        >
                                                                            <Bomb size={20} />
                                                                            <span className="text-[10px]">{language === 'zh_tw' ? '引爆塔' : 'Detonate'}</span>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                            <span className="text-yellow-400"><Zap size={10} /></span>
                                                                            <span>2</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                        // Default Scan
                                                        const baseScanCost = (swpLevelB >= 3) ? 3 : (swpLevelB >= 2 ? 4 : UNIT_STATS[UnitType.MINESWEEPER].scanCost);
                                                        buttons.push(
                                                            <div key="scan" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => setTargetMode('scan')}
                                                                    className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'scan' ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50 scale-105 border-cyan-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-cyan-500 text-slate-300'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('scan', getUnit(gameState.selectedUnitId))}</div>
                                                                    <Eye size={20} />
                                                                    <span className="text-[10px]">{t('scan')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                                    <span>{getDisplayCost(unit, baseScanCost)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // Maker place mine + Factory
                                                    if (unit.type === UnitType.MAKER) {
                                                        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;

                                                        if (mkrLevelB >= 1) {
                                                            buttons.push(
                                                                <div key="place_factory" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handlePlaceFactoryAction(unit, unit.r, unit.c)}
                                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-orange-500 text-slate-300"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('place_factory', getUnit(gameState.selectedUnitId))}</div>
                                                                        <FlaskConical size={20} />
                                                                        <span className="text-[10px]">{language === 'zh_tw' ? '部署自動工廠' : 'Deploy Factory'}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, (player.evolutionLevels[UnitType.MAKER].b === 3 && player.evolutionLevels[UnitType.MAKER].bVariant === 2) ? 4 : 6)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        buttons.push(
                                                            <div key="place_mine_group" className="flex flex-col items-center gap-1">
                                                                <div className="flex items-stretch gap-0">
                                                                    {(() => {
                                                                        const hasMenu = player.evolutionLevels[UnitType.MAKER].a >= 1 || player.evolutionLevels[UnitType.MAKER].b >= 2;
                                                                        const isSelected = targetMode === 'place_mine';

                                                                        return (
                                                                            <button
                                                                                onClick={() => setTargetMode(targetMode === 'place_mine' ? null : 'place_mine')}
                                                                                className={`px-3 py-2 flex flex-col items-center justify-center gap-1 min-w-[72px] transition-all relative font-bold border-2 ${isSelected ? `bg-purple-600 border-white z-20 ${hasMenu ? 'rounded-l border-r-0' : 'rounded'} shadow-[0_0_15px_rgba(168,85,247,0.4)]` : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-purple-500 text-slate-300 rounded'}`}
                                                                            >
                                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('place_mine', getUnit(gameState.selectedUnitId))}</div>
                                                                                <Bomb size={20} />
                                                                                <span className="text-[10px]">放置地雷</span>
                                                                            </button>
                                                                        );
                                                                    })()}

                                                                    {/* Mine selection Mini-Grid - Seamless height alignment */}
                                                                    <div className={`overflow-hidden transition-all duration-300 flex items-center ${targetMode === 'place_mine' && (player.evolutionLevels[UnitType.MAKER].a >= 1 || player.evolutionLevels[UnitType.MAKER].b >= 2) ? 'max-w-xs opacity-100 scale-100' : 'max-w-0 opacity-0 scale-50 pointer-events-none'}`}>
                                                                        <div className="grid grid-cols-2 gap-1 px-2 bg-slate-900/90 rounded-r border-2 border-l-0 border-white h-full items-center shadow-xl backdrop-blur-md -ml-px">
                                                                            <button
                                                                                onClick={() => setSelectedMineType(MineType.NORMAL)}
                                                                                className={`w-9 h-6 rounded border ${selectedMineType === MineType.NORMAL ? 'bg-purple-600 border-white shadow-[0_0_10px_rgba(168,85,247,0.6)]' : 'bg-slate-800 border-slate-700 hover:border-purple-400'} text-[10px] font-black flex items-center justify-center transition-all hover:scale-110 active:scale-90`}
                                                                                title="一般地雷">普</button>
                                                                            {(player.evolutionLevels[UnitType.MAKER].a >= 1 || player.evolutionLevels[UnitType.MAKER].b >= 2) && (
                                                                                <button
                                                                                    onClick={() => setSelectedMineType(MineType.SMOKE)}
                                                                                    className={`w-9 h-6 rounded border ${selectedMineType === MineType.SMOKE ? 'bg-blue-600 border-white shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-slate-800 border-slate-700 hover:border-blue-400'} text-[10px] font-black flex items-center justify-center transition-all hover:scale-110 active:scale-90`}
                                                                                    title="煙霧地雷">煙</button>
                                                                            )}
                                                                            {(player.evolutionLevels[UnitType.MAKER].a >= 2 || player.evolutionLevels[UnitType.MAKER].b >= 2) && (
                                                                                <button
                                                                                    onClick={() => setSelectedMineType(MineType.SLOW)}
                                                                                    className={`w-9 h-6 rounded border ${selectedMineType === MineType.SLOW ? 'bg-amber-500 border-white shadow-[0_0_10px_rgba(245,158,11,0.6)]' : 'bg-slate-800 border-slate-700 hover:border-amber-400'} text-[10px] font-black flex items-center justify-center transition-all hover:scale-110 active:scale-90`}
                                                                                    title="緩速地雷"
                                                                                >緩</button>
                                                                            )}
                                                                            {player.evolutionLevels[UnitType.MAKER].a >= 3 && (
                                                                                <button
                                                                                    onClick={() => setSelectedMineType(player.evolutionLevels[UnitType.MAKER].aVariant === 1 ? MineType.CHAIN : MineType.NUKE)}
                                                                                    className={`w-9 h-6 rounded border ${selectedMineType === MineType.NUKE || selectedMineType === MineType.CHAIN ? 'bg-red-600 border-white shadow-[0_0_15px_rgba(220,38,38,0.7)]' : 'bg-slate-800 border-slate-700 hover:border-red-400'} text-[10px] font-black flex items-center justify-center animate-pulse transition-all hover:scale-110 active:scale-90`}
                                                                                    title={player.evolutionLevels[UnitType.MAKER].aVariant === 1 ? "連鎖反應地雷" : "核子爆炸地雷"}
                                                                                >
                                                                                    {player.evolutionLevels[UnitType.MAKER].aVariant === 1 ? '連' : '核'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white shadow-inner">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                                    <span className="min-w-[10px] text-center">
                                                                        {(() => {
                                                                            const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
                                                                            const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;
                                                                            const factories = gameState.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
                                                                            const currentlyInRange = factories.some(f => Math.max(Math.abs(f.r - unit.r), Math.abs(f.c - unit.c)) <= (f.level >= 2 ? 2 : 1));
                                                                            const isDiscounted = mkrLevelB === 3 && mkrVariantB === 1 && currentlyInRange;
                                                                            const baseCost = isDiscounted ? 0 : getMineBaseCost(selectedMineType);
                                                                            return getDisplayCost(unit, baseCost);
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // Defuser disarm
                                                    if (unit.type === UnitType.DEFUSER) {
                                                        const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
                                                        const variantB = player.evolutionLevels[UnitType.DEFUSER].bVariant;

                                                        buttons.push(
                                                            <div key="disarm" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => setTargetMode(targetMode === 'disarm' ? null : 'disarm')}
                                                                    className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'disarm' ? 'bg-teal-600 shadow-lg shadow-teal-500/50 scale-105 border-teal-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-teal-500 text-slate-300'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('disarm', getUnit(gameState.selectedUnitId))}</div>
                                                                    <Unlock size={20} />
                                                                    <span className="text-[10px]">{(() => {
                                                                        const u = getUnit(gameState.selectedUnitId);
                                                                        if (u) {
                                                                            const hasBuilding = gameState.buildings.some(b => b.r === u.r && b.c === u.c && b.owner !== u.owner);
                                                                            if (hasBuilding) return language === 'zh_tw' ? '拆除建築' : 'Dismantle';
                                                                        }
                                                                        return t('disarm');
                                                                    })()}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                                    <span>{getDisplayCost(unit, 3)}</span>
                                                                </div>
                                                            </div>
                                                        );

                                                        // Path B LV2+: Move Enemy Mine
                                                        if (defLevelB >= 2) {
                                                            buttons.push(
                                                                <div key="move_mine" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => setTargetMode(targetMode === 'move_mine_start' ? null : 'move_mine_start')}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'move_mine_start' || targetMode === 'move_mine_end' ? 'bg-amber-600 shadow-lg shadow-amber-500/50 scale-105 border-amber-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-stone-500 text-slate-300'}`}
                                                                    >
                                                                        <ChevronRight size={20} />
                                                                        <span className="text-[10px]">{t('move_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, (defLevelB === 3 && variantB === 2) ? 5 : 2)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        // Path B LV3-1: Convert Mine
                                                        if (defLevelB === 3 && variantB === 1) {
                                                            buttons.push(
                                                                <div key="convert_mine" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => setTargetMode(targetMode === 'convert_mine' ? null : 'convert_mine')}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'convert_mine' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/50 scale-105 border-indigo-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300'}`}
                                                                    >
                                                                        <Users size={20} />
                                                                        <span className="text-[10px]">{t('convert_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, 5)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Ranger mine pickup/drop + Hub actions
                                                    if (unit.type === UnitType.RANGER) {
                                                        const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
                                                        const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
                                                        const hasHub = gameState.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
                                                        const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && hasHub;

                                                        if (canTeleport) {
                                                            buttons.push(
                                                                <div key="hub_teleport" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleTeleportToHubAction(unit)}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/50 border-purple-400`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('teleport', getUnit(gameState.selectedUnitId))}</div>
                                                                        <Zap size={20} />
                                                                        <span className="text-[10px]">{language === 'zh_tw' ? '傳送' : 'Teleport'}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>5</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        // Flag pickup/drop for all units when Gen B Level 3+
                                                        const rngLevelA = player.evolutionLevels[UnitType.RANGER].a;

                                                        // Path A Tier 1: Place Hub
                                                        if (rngLevelA >= 1) {
                                                            buttons.push(
                                                                <div key="place_hub" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handlePlaceHubAction(unit, unit.r, unit.c)}
                                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-blue-500 text-slate-300"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('place_hub', getUnit(gameState.selectedUnitId))}</div>
                                                                        <Cpu size={20} />
                                                                        <span className="text-[10px]">{language === 'zh_tw' ? '部署樞紐' : 'Deploy Hub'}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400"><Zap size={10} /></span>
                                                                        <span>{getDisplayCost(unit, 8)}</span>
                                                                    </div>

                                                                </div>
                                                            );
                                                            if (!unit.carriedMine) {
                                                                const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
                                                                const pickupRadius = rngLevelB >= 1 ? 1 : 0;
                                                                const mineInRange = gameState.mines.find(m =>
                                                                    Math.abs(m.r - unit.r) <= pickupRadius &&
                                                                    Math.abs(m.c - unit.c) <= pickupRadius &&
                                                                    (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
                                                                );
                                                                if (mineInRange) {
                                                                    buttons.push(
                                                                        <div key="pickup_mine" className="flex flex-col items-center gap-1">
                                                                            <button
                                                                                onClick={() => handleRangerAction('pickup')}
                                                                                className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600 hover:bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50 border-yellow-400 cursor-pointer"
                                                                            >
                                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('pickup_mine', getUnit(gameState.selectedUnitId))}</div>
                                                                                <Hand size={20} />
                                                                                <span className="text-[10px]">{t('take_mine')}</span>
                                                                            </button>
                                                                            <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                                <span className="text-yellow-400"><Zap size={10} /></span>
                                                                                <span>0</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                // Stealth Action (B2)
                                                                if (rngLevelB === 2) {
                                                                    buttons.push(
                                                                        <div key="stealth_action" className="flex flex-col items-center gap-1">
                                                                            <button
                                                                                onClick={() => handleStealthAction(unit.id)}
                                                                                className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${unit.status.isStealthed ? 'bg-indigo-900 border-indigo-600' : 'bg-indigo-700 hover:bg-indigo-600 border-indigo-400'} shadow-lg shadow-indigo-500/50`}
                                                                            >
                                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('stealth', getUnit(gameState.selectedUnitId))}</div>
                                                                                <Ghost size={20} className={unit.status.isStealthed ? 'opacity-50' : ''} />
                                                                                <span className="text-[10px]">{unit.status.isStealthed ? (language === 'zh_tw' ? '取消隱形' : 'Cancel Stealth') : (language === 'zh_tw' ? '隱形行動' : 'Stealth Action')}</span>
                                                                            </button>
                                                                            <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                                <span className="text-yellow-400"><Zap size={10} /></span>
                                                                                <span>{unit.status.isStealthed ? 0 : 3}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                            } else {
                                                                // Path B Tier 3-2: Throw Mine
                                                                if (player.evolutionLevels[UnitType.RANGER].b === 3 && player.evolutionLevels[UnitType.RANGER].bVariant === 2) {
                                                                    buttons.push(
                                                                        <div key="throw_mine" className="flex flex-col items-center gap-1">
                                                                            <button
                                                                                onClick={() => setTargetMode(targetMode === 'throw_mine' ? null : 'throw_mine')}
                                                                                className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'throw_mine' ? 'bg-orange-600 shadow-lg shadow-orange-500/50 scale-105 border-orange-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-orange-500 text-slate-300'}`}
                                                                            >
                                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('throw_mine', getUnit(gameState.selectedUnitId))}</div>
                                                                                <Bomb size={20} />
                                                                                <span className="text-[10px]">{t('throw_mine')}</span>
                                                                            </button>
                                                                            <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                                <span className="text-yellow-400"><Zap size={10} /></span>
                                                                                <span>{getDisplayCost(unit, 4)}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                buttons.push(
                                                                    <div key="drop_mine" className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleRangerAction('drop')}
                                                                            className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600 hover:bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50 font-bold border-2 border-yellow-400"
                                                                        >
                                                                            <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('drop_mine', getUnit(gameState.selectedUnitId))}</div>
                                                                            <ArrowDownToLine size={20} />
                                                                            <span className="text-[10px]">{t('drop_mine')}</span>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                            <span className="text-yellow-400"><Zap size={10} /></span>
                                                                            <span>0</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                    }

                                                    // --- Global Teleport Logic ---
                                                    if (unit.type !== UnitType.GENERAL) {
                                                        const player = gameState.players[unit.owner];
                                                        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                                                        const canCarry = genLevelB >= 3;
                                                        const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;

                                                        if (canCarry) {
                                                            if (!unit.hasFlag && isAtFlag) {
                                                                buttons.push(
                                                                    <div key="pickup" className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            onClick={handlePickupFlag}
                                                                            disabled={!isAtFlag}
                                                                            className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${isAtFlag ? 'bg-yellow-600/70 hover:bg-yellow-600 border-yellow-500 cursor-pointer' : 'bg-slate-600 border-slate-500 text-slate-400 cursor-not-allowed opacity-50'}`}
                                                                        >
                                                                            {isAtFlag && <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('pickup_flag', getUnit(gameState.selectedUnitId))}</div>}
                                                                            <Flag size={20} />
                                                                            <span className="text-[10px]">{t('take')}</span>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                            <span className="text-yellow-400"><Zap size={10} /></span>
                                                                            <span>0</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            if (unit.hasFlag) {
                                                                buttons.push(
                                                                    <div key="drop" className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            onClick={handleDropFlag}
                                                                            className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600/70 hover:bg-yellow-600 font-bold border-2 border-yellow-500"
                                                                        >
                                                                            <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('drop_flag', getUnit(gameState.selectedUnitId))}</div>
                                                                            <ArrowDownToLine size={20} />
                                                                            <span className="text-[10px]">{t('drop')}</span>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                            <span className="text-yellow-400"><Zap size={10} /></span>
                                                                            <span>0</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        }
                                                    }
                                                    return buttons;
                                                })()}

                                                {(() => {
                                                    const unit = getUnit(gameState.selectedUnitId);
                                                    if (!unit || unit.owner !== gameState.currentPlayer) return null;

                                                    const player = gameState.players[unit.owner];
                                                    const levelA = player.evolutionLevels[unit.type].a;
                                                    const levelB = player.evolutionLevels[unit.type].b;
                                                    const questStats = player.questStats;

                                                    const evolveButtons = [];

                                                    // Check if unit can evolve (level < 3, has enough energy, AND condition is met)
                                                    let conditionMetA = false;
                                                    let conditionMetB = false;

                                                    // Get the next threshold requirement
                                                    const nextThresholdA = EVOLUTION_CONFIG[unit.type].a.thresholds[levelA];
                                                    const nextThresholdB = EVOLUTION_CONFIG[unit.type].b.thresholds[levelB];

                                                    // Check condition based on unit type
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

                                                    // Handle LV3 variant selection
                                                    const variantA = player.evolutionLevels[unit.type].aVariant;
                                                    const variantB = player.evolutionLevels[unit.type].bVariant;
                                                    const needsVariantA = levelA === 2 && canEvolveA && !variantA;
                                                    const needsVariantB = levelB === 2 && canEvolveB && !variantB;

                                                    if (needsVariantA) {
                                                        const startIndex = getEvolutionButtonStartIndex(unit);
                                                        let buttonIndex = startIndex;

                                                        evolveButtons.push(
                                                            <div key="evolve_a_lv3_1" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setGameState(prev => {
                                                                            const p = prev.players[prev.currentPlayer];
                                                                            const newLevels = { ...p.evolutionLevels };
                                                                            newLevels[unit.type] = { ...newLevels[unit.type], a: 3, aVariant: 1 };
                                                                            return {
                                                                                ...prev,
                                                                                activeUnitId: prev.selectedUnitId,
                                                                                players: {
                                                                                    ...prev.players,
                                                                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                                                                },
                                                                                logs: [
                                                                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                                                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'A', level: 3 }, type: 'evolution' as const },
                                                                                    ...prev.logs
                                                                                ]
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-cyan-600 hover:bg-cyan-500 font-bold border-2 border-cyan-400 shadow-lg shadow-cyan-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{buttonIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 A' : 'Evolve A'}</span>
                                                                    <span className="text-[8px] leading-none text-cyan-200">LV2 → 3-1</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{EVOLUTION_COSTS[2]}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                        buttonIndex++;

                                                        evolveButtons.push(
                                                            <div key="evolve_a_lv3_2" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setGameState(prev => {
                                                                            const p = prev.players[prev.currentPlayer];
                                                                            const newLevels = { ...p.evolutionLevels };
                                                                            newLevels[unit.type] = { ...newLevels[unit.type], a: 3, aVariant: 2 };
                                                                            return {
                                                                                ...prev,
                                                                                activeUnitId: prev.selectedUnitId,
                                                                                players: {
                                                                                    ...prev.players,
                                                                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                                                                },
                                                                                logs: [
                                                                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                                                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'A', level: 3 }, type: 'evolution' as const },
                                                                                    ...prev.logs
                                                                                ]
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-purple-600 hover:bg-purple-500 font-bold border-2 border-purple-400 shadow-lg shadow-purple-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{buttonIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 A' : 'Evolve A'}</span>
                                                                    <span className="text-[8px] leading-none text-purple-200">LV2 → 3-2</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{EVOLUTION_COSTS[2]}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (canEvolveA && !needsVariantA) {
                                                        const costA = EVOLUTION_COSTS[levelA as keyof typeof EVOLUTION_COSTS];
                                                        const startIndex = getEvolutionButtonStartIndex(unit);

                                                        evolveButtons.push(
                                                            <div key="evolve_a" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => handleEvolve(unit.type, 'a')}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-blue-600 hover:bg-blue-500 font-bold border-2 border-blue-400 shadow-lg shadow-blue-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{startIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 A' : 'Evolve A'}</span>
                                                                    <span className="text-[8px] leading-none text-blue-200">LV{levelA} → {levelA + 1}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{costA}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    if (needsVariantB) {
                                                        const startIndex = getEvolutionButtonStartIndex(unit);
                                                        let buttonIndex = startIndex + (needsVariantA ? 2 : canEvolveA ? 1 : 0);

                                                        evolveButtons.push(
                                                            <div key="evolve_b_lv3_1" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setGameState(prev => {
                                                                            const p = prev.players[prev.currentPlayer];
                                                                            const newLevels = { ...p.evolutionLevels };
                                                                            newLevels[unit.type] = { ...newLevels[unit.type], b: 3, bVariant: 1 };
                                                                            return {
                                                                                ...prev,
                                                                                activeUnitId: prev.selectedUnitId,
                                                                                players: {
                                                                                    ...prev.players,
                                                                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                                                                },
                                                                                logs: [
                                                                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                                                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'B', level: 3 }, type: 'evolution' as const },
                                                                                    ...prev.logs
                                                                                ]
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-yellow-600 hover:bg-yellow-500 font-bold border-2 border-yellow-400 shadow-lg shadow-yellow-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{buttonIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 B' : 'Evolve B'}</span>
                                                                    <span className="text-[8px] leading-none text-yellow-200">LV2 → 3-1</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{EVOLUTION_COSTS[2]}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                        buttonIndex++;

                                                        evolveButtons.push(
                                                            <div key="evolve_b_lv3_2" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setGameState(prev => {
                                                                            const p = prev.players[prev.currentPlayer];
                                                                            const newLevels = { ...p.evolutionLevels };
                                                                            newLevels[unit.type] = { ...newLevels[unit.type], b: 3, bVariant: 2 };
                                                                            return {
                                                                                ...prev,
                                                                                activeUnitId: prev.selectedUnitId,
                                                                                players: {
                                                                                    ...prev.players,
                                                                                    [prev.currentPlayer]: { ...p, evolutionLevels: newLevels, energy: p.energy - EVOLUTION_COSTS[2] }
                                                                                },
                                                                                logs: [
                                                                                    { turn: prev.turnCount, messageKey: 'log_committed', type: 'info' as const },
                                                                                    { turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: 'B', level: 3 }, type: 'evolution' as const },
                                                                                    ...prev.logs
                                                                                ]
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-rose-600 hover:bg-rose-500 font-bold border-2 border-rose-400 shadow-lg shadow-rose-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{buttonIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 B' : 'Evolve B'}</span>
                                                                    <span className="text-[8px] leading-none text-rose-200">LV2 → 3-2</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{EVOLUTION_COSTS[2]}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (canEvolveB && !needsVariantB) {
                                                        const costB = EVOLUTION_COSTS[levelB as keyof typeof EVOLUTION_COSTS];
                                                        const startIndex = getEvolutionButtonStartIndex(unit);
                                                        const buttonIndex = startIndex + (needsVariantA ? 2 : canEvolveA ? 1 : 0);

                                                        evolveButtons.push(
                                                            <div key="evolve_b" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => handleEvolve(unit.type, 'b')}
                                                                    className="px-3 py-2 rounded flex flex-col items-center gap-0.5 min-w-[60px] transition-all relative bg-orange-600 hover:bg-orange-500 font-bold border-2 border-orange-400 shadow-lg shadow-orange-500/50 text-white animate-pulse"
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{buttonIndex}</div>
                                                                    <Dna size={20} />
                                                                    <span className="text-[9px] leading-none">{language === 'zh_tw' ? '進化 B' : 'Evolve B'}</span>
                                                                    <span className="text-[8px] leading-none text-orange-200">LV{levelB} → {levelB + 1}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-start gap-0.5 text-[10px] font-bold text-white -mt-0.5">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>                                <span>{costB}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return evolveButtons;
                                                })()}

                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => handleActionComplete(gameState.selectedUnitId)}
                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-slate-600 hover:bg-slate-500 font-bold border-2 border-slate-500 text-slate-200"
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('end_turn', getUnit(gameState.selectedUnitId))}</div>
                                                        <CheckCircle size={20} />
                                                        <span className="text-[10px]">{t('end_turn')}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full flex flex-col items-center justify-center gap-2">
                                                {(() => {
                                                    const nextUnit = getNextUnitToAct();
                                                    if (!nextUnit) return <span className="text-white font-semibold">{t('select_unit')}</span>;

                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                setGameState(prev => {
                                                                    const nextPlayer = prev.currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                                                                    const p1 = prev.players[PlayerID.P1];
                                                                    const p2 = prev.players[PlayerID.P2];

                                                                    // Reset units' hasActedThisRound for the next player's turn
                                                                    const p1Units = p1.units.map(u => ({ ...u, hasActedThisRound: false }));
                                                                    const p2Units = p2.units.map(u => ({ ...u, hasActedThisRound: false }));

                                                                    // Calculate energy for next turn
                                                                    const p1Energy = p1.energy + (ENERGY_REGEN + p1.energyFromKills);
                                                                    const p2Energy = p2.energy + (ENERGY_REGEN + p2.energyFromKills);

                                                                    // Update buildings: decrease duration and remove expired
                                                                    const filteredBuildings = prev.buildings
                                                                        .map(b => {
                                                                            if (b.owner === prev.currentPlayer && b.duration !== undefined && b.duration > 0) {
                                                                                return { ...b, duration: b.duration - 1 };
                                                                            }
                                                                            return b;
                                                                        })
                                                                        .filter(b => b.duration === undefined || b.duration > 0); // duration 0 means it just expired

                                                                    return {
                                                                        ...prev,
                                                                        turnCount: prev.turnCount + 1,
                                                                        currentPlayer: nextPlayer,
                                                                        activeUnitId: null,
                                                                        selectedUnitId: null,
                                                                        buildings: filteredBuildings,
                                                                        players: {
                                                                            ...prev.players,
                                                                            [PlayerID.P1]: {
                                                                                ...prev.players[PlayerID.P1],
                                                                                energy: p1Energy,
                                                                                startOfRoundEnergy: p1Energy,
                                                                                startOfActionEnergy: p1Energy,
                                                                                energyFromKills: 0,
                                                                                movesMadeThisTurn: 0,
                                                                                flagMovesMadeThisTurn: 0,
                                                                                nonGeneralFlagMovesMadeThisTurn: 0,
                                                                                units: p1Units,
                                                                                questStats: {
                                                                                    ...prev.players[PlayerID.P1].questStats,
                                                                                    triggeredMineThisRound: false,
                                                                                    rangerMinesMovedThisRound: new Set<string>()
                                                                                }
                                                                            },
                                                                            [PlayerID.P2]: {
                                                                                ...prev.players[PlayerID.P2],
                                                                                energy: p2Energy,
                                                                                startOfRoundEnergy: p2Energy,
                                                                                startOfActionEnergy: p2Energy,
                                                                                energyFromKills: 0,
                                                                                movesMadeThisTurn: 0,
                                                                                flagMovesMadeThisTurn: 0,
                                                                                nonGeneralFlagMovesMadeThisTurn: 0,
                                                                                units: p2Units,
                                                                                questStats: {
                                                                                    ...prev.players[PlayerID.P2].questStats,
                                                                                    triggeredMineThisRound: false,
                                                                                    rangerMinesMovedThisRound: new Set<string>()
                                                                                }
                                                                            }
                                                                        },
                                                                    };
                                                                });
                                                                addLog('log_skip', 'move', { unit: getUnitName(nextUnit.type) }, nextUnit.owner);
                                                                handleActionComplete(nextUnit.id);
                                                            }}
                                                            className="w-full px-6 py-3 rounded flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-500 font-bold border-2 border-indigo-500 text-indigo-200 shadow-lg shadow-indigo-500/50"
                                                        >
                                                            <ArrowRight size={20} />
                                                            <span className="text-sm">{t('skip_turn')}</span>
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSandboxPanel = () => {
        if (gameState.gameMode !== 'sandbox') return null;

        const addEnergy = () => {
            setGameState(prev => ({
                ...prev,
                players: {
                    ...prev.players,
                    [prev.currentPlayer]: {
                        ...prev.players[prev.currentPlayer],
                        energy: prev.players[prev.currentPlayer].energy + 100
                    }
                }
            }));
        };

        const evolveCurrentUnit = (branch: 'a' | 'b', variant?: 1 | 2) => {
            if (!gameState.selectedUnitId) return;
            setGameState(prev => {
                const currentPlayer = prev.players[prev.currentPlayer];
                const unit = currentPlayer.units.find(u => u.id === prev.selectedUnitId);
                if (!unit) return prev;

                const p = prev.players[unit.owner];
                const newLevels = JSON.parse(JSON.stringify(p.evolutionLevels));
                const curLevel = newLevels[unit.type][branch];

                if (curLevel < 3) {
                    newLevels[unit.type][branch] = curLevel + 1;
                    if (curLevel + 1 === 3 && variant) {
                        if (branch === 'a') newLevels[unit.type].aVariant = variant;
                        else newLevels[unit.type].bVariant = variant;
                    }
                }

                return {
                    ...prev,
                    players: {
                        ...prev.players,
                        [unit.owner]: { ...p, evolutionLevels: newLevels }
                    },
                    logs: [{ turn: prev.turnCount, messageKey: 'log_evolved', params: { unit: getUnitName(unit.type), branch: branch.toUpperCase() + (variant ? `-${variant}` : ''), level: newLevels[unit.type][branch] }, type: 'evolution' as const }, ...prev.logs]
                };
            });
        };

        const toggleGodMode = () => {
            setGameState(prev => ({
                ...prev,
                isGodMode: !prev.isGodMode,
                logs: [{ turn: prev.turnCount, messageKey: !prev.isGodMode ? 'God Mode Enabled' : 'God Mode Disabled', params: {}, type: 'info' as const }, ...prev.logs]
            }));
        };

        const skipToNextRound = () => {
            startNewRound(gameState);
        };

        const healAll = () => {
            setGameState(prev => ({
                ...prev,
                players: {
                    ...prev.players,
                    [PlayerID.P1]: {
                        ...prev.players[PlayerID.P1],
                        units: prev.players[PlayerID.P1].units.map(u => ({ ...u, hp: u.maxHp, isDead: false, respawnTimer: 0 }))
                    }
                }
            }));
        };

        const updateUnitStat = (stat: 'hp' | 'maxHp', change: number) => {
            if (!gameState.selectedUnitId) return;
            setGameState(prev => {
                const currentPlayer = prev.players[prev.currentPlayer];
                const unit = currentPlayer.units.find(u => u.id === prev.selectedUnitId);
                if (!unit) return prev;

                const p = prev.players[unit.owner];
                const newUnits = p.units.map(u => {
                    if (u.id === unit.id) {
                        const newVal = Math.max(1, (u[stat] as number) + change);
                        const updatedUnit = { ...u, [stat]: newVal };
                        if (stat === 'maxHp' && updatedUnit.hp > newVal) {
                            updatedUnit.hp = newVal;
                        }
                        if (stat === 'hp' && updatedUnit.hp > updatedUnit.maxHp) {
                            updatedUnit.hp = updatedUnit.maxHp;
                        }
                        return updatedUnit;
                    }
                    return u;
                });

                return {
                    ...prev,
                    players: {
                        ...prev.players,
                        [unit.owner]: { ...p, units: newUnits }
                    }
                };
            });
        };

        return (
            <div
                className={`fixed top-20 left-4 z-[60] bg-slate-900/95 border-2 border-yellow-500 rounded-xl shadow-2xl flex flex-col backdrop-blur-md animate-fade-in ${isSandboxCollapsed ? 'w-12 h-12 p-0 cursor-pointer hover:bg-slate-800' : 'p-4 min-w-[200px]'} transition-[width,height,padding,background-color] duration-300`}
                style={{
                    transform: `translate3d(${sandboxPos.x}px, ${sandboxPos.y}px, 0)`,
                    willChange: 'transform'
                }}
                onClick={(e) => {
                    if (isSandboxCollapsed) {
                        setIsSandboxCollapsed(false);
                        e.stopPropagation();
                    }
                }}
            >
                {/* Drag Handle & Header */}
                <div
                    onMouseDown={(e) => {
                        onSandboxDragStart(e);
                        // Stop propagation to prevent clicking through when dragging
                        if (isSandboxCollapsed) e.stopPropagation();
                    }}
                    className={`flex items-center select-none ${isSandboxCollapsed ? 'w-full h-full justify-center cursor-move' : 'justify-between gap-3 cursor-move border-b border-yellow-500/30 pb-2 mb-3'}`}
                >
                    <div className="flex items-center gap-2">
                        <FlaskConical size={isSandboxCollapsed ? 24 : 18} className="text-yellow-400" />
                        {!isSandboxCollapsed && (
                            <span className="text-yellow-400 font-black text-sm tracking-wider">
                                {language === 'zh_tw' ? '沙盒模式' : 'SANDBOX TOOLS'}
                            </span>
                        )}
                    </div>
                    {!isSandboxCollapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSandboxCollapsed(true);
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors text-yellow-400"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {!isSandboxCollapsed && (
                    <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <button onClick={addEnergy} className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg shadow-yellow-500/20">
                            <Zap size={14} />
                            {language === 'zh_tw' ? '增加 100 能量' : '+100 Energy'}
                        </button>

                        <button onClick={healAll} className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20">
                            <Shield size={14} />
                            {language === 'zh_tw' ? '治療全員' : 'Heal All'}
                        </button>
                        <button
                            onClick={toggleGodMode}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg ${gameState.isGodMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 shadow-slate-900/20'}`}
                        >
                            <ShieldAlert size={14} />
                            {language === 'zh_tw' ? (gameState.isGodMode ? '關閉無敵模式' : '開啟無敵模式') : 'God Mode'}
                        </button>
                        <button
                            onClick={skipToNextRound}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg shadow-rose-500/20"
                        >
                            <RefreshCw size={14} />
                            {language === 'zh_tw' ? '跳過回合' : 'New Round'}
                        </button>
                        <button
                            onClick={() => setGameState(prev => ({ ...prev, isSandboxTimerPaused: !prev.isSandboxTimerPaused }))}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg ${gameState.isSandboxTimerPaused ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20'}`}
                        >
                            {gameState.isSandboxTimerPaused ? <Play size={14} /> : <Pause size={14} />}
                            {gameState.isSandboxTimerPaused ? (language === 'zh_tw' ? '恢復計時' : 'Resume Timer') : (language === 'zh_tw' ? '暫停計時' : 'Pause Timer')}
                        </button>
                        <button
                            onClick={() => setTargetMode(targetMode === 'teleport' ? null : 'teleport')}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 shadow-lg ${targetMode === 'teleport' ? 'bg-purple-500 text-white ring-2 ring-purple-300 shadow-purple-500/40' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 shadow-slate-900/20'}`}
                        >
                            <Hand size={14} />
                            {language === 'zh_tw' ? '拖曳單位' : 'Drag Unit'}
                        </button>
                        <div className="border-t border-slate-700 my-1 opacity-50"></div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{language === 'zh_tw' ? '進化單位 (選中單位)' : 'Evolve Selected'}</div>
                        <div className="flex flex-col gap-1.5">
                            {(() => {
                                const unit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : null;
                                if (!unit) return <div className="text-[10px] text-slate-500 italic text-center py-1 bg-slate-800/30 rounded">{language === 'zh_tw' ? '未選擇單位' : 'No unit selected'}</div>;

                                const levels = gameState.players[unit.owner].evolutionLevels[unit.type];

                                return (
                                    <>
                                        <div className="flex gap-1 items-center">
                                            <span className="text-[9px] font-black w-4 text-blue-400">A</span>
                                            {levels.a < 2 ? (
                                                <button onClick={() => evolveCurrentUnit('a')} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 shadow-lg shadow-blue-500/10">
                                                    {language === 'zh_tw' ? `進化 A (LV${levels.a} → ${levels.a + 1})` : `LV${levels.a} → ${levels.a + 1}`}
                                                </button>
                                            ) : levels.a === 2 ? (
                                                <div className="flex-1 flex gap-1">
                                                    <button onClick={() => evolveCurrentUnit('a', 1)} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-blue-400/50">
                                                        3-1
                                                    </button>
                                                    <button onClick={() => evolveCurrentUnit('a', 2)} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-blue-400/50">
                                                        3-2
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 py-1 bg-blue-900/30 text-blue-400/50 rounded-lg font-black text-[10px] text-center border border-blue-500/20">{language === 'zh_tw' ? 'A 已滿級' : 'A MAX'}</div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 items-center">
                                            <span className="text-[9px] font-black w-4 text-orange-400">B</span>
                                            {levels.b < 2 ? (
                                                <button onClick={() => evolveCurrentUnit('b')} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 shadow-lg shadow-orange-500/10">
                                                    {language === 'zh_tw' ? `進化 B (LV${levels.b} → ${levels.b + 1})` : `LV${levels.b} → ${levels.b + 1}`}
                                                </button>
                                            ) : levels.b === 2 ? (
                                                <div className="flex-1 flex gap-1">
                                                    <button onClick={() => evolveCurrentUnit('b', 1)} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-orange-400/50">
                                                        3-1
                                                    </button>
                                                    <button onClick={() => evolveCurrentUnit('b', 2)} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-orange-400/50">
                                                        3-2
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 py-1 bg-orange-900/30 text-orange-400/50 rounded-lg font-black text-[10px] text-center border border-orange-500/20">{language === 'zh_tw' ? 'B 已滿級' : 'B MAX'}</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 border-t border-slate-700/50 pt-1.5 mt-0.5">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">{language === 'zh_tw' ? '數值調整' : 'STATS ADJUST'}</div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-black text-emerald-400">HP</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => updateUnitStat('hp', -1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">-</button>
                                                    <div className="min-w-[30px] text-center font-mono text-xs text-emerald-300 bg-emerald-950/30 rounded px-1 flex items-center justify-center">{unit.hp}</div>
                                                    <button onClick={() => updateUnitStat('hp', 1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">+</button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-black text-rose-400">MAX</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => updateUnitStat('maxHp', -1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">-</button>
                                                    <div className="min-w-[30px] text-center font-mono text-xs text-rose-300 bg-rose-950/30 rounded px-1 flex items-center justify-center">{unit.maxHp}</div>
                                                    <button onClick={() => updateUnitStat('maxHp', 1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none">
            {/* Background Music */}
            <audio
                ref={audioRef}
                src={view === 'lobby' ? '/純音樂 - bgmdaily - 聽.mp3' : '/the-final-boss-battle-158700.mp3'}
                loop
            />

            {view === 'lobby' ? (
                <div className="flex flex-col items-center justify-center h-full gap-8 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 relative">
                    <div className="text-center space-y-2 z-10">
                        <h1 className="text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-2xl animate-pulse">
                            {t('app_title')}
                        </h1>
                        <p className="text-cyan-300 max-w-md mx-auto font-semibold">{t('lobby_desc')}</p>
                    </div>

                    <div className="flex gap-6 z-10">
                        {!roomId ? (
                            <>
                                <button
                                    onClick={() => handleStartGame('sandbox')}
                                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 rounded-xl font-black text-lg shadow-2xl shadow-yellow-500/50 transform hover:scale-110 transition-all duration-200 flex items-center gap-3 border-2 border-amber-300"
                                >
                                    <FlaskConical size={24} />
                                    {t('sandbox_mode')}
                                </button>
                                <button
                                    onClick={() => handleStartGame('pve')}
                                    className="px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl font-black text-lg shadow-2xl shadow-violet-500/50 transform hover:scale-110 transition-all duration-200 flex items-center gap-3 border-2 border-violet-300"
                                >
                                    <Cpu size={24} />
                                    {t('pve_mode')}
                                </button>
                                <button
                                    onClick={() => setShowJoinModal(true)}
                                    className="px-8 py-4 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 rounded-xl font-black text-lg shadow-2xl shadow-slate-500/50 transform hover:scale-110 transition-all duration-200 flex items-center gap-3 border-2 border-slate-400 text-white"
                                >
                                    <DoorOpen size={24} />
                                    {language === 'zh_tw' ? '加入大廳' : 'Join Lobby'}
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4 animate-fade-in">
                                {isHost ? (
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => {
                                                setRoomId(null);
                                                setIsHost(false);
                                            }}
                                            className="px-8 py-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white text-xl transition-all border-2 border-slate-500"
                                        >
                                            {language === 'zh_tw' ? '離開大廳' : 'LEAVE'}
                                        </button>
                                        <button
                                            onClick={() => handleStartGame('pvp')}
                                            className="px-12 py-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl font-black text-2xl shadow-2xl shadow-orange-500/50 transform hover:scale-105 transition-all duration-200 flex items-center gap-4 border-2 border-orange-400 animate-pulse"
                                        >
                                            <Swords size={32} />
                                            {language === 'zh_tw' ? '開始對戰' : 'START GAME'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="text-2xl font-bold text-cyan-300 animate-pulse">
                                            {language === 'zh_tw' ? '等待房主開始對戰' : 'Waiting for host to start game'}
                                            <span className="dot-loading"></span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setRoomId(null);
                                                setIsHost(false);
                                            }}
                                            className="px-6 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 text-sm border border-slate-600 transition-all hover:text-white"
                                        >
                                            {language === 'zh_tw' ? '離開大廳' : 'Leave Lobby'}
                                        </button>
                                        <style>{`
                                            .dot-loading::after {
                                                content: ' .';
                                                animation: dots 1.5s steps(5, end) infinite;
                                            }
                                            @keyframes dots {
                                                0%, 20% { content: ''; }
                                                40% { content: '.'; }
                                                60% { content: '..'; }
                                                80%, 100% { content: '...'; }
                                            }
                                        `}</style>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {roomId && (
                        <div className="absolute top-4 left-4 z-20 bg-cyan-900/80 border border-cyan-500 px-4 py-2 rounded-full text-cyan-200 font-bold backdrop-blur-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {language === 'zh_tw' ? '已加入房間: ' : 'Joined Room: '} {roomId}
                        </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button
                            onClick={() => setLanguage(language === 'zh_tw' ? 'en' : 'zh_tw')}
                            className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-600 transition-colors flex items-center gap-2"
                        >
                            <Globe size={16} />
                            {language === 'zh_tw' ? 'EN' : '中文'}
                        </button>
                    </div>

                    {/* Join Modal - Enhanced with Room List */}
                    {showJoinModal && (
                        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-md p-4">
                            <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl shadow-2xl shadow-cyan-500/20 max-w-5xl w-full h-[600px] flex overflow-hidden relative">
                                <button
                                    onClick={() => setShowJoinModal(false)}
                                    className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full hover:bg-slate-700 transition-colors"
                                >
                                    <X size={24} />
                                </button>

                                {/* Left Panel: Room List */}
                                <div className="w-2/3 border-r border-slate-700 bg-slate-900/50 flex flex-col">
                                    <div className="p-6 border-b border-slate-700 bg-slate-800/30">
                                        <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                            <Users size={24} className="text-cyan-400" />
                                            {language === 'zh_tw' ? '大廳列表' : 'Lobby List'}
                                        </h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {MOCK_ROOMS.map(room => (
                                            <div
                                                key={room.id}
                                                onClick={() => room.status === 'waiting' ? setRoomCode(room.id) : null}
                                                className={`p-4 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-between group
                                                    ${room.status === 'waiting'
                                                        ? 'border-slate-700 hover:border-cyan-500 bg-slate-800/50 hover:bg-slate-800'
                                                        : 'border-slate-800 bg-slate-900/50 opacity-60 cursor-not-allowed'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-bold text-lg ${room.status === 'waiting' ? 'text-white group-hover:text-cyan-300' : 'text-slate-500'}`}>
                                                        {room.name}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">ID: {room.id}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                                                        ${room.status === 'waiting' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {room.status === 'waiting'
                                                            ? (language === 'zh_tw' ? '等待中' : 'WAITING')
                                                            : (language === 'zh_tw' ? '遊戲中' : 'PLAYING')}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-slate-400">
                                                        <Users size={14} />
                                                        <span className="text-sm font-mono">{room.players}/{room.maxPlayers}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Panel: Input Code */}
                                <div className="w-1/3 bg-slate-950/80 flex flex-col items-center justify-center p-8 border-l-2 border-cyan-500/10 shadow-xl relative overflow-hidden">
                                    {/* Background Decor */}
                                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, cyan 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                    {joinMode === 'join' ? (
                                        <div className="w-full max-w-xs space-y-6 relative z-10 animate-fade-in">
                                            <div className="text-center">
                                                <h3 className="text-xl font-bold text-white mb-2">{language === 'zh_tw' ? '輸入房間代碼' : 'Enter Room Code'}</h3>
                                                <p className="text-xs text-slate-400">{language === 'zh_tw' ? '輸入私人房間ID加入' : 'Input private room ID to join'}</p>
                                            </div>

                                            <input
                                                type="text"
                                                value={roomCode}
                                                onChange={(e) => setRoomCode(e.target.value)}
                                                className="w-full bg-slate-900 border-2 border-slate-700 rounded-lg p-4 text-white font-black text-center focus:border-cyan-500 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] outline-none text-3xl tracking-[0.2em] transition-all uppercase placeholder:opacity-20"
                                                placeholder="____"
                                                maxLength={6}
                                            />

                                            <button
                                                onClick={() => {
                                                    if (roomCode.trim()) {
                                                        setRoomId(roomCode);
                                                        setShowJoinModal(false);
                                                    }
                                                }}
                                                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-white text-lg shadow-lg shadow-cyan-500/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                disabled={!roomCode.trim()}
                                            >
                                                {language === 'zh_tw' ? '加入房間' : 'JOIN ROOM'}
                                                <ArrowRight size={20} />
                                            </button>

                                            <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800/50">
                                                <span className="text-xs text-slate-500">{language === 'zh_tw' ? '沒有房間？' : 'No room?'}</span>
                                                <button
                                                    onClick={() => setJoinMode('create')}
                                                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline"
                                                >
                                                    {language === 'zh_tw' ? '創建大廳' : 'Create Room'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-xs space-y-4 relative z-10 animate-fade-in">
                                            <div className="text-center mb-2">
                                                <h3 className="text-xl font-bold text-white mb-1">{language === 'zh_tw' ? '創建大廳' : 'Create Room'}</h3>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 mb-1 block">{language === 'zh_tw' ? '房間ID' : 'Room ID'}</label>
                                                    <input
                                                        type="text"
                                                        value={createRoomId}
                                                        onChange={(e) => setCreateRoomId(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-center focus:border-cyan-500 outline-none uppercase"
                                                        placeholder="ID"
                                                        maxLength={6}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 mb-1 block">{language === 'zh_tw' ? '房間名稱' : 'Room Name'}</label>
                                                    <input
                                                        type="text"
                                                        value={createRoomName}
                                                        onChange={(e) => setCreateRoomName(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                                        placeholder={language === 'zh_tw' ? '輸入名稱...' : 'Enter name...'}
                                                        maxLength={12}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-400">{language === 'zh_tw' ? '私人房間？' : 'Private?'}</label>
                                                    <input
                                                        type="checkbox"
                                                        checked={isPrivate}
                                                        onChange={(e) => setIsPrivate(e.target.checked)}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-slate-900"
                                                    />
                                                </div>
                                                {isPrivate && (
                                                    <input
                                                        type="password"
                                                        value={createRoomPassword}
                                                        onChange={(e) => setCreateRoomPassword(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                                        placeholder={language === 'zh_tw' ? '密碼...' : 'Password...'}
                                                    />
                                                )}
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setJoinMode('join')}
                                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded font-bold text-slate-400 text-sm transition-colors"
                                                >
                                                    {language === 'zh_tw' ? '返回' : 'Back'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (createRoomId.trim() && createRoomName.trim()) {
                                                            setRoomId(createRoomId);
                                                            setIsHost(true); // Host
                                                            setShowJoinModal(false);
                                                        }
                                                    }}
                                                    className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded font-black text-white text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!createRoomId.trim() || !createRoomName.trim()}
                                                >
                                                    {language === 'zh_tw' ? '創建' : 'Create'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {/* Top-left Crown with Cloud */}
                        <div className="absolute top-20 left-20">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-[50px] rounded-full scale-150 animate-pulse" style={{ animation: 'cloud-flow 6s ease-in-out infinite' }}></div>
                            <div style={{ animation: 'fadeInOut 4s ease-in-out infinite' }}>
                                <Crown size={200} className="text-cyan-400 drop-shadow-2xl relative z-10" />
                            </div>
                        </div>

                        {/* Bottom-right Bomb with Cloud */}
                        <div className="absolute bottom-20 right-20">
                            <div className="absolute inset-0 bg-red-500/20 blur-[50px] rounded-full scale-150 animate-pulse" style={{ animation: 'cloud-flow 6s ease-in-out infinite reverse' }}></div>
                            <div style={{ animation: 'fadeInOut 4s ease-in-out infinite' }}>
                                <Bomb size={200} className="text-red-400 drop-shadow-2xl relative z-10" />
                            </div>
                        </div>
                        {/* Mist effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-red-500/5"></div>
                    </div>
                </div>
            ) : (
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
                    <div className="h-12 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b-2 border-cyan-500 flex items-center justify-between px-4 shrink-0 z-30 shadow-2xl shadow-cyan-500/20">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExitGame}
                                className="p-2 hover:bg-cyan-500/20 rounded text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-500/50"
                            >
                                <LogOut size={20} />
                            </button>
                            <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                                {t('app_title')}
                            </span>

                            <span className="text-xs font-bold text-white bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/50 ml-2">
                                {gameState.gameMode === 'pvp' ? t('pvp_mode') : t('pve_mode')}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-sm text-white font-semibold">
                                {t('current')}: <span className={`font-black ${gameState.currentPlayer === PlayerID.P1 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {gameState.currentPlayer === PlayerID.P1 ? 'P1' : 'P2'}
                                </span>
                            </div>

                            <button
                                onClick={handlePause}
                                className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/50 transition-colors text-xs font-bold flex items-center gap-1 text-white hover:text-white"
                            >
                                {gameState.isPaused ? t('resume') : t('pause')}
                            </button>

                            <div className="flex items-center gap-2">
                                <div className="relative w-5 h-5 flex items-center justify-center text-white">
                                    {musicVolume === 0 ? (
                                        <>
                                            <VolumeX size={20} />
                                            <div className="absolute w-6 h-1 bg-red-500 transform -rotate-45"></div>
                                        </>
                                    ) : (
                                        <Volume2 size={20} />
                                    )}
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={musicVolume * 100}
                                    onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                                    className="w-24 h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                                    style={{
                                        background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) 100%)`
                                    }}
                                />
                                <span className="text-xs text-cyan-300 font-bold w-8">{Math.round(musicVolume * 100)}%</span>
                            </div>

                            <button
                                onClick={() => setLanguage(language === 'zh_tw' ? 'en' : 'zh_tw')}
                                className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/50 transition-colors text-xs font-bold flex items-center gap-1 text-white hover:text-white"
                            >
                                <Globe size={12} />
                                {language === 'zh_tw' ? 'EN' : '中文'}
                            </button>
                        </div>
                    </div>

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
                                <div className="flex-1 flex items-center justify-center p-4 relative overflow-visible"
                                    style={{ zIndex: 10 }}
                                    onMouseMove={handleBoardMouseMove}
                                    onMouseLeave={handleBoardMouseLeave}
                                >
                                    <div ref={boardRef} className="grid gap-0 border-4 border-white bg-slate-900 rounded-lg overflow-visible relative z-10 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                        style={{
                                            gridTemplateColumns: 'repeat(24, 48px)',
                                            gridTemplateRows: 'repeat(7, 48px)',
                                            animation: 'gentleBreathe 4s ease-in-out infinite',
                                            transformStyle: 'preserve-3d'
                                        }}>

                                        {/* Center Divider Line */}
                                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(255,255,255,0.4)] z-20 transform -translate-x-1/2"
                                            style={{ animation: 'gentleBreathe 4s ease-in-out infinite' }}></div>
                                        {gameState.cells.map((row, r) => row.map((cell, c) => {
                                            const smokesAtCell = gameState.smokes.filter(s => s.r === r && s.c === c);
                                            const isSmoked = smokesAtCell.length > 0;
                                            const isSmokedByEnemy = smokesAtCell.some(s => s.owner !== gameState.currentPlayer);

                                            const realUnit = [...gameState.players[PlayerID.P1].units, ...gameState.players[PlayerID.P2].units]
                                                .find(u => u.r === r && u.c === c && !u.isDead);
                                            const isUnitStealthed = realUnit?.status.isStealthed;
                                            const isVisible = realUnit && (
                                                realUnit.owner === gameState.currentPlayer ||
                                                (!isSmokedByEnemy && !isUnitStealthed)
                                            );
                                            const unit = isVisible ? realUnit : undefined;

                                            const realMine = gameState.mines.find(m => m.r === r && m.c === c);
                                            const mine = realMine;

                                            const building = gameState.buildings.find(b => b.r === r && b.c === c);

                                            const selectedUnit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : undefined;
                                            const selectedUnitOwner = selectedUnit ? gameState.players[selectedUnit.owner] : null;
                                            // For attack range: if selected unit is General, use its Path A level; otherwise use team's General Path A level
                                            const selectedGeneralLevelA = selectedUnitOwner ? selectedUnitOwner.evolutionLevels[UnitType.GENERAL].a : 0;

                                            // For unit display: use the unit at this cell's Path A level
                                            const cellUnitLevelA = unit ? gameState.players[unit.owner].evolutionLevels[unit.type].a : 0;

                                            return (
                                                <GridCell
                                                    key={`${r}-${c}`}
                                                    cell={cell}
                                                    unit={unit}
                                                    mine={mine}
                                                    building={building}
                                                    isSelected={gameState.selectedUnitId === unit?.id}
                                                    isValidMove={false}
                                                    isAttackTarget={false}
                                                    isSkillTarget={false}
                                                    currentPlayer={gameState.currentPlayer}
                                                    isUnitStealthed={isUnitStealthed && realUnit?.owner === gameState.currentPlayer}
                                                    onClick={() => {
                                                        // For skill targeting modes, handleCellClick should take priority
                                                        const isSkillTargeting = (targetMode as any) && (targetMode as any) !== 'move';
                                                        if (isSkillTargeting) {
                                                            handleCellClick(r, c);
                                                        } else if (unit) {
                                                            handleUnitClick(unit);
                                                        } else {
                                                            handleCellClick(r, c);
                                                        }
                                                    }}
                                                    p1FlagLoc={gameState.players[PlayerID.P1].flagPosition}
                                                    p2FlagLoc={gameState.players[PlayerID.P2].flagPosition}
                                                    targetMode={targetMode as any}
                                                    selectedUnit={selectedUnit}
                                                    selectedGeneralLevelA={selectedGeneralLevelA}
                                                    evolutionLevelA={cellUnitLevelA}
                                                    evolutionLevelB={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].b : 0}
                                                    evolutionVariantA={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].aVariant : undefined}
                                                    evolutionVariantB={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].bVariant : undefined}
                                                    p1GeneralLevelB={gameState.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].b}
                                                    p2GeneralLevelB={gameState.players[PlayerID.P2].evolutionLevels[UnitType.GENERAL].b}
                                                    p1GeneralVariantB={gameState.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].bVariant}
                                                    p2GeneralVariantB={gameState.players[PlayerID.P2].evolutionLevels[UnitType.GENERAL].bVariant}
                                                    buildings={gameState.buildings}
                                                    isSmoked={isSmoked}
                                                    smokeOwner={smokesAtCell[0]?.owner}
                                                    forceShowMines={gameState.sandboxShowAllMines}
                                                />
                                            );
                                        }))}
                                    </div>
                                </div>

                                {/* Timer Bar Below Board */}
                                <div className="w-full px-8 py-3 flex items-center justify-center gap-6 relative z-20">
                                    <span className="text-white font-bold text-lg min-w-[80px]">
                                        {gameState.phase === 'placement' ? (language === 'zh_tw' ? '佈陣階段' : 'PLACEMENT') : gameState.phase === 'thinking' ? (language === 'zh_tw' ? '思考階段' : 'THINKING') : (language === 'zh_tw' ? '行動階段' : 'ACTION')}
                                    </span>
                                    <div className="flex-1 max-w-2xl">
                                        <div className="w-full h-5 bg-slate-900 rounded-full overflow-hidden border-2 border-white/50 shadow-lg">
                                            {(() => {
                                                const maxTime = gameState.phase === 'placement' ? 45 : gameState.phase === 'thinking' ? 30 : 15;
                                                const percentage = (gameState.timeLeft / maxTime) * 100;
                                                // 顏色調整
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
                                    <span className="text-white font-bold text-lg min-w-[50px] text-right">
                                        {gameState.timeLeft}s
                                    </span>
                                </div>
                            </div>

                            {/* Log Panel Container */}
                            <div className={`shrink-0 z-20 relative transition-all duration-500 ease-in-out flex flex-row ${showLog ? 'w-80' : 'w-0'}`}>

                                {/* Toggle Button - Floating on the left edge of the panel */}
                                <button
                                    onClick={() => setShowLog(!showLog)}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-8 h-24 bg-slate-900 border-2 border-white border-r-0 rounded-l-2xl flex flex-col items-center justify-center text-white hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] z-30 group"
                                    title={showLog ? (language === 'zh_tw' ? "隱藏日誌" : "Hide Log") : (language === 'zh_tw' ? "顯示日誌" : "Show Log")}
                                >
                                    {showLog ? <ChevronRight size={20} className="group-hover:scale-125 transition-transform" /> : <ChevronLeft size={20} className="group-hover:scale-125 transition-transform" />}
                                    <div className="text-[10px] font-black uppercase vertical-text mt-1 opacity-50 group-hover:opacity-100 transition-opacity">LOG</div>
                                </button>

                                {/* Log Panel Content */}
                                <div className={`w-80 h-full bg-slate-900 border-l-4 border-white flex flex-col text-sm transition-all duration-500 ${!showLog ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="shrink-0 p-3 font-black border-b-2 border-white bg-slate-800 flex items-center gap-2 text-white">
                                        <Info size={18} />
                                        <span className="text-lg whitespace-nowrap overflow-hidden">{language === 'zh_tw' ? '遊戲日誌' : 'GAME LOG'}</span>
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
                    {renderControlPanel()}

                    {/* Sandbox Panel */}
                    {renderSandboxPanel()}

                    {/* Evolution Tree */}
                    {showEvolutionTree && renderEvolutionTree()}

                    {/* Game Over Screen */}
                    {gameState.gameOver && (
                        <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                            <div className="text-center space-y-6">
                                <h1 className="text-7xl font-black text-yellow-400 drop-shadow-2xl animate-pulse">
                                    {t('game_over')}
                                </h1>
                                <div className="text-5xl font-black">
                                    {gameState.winner === PlayerID.P1 ? (
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Player 1 {t('wins')}</span>
                                    ) : (
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-500">Player 2 {t('wins')}</span>
                                    )}
                                </div>
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={() => {
                                            setGameState(createInitialState(gameState.gameMode));
                                            setTargetMode(null);
                                        }}
                                        className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-lg font-black text-lg shadow-2xl shadow-emerald-500/50 transform hover:scale-110 transition-all border-2 border-emerald-400"
                                    >
                                        {t('play_again')}
                                    </button>
                                    <button
                                        onClick={handleExitGame}
                                        className="px-8 py-4 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-lg font-black text-lg shadow-2xl transform hover:scale-110 transition-all border-2 border-slate-500"
                                    >
                                        {t('exit_lobby')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pause Screen */}
                    {gameState.isPaused && (
                        <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                            <div className="text-center space-y-6">
                                <h1 className="text-7xl font-black text-cyan-400 drop-shadow-2xl animate-pulse">
                                    {t('paused')}
                                </h1>
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={handlePause}
                                        className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-lg shadow-2xl shadow-cyan-500/50 transform hover:scale-110 transition-all border-2 border-cyan-400"
                                    >
                                        {t('resume')}
                                    </button>
                                    <button
                                        onClick={handleExitGame}
                                        className="px-8 py-4 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-lg font-black text-lg shadow-2xl transform hover:scale-110 transition-all border-2 border-slate-500"
                                    >
                                        {t('exit_lobby')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {renderSandboxPanel()}
        </div>
    );
}
