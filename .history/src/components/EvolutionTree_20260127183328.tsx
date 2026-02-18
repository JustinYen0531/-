import React, { useState } from 'react';
import { Dna, X, Check, Lock, ChevronRight, Zap } from 'lucide-react';
import { GameState, UnitType } from '../types';
import { EVOLUTION_CONFIG } from '../constants';
import { getUnitName, getUnitTypeAbbr, getUnitIcon } from '../gameHelpers';

interface EvolutionTreeProps {
    gameState: GameState;
    onClose: () => void;
    t: (key: string, params?: any) => string;
}

const EvolutionTree: React.FC<EvolutionTreeProps> = ({
    gameState,
    onClose,
    t
}) => {
    const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
    const p = gameState.players[gameState.currentPlayer];
    const stats = p.questStats;
    const levels = p.evolutionLevels;

    const getProgress = (unitType: UnitType, branch: 'a' | 'b') => {
        switch (unitType) {
            case UnitType.GENERAL: return branch === 'a' ? stats.generalDamage : stats.generalFlagSteps;
            case UnitType.MINESWEEPER: return branch === 'a' ? stats.sweeperMinesMarked : stats.consecutiveSafeRounds;
            case UnitType.RANGER: return branch === 'a' ? stats.rangerSteps : stats.rangerMinesMoved;
            case UnitType.MAKER: return branch === 'a' ? stats.makerMinesTriggeredByEnemy : stats.makerMinesPlaced;
            case UnitType.DEFUSER: return branch === 'a' ? stats.defuserMinesSoaked : stats.defuserMinesDisarmed;
            default: return 0;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-indigo-500/20 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Dna size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-widest">
                                {t('evolution_tree')}
                            </h2>
                            <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
                                {t('evolution_desc') || "Upgrade your units"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all hover:rotate-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-slate-950/50">
                    <div className="space-y-6">
                        {Object.entries(EVOLUTION_CONFIG).map(([typeStr, config]) => {
                            const type = typeStr as UnitType;
                            return (
                                <div key={type} className="bg-slate-800/30 rounded-xl p-6 border border-white/5 hover:border-indigo-500/20 transition-all duration-300">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                        <div className="p-2 bg-slate-900 rounded border border-white/10 text-indigo-300">
                                            {getUnitIcon(type, 20)}
                                        </div>
                                        <span className="text-lg font-black text-slate-200 tracking-wider">
                                            {getUnitName(type)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {['a', 'b'].map((branchKey) => {
                                            const branch = branchKey as 'a' | 'b';
                                            const currentVal = getProgress(type, branch);
                                            const maxVal = config[branch].thresholds[2];
                                            const currentLevel = levels[type][branch];
                                            const variantKey = branch === 'a' ? 'aVariant' : 'bVariant';
                                            const selectedVariant = levels[type][variantKey];

                                            let barColor = 'bg-slate-600';
                                            if (currentLevel === 1) barColor = 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
                                            if (currentLevel === 2) barColor = 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
                                            if (currentLevel === 3) barColor = 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]';

                                            return (
                                                <div key={branch} className="space-y-3">
                                                    {/* Branch Header */}
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-8 rounded-full ${branch === 'a' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                                                    {t(branch === 'a' ? 'path_a' : 'path_b')}
                                                                    {currentLevel < 3 && currentVal >= config[branch].thresholds[currentLevel] && (
                                                                        <span className="px-1.5 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded border border-green-500/30 animate-pulse font-black">
                                                                            READY
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-medium">
                                                                    {t(`evol_${getUnitTypeAbbr(type)}_${branch}_subtitle`)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-mono font-bold bg-slate-900 px-2 py-1 rounded text-slate-400 border border-white/5">
                                                            {currentVal} <span className="text-slate-600">/</span> {maxVal}
                                                        </div>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="flex h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                                        {(() => {
                                                            const t1 = config[branch].thresholds[0];
                                                            const t2 = config[branch].thresholds[1];
                                                            const width1 = Math.min(100, (currentVal / t1) * 100);
                                                            const width2 = currentVal > t1 ? Math.min(100, ((currentVal - t1) / (t2 - t1)) * 100) : 0;
                                                            const width3 = currentVal > t2 ? Math.min(100, ((currentVal - t2) / (maxVal - t2)) * 100) : 0;

                                                            const s1 = (t1 / maxVal) * 100;
                                                            const s2 = ((t2 - t1) / maxVal) * 100;
                                                            const s3 = ((maxVal - t2) / maxVal) * 100;

                                                            return (
                                                                <>
                                                                    <div style={{ width: `${s1}%` }} className="h-full border-r border-slate-900 bg-slate-800/50">
                                                                        <div style={{ width: `${width1}%` }} className={`h-full transition-all duration-500 ${barColor}`} />
                                                                    </div>
                                                                    <div style={{ width: `${s2}%` }} className="h-full border-r border-slate-900 bg-slate-800/50">
                                                                        <div style={{ width: `${width2}%` }} className={`h-full transition-all duration-500 ${barColor}`} />
                                                                    </div>
                                                                    <div style={{ width: `${s3}%` }} className="h-full bg-slate-800/50">
                                                                        <div style={{ width: `${width3}%` }} className={`h-full transition-all duration-500 ${barColor}`} />
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Cards Container */}
                                                    <div className="flex items-center h-28 gap-2">
                                                        {/* LV1 Card */}
                                                        <div className="flex-1 h-full relative group perspective">
                                                            {(() => {
                                                                const cardId = `${type}-${branch}-1`;
                                                                const isFlipped = flippedCardId === cardId;
                                                                const isUnlocked = currentLevel >= 1;
                                                                return (
                                                                    <div
                                                                        onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                        className={`
                                                                            relative w-full h-full rounded-lg border p-2 cursor-pointer transition-all duration-300 flex flex-col justify-center
                                                                            ${isFlipped
                                                                                ? 'z-50 scale-110 bg-slate-900 border-indigo-400 shadow-2xl h-auto min-h-[140px]'
                                                                                : isUnlocked
                                                                                    ? 'bg-blue-950/20 border-blue-500/30 text-blue-100 hover:bg-blue-900/30 hover:border-blue-400/50'
                                                                                    : 'bg-slate-800/30 border-slate-700 text-slate-500 opacity-60'
                                                                            }
                                                                        `}
                                                                    >
                                                                        {isFlipped ? (
                                                                            <p className="text-[10px] leading-relaxed text-blue-100/90 whitespace-pre-wrap">
                                                                                {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_detail`)}
                                                                            </p>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex justify-between items-start mb-1">
                                                                                    <div className="text-[10px] font-black opacity-50">LV1</div>
                                                                                    {isUnlocked ? <Check size={10} className="text-green-400" /> : <Lock size={10} />}
                                                                                </div>
                                                                                <div className="text-[10px] font-bold leading-tight line-clamp-3">
                                                                                    {t(config[branch].rewardText[0])}
                                                                                </div>
                                                                                <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] font-mono opacity-70">
                                                                                    <Zap size={8} /> {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_req`)}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        <ChevronRight size={14} className="text-slate-700" />

                                                        {/* LV2 Card */}
                                                        <div className="flex-1 h-full relative group">
                                                            {(() => {
                                                                const cardId = `${type}-${branch}-2`;
                                                                const isFlipped = flippedCardId === cardId;
                                                                const isUnlocked = currentLevel >= 2;
                                                                return (
                                                                    <div
                                                                        onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                        className={`
                                                                            relative w-full h-full rounded-lg border p-2 cursor-pointer transition-all duration-300 flex flex-col justify-center
                                                                            ${isFlipped
                                                                                ? 'z-50 scale-110 bg-slate-900 border-indigo-400 shadow-2xl h-auto min-h-[140px]'
                                                                                : isUnlocked
                                                                                    ? 'bg-purple-950/20 border-purple-500/30 text-purple-100 hover:bg-purple-900/30 hover:border-purple-400/50'
                                                                                    : 'bg-slate-800/30 border-slate-700 text-slate-500 opacity-60'
                                                                            }
                                                                        `}
                                                                    >
                                                                        {isFlipped ? (
                                                                            <p className="text-[10px] leading-relaxed text-purple-100/90 whitespace-pre-wrap">
                                                                                {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_detail`)}
                                                                            </p>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex justify-between items-start mb-1">
                                                                                    <div className="text-[10px] font-black opacity-50">LV2</div>
                                                                                    {isUnlocked ? <Check size={10} className="text-green-400" /> : <Lock size={10} />}
                                                                                </div>
                                                                                <div className="text-[10px] font-bold leading-tight line-clamp-3">
                                                                                    {t(config[branch].rewardText[1])}
                                                                                </div>
                                                                                <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] font-mono opacity-70">
                                                                                    <Zap size={8} /> {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_req`)}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        <ChevronRight size={14} className="text-slate-700" />

                                                        {/* LV3 Complex Card (Split or Single) */}
                                                        <div className="flex-1 h-full relative">
                                                            {currentLevel === 3 && selectedVariant ? (
                                                                // Selected Variant Display
                                                                (() => {
                                                                    const subLevel = selectedVariant;
                                                                    const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                    const isFlipped = flippedCardId === cardId;
                                                                    const cardIdx = (selectedVariant + 1);
                                                                    return (
                                                                        <div
                                                                            onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                            className={`
                                                                                w-full h-full rounded-lg border p-2 cursor-pointer transition-all duration-300 flex flex-col justify-center
                                                                                ${isFlipped
                                                                                    ? 'absolute inset-0 z-50 scale-110 bg-slate-900 border-indigo-400 shadow-2xl h-auto min-h-[140px]'
                                                                                    : 'bg-orange-950/20 border-orange-500 text-orange-100 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                                                                }
                                                                            `}
                                                                        >
                                                                            {isFlipped ? (
                                                                                <p className="text-[10px] leading-relaxed text-orange-100/90 whitespace-pre-wrap">
                                                                                    {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}
                                                                                </p>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="flex justify-between items-start mb-1">
                                                                                        <div className="text-[10px] font-black opacity-50">LV3-{subLevel}</div>
                                                                                        <div className="px-1 py-0.5 bg-orange-500 rounded text-[8px] font-black text-white shadow-sm">MAX</div>
                                                                                    </div>
                                                                                    <div className="text-[10px] font-bold leading-tight">
                                                                                        {t(config[branch].rewardText[cardIdx])}
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()
                                                            ) : (
                                                                // Selection Mode (2 small cards)
                                                                <div className="flex flex-col gap-1.5 h-full">
                                                                    {[1, 2].map((subLevel) => {
                                                                        const idx = subLevel + 1;
                                                                        const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                        const isFlipped = flippedCardId === cardId;
                                                                        // Check if ready to select
                                                                        const canSelect = !selectedVariant && currentLevel === 2 && currentVal >= config[branch].thresholds[2];

                                                                        return (
                                                                            <div key={subLevel} className="flex-1 relative">
                                                                                <div
                                                                                    onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                                    className={`
                                                                                        absolute inset-0 rounded border p-1.5 cursor-pointer transition-all duration-300 flex flex-col justify-center
                                                                                        ${isFlipped
                                                                                            ? 'z-50 scale-110 bg-slate-900 border-indigo-400 shadow-2xl h-auto min-h-[100px]'
                                                                                            : canSelect
                                                                                                ? 'bg-slate-800 border-slate-600 text-slate-300 hover:border-green-400 hover:bg-slate-700 hover:text-green-300'
                                                                                                : 'bg-slate-800/30 border-slate-700 text-slate-600 opacity-50'
                                                                                        }
                                                                                    `}
                                                                                >
                                                                                    {isFlipped ? (
                                                                                        <p className="text-[9px] leading-relaxed text-slate-200">
                                                                                            {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}
                                                                                        </p>
                                                                                    ) : (
                                                                                        <div className="flex justify-between items-center w-full">
                                                                                            <span className="text-[9px] font-bold">LV3-{subLevel}</span>
                                                                                            {canSelect && <span className="text-[7px] font-black text-green-400 animate-pulse">SELECT</span>}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvolutionTree;
