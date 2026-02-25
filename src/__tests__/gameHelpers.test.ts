import { describe, it, expect, vi } from 'vitest';

vi.mock('../../icons', () => ({
    Crown: () => null,
    Eye: () => null,
    Footprints: () => null,
    Bomb: () => null,
    Shield: () => null,
}));

import { UnitType, MineType, PlayerID } from '../types';
import {
    getUnitTypeAbbr,
    getMineBaseCost,
    getUnitName,
    getUnitNameKey,
    getEnemyTerritoryEnergyCost,
    getDisplayCost,
    getActionButtonIndex,
    getEvolutionButtonStartIndex,
} from '../gameHelpers';
import {
    createTestState,
    createTestUnit,
    createTestBuilding,
    setEvolution,
} from './helpers/factories';

// ============================================================
// getUnitTypeAbbr
// ============================================================
describe('getUnitTypeAbbr', () => {
    it('returns "gen" for General', () => {
        expect(getUnitTypeAbbr(UnitType.GENERAL)).toBe('gen');
    });

    it('returns "swp" for Sweeper', () => {
        expect(getUnitTypeAbbr(UnitType.MINESWEEPER)).toBe('swp');
    });

    it('returns "rng" for Ranger', () => {
        expect(getUnitTypeAbbr(UnitType.RANGER)).toBe('rng');
    });

    it('returns "mkr" for Maker', () => {
        expect(getUnitTypeAbbr(UnitType.MAKER)).toBe('mkr');
    });

    it('returns "def" for Defuser', () => {
        expect(getUnitTypeAbbr(UnitType.DEFUSER)).toBe('def');
    });

    it('returns empty string for unknown type', () => {
        expect(getUnitTypeAbbr('Unknown' as UnitType)).toBe('');
    });
});

// ============================================================
// getMineBaseCost
// ============================================================
describe('getMineBaseCost', () => {
    it('returns 5 for Normal mine', () => {
        expect(getMineBaseCost(MineType.NORMAL)).toBe(5);
    });

    it('returns 4 for Slow mine', () => {
        expect(getMineBaseCost(MineType.SLOW)).toBe(4);
    });

    it('returns 6 for Smoke mine', () => {
        expect(getMineBaseCost(MineType.SMOKE)).toBe(6);
    });

    it('returns 9 for Nuke mine', () => {
        expect(getMineBaseCost(MineType.NUKE)).toBe(9);
    });

    it('returns 7 for Chain mine', () => {
        expect(getMineBaseCost(MineType.CHAIN)).toBe(7);
    });

    it('returns 3 for unknown mine type', () => {
        expect(getMineBaseCost('Unknown' as MineType)).toBe(3);
    });
});

// ============================================================
// getUnitName
// ============================================================
describe('getUnitName', () => {
    it('returns "將軍" for General', () => {
        expect(getUnitName(UnitType.GENERAL)).toBe('將軍');
    });

    it('returns "掃雷" for Sweeper', () => {
        expect(getUnitName(UnitType.MINESWEEPER)).toBe('掃雷');
    });

    it('returns "遊俠" for Ranger', () => {
        expect(getUnitName(UnitType.RANGER)).toBe('遊俠');
    });

    it('returns "製雷" for Maker', () => {
        expect(getUnitName(UnitType.MAKER)).toBe('製雷');
    });

    it('returns "解雷" for Defuser', () => {
        expect(getUnitName(UnitType.DEFUSER)).toBe('解雷');
    });

    it('returns "未知" for unknown type', () => {
        expect(getUnitName('Unknown' as UnitType)).toBe('未知');
    });
});

// ============================================================
// getUnitNameKey
// ============================================================
describe('getUnitNameKey', () => {
    it('returns "unit_general" for General', () => {
        expect(getUnitNameKey(UnitType.GENERAL)).toBe('unit_general');
    });

    it('returns "unit_minesweeper" for Sweeper', () => {
        expect(getUnitNameKey(UnitType.MINESWEEPER)).toBe('unit_minesweeper');
    });

    it('returns "unit_ranger" for Ranger', () => {
        expect(getUnitNameKey(UnitType.RANGER)).toBe('unit_ranger');
    });

    it('returns "unit_maker" for Maker', () => {
        expect(getUnitNameKey(UnitType.MAKER)).toBe('unit_maker');
    });

    it('returns "unit_defuser" for Defuser', () => {
        expect(getUnitNameKey(UnitType.DEFUSER)).toBe('unit_defuser');
    });

    it('returns "select_unit" for unknown type', () => {
        expect(getUnitNameKey('Unknown' as UnitType)).toBe('select_unit');
    });
});

// ============================================================
// getEnemyTerritoryEnergyCost
// ============================================================
describe('getEnemyTerritoryEnergyCost', () => {
    it('adds +1 for P1 in enemy territory with baseCost < 5', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 15);
        expect(getEnemyTerritoryEnergyCost(unit, 4)).toBe(5);
    });

    it('adds +2 for P1 in enemy territory with baseCost >= 5', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 15);
        expect(getEnemyTerritoryEnergyCost(unit, 5)).toBe(7);
    });

    it('adds +1 for P2 in enemy territory with baseCost < 5', () => {
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 5);
        expect(getEnemyTerritoryEnergyCost(unit, 3)).toBe(4);
    });

    it('adds +2 for P2 in enemy territory with baseCost >= 5', () => {
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 5);
        expect(getEnemyTerritoryEnergyCost(unit, 6)).toBe(8);
    });

    it('returns baseCost unchanged for P1 in own territory', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        expect(getEnemyTerritoryEnergyCost(unit, 4)).toBe(4);
    });

    it('returns baseCost unchanged for P2 in own territory', () => {
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 15);
        expect(getEnemyTerritoryEnergyCost(unit, 6)).toBe(6);
    });

    it('treats col 12 as enemy territory for P1', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 12);
        expect(getEnemyTerritoryEnergyCost(unit, 4)).toBe(5);
    });

    it('treats col 11 as own territory for P2', () => {
        const unit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 11);
        expect(getEnemyTerritoryEnergyCost(unit, 4)).toBe(4);
    });
});

// ============================================================
// getDisplayCost
// ============================================================
describe('getDisplayCost', () => {
    it('returns baseCost when unit is null', () => {
        const state = createTestState();
        expect(getDisplayCost(null, 5, state)).toBe(5);
    });

    it('returns baseCost for a basic move without modifiers', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        // General at col 1, own territory, no hub, no debuff
        expect(getDisplayCost(unit, 3, state, 'move')).toBe(3);
    });

    it('returns baseCost directly for teleport (ignores territory)', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 15);
        state.players[PlayerID.P1].units.push(unit);
        expect(getDisplayCost(unit, 5, state, 'teleport')).toBe(5);
    });

    it('returns baseCost directly for evolve (ignores territory)', () => {
        const state = createTestState();
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 15);
        state.players[PlayerID.P1].units.push(unit);
        expect(getDisplayCost(unit, 10, state, 'evolve')).toBe(10);
    });

    describe('Ranger B3 move cost', () => {
        it('sets move cost to 2 for Ranger with B3 evolution', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getDisplayCost(unit, 5, state, 'move')).toBe(2);
        });
    });

    describe('Ranger minimum move cost', () => {
        it('enforces minimum move cost of 2 for Ranger', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getDisplayCost(unit, 1, state, 'move')).toBe(2);
        });
    });

    describe('Hub discount', () => {
        it('applies -1 discount when within Manhattan distance 2 of own hub', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            // Unit is at (0, 1). Place a hub at (0, 2) - Manhattan distance 1.
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 0, 2));
            expect(getDisplayCost(unit, 4, state, 'move')).toBe(3);
        });

        it('does not go below 1 with hub discount', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 0, 2));
            expect(getDisplayCost(unit, 1, state, 'move')).toBe(1);
        });

        it('does not apply hub discount for non-move actions', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 0, 2));
            expect(getDisplayCost(unit, 4, state, 'scan')).toBe(4);
        });

        it('does not apply hub discount when beyond Manhattan distance 2', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            // Unit at (0, 1). Hub at (0, 10) - distance 9.
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 0, 10));
            expect(getDisplayCost(unit, 4, state, 'move')).toBe(4);
        });

        it('does not apply discount for enemy hub', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.buildings.push(createTestBuilding('hub', PlayerID.P2, 0, 2));
            expect(getDisplayCost(unit, 4, state, 'move')).toBe(4);
        });
    });

    describe('moveCostDebuff', () => {
        it('adds moveCostDebuff for move actions', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.status.moveCostDebuff = 3;
            expect(getDisplayCost(unit, 4, state, 'move')).toBe(7);
        });

        it('does not add moveCostDebuff for non-move actions', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.status.moveCostDebuff = 3;
            expect(getDisplayCost(unit, 4, state, 'scan')).toBe(4);
        });
    });

    describe('stealth mode', () => {
        it('sets cost to 3 when unit is stealthed', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.status.isStealthed = true;
            expect(getDisplayCost(unit, 2, state, 'move')).toBe(3);
        });

        it('does not override cost for Ranger B3 variant 1 when stealthed', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.status.isStealthed = true;
            // Ranger B3-1 has permanent stealth and cost 2
            expect(getDisplayCost(unit, 5, state, 'move')).toBe(2);
        });

        it('applies stealth cost 3 for Ranger B3 variant 2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.status.isStealthed = true;
            expect(getDisplayCost(unit, 2, state, 'move')).toBe(3);
        });
    });

    describe('territory cost applied last', () => {
        it('applies territory cost after other modifiers', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.c = 15; // enemy territory for P1
            expect(getDisplayCost(unit, 3, state, 'move')).toBe(4); // 3 < 5, +1
        });

        it('applies territory +2 for cost >= 5 after hub discount', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.c = 15; // enemy territory for P1
            // baseCost 6, no hub, so cost stays 6 (>= 5) + 2 = 8
            expect(getDisplayCost(unit, 6, state, 'move')).toBe(8);
        });
    });
});

// ============================================================
// getActionButtonIndex
// ============================================================
describe('getActionButtonIndex', () => {
    it('returns -1 when unit is null', () => {
        const state = createTestState();
        expect(getActionButtonIndex('move', null, state)).toBe(-1);
    });

    it('returns -1 when unit is undefined', () => {
        const state = createTestState();
        expect(getActionButtonIndex('move', undefined, state)).toBe(-1);
    });

    it('returns 1 for move action', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        expect(getActionButtonIndex('move', unit, state)).toBe(1);
    });

    describe('building placement', () => {
        it('returns index for place_tower when Sweeper has A1 evolution', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.MINESWEEPER, 'a', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            expect(getActionButtonIndex('place_tower', unit, state)).toBe(2);
        });

        it('returns index for place_factory when Maker has B1 evolution', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            expect(getActionButtonIndex('place_factory', unit, state)).toBe(2);
        });

        it('returns index for place_hub when Ranger has A1 evolution', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('place_hub', unit, state)).toBe(2);
        });

        it('returns -1 for place_tower when Sweeper has no evolution', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            expect(getActionButtonIndex('place_tower', unit, state)).toBe(-1);
        });
    });

    describe('dismantle on enemy building', () => {
        it('returns correct index for custom_dismantle when on enemy building', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.buildings.push(createTestBuilding('tower', PlayerID.P2, unit.r, unit.c));
            expect(getActionButtonIndex('custom_dismantle', unit, state)).toBe(2);
        });

        it('returns -1 for custom_dismantle when not on enemy building', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            expect(getActionButtonIndex('custom_dismantle', unit, state)).toBe(-1);
        });

        it('returns -1 for custom_dismantle when on own building', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.buildings.push(createTestBuilding('tower', PlayerID.P1, unit.r, unit.c));
            expect(getActionButtonIndex('custom_dismantle', unit, state)).toBe(-1);
        });
    });

    describe('General-specific actions', () => {
        it('returns correct index for attack when General has no flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            expect(getActionButtonIndex('attack', unit, state)).toBe(2);
        });

        it('returns -1 for attack when General has flag and A < 3', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.hasFlag = true;
            expect(getActionButtonIndex('attack', unit, state)).toBe(-1);
        });

        it('returns correct index for attack when General has flag and A >= 3', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.hasFlag = true;
            expect(getActionButtonIndex('attack', unit, state)).toBe(2);
        });
    });

    describe('Minesweeper-specific actions', () => {
        it('returns correct index for scan', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            expect(getActionButtonIndex('scan', unit, state)).toBe(2);
        });

        it('returns correct index for sensor_scan when Sweeper has B1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.MINESWEEPER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            // scan is at 2, sensor_scan at 3
            expect(getActionButtonIndex('sensor_scan', unit, state)).toBe(3);
        });

        it('returns -1 for sensor_scan when Sweeper has no B evolution', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            expect(getActionButtonIndex('sensor_scan', unit, state)).toBe(-1);
        });
    });

    describe('Maker-specific actions', () => {
        it('returns correct index for place_mine', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            expect(getActionButtonIndex('place_mine', unit, state)).toBe(2);
        });
    });

    describe('Ranger-specific actions', () => {
        it('returns correct index for stealth when Ranger has B2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('stealth', unit, state)).toBe(2);
        });

        it('returns correct index for stealth when Ranger has B3 variant 2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('stealth', unit, state)).toBe(2);
        });

        it('returns -1 for stealth when Ranger has B3 variant 1 (permanent stealth)', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('stealth', unit, state)).toBe(-1);
        });

        it('returns -1 for stealth when Ranger has B1 (no stealth yet)', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('stealth', unit, state)).toBe(-1);
        });

        it('returns correct index for drop_mine when Ranger carries a mine', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.carriedMine = {
                id: 'mine-test', type: MineType.NORMAL, owner: PlayerID.P1,
                r: 0, c: 0, revealedTo: [],
            };
            expect(getActionButtonIndex('drop_mine', unit, state)).toBe(2);
        });

        it('returns correct index for throw_mine when Ranger B3-2 carries a mine', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.carriedMine = {
                id: 'mine-test', type: MineType.NORMAL, owner: PlayerID.P1,
                r: 0, c: 0, revealedTo: [],
            };
            // stealth at 2, throw_mine at 3, drop_mine at 4
            expect(getActionButtonIndex('throw_mine', unit, state)).toBe(3);
        });

        it('returns -1 for throw_mine when Ranger B3-1 carries a mine (cannot throw)', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.carriedMine = {
                id: 'mine-test', type: MineType.NORMAL, owner: PlayerID.P1,
                r: 0, c: 0, revealedTo: [],
            };
            expect(getActionButtonIndex('throw_mine', unit, state)).toBe(-1);
        });

        it('returns correct index for pickup_mine when revealed mine is in range', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            // Place a revealed mine within Manhattan distance 2
            state.mines.push({
                id: 'mine-1', type: MineType.NORMAL, owner: PlayerID.P2,
                r: unit.r, c: unit.c + 1, revealedTo: [PlayerID.P1],
            });
            expect(getActionButtonIndex('pickup_mine', unit, state)).toBe(2);
        });

        it('returns -1 for pickup_mine when no mine is in range', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('pickup_mine', unit, state)).toBe(-1);
        });

        it('returns -1 for pickup_mine when already carrying a mine', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            unit.carriedMine = {
                id: 'mine-test', type: MineType.NORMAL, owner: PlayerID.P1,
                r: 0, c: 0, revealedTo: [],
            };
            state.mines.push({
                id: 'mine-1', type: MineType.NORMAL, owner: PlayerID.P2,
                r: unit.r, c: unit.c + 1, revealedTo: [PlayerID.P1],
            });
            expect(getActionButtonIndex('pickup_mine', unit, state)).toBe(-1);
        });
    });

    describe('Defuser-specific actions', () => {
        it('returns correct index for disarm', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            expect(getActionButtonIndex('disarm', unit, state)).toBe(2);
        });

        it('returns correct index for move_mine_start when Defuser has B2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'b', 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            // disarm at 2, move_mine_start at 3
            expect(getActionButtonIndex('move_mine_start', unit, state)).toBe(3);
        });

        it('returns -1 for move_mine_start when Defuser has B1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'b', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            expect(getActionButtonIndex('move_mine_start', unit, state)).toBe(-1);
        });

        it('returns correct index for convert_mine when Defuser has B3 variant 1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            // disarm at 2, move_mine_start at 3, convert_mine at 4
            expect(getActionButtonIndex('convert_mine', unit, state)).toBe(4);
        });

        it('returns -1 for convert_mine when Defuser has B3 variant 2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.DEFUSER, 'b', 3, 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            expect(getActionButtonIndex('convert_mine', unit, state)).toBe(-1);
        });
    });

    describe('teleport action', () => {
        it('returns correct index for Ranger A2 with hub present', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 2);
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 3, 3));
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('teleport', unit, state)).toBeGreaterThan(1);
        });

        it('returns -1 for teleport when no hub exists', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 2);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('teleport', unit, state)).toBe(-1);
        });

        it('returns -1 for teleport when Ranger A1 only', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 1);
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 3, 3));
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            expect(getActionButtonIndex('teleport', unit, state)).toBe(-1);
        });

        it('returns correct index for non-Ranger when Ranger A3 variant 2 with hub', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 3, 2);
            state.buildings.push(createTestBuilding('hub', PlayerID.P1, 3, 3));
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            expect(getActionButtonIndex('teleport', unit, state)).toBeGreaterThan(1);
        });
    });

    describe('flag pickup/drop', () => {
        it('returns correct index for pickup_flag when General is at flag position', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.players[PlayerID.P1].flagPosition = { r: unit.r, c: unit.c };
            expect(getActionButtonIndex('pickup_flag', unit, state)).toBeGreaterThan(1);
        });

        it('returns -1 for pickup_flag when General is not at flag position', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.players[PlayerID.P1].flagPosition = { r: 6, c: 6 };
            expect(getActionButtonIndex('pickup_flag', unit, state)).toBe(-1);
        });

        it('returns correct index for drop_flag when General has flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            unit.hasFlag = true;
            expect(getActionButtonIndex('drop_flag', unit, state)).toBeGreaterThan(1);
        });

        it('returns -1 for drop_flag when General does not have flag', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            expect(getActionButtonIndex('drop_flag', unit, state)).toBe(-1);
        });

        it('allows non-General to carry flag when General B3 is unlocked', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'b', 3, 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            state.players[PlayerID.P1].flagPosition = { r: unit.r, c: unit.c };
            expect(getActionButtonIndex('pickup_flag', unit, state)).toBeGreaterThan(1);
        });

        it('returns -1 for non-General flag pickup without General B3', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            state.players[PlayerID.P1].flagPosition = { r: unit.r, c: unit.c };
            expect(getActionButtonIndex('pickup_flag', unit, state)).toBe(-1);
        });
    });

    describe('end_turn action', () => {
        it('returns a valid index for end_turn', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const idx = getActionButtonIndex('end_turn', unit, state);
            expect(idx).toBeGreaterThan(1);
        });
    });

    describe('unknown action', () => {
        it('returns -1 for completely unknown action type', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            expect(getActionButtonIndex('nonexistent_action', unit, state)).toBe(-1);
        });
    });

    describe('placement + dismantle ordering', () => {
        it('dismantle index comes after placement when both are available', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P1, UnitType.MINESWEEPER, 'a', 1);
            const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            state.buildings.push(createTestBuilding('tower', PlayerID.P2, unit.r, unit.c));
            const placeIdx = getActionButtonIndex('place_tower', unit, state);
            const dismantleIdx = getActionButtonIndex('custom_dismantle', unit, state);
            expect(dismantleIdx).toBe(placeIdx + 1);
        });
    });
});

// ============================================================
// getEvolutionButtonStartIndex
// ============================================================
describe('getEvolutionButtonStartIndex', () => {
    it('returns -1 when unit is null', () => {
        const state = createTestState();
        expect(getEvolutionButtonStartIndex(null, state)).toBe(-1);
    });

    it('returns -1 when unit is undefined', () => {
        const state = createTestState();
        expect(getEvolutionButtonStartIndex(undefined, state)).toBe(-1);
    });

    it('returns a valid start index for General evolution buttons', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const idx = getEvolutionButtonStartIndex(unit, state);
        // evolve_ buttons should come after end_turn, which comes after attack
        // The index should be positive
        expect(idx).toBeGreaterThan(0);
    });

    it('returns the same index as getActionButtonIndex for evolve_a', () => {
        const state = createTestState();
        const unit = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        const startIdx = getEvolutionButtonStartIndex(unit, state);
        const actionIdx = getActionButtonIndex('evolve_a', unit, state);
        // They should match since evolve_a is checked in the keys list
        expect(startIdx).toBe(actionIdx);
    });

    it('returns consistent index for different unit types', () => {
        const state = createTestState();
        const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
        const idx = getEvolutionButtonStartIndex(maker, state);
        expect(idx).toBeGreaterThan(0);
    });
});
