import { GameState, Unit, UnitType } from './types';
import { UNIT_STATS } from './constants';

export function getEnemyTerritoryEnergyCost(unit: Unit, baseCost: number, gameState: GameState): number {
    const player = gameState.players[unit.owner];
    const isP1 = unit.owner === 'P1';

    // In Enemy Territory?
    const inEnemyTerritory = isP1 ? unit.r < 5 : unit.r > 4;
    if (!inEnemyTerritory) return baseCost;

    // Check Evolution
    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB >= 2) return baseCost; // No penalty

    return baseCost * 2;
}

export function getDisplayCost(unit: Unit | null, baseCost: number, gameState: GameState, actionType: string = 'move'): number {
    if (!unit) return baseCost;

    let finalCost = baseCost;

    // Rule 1: Enemy Territory Penalty
    finalCost = getEnemyTerritoryEnergyCost(unit, finalCost, gameState);

    // Rule 2: Ranger Carry Penalty
    if (unit.type === UnitType.RANGER && unit.carriedMine && actionType === 'move') {
        const player = gameState.players[unit.owner];
        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
        if (rngLevelB < 2) {
            finalCost += 2;
        }
    }

    // Rule 3: General Flag Carrier Penalty
    if (unit.type === UnitType.GENERAL && unit.hasFlag && actionType === 'move') {
        const player = gameState.players[unit.owner];
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        if (genLevelB < 3) {
            // General usually costs 5 to move with flag, but here we expect baseCost to be 5 already
            // If baseCost is 3 (default), we make it 5? 
            // The logic in renderControlPanel handles the baseCost selection.
        }
    }

    return finalCost;
}

export function getActionButtonIndex(actionType: string, unit: Unit | null | undefined, gameState: GameState): number {
    if (!unit) return 0;

    const p = gameState.players[unit.owner];
    const levels = p.evolutionLevels;

    // Core buttons
    if (actionType === 'move') return 1;

    let idx = 2; // Start from 2

    // General
    if (unit.type === UnitType.GENERAL) {
        if (!unit.hasFlag || levels[UnitType.GENERAL].a >= 3) {
            if (actionType === 'attack') return idx;
            idx++;
        }
    }

    // Sweeper
    if (unit.type === UnitType.MINESWEEPER) {
        if (actionType === 'scan') return idx;
        idx++;
        if (levels[UnitType.MINESWEEPER].a >= 1) {
            if (actionType === 'place_tower') return idx;
            idx++;
        }
        if (levels[UnitType.MINESWEEPER].a >= 2) {
            if (actionType === 'detonate_tower') return idx;
            idx++;
        }
    }

    // Ranger
    if (unit.type === UnitType.RANGER) {
        if (actionType === 'ranger_pickup' || actionType === 'ranger_drop') return idx;
        idx++;
        if (levels[UnitType.RANGER].a >= 3) {
            if (actionType === 'place_hub') return idx;
            idx++;
            if (actionType === 'teleport_hub') return idx;
            idx++;
        }
    }

    // Maker
    if (unit.type === UnitType.MAKER) {
        if (actionType === 'place_mine') return idx;
        idx++;
        if (levels[UnitType.MAKER].a >= 1) {
            if (actionType === 'throw_mine') return idx;
            idx++;
        }
        if (levels[UnitType.MAKER].a >= 3) {
            if (actionType === 'place_factory') return idx;
            idx++;
        }
    }

    // Defuser
    if (unit.type === UnitType.DEFUSER) {
        if (actionType === 'disarm') return idx;
        idx++;
        if (levels[UnitType.DEFUSER].a >= 2) {
            if (actionType === 'move_enemy_mine') return idx;
            idx++;
        }
        if (levels[UnitType.DEFUSER].a >= 3) {
            if (actionType === 'convert_enemy_mine') return idx;
            idx++;
        }
    }

    // Stealth (Common for GEN/RNG/SWE maybe?)
    if (actionType === 'stealth') return idx;

    return 0;
}
