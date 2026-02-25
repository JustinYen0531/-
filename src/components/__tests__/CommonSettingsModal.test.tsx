import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CommonSettingsModal from '../CommonSettingsModal';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));

const defaultProps = () => ({
    open: true,
    onClose: vi.fn(),
    language: 'en' as const,
    setLanguage: vi.fn(),
    musicVolume: 0.6,
    setMusicVolume: vi.fn(),
    sfxVolume: 0.8,
    setSfxVolume: vi.fn(),
    allowDevToolsInAiChallenge: false,
    setAllowDevToolsInAiChallenge: vi.fn(),
    disableBoardShake: false,
    setDisableBoardShake: vi.fn(),
    detailMode: 'normal' as const,
    setDetailMode: vi.fn(),
});

describe('CommonSettingsModal', () => {
    it('renders modal content when open is true', () => {
        render(<CommonSettingsModal {...defaultProps()} />);
        expect(screen.getByText('Common Settings')).toBeTruthy();
    });

    it('returns null when open is false', () => {
        const props = defaultProps();
        props.open = false;
        const { container } = render(<CommonSettingsModal {...props} />);
        expect(container.innerHTML).toBe('');
    });

    it('calls onClose when close button is clicked', () => {
        const props = defaultProps();
        render(<CommonSettingsModal {...props} />);
        const closeButton = screen.getByLabelText('Close settings');
        fireEvent.click(closeButton);
        expect(props.onClose).toHaveBeenCalled();
    });

    it('calls setLanguage when a language button is clicked', () => {
        const props = defaultProps();
        render(<CommonSettingsModal {...props} />);
        fireEvent.click(screen.getByText('EN'));
        expect(props.setLanguage).toHaveBeenCalledWith('en');
    });

    it('renders music and sfx volume sliders', () => {
        const props = defaultProps();
        render(<CommonSettingsModal {...props} />);
        expect(screen.getByText('Music Volume')).toBeTruthy();
        expect(screen.getByText('SFX Volume')).toBeTruthy();
        // Check slider presence via range inputs
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBe(2);
    });
});
