import { MINE_DAMAGE } from '../constants';
import { calculateAttackDamage } from '../gameEngine';
import { Building, GameState, Mine, MineType, PlayerID, Unit, UnitType } from '../types';
import { AI_BEAM_COUNTER_WEIGHT, AI_BEAM_FOLLOWUP_WEIGHT, AI_BEAM_TOP_ACTIONS } from './config';
import { buildAIPlanningContext } from './context';
import { generateActionCandidatesForUnit, generateUnitCandidates } from './generator';
import { sortActionsByPriority } from './selector';
import {
    AI_TUNING_PROFILES,
    applyTuningToActionCandidates,
    applyTuningToPlanningContext,
    applyTuningToUnitCandidates
} from './tuning';
import { AICandidateAction, AIDifficulty, AITuningProfile } from './types';

const cloneUnit = (unit: Unit): Unit => ({
    ...unit,
    status: { ...unit.status },
    stats: { ...unit.stats },
    carriedMine: unit.carriedMine ? { ...unit.carriedMine } : unit.carriedMine,
    carriedMineRevealed: unit.carriedMineRevealed ?? false
});

const cloneMine = (mine: Mine): Mine => ({
    ...mine,
    revealedTo: [...mine.revealedTo],
    immuneUnitIds: mine.immuneUnitIds ? [...mine.immuneUnitIds] : undefined
});

const cloneBuilding = (building: Building): Building => ({
    ...building
});

const cloneProjectedState = (state: GameState): GameState => ({
    ...state,
    mines: state.mines.map(cloneMine),
    buildings: state.buildings.map(cloneBuilding),
    movements: [...state.movements],
    players: {
        [PlayerID.P1]: {
            ...state.players[PlayerID.P1],
            flagPosition: { ...state.players[PlayerID.P1].flagPosition },
            basePosition: { ...state.players[PlayerID.P1].basePosition },
            units: state.players[PlayerID.P1].units.map(cloneUnit)
        },
        [PlayerID.P2]: {
            ...state.players[PlayerID.P2],
            flagPosition: { ...state.players[PlayerID.P2].flagPosition },
            basePosition: { ...state.players[PlayerID.P2].basePosition },
            units: state.players[PlayerID.P2].units.map(cloneUnit)
        }
    }
});

const opposite = (player: PlayerID) => (player === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1);

const isOccupied = (state: GameState, r: number, c: number, excludedUnitIds: string[] = []) =>
    state.players[PlayerID.P1].units.some(u => !u.isDead && !excludedUnitIds.includes(u.id) && u.r === r && u.c === c) ||
    state.players[PlayerID.P2].units.some(u => !u.isDead && !excludedUnitIds.includes(u.id) && u.r === r && u.c === c);

const toEvolutionSpec = (type: AICandidateAction['type']): { branch: 'a' | 'b'; variant?: 1 | 2 } | null => {
    switch (type) {
        case 'evolve_a':
            return { branch: 'a' };
        case 'evolve_a_1':
            return { branch: 'a', variant: 1 };
        case 'evolve_a_2':
            return { branch: 'a', variant: 2 };
        case 'evolve_b':
            return { branch: 'b' };
        case 'evolve_b_1':
            return { branch: 'b', variant: 1 };
        case 'evolve_b_2':
            return { branch: 'b', variant: 2 };
        default:
            return null;
    }
};

const applyProjectedAction = (
    state: GameState,
    action: AICandidateAction,
    actingPlayer: PlayerID
): GameState => {
    const next = cloneProjectedState(state);
    const owner = next.players[actingPlayer];
    const unit = owner.units.find(u => u.id === action.unitId);
    if (!unit || unit.isDead) return next;

    owner.energy = Math.max(0, owner.energy - action.energyCost);
    unit.energyUsedThisTurn += action.energyCost;
    unit.hasActedThisRound = true;

    if (action.type === 'move' && action.target?.kind === 'cell') {
        unit.r = action.target.r;
        unit.c = action.target.c;
        if (unit.hasFlag) {
            next.players[actingPlayer].flagPosition = { r: action.target.r, c: action.target.c };
        }
        return next;
    }

    if (action.type === 'attack' && action.target?.kind === 'unit') {
        const targetRef = action.target;
        const targetOwner = opposite(actingPlayer);
        const target = next.players[targetOwner].units.find(u => u.id === targetRef.unit.id);
        if (!target || target.isDead) return next;

        const { damage } = calculateAttackDamage(
            unit,
            target,
            next.players[actingPlayer],
            next.players[targetOwner],
            false
        );
        target.hp = Math.max(0, target.hp - damage);
        if (target.hp <= 0) {
            const droppedFlagPos = target.hasFlag ? { r: target.r, c: target.c } : null;
            target.isDead = true;
            target.hasFlag = false;
            if (droppedFlagPos) {
                next.players[targetOwner].flagPosition = droppedFlagPos;
            }
        }
        return next;
    }

    if (action.type === 'place_mine' && action.target?.kind === 'cell') {
        const targetCell = action.target;
        const hasMine = next.mines.some(m => m.r === targetCell.r && m.c === targetCell.c);
        if (!hasMine) {
            next.mines.push({
                id: `sim-${unit.id}-${targetCell.r}-${targetCell.c}-${action.mineType ?? MineType.NORMAL}`,
                type: action.mineType ?? MineType.NORMAL,
                owner: actingPlayer,
                r: targetCell.r,
                c: targetCell.c,
                revealedTo: [actingPlayer]
            });
        }
        return next;
    }

    if (action.type === 'place_tower') {
        const sweeperLevels = next.players[actingPlayer].evolutionLevels[UnitType.MINESWEEPER];
        const towerLimit = (sweeperLevels.a === 3 && sweeperLevels.aVariant === 1) ? 2 : 1;
        const existingTowers = next.buildings.filter(b => b.owner === actingPlayer && b.type === 'tower');
        let filteredBuildings = next.buildings;
        if (existingTowers.length >= towerLimit) {
            const toRemove = existingTowers[0];
            filteredBuildings = filteredBuildings.filter(b => b.id !== toRemove.id);
        }

        next.buildings = [...filteredBuildings, {
            id: `sim-tower-${unit.id}-${next.turnCount}`,
            type: 'tower',
            owner: actingPlayer,
            r: unit.r,
            c: unit.c,
            level: sweeperLevels.a || 1,
            duration: sweeperLevels.a >= 2 ? undefined : 2
        }];
        return next;
    }

    if (action.type === 'place_factory') {
        const makerLevels = next.players[actingPlayer].evolutionLevels[UnitType.MAKER];
        const factoryLimit = (makerLevels.b === 3 && makerLevels.bVariant === 2) ? 2 : 1;
        const existingFactories = next.buildings.filter(b => b.owner === actingPlayer && b.type === 'factory');
        let filteredBuildings = next.buildings;
        if (existingFactories.length >= factoryLimit) {
            const toRemove = existingFactories[0];
            filteredBuildings = filteredBuildings.filter(b => b.id !== toRemove.id);
        }

        next.buildings = [...filteredBuildings, {
            id: `sim-factory-${unit.id}-${next.turnCount}`,
            type: 'factory',
            owner: actingPlayer,
            r: unit.r,
            c: unit.c,
            level: makerLevels.b || 1
        }];
        return next;
    }

    if (action.type === 'place_hub') {
        next.buildings = next.buildings.filter(b => !(b.owner === actingPlayer && b.type === 'hub'));
        next.buildings.push({
            id: `sim-hub-${unit.id}-${next.turnCount}`,
            type: 'hub',
            owner: actingPlayer,
            r: unit.r,
            c: unit.c,
            level: next.players[actingPlayer].evolutionLevels[unit.type].a || 1
        });
        return next;
    }

    if (action.type === 'teleport') {
        const rangerLevels = next.players[actingPlayer].evolutionLevels[UnitType.RANGER];
        const allowOthersTeleport = rangerLevels.a === 3 && rangerLevels.aVariant === 2;
        const allowRangerTeleport = unit.type === UnitType.RANGER && rangerLevels.a >= 2;
        if (!allowOthersTeleport && !allowRangerTeleport) return next;

        const hub = next.buildings.find(b => b.owner === actingPlayer && b.type === 'hub');
        if (!hub) return next;
        const blocked = isOccupied(next, hub.r, hub.c, [unit.id]);
        if (blocked) return next;
        unit.r = hub.r;
        unit.c = hub.c;
        if (unit.hasFlag) {
            next.players[actingPlayer].flagPosition = { r: hub.r, c: hub.c };
        }
        if (unit.type === UnitType.RANGER && !(rangerLevels.a === 3 && rangerLevels.aVariant === 2)) {
            next.buildings = next.buildings.filter(b => b.id !== hub.id);
        }
        return next;
    }

    if (action.type === 'detonate_tower') {
        const towers = next.buildings.filter(b => b.owner === actingPlayer && b.type === 'tower');
        if (towers.length === 0) return next;
        const enemy = opposite(actingPlayer);
        next.mines = next.mines.filter(m =>
            !(m.owner === enemy && towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1))
        );
        next.players[enemy].units = next.players[enemy].units.map(u => {
            if (u.isDead) return u;
            const inRange = towers.some(t => Math.abs(u.r - t.r) <= 1 && Math.abs(u.c - t.c) <= 1);
            if (!inRange) return u;
            const newHp = Math.max(0, u.hp - 3);
            return { ...u, hp: newHp, isDead: newHp === 0 };
        });
        next.buildings = next.buildings.filter(b => !(b.owner === actingPlayer && b.type === 'tower'));
        return next;
    }

    if (action.type === 'throw_mine' && action.target?.kind === 'cell') {
        const targetCell = action.target;
        const enemy = opposite(actingPlayer);
        const target = next.players[enemy].units.find(u => !u.isDead && u.r === targetCell.r && u.c === targetCell.c);
        if (!target) return next;
        const newHp = Math.max(0, target.hp - MINE_DAMAGE);
        target.hp = newHp;
        target.isDead = newHp === 0;
        unit.carriedMine = null;
        return next;
    }

    if (action.type === 'pickup_mine' && action.target?.kind === 'cell') {
        const targetCell = action.target;
        if (unit.carriedMine) return next;
        const mineIdx = next.mines.findIndex(m => m.r === targetCell.r && m.c === targetCell.c);
        if (mineIdx === -1) return next;
        const mine = next.mines[mineIdx];
        unit.carriedMine = { ...mine };
        next.mines.splice(mineIdx, 1);
        return next;
    }

    if (action.type === 'drop_mine') {
        if (!unit.carriedMine) return next;
        if (!isOccupied(next, unit.r, unit.c, [unit.id]) && !next.cells[unit.r][unit.c].isObstacle) {
            next.mines.push({
                id: `sim-drop-${unit.id}-${unit.r}-${unit.c}`,
                type: unit.carriedMine.type,
                owner: actingPlayer,
                r: unit.r,
                c: unit.c,
                revealedTo: [actingPlayer]
            });
            unit.carriedMine = null;
        }
        return next;
    }

    if (action.type === 'move_mine' && action.sourceCell && action.target?.kind === 'cell') {
        const sourceCell = action.sourceCell;
        const targetCell = action.target;
        const mineIdx = next.mines.findIndex(m =>
            m.owner !== actingPlayer &&
            m.r === sourceCell.r &&
            m.c === sourceCell.c
        );
        if (mineIdx === -1) return next;

        const defLevels = next.players[actingPlayer].evolutionLevels[UnitType.DEFUSER];
        const variantDamage = defLevels.b === 3 && defLevels.bVariant === 2;
        const enemy = opposite(actingPlayer);
        const enemyAtTarget = next.players[enemy].units.find(u => !u.isDead && u.r === targetCell.r && u.c === targetCell.c);
        if (variantDamage && enemyAtTarget) {
            const damage = Math.floor(MINE_DAMAGE * 0.4);
            const newHp = Math.max(0, enemyAtTarget.hp - damage);
            enemyAtTarget.hp = newHp;
            enemyAtTarget.isDead = newHp === 0;
            next.mines.splice(mineIdx, 1);
            return next;
        }

        next.mines[mineIdx] = {
            ...next.mines[mineIdx],
            r: targetCell.r,
            c: targetCell.c
        };
        return next;
    }

    if (action.type === 'convert_mine' && action.target?.kind === 'cell') {
        const targetCell = action.target;
        const mineIdx = next.mines.findIndex(m =>
            m.owner !== actingPlayer &&
            m.r === targetCell.r &&
            m.c === targetCell.c
        );
        if (mineIdx === -1) return next;
        next.mines[mineIdx] = {
            ...next.mines[mineIdx],
            owner: actingPlayer,
            revealedTo: [actingPlayer],
            isConverted: true
        };
        return next;
    }

    if (action.type === 'disarm' && action.target?.kind === 'cell') {
        const targetCell = action.target;
        const enemy = opposite(actingPlayer);
        next.mines = next.mines.filter(m => !(m.owner === enemy && m.r === targetCell.r && m.c === targetCell.c));
        return next;
    }

    if (action.type === 'pickup_flag') {
        unit.hasFlag = true;
        return next;
    }

    if (action.type === 'drop_flag') {
        unit.hasFlag = false;
        next.players[actingPlayer].flagPosition = { r: unit.r, c: unit.c };
        return next;
    }

    const evolution = toEvolutionSpec(action.type);
    if (evolution) {
        const levels = owner.evolutionLevels[unit.type];
        const current = levels[evolution.branch];
        const nextLevel = Math.min(3, current + 1);
        const variantKey = (evolution.branch === 'a' ? 'aVariant' : 'bVariant') as 'aVariant' | 'bVariant';
        owner.evolutionLevels = {
            ...owner.evolutionLevels,
            [unit.type]: {
                ...levels,
                [evolution.branch]: nextLevel,
                [variantKey]: evolution.variant ?? levels[variantKey]
            }
        };
        return next;
    }

    return next;
};

const getBestActionScore = (
    state: GameState,
    difficulty: AIDifficulty,
    aiPlayer: PlayerID,
    tuningProfile: AITuningProfile
) => {
    const baseContext = buildAIPlanningContext(state, difficulty, aiPlayer, undefined, null, tuningProfile);
    const context = applyTuningToPlanningContext(baseContext, tuningProfile);
    const baseUnitCandidates = generateUnitCandidates(state, difficulty, context, aiPlayer);
    const unitCandidates = applyTuningToUnitCandidates(baseUnitCandidates, tuningProfile);
    const bestUnit = unitCandidates.sort((a, b) => b.score - a.score)[0];
    if (!bestUnit) return { score: 0, action: null as AICandidateAction | null };

    const baseActions = generateActionCandidatesForUnit(state, bestUnit.unit, difficulty, context);
    const actions = sortActionsByPriority(applyTuningToActionCandidates(baseActions, tuningProfile));
    const bestAction = actions[0] ?? null;
    return { score: bestAction?.score ?? 0, action: bestAction };
};

export const rerankActionsWithBeamLookahead = (
    state: GameState,
    actions: AICandidateAction[],
    difficulty: AIDifficulty,
    aiPlayer: PlayerID = PlayerID.P2,
    tuningProfile: AITuningProfile = 'balanced'
): AICandidateAction[] => {
    const beamCount = AI_BEAM_TOP_ACTIONS[difficulty];
    if (beamCount <= 1 || actions.length <= 1) return actions;

    const enemyPlayer = opposite(aiPlayer);
    const tuning = AI_TUNING_PROFILES[tuningProfile];
    const counterWeight = AI_BEAM_COUNTER_WEIGHT[difficulty] * tuning.lookaheadCounterMultiplier;
    const followWeight = AI_BEAM_FOLLOWUP_WEIGHT[difficulty] * tuning.lookaheadFollowupMultiplier;

    const top = actions.slice(0, beamCount).map(action => {
        const afterOwn = applyProjectedAction(state, action, aiPlayer);

        const enemyBest = getBestActionScore(afterOwn, difficulty, enemyPlayer, tuningProfile);
        const afterEnemy = enemyBest.action ? applyProjectedAction(afterOwn, enemyBest.action, enemyPlayer) : afterOwn;

        const ownFollow = getBestActionScore(afterEnemy, difficulty, aiPlayer, tuningProfile);
        const lookaheadScore = action.score - enemyBest.score * counterWeight + ownFollow.score * followWeight;

        return { ...action, lookaheadScore };
    });

    const rest = actions.slice(beamCount);
    return [...top, ...rest].sort((a, b) => {
        const bScore = b.lookaheadScore ?? b.score;
        const aScore = a.lookaheadScore ?? a.score;
        if (bScore !== aScore) return bScore - aScore;
        return b.score - a.score;
    });
};
