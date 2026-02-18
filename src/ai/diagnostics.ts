import { GRID_COLS, GRID_ROWS, UNIT_STATS } from '../constants';
import { checkEnergyCap as engineCheckEnergyCap } from '../gameEngine';
import { getDisplayCost, getEnemyTerritoryEnergyCost } from '../gameHelpers';
import { GameState, PlayerID, Unit, UnitType } from '../types';
import { canGeneralAttack, evaluateTargetCellRisk } from './evaluator';
import {
    AICandidateAction,
    AIDecisionCandidateView,
    AIPlanningContext,
    AIRejectedReason,
    AIRejectedReasonSummary,
    AIRejectedReasonType
} from './types';

const directions = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

const inBounds = (r: number, c: number) => r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;

const isOccupied = (state: GameState, r: number, c: number, unitId: string) =>
    state.players[PlayerID.P1].units.some(u => !u.isDead && u.r === r && u.c === c && u.id !== unitId) ||
    state.players[PlayerID.P2].units.some(u => !u.isDead && u.r === r && u.c === c && u.id !== unitId);

const pushReason = (
    reasons: Map<string, AIRejectedReason>,
    reason: AIRejectedReasonType,
    action: AIRejectedReason['action'],
    detail: string
) => {
    const key = `${reason}:${action}:${detail}`;
    const existing = reasons.get(key);
    if (existing) {
        existing.count += 1;
        return;
    }
    reasons.set(key, { reason, action, detail, count: 1 });
};

const addMovementRejections = (
    reasons: Map<string, AIRejectedReason>,
    state: GameState,
    unit: Unit,
    context: AIPlanningContext
) => {
    const player = state.players[unit.owner];
    const moveCost = getDisplayCost(unit, UNIT_STATS[unit.type].moveCost, state);
    if (player.energy < moveCost) {
        pushReason(reasons, 'energy', 'move', `need ${moveCost}, have ${player.energy}`);
        return;
    }
    if (!engineCheckEnergyCap(unit, moveCost)) {
        pushReason(reasons, 'energy', 'move', 'energy cap limit');
        return;
    }

    directions.forEach(dir => {
        const nr = unit.r + dir.r;
        const nc = unit.c + dir.c;
        if (!inBounds(nr, nc)) {
            pushReason(reasons, 'rules', 'move', 'out of bounds');
            return;
        }
        if (state.cells[nr][nc].isObstacle) {
            pushReason(reasons, 'rules', 'move', 'blocked by obstacle');
            return;
        }
        if (isOccupied(state, nr, nc, unit.id)) {
            pushReason(reasons, 'rules', 'move', 'occupied cell');
            return;
        }
        const risk = evaluateTargetCellRisk(state, unit, nr, nc, context.threatMap);
        if (risk >= 999) {
            pushReason(reasons, 'risk', 'move', 'fatal risk');
        }
    });
};

const addAttackRejections = (reasons: Map<string, AIRejectedReason>, state: GameState, unit: Unit) => {
    if (unit.type !== UnitType.GENERAL) return;

    const player = state.players[unit.owner];
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const targets = state.players[enemyId].units.filter(u => !u.isDead);
    if (targets.length === 0) {
        pushReason(reasons, 'rules', 'attack', 'no enemy targets');
        return;
    }

    const generalLevels = player.evolutionLevels[UnitType.GENERAL];
    const attackBaseCost = (unit.hasFlag && generalLevels.a >= 3 && generalLevels.aVariant === 1)
        ? 6
        : UNIT_STATS[UnitType.GENERAL].attackCost;
    const attackCost = getEnemyTerritoryEnergyCost(unit, attackBaseCost);

    if (player.energy < attackCost) {
        pushReason(reasons, 'energy', 'attack', `need ${attackCost}, have ${player.energy}`);
        return;
    }
    if (!engineCheckEnergyCap(unit, attackCost)) {
        pushReason(reasons, 'energy', 'attack', 'energy cap limit');
        return;
    }

    const blockedCount = targets.filter(target => !canGeneralAttack(unit, target, state)).length;
    if (blockedCount > 0) {
        pushReason(reasons, 'rules', 'attack', 'out of range or line rules');
    }
};

const addUnitActionRejections = (
    reasons: Map<string, AIRejectedReason>,
    state: GameState,
    unit: Unit
) => {
    const player = state.players[unit.owner];
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;

    if (unit.type === UnitType.MINESWEEPER) {
        const scanBaseCost = (player.questStats.sweeperScansThisRound || 0) >= 2 ? 4 : 3;
        const scanCost = getEnemyTerritoryEnergyCost(unit, scanBaseCost);
        if (player.energy < scanCost) {
            pushReason(reasons, 'energy', 'scan', `need ${scanCost}, have ${player.energy}`);
        } else if (!engineCheckEnergyCap(unit, scanCost)) {
            pushReason(reasons, 'energy', 'scan', 'energy cap limit');
        }

        const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
        if (swpLevelB < 1) {
            pushReason(reasons, 'rules', 'sensor_scan', 'not unlocked');
        } else {
            const sensorCost = swpLevelB >= 3 ? 4 : 5;
            if (player.energy < sensorCost) {
                pushReason(reasons, 'energy', 'sensor_scan', `need ${sensorCost}, have ${player.energy}`);
            } else if (!engineCheckEnergyCap(unit, sensorCost)) {
                pushReason(reasons, 'energy', 'sensor_scan', 'energy cap limit');
            }
        }
    }

    if (unit.type === UnitType.MAKER) {
        const hasOpenAdjacentCell = directions.some(dir => {
            const nr = unit.r + dir.r;
            const nc = unit.c + dir.c;
            if (!inBounds(nr, nc)) return false;
            if (state.cells[nr][nc].isObstacle) return false;
            return !isOccupied(state, nr, nc, unit.id);
        });
        if (!hasOpenAdjacentCell) {
            pushReason(reasons, 'rules', 'place_mine', 'no legal adjacent cell');
        }

        const normalMineCost = getEnemyTerritoryEnergyCost(unit, 5);
        if (player.energy < normalMineCost) {
            pushReason(reasons, 'energy', 'place_mine', `need ${normalMineCost}, have ${player.energy}`);
        } else if (!engineCheckEnergyCap(unit, normalMineCost)) {
            pushReason(reasons, 'energy', 'place_mine', 'energy cap limit');
        }
    }

    if (unit.type === UnitType.DEFUSER) {
        const disarmCost = getEnemyTerritoryEnergyCost(unit, UNIT_STATS[UnitType.DEFUSER].disarmCost);
        if (player.energy < disarmCost) {
            pushReason(reasons, 'energy', 'disarm', `need ${disarmCost}, have ${player.energy}`);
        } else if (!engineCheckEnergyCap(unit, disarmCost)) {
            pushReason(reasons, 'energy', 'disarm', 'energy cap limit');
        }

        const hasDisarmTarget = state.mines.some(m =>
            m.owner === enemyId &&
            Math.abs(m.r - unit.r) <= 1 &&
            Math.abs(m.c - unit.c) <= 1
        );
        if (!hasDisarmTarget) {
            pushReason(reasons, 'rules', 'disarm', 'no nearby enemy mine');
        }
    }
};

export const summarizeTopCandidates = (
    actions: AICandidateAction[],
    limit: number = 5
): AIDecisionCandidateView[] => (
    actions.slice(0, limit).map((action, idx) => ({
        rank: idx + 1,
        type: action.type,
        target: action.target,
        score: action.score,
        lookaheadScore: action.lookaheadScore,
        isFeint: action.isFeint,
        sourceRank: action.sourceRank,
        breakdown: action.scoreBreakdown
    }))
);

export const collectRejectionSummary = (
    state: GameState,
    unit: Unit,
    context: AIPlanningContext
): AIRejectedReason[] => {
    const reasons = new Map<string, AIRejectedReason>();
    addMovementRejections(reasons, state, unit, context);
    addAttackRejections(reasons, state, unit);
    addUnitActionRejections(reasons, state, unit);
    return [...reasons.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
};

export const summarizeRejectedReasonBuckets = (
    reasons: AIRejectedReason[]
): AIRejectedReasonSummary => (
    reasons.reduce<AIRejectedReasonSummary>((acc, reason) => {
        acc[reason.reason] += reason.count;
        return acc;
    }, { energy: 0, risk: 0, rules: 0 })
);
