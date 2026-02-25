import { describe, it, expect, vi } from 'vitest';
import {
    AI_DIFFICULTY_WEIGHTS,
    AI_THINK_DELAY_MS,
    AI_ENERGY_RESERVE_BASE,
    AI_INTENT_ACTION_BONUS,
    AI_ROLE_ACTION_BONUS,
    AI_FEINT_CHANCE,
    AI_FEINT_MAX_DELTA,
    AI_FEINT_COOLDOWN_TURNS,
    AI_BEAM_TOP_ACTIONS,
    AI_BEAM_COUNTER_WEIGHT,
    AI_BEAM_FOLLOWUP_WEIGHT,
    AI_MAX_ACTION_RETRIES,
    AI_MAX_LOGGED_ACTIONS,
    AI_DECISION_BUDGET_MS,
    AI_ACTION_THINK_MS,
} from '../config';
import { AIDifficulty, AIScoreWeights } from '../types';

const DIFFICULTIES: AIDifficulty[] = ['easy', 'normal', 'hard'];

const WEIGHT_KEYS: (keyof AIScoreWeights)[] = [
    'unitAttackOpportunity',
    'unitFlagPressure',
    'unitSurvival',
    'unitEnergyEfficiency',
    'actionDamage',
    'actionFlagPressure',
    'actionSafety',
    'actionUtility',
    'randomJitter',
];

describe('AI_DIFFICULTY_WEIGHTS', () => {
    it('has entries for all three difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_DIFFICULTY_WEIGHTS[d]).toBeDefined();
        }
    });

    it.each(DIFFICULTIES)('%s has all required weight keys', (difficulty) => {
        const weights = AI_DIFFICULTY_WEIGHTS[difficulty];
        for (const key of WEIGHT_KEYS) {
            expect(weights).toHaveProperty(key);
        }
    });

    it.each(DIFFICULTIES)('%s has only numeric weight values', (difficulty) => {
        const weights = AI_DIFFICULTY_WEIGHTS[difficulty];
        for (const key of WEIGHT_KEYS) {
            expect(typeof weights[key]).toBe('number');
        }
    });

    it.each(DIFFICULTIES)('%s has positive weight values (except randomJitter which is non-negative)', (difficulty) => {
        const weights = AI_DIFFICULTY_WEIGHTS[difficulty];
        for (const key of WEIGHT_KEYS) {
            expect(weights[key]).toBeGreaterThanOrEqual(0);
        }
    });

    it('hard weights are generally higher than easy weights', () => {
        const hard = AI_DIFFICULTY_WEIGHTS.hard;
        const easy = AI_DIFFICULTY_WEIGHTS.easy;
        expect(hard.unitAttackOpportunity).toBeGreaterThan(easy.unitAttackOpportunity);
        expect(hard.actionDamage).toBeGreaterThan(easy.actionDamage);
        expect(hard.actionSafety).toBeGreaterThan(easy.actionSafety);
    });

    it('hard has lower randomJitter than easy', () => {
        expect(AI_DIFFICULTY_WEIGHTS.hard.randomJitter).toBeLessThan(AI_DIFFICULTY_WEIGHTS.easy.randomJitter);
    });

    it('normal weights are between easy and hard for key dimensions', () => {
        const easy = AI_DIFFICULTY_WEIGHTS.easy;
        const normal = AI_DIFFICULTY_WEIGHTS.normal;
        const hard = AI_DIFFICULTY_WEIGHTS.hard;
        expect(normal.unitAttackOpportunity).toBeGreaterThan(easy.unitAttackOpportunity);
        expect(normal.unitAttackOpportunity).toBeLessThan(hard.unitAttackOpportunity);
    });
});

describe('AI_THINK_DELAY_MS', () => {
    it('has entries for all three difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_THINK_DELAY_MS[d]).toBeDefined();
        }
    });

    it('easy delay is 320', () => {
        expect(AI_THINK_DELAY_MS.easy).toBe(320);
    });

    it('normal delay is 420', () => {
        expect(AI_THINK_DELAY_MS.normal).toBe(420);
    });

    it('hard delay is 520', () => {
        expect(AI_THINK_DELAY_MS.hard).toBe(520);
    });

    it('delays increase with difficulty', () => {
        expect(AI_THINK_DELAY_MS.easy).toBeLessThan(AI_THINK_DELAY_MS.normal);
        expect(AI_THINK_DELAY_MS.normal).toBeLessThan(AI_THINK_DELAY_MS.hard);
    });

    it.each(DIFFICULTIES)('%s delay is a positive number', (difficulty) => {
        expect(AI_THINK_DELAY_MS[difficulty]).toBeGreaterThan(0);
    });
});

describe('AI_ENERGY_RESERVE_BASE', () => {
    it('has entries for all three difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_ENERGY_RESERVE_BASE[d]).toBeDefined();
        }
    });

    it('easy reserve is 4', () => {
        expect(AI_ENERGY_RESERVE_BASE.easy).toBe(4);
    });

    it('normal reserve is 6', () => {
        expect(AI_ENERGY_RESERVE_BASE.normal).toBe(6);
    });

    it('hard reserve is 8', () => {
        expect(AI_ENERGY_RESERVE_BASE.hard).toBe(8);
    });

    it('reserves increase with difficulty', () => {
        expect(AI_ENERGY_RESERVE_BASE.easy).toBeLessThan(AI_ENERGY_RESERVE_BASE.normal);
        expect(AI_ENERGY_RESERVE_BASE.normal).toBeLessThan(AI_ENERGY_RESERVE_BASE.hard);
    });
});

describe('AI_INTENT_ACTION_BONUS', () => {
    const INTENTS = ['push_flag', 'hunt_flag_carrier', 'control_mines', 'stabilize'] as const;

    it('has entries for all four intents', () => {
        for (const intent of INTENTS) {
            expect(AI_INTENT_ACTION_BONUS[intent]).toBeDefined();
        }
    });

    it('push_flag has a high pickup_flag bonus', () => {
        expect(AI_INTENT_ACTION_BONUS.push_flag.pickup_flag).toBeGreaterThan(5);
    });

    it('push_flag penalizes drop_flag', () => {
        expect(AI_INTENT_ACTION_BONUS.push_flag.drop_flag).toBeLessThan(0);
    });

    it('hunt_flag_carrier has a high attack bonus', () => {
        expect(AI_INTENT_ACTION_BONUS.hunt_flag_carrier.attack).toBeGreaterThan(2);
    });

    it('control_mines has bonuses for mine-related actions', () => {
        const cm = AI_INTENT_ACTION_BONUS.control_mines;
        expect(cm.scan).toBeGreaterThan(0);
        expect(cm.disarm).toBeGreaterThan(0);
        expect(cm.place_mine).toBeGreaterThan(0);
        expect(cm.convert_mine).toBeGreaterThan(0);
    });

    it('stabilize penalizes aggressive actions', () => {
        const stab = AI_INTENT_ACTION_BONUS.stabilize;
        expect(stab.attack).toBeLessThan(0);
        expect(stab.place_mine).toBeLessThan(0);
    });

    it('stabilize rewards defensive actions', () => {
        const stab = AI_INTENT_ACTION_BONUS.stabilize;
        expect(stab.disarm).toBeGreaterThan(0);
        expect(stab.end_turn).toBeGreaterThan(0);
    });

    it('all bonus values are numbers', () => {
        for (const intent of INTENTS) {
            const bonuses = AI_INTENT_ACTION_BONUS[intent];
            for (const [, value] of Object.entries(bonuses)) {
                expect(typeof value).toBe('number');
            }
        }
    });
});

describe('AI_ROLE_ACTION_BONUS', () => {
    const ROLES = ['striker', 'flanker', 'controller', 'scout', 'support'] as const;

    it('has entries for all five roles', () => {
        for (const role of ROLES) {
            expect(AI_ROLE_ACTION_BONUS[role]).toBeDefined();
        }
    });

    it('striker has a high attack bonus', () => {
        expect(AI_ROLE_ACTION_BONUS.striker.attack).toBeGreaterThan(3);
    });

    it('controller has a high place_mine bonus', () => {
        expect(AI_ROLE_ACTION_BONUS.controller.place_mine).toBeGreaterThan(3);
    });

    it('scout has a high sensor_scan bonus', () => {
        expect(AI_ROLE_ACTION_BONUS.scout.sensor_scan).toBeGreaterThan(3);
    });

    it('support has a high disarm bonus', () => {
        expect(AI_ROLE_ACTION_BONUS.support.disarm).toBeGreaterThan(3);
    });

    it('all bonus values are numbers', () => {
        for (const role of ROLES) {
            const bonuses = AI_ROLE_ACTION_BONUS[role];
            for (const [, value] of Object.entries(bonuses)) {
                expect(typeof value).toBe('number');
            }
        }
    });
});

describe('AI_FEINT constants', () => {
    it('AI_FEINT_CHANCE has entries for all difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_FEINT_CHANCE[d]).toBeDefined();
            expect(typeof AI_FEINT_CHANCE[d]).toBe('number');
        }
    });

    it('easy feint chance is 0', () => {
        expect(AI_FEINT_CHANCE.easy).toBe(0);
    });

    it('feint chance increases with difficulty', () => {
        expect(AI_FEINT_CHANCE.easy).toBeLessThanOrEqual(AI_FEINT_CHANCE.normal);
        expect(AI_FEINT_CHANCE.normal).toBeLessThanOrEqual(AI_FEINT_CHANCE.hard);
    });

    it('AI_FEINT_MAX_DELTA has entries for all difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_FEINT_MAX_DELTA[d]).toBeDefined();
            expect(typeof AI_FEINT_MAX_DELTA[d]).toBe('number');
        }
    });

    it('easy feint max delta is 0', () => {
        expect(AI_FEINT_MAX_DELTA.easy).toBe(0);
    });

    it('AI_FEINT_COOLDOWN_TURNS is 2', () => {
        expect(AI_FEINT_COOLDOWN_TURNS).toBe(2);
    });
});

describe('AI_BEAM constants', () => {
    it('AI_BEAM_TOP_ACTIONS has entries for all difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_BEAM_TOP_ACTIONS[d]).toBeDefined();
            expect(typeof AI_BEAM_TOP_ACTIONS[d]).toBe('number');
        }
    });

    it('easy beam top actions is 0 (disabled)', () => {
        expect(AI_BEAM_TOP_ACTIONS.easy).toBe(0);
    });

    it('beam top actions increases with difficulty', () => {
        expect(AI_BEAM_TOP_ACTIONS.easy).toBeLessThanOrEqual(AI_BEAM_TOP_ACTIONS.normal);
        expect(AI_BEAM_TOP_ACTIONS.normal).toBeLessThanOrEqual(AI_BEAM_TOP_ACTIONS.hard);
    });

    it('AI_BEAM_COUNTER_WEIGHT has entries for all difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_BEAM_COUNTER_WEIGHT[d]).toBeDefined();
            expect(typeof AI_BEAM_COUNTER_WEIGHT[d]).toBe('number');
        }
    });

    it('AI_BEAM_FOLLOWUP_WEIGHT has entries for all difficulties', () => {
        for (const d of DIFFICULTIES) {
            expect(AI_BEAM_FOLLOWUP_WEIGHT[d]).toBeDefined();
            expect(typeof AI_BEAM_FOLLOWUP_WEIGHT[d]).toBe('number');
        }
    });

    it('easy beam counter and followup weights are 0', () => {
        expect(AI_BEAM_COUNTER_WEIGHT.easy).toBe(0);
        expect(AI_BEAM_FOLLOWUP_WEIGHT.easy).toBe(0);
    });
});

describe('Scalar AI constants', () => {
    it('AI_MAX_ACTION_RETRIES is 6', () => {
        expect(AI_MAX_ACTION_RETRIES).toBe(6);
    });

    it('AI_MAX_LOGGED_ACTIONS is 1', () => {
        expect(AI_MAX_LOGGED_ACTIONS).toBe(1);
    });

    it('AI_DECISION_BUDGET_MS is 5000', () => {
        expect(AI_DECISION_BUDGET_MS).toBe(5000);
    });
});

describe('AI_ACTION_THINK_MS', () => {
    const EXPECTED_ACTIONS = [
        'move', 'attack', 'scan', 'sensor_scan', 'place_mine',
        'place_tower', 'place_factory', 'place_hub', 'teleport',
        'detonate_tower', 'throw_mine', 'pickup_mine', 'drop_mine',
        'move_mine', 'convert_mine', 'disarm',
        'evolve_a', 'evolve_a_1', 'evolve_a_2',
        'evolve_b', 'evolve_b_1', 'evolve_b_2',
        'pickup_flag', 'drop_flag', 'end_turn',
    ];

    it('has entries for all expected action types', () => {
        for (const action of EXPECTED_ACTIONS) {
            expect(AI_ACTION_THINK_MS).toHaveProperty(action);
        }
    });

    it('all think times are positive numbers', () => {
        for (const [, value] of Object.entries(AI_ACTION_THINK_MS)) {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
        }
    });

    it('end_turn has the shortest think time', () => {
        const endTurnMs = AI_ACTION_THINK_MS.end_turn;
        for (const [key, value] of Object.entries(AI_ACTION_THINK_MS)) {
            if (key !== 'end_turn') {
                expect(value).toBeGreaterThanOrEqual(endTurnMs);
            }
        }
    });

    it('move has a lower think time than attack', () => {
        expect(AI_ACTION_THINK_MS.move).toBeLessThan(AI_ACTION_THINK_MS.attack);
    });
});
