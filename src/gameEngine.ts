import {
    Unit, Mine, UnitType, MineType, PlayerState, PlayerID,
    UnitStatus, SmokeEffect, QuestStats, Cell
} from './types';
import {
    UNIT_STATS, MINE_DAMAGE, ENERGY_CAP_RATIO,
    MAX_INTEREST, ENERGY_REGEN, GRID_ROWS, GRID_COLS, ORE_REWARDS
} from './constants';

/**
 * Calculates the damage dealt by an attacker to a target.
 * Pure logic involving unit stats, evolution bonuses, and game rules.
 */
export const calculateAttackDamage = (
    _attacker: Unit,
    target: Unit,
    _attackerPlayer: PlayerState,
    targetPlayer: PlayerState,
    isGodMode: boolean = false
): { damage: number, logKey?: string } => {
    let dmg = UNIT_STATS[UnitType.GENERAL].attackDmg;
    let logKey: string | undefined;

    // General Evolution Path B: Damage Reduction Aura (Target Side) (Tier 2)
    const genLevelB_Target = targetPlayer.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB_Target >= 2) {
        const flag = targetPlayer.flagPosition;
        // Chebyshev distance
        const distToFlag = Math.max(Math.abs(target.r - flag.r), Math.abs(target.c - flag.c));
        if (distToFlag <= 2) { // 5x5 area -> radius 2
            dmg = Math.floor(dmg * 0.75);
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
 * Dynamic ore reward scaling by round to keep ore economy relevant in mid/late game.
 */
export const calculateOreReward = (
    oreSize: NonNullable<Cell['oreSize']>,
    turnCount: number
): number => {
    const base = ORE_REWARDS[oreSize];
    if (turnCount >= 12) return Math.ceil(base * 1.6);
    if (turnCount >= 8) return Math.ceil(base * 1.4);
    if (turnCount >= 4) return Math.ceil(base * 1.2);
    return base;
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
    newMaxHpBonus: number; // For Defuser A2 (Self)
    healAmount: number; // For Defuser A2 (Self)
    reflectedDamage: number; // For Defuser A3-1
    teamMaxHpBonus?: number; // For Defuser A2 (Team)
    teamHealAmount?: number; // For Defuser A2 (Team)
    teamLowHpHealAmount?: number; // For Defuser A2 (Team, <50% HP)
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
        const minesAtTarget = mines.filter(m => m.r === targetR && m.c === targetC);
        activeMine = minesAtTarget.find(m => shouldTriggerMine(unit, m, unitOwnerState));
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
    let dmg = MINE_DAMAGE; // Default Normal Mine: 8

    // Determine Base Damage by Type
    if (activeMine.type === MineType.SMOKE) {
        dmg = 7;
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
        dmg = 4;
        // Slow Mine applies a flat +2 move cost this round and next round.
        result.statusUpdates.moveCostDebuff = Math.max(unit.status.moveCostDebuff || 0, 2);
        result.statusUpdates.moveCostDebuffDuration = Math.max(unit.status.moveCostDebuffDuration || 0, 2);
        result.logKeys.push('log_heavy_steps');
    } else if (activeMine.type === MineType.NUKE) {
        dmg = 12;
    }

    // Defuser Base Trait: 50% Mine Damage Reduction (Applies to ALL mines)
    if (unit.type === UnitType.DEFUSER) {
        dmg = Math.floor(dmg * 0.5);
    }

    // Vulnerability Debuff
    dmg += (unit.status.mineVulnerability || 0);

    // General Evol B2 (Owner Aura)
    const genLevelB = unitOwnerState.evolutionLevels[UnitType.GENERAL].b;
    if (genLevelB >= 2) {
        const flag = unitOwnerState.flagPosition;
        const distToFlag = Math.max(Math.abs(unit.r - flag.r), Math.abs(unit.c - flag.c));
        if (distToFlag <= 2) {
            dmg = Math.floor(dmg * 0.75);
            result.logKeys.push('log_evol_gen_b_dmg_reduce');
        }
    }

    // Defuser Logic (Active Skills / Team Buffs)
    const defLevels = unitOwnerState.evolutionLevels[UnitType.DEFUSER];
    const defLevelA = defLevels.a;
    const defVariantA = defLevels.aVariant;

    // Team-wide Damage Reduction (A1 / A3-2)
    // "Except Defuser, whole team takes reduction..."
    if (defLevelA >= 1 && unit.type !== UnitType.DEFUSER) {
        let reduction = 1;
        if (unit.hp < unit.maxHp * 0.5) reduction = 2;

        if (defLevelA >= 3 && defVariantA === 2) {
            // A3-2: Team reduction 2, 3 if HP < 50%
            reduction = 2;
            if (unit.hp < unit.maxHp * 0.5) reduction = 3;
        }
        dmg = Math.max(0, dmg - reduction);
    }

    // Defuser Specific Enhancements
    if (unit.type === UnitType.DEFUSER) {
        // A3-2: Defuser specific mine reduction increased to 75%
        if (defLevelA >= 3 && defVariantA === 2) {
            // Base was already halved at line 201. To get to 75% reduction (1/4 remaining), we halve it again.
            dmg = Math.floor(dmg * 0.5);
        }

        // A2: Team Heal when triggering mine
        if (defLevelA >= 2) {
            // No max HP increase; heal 1, or heal 2 if HP < 50%.
            result.teamMaxHpBonus = 0;
            result.teamHealAmount = 1;
            result.teamLowHpHealAmount = 2;

            // Set Self Buffs (redundant if using team fields correctly in hook, but defining purely for self too if needed)
            // But to avoid double counting, we will rely on team fields in the hook.
            // Leaving these as 0 ensures no double dip if logic assumes them separate.
            result.newMaxHpBonus = 0;
            result.healAmount = 0;

            result.logKeys.push('log_evol_def_a_heal');
        }
    }

    // A3-1: Damage Reflection / Infliction (Any Unit / Defuser Bonus)
    // "Whenever character triggers mine, deal 2 dmg to lowest HP enemy"
    // "If Defuser triggers, deal 4 dmg"
    if (defLevelA >= 3 && defVariantA === 1) {
        const reflectAmount = (unit.type === UnitType.DEFUSER) ? 3 : 2;
        result.reflectedDamage = reflectAmount;
        // Manual log in hook to include target name
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
