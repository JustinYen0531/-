import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ControlPanel from '../ControlPanel';
import { PlayerID, UnitType, MineType } from '../../types';
import { createTestState, createTestUnit } from '../../__tests__/helpers/factories';

// Mock child components to simplify rendering
vi.mock('../UnitInfoPanel', () => ({
    default: () => <div data-testid="unit-info-panel" />,
}));

vi.mock('../EvolutionTree', () => ({
    default: (props: any) => (
        <div data-testid="evolution-tree">
            <button data-testid="close-evolution" onClick={props.onClose}>Close</button>
        </div>
    ),
}));

vi.mock('../SpeedyShoe', () => ({
    default: () => <span data-testid="speedy-shoe" />,
}));

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => {
    const createIcon = (name: string) => (props: any) => <span data-testid={`icon-${name}`} />;
    return {
        Zap: createIcon('zap'),
        Dna: createIcon('dna'),
        Play: createIcon('play'),
        ArrowRight: createIcon('arrow-right'),
        CheckCircle: createIcon('check-circle'),
        Bomb: createIcon('bomb'),
        Swords: createIcon('swords'),
        ArrowDownToLine: createIcon('arrow-down'),
        Flag: createIcon('flag'),
        Eye: createIcon('eye'),
        Radio: createIcon('radio'),
        FlaskConical: createIcon('flask'),
        Unlock: createIcon('unlock'),
        Cpu: createIcon('cpu'),
        Cloud: createIcon('cloud'),
        Snowflake: createIcon('snowflake'),
        Share2: createIcon('share2'),
        Radiation: createIcon('radiation'),
        Ghost: createIcon('ghost'),
        Scan: createIcon('scan'),
        Heart: createIcon('heart'),
        Magnet: createIcon('magnet'),
        Brain: createIcon('brain'),
    };
});

// Mock gameEngine and gameHelpers to avoid importing complex logic
vi.mock('../../gameEngine', () => ({
    calculateOreReward: () => 0,
}));

vi.mock('../../gameHelpers', () => ({
    getMineBaseCost: () => 3,
    getUnitNameKey: (type: string) => type.toLowerCase(),
}));

const buildDefaultProps = (overrides: Record<string, any> = {}) => {
    const gameState = createTestState();
    gameState.gameMode = 'pvp';
    return {
        gameState,
        targetMode: null as any,
        setTargetMode: vi.fn(),
        selectedMineType: MineType.NORMAL,
        setSelectedMineType: vi.fn(),
        showEvolutionTree: false,
        setShowEvolutionTree: vi.fn(),
        language: 'en',
        t: (key: string, params?: any) => key,
        aiDecision: null,
        actions: {
            handleActionComplete: vi.fn(),
            handleScanAction: vi.fn(),
            handlePlaceMineAction: vi.fn(),
            handleEvolve: vi.fn(),
            handlePickupFlag: vi.fn(),
            handleDropFlag: vi.fn(),
            handleAttack: vi.fn(),
            handleStealth: vi.fn(),
            handleSkipTurn: vi.fn(),
        },
        helpers: {
            getUnit: (id: string | null) => {
                if (!id) return null;
                const state = overrides.gameState || gameState;
                const p1 = state.players[PlayerID.P1].units.find((u: any) => u.id === id);
                if (p1) return p1;
                return state.players[PlayerID.P2].units.find((u: any) => u.id === id) || null;
            },
            getActionButtonIndex: (_action: string, _unit: any) => 1,
            getEvolutionButtonStartIndex: (_unit: any) => 5,
            getDisplayCost: (_unit: any, baseCost: number) => baseCost,
            getNextUnitToAct: () => null,
        },
        phases: {
            finishPlacementPhase: vi.fn(),
            startActionPhase: vi.fn(),
        },
        handleUnitClick: vi.fn(),
        handleDisarmAction: vi.fn(),
        handlePlaceTowerAction: vi.fn(),
        handleDetonateTowerAction: vi.fn(),
        handlePlaceFactoryAction: vi.fn(),
        handlePlaceHubAction: vi.fn(),
        handleTeleportToHubAction: vi.fn(),
        handleStealthAction: vi.fn(),
        handleRangerAction: vi.fn(),
        swapUnits: vi.fn(),
        isLocalPlayerTurn: true,
        localPlayerId: PlayerID.P1,
        ...overrides,
    };
};

describe('ControlPanel', () => {
    it('renders without crashing', () => {
        const props = buildDefaultProps();
        const { container } = render(<ControlPanel {...props} />);
        expect(container).toBeTruthy();
    });

    it('displays player energy', () => {
        const props = buildDefaultProps();
        render(<ControlPanel {...props} />);
        const energyValue = props.gameState.players[PlayerID.P1].energy;
        expect(screen.getByText(String(energyValue))).toBeTruthy();
    });

    it('shows the evolution tree button', () => {
        const props = buildDefaultProps();
        render(<ControlPanel {...props} />);
        // The evolution_tree button text comes from t('evolution_tree')
        expect(screen.getByText('evolution_tree')).toBeTruthy();
    });

    it('calls setShowEvolutionTree when evolution tree button is clicked', () => {
        const setShowEvolutionTree = vi.fn();
        const props = buildDefaultProps({ setShowEvolutionTree });
        render(<ControlPanel {...props} />);
        const evoButton = screen.getByText('evolution_tree');
        fireEvent.click(evoButton);
        expect(setShowEvolutionTree).toHaveBeenCalledWith(true);
    });

    it('renders the EvolutionTree component when showEvolutionTree is true', () => {
        const props = buildDefaultProps({ showEvolutionTree: true });
        render(<ControlPanel {...props} />);
        expect(screen.getByTestId('evolution-tree')).toBeTruthy();
    });

    it('hides the EvolutionTree component when showEvolutionTree is false', () => {
        const props = buildDefaultProps({ showEvolutionTree: false });
        render(<ControlPanel {...props} />);
        expect(screen.queryByTestId('evolution-tree')).toBeFalsy();
    });

    it('shows placement phase UI during placement', () => {
        const gameState = createTestState();
        gameState.phase = 'placement';
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('placement_phase')).toBeTruthy();
    });

    it('shows confirm placement button during placement phase', () => {
        const gameState = createTestState();
        gameState.phase = 'placement';
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('confirm_placement')).toBeTruthy();
    });

    it('calls finishPlacementPhase when confirm placement is clicked', () => {
        const gameState = createTestState();
        gameState.phase = 'placement';
        const finishPlacementPhase = vi.fn();
        const props = buildDefaultProps({
            gameState,
            phases: { finishPlacementPhase, startActionPhase: vi.fn() },
        });
        render(<ControlPanel {...props} />);
        const confirmBtn = screen.getByText('confirm_placement');
        fireEvent.click(confirmBtn);
        expect(finishPlacementPhase).toHaveBeenCalled();
    });

    it('shows planning_phase text during thinking phase', () => {
        const gameState = createTestState();
        gameState.phase = 'thinking';
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        // planning_phase text should appear (both as heading and button label)
        const planningTexts = screen.getAllByText('planning_phase');
        expect(planningTexts.length).toBeGreaterThan(0);
    });

    it('shows select_unit text when no unit is selected in action phase', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        gameState.selectedUnitId = null;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('select_unit')).toBeTruthy();
    });

    it('shows select_action text when a unit is selected in action phase', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const general = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        gameState.selectedUnitId = general.id;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('select_action')).toBeTruthy();
    });

    it('shows move button when a unit is selected', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const general = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        gameState.selectedUnitId = general.id;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('move')).toBeTruthy();
    });

    it('keeps move mode active styling when selected unit is stealthed', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const ranger = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.RANGER)!;
        ranger.status = { ...ranger.status, isStealthed: true };
        gameState.selectedUnitId = ranger.id;
        const props = buildDefaultProps({ gameState, targetMode: 'move' });
        render(<ControlPanel {...props} />);
        const moveButton = screen.getByText('move').closest('button');
        expect(moveButton?.className).toContain('bg-emerald-600');
    });

    it('shows end_turn button when a unit is selected', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const general = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        gameState.selectedUnitId = general.id;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('end_turn')).toBeTruthy();
    });

    it('shows attack button when General is selected', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const general = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        gameState.selectedUnitId = general.id;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('attack')).toBeTruthy();
    });

    it('shows scan button when Minesweeper is selected', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        const sweeper = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.MINESWEEPER)!;
        gameState.selectedUnitId = sweeper.id;
        const props = buildDefaultProps({ gameState });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('scan')).toBeTruthy();
    });

    it('shows wait_opponent_action when interaction is disabled and not placement', () => {
        const gameState = createTestState();
        gameState.phase = 'action';
        gameState.selectedUnitId = null;
        const props = buildDefaultProps({
            gameState,
            isLocalPlayerTurn: false,
        });
        render(<ControlPanel {...props} />);
        expect(screen.getByText('wait_opponent_action')).toBeTruthy();
    });

    it('renders UnitInfoPanel component', () => {
        const props = buildDefaultProps();
        render(<ControlPanel {...props} />);
        expect(screen.getByTestId('unit-info-panel')).toBeTruthy();
    });
});
