import { AIActionType, AIDifficulty, AIIntent, AIScoreWeights } from './types';

export const AI_DIFFICULTY_WEIGHTS: Record<AIDifficulty, AIScoreWeights> = {
    easy: {
        unitAttackOpportunity: 0.8,
        unitFlagPressure: 0.7,
        unitSurvival: 0.6,
        unitEnergyEfficiency: 0.5,
        actionDamage: 0.9,
        actionFlagPressure: 0.8,
        actionSafety: 0.7,
        actionUtility: 0.6,
        randomJitter: 0.8
    },
    normal: {
        unitAttackOpportunity: 1.2,
        unitFlagPressure: 1.0,
        unitSurvival: 1.0,
        unitEnergyEfficiency: 0.8,
        actionDamage: 1.3,
        actionFlagPressure: 1.1,
        actionSafety: 1.2,
        actionUtility: 1.0,
        randomJitter: 0.4
    },
    hard: {
        unitAttackOpportunity: 1.5,
        unitFlagPressure: 1.3,
        unitSurvival: 1.2,
        unitEnergyEfficiency: 1.0,
        actionDamage: 1.6,
        actionFlagPressure: 1.3,
        actionSafety: 1.5,
        actionUtility: 1.2,
        randomJitter: 0.15
    }
};

export const AI_THINK_DELAY_MS: Record<AIDifficulty, number> = {
    easy: 320,
    normal: 420,
    hard: 520
};

export const AI_ENERGY_RESERVE_BASE: Record<AIDifficulty, number> = {
    easy: 4,
    normal: 6,
    hard: 8
};

export const AI_INTENT_ACTION_BONUS: Record<AIIntent, Partial<Record<AIActionType, number>>> = {
    push_flag: {
        move: 3.0,
        pickup_flag: 12,
        attack: 1.5,
        teleport: 2.0,
        place_hub: 1.1,
        drop_flag: -10,
        end_turn: -2
    },
    hunt_flag_carrier: {
        attack: 5,
        move: 2.2,
        scan: 1.4,
        sensor_scan: 1.8,
        drop_flag: -2
    },
    control_mines: {
        scan: 4.5,
        sensor_scan: 5.2,
        disarm: 4.2,
        place_tower: 2.2,
        detonate_tower: 3.4,
        place_mine: 3.5,
        throw_mine: 2.1,
        pickup_mine: 1.7,
        move_mine: 3.2,
        convert_mine: 3.6,
        evolve_a: 0.8,
        evolve_b: 1.4,
        evolve_b_1: 1.8,
        evolve_b_2: 1.8,
        move: 0.8
    },
    stabilize: {
        disarm: 2.4,
        scan: 1.8,
        sensor_scan: 2.4,
        place_tower: 1.5,
        teleport: 1.2,
        move: -0.8,
        place_mine: -1.2,
        evolve_a: 1.2,
        evolve_b: 1.2,
        evolve_a_1: 1.4,
        evolve_a_2: 1.4,
        evolve_b_1: 1.4,
        evolve_b_2: 1.4,
        attack: -1,
        end_turn: 1.2
    }
};

export const AI_ROLE_ACTION_BONUS: Record<string, Partial<Record<AIActionType, number>>> = {
    striker: {
        attack: 4.2,
        move: 1.8,
        throw_mine: 1.6,
        teleport: 1.4,
        pickup_flag: 2.2,
        end_turn: -0.8
    },
    flanker: {
        move: 2.2,
        attack: 1.5,
        scan: 1.2,
        sensor_scan: 1.4,
        evolve_a: 0.8,
        evolve_b: 0.8,
        place_mine: 0.8
    },
    controller: {
        place_mine: 4.3,
        place_tower: 2.2,
        detonate_tower: 2.6,
        move_mine: 2.6,
        convert_mine: 2.8,
        disarm: 2.8,
        scan: 2.3,
        sensor_scan: 2.8,
        evolve_a: 1.4,
        evolve_b: 1.6,
        attack: -0.6
    },
    scout: {
        scan: 4.1,
        sensor_scan: 4.6,
        pickup_mine: 1.2,
        move: 1.6,
        evolve_b: 0.8,
        disarm: 1.8
    },
    support: {
        disarm: 4.2,
        scan: 2.2,
        sensor_scan: 2.8,
        place_hub: 1.4,
        place_factory: 1.2,
        place_tower: 1.4,
        evolve_b: 1.2,
        move: 1.2,
        pickup_flag: -0.8
    }
};

export const AI_FEINT_CHANCE: Record<AIDifficulty, number> = {
    easy: 0,
    normal: 0.1,
    hard: 0.14
};

export const AI_FEINT_MAX_DELTA: Record<AIDifficulty, number> = {
    easy: 0,
    normal: 2.2,
    hard: 3.2
};

export const AI_FEINT_COOLDOWN_TURNS = 2;

export const AI_BEAM_TOP_ACTIONS: Record<AIDifficulty, number> = {
    easy: 0,
    normal: 2,
    hard: 4
};

export const AI_BEAM_COUNTER_WEIGHT: Record<AIDifficulty, number> = {
    easy: 0,
    normal: 0.25,
    hard: 0.45
};

export const AI_BEAM_FOLLOWUP_WEIGHT: Record<AIDifficulty, number> = {
    easy: 0,
    normal: 0.16,
    hard: 0.32
};

export const AI_MAX_ACTION_RETRIES = 6;
export const AI_MAX_LOGGED_ACTIONS = 1;
export const AI_DECISION_BUDGET_MS = 1200;
export const AI_ACTION_THINK_MS = {
    move: 350,
    attack: 600,
    scan: 700,
    sensor_scan: 760,
    place_mine: 800,
    place_tower: 760,
    place_factory: 760,
    place_hub: 760,
    teleport: 620,
    detonate_tower: 800,
    throw_mine: 740,
    pickup_mine: 500,
    drop_mine: 500,
    move_mine: 780,
    convert_mine: 760,
    disarm: 650,
    evolve_a: 520,
    evolve_a_1: 560,
    evolve_a_2: 560,
    evolve_b: 520,
    evolve_b_1: 560,
    evolve_b_2: 560,
    pickup_flag: 450,
    drop_flag: 550,
    end_turn: 250
};
