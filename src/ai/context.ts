import { GRID_COLS, GRID_ROWS } from '../constants';
import { GameState, MineType, PlayerID, UnitType } from '../types';
import { AI_ENERGY_RESERVE_BASE } from './config';
import { evaluateEndgameState } from './endgame';
import { createInitialOpponentModel } from './opponentModel';
import { chooseOpeningPlan } from './opening';
import { assignUnitRoles } from './roles';
import { AIDifficulty, AIIntent, AIPlanningContext, AIOpponentModel, AIOpeningPlan, AITuningProfile } from './types';

const opposite = (player: PlayerID) => (player === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1);

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

export const deriveAIIntent = (
    state: GameState,
    aiPlayer: PlayerID = PlayerID.P2,
    opponentModel: AIOpponentModel = createInitialOpponentModel()
): AIIntent => {
    const enemy = opposite(aiPlayer);
    const ownUnits = state.players[aiPlayer].units.filter(u => !u.isDead);
    const enemyUnits = state.players[enemy].units.filter(u => !u.isDead);
    const ownEnergy = state.players[aiPlayer].energy;

    const enemyFlagCarrier = enemyUnits.find(u => u.hasFlag);
    if (enemyFlagCarrier) return 'hunt_flag_carrier';

    const ownFlagCarrier = ownUnits.find(u => u.hasFlag);
    if (ownFlagCarrier) return 'push_flag';

    const threatenedByMines = state.mines
        .filter(m => m.owner === enemy)
        .some(m => ownUnits.some(u => manhattan(u.r, u.c, m.r, m.c) <= 2));
    if (threatenedByMines || opponentModel.minePressure >= 4.5) return 'control_mines';

    const fragileUnits = ownUnits.filter(u => u.maxHp > 0 && (u.hp / u.maxHp) <= 0.45).length;
    if (fragileUnits >= 2 || ownEnergy <= 12 || opponentModel.aggression >= 5.5) return 'stabilize';

    if (opponentModel.flagRush >= 5.2) return 'hunt_flag_carrier';

    return 'push_flag';
};

export const buildThreatMap = (
    state: GameState,
    aiPlayer: PlayerID = PlayerID.P2,
    difficulty: AIDifficulty = 'normal'
) => {
    const enemy = opposite(aiPlayer);
    const enemyUnits = state.players[enemy].units.filter(u => !u.isDead);
    const enemyGeneral = state.players[enemy].evolutionLevels[UnitType.GENERAL];
    const generalRange = enemyGeneral.a >= 2 ? 2 : 1;
    const riskScale = difficulty === 'hard' ? 1.15 : difficulty === 'easy' ? 0.9 : 1;

    const map = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => 0));

    for (let r = 0; r < GRID_ROWS; r += 1) {
        for (let c = 0; c < GRID_COLS; c += 1) {
            if (state.cells[r][c].isObstacle) {
                map[r][c] = 999;
                continue;
            }

            let risk = 0;

            if (state.mines.some(m => m.owner === enemy && m.r === r && m.c === c)) risk += 90;

            if (state.mines.some(m =>
                m.owner === enemy &&
                m.type === MineType.NUKE &&
                Math.abs(m.r - r) <= 1 &&
                Math.abs(m.c - c) <= 1
            )) {
                risk += 65;
            }

            enemyUnits.forEach(unit => {
                const dist = manhattan(unit.r, unit.c, r, c);
                if (dist <= 1) risk += 9;
                else if (dist === 2) risk += 4;

                if (unit.type === UnitType.GENERAL && (unit.r === r || unit.c === c) && dist <= generalRange) {
                    risk += 16;
                }
            });

            map[r][c] = risk * riskScale;
        }
    }

    return map;
};

export const calculateReserveEnergy = (
    state: GameState,
    intent: AIIntent,
    difficulty: AIDifficulty,
    aiPlayer: PlayerID = PlayerID.P2
) => {
    const energy = state.players[aiPlayer].energy;
    const base = AI_ENERGY_RESERVE_BASE[difficulty];

    let reserve = base;
    if (intent === 'hunt_flag_carrier') reserve += 2;
    if (intent === 'stabilize') reserve += 2;
    if (intent === 'push_flag') reserve += 1;
    if (intent === 'control_mines') reserve += 1;

    const cappedByPool = Math.max(0, Math.floor(energy * 0.55));
    return Math.min(reserve, cappedByPool);
};

export const buildAIPlanningContext = (
    state: GameState,
    difficulty: AIDifficulty,
    aiPlayer: PlayerID = PlayerID.P2,
    opponentModel: AIOpponentModel = createInitialOpponentModel(),
    openingPlan: AIOpeningPlan | null = null,
    tuningProfile: AITuningProfile = 'balanced'
): AIPlanningContext => {
    const endgame = evaluateEndgameState(state, aiPlayer);
    const intent = deriveAIIntent(state, aiPlayer, opponentModel);
    const threatMap = buildThreatMap(state, aiPlayer, difficulty);
    const reserveEnergy = calculateReserveEnergy(state, intent, difficulty, aiPlayer);
    const unitRoles = assignUnitRoles(state, aiPlayer, intent, opponentModel);
    const effectiveOpeningPlan = openingPlan ?? chooseOpeningPlan(state, difficulty, tuningProfile, opponentModel, aiPlayer);
    const hasFlagCarrier =
        state.players[aiPlayer].units.some(u => !u.isDead && u.hasFlag) ||
        state.players[opposite(aiPlayer)].units.some(u => !u.isDead && u.hasFlag);
    const isOpening = !endgame.isEndgame && !hasFlagCarrier && state.turnCount <= 6;
    const openingWeight = isOpening ? Math.max(0.22, (7 - state.turnCount) / 6) : 0;

    const hotspotCells = Object.entries(opponentModel.hotspots)
        .map(([key, weight]) => {
            const [r, c] = key.split(',').map(Number);
            return { r, c, weight };
        })
        .filter(cell => Number.isFinite(cell.r) && Number.isFinite(cell.c))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);

    return {
        intent,
        threatMap,
        reserveEnergy,
        unitRoles,
        opponentModel,
        hotspotCells,
        opening: {
            isOpening,
            plan: isOpening ? effectiveOpeningPlan : null,
            weight: openingWeight,
            turn: state.turnCount
        },
        endgame
    };
};
