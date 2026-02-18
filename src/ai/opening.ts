import { GRID_COLS, GRID_ROWS } from '../constants';
import { GameState, MineType, PlayerID, Unit, UnitType } from '../types';
import { AIDifficulty, AIOpponentModel, AIOpeningPlan, AITuningProfile, AIActionType, AIPlanningContext } from './types';

interface AIOpeningBookEntry {
    actionBias: Partial<Record<AIActionType, number>>;
    roleBias: Partial<Record<string, number>>;
    lane: 'center' | 'upper' | 'lower' | 'wide' | 'fortress';
}

const OPENING_BOOK: Record<AIOpeningPlan, AIOpeningBookEntry> = {
    center_break: {
        actionBias: { move: 2.2, attack: 1.1, scan: 0.8, teleport: 0.9 },
        roleBias: { striker: 1.5, flanker: 1.1 },
        lane: 'center'
    },
    lane_pressure: {
        actionBias: { move: 2.4, attack: 0.8, pickup_flag: 0.7 },
        roleBias: { flanker: 1.5, striker: 1.1 },
        lane: 'wide'
    },
    mine_screen: {
        actionBias: { place_mine: 2.8, place_tower: 1.6, move_mine: 1.3, convert_mine: 1.4, scan: 1.3, disarm: 0.8, move: 0.6 },
        roleBias: { controller: 1.6, support: 1.1 },
        lane: 'center'
    },
    scout_probe: {
        actionBias: { scan: 2.7, move: 1.6, disarm: 1.2 },
        roleBias: { scout: 1.8, support: 0.9 },
        lane: 'upper'
    },
    fortress: {
        actionBias: { place_mine: 1.9, place_tower: 1.5, place_hub: 1.2, disarm: 1.4, move: 0.4, end_turn: 0.3 },
        roleBias: { support: 1.5, controller: 1.2 },
        lane: 'fortress'
    },
    flag_spear: {
        actionBias: { move: 2.5, pickup_flag: 1.1, attack: 1.4 },
        roleBias: { striker: 1.7, flanker: 1.2 },
        lane: 'lower'
    }
};

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const opposite = (player: PlayerID) => (player === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1);

const getCenterObstacleCount = (state: GameState) => {
    const centerStart = Math.floor(GRID_COLS / 2) - 2;
    const centerEnd = Math.floor(GRID_COLS / 2) + 1;
    let count = 0;
    for (let r = 0; r < GRID_ROWS; r += 1) {
        for (let c = centerStart; c <= centerEnd; c += 1) {
            if (state.cells[r][c].isObstacle) count += 1;
        }
    }
    return count;
};

export const chooseOpeningPlan = (
    state: GameState,
    difficulty: AIDifficulty,
    tuningProfile: AITuningProfile,
    opponentModel: AIOpponentModel,
    aiPlayer: PlayerID = PlayerID.P2
): AIOpeningPlan => {
    const enemy = opposite(aiPlayer);
    const centerObstacles = getCenterObstacleCount(state);
    const enemyUnits = state.players[enemy].units.filter(u => !u.isDead);
    const enemyForwardPressure = enemyUnits.filter(u => manhattan(u.r, u.c, state.players[aiPlayer].flagPosition.r, state.players[aiPlayer].flagPosition.c) <= 7).length;

    if (opponentModel.minePressure >= 4.5) return 'scout_probe';
    if (tuningProfile === 'conservative') return enemyForwardPressure >= 2 ? 'fortress' : 'mine_screen';
    if (tuningProfile === 'aggressive') return centerObstacles <= 5 ? 'center_break' : 'flag_spear';

    if (difficulty === 'hard' && centerObstacles <= 4) return 'center_break';
    if (enemyForwardPressure >= 2 || opponentModel.flagRush >= 4.2) return 'lane_pressure';
    if (centerObstacles >= 8) return 'lane_pressure';
    return 'mine_screen';
};

const getLaneScore = (
    lane: AIOpeningBookEntry['lane'],
    targetR: number,
    targetC: number,
    unit: Unit
) => {
    if (lane === 'center') {
        const centerR = Math.floor(GRID_ROWS / 2);
        const centerC = Math.floor(GRID_COLS / 2);
        return clamp(4 - (Math.abs(targetR - centerR) * 0.7 + Math.abs(targetC - centerC) * 0.18), 0, 4);
    }
    if (lane === 'upper') {
        return clamp(3.8 - targetR * 0.9, 0, 3.8);
    }
    if (lane === 'lower') {
        return clamp(3.8 - (GRID_ROWS - 1 - targetR) * 0.9, 0, 3.8);
    }
    if (lane === 'fortress') {
        const backlineDist = unit.owner === PlayerID.P2
            ? Math.abs(targetC - (GRID_COLS - 3))
            : Math.abs(targetC - 2);
        return clamp(4.2 - backlineDist * 0.45, 0, 4.2);
    }
    const edgeDist = Math.min(targetR, GRID_ROWS - 1 - targetR);
    return clamp(3.4 - edgeDist * 0.9, 0, 3.4);
};

export const getOpeningActionBias = (
    context: AIPlanningContext | undefined,
    unit: Unit,
    actionType: AIActionType,
    target?: { r: number; c: number },
    mineType?: MineType
) => {
    if (!context || !context.opening.isOpening || !context.opening.plan) return 0;
    const entry = OPENING_BOOK[context.opening.plan];
    const role = context.unitRoles[unit.id];
    let bonus = (entry.actionBias[actionType] ?? 0) + (role ? (entry.roleBias[role] ?? 0) : 0);

    if (target) {
        bonus += getLaneScore(entry.lane, target.r, target.c, unit) * 0.65;
        if (actionType === 'move') {
            const forward = unit.owner === PlayerID.P2 ? (unit.c - target.c) : (target.c - unit.c);
            if (forward > 0) bonus += forward * 0.55;
        }
    }

    if (actionType === 'place_mine') {
        if (context.opening.plan === 'mine_screen' && mineType === MineType.CHAIN) bonus += 1.2;
        if (context.opening.plan === 'fortress' && (mineType === MineType.NORMAL || mineType === MineType.SLOW)) bonus += 0.9;
    }

    if (context.opening.plan === 'flag_spear' && unit.type === UnitType.GENERAL && actionType === 'pickup_flag') {
        bonus += 1.3;
    }

    return bonus * context.opening.weight;
};
