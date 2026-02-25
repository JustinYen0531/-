import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PlayerID, UnitType, MineType, GameState, VFXEffect, GameLog, TargetMode } from '../../types';
import {
    createTestState,
    createTestUnit,
    createTestMine,
    createTestBuilding,
    setEvolution,
} from '../../__tests__/helpers/factories';
import { UNIT_STATS, INITIAL_ENERGY, EVOLUTION_COSTS, MAX_MINES_ON_BOARD } from '../../constants';
import { usePlayerActions } from '../usePlayerActions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createHookProps = (stateOverride?: Partial<GameState>) => {
    const baseState = createTestState();
    const state = { ...baseState, ...stateOverride };
    const gameStateRef = { current: state };

    let currentState = state;
    const setGameState = vi.fn((updater: GameState | ((prev: GameState) => GameState)) => {
        if (typeof updater === 'function') {
            currentState = updater(currentState);
        } else {
            currentState = updater;
        }
        gameStateRef.current = currentState;
    });

    const setTargetMode = vi.fn();
    const setSelectedMineType = vi.fn();
    const setShowEvolutionTree = vi.fn();
    const addVFX = vi.fn();
    const addLog = vi.fn();
    const t = vi.fn((key: string) => key);

    return {
        props: {
            setGameState,
            gameStateRef,
            targetMode: null as TargetMode,
            setTargetMode,
            setSelectedMineType,
            setShowEvolutionTree,
            addVFX,
            addLog,
            t,
        },
        getState: () => currentState,
        setGameState,
        addLog,
        addVFX,
        setTargetMode,
        setSelectedMineType,
        setShowEvolutionTree,
        gameStateRef,
    };
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('usePlayerActions', () => {
    // ====================================================================
    // attemptMove
    // ====================================================================
    describe('attemptMove', () => {
        it('moves a unit to the target cell and deducts energy', () => {
            const { props, getState, setGameState } = createHookProps();
            const { result } = renderHook(() => usePlayerActions(props));

            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const cost = UNIT_STATS[UnitType.GENERAL].moveCost;

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, cost);
            });

            expect(setGameState).toHaveBeenCalled();
            const updated = getState();
            const movedUnit = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            expect(movedUnit.c).toBe(general.c + 1);
            expect(updated.players[PlayerID.P1].energy).toBe(INITIAL_ENERGY - cost);
        });

        it('does not move when energy is insufficient', () => {
            const { props, getState, addLog } = createHookProps();
            props.gameStateRef.current.players[PlayerID.P1].energy = 1;
            const { result } = renderHook(() => usePlayerActions(props));

            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.objectContaining({ cost: 3 }));
        });

        it('does not move to a cell occupied by another unit', () => {
            const { props, setGameState } = createHookProps();
            // Place P2 unit at target cell
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const p2General = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            p2General.r = general.r;
            p2General.c = general.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            // setGameState is not called for the move (no state change)
            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does not move to an obstacle cell', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            state.cells[general.r][general.c + 1].isObstacle = true;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('records movement in the state', () => {
            const { props, getState } = createHookProps();
            const { result } = renderHook(() => usePlayerActions(props));
            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const origR = general.r;
            const origC = general.c;

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            const updated = getState();
            expect(updated.movements.length).toBeGreaterThanOrEqual(1);
            const lastMov = updated.movements[updated.movements.length - 1];
            expect(lastMov.unitId).toBe(general.id);
            expect(lastMov.from).toEqual({ r: origR, c: origC });
            expect(lastMov.to).toEqual({ r: origR, c: origC + 1 });
        });

        it('does not move a unit that has already acted this round', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasActedThisRound = true;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does not move a dead unit', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.isDead = true;
            general.hp = 0;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does not allow move during thinking phase', () => {
            const { props, setGameState } = createHookProps({ phase: 'thinking' });
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('increments movesMadeThisTurn after move', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].movesMadeThisTurn = 0;
            const { result } = renderHook(() => usePlayerActions(props));
            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].movesMadeThisTurn).toBe(1);
        });

        it('increments rangerSteps when Ranger moves', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(ranger.id, ranger.r, ranger.c + 1, UNIT_STATS[UnitType.RANGER].moveCost);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.rangerSteps).toBeGreaterThanOrEqual(1);
        });

        it('increments generalFlagSteps when unit carrying flag moves', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = true;
            state.players[PlayerID.P1].flagPosition = { r: general.r, c: general.c };

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 5);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.generalFlagSteps).toBeGreaterThanOrEqual(1);
        });

        it('triggers a mine when stepping on one', () => {
            const { props, getState, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            // Place enemy mine at target cell
            state.mines = [createTestMine(PlayerID.P2, MineType.NORMAL, general.r, general.c + 1)];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, 3);
            });

            const updated = getState();
            const movedGeneral = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            // Mine should have dealt damage
            expect(movedGeneral.hp).toBeLessThan(general.hp);
        });

        it('updates energyUsedThisTurn on the moving unit', () => {
            const { props, getState } = createHookProps();
            const { result } = renderHook(() => usePlayerActions(props));
            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const cost = UNIT_STATS[UnitType.GENERAL].moveCost;

            act(() => {
                result.current.attemptMove(general.id, general.r, general.c + 1, cost);
            });

            const updated = getState();
            const movedUnit = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            expect(movedUnit.energyUsedThisTurn).toBe(cost);
        });
    });

    // ====================================================================
    // handleAttack
    // ====================================================================
    describe('handleAttack', () => {
        it('deals damage to the target unit', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            // Place them adjacent
            target.r = attacker.r;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            const updTarget = updated.players[PlayerID.P2].units.find(u => u.id === target.id)!;
            expect(updTarget.hp).toBeLessThan(target.hp);
        });

        it('deducts attack energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].energy).toBe(INITIAL_ENERGY - UNIT_STATS[UnitType.GENERAL].attackCost);
        });

        it('kills target when hp reaches 0', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;
            target.hp = 1; // Will die from attack

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            const deadTarget = updated.players[PlayerID.P2].units.find(u => u.id === target.id)!;
            expect(deadTarget.isDead).toBe(true);
            expect(deadTarget.hp).toBe(0);
        });

        it('does not attack from out of range', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            // Far apart
            target.r = attacker.r;
            target.c = attacker.c + 5;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            expect(addLog).toHaveBeenCalledWith('log_out_of_range', 'info');
        });

        it('rejects attack if attacker is not a General', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = ranger.r;
            target.c = ranger.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(ranger.id, target);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('rejects attack when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].energy = 1;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy_attack', 'info');
        });

        it('rejects attack when attacker is dead', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            attacker.isDead = true;
            attacker.hp = 0;
            target.r = attacker.r;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('grants kill reward energy on kill', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;
            target.hp = 1;
            state.players[PlayerID.P2].energy = 20;

            const { result } = renderHook(() => usePlayerActions(props));
            const prevEnergy = state.players[PlayerID.P1].energy;

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            // Kill reward = 3 + floor(enemy energy * 0.15)
            const expectedReward = 3 + Math.floor(20 * 0.15);
            expect(updated.players[PlayerID.P1].energyFromKills).toBe(expectedReward);
        });

        it('increments generalDamage quest stat', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.generalDamage).toBeGreaterThan(0);
        });

        it('does not allow attack in non-cardinal direction', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            // Diagonal
            target.r = attacker.r + 1;
            target.c = attacker.c + 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            // dist=2 but not cardinal
            expect(addLog).toHaveBeenCalledWith('log_out_of_range', 'info');
        });

        it('sets gameOver when general is killed', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const attacker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const target = state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
            target.r = attacker.r;
            target.c = attacker.c + 1;
            target.hp = 1;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleAttack(attacker.id, target);
            });

            const updated = getState();
            expect(updated.gameOver).toBe(true);
            expect(updated.winner).toBe(PlayerID.P1);
        });
    });

    // ====================================================================
    // handleScanAction
    // ====================================================================
    describe('handleScanAction', () => {
        it('reveals an enemy mine at the scanned cell', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            const targetR = sweeper.r;
            const targetC = sweeper.c + 1;
            state.mines = [createTestMine(PlayerID.P2, MineType.NORMAL, targetR, targetC)];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, targetR, targetC);
            });

            const updated = getState();
            const mine = updated.mines.find(m => m.r === targetR && m.c === targetC)!;
            expect(mine.revealedTo).toContain(PlayerID.P1);
        });

        it('deducts scan energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, sweeper.r, sweeper.c + 1);
            });

            const updated = getState();
            // Base scan cost is 3 for first two scans
            expect(updated.players[PlayerID.P1].energy).toBeLessThan(INITIAL_ENERGY);
        });

        it('rejects scan when out of range', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, sweeper.r, sweeper.c + 5);
            });

            expect(addLog).toHaveBeenCalledWith('log_scan_range', 'info');
        });

        it('rejects scan when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].energy = 1;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, sweeper.r, sweeper.c + 1);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.any(Object));
        });

        it('increments sweeperMinesMarked when mine found', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
            const targetR = sweeper.r;
            const targetC = sweeper.c + 1;
            state.mines = [createTestMine(PlayerID.P2, MineType.NORMAL, targetR, targetC)];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, targetR, targetC);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.sweeperMinesMarked).toBeGreaterThan(0);
        });

        it('adds sensor result entry on scan', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleScanAction(sweeper, sweeper.r, sweeper.c + 1);
            });

            const updated = getState();
            expect(updated.sensorResults.length).toBeGreaterThan(0);
        });
    });

    // ====================================================================
    // handleMinePlacement (handlePlaceMineAction)
    // ====================================================================
    describe('handleMinePlacement', () => {
        it('places a mine at the target cell', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            const updated = getState();
            const placed = updated.mines.find(m => m.r === maker.r && m.c === maker.c + 1);
            expect(placed).toBeDefined();
            expect(placed!.type).toBe(MineType.NORMAL);
            expect(placed!.owner).toBe(PlayerID.P1);
        });

        it('deducts mine placement energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].energy).toBeLessThan(INITIAL_ENERGY);
        });

        it('rejects when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].energy = 1;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.any(Object));
        });

        it('rejects placement at out-of-range cell', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 5, MineType.NORMAL);
            });

            expect(addLog).toHaveBeenCalledWith('log_maker_range', 'error');
        });

        it('rejects when mine limit is reached', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            // Place MAX_MINES_ON_BOARD mines already
            state.mines = [];
            for (let i = 0; i < MAX_MINES_ON_BOARD; i++) {
                state.mines.push(createTestMine(PlayerID.P1, MineType.NORMAL, 0, 5 + i));
            }
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            expect(addLog).toHaveBeenCalledWith('log_max_mines', 'error');
        });

        it('increments makerMinesPlaced stat', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.makerMinesPlaced).toBeGreaterThan(0);
        });

        it('rejects Slow mine without evolution', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.SLOW);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy_evolve', 'error');
        });

        it('rejects placing where own mine already exists', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            state.mines = [createTestMine(PlayerID.P1, MineType.NORMAL, maker.r, maker.c + 1)];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 1, MineType.NORMAL);
            });

            expect(addLog).toHaveBeenCalledWith('log_space_has_mine', 'error');
        });

        it('B1 rejects 6th mine when no in-range normal mine exists for overflow slot', () => {
            const { props, addLog, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'b', 1);
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 2);
            state.buildings = [createTestBuilding('factory', PlayerID.P1, maker.r, maker.c + 2)];
            state.mines = [
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r, maker.c + 2),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 1, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 2, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 3, maker.c + 8),
            ];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 3, MineType.SMOKE);
            });

            expect(addLog).toHaveBeenCalledWith('log_max_mines', 'error');
            expect(getState().mines.length).toBe(5);
        });

        it('B1 allows 6th special mine when at least one in-range normal mine exists', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'b', 1);
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'a', 2);
            state.buildings = [createTestBuilding('factory', PlayerID.P1, maker.r, maker.c + 2)];
            state.mines = [
                createTestMine(PlayerID.P1, MineType.NORMAL, maker.r, maker.c + 2),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 1, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 2, maker.c + 8),
                createTestMine(PlayerID.P1, MineType.SMOKE, maker.r + 3, maker.c + 8),
            ];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, maker.r, maker.c + 3, MineType.SMOKE);
            });

            const updated = getState();
            expect(updated.mines.length).toBe(6);
            expect(updated.mines.some(m => m.r === maker.r && m.c === maker.c + 3 && m.type === MineType.SMOKE)).toBe(true);
        });

        it('uses Manhattan-2 workshop range at B2 even when workshop.level is still 1', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const maker = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;
            setEvolution(state, PlayerID.P1, UnitType.MAKER, 'b', 2);
            state.buildings = [
                createTestBuilding('factory', PlayerID.P1, maker.r, maker.c + 2, { level: 1 })
            ];

            const targetR = maker.r + 2;
            const targetC = maker.c + 2;
            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleMinePlacement(maker, targetR, targetC, MineType.NORMAL);
            });

            const updated = getState();
            expect(updated.mines.some(m => m.owner === PlayerID.P1 && m.r === targetR && m.c === targetC)).toBe(true);
        });
    });

    // ====================================================================
    // handleDisarm
    // ====================================================================
    describe('handleDisarm', () => {
        it('removes an enemy mine from the board', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const defuser = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            const mineR = defuser.r;
            const mineC = defuser.c + 1;
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, mineR, mineC);
            mine.revealedTo = [PlayerID.P1];
            state.mines = [mine];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDisarm(defuser, mineR, mineC);
            });

            const updated = getState();
            expect(updated.mines.find(m => m.id === mine.id)).toBeUndefined();
        });

        it('deducts disarm energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const defuser = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, defuser.r, defuser.c + 1);
            state.mines = [mine];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDisarm(defuser, mine.r, mine.c);
            });

            const updated = getState();
            const baseCost = UNIT_STATS[UnitType.DEFUSER].disarmCost;
            expect(updated.players[PlayerID.P1].energy).toBe(INITIAL_ENERGY - baseCost);
        });

        it('increments defuserMinesDisarmed stat', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const defuser = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, defuser.r, defuser.c + 1);
            state.mines = [mine];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDisarm(defuser, mine.r, mine.c);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].questStats.defuserMinesDisarmed).toBeGreaterThan(0);
        });

        it('rejects disarm on own mine', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const defuser = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            const mine = createTestMine(PlayerID.P1, MineType.NORMAL, defuser.r, defuser.c + 1);
            state.mines = [mine];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDisarm(defuser, mine.r, mine.c);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('rejects disarm when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].energy = 0;
            const defuser = state.players[PlayerID.P1].units.find(u => u.type === UnitType.DEFUSER)!;
            const mine = createTestMine(PlayerID.P2, MineType.NORMAL, defuser.r, defuser.c + 1);
            state.mines = [mine];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDisarm(defuser, mine.r, mine.c);
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.any(Object));
        });
    });

    // ====================================================================
    // handleEvolution
    // ====================================================================
    describe('handleEvolution', () => {
        it('evolves a unit type branch and deducts cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            // Meet threshold for General A branch level 1
            state.players[PlayerID.P1].questStats.generalDamage = 100;
            state.players[PlayerID.P1].energy = 100;

            const { result } = renderHook(() => usePlayerActions(props));

            let success = false;
            act(() => {
                success = result.current.handleEvolution(UnitType.GENERAL, 'a');
            });

            expect(success).toBe(true);
            const updated = getState();
            expect(updated.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].a).toBe(1);
            expect(updated.players[PlayerID.P1].energy).toBe(100 - EVOLUTION_COSTS[0]);
        });

        it('rejects evolution when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].questStats.generalDamage = 100;
            state.players[PlayerID.P1].energy = 2; // cost is 10

            const { result } = renderHook(() => usePlayerActions(props));

            let success = false;
            act(() => {
                success = result.current.handleEvolution(UnitType.GENERAL, 'a');
            });

            expect(success).toBe(false);
            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.any(Object));
        });

        it('rejects evolution when already at max level', () => {
            const { props } = createHookProps();
            const state = props.gameStateRef.current;
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 3);
            state.players[PlayerID.P1].energy = 100;

            const { result } = renderHook(() => usePlayerActions(props));

            let success = false;
            act(() => {
                success = result.current.handleEvolution(UnitType.GENERAL, 'a');
            });

            expect(success).toBe(false);
        });

        it('sets variant when evolving to level 3', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 2);
            state.players[PlayerID.P1].questStats.generalDamage = 100;
            state.players[PlayerID.P1].energy = 100;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleEvolution(UnitType.GENERAL, 'a', 1);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].a).toBe(3);
            expect(updated.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].aVariant).toBe(1);
        });

        it('hides evolution tree on reaching max level', () => {
            const { props, setShowEvolutionTree } = createHookProps();
            const state = props.gameStateRef.current;
            setEvolution(state, PlayerID.P1, UnitType.GENERAL, 'a', 2);
            state.players[PlayerID.P1].questStats.generalDamage = 100;
            state.players[PlayerID.P1].energy = 100;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleEvolution(UnitType.GENERAL, 'a', 1);
            });

            expect(setShowEvolutionTree).toHaveBeenCalledWith(false);
        });

    });

    // ====================================================================
    // handlePickupFlag / handleDropFlag
    // ====================================================================
    describe('handlePickupFlag', () => {
        it('sets hasFlag to true for the general at flag position', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            const flagPos = state.players[PlayerID.P1].flagPosition;
            general.r = flagPos.r;
            general.c = flagPos.c;
            state.selectedUnitId = general.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePickupFlag();
            });

            const updated = getState();
            const updGeneral = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            expect(updGeneral.hasFlag).toBe(true);
        });

        it('does nothing if unit is not at flag position', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            // general is not at flag position (default factory positions are different)
            state.selectedUnitId = general.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePickupFlag();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does nothing if unit already has flag', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = true;
            state.selectedUnitId = general.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePickupFlag();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does nothing if non-general unit without proper evolution', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            const flagPos = state.players[PlayerID.P1].flagPosition;
            ranger.r = flagPos.r;
            ranger.c = flagPos.c;
            state.selectedUnitId = ranger.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePickupFlag();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });
    });

    describe('handleDropFlag', () => {
        it('drops the flag at current position', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = true;
            state.selectedUnitId = general.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDropFlag();
            });

            const updated = getState();
            const updGeneral = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            expect(updGeneral.hasFlag).toBe(false);
            expect(updated.players[PlayerID.P1].flagPosition).toEqual({ r: general.r, c: general.c });
        });

        it('does nothing if unit does not have flag', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hasFlag = false;
            state.selectedUnitId = general.id;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDropFlag();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('does nothing if no unit is selected', () => {
            const { props, setGameState } = createHookProps();
            props.gameStateRef.current.selectedUnitId = null;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleDropFlag();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // handleActionComplete
    // ====================================================================
    describe('handleActionComplete', () => {
        it('marks the unit as acted this round', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleActionComplete(general.id);
            });

            const updated = getState();
            const updGeneral = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            expect(updGeneral.hasActedThisRound).toBe(true);
        });

        it('switches to the other player after action complete', () => {
            const { props, getState } = createHookProps();

            const { result } = renderHook(() => usePlayerActions(props));
            const general = getState().players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            act(() => {
                result.current.handleActionComplete(general.id);
            });

            const updated = getState();
            expect(updated.currentPlayer).toBe(PlayerID.P2);
        });

        it('does nothing during thinking phase', () => {
            const { props, setGameState } = createHookProps({ phase: 'thinking' });

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleActionComplete('some-id');
            });

            expect(setGameState).not.toHaveBeenCalled();
        });

        it('heals unit by 3 if it did nothing (pass)', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
            general.hp = general.maxHp - 5; // Damaged

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleActionComplete(general.id);
            });

            const updated = getState();
            const updGeneral = updated.players[PlayerID.P1].units.find(u => u.id === general.id)!;
            // Healed by 3 since no move and no energy spent
            expect(updGeneral.hp).toBe(general.hp + 3);
        });

        it('resets selectedUnitId and activeUnitId', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            state.selectedUnitId = 'some-id';
            state.activeUnitId = 'some-id';
            const general = state.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleActionComplete(general.id);
            });

            const updated = getState();
            expect(updated.selectedUnitId).toBeNull();
            expect(updated.activeUnitId).toBeNull();
        });
    });

    // ====================================================================
    // handleTeleportToHub
    // ====================================================================
    describe('handleTeleportToHub', () => {
        it('teleports unit to hub position', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 2);
            const hub = createTestBuilding('hub', PlayerID.P1, 3, 10);
            state.buildings = [hub];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleTeleportToHub(ranger);
            });

            const updated = getState();
            const updRanger = updated.players[PlayerID.P1].units.find(u => u.id === ranger.id)!;
            expect(updRanger.r).toBe(hub.r);
            expect(updRanger.c).toBe(hub.c);
        });

        it('deducts teleport energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 2);
            const hub = createTestBuilding('hub', PlayerID.P1, 3, 10);
            state.buildings = [hub];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleTeleportToHub(ranger);
            });

            const updated = getState();
            expect(updated.players[PlayerID.P1].energy).toBeLessThan(INITIAL_ENERGY);
        });

        it('does nothing when no hub exists', () => {
            const { props, setGameState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            state.buildings = [];

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleTeleportToHub(ranger);
            });

            expect(setGameState).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // handleStealth
    // ====================================================================
    describe('handleStealth', () => {
        it('toggles stealth status and spends 3 energy when activating', () => {
            const { props, getState, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            const beforeEnergy = state.players[PlayerID.P1].energy;
            const beforeEnergyUsed = ranger.energyUsedThisTurn;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleStealth(ranger.id);
            });

            const updated = getState();
            const updRanger = updated.players[PlayerID.P1].units.find(u => u.id === ranger.id)!;
            expect(updRanger.status.isStealthed).toBe(true);
            expect(updated.players[PlayerID.P1].energy).toBe(beforeEnergy - 3);
            expect(updRanger.energyUsedThisTurn).toBe(beforeEnergyUsed + 3);
            expect(addLog).toHaveBeenCalledWith('log_stealth_activated', 'move', expect.any(Object), PlayerID.P1);
        });

        it('untoggles stealth when already stealthed without energy cost', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            ranger.status = { ...ranger.status, isStealthed: true };
            const beforeEnergy = state.players[PlayerID.P1].energy;
            const beforeEnergyUsed = ranger.energyUsedThisTurn;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleStealth(ranger.id);
            });

            const updated = getState();
            const updRanger = updated.players[PlayerID.P1].units.find(u => u.id === ranger.id)!;
            expect(updRanger.status.isStealthed).toBe(false);
            expect(updated.players[PlayerID.P1].energy).toBe(beforeEnergy);
            expect(updRanger.energyUsedThisTurn).toBe(beforeEnergyUsed);
        });

        it('does not activate stealth when energy is below 3', () => {
            const { props, getState, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
            state.players[PlayerID.P1].energy = 2;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleStealth(ranger.id);
            });

            const updated = getState();
            const updRanger = updated.players[PlayerID.P1].units.find(u => u.id === ranger.id)!;
            expect(updRanger.status.isStealthed).not.toBe(true);
            expect(updated.players[PlayerID.P1].energy).toBe(2);
            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'info', expect.objectContaining({ cost: 3 }));
        });

        it('does nothing for nonexistent unit', () => {
            const { props, setGameState } = createHookProps();

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleStealth('nonexistent-id');
            });

            expect(setGameState).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // handleSkipTurn
    // ====================================================================
    describe('handleSkipTurn', () => {
        it('deducts escalating skip cost and increments skipCountThisRound', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].skipCountThisRound = 0;
            state.players[PlayerID.P1].energy = 100;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleSkipTurn();
            });

            const updated = getState();
            // First skip costs 10
            expect(updated.players[PlayerID.P1].energy).toBe(100 - 10);
            expect(updated.players[PlayerID.P1].skipCountThisRound).toBe(1);
        });

        it('rejects skip when energy is insufficient', () => {
            const { props, addLog } = createHookProps();
            const state = props.gameStateRef.current;
            state.players[PlayerID.P1].energy = 5; // skip costs 10

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleSkipTurn();
            });

            expect(addLog).toHaveBeenCalledWith('log_low_energy', 'error', expect.objectContaining({ cost: 10 }));
        });

        it('does nothing during thinking phase', () => {
            const { props, setGameState } = createHookProps({ phase: 'thinking' });

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handleSkipTurn();
            });

            expect(setGameState).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // handlePlaceTower
    // ====================================================================
    describe('handlePlaceTower', () => {
        it('places a tower building when evolution requirement met', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            setEvolution(state, PlayerID.P1, UnitType.MINESWEEPER, 'a', 1);
            const sweeper = state.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePlaceTower(sweeper, sweeper.r, sweeper.c);
            });

            const updated = getState();
            const tower = updated.buildings.find(b => b.type === 'tower' && b.owner === PlayerID.P1);
            expect(tower).toBeDefined();
        });
    });

    // ====================================================================
    // handlePlaceHub
    // ====================================================================
    describe('handlePlaceHub', () => {
        it('places a hub building', () => {
            const { props, getState } = createHookProps();
            const state = props.gameStateRef.current;
            setEvolution(state, PlayerID.P1, UnitType.RANGER, 'a', 1);
            const ranger = state.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;

            const { result } = renderHook(() => usePlayerActions(props));

            act(() => {
                result.current.handlePlaceHub(ranger, ranger.r, ranger.c);
            });

            const updated = getState();
            const hub = updated.buildings.find(b => b.type === 'hub' && b.owner === PlayerID.P1);
            expect(hub).toBeDefined();
        });
    });

    // ====================================================================
    // Return value shape
    // ====================================================================
    describe('return value', () => {
        it('returns all expected handler functions', () => {
            const { props } = createHookProps();
            const { result } = renderHook(() => usePlayerActions(props));

            expect(typeof result.current.attemptMove).toBe('function');
            expect(typeof result.current.handleAttack).toBe('function');
            expect(typeof result.current.handleMinePlacement).toBe('function');
            expect(typeof result.current.handleActionComplete).toBe('function');
            expect(typeof result.current.handleSkipTurn).toBe('function');
            expect(typeof result.current.handlePickupFlag).toBe('function');
            expect(typeof result.current.handleDropFlag).toBe('function');
            expect(typeof result.current.handleScanAction).toBe('function');
            expect(typeof result.current.handleSensorScan).toBe('function');
            expect(typeof result.current.handleEvolution).toBe('function');
            expect(typeof result.current.handlePlaceTower).toBe('function');
            expect(typeof result.current.handlePlaceFactory).toBe('function');
            expect(typeof result.current.handlePlaceHub).toBe('function');
            expect(typeof result.current.handleTeleportToHub).toBe('function');
            expect(typeof result.current.handleDisarm).toBe('function');
            expect(typeof result.current.handleDetonateTower).toBe('function');
            expect(typeof result.current.handleRanger).toBe('function');
            expect(typeof result.current.handleStealth).toBe('function');
            expect(typeof result.current.startNewRound).toBe('function');
        });
    });
});
