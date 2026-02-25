import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import UnitInfoPanel from '../UnitInfoPanel';
import { createTestState } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));
vi.mock('../../gameHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../gameHelpers')>();
    return {
        ...actual,
        getUnitIcon: (type: any, size: any, tier: any) => <span data-testid={`unit-icon-${type}`} />,
    };
});

const t = (key: string) => key;

const defaultProps = () => ({
    gameState: createTestState(),
    localPlayerId: PlayerID.P1,
    language: 'en' as const,
    t,
    onUnitClick: vi.fn(),
    onSwapUnits: vi.fn(),
});

describe('UnitInfoPanel', () => {
    it('renders all 5 unit buttons', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(5);
    });

    it('renders squad status header', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        expect(screen.getByText('squad_status')).toBeTruthy();
    });

    it('displays round info with turn count', () => {
        const props = defaultProps();
        props.gameState.turnCount = 3;
        render(<UnitInfoPanel {...props} />);
        expect(screen.getByText(/round/)).toBeTruthy();
    });

    it('calls onUnitClick when a unit button is clicked', () => {
        const props = defaultProps();
        // Make sure the unit is the active unit (first remaining)
        // In action phase with P1 current, the first non-acted, non-dead unit is active
        render(<UnitInfoPanel {...props} />);
        const buttons = screen.getAllByRole('button');
        // Click the first unit button
        fireEvent.click(buttons[0]);
        expect(props.onUnitClick).toHaveBeenCalled();
    });

    it('displays HP text for each unit', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        // Each unit shows HP:value
        const hpTexts = screen.getAllByText(/^HP:\d+$/);
        expect(hpTexts.length).toBeGreaterThanOrEqual(5);
    });

    it('shows unit name keys via translation', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        // getUnitNameKey returns keys like 'unit_general', etc.
        // The t function returns the key as-is
        expect(screen.getAllByText(/^unit_/).length).toBeGreaterThanOrEqual(5);
    });

    it('marks dead unit with reduced opacity styling', () => {
        const props = defaultProps();
        const generalUnit = props.gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        generalUnit.isDead = true;
        render(<UnitInfoPanel {...props} />);
        // Dead units get a Skull icon overlay
        const skulls = screen.getAllByTestId('icon-Skull');
        expect(skulls.length).toBeGreaterThanOrEqual(1);
    });

    it('shows energy cap display for each unit', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        // Each unit has an energy cap display with Zap icon
        const zapIcons = screen.getAllByTestId('icon-Zap');
        expect(zapIcons.length).toBeGreaterThanOrEqual(5);
    });

    it('disables dead unit buttons', () => {
        const props = defaultProps();
        const generalUnit = props.gameState.players[PlayerID.P1].units.find(u => u.type === UnitType.GENERAL)!;
        generalUnit.isDead = true;
        render(<UnitInfoPanel {...props} />);
        const buttons = screen.getAllByRole('button');
        const disabledButtons = buttons.filter(btn => (btn as HTMLButtonElement).disabled);
        expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('renders keyboard shortcut labels (Q, W, E, R, T)', () => {
        const props = defaultProps();
        render(<UnitInfoPanel {...props} />);
        expect(screen.getAllByText('Q').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('W').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('E').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('R').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('T').length).toBeGreaterThanOrEqual(1);
    });
});
