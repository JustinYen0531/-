import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GameHeader from '../GameHeader';
import { createTestState } from '../../__tests__/helpers/factories';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));

const t = (key: string) => key;

const defaultProps = () => ({
    gameState: createTestState(),
    onPauseToggle: vi.fn(),
    onExitGame: vi.fn(),
    onOpenSettings: vi.fn(),
    t,
});

describe('GameHeader', () => {
    it('renders the app title', () => {
        render(<GameHeader {...defaultProps()} />);
        expect(screen.getByText('app_title')).toBeTruthy();
    });

    it('displays the current turn indicator', () => {
        render(<GameHeader {...defaultProps()} />);
        expect(screen.getByText('current')).toBeTruthy();
        expect(screen.getByText('P1')).toBeTruthy();
    });

    it('calls onPauseToggle when pause button is clicked', () => {
        const props = defaultProps();
        render(<GameHeader {...props} />);
        fireEvent.click(screen.getByText('pause'));
        expect(props.onPauseToggle).toHaveBeenCalled();
    });

    it('calls onExitGame when exit button is clicked', () => {
        const props = defaultProps();
        render(<GameHeader {...props} />);
        // The exit button is an icon-only LogOut button
        const exitButton = screen.getByTestId('icon-LogOut').closest('button')!;
        fireEvent.click(exitButton);
        expect(props.onExitGame).toHaveBeenCalled();
    });

    it('calls onOpenSettings when settings button is clicked', () => {
        const props = defaultProps();
        render(<GameHeader {...props} />);
        fireEvent.click(screen.getByText('settings'));
        expect(props.onOpenSettings).toHaveBeenCalled();
    });
});
