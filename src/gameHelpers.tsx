
import { UnitType, MineType, Unit, GameState, PlayerID } from './types';

import { Crown, Eye, Footprints, Bomb, Shield } from './icons';

export const getUnitTypeAbbr = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return 'gen';
        case UnitType.MINESWEEPER: return 'swp';
        case UnitType.RANGER: return 'rng';
        case UnitType.MAKER: return 'mkr';
        case UnitType.DEFUSER: return 'def';
        default: return '';
    }
};

export const getMineBaseCost = (type: MineType): number => {
    switch (type) {
        case MineType.NORMAL: return 5;
        case MineType.SLOW: return 4;
        case MineType.SMOKE: return 6;
        case MineType.NUKE: return 9;
        case MineType.CHAIN: return 7;
        default: return 3;
    }
};

export const getUnitIcon = (type: UnitType, size: number = 18, tier: number = 0) => {
    if (type === UnitType.GENERAL && tier > 0) {
        return (
            <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{
                filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))',
                strokeWidth: '3px',
                stroke: 'currentColor'
            }} />
        );
    }

    switch (type) {
        case UnitType.GENERAL: return <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MINESWEEPER: return <Eye size={size} className="text-cyan-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.RANGER: return <Footprints size={size} className="text-emerald-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MAKER: return <Bomb size={size} className="text-red-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(252, 165, 165, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.DEFUSER: return <Shield size={size} className="text-blue-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        default: return null;
    }
};

export const getUnitName = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return '將軍';
        case UnitType.MINESWEEPER: return '掃雷';
        case UnitType.RANGER: return '遊俠';
        case UnitType.MAKER: return '製雷';
        case UnitType.DEFUSER: return '解雷';
        default: return '未知';
    }
};

export const getUnitNameKey = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return 'unit_general';
        case UnitType.MINESWEEPER: return 'unit_minesweeper';
        case UnitType.RANGER: return 'unit_ranger';
        case UnitType.MAKER: return 'unit_maker';
        case UnitType.DEFUSER: return 'unit_defuser';
        default: return 'select_unit';
    }
};

// --- Helper: Calculate cost increase for enemy territory ---
export const getEnemyTerritoryEnergyCost = (unit: Unit, baseCost: number): number => {
    const isP1 = unit.owner === PlayerID.P1;
    const isInEnemyTerritory = isP1 ? unit.c >= 12 : unit.c < 12;

    if (!isInEnemyTerritory) return baseCost;

    if (baseCost < 5) {
        return baseCost + 1;
    } else {
        return baseCost + 2;
    }
};

// --- Helper: Get display cost for UI ---
export const getDisplayCost = (unit: Unit | null, baseCost: number, state: GameState, actionType: string = 'move'): number => {
    if (!unit) return baseCost;
    const player = state.players[unit.owner];

    let cost = baseCost;

    // 2. unit/evolution reductions (standard movement modifiers)
    if (actionType === 'move') {
        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
        if (rngLevelB >= 3 && unit.type === UnitType.RANGER) {
            cost = 2; // Ranger B3-1: Permanent stealth and move cost 2
        }
    }

    // Hub discount applies ONLY to MOVE
    if (actionType === 'move') {
        const hub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        if (hub && (Math.abs(hub.r - unit.r) + Math.abs(hub.c - unit.c) <= 2)) {
            cost = Math.max(1, cost - 1);
        }
    }

    // 3. moveCostDebuff additions (Double cost is implemented as +BaseCost)
    // ONLY apply for move action
    if (actionType === 'move' && unit.status.moveCostDebuff > 0) {
        cost += unit.status.moveCostDebuff;
    }

    // Stealth Mode: Base move cost is 3
    if (actionType === 'move' && unit.status.isStealthed) {
        const player = state.players[unit.owner];
        const isRangerB3_1 = unit.type === UnitType.RANGER &&
            player.evolutionLevels[UnitType.RANGER].b >= 3 &&
            player.evolutionLevels[UnitType.RANGER].bVariant === 1;

        if (!isRangerB3_1) {
            cost = 3;
        }
    }

    // Special Case: Teleport and Evolution always ignore territory cost.
    if (actionType === 'teleport' || actionType === 'evolve') {
        return baseCost;
    }

    // 4. territory cost
    cost = getEnemyTerritoryEnergyCost(unit, cost);

    return cost;
};

// --- Helper: Calculate button index for action buttons ---
export const getActionButtonIndex = (actionType: string, unit: Unit | null | undefined, state: GameState): number => {
    if (!unit) return -1;

    let index = 0;

    // Button 1: Move (always first)
    if (actionType === 'move') return 1;
    index = 2;

    const player = state.players[unit.owner];

    // Button 2: Placement skills (if available)
    const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
    const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
    const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

    if (canPlaceTower || canPlaceFactory || canPlaceHub) {
        if (actionType === 'place_tower' || actionType === 'place_factory' || actionType === 'place_hub') return index;
        index++;
    }

    // --- Universal Dismantle (If on enemy building) ---
    const isOnEnemyBuilding = state.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
    if (isOnEnemyBuilding) {
        if (actionType === 'custom_dismantle') return index;
        index++;
    }

    // Button 3+: Unit-specific actions
    if (unit.type === UnitType.GENERAL) {
        const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
        const canAttack = !unit.hasFlag || genLevelA >= 3;

        if (canAttack) {
            if (actionType === 'attack') return index;
            index++;
        }
    } else if (unit.type === UnitType.MINESWEEPER) {
        if (actionType === 'scan') return index;
        index++;

        const swpB = player.evolutionLevels[UnitType.MINESWEEPER].b;
        if (swpB >= 1) {
            if (actionType === 'sensor_scan') return index;
            index++;
        }
    } else if (unit.type === UnitType.MAKER) {
        if (actionType === 'place_mine') return index;
        index++;
    } else if (unit.type === UnitType.RANGER) {
        // Stealth (B2) - Prioritize to index 2
        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
        const isB31 = rngLevelB >= 3 && player.evolutionLevels[UnitType.RANGER].bVariant === 1;
        if (rngLevelB >= 2 && (!isB31 || !unit.status.isStealthed)) {
            if (actionType === 'stealth') return index;
            index++;
        }

        const pickupRange = rngLevelB >= 1 ? 2 : 0;
        const mineInRange = state.mines.find(m =>
            (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
            (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
        );
        if (!unit.carriedMine && mineInRange) {
            if (actionType === 'pickup_mine') return index;
            index++;
        }
        if (unit.carriedMine) {
            // Throw mine only if B3-2
            const canThrow = rngLevelB === 3 && player.evolutionLevels[UnitType.RANGER].bVariant === 2;
            if (canThrow) {
                if (actionType === 'throw_mine') return index;
                index++;
            }
            if (actionType === 'drop_mine') return index;
            index++;
        }
    } else if (unit.type === UnitType.DEFUSER) {
        if (actionType === 'disarm') return index;
        index++;
        const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
        if (defLevelB >= 2) {
            if (actionType === 'move_mine_start') return index;
            index++;
        }
        if (defLevelB === 3 && player.evolutionLevels[UnitType.DEFUSER].bVariant === 1) {
            if (actionType === 'convert_mine') return index;
            index++;
        }
    }

    // --- Teleport Action (Moved After unit-specific skills) ---
    const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
    const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
    const hasHub = state.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
    const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && hasHub;
    if (canTeleport) {
        if (actionType === 'teleport') return index;
        index++;
    }

    // Global Pickup/Drop Action (for Flag)
    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
    const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
    const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
    if (canCarryFlag) {
        if (!unit.hasFlag && isAtFlag) {
            if (actionType === 'pickup_flag') return index;
            index++;
        }
        if (unit.hasFlag) {
            if (actionType === 'drop_flag') return index;
            index++;
        }
    }

    // Button: End turn (always last)
    if (actionType === 'end_turn') return index;

    // Button: Evolution (dynamic mapping)
    if (actionType.startsWith('evolve_')) {
        if (actionType === 'evolve_a_1' || actionType === 'evolve_a_2' || actionType === 'evolve_a') {
            return index;
        }
    }

    return -1;
};

export const getEvolutionButtonStartIndex = (unit: Unit | null | undefined, state: GameState): number => {
    if (!unit) return -1;
    const keys = ['evolve_a_1', 'evolve_a', 'evolve_a_2', 'evolve_b_1', 'evolve_b', 'evolve_b_2'];
    for (const key of keys) {
        const idx = getActionButtonIndex(key, unit, state);
        if (idx > 0) return idx;
    }
    return -1;
};
