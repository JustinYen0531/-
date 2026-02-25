import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, Building
} from '../../types';
import {
    UNIT_STATS, INITIAL_ENERGY
} from '../../constants';
import { createInitialState } from '../../gameInit';

/**
 * Creates a deterministic GameState for testing (no randomness).
 */
export const createTestState = (mode: 'pvp' | 'pve' | 'sandbox' = 'pvp'): GameState => {
    const state = createInitialState(mode);
    state.phase = 'action';
    state.currentPlayer = PlayerID.P1;
    state.turnCount = 1;
    state.gameOver = false;
    state.isPaused = false;
    state.mines = [];
    state.buildings = [];
    state.smokes = [];
    state.logs = [];
    state.movements = [];
    state.sensorResults = [];
    state.vfx = [];

    // Clear randomness from the grid
    state.cells.forEach(row => {
        row.forEach(cell => {
            cell.isObstacle = false;
            cell.hasEnergyOre = false;
            cell.oreSize = null;
        });
    });

    // Place units deterministically
    const p1Units = state.players[PlayerID.P1].units;
    const p2Units = state.players[PlayerID.P2].units;

    const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
    unitTypes.forEach((type, i) => {
        const p1u = p1Units.find(u => u.type === type)!;
        p1u.r = i;
        p1u.c = 1;
        p1u.hp = p1u.maxHp;
        p1u.isDead = false;
        p1u.hasActedThisRound = false;
        p1u.energyUsedThisTurn = 0;
        p1u.startOfActionEnergy = INITIAL_ENERGY;
        p1u.hasFlag = false;
        p1u.carriedMine = null;

        const p2u = p2Units.find(u => u.type === type)!;
        p2u.r = i;
        p2u.c = 22;
        p2u.hp = p2u.maxHp;
        p2u.isDead = false;
        p2u.hasActedThisRound = false;
        p2u.energyUsedThisTurn = 0;
        p2u.startOfActionEnergy = INITIAL_ENERGY;
        p2u.hasFlag = false;
        p2u.carriedMine = null;
    });

    // Reset player state
    for (const pid of [PlayerID.P1, PlayerID.P2]) {
        const player = state.players[pid];
        player.energy = INITIAL_ENERGY;
        player.startOfRoundEnergy = INITIAL_ENERGY;
        player.startOfActionEnergy = INITIAL_ENERGY;
        player.movesMadeThisTurn = 0;
        player.flagMovesMadeThisTurn = 0;
        player.nonGeneralFlagMovesMadeThisTurn = 0;
        player.placementMinesPlaced = 0;
        player.evolutionPoints = 0;
        player.skipCountThisRound = 0;
    }

    return state;
};

/**
 * Creates a test Unit with sensible defaults.
 */
export const createTestUnit = (
    owner: PlayerID,
    type: UnitType,
    r: number,
    c: number,
    overrides: Partial<Unit> = {}
): Unit => ({
    id: overrides.id ?? `${owner}-${type}`,
    type,
    owner,
    r,
    c,
    hp: UNIT_STATS[type].maxHp,
    maxHp: UNIT_STATS[type].maxHp,
    energyUsedThisTurn: 0,
    startOfActionEnergy: INITIAL_ENERGY,
    hasActedThisRound: false,
    isDead: false,
    respawnTimer: 0,
    hasFlag: false,
    carriedMine: null,
    carriedMineRevealed: false,
    status: { mineVulnerability: 0, moveCostDebuff: 0 },
    stats: {
        kills: 0, deaths: 0, minesPlaced: 0,
        minesTriggered: 0, damageDealt: 0, damageTaken: 0,
        flagCaptures: 0, flagReturns: 0, stepsTaken: 0, minesSwept: 0,
    },
    ...overrides,
});

/**
 * Creates a test Mine.
 */
export const createTestMine = (
    owner: PlayerID,
    type: MineType,
    r: number,
    c: number,
    overrides: Partial<Mine> = {}
): Mine => ({
    id: overrides.id ?? `mine-${owner}-${r}-${c}`,
    type,
    owner,
    r,
    c,
    revealedTo: [],
    ...overrides,
});

/**
 * Creates a test Building.
 */
export const createTestBuilding = (
    type: Building['type'],
    owner: PlayerID,
    r: number,
    c: number,
    overrides: Partial<Building> = {}
): Building => ({
    id: overrides.id ?? `building-${type}-${owner}-${r}-${c}`,
    type,
    owner,
    r,
    c,
    level: 1,
    ...overrides,
});

/**
 * Sets evolution level for a specific unit type and branch.
 */
export const setEvolution = (
    state: GameState,
    owner: PlayerID,
    unitType: UnitType,
    branch: 'a' | 'b',
    level: number,
    variant: 1 | 2 | null = null
): void => {
    const evo = state.players[owner].evolutionLevels[unitType];
    evo[branch] = level;
    if (branch === 'a') evo.aVariant = variant;
    else evo.bVariant = variant;
};
