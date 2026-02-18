import React, { useState } from 'react';
import {
    Zap, Dna, Play, ArrowRight, CheckCircle, Bomb, Swords,
    ArrowDownToLine, Flag, Eye, Radio, FlaskConical, Unlock,
    ChevronRight, Hand, Ghost, Cpu, Users, Info
} from 'lucide-react';
import {
    GameState, Unit, MineType, PlayerID, UnitType
} from '../types';
import {
    MAX_INTEREST, ENERGY_REGEN, ORE_REWARDS,
    UNIT_STATS, PLACEMENT_MINE_LIMIT,
    EVOLUTION_CONFIG, EVOLUTION_COSTS
} from '../constants';
import {
    getUnitTypeAbbr, getUnitName, getMineBaseCost
} from '../gameHelpers';
import UnitInfoPanel from './UnitInfoPanel';

interface ControlPanelProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    targetMode: any; // Using any for now to match App.tsx's type if complex
    setTargetMode: (mode: any) => void;
    selectedMineType: MineType;
    setSelectedMineType: (type: MineType) => void;
    showEvolutionTree: boolean;
    setShowEvolutionTree: (show: boolean) => void;
    language: string;
    t: (key: string, params?: any) => string;
    actions: {
        handleActionComplete: (id: string | null) => void;
        handleScanAction: (unit: Unit, r: number, c: number) => void;
        handlePlaceMineAction: (unit: Unit, r: number, c: number) => void;
        handleEvolve: (type: UnitType, branch: 'a' | 'b', variant?: number) => void;
        handlePickupFlag: () => void;
        handleDropFlag: () => void;
        handleAttack: (attackerId: string, targetUnit: Unit) => void;
        // Add others as needed
    };
    helpers: {
        getUnit: (id: string | null) => Unit | null;
        getActionButtonIndex: (action: string, unit: Unit | null) => string;
        getEvolutionButtonStartIndex: (unit: Unit | null) => number;
        getDisplayCost: (unit: Unit | null, baseCost: number) => number;
        getNextUnitToAct: () => Unit | null;
    };
    phases: {
        finishPlacementPhase: () => void;
        startActionPhase: () => void;
    };
    handleUnitClick: (unitId: string) => void;
    // Specific handlers that were in App.tsx
    handleDisarmAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceTowerAction: (unit: Unit, r: number, c: number) => void;
    handleDetonateTowerAction: (unit: Unit) => void;
    handlePlaceFactoryAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceHubAction: (unit: Unit, r: number, c: number) => void;
    handleTeleportToHubAction: (unit: Unit) => void;
    handleStealthAction: (unitId: string) => void;
    handleRangerAction: (subAction: 'pickup' | 'drop') => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
    gameState, setGameState, targetMode, setTargetMode,
    selectedMineType, setSelectedMineType,
    showEvolutionTree, setShowEvolutionTree,
    language, t, actions, helpers, phases, handleUnitClick,
    handleDisarmAction, handlePlaceTowerAction, handleDetonateTowerAction,
    handlePlaceFactoryAction, handlePlaceHubAction, handleTeleportToHubAction,
    handleStealthAction, handleRangerAction
}) => {
    const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
    const player = gameState.players[gameState.currentPlayer];
    const isThinking = gameState.phase === 'thinking';
    const isPlacement = gameState.phase === 'placement';

    // Calculate detailed income breakdown
    const interest = Math.min(Math.floor(player.energy / 10), MAX_INTEREST);

    // Calculate Passive Ore Income
    const currentOreIncome = player.units.reduce((acc, u) => {
        if (u.isDead) return acc;
        const cell = gameState.cells[u.r][u.c];
        if (cell.hasEnergyOre && cell.oreSize) {
            return acc + ORE_REWARDS[cell.oreSize];
        }
        return acc;
    }, 0);

    // Dynamic regen based on turn
    let currentRegen = ENERGY_REGEN;
    if (gameState.turnCount >= 12) currentRegen = 50;
    else if (gameState.turnCount >= 8) currentRegen = 45;
    else if (gameState.turnCount >= 4) currentRegen = 40;

    const totalIncome = currentRegen + interest + currentOreIncome + player.energyFromKills;

    const renderEvolutionTree = () => {
        if (!showEvolutionTree) return null;

        return (
            <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col p-6 animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/20 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-600 rounded-xl shadow-lg shadow-purple-500/40">
                            <Dna size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-widest">{t('evolution_tree')}</h2>
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-tighter">{t('evolution_desc')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setShowEvolutionTree(false); setFlippedCardId(null); }}
                        className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-all hover:scale-110 border-2 border-white/10"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/20">
                    <div className="space-y-8 pb-12">
                        {Object.values(UnitType).map((type) => {
                            const currentLevels = player.evolutionLevels[type];
                            const config = EVOLUTION_CONFIG[type];
                            const currStats = player.questStats;

                            return (
                                <div key={type} className="bg-slate-900/40 rounded-2xl p-6 border border-white/5 shadow-inner">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="text-xl font-black text-white bg-slate-800 px-4 py-1 rounded-lg border border-white/10">{getUnitName(type)}</div>
                                        <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Branch A & B Rendering (Simplified for brevity, similar to original) */}
                                        {['a', 'b'].map((branchId) => {
                                            const branch = branchId as 'a' | 'b';
                                            const currentLevel = currentLevels[branch];
                                            const configBranch = config[branch];
                                            const selectedVariant = currentLevels[`${branch}Variant` as keyof typeof currentLevels];

                                            // Get stats for progress bar
                                            let currentVal = 0;
                                            if (type === UnitType.GENERAL) currentVal = branch === 'a' ? currStats.generalDamage : currStats.generalFlagSteps;
                                            else if (type === UnitType.MINESWEEPER) currentVal = branch === 'a' ? currStats.sweeperMinesMarked : currStats.consecutiveSafeRounds;
                                            else if (type === UnitType.RANGER) currentVal = branch === 'a' ? currStats.rangerSteps : currStats.rangerMinesMoved;
                                            else if (type === UnitType.MAKER) currentVal = branch === 'a' ? currStats.makerMinesTriggeredByEnemy : currStats.makerMinesPlaced;
                                            else if (type === UnitType.DEFUSER) currentVal = branch === 'a' ? currStats.defuserMinesSoaked : currStats.defuserMinesDisarmed;

                                            return (
                                                <div key={branch} className="space-y-4">
                                                    <div className="flex justify-between items-end px-1">
                                                        <div className="text-xs font-black text-slate-500 uppercase">{branch === 'a' ? 'Branch Alpha' : 'Branch Beta'}</div>
                                                        <div className="text-[10px] font-bold text-white/40">LV {currentLevel}/3</div>
                                                    </div>

                                                    <div className="flex items-center gap-3 h-[80px]">
                                                        {/* LV1 Card */}
                                                        <div className="flex-1 relative h-full">
                                                            {(() => {
                                                                const cardId = `${type}-${branch}-1`;
                                                                const isFlipped = flippedCardId === cardId;
                                                                const isUnlocked = currentLevel >= 1;
                                                                return (
                                                                    <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                        className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#0a1a1a] border-indigo-400 shadow-2xl' : `h-full ${isUnlocked ? 'bg-cyan-950/40 border-cyan-600/80 text-cyan-100' : 'bg-gray-800/50 border-gray-600 text-gray-500 opacity-60'}`}`}>
                                                                        {isFlipped ? (
                                                                            <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-cyan-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r1_detail`)}</div>
                                                                        ) : (
                                                                            <div className="flex justify-between items-center w-full">
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <div className="font-bold mb-0.5 opacity-70">LV1</div>
                                                                                    <div className="text-[11px] leading-tight font-black truncate">{t(configBranch.rewardText[0])}</div>
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
                                                                                    <div className="text-[11px] leading-tight font-black truncate">{t(configBranch.rewardText[1])}</div>
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

                                                        {/* LV3 Rendering Logic */}
                                                        {currentLevel === 3 && selectedVariant ? (
                                                            <>
                                                                <div className="w-8 h-0.5 bg-gray-700/80 shrink-0" />
                                                                <div className="flex-1 relative h-full">
                                                                    {(() => {
                                                                        const subLevel = selectedVariant as number;
                                                                        const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                        const isFlipped = flippedCardId === cardId;
                                                                        const cardIdx = (subLevel + 1);
                                                                        return (
                                                                            <div onClick={() => setFlippedCardId(isFlipped ? null : cardId)}
                                                                                className={`absolute inset-0 z-10 p-2 rounded border flex flex-col justify-center cursor-pointer transition-all duration-300 ${isFlipped ? 'scale-110 !h-auto min-h-[140px] !z-50 bg-[#1f100a] border-indigo-400 shadow-2xl' : 'h-full bg-orange-950/40 border-orange-500 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.15)]'}`}>
                                                                                {isFlipped ? (
                                                                                    <div className="text-[11px] leading-relaxed whitespace-pre-wrap py-1 text-orange-50">{t(`evol_${getUnitTypeAbbr(type)}_${branch}_r3_${subLevel}_detail`)}</div>
                                                                                ) : (
                                                                                    <div className="flex justify-between items-center w-full">
                                                                                        <div className="flex flex-col min-w-0">
                                                                                            <div className="font-bold mb-0.5 opacity-70">LV3-{subLevel}</div>
                                                                                            <div className="text-[11px] leading-tight font-black truncate">{t(configBranch.rewardText[cardIdx])}</div>
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
                                                                    {[1, 2].map((subLevel) => {
                                                                        const cardId = `${type}-${branch}-3-${subLevel}`;
                                                                        const isOtherVariantSelected = selectedVariant !== null && selectedVariant !== undefined && selectedVariant !== subLevel;
                                                                        const isUnlocked = currentLevel === 3 && (selectedVariant as any) === subLevel;
                                                                        const isFlipped = flippedCardId === cardId;
                                                                        const idx = subLevel + 1;
                                                                        return (
                                                                            <div key={subLevel} className="relative h-[46px]">
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
                                                                                                <div className="text-[10px] leading-tight truncate font-bold">{t(configBranch.rewardText[idx])}</div>
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
                                                    </div>

                                                    {/* Progress Bar */}
                                                    {currentLevel < 3 && (
                                                        <div className="mt-2 text-xs">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-gray-400 font-bold">{t('progress')}</span>
                                                                <span className="text-white font-black">{currentVal} / {configBranch.thresholds[currentLevel]}</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                                                    style={{ width: `${Math.min(100, (currentVal / configBranch.thresholds[currentLevel]) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
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
        );
    };

    return (
        <>
            {renderEvolutionTree()}
            <div className="h-56 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-t-4 border-white flex shrink-0 z-20 shadow-2xl shadow-white/10">
                <div className="flex w-full">
                    {/* Energy & Timer Panel */}
                    <div className="flex-[3] flex flex-col p-3 border-r-2 border-white/30 min-w-[200px] bg-slate-800/50 gap-2">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Zap size={20} className="text-yellow-400 drop-shadow-lg" />
                                <span className="text-4xl font-black text-yellow-400 drop-shadow-lg">{player.energy}</span>
                            </div>

                            <div className="text-xs text-white space-y-1 font-semibold">
                                <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded border border-emerald-500/30">
                                    <span className="text-white/80 text-xs">{t('next_round_income')}</span>
                                    <span className="text-emerald-400 font-black text-lg">+{totalIncome}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900/30 p-1.5 rounded border border-white/20">
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                            {t('base')}
                                        </span>
                                        <span className="text-blue-300 font-bold">+{currentRegen}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                            {t('int')}
                                        </span>
                                        <span className="text-emerald-300 font-bold">+{interest}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            {t('stn')}
                                        </span>
                                        <span className="text-yellow-300 font-bold">+{currentOreIncome}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                            {t('kill')}
                                        </span>
                                        <span className="text-red-300 font-bold">+{player.energyFromKills}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowEvolutionTree(true)}
                            className="mt-auto py-1 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded font-black text-[11px] flex items-center justify-center gap-1 border-2 border-purple-400 shadow-lg shadow-purple-500/50 transition-all hover:scale-105 text-white"
                        >
                            <Dna size={14} /> {t('evolution_tree')}
                        </button>
                    </div>

                    <UnitInfoPanel
                        gameState={gameState}
                        language={language as any}
                        t={t}
                        onUnitClick={handleUnitClick}
                    />

                    {/* Action Buttons & End Turn */}
                    <div className="flex-[4] flex flex-col border-l-2 border-white/30 px-4 items-center justify-between h-full py-1 bg-slate-800/30">
                        {isPlacement ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                <div className="text-sm font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">{t('placement_phase')}</div>
                                <div className="text-[10px] text-white text-center font-semibold">{t('placement_guide')}</div>
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => setTargetMode(targetMode === 'place_setup_mine' ? null : 'place_setup_mine')}
                                        className={`flex-1 py-2 px-1 rounded font-black text-xs flex items-center justify-center gap-1 border-2 transition-all ${targetMode === 'place_setup_mine' ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/50' : 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-purple-500 text-slate-300'}`}
                                    >
                                        <Bomb size={14} /> {t('place_setup_mine')} ({player.placementMinesPlaced}/{PLACEMENT_MINE_LIMIT})
                                    </button>
                                    <button
                                        onClick={phases.finishPlacementPhase}
                                        className="flex-1 py-2 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-black text-xs flex items-center justify-center gap-1 border-2 border-emerald-400 shadow-lg shadow-emerald-500/50 transition-all"
                                    >
                                        <CheckCircle size={14} /> {t('confirm_placement')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-base text-white uppercase tracking-widest text-center w-full font-bold mt-6">
                                    {gameState.selectedUnitId ? t('select_action') : t('select_unit')}
                                </div>

                                <div className="flex-1 flex flex-col justify-center w-full">
                                    <div className="w-full flex flex-col justify-center gap-2 items-center relative min-w-[150px]">
                                        {isThinking ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-white font-black animate-pulse uppercase tracking-widest text-xs drop-shadow-lg">{t('planning_phase')}</span>
                                                <button
                                                    onClick={() => phases.startActionPhase()}
                                                    className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-black shadow-lg shadow-cyan-500/50 flex items-center gap-2 border-2 border-cyan-400 transition-all"
                                                >
                                                    <Play size={20} fill="currentColor" /> {t('ready')}
                                                </button>
                                            </div>
                                        ) : gameState.selectedUnitId ? (
                                            <div className="flex gap-2 justify-center flex-wrap">
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => setTargetMode('move')}
                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'move' ? 'bg-emerald-600 shadow-lg shadow-emerald-500/50 scale-105 border-emerald-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-emerald-500 text-slate-300'}`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('move', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        <ArrowRight size={20} />
                                                        <span className="text-[10px]">{t('move')}</span>
                                                    </button>
                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                        <span className="text-yellow-400">⚡</span>
                                                        <span>{(() => {
                                                            const unit = helpers.getUnit(gameState.selectedUnitId);
                                                            if (!unit) return 3;
                                                            let baseCost = (unit.hasFlag) ? (gameState.players[unit.owner].evolutionLevels[UnitType.GENERAL].b >= 3 ? 4 : (unit.type === UnitType.GENERAL ? 5 : 3)) : (unit.type === UnitType.RANGER && unit.carriedMine ? 3 : UNIT_STATS[unit.type].moveCost);
                                                            return helpers.getDisplayCost(unit, baseCost);
                                                        })()}</span>
                                                    </div>
                                                </div>

                                                {(() => {
                                                    const unit = helpers.getUnit(gameState.selectedUnitId);
                                                    if (!unit || unit.owner !== gameState.currentPlayer) return null;
                                                    const buttons = [];

                                                    // General Actions
                                                    if (unit.type === UnitType.GENERAL) {
                                                        const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
                                                        if (!unit.hasFlag || genLevelA >= 3 || (gameState as any).isGodMode) {
                                                            buttons.push(
                                                                <div key="attack" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => setTargetMode('attack')}
                                                                        className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'attack' ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-105 border-red-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-red-500 text-slate-300'}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('attack', unit)}</div>
                                                                        <Swords size={20} />
                                                                        <span className="text-[10px]">{t('attack')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                        <span className="text-yellow-400">⚡</span>
                                                                        <span>{helpers.getDisplayCost(unit, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
                                                        if (!unit.hasFlag && isAtFlag) {
                                                            buttons.push(
                                                                <div key="pickup" className="flex flex-col items-center gap-1">
                                                                    <button onClick={actions.handlePickupFlag} className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600/70 hover:bg-yellow-600 border-yellow-500 cursor-pointer">
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('pickup_flag', unit)}</div>
                                                                        <Flag size={20} />
                                                                        <span className="text-[10px]">{t('take')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.hasFlag) {
                                                            buttons.push(
                                                                <div key="drop" className="flex flex-col items-center gap-1">
                                                                    <button onClick={actions.handleDropFlag} className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-yellow-600/70 hover:bg-yellow-600 border-yellow-500 shadow-lg shadow-yellow-500/50">
                                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('drop_flag', unit)}</div>
                                                                        <ArrowDownToLine size={20} />
                                                                        <span className="text-[10px]">{t('drop')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Dismantle
                                                    if (unit.type !== UnitType.DEFUSER && gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner)) {
                                                        buttons.push(
                                                            <div key="custom_dismantle" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleDisarmAction(unit, unit.r, unit.c)} className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300">
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('custom_dismantle', unit)}</div>
                                                                    <Unlock size={20} />
                                                                    <span className="text-[10px]">拆除建築</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, 3)}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Minesweeper
                                                    if (unit.type === UnitType.MINESWEEPER) {
                                                        const swpA = player.evolutionLevels[UnitType.MINESWEEPER].a;
                                                        const swpB = player.evolutionLevels[UnitType.MINESWEEPER].b;
                                                        if (swpA >= 1) {
                                                            buttons.push(
                                                                <div key="place_tower" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => handlePlaceTowerAction(unit, unit.r, unit.c)} className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">
                                                                        <Radio size={20} /> <span className="text-[10px]">設置塔</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, 8)}</div>
                                                                </div>
                                                            );
                                                        }
                                                        buttons.push(
                                                            <div key="scan" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => setTargetMode('scan')} className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'scan' ? 'bg-cyan-600 border-cyan-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}>
                                                                    <Eye size={20} /> <span className="text-[10px]">{t('scan')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, swpB >= 3 ? 3 : (swpB >= 2 ? 4 : 5))}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Maker Actions
                                                    if (unit.type === UnitType.MAKER) {
                                                        const mkrA = player.evolutionLevels[UnitType.MAKER].a;
                                                        const mkrB = player.evolutionLevels[UnitType.MAKER].b;
                                                        if (mkrB >= 1) {
                                                            buttons.push(
                                                                <div key="place_factory" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => handlePlaceFactoryAction(unit, unit.r, unit.c)} className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] bg-slate-700 border-2 border-slate-600">
                                                                        <FlaskConical size={20} /> <span className="text-[10px]">設置工廠</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, (mkrB === 3 && player.evolutionLevels[UnitType.MAKER].bVariant === 2) ? 4 : 6)}</div>
                                                                </div>
                                                            );
                                                        }
                                                        // Simplified mine place...
                                                        buttons.push(
                                                            <div key="place_mine_group" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => setTargetMode(targetMode === 'place_mine' ? null : 'place_mine')} className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[72px] transition-all relative font-bold border-2 ${targetMode === 'place_mine' ? 'bg-purple-600 border-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                                                    <Bomb size={20} /> <span className="text-[10px]">放置地雷</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, getMineBaseCost(selectedMineType))}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Defuser Actions
                                                    if (unit.type === UnitType.DEFUSER) {
                                                        const defB = player.evolutionLevels[UnitType.DEFUSER].b;
                                                        buttons.push(
                                                            <div key="disarm" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => setTargetMode('disarm')} className={`px-3 py-2 rounded bg-slate-700 border-2 border-slate-600`}>
                                                                    <Unlock size={20} /> <span className="text-[10px]">{t('disarm')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, 3)}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Ranger Actions
                                                    if (unit.type === UnitType.RANGER) {
                                                        const rngA = player.evolutionLevels[UnitType.RANGER].a;
                                                        const rngB = player.evolutionLevels[UnitType.RANGER].b;
                                                        if (rngA >= 1) {
                                                            buttons.push(
                                                                <div key="place_hub" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => handlePlaceHubAction(unit, unit.r, unit.c)} className="px-3 py-2 rounded bg-slate-700 border-2 border-slate-600">
                                                                        <Cpu size={20} /> <span className="text-[10px]">設置樞紐</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ {helpers.getDisplayCost(unit, 8)}</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.carriedMine) {
                                                            buttons.push(
                                                                <div key="drop_mine" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => handleRangerAction('drop')} className="px-3 py-2 rounded bg-yellow-600/70 border-2 border-yellow-500">
                                                                        <ArrowDownToLine size={20} /> <span className="text-[10px]">{t('drop_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    return buttons;
                                                })()}

                                                {/* Evolution Buttons Logic */}
                                                {(() => {
                                                    const unit = helpers.getUnit(gameState.selectedUnitId);
                                                    if (!unit || unit.owner !== gameState.currentPlayer) return null;
                                                    const pLevels = player.evolutionLevels[unit.type];
                                                    const evolveButtons = [];
                                                    const canEvolveA = pLevels.a < 3 && player.energy >= EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS];
                                                    const canEvolveB = pLevels.b < 3 && player.energy >= EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS];

                                                    if (canEvolveA) {
                                                        evolveButtons.push(
                                                            <div key="evolve_a" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => actions.handleEvolve(unit.type, 'a')} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 font-bold border-2 border-blue-400 shadow-lg text-white">
                                                                    <Dna size={20} /> <span className="text-[9px]">進化 A</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] text-white">⚡ {EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS]}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canEvolveB) {
                                                        evolveButtons.push(
                                                            <div key="evolve_b" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => actions.handleEvolve(unit.type, 'b')} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 font-bold border-2 border-orange-400 shadow-lg text-white">
                                                                    <Dna size={20} /> <span className="text-[9px]">進化 B</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] text-white">⚡ {EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS]}</div>
                                                            </div>
                                                        );
                                                    }
                                                    return evolveButtons;
                                                })()}

                                                {/* End Turn */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => actions.handleActionComplete(gameState.selectedUnitId)}
                                                        className="px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative bg-slate-600 hover:bg-slate-500 font-bold border-2 border-slate-500 text-slate-200"
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{helpers.getActionButtonIndex('end_turn', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        <CheckCircle size={20} />
                                                        <span className="text-[10px]">{t('end_turn')}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full flex flex-col items-center justify-center gap-2">
                                                {(() => {
                                                    const nextUnit = helpers.getNextUnitToAct();
                                                    if (!nextUnit) return <span className="text-white font-semibold">{t('select_unit')}</span>;
                                                    return (
                                                        <button
                                                            onClick={() => actions.handleActionComplete(nextUnit.id)}
                                                            className="w-full px-6 py-3 rounded flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-500 font-bold border-2 border-indigo-500 text-indigo-200 shadow-lg"
                                                        >
                                                            <ArrowRight size={20} />
                                                            <span className="text-sm">{t('skip_turn')}</span>
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ControlPanel;
