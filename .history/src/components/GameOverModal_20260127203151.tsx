import React from 'react';
import { PlayerID } from '../types';

interface GameOverModalProps {
    winner: PlayerID | null;
    onRestart: () => void;
    onExitGame: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const GameOverModal: React.FC<GameOverModalProps> = ({
    winner,
    onRestart,
    onExitGame,
    t
}) => {
    return (
        <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
            <div className="text-center space-y-6">
                <h1 className="text-7xl font-black text-yellow-400 drop-shadow-2xl animate-pulse">
                    {t('game_over')}
                </h1>
                <div className="text-5xl font-black">
                    {winner === PlayerID.P1 ? (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Player 1 {t('wins')}</span>
                    ) : (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-500">Player 2 {t('wins')}</span>
                    )}
                </div>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={onRestart}
                        className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-lg font-black text-lg shadow-2xl shadow-emerald-500/50 transform hover:scale-110 transition-all border-2 border-emerald-400"
                    >
                        {t('play_again')}
                    </button>
                    <button
                        onClick={onExitGame}
                        className="px-8 py-4 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-lg font-black text-lg shadow-2xl transform hover:scale-110 transition-all border-2 border-slate-500"
                    >
                        {t('exit_lobby')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameOverModal;
