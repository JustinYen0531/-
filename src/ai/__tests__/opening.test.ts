import { describe, it, expect, vi } from 'vitest';
import { chooseOpeningPlan, getOpeningActionBias } from '../opening';
import { createInitialOpponentModel } from '../opponentModel';
import { createTestState, createTestUnit } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType, MineType } from '../../types';
import { AIPlanningContext, AIOpeningPlan, AIOpponentModel, AITuningProfile } from '../types';

const makeOpponentModel = (overrides: Partial<AIOpponentModel> = {}): AIOpponentModel => ({
    ...createInitialOpponentModel(),
    ...overrides,
});

const makeOpeningContext = (
    plan: AIOpeningPlan,
    weight: number = 1,
    unitRoles: Record<string, string> = {}
): AIPlanningContext => ({
    intent: 'push_flag',
    threatMap: [],
    reserveEnergy: 6,
    unitRoles: unitRoles as Record<string, any>,
    opponentModel: createInitialOpponentModel(),
    hotspotCells: [],
    opening: {
        isOpening: true,
        plan,
        weight,
        turn: 1,
    },
    endgame: {
        isEndgame: false,
        mode: 'none',
        urgency: 0,
        ownAlive: 5,
        enemyAlive: 5,
    },
});

describe('chooseOpeningPlan', () => {
    it('returns scout_probe when opponent mine pressure is >= 4.5', () => {
        const state = createTestState();
        const model = makeOpponentModel({ minePressure: 5.0 });
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model);
        expect(plan).toBe('scout_probe');
    });

    it('returns scout_probe when mine pressure is exactly 4.5', () => {
        const state = createTestState();
        const model = makeOpponentModel({ minePressure: 4.5 });
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model);
        expect(plan).toBe('scout_probe');
    });

    it('does not return scout_probe when mine pressure is below 4.5', () => {
        const state = createTestState();
        const model = makeOpponentModel({ minePressure: 4.4 });
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model);
        expect(plan).not.toBe('scout_probe');
    });

    it('returns fortress for conservative tuning when enemy forward pressure >= 2', () => {
        const state = createTestState();
        // Move two P1 units close to P2 flag (r:3, c:23) within manhattan distance 7
        const p1Units = state.players[PlayerID.P1].units;
        p1Units[0].r = 3; p1Units[0].c = 20; p1Units[0].isDead = false;
        p1Units[1].r = 4; p1Units[1].c = 20; p1Units[1].isDead = false;

        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'conservative', model);
        expect(plan).toBe('fortress');
    });

    it('returns mine_screen for conservative tuning when enemy forward pressure < 2', () => {
        const state = createTestState();
        // All P1 units are at c=1, far from P2 flag at c=23
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'conservative', model);
        expect(plan).toBe('mine_screen');
    });

    it('returns center_break for aggressive tuning when center obstacles <= 5', () => {
        const state = createTestState();
        // createTestState clears all obstacles so centerObstacles=0
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'aggressive', model);
        expect(plan).toBe('center_break');
    });

    it('returns flag_spear for aggressive tuning when center obstacles > 5', () => {
        const state = createTestState();
        // Place 6 obstacles in the center columns (10,11,12,13)
        for (let r = 0; r < 6; r++) {
            state.cells[r][11].isObstacle = true;
        }
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'aggressive', model);
        expect(plan).toBe('flag_spear');
    });

    it('returns center_break on hard difficulty when center is clear', () => {
        const state = createTestState();
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'hard', 'balanced', model);
        expect(plan).toBe('center_break');
    });

    it('returns lane_pressure on hard difficulty when center obstacles > 4', () => {
        const state = createTestState();
        // Place 5 obstacles in center (centerStart=10, centerEnd=13)
        for (let r = 0; r < 5; r++) {
            state.cells[r][11].isObstacle = true;
        }
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'hard', 'balanced', model);
        expect(plan).toBe('lane_pressure');
    });

    it('returns lane_pressure when enemy forward pressure >= 2', () => {
        const state = createTestState();
        // Move P1 units close to P2 flag and set center obstacles > 4 to bypass hard center_break
        const p1Units = state.players[PlayerID.P1].units;
        p1Units[0].r = 3; p1Units[0].c = 19; p1Units[0].isDead = false;
        p1Units[1].r = 4; p1Units[1].c = 20; p1Units[1].isDead = false;
        // Also put obstacles to bypass hard+center_break
        for (let r = 0; r < 5; r++) {
            state.cells[r][11].isObstacle = true;
        }

        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'hard', 'balanced', model);
        expect(plan).toBe('lane_pressure');
    });

    it('returns lane_pressure when opponent flagRush >= 4.2', () => {
        const state = createTestState();
        // Need center obstacles > 4 to avoid hard center_break
        for (let r = 0; r < 5; r++) {
            state.cells[r][11].isObstacle = true;
        }
        const model = makeOpponentModel({ flagRush: 4.5 });
        const plan = chooseOpeningPlan(state, 'hard', 'balanced', model);
        expect(plan).toBe('lane_pressure');
    });

    it('returns lane_pressure when center obstacles >= 8', () => {
        const state = createTestState();
        // Place 8 obstacles in center columns
        for (let r = 0; r < 7; r++) {
            state.cells[r][11].isObstacle = true;
        }
        state.cells[0][12].isObstacle = true;

        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model);
        expect(plan).toBe('lane_pressure');
    });

    it('returns mine_screen as the default fallback', () => {
        const state = createTestState();
        // Normal difficulty, balanced, no pressure, few obstacles
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model);
        expect(plan).toBe('mine_screen');
    });

    it('respects aiPlayer parameter for enemy calculation', () => {
        const state = createTestState();
        // Move P2 units close to P1 flag (r:3, c:0) to create forward pressure
        const p2Units = state.players[PlayerID.P2].units;
        p2Units[0].r = 3; p2Units[0].c = 3; p2Units[0].isDead = false;
        p2Units[1].r = 4; p2Units[1].c = 4; p2Units[1].isDead = false;
        // Need center obstacles > 4 for normal difficulty to fall through to pressure check
        for (let r = 0; r < 5; r++) {
            state.cells[r][11].isObstacle = true;
        }

        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'normal', 'balanced', model, PlayerID.P1);
        expect(plan).toBe('lane_pressure');
    });

    it('minePressure check takes priority over tuning profile', () => {
        const state = createTestState();
        const model = makeOpponentModel({ minePressure: 5.0 });
        const plan = chooseOpeningPlan(state, 'hard', 'aggressive', model);
        expect(plan).toBe('scout_probe');
    });

    it('conservative tuning takes priority over difficulty-based logic', () => {
        const state = createTestState();
        // Even on hard with clear center, conservative should override
        const model = makeOpponentModel();
        const plan = chooseOpeningPlan(state, 'hard', 'conservative', model);
        expect(plan).toBe('mine_screen');
    });
});

describe('getOpeningActionBias', () => {
    it('returns 0 when context is undefined', () => {
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(undefined, unit, 'move');
        expect(bias).toBe(0);
    });

    it('returns 0 when not in opening phase', () => {
        const context = makeOpeningContext('center_break');
        context.opening.isOpening = false;
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(context, unit, 'move');
        expect(bias).toBe(0);
    });

    it('returns 0 when opening plan is null', () => {
        const context = makeOpeningContext('center_break');
        context.opening.plan = null;
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(context, unit, 'move');
        expect(bias).toBe(0);
    });

    it('applies action bias from center_break opening book for move', () => {
        const context = makeOpeningContext('center_break', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(context, unit, 'move');
        // center_break move bias = 2.2, no role bonus (role not set), no target
        expect(bias).toBeGreaterThan(0);
        expect(bias).toBeCloseTo(2.2, 1);
    });

    it('adds role bias when unit role matches opening book', () => {
        const unitId = `${PlayerID.P2}-${UnitType.GENERAL}`;
        const context = makeOpeningContext('center_break', 1, { [unitId]: 'striker' });
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(context, unit, 'move');
        // center_break move=2.2 + striker=1.5 = 3.7, weight=1
        expect(bias).toBeCloseTo(3.7, 1);
    });

    it('applies lane score bonus when target is provided', () => {
        const context = makeOpeningContext('center_break', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 12);
        // Target near center (r=3, c=12 close to center of 7x24 grid)
        const biasWithTarget = getOpeningActionBias(context, unit, 'move', { r: 3, c: 12 });
        const biasWithoutTarget = getOpeningActionBias(context, unit, 'move');
        expect(biasWithTarget).toBeGreaterThan(biasWithoutTarget);
    });

    it('applies forward movement bonus for P2 moving toward P1', () => {
        const context = makeOpeningContext('center_break', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 12);
        // P2 moving left (toward P1) = forward; c: 12 to c: 11 => forward = 12-11 = 1
        const biasForward = getOpeningActionBias(context, unit, 'move', { r: 3, c: 11 });
        // P2 moving right (backward); c: 12 to c: 13 => forward = 12-13 = -1, no bonus
        const biasBackward = getOpeningActionBias(context, unit, 'move', { r: 3, c: 13 });
        expect(biasForward).toBeGreaterThan(biasBackward);
    });

    it('adds chain mine bonus for mine_screen plan', () => {
        const context = makeOpeningContext('mine_screen', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.MAKER, 3, 22);
        const chainBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.CHAIN);
        const normalBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.NORMAL);
        // mine_screen place_mine=2.8; chain gets +1.2 extra
        expect(chainBias).toBeGreaterThan(normalBias);
    });

    it('adds mine bonus for fortress plan with NORMAL mine', () => {
        const context = makeOpeningContext('fortress', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.MAKER, 3, 22);
        const normalBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.NORMAL);
        const smokeBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.SMOKE);
        // fortress place_mine=1.9; NORMAL gets +0.9, SMOKE gets nothing extra
        expect(normalBias).toBeGreaterThan(smokeBias);
    });

    it('adds mine bonus for fortress plan with SLOW mine', () => {
        const context = makeOpeningContext('fortress', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.MAKER, 3, 22);
        const slowBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.SLOW);
        const nukeBias = getOpeningActionBias(context, unit, 'place_mine', undefined, MineType.NUKE);
        expect(slowBias).toBeGreaterThan(nukeBias);
    });

    it('adds general pickup_flag bonus for flag_spear plan', () => {
        const context = makeOpeningContext('flag_spear', 1);
        const general = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const bias = getOpeningActionBias(context, general, 'pickup_flag');
        // flag_spear pickup_flag=1.1 + general bonus=1.3 = 2.4 (no role)
        expect(bias).toBeCloseTo(2.4, 1);
    });

    it('does not add general pickup_flag bonus for non-GENERAL unit', () => {
        const context = makeOpeningContext('flag_spear', 1);
        const ranger = createTestUnit(PlayerID.P2, UnitType.RANGER, 3, 22);
        const bias = getOpeningActionBias(context, ranger, 'pickup_flag');
        // flag_spear pickup_flag=1.1 only (no general bonus)
        expect(bias).toBeCloseTo(1.1, 1);
    });

    it('scales result by opening weight', () => {
        const context = makeOpeningContext('center_break', 0.5);
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        const halfWeightBias = getOpeningActionBias(context, unit, 'move');
        const fullContext = makeOpeningContext('center_break', 1.0);
        const fullWeightBias = getOpeningActionBias(fullContext, unit, 'move');
        expect(halfWeightBias).toBeCloseTo(fullWeightBias * 0.5, 1);
    });

    it('returns 0 bias for action type not in opening book', () => {
        const context = makeOpeningContext('center_break', 1);
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 22);
        // center_break does not have 'disarm' in its actionBias
        const bias = getOpeningActionBias(context, unit, 'disarm');
        expect(bias).toBe(0);
    });
});
