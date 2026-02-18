import React, { useState } from 'react';
import { GameState, UnitType } from '../types';
import { EVOLUTION_CONFIG } from '../constants';
import { getUnitTypeAbbr, getUnitIcon } from '../gameHelpers';
import { Dna, X } from '../icons';

interface EvolutionTreeProps {
    gameState: GameState;
    onClose: () => void;
    t: (key: string, params?: any) => string;
}

const EvolutionTree: React.FC<EvolutionTreeProps> = ({ gameState, onClose, t }) => {
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
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center pointer-events-auto">
            <div className="w-[95%] max-w-6xl max-h-[85vh] bg-gray-900 border-2 border-indigo-500 rounded-lg shadow-2xl flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 shrink-0">
                    <h2 className="text-2xl font-bold text-indigo-400 flex items-center gap-2"><Dna size={24} /> {t('evolution_tree')}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {Object.entries(EVOLUTION_CONFIG).map(([typeStr, config]) => {
                            const type = typeStr as UnitType;
                            return (
                                <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-4 text-indigo-300 font-bold border-b border-gray-700 pb-3">
                                        {getUnitIcon(type, 24)} <span className="text-lg">{type}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {['a', 'b'].map((branchKey) => {
                                            const branch = branchKey as 'a' | 'b';
                                            const currentVal = getProgress(type, branch);
                                            const maxVal = config[branch].thresholds[2];
                                            const currentLevel = levels[type][branch];
                                            const variantKey = branch === 'a' ? 'aVariant' : 'bVariant';
                                            const selectedVariant = levels[type][variantKey];

                                            let barColor = 'bg-gray-600';
                                            if (currentLevel === 1) barColor = 'bg-blue-500';
                                            if (currentLevel === 2) barColor = 'bg-purple-500';
                                            if (currentLevel === 3) barColor = 'bg-yellow-400';

                                            return (
                                                <div key={branch} className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-sm text-gray-300 font-bold flex items-center gap-2">
                                                            <span className={`w-2.5 h-2.5 rounded-full ${branch === 'a' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                                            <span>{t(branch === 'a' ? 'path_a' : 'path_b')}</span>
                                                            <span className="text-xs text-gray-400 font-normal">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_subtitle`)}</span>
                                                            {currentLevel < 3 && currentVal >= config[branch].thresholds[currentLevel] && (
                                                                <span className="text-[10px] text-green-400 font-bold animate-pulse">??READY</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono">{currentVal} / {maxVal}</div>
                                                    </div>

                                                    <div className="flex h-2">
                                                        {(() => {
                                                            const t1 = config[branch].thresholds[0];
                                                            const t2 = config[branch].thresholds[1];
                                                            const seg1Width = (t1 / maxVal) * 100;
                                                            const seg2Width = ((t2 - t1) / maxVal) * 100;
                                                            const seg3Width = ((maxVal - t2) / maxVal) * 100;

                                                            return (
                                                                <>
                                                                    <div style={{ width: `${seg1Width}%` }} className="bg-gray-700/50 rounded-l-full overflow-hidden border-r border-gray-900/50">
                                                                        <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, (currentVal / t1) * 100)}%` }} />
                                                                    </div>
                                                                    <div style={{ width: `${seg2Width}%` }} className="bg-gray-700/50 overflow-hidden border-r border-gray-900/50">
                                                                        <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: currentVal > t1 ? `${Math.min(100, ((currentVal - t1) / (t2 - t1)) * 100)}%` : '0%' }} />
                                                                    </div>
                                                                    <div style={{ width: `${seg3Width}%` }} className="bg-gray-700/50 rounded-r-full overflow-hidden">
                                                                        <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: currentVal > t2 ? `${Math.min(100, ((currentVal - t2) / (maxVal - t2)) * 100)}%` : '0%' }} />
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="flex items-center h-24">
                                                        {/* LV1 Card */}
                                                        <div className="flex-1 relative h-full">
                                                            {(() => {
                                                                const cardId = `${type}-${branch}-1`;
                                                                const isFlipped = flippedCardId === cardId;
                                                                const isUnlocked = currentLevel >= 1;
                                                                return (
                                                                    <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                        className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#0a0f1a] border-indigo-400 shadow-2xl overflow-visible' : `h-full ${isUnlocked ? 'bg-blue-950/40 border-blue-600/80 text-blue-100' : 'bg-gray-800/50 border-gray-600 text-gray-500 opacity-60'}`}`}>
                                                                        {isFlipped ? (
                                                                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-blue-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_detail`)}</div>
                                                                        ) : (
                                                                            <div className="flex justify-between items-center w-full">
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <div className="font-bold mb-0.5 opacity-70">LV1</div>
                                                                                    <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[0])}</div>
                                                                                </div>
                                                                                <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                    {isUnlocked && <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>}
                                                                                    <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_req`)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Connection 1 */}
                                                        <div className="w-8 h-0.5 bg-gray-700/80 shrink-0" />

                                                        {/* LV2 Card */}
                                                        <div className="flex-1 relative h-full">
                                                            {(() => {
                                                                const cardId = `${type}-${branch}-2`;
                                                                const isFlipped = flippedCardId === cardId;
                                                                const isUnlocked = currentLevel >= 2;
                                                                return (
                                                                    <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                        className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1a0a1f] border-indigo-400 shadow-2xl' : `h-full ${isUnlocked ? 'bg-purple-950/40 border-purple-600/80 text-purple-100' : 'bg-gray-800/50 border-gray-600 text-gray-500 opacity-60'}`}`}>
                                                                        {isFlipped ? (
                                                                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-purple-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_detail`)}</div>
                                                                        ) : (
                                                                            <div className="flex justify-between items-center w-full">
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <div className="font-bold mb-0.5 opacity-70">LV2</div>
                                                                                    <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[1])}</div>
                                                                                </div>
                                                                                <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                    {isUnlocked && <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>}
                                                                                    <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r2_req`)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Connection 2 or Branch */}
                                                        {
                                                            currentLevel === 3 && selectedVariant ? (
                                                                <>
                                                                    <div className="w-8 h-0.5 bg-gray-700/80 shrink-0" />
                                                                    <div className="flex-1 relative h-full">
                                                                        {(() => {
                                                                            const subLevel = selectedVariant;
                                                                            const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                            const isFlipped = flippedCardId === cardId;
                                                                            const cardIdx = (selectedVariant + 1);
                                                                            return (
                                                                                <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                                    className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1f100a] border-indigo-400 shadow-2xl' : 'h-full bg-orange-950/40 border-orange-500 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.15)]'}`}>
                                                                                    {isFlipped ? (
                                                                                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-orange-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}</div>
                                                                                    ) : (
                                                                                        <div className="flex justify-between items-center w-full">
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <div className="font-bold mb-0.5 opacity-70">LV3-{subLevel}</div>
                                                                                                <div className="text-[11px] leading-tight font-black truncate">{t(config[branch].rewardText[cardIdx])}</div>
                                                                                            </div>
                                                                                            <div className="text-[10px] text-gray-300 font-bold flex items-center gap-1 shrink-0 ml-2">
                                                                                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex items-center justify-center text-[6px] text-white shrink-0"></div>
                                                                                                <span className="opacity-80">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_req`)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex flex-col items-center justify-center text-gray-700/80 w-8 shrink-0">
                                                                        <svg width="32" height="80" viewBox="0 0 32 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                            <path d="M0 40H8C12 40 14 39 14 36V18C14 15 16 14 24 14H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                                            <path d="M14 44V62C14 65 16 66 24 66H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                                            <circle cx="14" cy="40" r="2.5" fill="currentColor" className="animate-pulse" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex flex-col flex-1 gap-1.5 h-full">
                                                                        {[2, 3].map((idx) => {
                                                                            const subLevel = idx - 1;
                                                                            const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                            const isOtherVariantSelected = selectedVariant !== null && selectedVariant !== undefined && selectedVariant !== subLevel;
                                                                            const isUnlocked = currentLevel === 3 && selectedVariant !== null && selectedVariant === subLevel;
                                                                            const isFlipped = flippedCardId === cardId;
                                                                            return (
                                                                                <div key={idx} className="relative h-[46px]">
                                                                                    <div onClick={() => {
                                                                                        if (isOtherVariantSelected) return;
                                                                                        setFlippedCardId(isFlipped ? null : cardId);
                                                                                    }} className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1a1a1a] border-indigo-400 shadow-2xl' : `h-full ${isUnlocked ? 'bg-orange-950/40 border-orange-500 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : isOtherVariantSelected ? 'bg-transparent border-gray-800 text-gray-700 opacity-20 grayscale pointer-events-none' : 'bg-gray-800/40 border-gray-600/50 text-gray-500 hover:border-gray-500'}`}`}>
                                                                                        {isFlipped ? (
                                                                                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-gray-100">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}</div>
                                                                                        ) : (
                                                                                            <div className="flex justify-between items-center h-full">
                                                                                                <div className="flex flex-col justify-center min-w-0">
                                                                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                                                                        <span className={`text-[9px] ${isUnlocked ? 'text-orange-400' : 'text-gray-500'} font-bold`}>LV3-{subLevel}</span>
                                                                                                        {isUnlocked && <span className="text-[7px] px-1 bg-orange-600 text-white rounded-sm font-black animate-pulse">ACTIVED</span>}
                                                                                                    </div>
                                                                                                    <div className="text-[10px] leading-tight truncate font-bold">{t(config[branch].rewardText[idx])}</div>
                                                                                                </div>
                                                                                                <div className="text-[10px] text-gray-400 font-bold italic shrink-0 ml-2 text-right leading-tight">
                                                                                                    {t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_req`)}
                                                                                                    {!selectedVariant && currentLevel === 2 && currentVal >= config[branch].thresholds[2] && <div className="text-green-400 font-black animate-bounce mt-0.5 text-[8px]">SELECT</div>}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </>
                                                            )}
                                                    </div >
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
