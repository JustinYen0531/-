import React from 'react';
import { PlayerID, GameState, Unit, UnitType } from '../types';
import { Star, Skull } from '../icons';
import { getUnitIcon, getUnitName } from '../gameHelpers';
import { ENERGY_CAP_RATIO } from '../constants';
import { Language } from '../i18n';

interface UnitInfoPanelProps {
    gameState: GameState;
    language: Language;
    t: (key: string, params?: Record<string, any>) => string;
    onUnitClick: (unit: Unit) => void;
}

const UnitInfoPanel: React.FC<UnitInfoPanelProps> = ({ gameState, t, onUnitClick, language }) => {
    const player = gameState.players[gameState.currentPlayer];
    const isPlacement = gameState.phase === 'placement';

    return (
        <div className="flex-[7] flex flex-col border-l-2 border-white/30 px-4 items-center h-full justify-center bg-slate-800/30">
            <div className="text-sm text-white mb-2 uppercase tracking-widest text-center w-full flex justify-between px-4 font-bold">
                <span className="text-base">{t('squad_status')}</span>
                <span className="text-yellow-400 font-black text-base">
                    {isPlacement ? `${t('round')} ${gameState.turnCount}` : `${t('round')} ${gameState.turnCount}-${player.units.filter(u => u.hasActedThisRound).length + 1}`}
                </span>
            </div>

            <div className="flex gap-4 justify-center w-full">
                {player.units.map((u) => {
                    // Calculate Tier for Visuals
                    const levelA = player.evolutionLevels[u.type].a;
                    const levelB = player.evolutionLevels[u.type].b;
                    const tier = Math.max(levelA, levelB);

                    // Check if this unit can be swapped (placement phase)
                    const canSwap = isPlacement && gameState.selectedUnitId && gameState.selectedUnitId !== u.id;

                    return (
                        <div key={u.id} className="flex flex-col items-center gap-1">
                            <button
                                disabled={u.isDead || u.hasActedThisRound}
                                onClick={() => onUnitClick(u)}
                                className={`
                                    relative flex flex-col items-center justify-between w-20 h-24 rounded-lg border-2 transition-all
                                    ${u.isDead ? 'opacity-30 grayscale cursor-not-allowed bg-red-950/50 border-red-600' : ''}
                                    ${u.hasActedThisRound ? `opacity-50 cursor-not-allowed border-red-500 ${u.owner === PlayerID.P1 ? 'bg-cyan-900/40' : 'bg-red-900/40'}` : ''}
                                    ${canSwap
                                        ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                        : gameState.selectedUnitId === u.id
                                            ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)] scale-110 z-10'
                                            : u.owner === PlayerID.P1
                                                ? 'bg-cyan-900/40 border-slate-600 hover:bg-cyan-900/60 hover:border-cyan-500'
                                                : 'bg-red-900/40 border-slate-600 hover:bg-red-900/60 hover:border-red-500'
                                    }
                                `}
                            >
                                {/* Evolution Stars - Top Right */}
                                <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                                    {/* Path A Stars (Blue) - Top */}
                                    {levelA > 0 && (
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: levelA }).map((_, i) => {
                                                const variantA = player.evolutionLevels[u.type].aVariant;
                                                let colorClass = "text-blue-400 fill-blue-400";
                                                if (levelA === 3 && variantA) {
                                                    if (variantA === 1) colorClass = "text-cyan-400 fill-cyan-400"; // 3-1 Light Blue
                                                    else if (variantA === 2) colorClass = "text-purple-400 fill-purple-400"; // 3-2 Purple
                                                } else if (i === 2 && variantA) {
                                                    if (variantA === 1) colorClass = "text-cyan-400 fill-cyan-400";
                                                    else if (variantA === 2) colorClass = "text-purple-400 fill-purple-400";
                                                }
                                                return <Star key={`a-${i}`} size={8} className={`${colorClass} drop-shadow-sm`} />;
                                            })}
                                        </div>
                                    )}
                                    {/* Path B Stars (Orange) - Bottom */}
                                    {levelB > 0 && (
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: levelB }).map((_, i) => {
                                                const variantB = player.evolutionLevels[u.type].bVariant;
                                                let colorClass = "text-orange-400 fill-orange-400";
                                                if (levelB === 3 && variantB) {
                                                    if (variantB === 1) colorClass = "text-yellow-400 fill-yellow-400"; // 3-1 Light Yellow
                                                    else if (variantB === 2) colorClass = "text-rose-500 fill-rose-500"; // 3-2 Red
                                                } else if (i === 2 && variantB) {
                                                    if (variantB === 1) colorClass = "text-yellow-400 fill-yellow-400";
                                                    else if (variantB === 2) colorClass = "text-rose-500 fill-rose-500";
                                                }
                                                return <Star key={`b-${i}`} size={8} className={`${colorClass} drop-shadow-sm`} />;
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Keyboard Shortcut Indicator */}
                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">
                                    {u.type === UnitType.GENERAL ? 'Q' : u.type === UnitType.MINESWEEPER ? 'W' : u.type === UnitType.RANGER ? 'E' : u.type === UnitType.MAKER ? 'R' : 'T'}
                                </div>

                                {u.isDead && <Skull size={40} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white z-20 drop-shadow-lg" />}
                                {canSwap && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <svg className="w-10 h-10 text-emerald-300 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                                            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                                        </svg>
                                    </div>
                                )}

                                {/* Main Content Area */}
                                <div className="flex-1 flex flex-col items-center justify-center w-full pt-1">
                                    <div className={`${u.owner === PlayerID.P1 ? 'text-cyan-400 drop-shadow-lg' : 'text-red-400 drop-shadow-lg'} flex items-center justify-center`}>
                                        {getUnitIcon(u.type, 30, tier)}
                                    </div>
                                </div>

                                {/* Health Bar, HP Text */}
                                <div className="flex flex-col items-center gap-0.5 pb-0">
                                    <div className="w-12 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-600">
                                        <div
                                            className={`h-full transition-all ${u.hp < u.maxHp * 0.3 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'}`}
                                            style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                                        />
                                    </div>

                                    <div className="text-[8px] font-black text-white font-mono">
                                        HP:{u.hp}
                                    </div>
                                </div>

                                {/* Unit Name */}
                                <div className="text-[9px] font-black text-slate-300 pb-0.5">
                                    {getUnitName(u.type)}
                                </div>

                                {/* Resurrection Timer Display */}
                                {u.isDead && u.respawnTimer > 0 && (
                                    <div className="text-[10px] font-black text-red-500 font-mono">
                                        {language === 'zh_tw' ? '復活' : 'RESPAWN'}:{u.respawnTimer}
                                    </div>
                                )}
                            </button>

                            {/* Energy Cap Display */}
                            <div className="text-[10px] font-black text-cyan-300 font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                {u.energyUsedThisTurn}/{Math.floor(u.startOfActionEnergy * ENERGY_CAP_RATIO)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UnitInfoPanel;
