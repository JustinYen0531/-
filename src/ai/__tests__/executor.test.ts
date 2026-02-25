import { describe, expect, it, vi } from 'vitest';
import { MineType, PlayerID, UnitType } from '../../types';
import { createTestState, createTestUnit } from '../../__tests__/helpers/factories';
import { executeAIAction } from '../executor';
import { AIActions, AICandidateAction, AIExecutorContext } from '../types';

const makeAction = (
    unitId: string,
    type: AICandidateAction['type'],
    overrides: Partial<AICandidateAction> = {}
): AICandidateAction => ({
    unitId,
    type,
    energyCost: 2,
    score: 10,
    scoreBreakdown: { total: 10 },
    ...overrides,
});

const createMockActions = (): AIActions => ({
    attemptMove: vi.fn(),
    handleAttack: vi.fn(),
    handleScanAction: vi.fn(),
    handleSensorScan: vi.fn(),
    handleMinePlacement: vi.fn(),
    handlePlaceTowerAction: vi.fn(),
    handlePlaceFactoryAction: vi.fn(),
    handlePlaceHubAction: vi.fn(),
    handleTeleportToHubAction: vi.fn(),
    handleDetonateTowerAction: vi.fn(),
    handleThrowMineAction: vi.fn(),
    handlePickupMineAt: vi.fn(),
    handleMoveEnemyMineAction: vi.fn(),
    handleConvertEnemyMineAction: vi.fn(),
    handleRangerAction: vi.fn(),
    handleDisarm: vi.fn(),
    handleEvolution: vi.fn(),
    handlePickupFlag: vi.fn(),
    handleDropFlag: vi.fn(),
    handleActionComplete: vi.fn(),
});

const createContext = (actions: AIActions): AIExecutorContext => {
    const state = createTestState('pve');
    return {
        state,
        actions,
        selectUnit: vi.fn(),
    };
};

describe('executeAIAction', () => {
    it('calls selectUnit with the unit id before dispatching', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'end_turn');
        executeAIAction(action, context);

        expect(context.selectUnit).toHaveBeenCalledWith(unit.id);
    });

    it('does nothing when unit is not found', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);

        const action = makeAction('non-existent-unit', 'move', {
            target: { kind: 'cell', r: 0, c: 0 },
        });
        executeAIAction(action, context);

        expect(context.selectUnit).not.toHaveBeenCalled();
        expect(mockActions.attemptMove).not.toHaveBeenCalled();
    });

    it('dispatches move to attemptMove', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'move', {
            target: { kind: 'cell', r: 3, c: 10 },
            energyCost: 3,
        });
        executeAIAction(action, context);

        expect(mockActions.attemptMove).toHaveBeenCalledWith(unit.id, 3, 10, 3);
    });

    it('dispatches attack to handleAttack', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;
        const targetUnit = context.state.players[PlayerID.P1].units.find(u => u.type === UnitType.MAKER)!;

        const action = makeAction(unit.id, 'attack', {
            target: { kind: 'unit', unit: targetUnit },
        });
        executeAIAction(action, context);

        expect(mockActions.handleAttack).toHaveBeenCalledWith(unit.id, targetUnit);
    });

    it('dispatches scan to handleScanAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const action = makeAction(unit.id, 'scan', {
            target: { kind: 'cell', r: 2, c: 15 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleScanAction).toHaveBeenCalledWith(unit, 2, 15);
    });

    it('dispatches sensor_scan to handleSensorScan', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const action = makeAction(unit.id, 'sensor_scan', {
            target: { kind: 'cell', r: 2, c: 15 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleSensorScan).toHaveBeenCalledWith(unit.id, 2, 15);
    });

    it('dispatches place_mine to handleMinePlacement with mine type', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;

        const action = makeAction(unit.id, 'place_mine', {
            target: { kind: 'cell', r: 4, c: 20 },
            mineType: MineType.CHAIN,
        });
        executeAIAction(action, context);

        expect(mockActions.handleMinePlacement).toHaveBeenCalledWith(unit, 4, 20, MineType.CHAIN);
    });

    it('dispatches place_mine with default NORMAL mine type', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;

        const action = makeAction(unit.id, 'place_mine', {
            target: { kind: 'cell', r: 4, c: 20 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleMinePlacement).toHaveBeenCalledWith(unit, 4, 20, MineType.NORMAL);
    });

    it('dispatches place_tower to handlePlaceTowerAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const action = makeAction(unit.id, 'place_tower');
        executeAIAction(action, context);

        expect(mockActions.handlePlaceTowerAction).toHaveBeenCalledWith(unit, unit.r, unit.c);
    });

    it('dispatches place_factory to handlePlaceFactoryAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MAKER)!;

        const action = makeAction(unit.id, 'place_factory');
        executeAIAction(action, context);

        expect(mockActions.handlePlaceFactoryAction).toHaveBeenCalledWith(unit, unit.r, unit.c);
    });

    it('dispatches place_hub to handlePlaceHubAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'place_hub');
        executeAIAction(action, context);

        expect(mockActions.handlePlaceHubAction).toHaveBeenCalledWith(unit, unit.r, unit.c);
    });

    it('dispatches teleport to handleTeleportToHubAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'teleport');
        executeAIAction(action, context);

        expect(mockActions.handleTeleportToHubAction).toHaveBeenCalledWith(unit);
    });

    it('dispatches detonate_tower to handleDetonateTowerAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.MINESWEEPER)!;

        const action = makeAction(unit.id, 'detonate_tower');
        executeAIAction(action, context);

        expect(mockActions.handleDetonateTowerAction).toHaveBeenCalledWith(unit);
    });

    it('dispatches throw_mine to handleThrowMineAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'throw_mine', {
            target: { kind: 'cell', r: 3, c: 18 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleThrowMineAction).toHaveBeenCalledWith(unit, 3, 18);
    });

    it('dispatches pickup_mine with cell target to handlePickupMineAt', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'pickup_mine', {
            target: { kind: 'cell', r: 2, c: 21 },
        });
        executeAIAction(action, context);

        expect(mockActions.handlePickupMineAt).toHaveBeenCalledWith(unit, 2, 21);
    });

    it('dispatches pickup_mine without cell target to handleRangerAction pickup', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'pickup_mine');
        executeAIAction(action, context);

        expect(mockActions.handleRangerAction).toHaveBeenCalledWith('pickup');
    });

    it('dispatches drop_mine to handleRangerAction drop', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'drop_mine');
        executeAIAction(action, context);

        expect(mockActions.handleRangerAction).toHaveBeenCalledWith('drop');
    });

    it('dispatches move_mine to handleMoveEnemyMineAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;

        const action = makeAction(unit.id, 'move_mine', {
            sourceCell: { r: 4, c: 21 },
            target: { kind: 'cell', r: 4, c: 20 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleMoveEnemyMineAction).toHaveBeenCalledWith(unit, 4, 21, 4, 20);
    });

    it('dispatches convert_mine to handleConvertEnemyMineAction', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;

        const action = makeAction(unit.id, 'convert_mine', {
            target: { kind: 'cell', r: 4, c: 21 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleConvertEnemyMineAction).toHaveBeenCalledWith(unit, 4, 21);
    });

    it('dispatches disarm to handleDisarm', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.DEFUSER)!;

        const action = makeAction(unit.id, 'disarm', {
            target: { kind: 'cell', r: 4, c: 21 },
        });
        executeAIAction(action, context);

        expect(mockActions.handleDisarm).toHaveBeenCalledWith(unit, 4, 21);
    });

    it('dispatches pickup_flag to handlePickupFlag', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'pickup_flag');
        executeAIAction(action, context);

        expect(mockActions.handlePickupFlag).toHaveBeenCalled();
    });

    it('dispatches drop_flag to handleDropFlag', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'drop_flag');
        executeAIAction(action, context);

        expect(mockActions.handleDropFlag).toHaveBeenCalled();
    });

    it('dispatches evolve_a to handleEvolution with branch a', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'evolve_a');
        executeAIAction(action, context);

        expect(mockActions.handleEvolution).toHaveBeenCalledWith(unit.type, 'a', undefined);
    });

    it('dispatches evolve_b_2 to handleEvolution with branch b and variant 2', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.RANGER)!;

        const action = makeAction(unit.id, 'evolve_b_2');
        executeAIAction(action, context);

        expect(mockActions.handleEvolution).toHaveBeenCalledWith(unit.type, 'b', 2);
    });

    it('dispatches end_turn to handleActionComplete', () => {
        const mockActions = createMockActions();
        const context = createContext(mockActions);
        const unit = context.state.players[PlayerID.P2].units.find(u => u.type === UnitType.GENERAL)!;

        const action = makeAction(unit.id, 'end_turn');
        executeAIAction(action, context);

        expect(mockActions.handleActionComplete).toHaveBeenCalledWith(unit.id);
    });
});
