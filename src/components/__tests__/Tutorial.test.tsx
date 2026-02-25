import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Tutorial from '../Tutorial';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));

describe('Tutorial', () => {
    it('renders the first step title', () => {
        render(<Tutorial language="en" onClose={vi.fn()} />);
        expect(screen.getByText('Welcome to Mine Chess')).toBeTruthy();
    });

    it('shows step counter as 1 / 10', () => {
        render(<Tutorial language="en" onClose={vi.fn()} />);
        expect(screen.getByText('1 / 10')).toBeTruthy();
    });

    it('navigates to next step when Next button is clicked', () => {
        render(<Tutorial language="en" onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Your Squad: 5 Unique Units')).toBeTruthy();
        expect(screen.getByText('2 / 10')).toBeTruthy();
    });

    it('navigates back when Previous button is clicked', () => {
        render(<Tutorial language="en" onClose={vi.fn()} />);
        // Go to step 2
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('2 / 10')).toBeTruthy();
        // Go back to step 1
        fireEvent.click(screen.getByText('Previous'));
        expect(screen.getByText('1 / 10')).toBeTruthy();
        expect(screen.getByText('Welcome to Mine Chess')).toBeTruthy();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<Tutorial language="en" onClose={onClose} />);
        // The close button has an X icon; find buttons and click the first one which is the close button
        // Close button is above the card, it has an X icon child
        const buttons = screen.getAllByRole('button');
        // The close button is the first one (top right)
        fireEvent.click(buttons[0]);
        expect(onClose).toHaveBeenCalled();
    });
});
