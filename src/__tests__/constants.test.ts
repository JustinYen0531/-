import { describe, it, expect } from 'vitest';
import {
  GRID_ROWS,
  GRID_COLS,
  INITIAL_ENERGY,
  ENERGY_REGEN,
  MAX_INTEREST,
  ENERGY_CAP_RATIO,
  PLACEMENT_TIMER,
  TURN_TIMER,
  THINKING_TIMER,
  PLACEMENT_MINE_LIMIT,
  MAX_MINES_ON_BOARD,
  EVOLUTION_COST,
  EVOLUTION_COSTS,
  UNIT_STATS,
  MINE_DAMAGE,
  ORE_REWARDS,
  P1_START_COL_MIN,
  P1_START_COL_MAX,
  P2_START_COL_MIN,
  P2_START_COL_MAX,
  P1_FLAG_POS,
  P2_FLAG_POS,
  EVOLUTION_CONFIG,
} from '../constants';
import { UnitType } from '../types';

describe('Grid constants', () => {
  it('GRID_ROWS is 7', () => {
    expect(GRID_ROWS).toBe(7);
  });

  it('GRID_COLS is 24', () => {
    expect(GRID_COLS).toBe(24);
  });
});

describe('Energy constants', () => {
  it('INITIAL_ENERGY is 50', () => {
    expect(INITIAL_ENERGY).toBe(50);
  });

  it('ENERGY_REGEN is 35', () => {
    expect(ENERGY_REGEN).toBe(35);
  });

  it('MAX_INTEREST is 10', () => {
    expect(MAX_INTEREST).toBe(10);
  });

  it('ENERGY_CAP_RATIO is 0.3333', () => {
    expect(ENERGY_CAP_RATIO).toBe(0.3333);
  });
});

describe('Timer constants', () => {
  it('PLACEMENT_TIMER is 45', () => {
    expect(PLACEMENT_TIMER).toBe(45);
  });

  it('TURN_TIMER is 15', () => {
    expect(TURN_TIMER).toBe(15);
  });

  it('THINKING_TIMER is 30', () => {
    expect(THINKING_TIMER).toBe(30);
  });
});

describe('Mine constants', () => {
  it('PLACEMENT_MINE_LIMIT is 3', () => {
    expect(PLACEMENT_MINE_LIMIT).toBe(3);
  });

  it('MAX_MINES_ON_BOARD is 5', () => {
    expect(MAX_MINES_ON_BOARD).toBe(5);
  });

  it('MINE_DAMAGE is 8', () => {
    expect(MINE_DAMAGE).toBe(8);
  });
});

describe('Evolution cost constants', () => {
  it('EVOLUTION_COST is 10', () => {
    expect(EVOLUTION_COST).toBe(10);
  });

  it('EVOLUTION_COSTS has correct values for levels 0, 1, 2', () => {
    expect(EVOLUTION_COSTS[0]).toBe(10);
    expect(EVOLUTION_COSTS[1]).toBe(10);
    expect(EVOLUTION_COSTS[2]).toBe(10);
  });
});

describe('UNIT_STATS', () => {
  it('General has correct stats', () => {
    const stats = UNIT_STATS[UnitType.GENERAL];
    expect(stats).toEqual({
      maxHp: 28,
      moveCost: 3,
      flagMoveCost: 5,
      attackCost: 8,
      attackDmg: 4,
    });
  });

  it('Sweeper has correct stats', () => {
    const stats = UNIT_STATS[UnitType.MINESWEEPER];
    expect(stats).toEqual({
      maxHp: 14,
      moveCost: 3,
      scanCost: 4,
    });
  });

  it('Ranger has correct stats', () => {
    const stats = UNIT_STATS[UnitType.RANGER];
    expect(stats).toEqual({
      maxHp: 16,
      moveCost: 2,
    });
  });

  it('Maker has correct stats', () => {
    const stats = UNIT_STATS[UnitType.MAKER];
    expect(stats).toEqual({
      maxHp: 12,
      moveCost: 3,
      makeCost: 5,
    });
  });

  it('Defuser has correct stats', () => {
    const stats = UNIT_STATS[UnitType.DEFUSER];
    expect(stats).toEqual({
      maxHp: 18,
      moveCost: 3,
      disarmCost: 2,
    });
  });

  it('has entries for all five unit types', () => {
    const expectedTypes = [
      UnitType.GENERAL,
      UnitType.MINESWEEPER,
      UnitType.RANGER,
      UnitType.MAKER,
      UnitType.DEFUSER,
    ];
    for (const unitType of expectedTypes) {
      expect(UNIT_STATS[unitType]).toBeDefined();
    }
  });
});

describe('ORE_REWARDS', () => {
  it('small reward is 4', () => {
    expect(ORE_REWARDS.small).toBe(4);
  });

  it('medium reward is 7', () => {
    expect(ORE_REWARDS.medium).toBe(7);
  });

  it('large reward is 10', () => {
    expect(ORE_REWARDS.large).toBe(10);
  });
});

describe('Start position constants', () => {
  it('P1_START_COL_MIN is 0', () => {
    expect(P1_START_COL_MIN).toBe(0);
  });

  it('P1_START_COL_MAX is 3', () => {
    expect(P1_START_COL_MAX).toBe(3);
  });

  it('P2_START_COL_MIN is 20', () => {
    expect(P2_START_COL_MIN).toBe(20);
  });

  it('P2_START_COL_MAX is 23', () => {
    expect(P2_START_COL_MAX).toBe(23);
  });
});

describe('Flag position constants', () => {
  it('P1_FLAG_POS is { r: 3, c: 0 }', () => {
    expect(P1_FLAG_POS).toEqual({ r: 3, c: 0 });
  });

  it('P2_FLAG_POS is { r: 3, c: 23 }', () => {
    expect(P2_FLAG_POS).toEqual({ r: 3, c: 23 });
  });
});

describe('EVOLUTION_CONFIG', () => {
  it('has entries for all five unit types', () => {
    const expectedTypes = [
      UnitType.GENERAL,
      UnitType.MINESWEEPER,
      UnitType.RANGER,
      UnitType.MAKER,
      UnitType.DEFUSER,
    ];
    for (const unitType of expectedTypes) {
      expect(EVOLUTION_CONFIG[unitType]).toBeDefined();
    }
  });

  it('each unit type has both "a" and "b" branches', () => {
    for (const unitType of Object.values(UnitType)) {
      const config = EVOLUTION_CONFIG[unitType];
      expect(config).toHaveProperty('a');
      expect(config).toHaveProperty('b');
    }
  });

  it('each branch has description, thresholds, and rewardText', () => {
    for (const unitType of Object.values(UnitType)) {
      const config = EVOLUTION_CONFIG[unitType];
      for (const branch of [config.a, config.b]) {
        expect(branch).toHaveProperty('description');
        expect(branch).toHaveProperty('thresholds');
        expect(branch).toHaveProperty('rewardText');
        expect(typeof branch.description).toBe('string');
        expect(Array.isArray(branch.thresholds)).toBe(true);
        expect(Array.isArray(branch.rewardText)).toBe(true);
      }
    }
  });

  it('all thresholds arrays have length 3', () => {
    for (const unitType of Object.values(UnitType)) {
      const config = EVOLUTION_CONFIG[unitType];
      expect(config.a.thresholds).toHaveLength(3);
      expect(config.b.thresholds).toHaveLength(3);
    }
  });

  it('General evolution config has correct thresholds', () => {
    const general = EVOLUTION_CONFIG[UnitType.GENERAL];
    expect(general.a.thresholds).toEqual([4, 12, 20]);
    expect(general.b.thresholds).toEqual([6, 13, 20]);
  });

  it('Sweeper evolution config has correct thresholds', () => {
    const sweeper = EVOLUTION_CONFIG[UnitType.MINESWEEPER];
    expect(sweeper.a.thresholds).toEqual([2, 5, 8]);
    expect(sweeper.b.thresholds).toEqual([2, 4, 6]);
  });

  it('Ranger evolution config has correct thresholds', () => {
    const ranger = EVOLUTION_CONFIG[UnitType.RANGER];
    expect(ranger.a.thresholds).toEqual([8, 18, 28]);
    expect(ranger.b.thresholds).toEqual([3, 7, 12]);
  });

  it('Maker evolution config has correct thresholds', () => {
    const maker = EVOLUTION_CONFIG[UnitType.MAKER];
    expect(maker.a.thresholds).toEqual([2, 5, 8]);
    expect(maker.b.thresholds).toEqual([3, 6, 9]);
  });

  it('Defuser evolution config has correct thresholds', () => {
    const defuser = EVOLUTION_CONFIG[UnitType.DEFUSER];
    expect(defuser.a.thresholds).toEqual([2, 5, 8]);
    expect(defuser.b.thresholds).toEqual([2, 5, 8]);
  });
});
