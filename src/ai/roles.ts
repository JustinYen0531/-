import { GRID_COLS, GRID_ROWS, UNIT_STATS } from '../constants';
import { GameState, PlayerID, Unit, UnitType } from '../types';
import { AIIntent, AIOpponentModel, AIUnitRole } from './types';

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const countFreeNeighbors = (state: GameState, unit: Unit) => {
    const dirs = [
        { r: -1, c: 0 },
        { r: 1, c: 0 },
        { r: 0, c: -1 },
        { r: 0, c: 1 }
    ];
    let count = 0;
    dirs.forEach(dir => {
        const nr = unit.r + dir.r;
        const nc = unit.c + dir.c;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) return;
        if (state.cells[nr][nc].isObstacle) return;
        const occupied =
            state.players[PlayerID.P1].units.some(u => !u.isDead && u.r === nr && u.c === nc) ||
            state.players[PlayerID.P2].units.some(u => !u.isDead && u.r === nr && u.c === nc);
        if (!occupied) count += 1;
    });
    return count;
};

export const assignUnitRoles = (
    state: GameState,
    aiPlayer: PlayerID,
    intent: AIIntent,
    opponentModel: AIOpponentModel
): Record<string, AIUnitRole> => {
    const ownUnits = state.players[aiPlayer].units.filter(u => !u.isDead);
    const roles: Record<string, AIUnitRole> = {};

    ownUnits.forEach(unit => {
        let role: AIUnitRole;
        if (unit.type === UnitType.GENERAL) role = 'striker';
        else if (unit.type === UnitType.RANGER) role = 'flanker';
        else if (unit.type === UnitType.MAKER) role = 'controller';
        else if (unit.type === UnitType.MINESWEEPER) role = 'scout';
        else role = 'support';

        if (intent === 'control_mines' && (unit.type === UnitType.MINESWEEPER || unit.type === UnitType.DEFUSER)) {
            role = unit.type === UnitType.MINESWEEPER ? 'scout' : 'support';
        }
        if (intent === 'hunt_flag_carrier' && unit.type === UnitType.RANGER) {
            role = 'striker';
        }
        if (intent === 'stabilize' && unit.type === UnitType.GENERAL && opponentModel.aggression > 3.5) {
            role = 'support';
        }

        roles[unit.id] = role;
    });

    return roles;
};

export const evaluateFormationPositionBonus = (
    state: GameState,
    unit: Unit,
    role: AIUnitRole,
    intent: AIIntent,
    aiPlayer: PlayerID
) => {
    const enemy = aiPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const ownFlag = state.players[aiPlayer].flagPosition;
    const enemyFlag = state.players[enemy].flagPosition;
    const distEnemy = manhattan(unit.r, unit.c, enemyFlag.r, enemyFlag.c);
    const distOwn = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
    const frontlineBalance = distOwn - distEnemy;
    const mobility = countFreeNeighbors(state, unit);

    let bonus = 0;
    if (role === 'striker') {
        bonus += Math.max(0, 9 - distEnemy) * 0.7;
        bonus += frontlineBalance * 0.25;
        if (unit.hasFlag) bonus += 4;
    } else if (role === 'flanker') {
        bonus += Math.max(0, 8 - distEnemy) * 0.45;
        bonus += mobility * 0.65;
    } else if (role === 'controller') {
        const centerCol = (enemyFlag.c + ownFlag.c) / 2;
        bonus += Math.max(0, 6 - Math.abs(unit.c - centerCol)) * 0.6;
        bonus += mobility * 0.35;
    } else if (role === 'scout') {
        bonus += mobility * 0.8;
        bonus += Math.max(0, 10 - distEnemy) * 0.3;
    } else {
        bonus += Math.max(0, 8 - distOwn) * 0.75;
        bonus += Math.max(0, 7 - UNIT_STATS[unit.type].moveCost) * 0.3;
    }

    if (intent === 'push_flag') {
        bonus += role === 'striker' || role === 'flanker' ? 1.4 : -0.2;
    } else if (intent === 'hunt_flag_carrier') {
        bonus += role === 'striker' ? 1.8 : role === 'flanker' ? 1 : 0;
    } else if (intent === 'control_mines') {
        bonus += role === 'controller' || role === 'scout' || role === 'support' ? 1.3 : -0.4;
    } else if (intent === 'stabilize') {
        bonus += role === 'support' ? 1.6 : role === 'striker' ? -0.8 : 0.3;
    }

    return bonus;
};
