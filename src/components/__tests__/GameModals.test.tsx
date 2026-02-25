import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GameModals from '../GameModals';
import { createTestState } from '../../__tests__/helpers/factories';
import { PlayerID } from '../../types';

vi.mock('../../icons', () => new Proxy({}, { get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} /> }));
vi.mock('../Tutorial', () => ({ default: (props: any) => <div data-testid="tutorial" /> }));
vi.mock('../CircularMeteorShower', () => ({ default: (props: any) => <div data-testid="meteor-shower" /> }));
vi.mock('react-markdown', () => ({ default: (props: any) => <div>{props.children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('remark-breaks', () => ({ default: () => {} }));
vi.mock('../../network/ConnectionProvider', () => ({
    useConnection: () => ({
        status: 'idle',
        isConnected: false,
        localPeerId: null,
        remotePeerId: null,
        reconnectAttempt: 0,
        error: null,
        lastIncomingPacket: null,
        generatePeerId: () => '1234',
        openPeer: vi.fn(),
        connectToPeer: vi.fn(),
        reconnect: vi.fn(),
        sendActionPacket: vi.fn(),
        disconnect: vi.fn(),
        destroyPeer: vi.fn(),
    }),
}));
vi.mock('../../../遊戲文章總覽.MD?raw', () => ({ default: '' }));

const t = (key: string) => key;

const defaultProps = () => ({
    view: 'lobby' as const,
    gameState: createTestState(),
    language: 'en' as const,
    aiDifficulty: 'normal' as const,
    setAiDifficulty: vi.fn(),
    onStartGame: vi.fn(),
    onExitGame: vi.fn(),
    onRestart: vi.fn(),
    onPauseToggle: vi.fn(),
    isHost: false,
    setIsHost: vi.fn(),
    roomId: null as string | null,
    setRoomId: vi.fn(),
    onOpenSettings: vi.fn(),
    allowDevToolsInPvpRoom: false,
    setAllowDevToolsInPvpRoom: vi.fn(),
    detailMode: 'normal' as const,
    t,
});

describe('GameModals', () => {
    it('renders lobby view with title', () => {
        render(<GameModals {...defaultProps()} />);
        expect(screen.getByText('app_title')).toBeTruthy();
    });

    it('renders lobby description text', () => {
        render(<GameModals {...defaultProps()} />);
        expect(screen.getByText('lobby_desc')).toBeTruthy();
    });

    it('renders sandbox mode button in lobby', () => {
        render(<GameModals {...defaultProps()} />);
        expect(screen.getByText('sandbox_mode')).toBeTruthy();
    });

    it('calls onStartGame with sandbox when sandbox button clicked', () => {
        const props = defaultProps();
        render(<GameModals {...props} />);
        fireEvent.click(screen.getByText('sandbox_mode'));
        expect(props.onStartGame).toHaveBeenCalledWith('sandbox');
    });

    it('renders game over modal when gameOver is true', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.gameOver = true;
        props.gameState.winner = PlayerID.P1;
        render(<GameModals {...props} />);
        expect(screen.getByText('game_over')).toBeTruthy();
    });

    it('shows Player 1 wins when winner is P1', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.gameOver = true;
        props.gameState.winner = PlayerID.P1;
        render(<GameModals {...props} />);
        expect(screen.getByText(/Player 1/)).toBeTruthy();
        expect(screen.getByText('wins')).toBeTruthy();
    });

    it('shows Player 2 wins when winner is P2', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.gameOver = true;
        props.gameState.winner = PlayerID.P2;
        render(<GameModals {...props} />);
        expect(screen.getByText(/Player 2/)).toBeTruthy();
    });

    it('calls onRestart when play again button clicked', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.gameOver = true;
        props.gameState.winner = PlayerID.P1;
        render(<GameModals {...props} />);
        fireEvent.click(screen.getByText('play_again'));
        expect(props.onRestart).toHaveBeenCalled();
    });

    it('calls onExitGame when exit button clicked on game over', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.gameOver = true;
        props.gameState.winner = PlayerID.P1;
        render(<GameModals {...props} />);
        const exitButtons = screen.getAllByText('exit_lobby');
        fireEvent.click(exitButtons[0]);
        expect(props.onExitGame).toHaveBeenCalled();
    });

    it('renders pause overlay when isPaused is true', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.isPaused = true;
        render(<GameModals {...props} />);
        expect(screen.getByText('paused')).toBeTruthy();
    });

    it('calls onPauseToggle when resume button clicked in pause overlay', () => {
        const props = defaultProps();
        props.view = 'game';
        props.gameState.isPaused = true;
        render(<GameModals {...props} />);
        fireEvent.click(screen.getByText('resume'));
        expect(props.onPauseToggle).toHaveBeenCalled();
    });
});
