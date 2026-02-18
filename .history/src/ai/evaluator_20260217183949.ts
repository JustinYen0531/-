import { GRID_COLS, GRID_ROWS, UNIT_STATS } from '../constants';
import { getDisplayCost, getEnemyTerritoryEnergyCost } from '../gameHelpers';
import { calculateAttackDamage, checkEnergyCap as engineCheckEnergyCap } from '../gameEngine';
import { GameState, MineType, PlayerID, Unit, UnitType } from '../types';
import { AI_DIFFICULTY_WEIGHTS, AI_INTENT_ACTION_BONUS, AI_ROLE_ACTION_BONUS } from './config';
import { getOpeningActionBias } from './opening';
import { evaluateFormationPositionBonus } from './roles';
import { AIActionType, AICandidateAction, AIDifficulty, AIPlanningContext, AIScoreBreakdown } from './types';

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const getHotspotPressure = (
    context: AIPlanningContext | undefined,
    r: number,
    c: number,
    radius: number = 3
) => {
    if (!context || context.hotspotCells.length === 0) return 0;
    return context.hotspotCells.reduce((sum, cell) => {
        const dist = manhattan(cell.r, cell.c, r, c);
        if (dist > radius) return sum;
        return sum + (cell.weight / (dist + 1));
    }, 0);
};

const getEndgameActionBias = (
    state: GameState,
    context: AIPlanningContext | undefined,
    unit: Unit,
    actionType: AIActionType,
    target?: { r: number; c: number }
) => {
    if (!context || !context.endgame.isEndgame) return 0;
    const urgency = context.endgame.urgency;
    const mode = context.endgame.mode;

    if (mode === 'race') {
        if (unit.hasFlag && actionType === 'move') return 2.2 * urgency;
        if (actionType === 'pickup_flag') return 1.6 * urgency;
        if (actionType === 'teleport') return 1.5 * urgency;
        if (actionType === 'attack') return 1.1 * urgency;
        if (actionType === 'drop_flag') return -2.7 * urgency;
        if (actionType === 'end_turn') return -1.8 * urgency;
        return 0;
    }

    if (mode === 'defense') {
        if (actionType === 'attack') return 2.5 * urgency;
        if (actionType === 'scan' || actionType === 'sensor_scan' || actionType === 'disarm') return 1.6 * urgency;
        if (actionType === 'place_tower' || actionType === 'convert_mine' || actionType === 'move_mine') return 1.3 * urgency;
        if (actionType === 'drop_flag') return 1.1 * urgency;
        if (actionType === 'end_turn') return -1.5 * urgency;
        if (target && actionType === 'move') {
            const ownFlag = state.players[unit.owner].flagPosition;
            const before = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
            const after = manhattan(target.r, target.c, ownFlag.r, ownFlag.c);
            return Math.max(0, before - after) * 0.9 * urgency;
        }
        return 0;
    }

    if (mode === 'attrition') {
        if (actionType === 'attack') return 1.2 * urgency;
        if (actionType === 'detonate_tower' || actionType === 'throw_mine') return 1.3 * urgency;
        if (actionType === 'move') return 0.7 * urgency;
        if (actionType === 'end_turn') return -0.8 * urgency;
        return 0;
    }

    return 0;
};

const isCellOccupied = (state: GameState, r: number, c: number) =>
    state.players[PlayerID.P1].units.some(u => !u.isDead && u.r === r && u.c === c) ||
    state.players[PlayerID.P2].units.some(u => !u.isDead && u.r === r && u.c === c);

export const canGeneralAttack = (attacker: Unit, target: Unit, state: GameState): boolean => {
    if (attacker.type !== UnitType.GENERAL || target.isDead || attacker.owner === target.owner) return false;

    const levels = state.players[attacker.owner].evolutionLevels[UnitType.GENERAL];
    const attackRange = levels.a >= 2 ? 2 : 1;
    const dist = manhattan(attacker.r, attacker.c, target.r, target.c);
    const isCardinal = attacker.r === target.r || attacker.c === target.c;
    if (!isCardinal || dist > attackRange) return false;

    if (attacker.hasFlag && !(levels.a >= 3 && levels.aVariant === 1)) return false;

    const attackBaseCost = (attacker.hasFlag && levels.a >= 3 && levels.aVariant === 1)
        ? 6
        : UNIT_STATS[UnitType.GENERAL].attackCost;
    const attackCost = getEnemyTerritoryEnergyCost(attacker, attackBaseCost);
    const owner = state.players[attacker.owner];
    if (owner.energy < attackCost) return false;
    return engineCheckEnergyCap(attacker, attackCost);
};

export const evaluateTargetCellRisk = (
    state: GameState,
    unit: Unit,
    r: number,
    c: number,
    threatMap?: AIPlanningContext['threatMap']
): number => {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return 999;
    if (state.cells[r][c].isObstacle || isCellOccupied(state, r, c)) return 999;

    let risk = threatMap?.[r]?.[c] ?? 0;
    if (!threatMap) {
        if (state.mines.some(m => m.owner !== unit.owner && m.r === r && m.c === c)) risk += 90;

        if (state.mines.some(m =>
            m.owner !== unit.owner &&
            m.type === MineType.NUKE &&
            Math.abs(m.r - r) <= 1 &&
            Math.abs(m.c - c) <= 1 &&
            Math.max(Math.abs(m.r - unit.r), Math.abs(m.c - unit.c)) > 1
        )) {
            risk += 70;
        }
    }

    const enemy = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const enemyFlag = state.players[enemy].flagPosition;
    const enemyGen = state.players[enemy].evolutionLevels[UnitType.GENERAL];
    if (enemyGen.b >= 3 && enemyGen.bVariant === 2) {
        const currentlyOutside = Math.abs(unit.r - enemyFlag.r) > 1 || Math.abs(unit.c - enemyFlag.c) > 1;
        const nextInside = Math.abs(r - enemyFlag.r) <= 1 && Math.abs(c - enemyFlag.c) <= 1;
        if (currentlyOutside && nextInside) risk += 18;
    }

    const adjacentEnemies = state.players[enemy].units.filter(u =>
        !u.isDead && Math.abs(u.r - r) <= 1 && Math.abs(u.c - c) <= 1
    ).length;
    if (adjacentEnemies > 0) {
        const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
        risk += adjacentEnemies * (hpRatio < 0.5 ? 12 : 7);
    }

    return risk;
};

export const evaluateUnitPriority = (state: GameState, unit: Unit, difficulty: AIDifficulty): AIScoreBreakdown => {
    const w = AI_DIFFICULTY_WEIGHTS[difficulty];
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
    const enemyFlag = state.players[enemyId].flagPosition;
    const ownPlayer = state.players[unit.owner];

    const attackOpportunity = unit.type === UnitType.GENERAL && enemyUnits.some(t => canGeneralAttack(unit, t, state)) ? 12 : 0;
    const flag = Math.max(0, 12 - manhattan(unit.r, unit.c, enemyFlag.r, enemyFlag.c));
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
    const safety = hpRatio < 0.4 ? 8 : 3;
    const moveCost = getDisplayCost(unit, UNIT_STATS[unit.type].moveCost, state);
    const energy = ownPlayer.energy <= 0 ? 0 : Math.max(0, 8 - (moveCost / Math.max(1, ownPlayer.energy)) * 20);

    let total =
        attackOpportunity * w.unitAttackOpportunity +
        flag * w.unitFlagPressure +
        safety * w.unitSurvival +
        energy * w.unitEnergyEfficiency;

    return { total, attack: attackOpportunity, flag, safety, energy };
};

export const evaluateUnitPriorityWithContext = (
    state: GameState,
    unit: Unit,
    difficulty: AIDifficulty,
    context?: AIPlanningContext
): AIScoreBreakdown => {
    const base = evaluateUnitPriority(state, unit, difficulty);
    if (!context) return base;

    let total = base.total;
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;

    if (context.intent === 'push_flag') {
        if (unit.hasFlag) total += 8;
        if (unit.type === UnitType.GENERAL || unit.type === UnitType.RANGER) total += 2;
    } else if (context.intent === 'hunt_flag_carrier') {
        if (unit.type === UnitType.GENERAL || unit.type === UnitType.RANGER) total += 4;
        if (unit.type === UnitType.MINESWEEPER) total += 1.5;
    } else if (context.intent === 'control_mines') {
        if (unit.type === UnitType.MINESWEEPER || unit.type === UnitType.DEFUSER || unit.type === UnitType.MAKER) total += 4;
    } else if (context.intent === 'stabilize') {
        if (hpRatio <= 0.5) total += 3;
        if (unit.type === UnitType.DEFUSER || unit.type === UnitType.MINESWEEPER) total += 2;
    }

    const role = context.unitRoles[unit.id];
    if (role) {
        total += evaluateFormationPositionBonus(state, unit, role, context.intent, unit.owner);
    }

    if (context.opponentModel.flagRush >= 4.5 && (unit.type === UnitType.GENERAL || unit.type === UnitType.RANGER)) {
        total += 2;
    }
    if (context.opponentModel.minePressure >= 4.5 && (unit.type === UnitType.MINESWEEPER || unit.type === UnitType.DEFUSER)) {
        total += 2.8;
    }

    if (context.opening.isOpening && context.opening.plan) {
        if (context.opening.plan === 'center_break' && (unit.type === UnitType.GENERAL || unit.type === UnitType.RANGER)) total += 1.6 * context.opening.weight;
        if (context.opening.plan === 'mine_screen' && (unit.type === UnitType.MAKER || unit.type === UnitType.MINESWEEPER)) total += 1.5 * context.opening.weight;
        if (context.opening.plan === 'fortress' && unit.type === UnitType.DEFUSER) total += 1.8 * context.opening.weight;
    }

    if (context.endgame.isEndgame) {
        const urgency = context.endgame.urgency;
        if (context.endgame.mode === 'race') {
            if (unit.hasFlag) total += 6.5 * urgency;
            if (unit.type === UnitType.GENERAL || unit.type === UnitType.RANGER) total += 2.1 * urgency;
        } else if (context.endgame.mode === 'defense') {
            const ownFlag = state.players[unit.owner].flagPosition;
            const distOwnFlag = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
            total += Math.max(0, 6 - distOwnFlag) * 0.8 * urgency;
            if (unit.type === UnitType.MINESWEEPER || unit.type === UnitType.DEFUSER || unit.type === UnitType.GENERAL) total += 1.8 * urgency;
        } else if (context.endgame.mode === 'attrition') {
            const isLowHp = unit.maxHp > 0 && unit.hp / unit.maxHp < 0.45;
            total += (isLowHp ? 1.2 : 0.5) * urgency;
        }
    }

    return { ...base, total };
};

export const evaluateActionCandidate = (
    state: GameState,
    unit: Unit,
    actionType: AIActionType,
    target: AICandidateAction['target'],
    difficulty: AIDifficulty,
    energyCost: number,
    mineType?: MineType,
    context?: AIPlanningContext
): AIScoreBreakdown => {
    const w = AI_DIFFICULTY_WEIGHTS[difficulty];
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const enemyFlag = state.players[enemyId].flagPosition;
    const ownFlag = state.players[unit.owner].flagPosition;
    const role = context?.unitRoles[unit.id];

    let attack = 0;
    let flag = 0;
    let safety = 0;
    let utility = 0;
    let energy = Math.max(0, 10 - energyCost);

    if (actionType === 'move' && target?.kind === 'cell') {
        const currentDist = manhattan(unit.r, unit.c, enemyFlag.r, enemyFlag.c);
        const nextDist = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c);
        const flagBonus = unit.hasFlag ? 6 : 3;
        flag = Math.max(0, currentDist - nextDist) * flagBonus;
        safety = Math.max(0, 20 - evaluateTargetCellRisk(state, unit, target.r, target.c, context?.threatMap));
        const hotspotPressure = getHotspotPressure(context, target.r, target.c, 4);

        if (role === 'striker') {
            const advanceValue = Math.max(0, currentDist - nextDist);
            utility += advanceValue * 1.4 + hotspotPressure * 0.45;
        } else if (role === 'flanker') {
            const sideLane = Math.abs(target.c - ownFlag.c);
            utility += sideLane * 0.5 + hotspotPressure * 0.35;
        } else if (role === 'controller') {
            const centerCol = (enemyFlag.c + ownFlag.c) / 2;
            utility += Math.max(0, 4 - Math.abs(target.c - centerCol)) * 1.2;
            utility += hotspotPressure * 0.55;
        } else if (role === 'scout') {
            utility += hotspotPressure * 0.9;
        } else if (role === 'support') {
            const ownFlagDistBefore = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
            const ownFlagDistAfter = manhattan(target.r, target.c, ownFlag.r, ownFlag.c);
            utility += Math.max(0, ownFlagDistBefore - ownFlagDistAfter) * 1.1;
            safety += Math.max(0, 4 - ownFlagDistAfter) * 0.5;
        }
    } else if (actionType === 'attack' && target?.kind === 'unit') {
        const t = target.unit;
        const { damage } = calculateAttackDamage(
            unit,
            t,
            state.players[unit.owner],
            state.players[t.owner],
            false
        );
        const willKill = t.hp - damage <= 0;
        attack = (damage * 2) + (willKill ? 10 : 0) + (t.hasFlag ? 8 : 0);
        safety = 7;
    } else if (actionType === 'scan') {
        let base = 6;
        if (target?.kind === 'cell') {
            const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
            const nearbyEnemies = enemyUnits.filter(u => Math.abs(u.r - target.r) <= 2 && Math.abs(u.c - target.c) <= 2).length;
            const nearFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 3 ? 3 : 0;
            const hotspotPressure = getHotspotPressure(context, target.r, target.c, 4);
            const unrevealedMines = state.mines.filter(m =>
                m.owner !== unit.owner &&
                !m.revealedTo.includes(unit.owner) &&
                Math.abs(m.r - target.r) <= 2 &&
                Math.abs(m.c - target.c) <= 2
            ).length;
            base += nearbyEnemies * 2 + nearFlag + unrevealedMines * 2 + hotspotPressure * 0.8;
        }
        utility = base;
        safety = 6;
    } else if (actionType === 'sensor_scan') {
        let base = 7.5;
        if (target?.kind === 'cell') {
            const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
            const nearbyEnemies = enemyUnits.filter(u => Math.abs(u.r - target.r) <= 2 && Math.abs(u.c - target.c) <= 2).length;
            const nearFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 3 ? 3.5 : 0;
            const hotspotPressure = getHotspotPressure(context, target.r, target.c, 4);
            base += nearbyEnemies * 2.2 + nearFlag + hotspotPressure * 0.9;
        }
        utility = base;
        safety = 6.5;
    } else if (actionType === 'place_mine' && target?.kind === 'cell') {
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 4 ? 8 : 3;
        const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
        const minDistToEnemy = enemyUnits.length === 0
            ? 6
            : Math.min(...enemyUnits.map(u => manhattan(target.r, target.c, u.r, u.c)));
        const hotspotPressure = getHotspotPressure(context, target.r, target.c, 3);
        const unitPressure = minDistToEnemy <= 2 ? 8 : minDistToEnemy <= 4 ? 4 : 0;
        let typeBonus = 0;
        if (mineType === MineType.SLOW) typeBonus = minDistToEnemy <= 2 ? 6 : 2;
        if (mineType === MineType.SMOKE) typeBonus = minDistToEnemy <= 3 ? 4 : 1;
        if (mineType === MineType.CHAIN) typeBonus = nearEnemyFlag >= 8 ? 6 : 3;
        if (mineType === MineType.NUKE) typeBonus = enemyUnits.filter(u => Math.abs(u.r - target.r) <= 2 && Math.abs(u.c - target.c) <= 2).length >= 2 ? 10 : 4;
        utility = nearEnemyFlag + unitPressure + typeBonus + hotspotPressure * 0.75;
        safety = Math.max(0, 14 - evaluateTargetCellRisk(state, unit, target.r, target.c, context?.threatMap));
    } else if (actionType === 'place_tower' && target?.kind === 'cell') {
        const enemyMines = state.mines.filter(m => m.owner !== unit.owner);
        const inCoverage = enemyMines.filter(m => Math.abs(m.r - target.r) <= 1 && Math.abs(m.c - target.c) <= 1).length;
        const nearbyEnemies = state.players[enemyId].units.filter(u => !u.isDead && Math.abs(u.r - target.r) <= 2 && Math.abs(u.c - target.c) <= 2).length;
        utility = 8 + inCoverage * 4 + nearbyEnemies * 1.6;
        safety = 6.5;
    } else if (actionType === 'detonate_tower') {
        const ownTowers = state.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
        const enemyMinesInRange = state.mines.filter(m => m.owner !== unit.owner && ownTowers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)).length;
        const enemyUnitsInRange = state.players[enemyId].units.filter(u => !u.isDead && ownTowers.some(t => Math.abs(u.r - t.r) <= 1 && Math.abs(u.c - t.c) <= 1)).length;
        attack = enemyUnitsInRange * 5.5;
        utility = 9 + enemyMinesInRange * 3.5;
        safety = 5.5;
    } else if (actionType === 'place_factory' && target?.kind === 'cell') {
        const enemyFlagDist = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c);
        utility = 7 + Math.max(0, 10 - enemyFlagDist) * 0.4;
        safety = 5;
    } else if (actionType === 'place_hub' && target?.kind === 'cell') {
        const enemyFlagDist = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c);
        const ownFlagDist = manhattan(target.r, target.c, ownFlag.r, ownFlag.c);
        utility = 8 + Math.max(0, 9 - enemyFlagDist) * 0.35 + Math.max(0, 6 - ownFlagDist) * 0.25;
        safety = 5.5;
    } else if (actionType === 'teleport' && target?.kind === 'cell') {
        const beforeEnemyFlag = manhattan(unit.r, unit.c, enemyFlag.r, enemyFlag.c);
        const afterEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c);
        const beforeOwnFlag = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
        const afterOwnFlag = manhattan(target.r, target.c, ownFlag.r, ownFlag.c);
        const pushGain = Math.max(0, beforeEnemyFlag - afterEnemyFlag);
        const defenseGain = Math.max(0, beforeOwnFlag - afterOwnFlag);
        flag = unit.hasFlag ? pushGain * 4 : pushGain * 2.2;
        utility = 6 + pushGain * 1.8 + defenseGain * 1.1;
        safety = Math.max(0, 20 - evaluateTargetCellRisk(state, unit, target.r, target.c, context?.threatMap));
    } else if (actionType === 'throw_mine' && target?.kind === 'cell') {
        const enemyAtTarget = state.players[enemyId].units.filter(u => !u.isDead && u.r === target.r && u.c === target.c);
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 3 ? 6 : 2;
        attack = enemyAtTarget.length * 8.5;
        utility = 7 + nearEnemyFlag + enemyAtTarget.length * 3.5;
        safety = 5.2;
    } else if (actionType === 'pickup_mine' && target?.kind === 'cell') {
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 4 ? 3 : 0;
        utility = 6.5 + nearEnemyFlag;
        safety = 6;
    } else if (actionType === 'drop_mine' && target?.kind === 'cell') {
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 4 ? 6 : 2;
        utility = 6 + nearEnemyFlag;
        safety = 5.8;
    } else if (actionType === 'move_mine' && target?.kind === 'cell') {
        const enemyNear = state.players[enemyId].units.filter(u => !u.isDead && manhattan(u.r, u.c, target.r, target.c) <= 1).length;
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 4 ? 5 : 1;
        utility = 8 + enemyNear * 2.4 + nearEnemyFlag;
        safety = 5.2;
    } else if (actionType === 'convert_mine' && target?.kind === 'cell') {
        const nearEnemyFlag = manhattan(target.r, target.c, enemyFlag.r, enemyFlag.c) <= 4 ? 5.5 : 2;
        utility = 9 + nearEnemyFlag;
        safety = 6.2;
    } else if (actionType === 'disarm') {
        const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
        const localThreat = target?.kind === 'cell'
            ? enemyUnits.filter(u => Math.abs(u.r - target.r) <= 2 && Math.abs(u.c - target.c) <= 2).length
            : 0;
        const hotspotPressure = target?.kind === 'cell'
            ? getHotspotPressure(context, target.r, target.c, 3)
            : 0;
        utility = 9 + localThreat * 2 + hotspotPressure * 0.65;
        safety = 7;
    } else if (actionType === 'pickup_flag') {
        flag = 12;
        utility = 5;
    } else if (actionType === 'drop_flag') {
        const enemyUnits = state.players[enemyId].units.filter(u => !u.isDead);
        const pressure = enemyUnits.filter(u => Math.abs(u.r - unit.r) <= 2 && Math.abs(u.c - unit.c) <= 2).length;
        utility = pressure >= 2 ? 7 : 2;
        safety = pressure >= 2 ? 10 : 3;
    } else if (
        actionType === 'evolve_a' ||
        actionType === 'evolve_a_1' ||
        actionType === 'evolve_a_2' ||
        actionType === 'evolve_b' ||
        actionType === 'evolve_b_1' ||
        actionType === 'evolve_b_2'
    ) {
        const branch = actionType.startsWith('evolve_a') ? 'a' : 'b';
        const currentLevel = state.players[unit.owner].evolutionLevels[unit.type][branch];
        const nextLevel = Math.min(3, currentLevel + 1);

        utility = 7 + nextLevel * 2.2;
        safety = 4.5;

        if (branch === 'a' && unit.type === UnitType.GENERAL) {
            attack += 4.5;
        } else if (branch === 'b' && unit.type === UnitType.GENERAL) {
            flag += 4.5;
        } else if (branch === 'a' && unit.type === UnitType.RANGER) {
            flag += 2.5;
            utility += 1.5;
        } else if (branch === 'b' && unit.type === UnitType.MAKER) {
            utility += 2;
        } else if (branch === 'b' && unit.type === UnitType.DEFUSER) {
            safety += 1.8;
        }

        if (actionType.endsWith('_1') || actionType.endsWith('_2')) {
            utility += 1.2;
        }
    } else if (actionType === 'end_turn') {
        utility = 0.5;
        safety = 1.5;
        energy = 1;
    }

    const reservePenalty = context && energyCost > 0
        ? Math.max(0, context.reserveEnergy - (state.players[unit.owner].energy - energyCost))
        : 0;
    energy = Math.max(0, energy - reservePenalty * 1.6);

    const intentBias = context?.intent
        ? (AI_INTENT_ACTION_BONUS[context.intent][actionType] ?? 0)
        : 0;
    const roleBias = role ? (AI_ROLE_ACTION_BONUS[role][actionType] ?? 0) : 0;

    let opponentBias = 0;
    if (context) {
        if (context.opponentModel.minePressure >= 4.5) {
            if (actionType === 'scan' || actionType === 'sensor_scan' || actionType === 'disarm') opponentBias += 1.8;
            if (actionType === 'place_mine' || actionType === 'place_tower' || actionType === 'move_mine' || actionType === 'convert_mine') opponentBias += 1.1;
        }
        if (context.opponentModel.flagRush >= 4.5) {
            if (actionType === 'attack') opponentBias += 2.3;
            if (actionType === 'move' || actionType === 'teleport') opponentBias += 1.2;
        }
        if (context.opponentModel.aggression >= 5.5) {
            if (actionType === 'end_turn' && context.intent === 'stabilize') opponentBias += 1;
            if (actionType === 'drop_flag') opponentBias += 0.8;
        }
    }

    const targetCell = target?.kind === 'cell'
        ? { r: target.r, c: target.c }
        : target?.kind === 'unit'
            ? { r: target.unit.r, c: target.unit.c }
            : undefined;

    const openingBias = getOpeningActionBias(context, unit, actionType, targetCell, mineType);
    const endgameBias = getEndgameActionBias(state, context, unit, actionType, targetCell);

    const total =
        attack * w.actionDamage +
        flag * w.actionFlagPressure +
        safety * w.actionSafety +
        utility * w.actionUtility +
        energy * 0.6 +
        intentBias +
        roleBias +
        opponentBias +
        openingBias +
        endgameBias;

    return { total, attack, flag, safety, utility, energy };
};
