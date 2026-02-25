import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock icons with proxy so any icon component renders a simple span
vi.mock('../../icons', () => {
    return new Proxy({}, {
        get: (_target, prop) => {
            if (typeof prop === 'string') {
                const Icon = (props: any) => <span data-testid={`icon-${prop}`} {...props} />;
                Icon.displayName = prop;
                return Icon;
            }
            return undefined;
        },
    });
});

// Mock gameHelpers used by EvolutionTree
vi.mock('../../gameHelpers', () => ({
    getUnitTypeAbbr: (type: string) => type.slice(0, 3).toLowerCase(),
    getUnitIcon: (type: string, size: number) => <span data-testid={`unit-icon-${type}`}>{type}</span>,
}));

import EvolutionTree from '../EvolutionTree';
import { createTestState } from '../../__tests__/helpers/factories';
import { PlayerID, UnitType } from '../../types';

const t = (key: string) => key;

describe('EvolutionTree', () => {
    const setup = () => {
        const gameState = createTestState();
        const onClose = vi.fn();
        return { gameState, onClose };
    };

    it('renders without crashing', () => {
        const { gameState, onClose } = setup();
        const { container } = render(
            <EvolutionTree gameState={gameState} playerId={PlayerID.P1} onClose={onClose} t={t} />
        );
        expect(container).toBeTruthy();
    });

    it('shows all 5 unit types', () => {
        const { gameState, onClose } = setup();
        render(
            <EvolutionTree gameState={gameState} playerId={PlayerID.P1} onClose={onClose} t={t} />
        );
        const unitTypes = [UnitType.GENERAL, UnitType.MINESWEEPER, UnitType.RANGER, UnitType.MAKER, UnitType.DEFUSER];
        for (const type of unitTypes) {
            expect(screen.getByText(type)).toBeInTheDocument();
        }
    });

    it('calls onClose when close button is clicked', () => {
        const { gameState, onClose } = setup();
        render(
            <EvolutionTree gameState={gameState} playerId={PlayerID.P1} onClose={onClose} t={t} />
        );
        // The close button contains the X icon
        const closeButton = screen.getByTestId('icon-X').closest('button')!;
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows evolution level labels (LV1 and LV2)', () => {
        const { gameState, onClose } = setup();
        render(
            <EvolutionTree gameState={gameState} playerId={PlayerID.P1} onClose={onClose} t={t} />
        );
        const lv1Elements = screen.getAllByText('LV1');
        const lv2Elements = screen.getAllByText('LV2');
        // 5 unit types x 2 branches = 10 LV1 cards and 10 LV2 cards
        expect(lv1Elements.length).toBe(10);
        expect(lv2Elements.length).toBe(10);
    });

    it('shows progress bars for each branch', () => {
        const { gameState, onClose } = setup();
        const { container } = render(
            <EvolutionTree gameState={gameState} playerId={PlayerID.P1} onClose={onClose} t={t} />
        );
        // Each unit type has 2 branches, each branch has a segmented progress bar (3 segments with h-2 class)
        const progressBars = container.querySelectorAll('.h-2');
        // 5 unit types x 2 branches = 10 progress bar rows
        expect(progressBars.length).toBe(10);
    });
});
