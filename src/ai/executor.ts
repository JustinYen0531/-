import { MineType, PlayerID } from '../types';
import { AIExecutorContext, AICandidateAction } from './types';

const toEvolutionAction = (type: AICandidateAction['type']): { branch: 'a' | 'b'; variant?: number } | null => {
    switch (type) {
        case 'evolve_a':
            return { branch: 'a' };
        case 'evolve_a_1':
            return { branch: 'a', variant: 1 };
        case 'evolve_a_2':
            return { branch: 'a', variant: 2 };
        case 'evolve_b':
            return { branch: 'b' };
        case 'evolve_b_1':
            return { branch: 'b', variant: 1 };
        case 'evolve_b_2':
            return { branch: 'b', variant: 2 };
        default:
            return null;
    }
};

export const executeAIAction = (action: AICandidateAction, context: AIExecutorContext) => {
    const { state, actions, selectUnit } = context;
    const unit = state.players[PlayerID.P2].units.find(u => u.id === action.unitId);
    if (!unit) return;

    // Some actions in playerActions rely on selectedUnitId.
    selectUnit(unit.id);

    switch (action.type) {
        case 'move':
            if (action.target?.kind === 'cell') {
                actions.attemptMove(unit.id, action.target.r, action.target.c, action.energyCost);
            }
            break;
        case 'attack':
            if (action.target?.kind === 'unit') {
                actions.handleAttack(unit.id, action.target.unit);
            }
            break;
        case 'scan':
            if (action.target?.kind === 'cell') {
                actions.handleScanAction(unit, action.target.r, action.target.c);
            }
            break;
        case 'sensor_scan':
            if (action.target?.kind === 'cell') {
                actions.handleSensorScan(unit.id, action.target.r, action.target.c);
            }
            break;
        case 'place_mine':
            if (action.target?.kind === 'cell') {
                actions.handleMinePlacement(unit, action.target.r, action.target.c, action.mineType ?? MineType.NORMAL);
            }
            break;
        case 'place_tower':
            actions.handlePlaceTowerAction(unit, unit.r, unit.c);
            break;
        case 'place_factory':
            actions.handlePlaceFactoryAction(unit, unit.r, unit.c);
            break;
        case 'place_hub':
            actions.handlePlaceHubAction(unit, unit.r, unit.c);
            break;
        case 'teleport':
            actions.handleTeleportToHubAction(unit);
            break;
        case 'detonate_tower':
            actions.handleDetonateTowerAction(unit);
            break;
        case 'throw_mine':
            if (action.target?.kind === 'cell') {
                actions.handleThrowMineAction(unit, action.target.r, action.target.c);
            }
            break;
        case 'pickup_mine':
            if (action.target?.kind === 'cell') {
                actions.handlePickupMineAt(unit, action.target.r, action.target.c);
            } else {
                actions.handleRangerAction('pickup');
            }
            break;
        case 'drop_mine':
            actions.handleRangerAction('drop');
            break;
        case 'move_mine':
            if (action.target?.kind === 'cell' && action.sourceCell) {
                actions.handleMoveEnemyMineAction(unit, action.sourceCell.r, action.sourceCell.c, action.target.r, action.target.c);
            }
            break;
        case 'convert_mine':
            if (action.target?.kind === 'cell') {
                actions.handleConvertEnemyMineAction(unit, action.target.r, action.target.c);
            }
            break;
        case 'disarm':
            if (action.target?.kind === 'cell') {
                actions.handleDisarm(unit, action.target.r, action.target.c);
            }
            break;
        case 'pickup_flag':
            actions.handlePickupFlag();
            break;
        case 'drop_flag':
            actions.handleDropFlag();
            break;
        case 'evolve_a':
        case 'evolve_a_1':
        case 'evolve_a_2':
        case 'evolve_b':
        case 'evolve_b_1':
        case 'evolve_b_2': {
            const evolution = toEvolutionAction(action.type);
            if (evolution) {
                actions.handleEvolution(unit.type, evolution.branch, evolution.variant);
            }
            break;
        }
        case 'end_turn':
            actions.handleActionComplete(unit.id);
            break;
    }
};
