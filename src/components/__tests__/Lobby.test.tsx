import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Lobby from '../Lobby';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));
vi.mock('../Tutorial', () => ({ default: (props: any) => <div data-testid="tutorial" /> }));
vi.mock('../CircularMeteorShower', () => ({ default: (props: any) => <div data-testid="meteor-shower" /> }));

const t = (key: string) => key;

const defaultProps = () => ({
    language: 'en' as const,
    t,
    setLanguage: vi.fn(),
    roomId: null as string | null,
    setRoomId: vi.fn(),
    isHost: false,
    setIsHost: vi.fn(),
    showJoinModal: false,
    setShowJoinModal: vi.fn(),
    handleStartGame: vi.fn(),
    roomCode: '',
    setRoomCode: vi.fn(),
    joinMode: 'join' as const,
    setJoinMode: vi.fn(),
    createRoomId: '',
    setCreateRoomId: vi.fn(),
    createRoomName: '',
    setCreateRoomName: vi.fn(),
    isPrivate: false,
    setIsPrivate: vi.fn(),
    createRoomPassword: '',
    setCreateRoomPassword: vi.fn(),
});

describe('Lobby', () => {
    it('renders game title', () => {
        render(<Lobby {...defaultProps()} />);
        expect(screen.getByText('app_title')).toBeTruthy();
    });

    it('renders sandbox mode button', () => {
        render(<Lobby {...defaultProps()} />);
        expect(screen.getByText('sandbox_mode')).toBeTruthy();
    });

    it('calls handleStartGame with sandbox when sandbox button clicked', () => {
        const props = defaultProps();
        render(<Lobby {...props} />);
        fireEvent.click(screen.getByText('sandbox_mode'));
        expect(props.handleStartGame).toHaveBeenCalledWith('sandbox');
    });

    it('calls handleStartGame with pve when PvE button clicked', () => {
        const props = defaultProps();
        render(<Lobby {...props} />);
        fireEvent.click(screen.getByText('pve_mode'));
        expect(props.handleStartGame).toHaveBeenCalledWith('pve');
    });

    it('toggles language when language button clicked', () => {
        const props = defaultProps();
        render(<Lobby {...props} />);
        // English mode shows the Chinese toggle label
        const langButton = screen.getByText(/中文/);
        fireEvent.click(langButton);
        expect(props.setLanguage).toHaveBeenCalledWith('zh_tw');
    });
});
