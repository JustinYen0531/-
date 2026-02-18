
import { UnitType, MineType, Unit, GameState, PlayerID } from './types';
import { UNIT_STATS } from './constants';
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
        case MineType.SLOW: return 2;
        case MineType.SMOKE: return 3;
        case MineType.NUKE: return 10;
        case MineType.CHAIN: return 5;
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

    // 1. unit/evolution reductions (standard movement modifiers)
    // (Ranger global move cost reduction removed as per user request)
    if (actionType === 'move') {
        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
        if (rngLevelB >= 3 && unit.type === UnitType.RANGER) {
            cost = 2; // Ranger B3-1: Permanent stealth and move cost 2
        }
    }

    // Hub discount applies to both MOVE and PLACE_HUB
    if (actionType === 'move' || actionType === 'place_hub') {
        const hub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        if (hub && Math.abs(hub.r - unit.r) <= 1 && Math.abs(hub.c - unit.c) <= 1) {
            cost = Math.max(1, cost - 1);
        }
    }

    // Ranger Enforce Minimum Cost of 2
    if (unit.type === UnitType.RANGER && actionType === 'move') {
        cost = Math.max(2, cost);
    }

    // 2. moveCostDebuff additions (Double cost is implemented as +BaseCost)
    // ONLY apply for move action
    if (actionType === 'move' && unit.status.moveCostDebuff > 0) {
        cost += unit.status.moveCostDebuff;
    }

    // 3. territory cost
    cost = getEnemyTerritoryEnergyCost(unit, cost);

    return cost;
};
