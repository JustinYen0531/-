import React from 'react';
import {
    Zap, Dna, Star, Skull, Bomb, CheckCircle, Play, ArrowRight, Swords, RefreshCw, Hand, ChevronRight, ChevronLeft, Pause, LogOut
} from 'lucide-react';
import { GameState, PlayerID, Unit, UnitType } from '../types';
import {
    MAX_INTEREST, ORE_REWARDS, ENERGY_REGEN, ENERGY_CAP_RATIO, PLACEMENT_MINE_LIMIT,
    UNIT_STATS, EVOLUTION_COSTS, EVOLUTION_CONFIG
} from '../constants';

interface ControlPanelProps {
    gameState: GameState;
    targetMode: string | null;
    setTargetMode: (mode: string | null) => void;
    showEvolutionTree: boolean;
    setShowEvolutionTree: (show: boolean) => void;
    handleUnitClick: (unit: Unit) => void;
    finishPlacementPhase: () => void;
    startActionPhase: () => void;
    getUnit: (id: string) => Unit | null;
    getDisplayCost: (unit: Unit | null, baseCost: number, actionType?: string) => number;
    getActionButtonIndex: (actionType: string, unit: Unit | null | undefined) => number;
    getUnitIcon: (type: UnitType, size?: number, tier?: number) => React.ReactNode;
    getUnitName: (type: UnitType) => string;
    getEvolutionButtonStartIndex: (unit: Unit | null | undefined) => number;
    handleEvolve: (type: UnitType, branch: 'a' | 'b', variant?: 1 | 2) => void;
    handleActionComplete: (id: string | null) => void;
    handlePause: () => void;
    handleExitGame: () => void;
    t: (key: string, params?: any) => string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
    gameState,
    targetMode,
    setTargetMode,
    showEvolutionTree,
    setShowEvolutionTree,
    handleUnitClick,
    finishPlacementPhase,
    startActionPhase,
    getUnit,
    getDisplayCost,
    getActionButtonIndex,
    getUnitIcon,
    getUnitName,
    getEvolutionButtonStartIndex,
    handleEvolve,
    handleActionComplete,
    handlePause,
    handleExitGame,
    t
}) => {
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
    let currentRegen = ENERGY_REGEN; // Default 35
    if (gameState.turnCount >= 12) currentRegen = 50;
    else if (gameState.turnCount >= 8) currentRegen = 45;
    else if (gameState.turnCount >= 4) currentRegen = 40;

    const totalIncome = currentRegen + interest + currentOreIncome + (player.energyFromKills || 0);

    return (
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
                                <span className="text-white/80 text-xs">下回合預計收益</span>
                                <span className="text-emerald-400 font-black text-lg">+{totalIncome}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900/30 p-1.5 rounded border border-white/20">
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                        基礎
                                    </span>
                                    <span className="text-blue-300 font-bold">+{currentRegen}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                        利息
                                    </span>
                                    <span className="text-emerald-300 font-bold">+{interest}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                        領地/礦石
                                    </span>
                                    <span className="text-yellow-300 font-bold">+{currentOreIncome}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                        擊殺
                                    </span>
                                    <span className="text-red-300 font-bold">+{player.energyFromKills || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowEvolutionTree(true)}
                        className="mt-auto py-1 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded font-black text-[11px] flex items-center justify-center gap-1 border-2 border-purple-400 shadow-lg shadow-purple-500/50 transition-all hover:scale-105 text-white"
                    >
                        <Dna size={14} /> 進化樹
                    </button>
                </div>

                {/* Squad Selection */}
                <div className="flex-[7] flex flex-col border-l-2 border-white/30 px-4 items-center h-full justify-center bg-slate-800/30">
                    <div className="text-sm text-white mb-2 uppercase tracking-widest text-center w-full flex justify-between px-4 font-bold">
                        <span className="text-base">小隊選單</span>
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
                                        onClick={() => handleUnitClick(u)}
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
                                                            if (variantA === 1) colorClass = "text-cyan-400 fill-cyan-400";
                                                            else if (variantA === 2) colorClass = "text-purple-400 fill-purple-400";
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
                                                            if (variantB === 1) colorClass = "text-yellow-400 fill-yellow-400";
                                                            else if (variantB === 2) colorClass = "text-rose-500 fill-rose-500";
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

                                        {/* Health Bar */}
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

                                        {u.isDead && u.respawnTimer > 0 && (
                                            <div className="text-[10px] font-black text-red-500 font-mono">
                                                復活:{u.respawnTimer}
                                            </div>
                                        )}
                                    </button>

                                    {/* Energy Cap */}
                                    <div className="text-[10px] font-black text-cyan-300 font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                        {u.energyUsedThisTurn}/{Math.floor(u.startOfActionEnergy * ENERGY_CAP_RATIO)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions Panel */}
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
                                    onClick={finishPlacementPhase}
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
                                                onClick={() => startActionPhase()}
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
                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('move', getUnit(gameState.selectedUnitId!))}</div>
                                                    <ArrowRight size={20} />
                                                    <span className="text-[10px]">{t('move')}</span>
                                                </button>
                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                    <span>{(() => {
                                                        const unit = getUnit(gameState.selectedUnitId!);
                                                        if (!unit) return 3;
                                                        let baseCost = 3;
                                                        if (unit.hasFlag) {
                                                            const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                                                            if (genLevelB >= 3) baseCost = 4;
                                                            else if (unit.type === UnitType.GENERAL) baseCost = 5;
                                                        }
                                                        else if (unit.type === UnitType.RANGER && unit.carriedMine) baseCost = 3;
                                                        else baseCost = UNIT_STATS[unit.type].moveCost;
                                                        return getDisplayCost(unit, baseCost);
                                                    })()}</span>
                                                </div>
                                            </div>

                                            {(() => {
                                                const unit = getUnit(gameState.selectedUnitId!);
                                                if (!unit || unit.owner !== gameState.currentPlayer) return null;
                                                const buttons = [];

                                                if (unit.type === UnitType.GENERAL) {
                                                    const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
                                                    if (!unit.hasFlag || genLevelA >= 3 || gameState.isGodMode) {
                                                        buttons.push(
                                                            <div key="attack" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => setTargetMode('attack')}
                                                                    className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'attack' ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-105 border-red-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-red-500 text-slate-300'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('attack', unit)}</div>
                                                                    <Swords size={20} />
                                                                    <span className="text-[10px]">{t('attack')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                                    <span>{getDisplayCost(unit, 8)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                }

                                                // Dismantle
                                                const isOnEnemyBuilding = gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
                                                if (isOnEnemyBuilding) {
                                                    buttons.push(
                                                        <div key="dismantle" className="flex flex-col items-center gap-1">
                                                            <button
                                                                onClick={() => setTargetMode('custom_dismantle')}
                                                                className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'custom_dismantle' ? 'bg-orange-600 shadow-lg shadow-orange-500/50 scale-105 border-orange-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-orange-500 text-slate-300'}`}
                                                            >
                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('custom_dismantle', unit)}</div>
                                                                <RefreshCw size={20} />
                                                                <span className="text-[10px]">{t('dismantle')}</span>
                                                            </button>
                                                            <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                <span className="text-yellow-400"><Zap size={10} /></span>
                                                                <span>{getDisplayCost(unit, 15)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Unit specific skills
                                                if (unit.type === UnitType.MINESWEEPER) {
                                                    buttons.push(
                                                        <div key="scan" className="flex flex-col items-center gap-1">
                                                            <button
                                                                onClick={() => setTargetMode('scan')}
                                                                className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'scan' ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50 scale-105 border-cyan-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-cyan-500 text-slate-300'}`}
                                                            >
                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('scan', unit)}</div>
                                                                <RefreshCw size={20} />
                                                                <span className="text-[10px]">{t('scan')}</span>
                                                            </button>
                                                            <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                <span className="text-yellow-400"><Zap size={10} /></span>
                                                                <span>{getDisplayCost(unit, 12)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                    if (player.evolutionLevels[UnitType.MINESWEEPER].a >= 1) {
                                                        buttons.push(
                                                            <div key="place_tower" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    onClick={() => setTargetMode('place_tower')}
                                                                    className={`px-3 py-2 rounded flex flex-col items-center gap-1 min-w-[60px] transition-all relative font-bold border-2 ${targetMode === 'place_tower' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/50 scale-105 border-indigo-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{getActionButtonIndex('place_tower', unit)}</div>
                                                                    <RefreshCw size={20} />
                                                                    <span className="text-[10px]">{t('place_tower')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[10px] font-bold text-white">
                                                                    <span className="text-yellow-400"><Zap size={10} /></span>
                                                                    <span>{getDisplayCost(unit, 15)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                } else if (unit.type === UnitType.MAKER) {
                                                    // ... more buttons ...
                                                }

                                                // End Turn / Evolution Buttons
                                                let evolIdx = getEvolutionButtonStartIndex(unit);
                                                const levelA = player.evolutionLevels[unit.type].a;
                                                const levelB = player.evolutionLevels[unit.type].b;
                                                const nextThresholdA = EVOLUTION_CONFIG[unit.type].a.thresholds[levelA];
                                                const nextThresholdB = EVOLUTION_CONFIG[unit.type].b.thresholds[levelB];
                                                const costA = EVOLUTION_COSTS[levelA as 0 | 1 | 2] || 0;
                                                const costB = EVOLUTION_COSTS[levelB as 0 | 1 | 2] || 0;

                                                // Simplified for now - assuming conditions are met
                                                if (levelA < 3 && player.energy >= costA) {
                                                    buttons.push(
                                                        <div key="evol_a" className="flex flex-col items-center gap-1">
                                                            <button onClick={() => handleEvolve(unit.type, 'a')} className="px-3 py-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded border-2 border-blue-400 text-white font-bold text-[10px] min-w-[60px]">
                                                                <div className="absolute top-0.5 left-1.5 text-xs font-black text-white/90">{evolIdx++}</div>
                                                                {t('evolve_a')}
                                                            </button>
                                                            <div className="text-[10px] text-yellow-300 font-bold"><Zap size={10} className="inline mr-1" />{costA}</div>
                                                        </div>
                                                    );
                                                }

                                                return buttons;
                                            })()}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* End Turn Button Section */}
                            <div className="w-full h-24 flex items-center justify-center gap-4 border-t border-white/10 mt-2">
                                <button onClick={handlePause} className="p-3 bg-slate-700/50 hover:bg-slate-700 rounded-full text-white border border-white/20 transition-all hover:scale-110">
                                    <Pause size={24} />
                                </button>
                                <button
                                    onClick={() => handleActionComplete(gameState.selectedUnitId)}
                                    className="px-10 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-lg font-black shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center gap-2 border-2 border-red-400 group transition-all hover:scale-105 active:scale-95"
                                >
                                    <span className="relative">
                                        <div className="absolute -top-6 -left-2 text-[10px] font-black text-white/90 bg-black/40 px-1.5 rounded border border-white/20 group-hover:bg-red-900 group-hover:scale-110 transition-all">SPACE</div>
                                        {t('end_action')}
                                    </span>
                                    <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button onClick={handleExitGame} className="p-3 bg-slate-700/50 hover:bg-red-900/40 rounded-full text-white border border-white/20 transition-all hover:scale-110">
                                    <LogOut size={24} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
