import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DevToolsPanel from '../DevToolsPanel';
import { createTestState } from '../../__tests__/helpers/factories';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));

const defaultProps = () => ({
    open: false,
    onToggle: vi.fn(),
    aiDecision: null,
    aiTuningProfile: 'balanced' as const,
    setAiTuningProfile: vi.fn(),
    gameState: createTestState(),
});

describe('DevToolsPanel', () => {
    it('renders toggle button', () => {
        render(<DevToolsPanel {...defaultProps()} />);
        expect(screen.getByText('DEVTOOLS')).toBeTruthy();
    });

    it('shows expanded content when open is true', () => {
        const props = defaultProps();
        props.open = true;
        render(<DevToolsPanel {...props} />);
        expect(screen.getByText('PvE Dev Tools')).toBeTruthy();
        expect(screen.getByText('AI Tuning')).toBeTruthy();
    });

    it('renders tuning profile buttons when open and calls setAiTuningProfile', () => {
        const props = defaultProps();
        props.open = true;
        render(<DevToolsPanel {...props} />);
        const atkButton = screen.getByText('ATK');
        const balButton = screen.getByText('BAL');
        const safeButton = screen.getByText('SAFE');
        expect(atkButton).toBeTruthy();
        expect(balButton).toBeTruthy();
        expect(safeButton).toBeTruthy();
        fireEvent.click(atkButton);
        expect(props.setAiTuningProfile).toHaveBeenCalledWith('aggressive');
    });
});
