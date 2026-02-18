import React, { useMemo } from 'react';
import { GameState, PlayerID } from '../types';
import {
    ENERGY_REGEN, MAX_INTEREST, ORE_REWARDS
} from '../constants';
import {
    LogOut, Globe, Zap
} from '../icons';
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
    const player = gameState.players[gameState.currentPlayer];
    const isThinking = gameState.phase === 'thinking';
    const isPlacement = gameState.phase === 'placement';

    // Calculate detailed income breakdown
    const { totalIncome, interest, currentRegen, currentOreIncome } = useMemo(() => {
        const interestVal = Math.min(Math.floor(player.energy / 10), MAX_INTEREST);

        const currentOreIncomeVal = player.units.reduce((acc, u) => {
            if (u.isDead) return acc;
            const cell = gameState.cells[u.r][u.c];
            if (cell.hasEnergyOre && cell.oreSize) {
                return acc + ORE_REWARDS[cell.oreSize];
            }
            return acc;
        }, 0);

        let currentRegenVal = ENERGY_REGEN;
        if (gameState.turnCount >= 12) currentRegenVal = 50;
        else if (gameState.turnCount >= 8) currentRegenVal = 45;
        else if (gameState.turnCount >= 4) currentRegenVal = 40;

        const total = currentRegenVal + interestVal + currentOreIncomeVal + player.energyFromKills;

        return {
            totalIncome: total,
            interest: interestVal,
            currentRegen: currentRegenVal,
            currentOreIncome: currentOreIncomeVal
        };
    }, [player.energy, player.units, player.energyFromKills, gameState.turnCount, gameState.cells]);

    // Timer helpers
    const maxTime = gameState.phase === 'placement' ? 45 : gameState.phase === 'thinking' ? 30 : 15;
    const timePercentage = (gameState.timeLeft / maxTime) * 100;
    const timerColor = timePercentage >= 67 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/60' :
        timePercentage >= 34 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/60' :
            'bg-red-500 shadow-lg shadow-red-500/60';
    const timerTransition = timePercentage >= 99 ? '' : 'transition-all duration-1000 ease-linear';

    return (
        <div className="flex flex-col w-full z-40 bg-slate-900 border-b-2 border-cyan-500 shadow-2xl shadow-cyan-500/20">
            {/* Top Bar */}
            <div className="h-12 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 flex items-center justify-between px-4 shrink-0">
                {/* Left Side: Exit & Title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onExitGame}
                        className="p-2 hover:bg-cyan-500/20 rounded text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-500/50"
                    >
                        <LogOut size={20} />
                    </button>
                    <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                        {t('app_title')}
                    </span>

                    <span className="text-xs font-bold text-white bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/50 ml-2">
                        {gameState.gameMode === 'pvp' ? t('pvp_mode') : t('pve_mode')}
                    </span>
                </div>

                {/* Center: Phase Indicator & Timer (Moved from Bottom) */}
                <div className="flex-1 px-8 flex items-center justify-center gap-6">
                    <span className="text-white font-bold text-sm min-w-[80px] text-right uppercase tracking-wider">
                        {gameState.phase === 'placement' ? t('placement_phase') : gameState.phase === 'thinking' ? t('planning_phase') : t('action_phase')}
                    </span>
                    <div className="flex-1 max-w-md h-3 bg-slate-900 rounded-full overflow-hidden border border-white/30 shadow-inner">
                        <div
                            className={`h-full ${timerColor} ${timerTransition}`}
                            style={{ width: `${Math.min(timePercentage, 100)}%` }}
                        />
                    </div>
                    <span className={`font-black text-lg min-w-[50px] font-mono ${gameState.timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {gameState.timeLeft}s
                    </span>
                </div>

                {/* Right Side: Turn, Pause, Settings */}
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

                    {/* Volume Control */}
                    <div className="flex items-center gap-2 group">
                        <div className="relative w-5 h-5 flex items-center justify-center text-white cursor-help">
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
                            className="w-20 h-1 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity"
                            style={{
                                background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) 100%)`
                            }}
                        />
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

            {/* Sub-Header: Energy Bar & Stats (Moved from Control Panel) */}
            <div className="bg-slate-900/80 border-t border-white/10 px-4 py-2 flex items-center justify-between backdrop-blur-sm">
                {/* Energy Display */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-1 rounded-lg border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                        <Zap size={20} className="text-yellow-400 drop-shadow-lg" />
                        <span className="text-2xl font-black text-yellow-400 drop-shadow-lg font-mono tracking-wider">{player.energy}</span>
                        <div className="h-6 w-px bg-white/20 mx-1"></div>
                        <span className="text-xs text-white/60 font-bold uppercase">{t('energy')}</span>
                    </div>

                    {/* Income Stats */}
                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-1.5 tooltip-container" title={t('next_round_income')}>
                            <span className="text-slate-400">{t('next_round_income')}</span>
                            <span className="text-emerald-400 font-black text-base">+{totalIncome}</span>
                        </div>

                        <div className="w-px h-4 bg-white/20"></div>

                        <div className="flex items-center gap-3 opacity-80">
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_5px_rgba(96,165,250,0.6)]"></span>
                                <span className="text-blue-300">+{currentRegen}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_5px_rgba(52,211,153,0.6)]"></span>
                                <span className="text-emerald-300">+{interest}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_rgba(250,204,21,0.6)]"></span>
                                <span className="text-yellow-300">+{currentOreIncome}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 bg-red-400 rounded-full shadow-[0_0_5px_rgba(248,113,113,0.6)]"></span>
                                <span className="text-red-300">+{player.energyFromKills}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Round Info */}
                <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <span className="uppercase tracking-widest">{t('round')} {gameState.turnCount}</span>
                </div>
            </div>
        </div>
    );
};

export default GameHeader;
