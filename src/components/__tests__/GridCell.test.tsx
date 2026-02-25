import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GridCell from '../GridCell';
import { Cell, PlayerID, UnitType, MineType } from '../../types';
import { P1_FLAG_POS, P2_FLAG_POS } from '../../constants';
import { createTestUnit, createTestMine, createTestBuilding } from '../../__tests__/helpers/factories';

// Mock icon components to avoid rendering SVG internals
vi.mock('../../icons', () => ({
    Crown: () => <span data-testid="icon-crown" />,
    Eye: () => <span data-testid="icon-eye" />,
    Footprints: () => <span data-testid="icon-footprints" />,
    Bomb: () => <span data-testid="icon-bomb" />,
    Shield: () => <span data-testid="icon-shield" />,
    Crosshair: () => <span data-testid="icon-crosshair" />,
    Mountain: () => <span data-testid="icon-mountain" />,
    Flame: () => <span data-testid="icon-flame" />,
    Flag: () => <span data-testid="icon-flag" />,
    Gem: () => <span data-testid="icon-gem" />,
    Zap: () => <span data-testid="icon-zap" />,
    FlaskConical: () => <span data-testid="icon-flask" />,
    Wind: () => <span data-testid="icon-wind" />,
    CircleDot: () => <span data-testid="icon-circledot" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    Cpu: () => <span data-testid="icon-cpu" />,
    Cloud: () => <span data-testid="icon-cloud" />,
    Share2: () => <span data-testid="icon-share2" />,
    Radiation: () => <span data-testid="icon-radiation" />,
    Snowflake: () => <span data-testid="icon-snowflake" />,
}));

// Mock the CSS import
vi.mock('../GridCell.css', () => ({}));

const createCell = (r: number, c: number, overrides: Partial<Cell> = {}): Cell => ({
    r,
    c,
    isObstacle: false,
    isFlagBase: null,
    hasEnergyOre: false,
    oreSize: null,
    ...overrides,
});

const buildDefaultProps = (overrides: Record<string, any> = {}) => ({
    cell: createCell(3, 5),
    phase: 'action' as const,
    isSelected: false,
    isValidMove: false,
    isAttackTarget: false,
    currentPlayer: PlayerID.P1,
    onClick: vi.fn(),
    p1FlagLoc: P1_FLAG_POS,
    p2FlagLoc: P2_FLAG_POS,
    ...overrides,
});

describe('GridCell', () => {
    it('renders a basic empty cell', () => {
        const props = buildDefaultProps();
        const { container } = render(<GridCell {...props} />);
        // The cell root should have the cell id
        const cellEl = container.querySelector('#cell-3-5');
        expect(cellEl).toBeTruthy();
    });

    it('calls onClick when the cell is clicked', () => {
        const onClick = vi.fn();
        const props = buildDefaultProps({ onClick });
        const { container } = render(<GridCell {...props} />);
        const cellEl = container.querySelector('#cell-3-5')!;
        fireEvent.click(cellEl);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders with a unit present', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        // Unit should render its icon area (the unit-icon div)
        const unitIcon = container.querySelector('.unit-icon');
        expect(unitIcon).toBeTruthy();
    });

    it('does not render dead units', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, { isDead: true });
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        const unitIcon = container.querySelector('.unit-icon');
        expect(unitIcon).toBeFalsy();
    });

    it('renders a visible mine owned by current player', () => {
        const mine = createTestMine(PlayerID.P1, MineType.NORMAL, 3, 5);
        const props = buildDefaultProps({ mine });
        const { container } = render(<GridCell {...props} />);
        // The mine should be visible (it renders a Bomb icon area with animate-pulse)
        const mineEl = container.querySelector('.animate-pulse');
        expect(mineEl).toBeTruthy();
    });

    it('renders a visible mine when forceShowMines is true', () => {
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        const props = buildDefaultProps({ mine, forceShowMines: true });
        const { container } = render(<GridCell {...props} />);
        const mineEl = container.querySelector('.animate-pulse');
        expect(mineEl).toBeTruthy();
    });

    it('does not render an enemy mine that is not revealed', () => {
        const mine = createTestMine(PlayerID.P2, MineType.NORMAL, 3, 5);
        const props = buildDefaultProps({ mine, forceShowMines: false });
        const { container } = render(<GridCell {...props} />);
        // The mine should NOT be visible because the owner is P2 and currentPlayer is P1
        // and it is not revealed to P1
        const mineEl = container.querySelector('.animate-pulse');
        expect(mineEl).toBeFalsy();
    });

    it('renders energy ore when cell has ore', () => {
        const cell = createCell(3, 5, { hasEnergyOre: true, oreSize: 'medium' });
        const props = buildDefaultProps({ cell });
        const { container } = render(<GridCell {...props} />);
        // EnergyCrystal renders an SVG with class energy-crystal-container
        const oreEl = container.querySelector('.energy-crystal-container');
        expect(oreEl).toBeTruthy();
    });

    it('renders a building (tower) when present', () => {
        const building = createTestBuilding('tower', PlayerID.P1, 3, 5);
        const props = buildDefaultProps({ building });
        const { container } = render(<GridCell {...props} />);
        // Tower renders a building-range-indicator
        const buildingEl = container.querySelector('.building-range-indicator');
        expect(buildingEl).toBeTruthy();
    });

    it('renders a building (hub) when present', () => {
        const building = createTestBuilding('hub', PlayerID.P1, 3, 5);
        const props = buildDefaultProps({ building });
        const { container } = render(<GridCell {...props} />);
        const buildingEl = container.querySelector('.building-range-indicator') || container.querySelector('svg');
        expect(buildingEl).toBeTruthy();
    });

    it('renders a building (factory) when present', () => {
        const building = createTestBuilding('factory', PlayerID.P1, 3, 5);
        const props = buildDefaultProps({ building });
        const { container } = render(<GridCell {...props} />);
        const buildingEl = container.querySelector('.building-range-indicator');
        expect(buildingEl).toBeTruthy();
    });

    it('applies obstacle styling for obstacle cells', () => {
        const cell = createCell(3, 5, { isObstacle: true });
        const props = buildDefaultProps({ cell });
        const { container } = render(<GridCell {...props} />);
        const cellEl = container.querySelector('#cell-3-5');
        // Obstacle cells get the pattern-diagonal-lines class
        expect(cellEl?.className).toContain('pattern-diagonal-lines');
    });

    it('applies selected highlight class when isSelected is true', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        const props = buildDefaultProps({ unit, isSelected: true });
        const { container } = render(<GridCell {...props} />);
        const cellEl = container.querySelector('#cell-3-5');
        expect(cellEl?.className).toContain('cell-highlight-selected');
    });

    it('applies valid move highlight when isValidMove is true', () => {
        const props = buildDefaultProps({ isValidMove: true });
        const { container } = render(<GridCell {...props} />);
        const cellEl = container.querySelector('#cell-3-5');
        expect(cellEl?.className).toContain('cell-highlight-valid-move');
    });

    it('applies attack target highlight when isAttackTarget is true', () => {
        const props = buildDefaultProps({ isAttackTarget: true });
        const { container } = render(<GridCell {...props} />);
        const cellEl = container.querySelector('#cell-3-5');
        expect(cellEl?.className).toContain('cell-highlight-attack');
    });

    it('renders smoke overlay when isSmoked is true', () => {
        const props = buildDefaultProps({ isSmoked: true, smokeOwner: PlayerID.P1 });
        const { container } = render(<GridCell {...props} />);
        // Smoke renders a Cloud icon with opacity-30
        const smokeOverlay = container.querySelector('.opacity-30');
        expect(smokeOverlay).toBeTruthy();
    });

    it('renders HP bar for a damaged unit', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, {
            hp: 5,
            maxHp: 10,
        });
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        // HP bar is rendered as a div with width percentage
        const hpBar = container.querySelector('[style*="width: 50%"]');
        expect(hpBar).toBeTruthy();
    });

    it('renders HP bar with full width for a full-HP unit', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5);
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        const hpBar = container.querySelector('[style*="width: 100%"]');
        expect(hpBar).toBeTruthy();
    });

    it('renders red HP bar when health is critically low', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, {
            hp: 1,
            maxHp: 10,
        });
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        const hpBar = container.querySelector('.bg-red-500');
        expect(hpBar).toBeTruthy();
    });

    it('renders P1 base border on P1 flag base cell', () => {
        const cell = createCell(P1_FLAG_POS.r, P1_FLAG_POS.c);
        const props = buildDefaultProps({ cell, p1FlagLoc: P1_FLAG_POS, p2FlagLoc: P2_FLAG_POS });
        const { container } = render(<GridCell {...props} />);
        const baseBorder = container.querySelector('.border-cyan-500\\/40');
        expect(baseBorder).toBeTruthy();
    });

    it('renders P2 base border on P2 flag base cell', () => {
        const cell = createCell(P2_FLAG_POS.r, P2_FLAG_POS.c);
        const props = buildDefaultProps({ cell, p1FlagLoc: P1_FLAG_POS, p2FlagLoc: P2_FLAG_POS });
        const { container } = render(<GridCell {...props} />);
        const baseBorder = container.querySelector('.border-red-500\\/40');
        expect(baseBorder).toBeTruthy();
    });

    it('renders different unit types with appropriate styling', () => {
        const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
        for (const type of unitTypes) {
            const unit = createTestUnit(PlayerID.P1, type, 3, 5);
            const props = buildDefaultProps({ unit });
            const { container, unmount } = render(<GridCell {...props} />);
            const unitIcon = container.querySelector('.unit-icon');
            expect(unitIcon).toBeTruthy();
            unmount();
        }
    });

    it('shows stealth overlay when unit is stealthed', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 5, {
            status: { moveCostDebuff: 0, mineVulnerability: 0, isStealthed: true },
        });
        const props = buildDefaultProps({ unit, isUnitStealthed: true });
        const { container } = render(<GridCell {...props} />);
        const stealthOverlay = container.querySelector('.stealth-overlay');
        expect(stealthOverlay).toBeTruthy();
    });

    it('renders flag indicator when unit carries a flag', () => {
        const unit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 5, { hasFlag: true });
        const props = buildDefaultProps({ unit });
        const { container } = render(<GridCell {...props} />);
        // Flag carrying indicator has bg-yellow-400 class
        const flagIndicator = container.querySelector('.bg-yellow-400');
        expect(flagIndicator).toBeTruthy();
    });

    it('shows faint scope for throw_mine cells in range but not executable', () => {
        const selectedUnit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 5);
        const friendlyUnit = createTestUnit(PlayerID.P1, UnitType.GENERAL, 3, 6);
        const cell = createCell(3, 6);
        const props = buildDefaultProps({
            cell,
            unit: friendlyUnit,
            targetMode: 'throw_mine',
            selectedUnit,
        });
        const { container } = render(<GridCell {...props} />);
        const scopeOverlay = container.querySelector('.cell-highlight-action-scope.cell-range-purple');
        expect(scopeOverlay).toBeTruthy();
    });

    it('shows strong highlight for throw_mine executable enemy target', () => {
        const selectedUnit = createTestUnit(PlayerID.P1, UnitType.RANGER, 3, 5);
        const enemyUnit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 6);
        const cell = createCell(3, 6);
        const props = buildDefaultProps({
            cell,
            unit: enemyUnit,
            targetMode: 'throw_mine',
            selectedUnit,
        });
        const { container } = render(<GridCell {...props} />);
        const rangeOverlay = container.querySelector('.cell-highlight-action-range.cell-range-purple');
        expect(rangeOverlay).toBeTruthy();
    });

    it('highlights enemy unit cell for defuser B3-2 move_mine_end target', () => {
        const selectedUnit = createTestUnit(PlayerID.P1, UnitType.DEFUSER, 3, 5);
        const enemyUnit = createTestUnit(PlayerID.P2, UnitType.GENERAL, 3, 6);
        const cell = createCell(3, 6);
        const props = buildDefaultProps({
            cell,
            unit: enemyUnit,
            targetMode: 'move_mine_end',
            selectedUnit,
            selectedUnitLevelB: 3,
            selectedUnitVariantB: 2,
        });
        const { container } = render(<GridCell {...props} />);
        const rangeOverlay = container.querySelector('.cell-highlight-action-range.cell-range-rose');
        expect(rangeOverlay).toBeTruthy();
    });
});
