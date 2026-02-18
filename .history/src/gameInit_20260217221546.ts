import {
    GameState, PlayerID, Unit, Cell, Mine, UnitType,
    MineType, QuestStats, EvolutionLevels
} from './types';
import {
    GRID_ROWS, GRID_COLS, UNIT_STATS, INITIAL_ENERGY,
    P1_FLAG_POS, P2_FLAG_POS, PLACEMENT_TIMER
} from './constants';

// --- Helper: Get Starting Positions for Units ---
export const getStartingPositions = (pid: PlayerID) => {
    const positions: { r: number, c: number }[] = [];
    const isP1 = pid === PlayerID.P1;
    const cols = isP1 ? [0, 1, 2, 3] : [20, 21, 22, 23];
    const flagPos = isP1 ? P1_FLAG_POS : P2_FLAG_POS;

    const possibleRows = [0, 1, 2, 3, 4, 5, 6].filter(r => r !== flagPos.r);

    // 隨機選擇 5 個行（避開旗幟行）
    const shuffledRows = [...possibleRows].sort(() => Math.random() - 0.5).slice(0, 5);
    const shuffledCols = [...cols].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 5; i++) {
        const r = shuffledRows[i];
        const c = shuffledCols[i % shuffledCols.length];
        positions.push({ r, c });
    }
    return positions;
};

export const createInitialState = (mode: 'pvp' | 'pve' | 'sandbox'): GameState => {
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
        sweeperScansThisRound: 0,
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
                unitDisplayOrder: [`${PlayerID.P1}-${UnitType.GENERAL}`, `${PlayerID.P1}-${UnitType.MINESWEEPER}`, `${PlayerID.P1}-${UnitType.RANGER}`, `${PlayerID.P1}-${UnitType.MAKER}`, `${PlayerID.P1}-${UnitType.DEFUSER}`],
                movesMadeThisTurn: 0,
                flagMovesMadeThisTurn: 0,
                nonGeneralFlagMovesMadeThisTurn: 0,
                hasResurrectedGeneral: false,
                questStats: { ...initialQuestStats },
                evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
                evolutionPoints: 0,
                skipCountThisRound: 0,
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
                unitDisplayOrder: [`${PlayerID.P2}-${UnitType.GENERAL}`, `${PlayerID.P2}-${UnitType.MINESWEEPER}`, `${PlayerID.P2}-${UnitType.RANGER}`, `${PlayerID.P2}-${UnitType.MAKER}`, `${PlayerID.P2}-${UnitType.DEFUSER}`],
                movesMadeThisTurn: 0,
                flagMovesMadeThisTurn: 0,
                nonGeneralFlagMovesMadeThisTurn: 0,
                hasResurrectedGeneral: false,
                questStats: { ...initialQuestStats },
                evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
                evolutionPoints: 0,
                skipCountThisRound: 0,
            },
        },
        selectedUnitId: null,
        activeUnitId: null,
        logs: [{ turn: 1, messageKey: 'log_placement_phase', type: 'info' as const }],
        gameOver: false,
        winner: null,
        timeLeft: PLACEMENT_TIMER,
        movements: [],
        vfx: [],
        sensorResults: [],
        sandboxShowAllMines: false,
        pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
    };
};
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
            unitDisplayOrder: [`${PlayerID.P1}-${UnitType.GENERAL}`, `${PlayerID.P1}-${UnitType.MINESWEEPER}`, `${PlayerID.P1}-${UnitType.RANGER}`, `${PlayerID.P1}-${UnitType.MAKER}`, `${PlayerID.P1}-${UnitType.DEFUSER}`],
                movesMadeThisTurn: 0,
                    flagMovesMadeThisTurn: 0,
                        nonGeneralFlagMovesMadeThisTurn: 0,
                            hasResurrectedGeneral: false,
                                questStats: { ...initialQuestStats },
        evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
            evolutionPoints: 0,
                skipCountThisRound: 0,
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
            unitDisplayOrder: [`${PlayerID.P2}-${UnitType.GENERAL}`, `${PlayerID.P2}-${UnitType.MINESWEEPER}`, `${PlayerID.P2}-${UnitType.RANGER}`, `${PlayerID.P2}-${UnitType.MAKER}`, `${PlayerID.P2}-${UnitType.DEFUSER}`],
                movesMadeThisTurn: 0,
                    flagMovesMadeThisTurn: 0,
                        nonGeneralFlagMovesMadeThisTurn: 0,
                            hasResurrectedGeneral: false,
                                questStats: { ...initialQuestStats },
        evolutionLevels: JSON.parse(JSON.stringify(initialEvolutionLevels)),
            evolutionPoints: 0,
                skipCountThisRound: 0,
            },
},
selectedUnitId: null,
    activeUnitId: null,
        logs: [{ turn: 1, messageKey: 'log_placement_phase', type: 'info' as const }],
            gameOver: false,
                winner: null,
                    timeLeft: PLACEMENT_TIMER,
                        movements: [],
                            vfx: [],
                                sensorResults: [],
                                    sandboxShowAllMines: false,
                                        pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
    };
};
