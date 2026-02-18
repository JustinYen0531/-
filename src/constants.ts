import { UnitType } from "./types";

export const GRID_ROWS = 7;
export const GRID_COLS = 24;

export const INITIAL_ENERGY = 50;
export const ENERGY_REGEN = 35;
export const MAX_INTEREST = 10;
export const ENERGY_CAP_RATIO = 0.3333; // Rule 1: 1/3 of starting energy

export const PLACEMENT_TIMER = 45; // New: Time for placement phase
export const TURN_TIMER = 15; // Seconds per action
export const THINKING_TIMER = 30; // Seconds for planning phase

export const PLACEMENT_MINE_LIMIT = 3; // New: Limit for setup mines
export const MAX_MINES_ON_BOARD = 5; // Rule 3: Max 5 mines per player

export const EVOLUTION_COST = 40; // High energy cost for evolution
export const EVOLUTION_COSTS = {
  0: 10,  // LV0 → LV1
  1: 20,  // LV1 → LV2
  2: 30   // LV2 → LV3
} as const;

export const UNIT_STATS = {
  [UnitType.GENERAL]: { maxHp: 28, moveCost: 3, flagMoveCost: 5, attackCost: 8, attackDmg: 4 },
  [UnitType.MINESWEEPER]: { maxHp: 14, moveCost: 3, scanCost: 4 },
  [UnitType.RANGER]: { maxHp: 16, moveCost: 2 },
  [UnitType.MAKER]: { maxHp: 12, moveCost: 3, makeCost: 5 },
  [UnitType.DEFUSER]: { maxHp: 18, moveCost: 3, disarmCost: 2 },
};

export const MINE_DAMAGE = 8;

export const ORE_REWARDS = {
  small: 4,
  medium: 7,
  large: 10,
};

// Start positions (cols)
export const P1_START_COL_MIN = 0;
export const P1_START_COL_MAX = 3;
export const P2_START_COL_MIN = 20;
export const P2_START_COL_MAX = 23;

export const P1_FLAG_POS = { r: 3, c: 0 };
export const P2_FLAG_POS = { r: 3, c: 23 };

// --- Evolution Configuration ---

export interface EvolutionBranchConfig {
  description: string;
  thresholds: number[]; // [Level 1 req, Level 2 req, Level 3 req]
  rewardText: string[]; // Descriptions for each level
}

// Updated to use Translation Keys
export const EVOLUTION_CONFIG: Record<UnitType, { a: EvolutionBranchConfig, b: EvolutionBranchConfig }> = {
  [UnitType.GENERAL]: {
    a: {
      description: "evol_gen_a_desc",
      thresholds: [4, 12, 20],
      rewardText: ["evol_gen_a_r1", "evol_gen_a_r2", "evol_gen_a_r3_1", "evol_gen_a_r3_2"]
    },
    b: {
      description: "evol_gen_b_desc",
      thresholds: [6, 13, 20],
      rewardText: ["evol_gen_b_r1", "evol_gen_b_r2", "evol_gen_b_r3_1", "evol_gen_b_r3_2"]
    }
  },
  [UnitType.MINESWEEPER]: {
    a: {
      description: "evol_swp_a_desc",
      thresholds: [2, 5, 8],
      rewardText: ["evol_swp_a_r1", "evol_swp_a_r2", "evol_swp_a_r3_1", "evol_swp_a_r3_2"]
    },
    b: {
      description: "evol_swp_b_desc",
      thresholds: [2, 4, 6],
      rewardText: ["evol_swp_b_r1", "evol_swp_b_r2", "evol_swp_b_r3_1", "evol_swp_b_r3_2"]
    }
  },
  [UnitType.RANGER]: {
    a: {
      description: "evol_rng_a_desc",
      thresholds: [8, 18, 28],
      rewardText: ["evol_rng_a_r1", "evol_rng_a_r2", "evol_rng_a_r3_1", "evol_rng_a_r3_2"]
    },
    b: {
      description: "evol_rng_b_desc",
      thresholds: [3, 7, 12],
      rewardText: ["evol_rng_b_r1", "evol_rng_b_r2", "evol_rng_b_r3_1", "evol_rng_b_r3_2"]
    }
  },
  [UnitType.MAKER]: {
    a: {
      description: "evol_mkr_a_desc",
      thresholds: [2, 5, 8],
      rewardText: ["evol_mkr_a_r1", "evol_mkr_a_r2", "evol_mkr_a_r3_1", "evol_mkr_a_r3_2"]
    },
    b: {
      description: "evol_mkr_b_desc",
      thresholds: [3, 6, 9],
      rewardText: ["evol_mkr_b_r1", "evol_mkr_b_r2", "evol_mkr_b_r3_1", "evol_mkr_b_r3_2"]
    }
  },
  [UnitType.DEFUSER]: {
    a: {
      description: "evol_def_a_desc",
      thresholds: [2, 5, 8],
      rewardText: ["evol_def_a_r1", "evol_def_a_r2", "evol_def_a_r3_1", "evol_def_a_r3_2"]
    },
    b: {
      description: "evol_def_b_desc",
      thresholds: [2, 5, 8],
      rewardText: ["evol_def_b_r1", "evol_def_b_r2", "evol_def_b_r3_1", "evol_def_b_r3_2"]
    }
  }
};
