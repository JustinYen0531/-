import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../gameInit';
import { Building, EvolutionLevels, GameState, Mine, MineType, PlayerID, Unit, UnitType } from '../../types';
import { buildAIPlanningContext } from '../context';
import { collectRejectionSummary, summarizeRejectedReasonBuckets } from '../diagnostics';
import { evaluateActionCandidate } from '../evaluator';
import { generateActionCandidatesForUnit, generateUnitCandidates } from '../generator';
import { rerankActionsWithBeamLookahead } from '../lookahead';
import { selectBestUnit, sortActionsByPriority } from '../selector';
import { applyTuningToActionCandidates, applyTuningToPlanningContext, applyTuningToUnitCandidates } from '../tuning';

const applyCommonUnitReset = (unit: Unit) => {
    unit.hasActedThisRound = false;
    unit.energyUsedThisTurn = 0;
    unit.startOfActionEnergy = 80;
    unit.hp = unit.maxHp;
    unit.hasFlag = false;
    unit.isDead = false;
    unit.carriedMine = null;
};

const placeUnit = (
    state: GameState,
    owner: PlayerID,
    type: UnitType,
    r: number,
    c: number,
    override: Partial<Unit> = {}
) => {
    const unit = state.players[owner].units.find(u => u.type === type);
    if (!unit) throw new Error(`missing unit ${owner}:${type}`);
    applyCommonUnitReset(unit);
    unit.r = r;
    unit.c = c;
    Object.assign(unit, override);
    return unit;
};

const createDeterministicState = (): GameState => {
    const state = createInitialState('pve');
    state.gameMode = 'pve';
    state.phase = 'action';
    state.currentPlayer = PlayerID.P2;
    state.turnCount = 4;
    state.gameOver = false;
    state.isPaused = false;
    state.mines = [];
    state.buildings = [];
    state.smokes = [];
    state.logs = [];
    state.movements = [];
    state.sensorResults = [];

    state.cells.forEach(row => {
        row.forEach(cell => {
            cell.isObstacle = false;
            cell.hasEnergyOre = false;
            cell.oreSize = null;
        });
    });

    state.players[PlayerID.P1].energy = 80;
    state.players[PlayerID.P2].energy = 80;
    state.players[PlayerID.P1].startOfActionEnergy = 80;
    state.players[PlayerID.P2].startOfActionEnergy = 80;
    state.players[PlayerID.P1].questStats.sweeperScansThisRound = 0;
    state.players[PlayerID.P2].questStats.sweeperScansThisRound = 0;

    placeUnit(state, PlayerID.P1, UnitType.GENERAL, 1, 1);
    placeUnit(state, PlayerID.P1, UnitType.MINESWEEPER, 2, 1);
    placeUnit(state, PlayerID.P1, UnitType.RANGER, 3, 1);
    placeUnit(state, PlayerID.P1, UnitType.MAKER, 4, 1);
    placeUnit(state, PlayerID.P1, UnitType.DEFUSER, 5, 1);

    placeUnit(state, PlayerID.P2, UnitType.GENERAL, 1, 22);
    placeUnit(state, PlayerID.P2, UnitType.MINESWEEPER, 2, 22);
    placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 22);
    placeUnit(state, PlayerID.P2, UnitType.MAKER, 4, 22);
    placeUnit(state, PlayerID.P2, UnitType.DEFUSER, 5, 22);

    return state;
};

const setEvolution = (
    state: GameState,
    owner: PlayerID,
    unitType: UnitType,
    levels: Partial<EvolutionLevels[UnitType]>
) => {
    const current = state.players[owner].evolutionLevels[unitType];
    state.players[owner].evolutionLevels[unitType] = { ...current, ...levels };
};

const addBuilding = (
    state: GameState,
    type: Building['type'],
    owner: PlayerID,
    r: number,
    c: number,
    level: number,
    variant: 1 | 2 | null = null
) => {
    state.buildings.push({
        id: `test-${type}-${owner}-${r}-${c}-${Date.now()}`,
        type,
        owner,
        r,
        c,
        level,
        variant
    });
};

const addMine = (
    state: GameState,
    owner: PlayerID,
    type: MineType,
    r: number,
    c: number,
    revealedTo: PlayerID[] = [owner]
) => {
    const mine: Mine = {
        id: `test-mine-${owner}-${type}-${r}-${c}-${Date.now()}`,
        owner,
        type,
        r,
        c,
        revealedTo
    };
    state.mines.push(mine);
    return mine;
};

const getPlanningContext = (state: GameState, difficulty: 'easy' | 'normal' | 'hard' = 'normal') => (
    applyTuningToPlanningContext(buildAIPlanningContext(state, difficulty, PlayerID.P2), 'balanced')
);

const getFinalActionsForUnit = (
    state: GameState,
    unit: Unit,
    difficulty: 'easy' | 'normal' | 'hard' = 'normal'
) => {
    const context = getPlanningContext(state, difficulty);
    const tunedActions = applyTuningToActionCandidates(
        generateActionCandidatesForUnit(state, unit, difficulty, context),
        'balanced'
    );
    const scoredActions = sortActionsByPriority(tunedActions);
    return rerankActionsWithBeamLookahead(state, scoredActions, difficulty, PlayerID.P2, 'balanced');
};

describe('AI regression scenarios', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('selects the immediate attacker unit in a fixed lethal board state', () => {
        const state = createDeterministicState();
        const p2General = placeUnit(state, PlayerID.P2, UnitType.GENERAL, 3, 10);
        placeUnit(state, PlayerID.P1, UnitType.MAKER, 3, 11, { hp: 4 });

        const baseContext = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const context = applyTuningToPlanningContext(baseContext, 'balanced');
        const unitCandidates = applyTuningToUnitCandidates(
            generateUnitCandidates(state, 'normal', context, PlayerID.P2),
            'balanced'
        );
        const best = selectBestUnit(unitCandidates);

        expect(best?.unit.id).toBe(p2General.id);
    });

    it('prefers attack over move when a kill is available', () => {
        const state = createDeterministicState();
        const p2General = placeUnit(state, PlayerID.P2, UnitType.GENERAL, 3, 10);
        const target = placeUnit(state, PlayerID.P1, UnitType.MAKER, 3, 11, { hp: 4 });

        const baseContext = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const context = applyTuningToPlanningContext(baseContext, 'balanced');
        const tunedActions = applyTuningToActionCandidates(
            generateActionCandidatesForUnit(state, p2General, 'normal', context),
            'balanced'
        );
        const scoredActions = sortActionsByPriority(tunedActions);
        const finalActions = rerankActionsWithBeamLookahead(state, scoredActions, 'normal', PlayerID.P2, 'balanced');
        const best = finalActions[0];

        expect(best?.type).toBe('attack');
        expect(best?.target?.kind).toBe('unit');
        if (best?.target?.kind === 'unit') {
            expect(best.target.unit.id).toBe(target.id);
        }
    });

    it('avoids risky move targets when safer alternatives exist', () => {
        const state = createDeterministicState();
        const defuser = placeUnit(state, PlayerID.P2, UnitType.DEFUSER, 3, 12);
        state.mines.push({
            id: 'mine-risk',
            owner: PlayerID.P1,
            type: MineType.NORMAL,
            r: 3,
            c: 11,
            revealedTo: [PlayerID.P2]
        });

        const baseContext = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const context = applyTuningToPlanningContext(baseContext, 'balanced');
        const moveActions = generateActionCandidatesForUnit(state, defuser, 'normal', context)
            .filter(action => action.type === 'move');
        const bestMove = sortActionsByPriority(moveActions)[0];

        expect(bestMove).toBeDefined();
        expect(bestMove?.target?.kind).toBe('cell');
        if (bestMove?.target?.kind === 'cell') {
            expect(`${bestMove.target.r},${bestMove.target.c}`).not.toBe('3,11');
        }
    });

    it('penalizes immediate backtrack move after entering a lane', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 11);
        state.movements = [
            {
                unitId: ranger.id,
                from: { r: 3, c: 12 },
                to: { r: 3, c: 11 },
                energy: 2
            }
        ];

        const context = getPlanningContext(state, 'normal');
        const forward = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 3, c: 10 },
            'normal',
            2,
            undefined,
            context
        ).total;
        const backtrack = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 3, c: 12 },
            'normal',
            2,
            undefined,
            context
        ).total;

        expect(forward).toBeGreaterThan(backtrack);
    });

    it('prioritizes stepping onto front ore over sidestep when both are safe', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        state.cells[3][11].hasEnergyOre = true;
        state.cells[3][11].oreSize = 'large';

        const context = getPlanningContext(state, 'normal');
        const frontOre = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 3, c: 11 },
            'normal',
            2,
            undefined,
            context
        ).total;
        const sidestep = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 2, c: 12 },
            'normal',
            2,
            undefined,
            context
        ).total;

        expect(frontOre).toBeGreaterThan(sidestep);
    });

    it('penalizes revisiting 2x2 loop cells compared with fresh cells', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 4, 11);
        state.movements = [
            { unitId: ranger.id, from: { r: 3, c: 11 }, to: { r: 3, c: 10 }, energy: 2 },
            { unitId: ranger.id, from: { r: 3, c: 10 }, to: { r: 4, c: 10 }, energy: 2 },
            { unitId: ranger.id, from: { r: 4, c: 10 }, to: { r: 4, c: 11 }, energy: 2 }
        ];

        const context = getPlanningContext(state, 'normal');
        const revisitLoopCell = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 3, c: 11 },
            'normal',
            2,
            undefined,
            context
        ).total;
        const freshCell = evaluateActionCandidate(
            state,
            ranger,
            'move',
            { kind: 'cell', r: 5, c: 11 },
            'normal',
            2,
            undefined,
            context
        ).total;

        expect(freshCell).toBeGreaterThan(revisitLoopCell);
    });

    it('emits energy rejection diagnostics in low-energy scenarios', () => {
        const state = createDeterministicState();
        const sweeper = placeUnit(state, PlayerID.P2, UnitType.MINESWEEPER, 3, 12);
        state.players[PlayerID.P2].energy = 0;

        const baseContext = buildAIPlanningContext(state, 'normal', PlayerID.P2);
        const context = applyTuningToPlanningContext(baseContext, 'balanced');
        const rejections = collectRejectionSummary(state, sweeper, context);

        expect(rejections.some(entry => entry.reason === 'energy')).toBe(true);
        expect(rejections.some(entry => entry.action === 'move')).toBe(true);
    });

    it('aggregates rejection buckets into ENERGY/RISK/RULES summary', () => {
        const state = createDeterministicState();
        const sweeper = placeUnit(state, PlayerID.P2, UnitType.MINESWEEPER, 3, 12);
        state.players[PlayerID.P2].energy = 0;

        const context = getPlanningContext(state, 'normal');
        const rejections = collectRejectionSummary(state, sweeper, context);
        const summary = summarizeRejectedReasonBuckets(rejections);

        expect(summary.energy).toBeGreaterThan(0);
        expect(summary.risk).toBeGreaterThanOrEqual(0);
        expect(summary.rules).toBeGreaterThanOrEqual(0);
    });

    it('switches to hunt_flag_carrier + defense endgame when enemy carries flag', () => {
        const state = createDeterministicState();
        placeUnit(state, PlayerID.P1, UnitType.RANGER, 2, 17, { hasFlag: true });

        const context = getPlanningContext(state, 'hard');
        expect(context.intent).toBe('hunt_flag_carrier');
        expect(context.endgame.mode).toBe('defense');
        expect(context.endgame.urgency).toBeGreaterThan(1);
    });

    it('switches to push_flag + race endgame when AI side carries flag', () => {
        const state = createDeterministicState();
        placeUnit(state, PlayerID.P2, UnitType.GENERAL, 2, 15, { hasFlag: true });

        const context = getPlanningContext(state, 'hard');
        expect(context.intent).toBe('push_flag');
        expect(context.endgame.mode).toBe('race');
        expect(context.endgame.urgency).toBeGreaterThanOrEqual(1);
    });

    it('enters attrition endgame in late rounds without flag carriers', () => {
        const state = createDeterministicState();
        state.turnCount = 22;

        const context = getPlanningContext(state, 'normal');
        expect(context.endgame.mode).toBe('attrition');
        expect(context.endgame.isEndgame).toBe(true);
    });

    it('prioritizes attacking enemy flag carrier when in range', () => {
        const state = createDeterministicState();
        const p2General = placeUnit(state, PlayerID.P2, UnitType.GENERAL, 3, 10);
        const enemyCarrier = placeUnit(state, PlayerID.P1, UnitType.RANGER, 3, 11, { hasFlag: true, hp: 7 });

        const actions = getFinalActionsForUnit(state, p2General, 'hard');
        const best = actions[0];

        expect(best?.type).toBe('attack');
        expect(best?.target?.kind).toBe('unit');
        if (best?.target?.kind === 'unit') {
            expect(best.target.unit.id).toBe(enemyCarrier.id);
        }
    });

    it('generates ranger teleport action when hub exists and A2 is unlocked', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { a: 2, aVariant: null });
        addBuilding(state, 'hub', PlayerID.P2, 3, 15, 2);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, ranger, 'normal', context);
        const teleport = actions.find(action => action.type === 'teleport' && action.target?.kind === 'cell');

        expect(teleport).toBeDefined();
        expect(teleport?.energyCost).toBe(0);
        if (teleport?.target?.kind === 'cell') {
            expect(`${teleport.target.r},${teleport.target.c}`).toBe('3,15');
        }
    });

    it('does not generate place_hub when own hub already exists', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { a: 1, aVariant: null });
        addBuilding(state, 'hub', PlayerID.P2, 3, 15, 1);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, ranger, 'normal', context);

        expect(actions.some(action => action.type === 'place_hub')).toBe(false);
    });

    it('does not generate teleport when hub cell is occupied by another unit', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { a: 2, aVariant: null });
        addBuilding(state, 'hub', PlayerID.P2, 3, 15, 2);
        placeUnit(state, PlayerID.P1, UnitType.DEFUSER, 3, 15);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, ranger, 'normal', context);

        expect(actions.some(action => action.type === 'teleport')).toBe(false);
    });

    it('generates non-ranger teleport when ranger A3-2 global teleport is unlocked', () => {
        const state = createDeterministicState();
        const maker = placeUnit(state, PlayerID.P2, UnitType.MAKER, 4, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { a: 3, aVariant: 2 });
        addBuilding(state, 'hub', PlayerID.P2, 2, 15, 3, 2);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, maker, 'normal', context);
        const teleport = actions.find(action => action.type === 'teleport');

        expect(teleport).toBeDefined();
        expect(teleport?.energyCost).toBe(5);
    });

    it('generates detonate_tower when sweeper A3-2 has tower coverage on enemy mine', () => {
        const state = createDeterministicState();
        const sweeper = placeUnit(state, PlayerID.P2, UnitType.MINESWEEPER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.MINESWEEPER, { a: 3, aVariant: 2 });
        addBuilding(state, 'tower', PlayerID.P2, 3, 12, 3, 2);
        addMine(state, PlayerID.P1, MineType.NORMAL, 3, 13, [PlayerID.P1]);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, sweeper, 'normal', context);

        expect(actions.some(action => action.type === 'detonate_tower')).toBe(true);
    });

    it('scores chain mine higher than normal mine in enemy-flag pressure setup', () => {
        const state = createDeterministicState();
        const maker = placeUnit(state, PlayerID.P2, UnitType.MAKER, 3, 2);
        setEvolution(state, PlayerID.P2, UnitType.MAKER, { a: 3, aVariant: 1 });

        const context = getPlanningContext(state, 'normal');
        const target = { kind: 'cell' as const, r: 3, c: 3 };
        const chainScore = evaluateActionCandidate(state, maker, 'place_mine', target, 'normal', 7, MineType.CHAIN, context).total;
        const normalScore = evaluateActionCandidate(state, maker, 'place_mine', target, 'normal', 5, MineType.NORMAL, context).total;

        expect(chainScore).toBeGreaterThan(normalScore);
    });

    it('generates throw_mine when ranger B3-2 carries a mine', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { b: 3, bVariant: 2 });
        ranger.carriedMine = {
            id: 'carry-mine',
            owner: PlayerID.P2,
            type: MineType.NORMAL,
            r: ranger.r,
            c: ranger.c,
            revealedTo: [PlayerID.P2]
        };

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, ranger, 'normal', context);

        expect(actions.some(action => action.type === 'throw_mine')).toBe(true);
    });

    it('scores picking own mine higher than picking revealed enemy mine', () => {
        const state = createDeterministicState();
        const ranger = placeUnit(state, PlayerID.P2, UnitType.RANGER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.RANGER, { b: 1, bVariant: null });
        addMine(state, PlayerID.P2, MineType.NORMAL, 3, 11, [PlayerID.P2]);
        addMine(state, PlayerID.P1, MineType.NORMAL, 2, 12, [PlayerID.P2]);

        const context = getPlanningContext(state, 'normal');
        const ownMineScore = evaluateActionCandidate(
            state,
            ranger,
            'pickup_mine',
            { kind: 'cell', r: 3, c: 11 },
            'normal',
            0,
            undefined,
            context
        ).total;
        const enemyMineScore = evaluateActionCandidate(
            state,
            ranger,
            'pickup_mine',
            { kind: 'cell', r: 2, c: 12 },
            'normal',
            0,
            undefined,
            context
        ).total;

        expect(ownMineScore).toBeGreaterThan(enemyMineScore);
    });

    it('generates move_mine when defuser B2 is unlocked and enemy mine is nearby', () => {
        const state = createDeterministicState();
        const defuser = placeUnit(state, PlayerID.P2, UnitType.DEFUSER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.DEFUSER, { b: 2, bVariant: null });
        const mine = addMine(state, PlayerID.P1, MineType.NORMAL, 3, 11, [PlayerID.P1, PlayerID.P2]);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, defuser, 'normal', context);

        expect(actions.some(action =>
            action.type === 'move_mine' &&
            action.sourceCell?.r === mine.r &&
            action.sourceCell?.c === mine.c
        )).toBe(true);
    });

    it('generates convert_mine when defuser B3-1 is unlocked', () => {
        const state = createDeterministicState();
        const defuser = placeUnit(state, PlayerID.P2, UnitType.DEFUSER, 3, 12);
        setEvolution(state, PlayerID.P2, UnitType.DEFUSER, { b: 3, bVariant: 1 });
        addMine(state, PlayerID.P1, MineType.NORMAL, 3, 11, [PlayerID.P2]);

        const context = getPlanningContext(state, 'normal');
        const actions = generateActionCandidatesForUnit(state, defuser, 'normal', context);

        expect(actions.some(action => action.type === 'convert_mine')).toBe(true);
    });
});
