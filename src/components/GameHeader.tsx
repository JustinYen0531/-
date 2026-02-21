import React from 'react';
import { GameState, PlayerID } from '../types';
import { LogOut, Settings } from '../icons';

interface GameHeaderProps {
    gameState: GameState;
    onPauseToggle: () => void;
    onExitGame: () => void;
    onOpenSettings: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const GameHeader: React.FC<GameHeaderProps> = ({
    gameState,
    onPauseToggle,
    onExitGame,
    onOpenSettings,
    t
}) => {
    const modeLabel = gameState.gameMode === 'pvp'
        ? t('pvp_mode')
        : gameState.gameMode === 'sandbox'
            ? t('sandbox_mode')
            : t('pve_mode');

    return (
        <div className="h-12 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b-2 border-cyan-500 flex items-center justify-between px-4 shrink-0 z-30 shadow-2xl shadow-cyan-500/20">
            <div className="flex items-center gap-3">
                <button
                    onClick={onExitGame}
                    className="p-2 hover:bg-cyan-500/20 rounded text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-500/50"
                >
                    <LogOut size={20} />
                </button>
                <span className="text-lg font-black text-white no-neon-text">
                    {t('app_title')}
                </span>

                <span className="text-xs font-bold text-white bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/50 ml-2">
                    {modeLabel}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-sm text-white font-semibold">
                    {t('current')}: <span className={`font-black ${gameState.currentPlayer === PlayerID.P1 ? 'text-blue-400' : 'text-red-400'}`}>
                        {gameState.currentPlayer === PlayerID.P1 ? 'P1' : 'P2'}
                    </span>
                </div>

                <button
                    onClick={onPauseToggle}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/50 transition-colors text-xs font-bold flex items-center gap-1 text-white hover:text-white"
                >
                    {gameState.isPaused ? t('resume') : t('pause')}
                </button>

                <button
                    onClick={onOpenSettings}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/50 transition-colors text-xs font-bold flex items-center gap-1 text-white hover:text-white"
                >
                    <Settings size={14} />
                    {t('settings')}
                </button>
            </div>
        </div>
    );
};

export default GameHeader;
