import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GameField from '../GameField';
import { PlayerID, UnitType } from '../../types';
import { createTestState, createTestUnit } from '../../__tests__/helpers/factories';

// Mock GridCell to a simple div so we can verify rendering and click propagation
vi.mock('../GridCell', () => ({
    default: (props: any) => (
        <div
            data-testid={`cell-${props.cell.r}-${props.cell.c}`}
            onClick={props.onClick}
        />
    ),
}));

const buildDefaultProps = (overrides: Record<string, any> = {}) => {
    const gameState = createTestState();
    return {
        gameState,
        targetMode: null as any,
        handleCellClick: vi.fn(),
        handleUnitClick: vi.fn(),
        hoveredPos: null,
        ...overrides,
    };
};

describe('GameField', () => {
    it('renders without crashing', () => {
        const props = buildDefaultProps();
        const { container } = render(<GameField {...props} />);
        expect(container).toBeTruthy();
    });

    it('renders a grid of cells', () => {
        const props = buildDefaultProps();
        render(<GameField {...props} />);
        // The grid should contain at least one cell
        const firstCell = screen.getByTestId('cell-0-0');
        expect(firstCell).toBeTruthy();
    });

    it('renders the correct number of cells (7 rows x 24 cols = 168)', () => {
        const props = buildDefaultProps();
        render(<GameField {...props} />);
        const rowCount = props.gameState.cells.length;
        const colCount = props.gameState.cells[0].length;
        // Verify a cell at the last position exists
        const lastCell = screen.getByTestId(`cell-${rowCount - 1}-${colCount - 1}`);
        expect(lastCell).toBeTruthy();
        // Count total cells
        const totalCells = rowCount * colCount;
        let foundCount = 0;
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const el = screen.queryByTestId(`cell-${r}-${c}`);
                if (el) foundCount++;
            }
        }
        expect(foundCount).toBe(totalCells);
    });

    it('calls handleCellClick when an empty cell is clicked', () => {
        const handleCellClick = vi.fn();
        const props = buildDefaultProps({ handleCellClick });
        render(<GameField {...props} />);
        // Click a cell that has no unit on it (row 6, col 10 should be empty)
        const emptyCell = screen.getByTestId('cell-6-10');
        fireEvent.click(emptyCell);
        expect(handleCellClick).toHaveBeenCalled();
    });

    it('calls handleUnitClick when a cell with a visible unit is clicked', () => {
        const handleUnitClick = vi.fn();
        const gameState = createTestState();
        // P1 General is at r=0, c=1
        const props = buildDefaultProps({ gameState, handleUnitClick });
        render(<GameField {...props} />);
        const unitCell = screen.getByTestId('cell-0-1');
        fireEvent.click(unitCell);
        expect(handleUnitClick).toHaveBeenCalled();
    });

    it('renders cells at flipped column positions when isFlipped is true', () => {
        const props = buildDefaultProps({ isFlipped: true });
        render(<GameField {...props} />);
        // Even flipped, we should still have cells for all coordinates
        // The GridCell mock receives the actual (non-display) column, so all cells still exist
        const cell = screen.getByTestId('cell-0-0');
        expect(cell).toBeTruthy();
        const colCount = props.gameState.cells[0].length;
        const lastCell = screen.getByTestId(`cell-0-${colCount - 1}`);
        expect(lastCell).toBeTruthy();
    });

    it('passes onHoverCell callback through mouse events', () => {
        const onHoverCell = vi.fn();
        const props = buildDefaultProps({ onHoverCell });
        const { container } = render(<GameField {...props} />);
        // Find the outermost div and trigger mouse leave
        const outerDiv = container.firstElementChild as HTMLElement;
        fireEvent.mouseLeave(outerDiv);
        // onHoverCell should be called with null values on mouse leave
        expect(onHoverCell).toHaveBeenCalled();
    });

    it('applies disableBoardShake prop correctly', () => {
        const props = buildDefaultProps({ disableBoardShake: true });
        const { container } = render(<GameField {...props} />);
        // The grid container should have animation: none
        const gridDiv = container.querySelector('.grid');
        expect(gridDiv).toBeTruthy();
        expect((gridDiv as HTMLElement).style.animation).toBe('none');
    });

    it('does not apply disableBoardShake animation when prop is false', () => {
        const props = buildDefaultProps({ disableBoardShake: false });
        const { container } = render(<GameField {...props} />);
        const gridDiv = container.querySelector('.grid');
        expect(gridDiv).toBeTruthy();
        expect((gridDiv as HTMLElement).style.animation).not.toBe('none');
    });

    it('uses viewerPlayerId for visibility when provided', () => {
        const handleUnitClick = vi.fn();
        const gameState = createTestState();
        const props = buildDefaultProps({
            gameState,
            handleUnitClick,
            viewerPlayerId: PlayerID.P2,
        });
        render(<GameField {...props} />);
        // P2 units should be visible to P2 viewer; click on P2 unit at r=0, c=22
        const p2UnitCell = screen.getByTestId('cell-0-22');
        fireEvent.click(p2UnitCell);
        expect(handleUnitClick).toHaveBeenCalled();
    });

    it('calls handleCellClick for skill targeting even when unit is present', () => {
        const handleCellClick = vi.fn();
        const handleUnitClick = vi.fn();
        const gameState = createTestState();
        // Select a unit and set a skill target mode
        const p1General = gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        gameState.selectedUnitId = p1General.id;
        const props = buildDefaultProps({
            gameState,
            handleCellClick,
            handleUnitClick,
            targetMode: 'scan',
        });
        render(<GameField {...props} />);
        // Click a cell with a visible enemy unit - should go to handleCellClick due to skill targeting
        const enemyCell = screen.getByTestId('cell-0-22');
        fireEvent.click(enemyCell);
        expect(handleCellClick).toHaveBeenCalled();
    });

    it('renders center divider line', () => {
        const props = buildDefaultProps();
        const { container } = render(<GameField {...props} />);
        // The center divider is a div inside the grid
        const divider = container.querySelector('.bg-white\\/35');
        expect(divider).toBeTruthy();
    });
});
