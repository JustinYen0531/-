import { EVOLUTION_CONFIG, EVOLUTION_COSTS, GRID_COLS, GRID_ROWS, MAX_MINES_ON_BOARD, UNIT_STATS } from '../constants';
import { getDisplayCost, getEnemyTerritoryEnergyCost, getMineBaseCost } from '../gameHelpers';
import { checkEnergyCap as engineCheckEnergyCap } from '../gameEngine';
import { GameState, PlayerID, Unit, UnitType, MineType } from '../types';
import { AI_DIFFICULTY_WEIGHTS } from './config';
import { canGeneralAttack, evaluateActionCandidate, evaluateTargetCellRisk, evaluateUnitPriorityWithContext } from './evaluator';
import { AICandidateAction, AICandidateUnit, AIDifficulty, AIPlanningContext } from './types';

const dirs = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);
const inBounds = (r: number, c: number) => r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;

export const generateUnitCandidates = (
    state: GameState,
    difficulty: AIDifficulty,
    context?: AIPlanningContext,
    aiPlayer: PlayerID = PlayerID.P2
): AICandidateUnit[] => {
    const units = state.players[aiPlayer].units.filter(u => !u.isDead && !u.hasActedThisRound);
    const jitter = AI_DIFFICULTY_WEIGHTS[difficulty].randomJitter;

    return units.map(unit => {
        const scoreBreakdown = evaluateUnitPriorityWithContext(state, unit, difficulty, context);
        const score = scoreBreakdown.total + (Math.random() * jitter - jitter / 2);
        return { unit, score, scoreBreakdown: { ...scoreBreakdown, total: score } };
    });
};

const canOccupy = (state: GameState, r: number, c: number) => {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return false;
    if (state.cells[r][c].isObstacle) return false;
    const occupied =
        state.players[PlayerID.P1].units.some(u => !u.isDead && u.r === r && u.c === c) ||
        state.players[PlayerID.P2].units.some(u => !u.isDead && u.r === r && u.c === c);
    return !occupied;
};

const getEvolutionProgressValue = (
    state: GameState,
    unitType: UnitType,
    branch: 'a' | 'b',
    owner: PlayerID
) => {
    const questStats = state.players[owner].questStats;
    if (unitType === UnitType.GENERAL) {
        return branch === 'a' ? questStats.generalDamage : questStats.generalFlagSteps;
    }
    if (unitType === UnitType.MINESWEEPER) {
        return branch === 'a' ? questStats.sweeperMinesMarked : questStats.consecutiveSafeRounds;
    }
    if (unitType === UnitType.RANGER) {
        return branch === 'a' ? questStats.rangerSteps : questStats.rangerMinesMoved;
    }
    if (unitType === UnitType.MAKER) {
        return branch === 'a' ? questStats.makerMinesTriggeredByEnemy : questStats.makerMinesPlaced;
    }
    return branch === 'a' ? questStats.defuserMinesSoaked : questStats.defuserMinesDisarmed;
};

export const generateActionCandidatesForUnit = (
    state: GameState,
    unit: Unit,
    difficulty: AIDifficulty,
    context?: AIPlanningContext
): AICandidateAction[] => {
    const actions: AICandidateAction[] = [];
    const player = state.players[unit.owner];
    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const enemy = state.players[enemyId];

    // Move
    const baseMoveCost = UNIT_STATS[unit.type].moveCost;
    const moveCost = getDisplayCost(unit, baseMoveCost, state);
    if (player.energy >= moveCost && engineCheckEnergyCap(unit, moveCost)) {
        const moveCandidates: AICandidateAction[] = [];
        dirs.forEach(dir => {
            const nr = unit.r + dir.r;
            const nc = unit.c + dir.c;
            if (!canOccupy(state, nr, nc)) return;
            if (evaluateTargetCellRisk(state, unit, nr, nc, context?.threatMap) >= 999) return;
            const target = { kind: 'cell' as const, r: nr, c: nc };
            const scoreBreakdown = evaluateActionCandidate(state, unit, 'move', target, difficulty, moveCost, undefined, context);
            moveCandidates.push({
                unitId: unit.id,
                type: 'move',
                target,
                energyCost: moveCost,
                score: scoreBreakdown.total,
                scoreBreakdown
            });
        });
        moveCandidates.sort((a, b) => b.score - a.score);
        actions.push(...moveCandidates.slice(0, 4));
    }

    // Attack (General only)
    if (unit.type === UnitType.GENERAL) {
        const genLevels = player.evolutionLevels[UnitType.GENERAL];
        const attackBaseCost = (unit.hasFlag && genLevels.a >= 3 && genLevels.aVariant === 1)
            ? 6
            : UNIT_STATS[UnitType.GENERAL].attackCost;
        const atkCost = getEnemyTerritoryEnergyCost(unit, attackBaseCost);
        enemy.units.filter(u => !u.isDead).forEach(targetUnit => {
            if (!canGeneralAttack(unit, targetUnit, state)) return;
            const target = { kind: 'unit' as const, unit: targetUnit };
            const scoreBreakdown = evaluateActionCandidate(state, unit, 'attack', target, difficulty, atkCost, undefined, context);
            actions.push({
                unitId: unit.id,
                type: 'attack',
                target,
                energyCost: atkCost,
                score: scoreBreakdown.total,
                scoreBreakdown
            });
        });
    }

    // Scan (Sweeper)
    if (unit.type === UnitType.MINESWEEPER) {
        const scanBaseCost = (player.questStats.sweeperScansThisRound || 0) >= 2 ? 4 : 3;
        const scanCost = getEnemyTerritoryEnergyCost(unit, scanBaseCost);
        const scanTargets: Array<{ r: number; c: number }> = [];
        scanTargets.push({ r: enemy.flagPosition.r, c: enemy.flagPosition.c });
        enemy.units.filter(u => !u.isDead).forEach(u => {
            scanTargets.push({ r: u.r, c: u.c });
            dirs.forEach(dir => scanTargets.push({ r: u.r + dir.r, c: u.c + dir.c }));
        });

        if (player.energy >= scanCost && engineCheckEnergyCap(unit, scanCost)) {
            const seen = new Set<string>();
            const scanCandidates: AICandidateAction[] = [];
            scanTargets.forEach(({ r, c }) => {
                if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;
                if (state.cells[r][c].isObstacle) return;
                const key = `${r},${c}`;
                if (seen.has(key)) return;
                seen.add(key);
                const target = { kind: 'cell' as const, r, c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'scan', target, difficulty, scanCost, undefined, context);
                scanCandidates.push({
                    unitId: unit.id,
                    type: 'scan',
                    target,
                    energyCost: scanCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            });
            scanCandidates.sort((a, b) => b.score - a.score);
            actions.push(...scanCandidates.slice(0, 2));
        }

        const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
        if (swpLevelB >= 1) {
            const sensorCost = swpLevelB >= 3 ? 4 : 5;
            if (player.energy >= sensorCost && engineCheckEnergyCap(unit, sensorCost)) {
                const sensorSeen = new Set<string>();
                const sensorCandidates: AICandidateAction[] = [];

                [...scanTargets, { r: unit.r, c: unit.c }].forEach(({ r, c }) => {
                    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;
                    if (state.cells[r][c].isObstacle) return;
                    const key = `${r},${c}`;
                    if (sensorSeen.has(key)) return;
                    sensorSeen.add(key);
                    const target = { kind: 'cell' as const, r, c };
                    const scoreBreakdown = evaluateActionCandidate(state, unit, 'sensor_scan', target, difficulty, sensorCost, undefined, context);
                    sensorCandidates.push({
                        unitId: unit.id,
                        type: 'sensor_scan',
                        target,
                        energyCost: sensorCost,
                        score: scoreBreakdown.total,
                        scoreBreakdown
                    });
                });
                sensorCandidates.sort((a, b) => b.score - a.score);
                actions.push(...sensorCandidates.slice(0, 2));
            }
        }
    }

    // Place Mine (Maker) - simple adjacency target
    if (unit.type === UnitType.MAKER) {
        const mkrLevelA = player.evolutionLevels[UnitType.MAKER].a;
        const mkrVariantA = player.evolutionLevels[UnitType.MAKER].aVariant;
        const availableTypes = [
            { type: MineType.NORMAL, ok: true },
            { type: MineType.SLOW, ok: mkrLevelA >= 1 },
            { type: MineType.SMOKE, ok: mkrLevelA >= 2 },
            { type: MineType.CHAIN, ok: mkrLevelA >= 3 && mkrVariantA === 1 },
            { type: MineType.NUKE, ok: mkrLevelA >= 3 && mkrVariantA === 2 }
        ].filter(t => t.ok).map(t => t.type);

        const mineCandidates: AICandidateAction[] = [];
        for (const dir of dirs) {
            const nr = unit.r + dir.r;
            const nc = unit.c + dir.c;
            if (!canOccupy(state, nr, nc)) continue;
            const ownMineInCell = state.mines.some(m => m.r === nr && m.c === nc && m.owner === unit.owner);
            const revealedEnemyMineInCell = state.mines.some(m =>
                m.r === nr &&
                m.c === nc &&
                m.owner !== unit.owner &&
                m.revealedTo.includes(unit.owner)
            );
            if (ownMineInCell || revealedEnemyMineInCell) continue;
            const target = { kind: 'cell' as const, r: nr, c: nc };
            for (const type of availableTypes) {
                const costBase = getMineBaseCost(type);
                const mineCost = getEnemyTerritoryEnergyCost(unit, costBase);
                if (player.energy < mineCost || !engineCheckEnergyCap(unit, mineCost)) continue;
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'place_mine', target, difficulty, mineCost, type, context);
                mineCandidates.push({
                    unitId: unit.id,
                    type: 'place_mine',
                    target,
                    mineType: type,
                    energyCost: mineCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }
        mineCandidates.sort((a, b) => b.score - a.score);
        actions.push(...mineCandidates.slice(0, 2));
    }

    // Disarm (Defuser) - nearby enemy mines only
    if (unit.type === UnitType.DEFUSER) {
        const disarmBaseCost = UNIT_STATS[UnitType.DEFUSER].disarmCost;
        const disarmCost = getEnemyTerritoryEnergyCost(unit, disarmBaseCost);
        if (player.energy >= disarmCost && engineCheckEnergyCap(unit, disarmCost)) {
            const disarmCandidates: AICandidateAction[] = [];
            state.mines
                .filter(m => m.owner !== unit.owner && Math.abs(m.r - unit.r) <= 1 && Math.abs(m.c - unit.c) <= 1)
                .forEach(m => {
                    const target = { kind: 'cell' as const, r: m.r, c: m.c };
                    const scoreBreakdown = evaluateActionCandidate(state, unit, 'disarm', target, difficulty, disarmCost, undefined, context);
                    disarmCandidates.push({
                        unitId: unit.id,
                        type: 'disarm',
                        target,
                        energyCost: disarmCost,
                        score: scoreBreakdown.total,
                        scoreBreakdown
                    });
                });
            disarmCandidates.sort((a, b) => b.score - a.score);
            actions.push(...disarmCandidates.slice(0, 2));
        }
    }

    // Advanced skills coverage
    if (unit.type === UnitType.MINESWEEPER) {
        const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
        const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
        const towerLimit = (swpLevelA === 3 && swpVariantA === 1) ? 2 : 1;
        const ownTowers = state.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
        const hasOwnTowerOnCell = ownTowers.some(t => t.r === unit.r && t.c === unit.c);

        if (swpLevelA >= 1 && ownTowers.length < towerLimit && !hasOwnTowerOnCell) {
            const towerBaseCost = (swpLevelA === 3 && swpVariantA === 1) ? 5 : 6;
            const towerCost = getEnemyTerritoryEnergyCost(unit, towerBaseCost);
            if (player.energy >= towerCost && engineCheckEnergyCap(unit, towerCost)) {
                const target = { kind: 'cell' as const, r: unit.r, c: unit.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'place_tower', target, difficulty, towerCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'place_tower',
                    target,
                    energyCost: towerCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }

        if (swpLevelA === 3 && swpVariantA === 2) {
            const hasTower = state.buildings.some(b => b.owner === unit.owner && b.type === 'tower');
            const hasEnemyMineInTowerRange = state.mines.some(m =>
                m.owner !== unit.owner &&
                state.buildings.some(t => t.owner === unit.owner && t.type === 'tower' && Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
            );
            const detonateCost = 2;
            if (hasTower && hasEnemyMineInTowerRange && player.energy >= detonateCost && engineCheckEnergyCap(unit, detonateCost)) {
                const target = { kind: 'cell' as const, r: unit.r, c: unit.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'detonate_tower', target, difficulty, detonateCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'detonate_tower',
                    target,
                    energyCost: detonateCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }
    }

    if (unit.type === UnitType.MAKER) {
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;
        const factoryLimit = (mkrLevelB === 3 && mkrVariantB === 2) ? 2 : 1;
        const ownFactories = state.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const hasOwnFactoryOnCell = ownFactories.some(f => f.r === unit.r && f.c === unit.c);
        if (mkrLevelB >= 1) {
            const factoryCost = getEnemyTerritoryEnergyCost(unit, 6);
            if (
                ownFactories.length < factoryLimit &&
                !hasOwnFactoryOnCell &&
                player.energy >= factoryCost &&
                engineCheckEnergyCap(unit, factoryCost)
            ) {
                const target = { kind: 'cell' as const, r: unit.r, c: unit.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'place_factory', target, difficulty, factoryCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'place_factory',
                    target,
                    energyCost: factoryCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }
    }

    if (unit.type === UnitType.RANGER) {
        const rngLevelA = player.evolutionLevels[UnitType.RANGER].a;
        const rngVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
        const rngVariantB = player.evolutionLevels[UnitType.RANGER].bVariant;
        const ownHub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');

        if (rngLevelA >= 1) {
            const hubCost = getDisplayCost(unit, 4, state, 'place_hub');
            if (!ownHub && player.energy >= hubCost && engineCheckEnergyCap(unit, hubCost)) {
                const target = { kind: 'cell' as const, r: unit.r, c: unit.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'place_hub', target, difficulty, hubCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'place_hub',
                    target,
                    energyCost: hubCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }

        const canTeleport = rngLevelA >= 2 && !!ownHub;
        if (canTeleport && ownHub) {
            const teleportCost = (rngLevelA === 3 && rngVariantA === 2) ? 3 : 0;

            const blocked = state.players[PlayerID.P1].units.concat(state.players[PlayerID.P2].units).some(u =>
                !u.isDead && u.id !== unit.id && u.r === ownHub.r && u.c === ownHub.c
            );
            if (!blocked && player.energy >= teleportCost && engineCheckEnergyCap(unit, teleportCost)) {
                const target = { kind: 'cell' as const, r: ownHub.r, c: ownHub.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'teleport', target, difficulty, teleportCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'teleport',
                    target,
                    energyCost: teleportCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }

        if (!unit.carriedMine) {
            const pickupRange = rngLevelB >= 1 ? 2 : 0;
            const pickupCandidates: AICandidateAction[] = [];
            state.mines
                .filter(m => manhattan(unit.r, unit.c, m.r, m.c) <= pickupRange && (m.owner === unit.owner || m.revealedTo.includes(unit.owner)))
                .forEach((m) => {
                    const target = { kind: 'cell' as const, r: m.r, c: m.c };
                    const scoreBreakdown = evaluateActionCandidate(state, unit, 'pickup_mine', target, difficulty, 0, undefined, context);
                    pickupCandidates.push({
                        unitId: unit.id,
                        type: 'pickup_mine',
                        target,
                        energyCost: 0,
                        score: scoreBreakdown.total,
                        scoreBreakdown
                    });
                });
            pickupCandidates.sort((a, b) => b.score - a.score);
            actions.push(...pickupCandidates.slice(0, 3));
        } else {
            const hasMineAtCell = state.mines.some(m => m.r === unit.r && m.c === unit.c);
            if (!hasMineAtCell && !state.cells[unit.r][unit.c].isObstacle && state.mines.filter(m => m.owner === unit.owner).length < MAX_MINES_ON_BOARD) {
                const target = { kind: 'cell' as const, r: unit.r, c: unit.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'drop_mine', target, difficulty, 0, unit.carriedMine.type, context);
                actions.push({
                    unitId: unit.id,
                    type: 'drop_mine',
                    target,
                    energyCost: 0,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }

            if (rngLevelB === 3 && rngVariantB === 2) {
                const throwCost = getEnemyTerritoryEnergyCost(unit, 5);
                if (player.energy >= throwCost && engineCheckEnergyCap(unit, throwCost)) {
                    const throwCandidates: AICandidateAction[] = [];
                    for (let rr = unit.r - 2; rr <= unit.r + 2; rr += 1) {
                        for (let cc = unit.c - 2; cc <= unit.c + 2; cc += 1) {
                            if (!inBounds(rr, cc)) continue;
                            if (manhattan(unit.r, unit.c, rr, cc) > 2) continue;
                            const hasEnemyUnit = state.players[enemyId].units.some(u => !u.isDead && u.r === rr && u.c === cc);
                            const hasMine = state.mines.some(m => m.r === rr && m.c === cc);
                            if (!hasEnemyUnit && hasMine) continue;
                            const target = { kind: 'cell' as const, r: rr, c: cc };
                            const scoreBreakdown = evaluateActionCandidate(state, unit, 'throw_mine', target, difficulty, throwCost, unit.carriedMine.type, context);
                            throwCandidates.push({
                                unitId: unit.id,
                                type: 'throw_mine',
                                target,
                                energyCost: throwCost,
                                score: scoreBreakdown.total,
                                scoreBreakdown
                            });
                        }
                    }
                    throwCandidates.sort((a, b) => b.score - a.score);
                    actions.push(...throwCandidates.slice(0, 5));
                }
            }
        }
    }

    if (unit.type !== UnitType.RANGER) {
        const rngLevelA = player.evolutionLevels[UnitType.RANGER].a;
        const rngVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
        const hub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        const canTeleport = rngLevelA === 3 && rngVariantA === 2 && !!hub;
        const teleportCost = 5;

        if (canTeleport && hub && player.energy >= teleportCost && engineCheckEnergyCap(unit, teleportCost)) {
            const blocked = state.players[PlayerID.P1].units.concat(state.players[PlayerID.P2].units).some(u =>
                !u.isDead && u.id !== unit.id && u.r === hub.r && u.c === hub.c
            );

            if (!blocked) {
                const target = { kind: 'cell' as const, r: hub.r, c: hub.c };
                const scoreBreakdown = evaluateActionCandidate(state, unit, 'teleport', target, difficulty, teleportCost, undefined, context);
                actions.push({
                    unitId: unit.id,
                    type: 'teleport',
                    target,
                    energyCost: teleportCost,
                    score: scoreBreakdown.total,
                    scoreBreakdown
                });
            }
        }
    }

    if (unit.type === UnitType.DEFUSER) {
        const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
        const defVariantB = player.evolutionLevels[UnitType.DEFUSER].bVariant;

        if (defLevelB >= 2) {
            const moveMineCost = (defLevelB === 3 && defVariantB === 2) ? 5 : 2;
            if (player.energy >= moveMineCost && engineCheckEnergyCap(unit, moveMineCost)) {
                const moveMineCandidates: AICandidateAction[] = [];
                const movableEnemyMines = state.mines.filter(m => m.owner !== unit.owner && manhattan(unit.r, unit.c, m.r, m.c) <= 2);
                movableEnemyMines.forEach((m) => {
                    for (let rr = unit.r - 2; rr <= unit.r + 2; rr += 1) {
                        for (let cc = unit.c - 2; cc <= unit.c + 2; cc += 1) {
                            if (!inBounds(rr, cc)) continue;
                            if (manhattan(unit.r, unit.c, rr, cc) > 2) continue;
                            if (rr === m.r && cc === m.c) continue;
                            const target = { kind: 'cell' as const, r: rr, c: cc };
                            const scoreBreakdown = evaluateActionCandidate(state, unit, 'move_mine', target, difficulty, moveMineCost, undefined, context);
                            moveMineCandidates.push({
                                unitId: unit.id,
                                type: 'move_mine',
                                sourceCell: { r: m.r, c: m.c },
                                target,
                                energyCost: moveMineCost,
                                score: scoreBreakdown.total,
                                scoreBreakdown
                            });
                        }
                    }
                });
                moveMineCandidates.sort((a, b) => b.score - a.score);
                actions.push(...moveMineCandidates.slice(0, 8));
            }
        }

        if (defLevelB === 3 && defVariantB === 1) {
            const convertCost = 5;
            const ownMinesCount = state.mines.filter(m => m.owner === unit.owner).length;
            if (ownMinesCount < 6 && player.energy >= convertCost && engineCheckEnergyCap(unit, convertCost)) {
                const convertCandidates: AICandidateAction[] = [];
                state.mines
                    .filter(m => m.owner !== unit.owner && manhattan(unit.r, unit.c, m.r, m.c) <= 2)
                    .forEach((m) => {
                        const target = { kind: 'cell' as const, r: m.r, c: m.c };
                        const scoreBreakdown = evaluateActionCandidate(state, unit, 'convert_mine', target, difficulty, convertCost, undefined, context);
                        convertCandidates.push({
                            unitId: unit.id,
                            type: 'convert_mine',
                            target,
                            energyCost: convertCost,
                            score: scoreBreakdown.total,
                            scoreBreakdown
                        });
                    });
                convertCandidates.sort((a, b) => b.score - a.score);
                actions.push(...convertCandidates.slice(0, 4));
            }
        }
    }

    // Evolution actions (same unlock rule as keyboard evolution buttons)
    const levelA = player.evolutionLevels[unit.type].a;
    const levelB = player.evolutionLevels[unit.type].b;
    const variantA = player.evolutionLevels[unit.type].aVariant;
    const variantB = player.evolutionLevels[unit.type].bVariant;
    const thresholdA = EVOLUTION_CONFIG[unit.type].a.thresholds[levelA];
    const thresholdB = EVOLUTION_CONFIG[unit.type].b.thresholds[levelB];
    const progressA = getEvolutionProgressValue(state, unit.type, 'a', unit.owner);
    const progressB = getEvolutionProgressValue(state, unit.type, 'b', unit.owner);
    const costA = EVOLUTION_COSTS[levelA as keyof typeof EVOLUTION_COSTS];
    const costB = EVOLUTION_COSTS[levelB as keyof typeof EVOLUTION_COSTS];
    const canEvolveA = levelA < 3 && typeof thresholdA === 'number' && typeof costA === 'number' && player.energy >= costA && progressA >= thresholdA;
    const canEvolveB = levelB < 3 && typeof thresholdB === 'number' && typeof costB === 'number' && player.energy >= costB && progressB >= thresholdB;

    if (canEvolveA && typeof costA === 'number') {
        const actionsA = levelA === 2 && !variantA ? (['evolve_a_1', 'evolve_a_2'] as const) : (['evolve_a'] as const);
        actionsA.forEach((actionType) => {
            const scoreBreakdown = evaluateActionCandidate(state, unit, actionType, undefined, difficulty, costA, undefined, context);
            actions.push({
                unitId: unit.id,
                type: actionType,
                energyCost: costA,
                score: scoreBreakdown.total,
                scoreBreakdown
            });
        });
    }

    if (canEvolveB && typeof costB === 'number') {
        const actionsB = levelB === 2 && !variantB ? (['evolve_b_1', 'evolve_b_2'] as const) : (['evolve_b'] as const);
        actionsB.forEach((actionType) => {
            const scoreBreakdown = evaluateActionCandidate(state, unit, actionType, undefined, difficulty, costB, undefined, context);
            actions.push({
                unitId: unit.id,
                type: actionType,
                energyCost: costB,
                score: scoreBreakdown.total,
                scoreBreakdown
            });
        });
    }

    // Flag interactions
    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
    const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
    const atOwnFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
    if (canCarryFlag && !unit.hasFlag && atOwnFlag) {
        const scoreBreakdown = evaluateActionCandidate(state, unit, 'pickup_flag', undefined, difficulty, 0, undefined, context);
        actions.push({
            unitId: unit.id,
            type: 'pickup_flag',
            energyCost: 0,
            score: scoreBreakdown.total,
            scoreBreakdown
        });
    }
    if (unit.hasFlag) {
        const scoreBreakdown = evaluateActionCandidate(state, unit, 'drop_flag', undefined, difficulty, 0, undefined, context);
        actions.push({
            unitId: unit.id,
            type: 'drop_flag',
            energyCost: 0,
            score: scoreBreakdown.total,
            scoreBreakdown
        });
    }

    const endTurnBreakdown = evaluateActionCandidate(state, unit, 'end_turn', undefined, difficulty, 0, undefined, context);
    actions.push({
        unitId: unit.id,
        type: 'end_turn',
        energyCost: 0,
        score: endTurnBreakdown.total,
        scoreBreakdown: endTurnBreakdown
    });

    return actions;
};
