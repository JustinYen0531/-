import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SandboxPanel from '../SandboxPanel';
import { createTestState } from '../../__tests__/helpers/factories';
import { TargetMode } from '../../types';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => () => <span data-testid={`icon-${String(name)}`} /> }));
vi.mock('../../gameHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../gameHelpers')>();
    return {
        ...actual,
        getUnitNameKey: actual.getUnitNameKey,
    };
});

const defaultProps = () => ({
    gameState: createTestState(),
    setGameState: vi.fn(),
    startNewRound: vi.fn(),
    language: 'en' as const,
    isSandboxCollapsed: false,
    setIsSandboxCollapsed: vi.fn(),
    sandboxPos: { x: 0, y: 0 },
    onSandboxDragStart: vi.fn(),
    targetMode: null as TargetMode,
    setTargetMode: vi.fn(),
    onStateMutated: vi.fn(),
});

describe('SandboxPanel', () => {
    it('renders tools when not collapsed', () => {
        render(<SandboxPanel {...defaultProps()} />);
        expect(screen.getByText('SANDBOX TOOLS')).toBeTruthy();
        expect(screen.getByText('+100 Energy')).toBeTruthy();
    });

    it('does not show tools content when collapsed', () => {
        const props = defaultProps();
        props.isSandboxCollapsed = true;
        render(<SandboxPanel {...props} />);
        expect(screen.queryByText('+100 Energy')).toBeNull();
    });

    it('calls setIsSandboxCollapsed when collapse button is clicked', () => {
        const props = defaultProps();
        render(<SandboxPanel {...props} />);
        // The X button collapses the panel
        const collapseButton = screen.getByTestId('icon-X').closest('button')!;
        fireEvent.click(collapseButton);
        expect(props.setIsSandboxCollapsed).toHaveBeenCalledWith(true);
    });

    it('calls setGameState when add energy button is clicked', () => {
        const props = defaultProps();
        render(<SandboxPanel {...props} />);
        fireEvent.click(screen.getByText('+100 Energy'));
        expect(props.setGameState).toHaveBeenCalled();
    });

    it('renders god mode toggle and heal all buttons', () => {
        const props = defaultProps();
        render(<SandboxPanel {...props} />);
        expect(screen.getByText('God Mode')).toBeTruthy();
        expect(screen.getByText('Heal All')).toBeTruthy();
    });
});
