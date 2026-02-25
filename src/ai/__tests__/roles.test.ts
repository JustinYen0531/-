import { describe, it, expect, vi } from 'vitest';
import { assignUnitRoles, evaluateFormationPositionBonus } from '../roles';
import { createInitialOpponentModel } from '../opponentModel';
import { createTestState } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';
import { AIIntent, AIOpponentModel, AIUnitRole } from '../types';

const getUnit = (state: ReturnType<typeof createTestState>, player: PlayerID, type: UnitType) =>
    state.players[player].units.find(u => u.type === type)!;

describe('assignUnitRoles', () => {
    it('assigns General the striker role by default', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        expect(roles[general.id]).toBe('striker');
    });

    it('assigns Ranger the flanker role by default', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const ranger = getUnit(state, PlayerID.P2, UnitType.RANGER);
        expect(roles[ranger.id]).toBe('flanker');
    });

    it('assigns Maker the controller role by default', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const maker = getUnit(state, PlayerID.P2, UnitType.MAKER);
        expect(roles[maker.id]).toBe('controller');
    });

    it('assigns Sweeper the scout role by default', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const sweeper = getUnit(state, PlayerID.P2, UnitType.MINESWEEPER);
        expect(roles[sweeper.id]).toBe('scout');
    });

    it('assigns Defuser the support role by default', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const defuser = getUnit(state, PlayerID.P2, UnitType.DEFUSER);
        expect(roles[defuser.id]).toBe('support');
    });

    it('overrides Ranger to striker on hunt_flag_carrier intent', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'hunt_flag_carrier', model);
        const ranger = getUnit(state, PlayerID.P2, UnitType.RANGER);
        expect(roles[ranger.id]).toBe('striker');
    });

    it('keeps Sweeper as scout on control_mines intent', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'control_mines', model);
        const sweeper = getUnit(state, PlayerID.P2, UnitType.MINESWEEPER);
        expect(roles[sweeper.id]).toBe('scout');
    });

    it('keeps Defuser as support on control_mines intent', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'control_mines', model);
        const defuser = getUnit(state, PlayerID.P2, UnitType.DEFUSER);
        expect(roles[defuser.id]).toBe('support');
    });

    it('overrides General to support on stabilize with high aggression', () => {
        const state = createTestState();
        const model: AIOpponentModel = { ...createInitialOpponentModel(), aggression: 5 };
        const roles = assignUnitRoles(state, PlayerID.P2, 'stabilize', model);
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        expect(roles[general.id]).toBe('support');
    });

    it('does NOT override General on stabilize when aggression is low', () => {
        const state = createTestState();
        const model: AIOpponentModel = { ...createInitialOpponentModel(), aggression: 2 };
        const roles = assignUnitRoles(state, PlayerID.P2, 'stabilize', model);
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        expect(roles[general.id]).toBe('striker');
    });

    it('excludes dead units from role assignment', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        general.isDead = true;
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        expect(roles[general.id]).toBeUndefined();
    });

    it('assigns roles to all alive units', () => {
        const state = createTestState();
        const model = createInitialOpponentModel();
        const roles = assignUnitRoles(state, PlayerID.P2, 'push_flag', model);
        const aliveUnits = state.players[PlayerID.P2].units.filter(u => !u.isDead);
        expect(Object.keys(roles).length).toBe(aliveUnits.length);
    });
});

describe('evaluateFormationPositionBonus', () => {
    it('gives striker bonus for proximity to enemy flag', () => {
        const state = createTestState();
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        // Place close to P1 flag (at r=3, c=0)
        general.r = 3;
        general.c = 2;
        const bonus = evaluateFormationPositionBonus(state, general, 'striker', 'push_flag', PlayerID.P2);
        // distEnemy = |3-3| + |2-0| = 2, so (9 - 2) * 0.7 = 4.9
        // frontlineBalance = distOwn - distEnemy; distOwn = |3-3| + |2-23| = 21; balance = 21-2 = 19; 19*0.25 = 4.75
        // push_flag intent bonus for striker: +1.4
        // Total should be positive and large
        expect(bonus).toBeGreaterThan(5);
    });

    it('gives striker extra bonus when carrying the flag', () => {
        const state = createTestState();
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        general.r = 3;
        general.c = 10;
        const bonusWithout = evaluateFormationPositionBonus(state, general, 'striker', 'push_flag', PlayerID.P2);
        general.hasFlag = true;
        const bonusWith = evaluateFormationPositionBonus(state, general, 'striker', 'push_flag', PlayerID.P2);
        expect(bonusWith - bonusWithout).toBeCloseTo(4, 5);
    });

    it('gives flanker bonus for mobility', () => {
        const state = createTestState();
        const ranger = getUnit(state, PlayerID.P2, UnitType.RANGER);
        // Place in center with lots of free neighbors
        ranger.r = 3;
        ranger.c = 12;
        const bonus = evaluateFormationPositionBonus(state, ranger, 'flanker', 'push_flag', PlayerID.P2);
        // Should include mobility * 0.65 component
        expect(bonus).toBeGreaterThan(0);
    });

    it('gives controller bonus for center column alignment', () => {
        const state = createTestState();
        const maker = getUnit(state, PlayerID.P2, UnitType.MAKER);
        // P1 flag at c=0, P2 flag at c=23, center = 11.5
        maker.r = 3;
        maker.c = 12; // close to center
        const bonus = evaluateFormationPositionBonus(state, maker, 'controller', 'push_flag', PlayerID.P2);
        expect(bonus).toBeGreaterThan(0);
    });

    it('gives scout bonus for high mobility', () => {
        const state = createTestState();
        const sweeper = getUnit(state, PlayerID.P2, UnitType.MINESWEEPER);
        sweeper.r = 3;
        sweeper.c = 12;
        const bonus = evaluateFormationPositionBonus(state, sweeper, 'scout', 'push_flag', PlayerID.P2);
        // mobility * 0.8 + proximity * 0.3 + push_flag penalty of -0.2 for scout role
        expect(bonus).toBeGreaterThan(0);
    });

    it('gives support bonus for proximity to own flag', () => {
        const state = createTestState();
        const defuser = getUnit(state, PlayerID.P2, UnitType.DEFUSER);
        // P2 flag is at r=3, c=23; place defuser near it
        defuser.r = 3;
        defuser.c = 22;
        const bonusNear = evaluateFormationPositionBonus(state, defuser, 'support', 'stabilize', PlayerID.P2);
        // distOwn = |3-3| + |22-23| = 1, so (8-1)*0.75 = 5.25
        // stabilize bonus for support: +1.6
        defuser.c = 5; // far from own flag
        const bonusFar = evaluateFormationPositionBonus(state, defuser, 'support', 'stabilize', PlayerID.P2);
        expect(bonusNear).toBeGreaterThan(bonusFar);
    });

    it('adds intent bonus for push_flag on striker/flanker roles', () => {
        const state = createTestState();
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        general.r = 3;
        general.c = 12;
        const bonusPush = evaluateFormationPositionBonus(state, general, 'striker', 'push_flag', PlayerID.P2);
        const bonusStabilize = evaluateFormationPositionBonus(state, general, 'striker', 'stabilize', PlayerID.P2);
        // push_flag gives +1.4 for striker; stabilize gives -0.8 for striker
        expect(bonusPush - bonusStabilize).toBeCloseTo(1.4 - (-0.8), 5);
    });

    it('adds hunt_flag_carrier bonus for striker role', () => {
        const state = createTestState();
        const general = getUnit(state, PlayerID.P2, UnitType.GENERAL);
        general.r = 3;
        general.c = 12;
        const bonusHunt = evaluateFormationPositionBonus(state, general, 'striker', 'hunt_flag_carrier', PlayerID.P2);
        const bonusControl = evaluateFormationPositionBonus(state, general, 'striker', 'control_mines', PlayerID.P2);
        // hunt: +1.8 for striker; control_mines: -0.4 for striker
        expect(bonusHunt - bonusControl).toBeCloseTo(1.8 - (-0.4), 5);
    });

    it('adds control_mines bonus for controller/scout/support roles', () => {
        const state = createTestState();
        const maker = getUnit(state, PlayerID.P2, UnitType.MAKER);
        maker.r = 3;
        maker.c = 12;
        const bonusMines = evaluateFormationPositionBonus(state, maker, 'controller', 'control_mines', PlayerID.P2);
        const bonusPush = evaluateFormationPositionBonus(state, maker, 'controller', 'push_flag', PlayerID.P2);
        // control_mines gives +1.3 for controller; push_flag gives -0.2 for controller
        expect(bonusMines - bonusPush).toBeCloseTo(1.3 - (-0.2), 5);
    });
});
