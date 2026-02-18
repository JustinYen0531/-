import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, PlayerState, Building, Coordinates
} from './types';
import {
    GRID_ROWS, GRID_COLS, UNIT_STATS, ORE_REWARDS,
    ENERGY_CAP_RATIO, EVOLUTION_COSTS, EVOLUTION_CONFIG,
    MAX_INTEREST, ENERGY_REGEN
} from './constants';
import { getUnitName } from './gameHelpers';

// --- Logic from handleAttack (Damage Calculation) ---
export const calculateAttackDamage = (
    attacker: Unit,
    target: Unit,
    attackerPlayer: PlayerState,
    targetPlayer: PlayerState,
    isGodMode: boolean = false
): number => {
    let dmg = UNIT_STATS[UnitType.GENERAL].attackDmg;

    // General Evolution Path A: Damage Scaling
    // Level 1+: 6 damage
    if (attacker.type === UnitType.GENERAL && attackerPlayer.evolutionLevels[UnitType.GENERAL].a >= 1) {
        dmg = 6;
    }

    // General Evolution Path B: Damage Reduction Aura (Target Side)
    const genLevelB_Target = targetPlayer.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB_Target >= 2) {
        const flag = targetPlayer.flagPosition;
        // Chebyshev distance
        const distToFlag = Math.max(Math.abs(target.r - flag.r), Math.abs(target.c - flag.c));
        if (distToFlag <= 2) { // 5x5 area -> radius 2
            dmg = Math.floor(dmg * 0.7);
        }
    }

    if (isGodMode) return 0;
    return dmg;
};

// --- Logic from startNewRound (Energy, Quest, Resurrection etc.) ---
export const calculateEnergyIncome = (
    currentEnergy: number,
    turnCount: number,
    oreIncome: number,
    killIncome: number
): number => {
    // Dynamic Regen Rule
    let currentRegen = ENERGY_REGEN; // 35
    if (turnCount >= 12) currentRegen = 50;
    else if (turnCount >= 8) currentRegen = 45;
    else if (turnCount >= 4) currentRegen = 40;

    const interest = Math.min(Math.floor(currentEnergy / 10), MAX_INTEREST);
    return currentEnergy + currentRegen + interest + oreIncome + killIncome;
};

// --- Helper to verify mine trigger logic (this might need state context) ---
// Note: Actual trigger logic involves checking position overlap.
export const shouldTriggerMine = (unit: Unit, mine: Mine, player: PlayerState): boolean => {
    // Basic check: Same position
    if (unit.r !== mine.r || unit.c !== mine.c) return false;

    // Flying Logic (Maker A3-2): Maker ignores mines
    const makerLevelA = player.evolutionLevels[UnitType.MAKER].a;
    const makerVariantA = player.evolutionLevels[UnitType.MAKER].aVariant;
    if (unit.type === UnitType.MAKER && makerLevelA >= 3 && makerVariantA === 2) {
        return false;
    }

    // Add other immunity checks if needed (e.g. mine.immuneUnitIds)
    if (mine.immuneUnitIds?.includes(unit.id)) {
        return false;
    }

    return true;
};
