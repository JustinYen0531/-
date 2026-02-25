import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateUnitCandidates, generateActionCandidatesForUnit } from '../generator';
import { createTestState, createTestMine, setEvolution } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType, MineType } from '../../types';

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// generateUnitCandidates
// ---------------------------------------------------------------------------

describe('generateUnitCandidates', () => {
    it('returns all alive, non-acted P2 units by default', () => {
        const state = createTestState();
        state.currentPlayer = PlayerID.P2;
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        expect(candidates.length).toBe(5);
        candidates.forEach(c => {
            expect(c.unit.owner).toBe(PlayerID.P2);
            expect(c.unit.isDead).toBe(false);
            expect(c.unit.hasActedThisRound).toBe(false);
        });
    });

    it('filters out dead units', () => {
        const state = createTestState();
        const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        general.isDead = true;
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        expect(candidates.length).toBe(4);
        expect(candidates.find(c => c.unit.type === UnitType.GENERAL)).toBeUndefined();
    });

    it('filters out units that have already acted', () => {
        const state = createTestState();
        const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
        sweeper.hasActedThisRound = true;
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        expect(candidates.length).toBe(4);
        expect(candidates.find(c => c.unit.type === UnitType.MINESWEEPER)).toBeUndefined();
    });

    it('respects aiPlayer parameter for P1', () => {
        const state = createTestState();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal', undefined, PlayerID.P1);
        expect(candidates.length).toBe(5);
        candidates.forEach(c => {
            expect(c.unit.owner).toBe(PlayerID.P1);
        });
    });

    it('each candidate has a score and scoreBreakdown', () => {
        const state = createTestState();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        candidates.forEach(c => {
            expect(typeof c.score).toBe('number');
            expect(c.scoreBreakdown).toBeDefined();
            expect(typeof c.scoreBreakdown.total).toBe('number');
        });
    });

    it('jitter is applied from difficulty weights', () => {
        const state = createTestState();
        // With jitter=0 (mockReturnValue(0.5) => random*jitter - jitter/2 = 0.5*j - j/2 = 0)
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidatesA = generateUnitCandidates(state, 'normal');

        vi.restoreAllMocks();
        // With different random, jitter changes scores
        vi.spyOn(Math, 'random').mockReturnValue(0.0);
        const candidatesB = generateUnitCandidates(state, 'normal');

        // The scores should differ because jitter changes
        const scoresA = candidatesA.map(c => c.score).sort();
        const scoresB = candidatesB.map(c => c.score).sort();
        expect(scoresA).not.toEqual(scoresB);
    });

    it('returns empty array when all units are dead', () => {
        const state = createTestState();
        state.players[PlayerID.P2].units.forEach(u => { u.isDead = true; });
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        expect(candidates.length).toBe(0);
    });

    it('returns empty array when all units have acted', () => {
        const state = createTestState();
        state.players[PlayerID.P2].units.forEach(u => { u.hasActedThisRound = true; });
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const candidates = generateUnitCandidates(state, 'normal');
        expect(candidates.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// generateActionCandidatesForUnit
// ---------------------------------------------------------------------------

describe('generateActionCandidatesForUnit', () => {
    describe('common behavior', () => {
        it('always includes end_turn action', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            const endTurn = actions.find(a => a.type === 'end_turn');
            expect(endTurn).toBeDefined();
            expect(endTurn!.energyCost).toBe(0);
        });

        it('each action has unitId, type, score, and scoreBreakdown', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            actions.forEach(a => {
                expect(a.unitId).toBe(unit.id);
                expect(typeof a.type).toBe('string');
                expect(typeof a.score).toBe('number');
                expect(a.scoreBreakdown).toBeDefined();
            });
        });
    });

    describe('movement', () => {
        it('generates up to 4 directional moves for unit with energy', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 15; // Center-ish, 4 open directions
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            const moves = actions.filter(a => a.type === 'move');
            expect(moves.length).toBeGreaterThanOrEqual(1);
            expect(moves.length).toBeLessThanOrEqual(4);
        });

        it('does not generate moves when energy is 0', () => {
            const state = createTestState();
            state.players[PlayerID.P2].energy = 0;
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 15;
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            const moves = actions.filter(a => a.type === 'move');
            expect(moves.length).toBe(0);
        });

        it('does not move into obstacles', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 15;
            // Block all 4 directions with obstacles
            state.cells[2][15].isObstacle = true;
            state.cells[4][15].isObstacle = true;
            state.cells[3][14].isObstacle = true;
            state.cells[3][16].isObstacle = true;
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            const moves = actions.filter(a => a.type === 'move');
            expect(moves.length).toBe(0);
        });

        it('does not generate moves when energy cap is exceeded', () => {
            const state = createTestState();
            const unit = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            unit.r = 3;
            unit.c = 15;
            // Set low cap: startOfActionEnergy * 0.3333 = cap
            unit.startOfActionEnergy = 6; // cap ~ 2
            unit.energyUsedThisTurn = 2; // used 2, move costs 3, 2+3=5 > 2
            const actions = generateActionCandidatesForUnit(state, unit, 'normal');
            const moves = actions.filter(a => a.type === 'move');
            expect(moves.length).toBe(0);
        });
    });

    describe('attack (General)', () => {
        it('generates attack actions for General when enemy is in range', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = 3;
            general.c = 10;
            const enemyGen = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            enemyGen.r = 3;
            enemyGen.c = 11;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const attacks = actions.filter(a => a.type === 'attack');
            expect(attacks.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate attack for non-General units', () => {
            const state = createTestState();
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 10;
            const enemyGen = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            enemyGen.r = 3;
            enemyGen.c = 11;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const attacks = actions.filter(a => a.type === 'attack');
            expect(attacks.length).toBe(0);
        });

        it('does not generate attack when enemy is out of range', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = 3;
            general.c = 10;
            // All enemies are at default c=1, far away
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const attacks = actions.filter(a => a.type === 'attack');
            expect(attacks.length).toBe(0);
        });
    });

    describe('scan (Minesweeper)', () => {
        it('generates scan actions for Minesweeper', () => {
            const state = createTestState();
            const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            sweeper.r = 3;
            sweeper.c = 10;
            const actions = generateActionCandidatesForUnit(state, sweeper, 'normal');
            const scans = actions.filter(a => a.type === 'scan');
            expect(scans.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate scan for General', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = 3;
            general.c = 10;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const scans = actions.filter(a => a.type === 'scan');
            expect(scans.length).toBe(0);
        });

        it('generates sensor_scan when sweeper has evo B>=1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MINESWEEPER, 'b', 1);
            const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            sweeper.r = 3;
            sweeper.c = 10;
            const actions = generateActionCandidatesForUnit(state, sweeper, 'normal');
            const sensorScans = actions.filter(a => a.type === 'sensor_scan');
            expect(sensorScans.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate sensor_scan when sweeper has no evo B', () => {
            const state = createTestState();
            const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            sweeper.r = 3;
            sweeper.c = 10;
            const actions = generateActionCandidatesForUnit(state, sweeper, 'normal');
            const sensorScans = actions.filter(a => a.type === 'sensor_scan');
            expect(sensorScans.length).toBe(0);
        });
    });

    describe('place_mine (Maker)', () => {
        it('generates place_mine actions for Maker', () => {
            const state = createTestState();
            const maker = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;
            maker.r = 3;
            maker.c = 15;
            const actions = generateActionCandidatesForUnit(state, maker, 'normal');
            const mines = actions.filter(a => a.type === 'place_mine');
            expect(mines.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate place_mine for General', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = 3;
            general.c = 15;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const mines = actions.filter(a => a.type === 'place_mine');
            expect(mines.length).toBe(0);
        });

        it('unlocks SLOW mine type with Maker evo A>=1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MAKER, 'a', 1);
            const maker = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;
            maker.r = 3;
            maker.c = 15;
            const actions = generateActionCandidatesForUnit(state, maker, 'normal');
            const mines = actions.filter(a => a.type === 'place_mine');
            const hasSlowMine = mines.some(a => a.mineType === MineType.SLOW);
            expect(hasSlowMine).toBe(true);
        });

        it('does not include SMOKE mine without Maker evo A>=2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MAKER, 'a', 1);
            const maker = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;
            maker.r = 3;
            maker.c = 15;
            const actions = generateActionCandidatesForUnit(state, maker, 'normal');
            const mines = actions.filter(a => a.type === 'place_mine');
            const hasSmokeMine = mines.some(a => a.mineType === MineType.SMOKE);
            expect(hasSmokeMine).toBe(false);
        });
    });

    describe('disarm (Defuser)', () => {
        it('generates disarm actions for Defuser near enemy mines', () => {
            const state = createTestState();
            const defuser = state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;
            defuser.r = 3;
            defuser.c = 10;
            state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, defuser, 'normal');
            const disarms = actions.filter(a => a.type === 'disarm');
            expect(disarms.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate disarm when no enemy mines are nearby', () => {
            const state = createTestState();
            const defuser = state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;
            defuser.r = 3;
            defuser.c = 10;
            const actions = generateActionCandidatesForUnit(state, defuser, 'normal');
            const disarms = actions.filter(a => a.type === 'disarm');
            expect(disarms.length).toBe(0);
        });

        it('does not generate disarm for non-Defuser units', () => {
            const state = createTestState();
            const maker = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;
            maker.r = 3;
            maker.c = 10;
            state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, maker, 'normal');
            const disarms = actions.filter(a => a.type === 'disarm');
            expect(disarms.length).toBe(0);
        });
    });

    describe('flag interactions', () => {
        it('generates pickup_flag for General at own flag position', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = state.players[PlayerID.P2].flagPosition.r;
            general.c = state.players[PlayerID.P2].flagPosition.c;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const pickup = actions.find(a => a.type === 'pickup_flag');
            expect(pickup).toBeDefined();
            expect(pickup!.energyCost).toBe(0);
        });

        it('does not generate pickup_flag for General NOT at own flag', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.r = 3;
            general.c = 10; // Not at flag
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const pickup = actions.find(a => a.type === 'pickup_flag');
            expect(pickup).toBeUndefined();
        });

        it('generates drop_flag when unit has flag', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = true;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const drop = actions.find(a => a.type === 'drop_flag');
            expect(drop).toBeDefined();
        });

        it('does not generate drop_flag when unit does not have flag', () => {
            const state = createTestState();
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = false;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const drop = actions.find(a => a.type === 'drop_flag');
            expect(drop).toBeUndefined();
        });

        it('allows non-General to pickup flag when General evo B>=3', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'b', 3);
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = state.players[PlayerID.P2].flagPosition.r;
            ranger.c = state.players[PlayerID.P2].flagPosition.c;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const pickup = actions.find(a => a.type === 'pickup_flag');
            expect(pickup).toBeDefined();
        });

        it('does not allow non-General to pickup flag without General evo B>=3', () => {
            const state = createTestState();
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = state.players[PlayerID.P2].flagPosition.r;
            ranger.c = state.players[PlayerID.P2].flagPosition.c;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const pickup = actions.find(a => a.type === 'pickup_flag');
            expect(pickup).toBeUndefined();
        });
    });

    describe('evolution actions', () => {
        it('does not generate evolution when progress is insufficient', () => {
            const state = createTestState();
            // General A threshold[0] = 4, questStats.generalDamage defaults to 0
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const evolutions = actions.filter(a => a.type.startsWith('evolve'));
            expect(evolutions.length).toBe(0);
        });

        it('generates evolve_a when progress meets threshold and energy is sufficient', () => {
            const state = createTestState();
            // General A threshold[0] = 4, cost = 10
            state.players[PlayerID.P2].questStats.generalDamage = 10; // >= 4
            state.players[PlayerID.P2].energy = 50;
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const evolveA = actions.find(a => a.type === 'evolve_a');
            expect(evolveA).toBeDefined();
        });

        it('generates variant choices at level 2', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.GENERAL, 'a', 2);
            // threshold[2] = 20, cost = 30
            state.players[PlayerID.P2].questStats.generalDamage = 25;
            state.players[PlayerID.P2].energy = 50;
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const evolveA1 = actions.find(a => a.type === 'evolve_a_1');
            const evolveA2 = actions.find(a => a.type === 'evolve_a_2');
            expect(evolveA1).toBeDefined();
            expect(evolveA2).toBeDefined();
        });

        it('does not generate evolution when energy is insufficient', () => {
            const state = createTestState();
            state.players[PlayerID.P2].questStats.generalDamage = 10;
            state.players[PlayerID.P2].energy = 5; // cost for level 0->1 is 10
            const general = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            const actions = generateActionCandidatesForUnit(state, general, 'normal');
            const evolutions = actions.filter(a => a.type.startsWith('evolve'));
            expect(evolutions.length).toBe(0);
        });
    });

    describe('Ranger special actions', () => {
        it('generates place_hub when Ranger has evo A>=1 and no hub exists', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.RANGER, 'a', 1);
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 15;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const hub = actions.find(a => a.type === 'place_hub');
            expect(hub).toBeDefined();
        });

        it('does not generate place_hub when hub already exists', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.RANGER, 'a', 1);
            state.buildings.push({
                id: 'hub-1',
                type: 'hub',
                owner: PlayerID.P2,
                r: 3,
                c: 20,
                level: 1,
            });
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 15;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const hub = actions.find(a => a.type === 'place_hub');
            expect(hub).toBeUndefined();
        });

        it('generates teleport when Ranger has evo A>=2 and hub exists', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.RANGER, 'a', 2);
            state.buildings.push({
                id: 'hub-1',
                type: 'hub',
                owner: PlayerID.P2,
                r: 3,
                c: 20,
                level: 1,
            });
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 15;
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const teleport = actions.find(a => a.type === 'teleport');
            expect(teleport).toBeDefined();
        });

        it('generates pickup_mine for Ranger with evo B>=1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.RANGER, 'b', 1);
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 10;
            // Place own mine within range 2
            state.mines.push(createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const pickups = actions.filter(a => a.type === 'pickup_mine');
            expect(pickups.length).toBeGreaterThanOrEqual(1);
        });

        it('does not generate pickup_mine when ranger already carries a mine', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.RANGER, 'b', 1);
            const ranger = state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;
            ranger.r = 3;
            ranger.c = 10;
            ranger.carriedMine = { type: MineType.NORMAL, owner: PlayerID.P2 } as any;
            state.mines.push(createTestMine(PlayerID.P2, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, ranger, 'normal');
            const pickups = actions.filter(a => a.type === 'pickup_mine');
            expect(pickups.length).toBe(0);
        });
    });

    describe('Sweeper tower actions', () => {
        it('generates place_tower when Sweeper has evo A>=1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MINESWEEPER, 'a', 1);
            const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            sweeper.r = 3;
            sweeper.c = 15;
            const actions = generateActionCandidatesForUnit(state, sweeper, 'normal');
            const tower = actions.find(a => a.type === 'place_tower');
            expect(tower).toBeDefined();
        });

        it('does not generate place_tower when tower limit is reached', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MINESWEEPER, 'a', 1);
            // Tower limit is 1 without A3V1
            state.buildings.push({
                id: 'tower-1',
                type: 'tower',
                owner: PlayerID.P2,
                r: 3,
                c: 20,
                level: 1,
            });
            const sweeper = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            sweeper.r = 3;
            sweeper.c = 15;
            const actions = generateActionCandidatesForUnit(state, sweeper, 'normal');
            const tower = actions.find(a => a.type === 'place_tower');
            expect(tower).toBeUndefined();
        });
    });

    describe('Maker factory', () => {
        it('generates place_factory when Maker has evo B>=1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.MAKER, 'b', 1);
            const maker = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;
            maker.r = 3;
            maker.c = 15;
            const actions = generateActionCandidatesForUnit(state, maker, 'normal');
            const factory = actions.find(a => a.type === 'place_factory');
            expect(factory).toBeDefined();
        });
    });

    describe('Defuser advanced actions', () => {
        it('generates move_mine for Defuser with evo B>=2 near enemy mine', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.DEFUSER, 'b', 2);
            const defuser = state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;
            defuser.r = 3;
            defuser.c = 10;
            state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, defuser, 'normal');
            const moveMines = actions.filter(a => a.type === 'move_mine');
            expect(moveMines.length).toBeGreaterThanOrEqual(1);
        });

        it('generates convert_mine for Defuser with evo B3 variant 1', () => {
            const state = createTestState();
            setEvolution(state, PlayerID.P2, UnitType.DEFUSER, 'b', 3, 1);
            const defuser = state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;
            defuser.r = 3;
            defuser.c = 10;
            state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 3, 11));
            const actions = generateActionCandidatesForUnit(state, defuser, 'normal');
            const converts = actions.filter(a => a.type === 'convert_mine');
            expect(converts.length).toBeGreaterThanOrEqual(1);
        });
    });
});
