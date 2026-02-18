import {
    Unit, Mine, UnitType, MineType, PlayerState, PlayerID,
    UnitStatus, SmokeEffect, QuestStats
} from './types';
import {
    UNIT_STATS, MINE_DAMAGE, ENERGY_CAP_RATIO,
    MAX_INTEREST, ENERGY_REGEN, GRID_ROWS, GRID_COLS
} from './constants';

/**
 * Calculates the damage dealt by an attacker to a target.
 * Pure logic involving unit stats, evolution bonuses, and game rules.
 */
export const calculateAttackDamage = (
    attacker: Unit,
    target: Unit,
    attackerPlayer: PlayerState,
    targetPlayer: PlayerState,
    isGodMode: boolean = false
): { damage: number, logKey?: string } => {
    let dmg = UNIT_STATS[UnitType.GENERAL].attackDmg;
    let logKey: string | undefined;

    // General Evolution Path A: Damage Scaling
    // Level 1+: 6 damage
    if (attacker.type === UnitType.GENERAL && attackerPlayer.evolutionLevels[UnitType.GENERAL].a >= 1) {
        dmg = 6;
    }

    // General Evolution Path B: Damage Reduction Aura (Target Side) (Tier 2)
    const genLevelB_Target = targetPlayer.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB_Target >= 2) {
        const flag = targetPlayer.flagPosition;
        // Chebyshev distance
        const distToFlag = Math.max(Math.abs(target.r - flag.r), Math.abs(target.c - flag.c));
        if (distToFlag <= 2) { // 5x5 area -> radius 2
            dmg = Math.floor(dmg * 0.7);
            logKey = 'log_evol_gen_b_dmg_reduce';
        }
    }

    if (isGodMode) dmg = 0;

    return { damage: dmg, logKey };
};

/**
 * Calculates energy income for a new round.
 */
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

/**
 * Checks if a unit triggers a mine.
 * Handles immunity logic (e.g. Maker hovering).
 */
export const shouldTriggerMine = (
    unit: Unit,
    mine: Mine,
    player: PlayerState
): boolean => {
    // 1. Basic Owner Check (Friendly mines don't trigger by default)
    if (mine.owner === unit.owner) return false;

    // 2. Specific Immunity Check (e.g. newly placed mines?)
    if (mine.immuneUnitIds?.includes(unit.id)) return false;

    // 3. Maker Flying Logic (Evolution A3-2)
    const makerLevelA = player.evolutionLevels[UnitType.MAKER].a;
    const makerVariantA = player.evolutionLevels[UnitType.MAKER].aVariant;
    if (unit.type === UnitType.MAKER && makerLevelA >= 3 && makerVariantA === 2) {
        return false;
    }

    return true;
};

export interface MineTriggerResult {
    damage: number;
    triggered: boolean;
    mineOwnerId: PlayerID | null;
    statusUpdates: Partial<UnitStatus>; // e.g. moveCostDebuff, isStealthed
    logKeys: string[];
    isNukeTriggered: boolean;
    nukeBlastCenter?: { r: number, c: number };
    createdSmokes: SmokeEffect[];
    newMaxHpBonus: number; // For Defuser A2
    healAmount: number; // For Defuser A2
    reflectedDamage: number; // For Defuser A3-1
}

/**
 * Calculates the result of a mine trigger event.
 * Handles damage calculation, status effects, and special mine types (Nuke, Smoke, Slow).
 */
export const calculateMineInteraction = (
    unit: Unit,
    mines: Mine[],
    targetR: number,
    targetC: number,
    unitOwnerState: PlayerState,
    unitStartR: number,
    unitStartC: number
): MineTriggerResult => {
    const result: MineTriggerResult = {
        damage: 0,
        triggered: false,
        mineOwnerId: null,
        statusUpdates: {},
        logKeys: [],
        isNukeTriggered: false,
        createdSmokes: [],
        newMaxHpBonus: 0,
        healAmount: 0,
        reflectedDamage: 0
    };

    // 1. Check for Proximity Mines (Nuke) first (3x3 area)
    const proximityNuke = mines.find(m =>
        m.type === MineType.NUKE &&
        m.owner !== unit.owner &&
        Math.abs(m.r - targetR) <= 1 && Math.abs(m.c - targetC) <= 1 &&
        // Fix: Only trigger if the unit was outside the 3x3 range of this specific mine
        Math.max(Math.abs(m.r - unitStartR), Math.abs(m.c - unitStartC)) > 1
    );

    let activeMine = proximityNuke;
    if (activeMine) {
        result.isNukeTriggered = true;
        result.nukeBlastCenter = { r: activeMine.r, c: activeMine.c };
    } else {
        // Fallback to direct contact
        activeMine = mines.find(m => m.r === targetR && m.c === targetC);
        if (activeMine && activeMine.type === MineType.NUKE) {
            result.isNukeTriggered = true;
            result.nukeBlastCenter = { r: activeMine.r, c: activeMine.c };
        }
    }

    if (!activeMine) return result;

    // Check Trigger Logic
    if (!shouldTriggerMine(unit, activeMine, unitOwnerState) && !result.isNukeTriggered) {
        if (!shouldTriggerMine(unit, activeMine, unitOwnerState)) return result;
    }

    result.triggered = true;
    result.mineOwnerId = activeMine.owner;

    // --- Calculate Damage & Effects ---
    let dmg = MINE_DAMAGE; // 8

    // Defuser Base Trait: 50% Mine Damage Reduction
    if (unit.type === UnitType.DEFUSER) {
        dmg = Math.floor(dmg * 0.5);
    }

    // Ranger Logic: Break Stealth (B2)

    // Vulnerability Debuff
    dmg += (unit.status.mineVulnerability || 0);

    // General Evol A1 (Self Debuff)
    if (unit.type === UnitType.GENERAL) {
        const genLevelA = unitOwnerState.evolutionLevels[UnitType.GENERAL].a;
        if (genLevelA >= 1) {
            dmg += 2;
            result.logKeys.push('log_evol_gen_a_mine_vuln');
        }
    }

    // General Evol B2 (Owner Aura)
    const genLevelB = unitOwnerState.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB >= 2) {
        const flag = unitOwnerState.flagPosition;
        const distToFlag = Math.max(Math.abs(unit.r - flag.r), Math.abs(unit.c - flag.c));
        if (distToFlag <= 2) {
            dmg = Math.floor(dmg * 0.7);
            result.logKeys.push('log_evol_gen_b_dmg_reduce');
        }
    }

    // Defuser Logic
    if (unit.type === UnitType.DEFUSER) {
        const defLevels = unitOwnerState.evolutionLevels[UnitType.DEFUSER];
        const defLevelA = defLevels.a;
        const defVariantA = defLevels.aVariant;

        // A1 / A3-2
        if (defLevelA >= 1) {
            const lowHpThreshold = unit.maxHp * 0.5;
            let reduction = 1;
            if (unit.hp < lowHpThreshold) reduction = 2; // Dynamic check, assuming CURRENT hp passed in unit object

            if (defLevelA >= 3 && defVariantA === 2) {
                reduction = 3;
                if (unit.hp < lowHpThreshold) reduction = 4;
            }
            dmg = Math.max(0, dmg - reduction);
        }

        // A2: Heal/MaxHP
        if (defLevelA >= 2) {
            result.newMaxHpBonus = 2;
            result.healAmount = 1;
            result.logKeys.push('log_evol_def_a_heal');
        }

        // A3-1 / A3-2 Reduction
        if (defLevelA >= 3) {
            if (defVariantA === 1) {
                result.reflectedDamage = 2;
                result.logKeys.push('log_evol_def_reflect');
            } else if (defVariantA === 2) {
                dmg = Math.floor(dmg * 0.25);
                result.logKeys.push('log_defuser_reduce');
            }
        }
    }

    // Special Mine Types
    if (activeMine.type === MineType.SMOKE) {
        dmg = 5;
        // Create Smoke
        const smokeIdBase = `smoke-${Date.now()}`;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = targetR + dr;
                const nc = targetC + dc;
                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                    result.createdSmokes.push({
                        id: `${smokeIdBase}-${dr}-${dc}`,
                        r: nr, c: nc,
                        owner: activeMine.owner,
                        duration: 3
                    });
                }
            }
        }
        result.logKeys.push('log_smoke_deployed');
    } else if (activeMine.type === MineType.SLOW) {
        dmg = 3;
        // We accumulate debuff
        const currentDebuff = unit.status.moveCostDebuff || 0;
        const baseMove = UNIT_STATS[unit.type].moveCost;
        result.statusUpdates.moveCostDebuff = currentDebuff + baseMove;
        result.statusUpdates.moveCostDebuffDuration = 3;
        result.logKeys.push('log_heavy_steps');
    } else if (activeMine.type === MineType.NUKE) {
        dmg = 12; // Direct hit logic (even if proximity triggered for main unit)
        // AoE damage is handled separately by caller using nukeBlastCenter
    }

    result.damage = dmg;
    return result;
};

/**
 * Checks if a move is valid based on energy cap.
 */
export const checkEnergyCap = (
    unit: Unit,
    cost: number
): boolean => {
    const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
    return unit.energyUsedThisTurn + cost <= cap;
};

/**
 * Updates Quest Stats after a round or action.
 */
export const updateQuestStats = (
    stats: QuestStats,
    updates: Partial<QuestStats>
): QuestStats => {
    return { ...stats, ...updates };
};
