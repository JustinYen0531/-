import React from 'react';

interface PauseMenuProps {
    onPauseToggle: () => void;
    onExitGame: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const PauseMenu: React.FC<PauseMenuProps> = ({
    onPauseToggle,
    onExitGame,
    t
}) => {
    return (
        <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
            <div className="text-center space-y-6">
                <h1 className="text-7xl font-black text-cyan-400 drop-shadow-2xl animate-pulse">
                    {t('paused')}
                </h1>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={onPauseToggle}
                        className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-lg shadow-2xl shadow-cyan-500/50 transform hover:scale-110 transition-all border-2 border-cyan-400"
                    >
                        {t('resume')}
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

export default PauseMenu;
