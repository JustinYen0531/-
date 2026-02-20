import React from 'react';
import { GameState, PlayerID } from '../types';
import { LogOut, Globe } from '../icons';
import { Language } from '../i18n';

interface GameHeaderProps {
    gameState: GameState;
    language: Language;
    setLanguage: (lang: Language) => void;
    musicVolume: number;
    setMusicVolume: (vol: number) => void;
    onPauseToggle: () => void;
    onExitGame: () => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const GameHeader: React.FC<GameHeaderProps> = ({
    gameState,
    language,
    setLanguage,
    musicVolume,
    setMusicVolume,
    onPauseToggle,
    onExitGame,
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

                <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 flex items-center justify-center text-white">
                        {musicVolume === 0 ? (
                            <>
                                <span className="text-lg">🔇</span>
                                <div className="absolute w-6 h-1 bg-red-500 transform -rotate-45"></div>
                            </>
                        ) : (
                            <span className="text-lg">🔊</span>
                        )}
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume * 100}
                        onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                        className="w-24 h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        style={{
                            background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) 100%)`
                        }}
                    />
                    <span className="text-xs text-cyan-300 font-bold w-8">{Math.round(musicVolume * 100)}%</span>
                </div>

                <button
                    onClick={() => setLanguage(language === 'zh_tw' ? 'en' : 'zh_tw')}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/50 transition-colors text-xs font-bold flex items-center gap-1 text-white hover:text-white"
                >
                    <Globe size={12} />
                    {language === 'zh_tw' ? 'EN' : '中文'}
                </button>
            </div>
        </div>
    );
};

export default GameHeader;
