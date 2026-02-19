import React from 'react';
import {
    Zap, Dna, Play, ArrowRight, CheckCircle, Bomb, Swords,
    ArrowDownToLine, Flag, Eye, Radio, FlaskConical, Unlock,
    Cpu, Cloud, Snowflake, Share2, Radiation, Ghost, Scan, Heart, Magnet, Brain
} from 'lucide-react';
import {
    GameState, Unit, UnitType, PlayerID,
    MineType, TargetMode
} from '../types';
import { AIDecisionInfo } from '../ai/types';
import {
    MAX_INTEREST, ENERGY_REGEN, ORE_REWARDS,
    UNIT_STATS, PLACEMENT_MINE_LIMIT,
    EVOLUTION_COSTS, EVOLUTION_CONFIG
} from '../constants';
import {
    getMineBaseCost,
    getUnitNameKey
} from '../gameHelpers';
import UnitInfoPanel from './UnitInfoPanel';
import EvolutionTree from './EvolutionTree';
import SpeedyShoe from './SpeedyShoe';

interface ControlPanelProps {
    gameState: GameState;
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    selectedMineType: MineType;
    setSelectedMineType: (type: MineType) => void;
    showEvolutionTree: boolean;
    setShowEvolutionTree: (show: boolean) => void;
    language: string;
    t: (key: string, params?: any) => string;
    aiDecision?: AIDecisionInfo | null;
    actions: {
        handleActionComplete: (id: string | null) => void;
        handleScanAction: (unit: Unit, r: number, c: number) => void;
        handlePlaceMineAction: (unit: Unit, r: number, c: number, mineType: MineType) => void;
        handleEvolve: (type: UnitType, branch: 'a' | 'b', variant?: number) => void;
        handlePickupFlag: () => void;
        handleDropFlag: () => void;
        handleAttack: (attackerId: string, targetUnit: Unit) => void;
        handleStealth: (unitId: string) => void;
        handleSkipTurn: () => void;
    };
    helpers: {
        getUnit: (id: string | null) => Unit | null;
        getActionButtonIndex: (action: string, unit: Unit | null) => number;
        getEvolutionButtonStartIndex: (unit: Unit | null) => number;
        getDisplayCost: (unit: Unit | null, baseCost: number, state?: GameState, actionType?: string) => number;
        getNextUnitToAct: () => Unit | null;
    };
    phases: {
        finishPlacementPhase: () => void;
        startActionPhase: () => void;
    };
    handleUnitClick: (unit: Unit) => void;
    handleDisarmAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceTowerAction: (unit: Unit, r: number, c: number) => void;
    handleDetonateTowerAction: (unit: Unit) => void;
    handlePlaceFactoryAction: (unit: Unit, r: number, c: number) => void;
    handlePlaceHubAction: (unit: Unit, r: number, c: number) => void;
    handleTeleportToHubAction: (unit: Unit) => void;
    handleStealthAction: (unitId: string) => void;
    handleRangerAction: (subAction: 'pickup' | 'drop') => void;
    swapUnits: (id1: string, id2: string) => void;
    isLocalPlayerTurn: boolean;
    localPlayerId: PlayerID;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
    gameState, targetMode, setTargetMode, selectedMineType, setSelectedMineType,
    showEvolutionTree, setShowEvolutionTree, language, t, aiDecision, actions, helpers, phases,
    handleUnitClick, handleDisarmAction, handlePlaceTowerAction, handleDetonateTowerAction,
    handlePlaceFactoryAction, handlePlaceHubAction, handleTeleportToHubAction,
    handleRangerAction, swapUnits, isLocalPlayerTurn, localPlayerId
}) => {
    // Flipped card state moved to EvolutionTree component
    const player = gameState.gameMode === 'pvp' ? gameState.players[localPlayerId] : gameState.players[PlayerID.P1];
    const isThinking = gameState.phase === 'thinking';
    const isPlacement = gameState.phase === 'placement';
    const isAiTurnLocked =
        gameState.gameMode === 'pve' &&
        gameState.currentPlayer === PlayerID.P2 &&
        gameState.phase === 'action' &&
        !gameState.gameOver &&
        !gameState.isPaused;

    // 佈陣階段雙方都需要能操作，所以不鎖定；只在行動/思考階段才根據回合鎖定
    const isInteractionDisabled = isPlacement ? false : (isAiTurnLocked || !isLocalPlayerTurn);

    // PvP: 本方已確認但對方還沒確認，顯示等待
    const isWaitingForOpponent = gameState.gameMode === 'pvp'
        && gameState.pvpReadyState?.[localPlayerId] === true;
    const isSetupMineLimitReached = player.placementMinesPlaced >= PLACEMENT_MINE_LIMIT;

    // End Turn confirmation state
    const [endTurnConfirm, setEndTurnConfirm] = React.useState(false);

    // Factory button highlight state for visual feedback
    const [factoryButtonFlash, setFactoryButtonFlash] = React.useState(false);

    // Reset confirmation and factory highlight when unit changes
    React.useEffect(() => {
        setEndTurnConfirm(false);
        setFactoryButtonFlash(false);
    }, [gameState.selectedUnitId]);

    // Helper function to set target mode and reset end turn confirmation
    const handleSetTargetMode = (mode: TargetMode) => {
        // Reset end turn confirmation
        setEndTurnConfirm(false);
        // Reset factory button highlight
        setFactoryButtonFlash(false);
        // Set target mode - React will batch these updates together
        setTargetMode(mode);
    };

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

    return (
        <>
            {showEvolutionTree && (
                <EvolutionTree
                    gameState={gameState}
                    onClose={() => setShowEvolutionTree(false)}
                    t={t}
                />
            )}

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
                        localPlayerId={localPlayerId}
                        language={language as any}
                        t={t}
                        onUnitClick={handleUnitClick}
                        onSwapUnits={swapUnits}
                    />

                    {/* Action Buttons & End Turn */}
                    <div className="flex-[4] flex flex-col border-l-2 border-white/30 px-4 items-center justify-between h-full py-1 bg-slate-800/30">
                        {isPlacement ? (
                            isWaitingForOpponent ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-4">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full border-4 border-slate-600 border-t-emerald-400 animate-spin" />
                                        <span className="text-lg font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">
                                            已確認佈陣
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">
                                            等待對手完成佈陣...
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                    <div className="text-sm font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">{t('placement_phase')}</div>
                                    <div className="text-[10px] text-white text-center font-semibold">{t('placement_guide')}</div>
                                    <div className="flex gap-2 w-full">
                                        <button
                                            disabled={isInteractionDisabled || isSetupMineLimitReached}
                                            onClick={() => {
                                                if (isInteractionDisabled || isSetupMineLimitReached) return;
                                                setTargetMode(targetMode === 'place_setup_mine' ? null : 'place_setup_mine');
                                            }}
                                            className={`flex-1 py-2 px-1 rounded font-black text-xs flex items-center justify-center gap-1 border-2 transition-all ${(isInteractionDisabled || isSetupMineLimitReached) ? 'opacity-50 grayscale cursor-not-allowed border-slate-700 bg-slate-800' : (targetMode === 'place_setup_mine' ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/50' : 'bg-purple-900/40 border-purple-800/50 hover:bg-purple-800/60 text-purple-100/70')}`}
                                        >
                                            <Bomb size={14} /> {t('place_setup_mine')} ({player.placementMinesPlaced}/{PLACEMENT_MINE_LIMIT})
                                        </button>
                                        <button
                                            disabled={isInteractionDisabled}
                                            onClick={() => {
                                                if (isInteractionDisabled) return;
                                                phases.finishPlacementPhase();
                                            }}
                                            className={`flex-1 py-2 px-1 rounded font-black text-xs flex items-center justify-center gap-1 border-2 shadow-lg transition-all ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-700 bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 shadow-emerald-500/50 text-white'}`}
                                        >
                                            <CheckCircle size={14} /> {t('confirm_placement')}
                                        </button>
                                    </div>
                                </div>
                            )
                        ) : isInteractionDisabled ? (
                            /* 等待對手操作提示 */
                            <div className="w-full flex-1 flex flex-col items-center justify-center gap-4 px-4">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 rounded-full border-4 border-slate-600 border-t-cyan-400 animate-spin" />
                                    <span className="text-lg font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">
                                        等待對手操作...
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                        對方正在進行回合，請稍候
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full flex-1 flex flex-col items-center">
                                <div className="text-base text-white uppercase tracking-widest text-center w-full font-bold mt-6 mb-2">
                                    {isThinking ? t('planning_phase') : (gameState.selectedUnitId ? t('select_action') : t('select_unit'))}
                                </div>

                                <div className="flex-1 flex flex-col justify-center w-full overflow-visible">
                                    <div className="w-full flex flex-col justify-center gap-2 items-center relative min-w-[150px] overflow-visible">
                                        {isThinking ? (
                                            isWaitingForOpponent ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 rounded-full border-4 border-slate-600 border-t-cyan-400 animate-spin" />
                                                    <span className="text-lg font-black text-white uppercase tracking-widest animate-pulse drop-shadow-lg">
                                                        已準備就緒
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        等待對手確認...
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-white font-black animate-pulse uppercase tracking-widest text-xs drop-shadow-lg">{t('planning_phase')}</span>
                                                    <button
                                                        disabled={isInteractionDisabled}
                                                        onClick={() => {
                                                            if (isInteractionDisabled) return;
                                                            phases.startActionPhase();
                                                        }}
                                                        className={`px-6 py-2 rounded font-black shadow-lg flex items-center gap-2 border-2 transition-all ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-700 bg-slate-800' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-cyan-400 shadow-cyan-500/50'}`}
                                                    >
                                                        <Play size={20} fill="currentColor" /> {t('ready')}
                                                    </button>
                                                </div>
                                            )
                                        ) : gameState.selectedUnitId ? (
                                            <div className="flex gap-2 justify-center items-start w-full px-4 py-2 overflow-visible">
                                                {/* All buttons in one row */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        disabled={isInteractionDisabled}
                                                        onClick={() => {
                                                            if (isInteractionDisabled) return;
                                                            handleSetTargetMode('move');
                                                        }}
                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (() => {
                                                            const u = helpers.getUnit(gameState.selectedUnitId);
                                                            const isRB3 = u && u.type === UnitType.RANGER &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].b >= 3 &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].bVariant === 1;

                                                            if (isRB3) {
                                                                return targetMode === 'move' && !endTurnConfirm
                                                                    ? 'bg-slate-950 border-slate-500 shadow-lg shadow-slate-900/50 text-white scale-105'
                                                                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-600 text-slate-300';
                                                            }
                                                            return targetMode === 'move' && !endTurnConfirm && (!u?.status.isStealthed)
                                                                ? 'bg-emerald-600 shadow-lg shadow-emerald-500/50 scale-105 border-emerald-400 text-white'
                                                                : 'bg-emerald-900/40 hover:bg-emerald-800/60 border-emerald-800/50 text-emerald-100/70';
                                                        })()}`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('move', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        {(() => {
                                                            const u = helpers.getUnit(gameState.selectedUnitId);
                                                            const isRB3 = u?.type === UnitType.RANGER &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].b >= 3 &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].bVariant === 1;
                                                            return isRB3 ? <Ghost size={28} /> : <SpeedyShoe size={34} />;
                                                        })()}
                                                        <span className="text-xs">{(() => {
                                                            const u = helpers.getUnit(gameState.selectedUnitId);
                                                            const isRB3 = u?.type === UnitType.RANGER &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].b >= 3 &&
                                                                gameState.players[u.owner].evolutionLevels[UnitType.RANGER].bVariant === 1;
                                                            return isRB3 ? t('evol_rng_b_r2') : t('move');
                                                        })()}</span>
                                                    </button>
                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
                                                        <Zap size={12} className="text-yellow-400" />
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

                                                    // --- ORDER MUST MATCH getActionButtonIndex in App.tsx ---
                                                    // Index 1: Move (already rendered above)

                                                    // Index 2: Placement skills (place_tower, place_factory, place_hub)
                                                    const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
                                                    const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
                                                    const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

                                                    if (canPlaceTower) {
                                                        const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
                                                        const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
                                                        const towerBaseCost = (swpLevelA === 3 && swpVariantA === 1) ? 5 : 6;
                                                        buttons.push(
                                                            <div key="place_tower" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        handlePlaceTowerAction(unit, unit.r, unit.c);
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : 'bg-orange-900/40 hover:bg-orange-800/60 border-orange-800/50 text-orange-100/70 hover:border-orange-400 hover:text-white'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_tower', unit)}</div>
                                                                    <Radio size={28} /> <span className="text-xs">{t('place_tower')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, towerBaseCost, gameState, 'place_tower')}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canPlaceFactory) {
                                                        buttons.push(
                                                            <div key="place_factory" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        setFactoryButtonFlash(true);
                                                                        setEndTurnConfirm(false);
                                                                        setTargetMode(null);
                                                                        handlePlaceFactoryAction(unit, unit.r, unit.c);
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled
                                                                        ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500'
                                                                        : factoryButtonFlash
                                                                            ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50 scale-105 border-cyan-400 text-white'
                                                                            : 'bg-cyan-900/40 hover:bg-cyan-800/60 border-cyan-800/50 text-cyan-100/70'
                                                                        }`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_factory', unit)}</div>
                                                                    <FlaskConical size={28} /> <span className="text-xs">{t('place_factory')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, 6, gameState, 'place_factory')}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canPlaceHub) {
                                                        buttons.push(
                                                            <div key="place_hub" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        handlePlaceHubAction(unit, unit.r, unit.c);
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : 'bg-indigo-900/40 hover:bg-indigo-800/60 border-indigo-800/50 text-indigo-100/70'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_hub', unit)}</div>
                                                                    <Cpu size={28} /> <span className="text-xs">{t('place_hub')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, 4, gameState, 'place_hub')}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Index: Universal Dismantle (if on enemy building)
                                                    if (gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner)) {
                                                        buttons.push(
                                                            <div key="custom_dismantle" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleDisarmAction(unit, unit.r, unit.c)} className="w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-pink-900/40 hover:bg-pink-800/60 border-pink-800/50 text-pink-100/70 hover:border-pink-400 hover:text-white">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('custom_dismantle', unit)}</div>
                                                                    <Unlock size={28} />
                                                                    <span className="text-xs">拆除建築</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, 2, gameState, 'dismantle')}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Index: Unit-specific actions
                                                    if (unit.type === UnitType.GENERAL) {
                                                        const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
                                                        const genVariantA = player.evolutionLevels[UnitType.GENERAL].aVariant;
                                                        const generalAttackBaseCost = (unit.hasFlag && genLevelA >= 3 && genVariantA === 1)
                                                            ? 6
                                                            : UNIT_STATS[UnitType.GENERAL].attackCost;
                                                        if (!unit.hasFlag || (genLevelA >= 3 && genVariantA === 1) || (gameState as any).isGodMode) {
                                                            buttons.push(
                                                                <div key="attack" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            handleSetTargetMode('attack');
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'attack' && !endTurnConfirm
                                                                            ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-105 border-red-400 text-white'
                                                                            : 'bg-red-900/40 hover:bg-red-800/60 border-red-800/50 text-red-100/70')}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('attack', unit)}</div>
                                                                        <Swords size={28} />
                                                                        <span className="text-xs">{t('attack')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
                                                                        <Zap size={12} className="text-yellow-400" />
                                                                        <span>{helpers.getDisplayCost(unit, generalAttackBaseCost, gameState, 'attack')}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } else if (unit.type === UnitType.MINESWEEPER) {
                                                        const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
                                                        const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
                                                        const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
                                                        const scanBaseCost = (player.questStats.sweeperScansThisRound || 0) >= 2 ? 4 : 3;

                                                        // Regular Scan
                                                        buttons.push(
                                                            <div key="scan" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        handleSetTargetMode('scan');
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'scan' && !endTurnConfirm ? 'bg-blue-600 shadow-lg shadow-blue-500/50 scale-105 border-blue-400 text-white' : 'bg-blue-900/40 hover:bg-blue-800/60 border-blue-800/50 text-blue-100/70')}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('scan', unit)}</div>
                                                                    <Eye size={28} /> <span className="text-xs">{t('scan')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, scanBaseCost, gameState, 'scan')}</div>
                                                            </div>
                                                        );

                                                        // Path B: Sensor Scan
                                                        if (swpLevelB >= 1) {
                                                            const cost = swpLevelB >= 3 ? 4 : 5;

                                                            buttons.push(
                                                                <div key="sensor_scan" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            handleSetTargetMode('sensor_scan');
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'sensor_scan' && !endTurnConfirm ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50 scale-105 border-cyan-400 text-white' : 'bg-cyan-900/40 hover:bg-cyan-800/60 border-cyan-800/50 text-cyan-100/70')}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('sensor_scan', unit)}</div>
                                                                        <Scan size={28} />
                                                                        <span className="text-xs">{t('sensor_scan')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, cost, gameState, 'sensor_scan')}</div>
                                                                </div>
                                                            );
                                                        }

                                                        // Path A Level 3-2: Detonate Tower (爆破指令)
                                                        const hasTower = gameState.buildings.some(b => b.owner === unit.owner && b.type === 'tower');
                                                        if (swpLevelA === 3 && swpVariantA === 2 && hasTower) {
                                                            buttons.push(
                                                                <div key="detonate_tower" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => { handleDetonateTowerAction(unit); setEndTurnConfirm(false); }}
                                                                        className="w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-red-900/40 hover:bg-red-800/60 border-red-800/50 text-red-100/70 hover:border-red-400 hover:text-white"
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('detonate_tower', unit)}</div>
                                                                        <Radiation size={28} />
                                                                        <span className="text-xs">爆破指令</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, 2, gameState, 'detonate_tower')}</div>
                                                                </div>
                                                            );
                                                        }
                                                    } else if (unit.type === UnitType.MAKER) {
                                                        // Place Mine button (Fixed width container for perfect centering)
                                                        buttons.push(
                                                            <div key="place_mine_group" className="w-[82px] flex flex-col items-center gap-1 relative overflow-visible">
                                                                {targetMode === 'place_mine' && (
                                                                    <div className="absolute bottom-[105px] left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-purple-500 rounded-lg p-1.5 flex gap-1.5 shadow-[0_0_20px_rgba(168,85,247,0.6)] z-[100] min-w-max animate-in fade-in slide-in-from-bottom-2">
                                                                        {[MineType.NORMAL, MineType.SLOW, MineType.SMOKE, MineType.CHAIN, MineType.NUKE].map(type => {
                                                                            const mkrA = player.evolutionLevels[UnitType.MAKER].a;
                                                                            const mkrA_Var = player.evolutionLevels[UnitType.MAKER].aVariant;

                                                                            let isAvailable = true;
                                                                            if (type === MineType.SLOW && mkrA < 1) isAvailable = false;
                                                                            if (type === MineType.SMOKE && mkrA < 2) isAvailable = false;
                                                                            if (type === MineType.CHAIN && (mkrA < 3 || mkrA_Var !== 1)) isAvailable = false;
                                                                            if (type === MineType.NUKE && (mkrA < 3 || mkrA_Var !== 2)) isAvailable = false;

                                                                            if (!isAvailable) return null;

                                                                            return (
                                                                                <button
                                                                                    key={type}
                                                                                    disabled={isInteractionDisabled}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isInteractionDisabled) return;
                                                                                        setSelectedMineType(type);
                                                                                    }}
                                                                                    className={`p-1.5 rounded border-2 transition-all flex flex-col items-center gap-1 min-w-[46px] ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-700 bg-slate-800' : (selectedMineType === type ? 'bg-purple-600 border-purple-300 scale-105 shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-slate-800 border-slate-700 hover:border-purple-400')}`}
                                                                                >
                                                                                    {type === MineType.NORMAL && <Bomb size={20} className="text-white" />}
                                                                                    {type === MineType.SLOW && <Snowflake size={20} className="text-blue-200" />}
                                                                                    {type === MineType.SMOKE && <Cloud size={20} className="text-slate-300" />}
                                                                                    {type === MineType.CHAIN && <Share2 size={20} className="text-purple-400" />}
                                                                                    {type === MineType.NUKE && <Radiation size={20} className="text-emerald-400" />}
                                                                                    <span className="text-[10px] font-black text-white leading-none mt-0.5">
                                                                                        {helpers.getDisplayCost(unit, getMineBaseCost(type), gameState, 'place_mine')}
                                                                                    </span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        handleSetTargetMode(targetMode === 'place_mine' ? null : 'place_mine');
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-1.5 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'place_mine' && !endTurnConfirm
                                                                        ? 'bg-purple-600 border-white ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-purple-500/50 text-white'
                                                                        : 'bg-purple-900/40 hover:bg-purple-800/60 border-purple-800/50 text-purple-100/70')}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_mine', unit)}</div>
                                                                    <Bomb size={28} /> <span className="text-xs">{t('place_mine')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
                                                                    <Zap size={12} className="text-yellow-400" />
                                                                    <span>{helpers.getDisplayCost(unit, getMineBaseCost(selectedMineType), gameState, 'place_mine')}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (unit.type === UnitType.RANGER) {
                                                        // Ranger-specific: pickup_mine, throw_mine, drop_mine
                                                        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
                                                        const pickupRange = rngLevelB >= 1 ? 2 : 0;
                                                        const mineInRange = gameState.mines.find(m =>
                                                            (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
                                                            (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
                                                        );
                                                        if (!unit.carriedMine && mineInRange) {
                                                            buttons.push(
                                                                <div key="pickup_mine" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            handleRangerAction('pickup');
                                                                            setEndTurnConfirm(false);
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : 'bg-yellow-900/40 hover:bg-yellow-800/60 border-yellow-800/50 text-yellow-100/70'}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('pickup_mine', unit)}</div>
                                                                        <Bomb size={28} /> <span className="text-xs">{t('take_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> 0</div>
                                                                </div>
                                                            );
                                                        }

                                                        // Ghost Steps (Level B2 or B3-2)
                                                        // B3-1 has passive stealth (no button), B3-2 keeps active stealth
                                                        const rngVariantB = player.evolutionLevels[UnitType.RANGER].bVariant;
                                                        if (rngLevelB === 2 || (rngLevelB >= 3 && rngVariantB === 2)) {
                                                            buttons.push(
                                                                <div key="ghost_steps" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            actions.handleStealth(unit.id);
                                                                            setEndTurnConfirm(false);
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (unit.status.isStealthed && !endTurnConfirm
                                                                            ? 'bg-slate-950 border-slate-500 shadow-lg shadow-slate-900/50 text-white'
                                                                            : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-600 text-slate-300'
                                                                        )}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('stealth', unit)}</div>
                                                                        <Ghost size={28} />
                                                                        <span className="text-xs">{unit.status.isStealthed ? t('cancel') : t('evol_rng_b_r2')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {unit.status.isStealthed ? 3 : 0}</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.carriedMine) {
                                                            const rngVariantB = player.evolutionLevels[UnitType.RANGER].bVariant;
                                                            if (rngLevelB === 3 && rngVariantB === 2) {
                                                                buttons.push(
                                                                    <div key="throw_mine" className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            disabled={isInteractionDisabled}
                                                                            onClick={() => {
                                                                                if (isInteractionDisabled) return;
                                                                                handleSetTargetMode('throw_mine');
                                                                            }}
                                                                            className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'throw_mine' && !endTurnConfirm
                                                                                ? 'bg-purple-600 border-purple-400 scale-105 shadow-lg shadow-purple-500/50 text-white'
                                                                                : 'bg-purple-900/40 hover:bg-purple-800/60 border-purple-800/50 text-purple-100/70')}`}
                                                                        >
                                                                            <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('throw_mine', unit)}</div>
                                                                            <Bomb size={28} /> <span className="text-xs">{t('throw_mine')}</span>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, 5, gameState, 'throw_mine')}</div>
                                                                    </div>
                                                                );
                                                            }
                                                            buttons.push(
                                                                <div key="drop_mine" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { handleRangerAction('drop'); setEndTurnConfirm(false); }} className="w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-yellow-900/40 hover:bg-yellow-800/60 border-yellow-800/50 text-yellow-100/70">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('drop_mine', unit)}</div>
                                                                        <ArrowDownToLine size={28} /> <span className="text-xs">{t('drop_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> 0</div>
                                                                </div>
                                                            );
                                                        }
                                                    } else if (unit.type === UnitType.DEFUSER) {
                                                        const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
                                                        const defVariantB = player.evolutionLevels[UnitType.DEFUSER].bVariant;

                                                        // Base Disarm (Lv 0)
                                                        buttons.push(
                                                            <div key="disarm" className="flex flex-col items-center gap-1">
                                                                <button
                                                                    disabled={isInteractionDisabled}
                                                                    onClick={() => {
                                                                        if (isInteractionDisabled) return;
                                                                        handleSetTargetMode('disarm');
                                                                    }}
                                                                    className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'disarm' && !endTurnConfirm ? 'bg-amber-600 shadow-lg shadow-amber-500/50 scale-105 border-amber-400 text-white font-bold' : 'bg-amber-900/40 hover:bg-amber-800/60 border-amber-800/50 text-amber-100/70')}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('disarm', unit)}</div>
                                                                    <Unlock size={28} /> <span className="text-xs">{t('disarm')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, UNIT_STATS[UnitType.DEFUSER].disarmCost, gameState, 'disarm')}</div>
                                                            </div>
                                                        );

                                                        // Path B Lv 2+: Move Mine (空間置換 / 苦痛轉嫁)
                                                        if (defLevelB >= 2) {
                                                            const isDamageMode = (defLevelB === 3 && defVariantB === 2);
                                                            buttons.push(
                                                                <div key="move_mine" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            handleSetTargetMode('move_mine_start');
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : ((targetMode === 'move_mine_start' || targetMode === 'move_mine_end') && !endTurnConfirm ? 'bg-rose-600 shadow-lg shadow-rose-500/50 scale-105 border-rose-400 text-white font-bold' : 'bg-rose-900/40 hover:bg-rose-800/60 border-rose-800/50 text-rose-100/70')}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('move_mine', unit)}</div>
                                                                        <Magnet size={28} /> <span className="text-xs">{isDamageMode ? t('evol_def_b_r3_2') : t('evol_def_b_r2')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {isDamageMode ? 5 : 2}</div>
                                                                </div>
                                                            );
                                                        }

                                                        // Path B Lv 3-1: Convert Mine (意志侵奪)
                                                        if (defLevelB === 3 && defVariantB === 1) {
                                                            buttons.push(
                                                                <div key="convert_mine" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            handleSetTargetMode('convert_mine');
                                                                        }}
                                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (targetMode === 'convert_mine' && !endTurnConfirm ? 'bg-indigo-600 shadow-lg shadow-indigo-500/50 scale-105 border-indigo-400 text-white font-bold' : 'bg-indigo-900/40 hover:bg-indigo-800/60 border-indigo-800/50 text-indigo-100/70')}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('convert_mine', unit)}</div>
                                                                        <Brain size={28} /> <span className="text-xs">{t('evol_def_b_r3_1')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> 5</div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Index: Flag pickup/drop (for General or when Gen B Level 3+)
                                                    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                                                    const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
                                                    const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;

                                                    if (canCarryFlag) {
                                                        if (!unit.hasFlag && isAtFlag) {
                                                            buttons.push(
                                                                <div key="pickup_flag" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { actions.handlePickupFlag(); setEndTurnConfirm(false); }} className="w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-yellow-900/40 hover:bg-yellow-800/60 border-yellow-800/50 text-yellow-100/70">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('pickup_flag', unit)}</div>
                                                                        <Flag size={28} />
                                                                        <span className="text-xs">{t('take')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> 0</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.hasFlag) {
                                                            buttons.push(
                                                                <div key="drop_flag" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { actions.handleDropFlag(); setEndTurnConfirm(false); }} className="w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-yellow-900/40 hover:bg-yellow-800/60 border-yellow-800/50 text-yellow-100/70">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('drop_flag', unit)}</div>
                                                                        <ArrowDownToLine size={28} />
                                                                        <span className="text-xs">{t('drop')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> 0</div>
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // Teleport action
                                                    const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
                                                    const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
                                                    const hasHub = gameState.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
                                                    const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && hasHub;

                                                    if (canTeleport) {
                                                        buttons.push(
                                                            <div key="teleport" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => { handleTeleportToHubAction(unit); setEndTurnConfirm(false); }} className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'teleport' && !endTurnConfirm ? 'bg-amber-600 border-amber-400 scale-105 shadow-lg shadow-amber-500/50 text-white' : 'bg-amber-500/20 hover:bg-amber-500/40 border-amber-500/50 text-amber-100/90 hover:border-amber-400 hover:text-white'}`}>
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('teleport', unit)}</div>
                                                                    <Zap size={28} /> <span className="text-xs">{t('teleport')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, unit.type === UnitType.RANGER ? ((rangerLevelA === 3 && rangerVariantA === 2) ? 3 : 0) : 5, gameState, 'teleport')}</div>
                                                            </div>
                                                        );
                                                    }
                                                    return buttons;
                                                })()}


                                                {/* End Turn */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        disabled={isInteractionDisabled}
                                                        onClick={() => {
                                                            if (isInteractionDisabled) return;
                                                            if (endTurnConfirm) {
                                                                actions.handleActionComplete(gameState.selectedUnitId);
                                                                setEndTurnConfirm(false);
                                                            } else {
                                                                setEndTurnConfirm(true);
                                                            }
                                                        }}
                                                        className={`w-[82px] h-[74px] rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500' : (endTurnConfirm
                                                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-400 scale-105 shadow-lg shadow-slate-400/50 text-white'
                                                            : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200/70'
                                                        )}`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('end_turn', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        <CheckCircle size={28} />
                                                        <span className="text-xs">{isInteractionDisabled ? t('wait_turn') : (endTurnConfirm ? t('confirm') : t('end_turn'))}</span>
                                                    </button>
                                                    {/* Spacer or Heal Indicator */}
                                                    {(() => {
                                                        const unit = helpers.getUnit(gameState.selectedUnitId);
                                                        const hasMoved = unit ? gameState.movements.some(m => m.unitId === unit.id) : false;
                                                        const hasUsedEnergy = unit ? unit.energyUsedThisTurn > 0 : false;

                                                        if (unit && !hasMoved && !hasUsedEnergy) {
                                                            return (
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white transition-all animate-in fade-in zoom-in duration-300">
                                                                    <Heart size={12} className="text-emerald-400 fill-emerald-400" />
                                                                    <span className="text-emerald-300">+3</span>
                                                                </div>
                                                            );
                                                        }
                                                        return <div className="h-[24px] opacity-0">spacer</div>;
                                                    })()}
                                                </div>

                                                {/* Evolution Section Integrated */}
                                                {(() => {
                                                    const unit = helpers.getUnit(gameState.selectedUnitId);
                                                    if (!unit || unit.owner !== gameState.currentPlayer) return null;
                                                    const pLevels = player.evolutionLevels[unit.type];
                                                    const questStats = player.questStats;

                                                    // Get evolution thresholds
                                                    const nextThresholdA = EVOLUTION_CONFIG[unit.type].a.thresholds[pLevels.a];
                                                    const nextThresholdB = EVOLUTION_CONFIG[unit.type].b.thresholds[pLevels.b];

                                                    // Check quest conditions based on unit type
                                                    let conditionMetA = false;
                                                    let conditionMetB = false;

                                                    if (unit.type === UnitType.GENERAL) {
                                                        conditionMetA = questStats.generalDamage >= nextThresholdA;
                                                        conditionMetB = questStats.generalFlagSteps >= nextThresholdB;
                                                    } else if (unit.type === UnitType.MINESWEEPER) {
                                                        conditionMetA = questStats.sweeperMinesMarked >= nextThresholdA;
                                                        conditionMetB = questStats.consecutiveSafeRounds >= nextThresholdB;
                                                    } else if (unit.type === UnitType.RANGER) {
                                                        conditionMetA = questStats.rangerSteps >= nextThresholdA;
                                                        conditionMetB = questStats.rangerMinesMoved >= nextThresholdB;
                                                    } else if (unit.type === UnitType.MAKER) {
                                                        conditionMetA = questStats.makerMinesTriggeredByEnemy >= nextThresholdA;
                                                        conditionMetB = questStats.makerMinesPlaced >= nextThresholdB;
                                                    } else if (unit.type === UnitType.DEFUSER) {
                                                        conditionMetA = questStats.defuserMinesSoaked >= nextThresholdA;
                                                        conditionMetB = questStats.defuserMinesDisarmed >= nextThresholdB;
                                                    }

                                                    // Allow evolution buttons in Sandbox Mode if criteria are met, 
                                                    // but only if not already at max level.

                                                    const canEvolveA = pLevels.a < 3 && player.energy >= EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS] && conditionMetA;
                                                    const canEvolveB = pLevels.b < 3 && player.energy >= EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS] && conditionMetB;

                                                    // Only show divider and buttons if there are evolution options
                                                    if (!canEvolveA && !canEvolveB) return null;

                                                    const result = [];

                                                    // Add divider first
                                                    result.push(<div key="divider" className="h-20 w-px bg-slate-600 mx-2"></div>);

                                                    if (canEvolveA) {
                                                        if (pLevels.a === 2) {
                                                            // Show two variants for Level 3
                                                            const variants = [
                                                                { id: 1, color: 'bg-blue-400 hover:bg-blue-300 border-blue-200 shadow-[0_0_15px_rgba(96,165,250,0.5)]', label: '3-1' },
                                                                { id: 2, color: 'bg-indigo-700 hover:bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.5)]', label: '3-2' }
                                                            ];
                                                            variants.forEach(v => {
                                                                result.push(
                                                                    <div key={`evolve_a_${v.id}`} className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            disabled={isInteractionDisabled}
                                                                            onClick={() => {
                                                                                if (isInteractionDisabled) return;
                                                                                actions.handleEvolve(unit.type, 'a', v.id);
                                                                            }}
                                                                            className={`relative w-[82px] h-[74px] rounded flex flex-col items-center justify-center font-bold border-2 text-white overflow-hidden transition-all group active:scale-95 leading-tight ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40' : v.color}`}>
                                                                            <Dna size={28} className="mb-0.5 drop-shadow-md group-hover:scale-110 transition-transform" />
                                                                            <div className="flex flex-col items-center text-center">
                                                                                <span className="text-[9px] opacity-80 font-medium">{t('path_a')}</span>
                                                                                <span className="text-[10px] tracking-tighter">LV2→{v.label}</span>
                                                                            </div>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, EVOLUTION_COSTS[2], gameState, 'evolve')}</div>
                                                                    </div>
                                                                );
                                                            });
                                                        } else {
                                                            result.push(
                                                                <div key="evolve_a" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            actions.handleEvolve(unit.type, 'a');
                                                                        }}
                                                                        className={`relative w-[82px] h-[74px] rounded flex flex-col items-center justify-center font-bold border-2 text-white overflow-hidden transition-all group active:scale-95 leading-tight ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40' : 'bg-blue-600 hover:bg-blue-500 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.6)]'}`}>
                                                                        <Dna size={28} className="mb-0.5 drop-shadow-md group-hover:scale-110 transition-transform" />
                                                                        <div className="flex flex-col items-center text-center">
                                                                            <span className="text-[10px] opacity-80 font-medium">{t('path_a')}</span>
                                                                            <span className="text-xs tracking-tighter">LV{pLevels.a}→{pLevels.a + 1}</span>
                                                                        </div>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS], gameState, 'evolve')}</div>
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    if (canEvolveB) {
                                                        if (pLevels.b === 2) {
                                                            // Show two variants for Level 3
                                                            const variants = [
                                                                { id: 1, color: 'bg-yellow-400 hover:bg-yellow-300 border-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.5)]', label: '3-1' },
                                                                { id: 2, color: 'bg-red-700 hover:bg-red-600 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)]', label: '3-2' }
                                                            ];
                                                            variants.forEach(v => {
                                                                result.push(
                                                                    <div key={`evolve_b_${v.id}`} className="flex flex-col items-center gap-1">
                                                                        <button
                                                                            disabled={isInteractionDisabled}
                                                                            onClick={() => {
                                                                                if (isInteractionDisabled) return;
                                                                                actions.handleEvolve(unit.type, 'b', v.id);
                                                                            }}
                                                                            className={`relative w-[82px] h-[74px] rounded flex flex-col items-center justify-center font-bold border-2 text-white overflow-hidden transition-all group active:scale-95 leading-tight ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40' : v.color}`}>
                                                                            <Dna size={28} className="mb-0.5 drop-shadow-md group-hover:scale-110 transition-transform" />
                                                                            <div className="flex flex-col items-center text-center">
                                                                                <span className="text-[9px] opacity-80 font-medium">{t('path_b')}</span>
                                                                                <span className="text-[10px] tracking-tighter">LV2→{v.label}</span>
                                                                            </div>
                                                                        </button>
                                                                        <div className="bg-slate-800 rounded px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, EVOLUTION_COSTS[2], gameState, 'evolve')}</div>
                                                                    </div>
                                                                );
                                                            });
                                                        } else {
                                                            result.push(
                                                                <div key="evolve_b" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        disabled={isInteractionDisabled}
                                                                        onClick={() => {
                                                                            if (isInteractionDisabled) return;
                                                                            actions.handleEvolve(unit.type, 'b');
                                                                        }}
                                                                        className={`relative w-[82px] h-[74px] rounded flex flex-col items-center justify-center font-bold border-2 text-white overflow-hidden transition-all group active:scale-95 leading-tight ${isInteractionDisabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-800 bg-slate-900/40' : 'bg-red-600 hover:bg-red-500 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.6)]'}`}>
                                                                        <Dna size={28} className="mb-0.5 drop-shadow-md group-hover:scale-110 transition-transform" />
                                                                        <div className="flex flex-col items-center text-center">
                                                                            <span className="text-[10px] opacity-80 font-medium">{t('path_b')}</span>
                                                                            <span className="text-xs tracking-tighter">LV{pLevels.b}→{pLevels.b + 1}</span>
                                                                        </div>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white"><Zap size={12} className="text-yellow-400" /> {helpers.getDisplayCost(unit, EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS], gameState, 'evolve')}</div>
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    return <>{result}</>;
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="w-full flex flex-col items-center justify-center gap-2">
                                                {(() => {
                                                    if (isAiTurnLocked) {
                                                        const decisionUnit = aiDecision?.unitId ? helpers.getUnit(aiDecision.unitId) : null;
                                                        const decisionLabel = aiDecision
                                                            ? `${decisionUnit ? t(getUnitNameKey(decisionUnit.type)) : aiDecision.unitId} · ${aiDecision.action.toUpperCase()}`
                                                            : t('ai_thinking');
                                                        const targetText = aiDecision?.target?.kind === 'cell'
                                                            ? `(${aiDecision.target.r + 1},${aiDecision.target.c + 1})`
                                                            : aiDecision?.target?.kind === 'unit'
                                                                ? t(getUnitNameKey(aiDecision.target.unit.type))
                                                                : '';
                                                        const scoreParts = aiDecision?.breakdown
                                                            ? [
                                                                aiDecision.breakdown.attack ? `ATK ${aiDecision.breakdown.attack}` : null,
                                                                aiDecision.breakdown.flag ? `FLAG ${aiDecision.breakdown.flag}` : null,
                                                                aiDecision.breakdown.safety ? `SAFE ${aiDecision.breakdown.safety}` : null,
                                                                aiDecision.breakdown.utility ? `UTIL ${aiDecision.breakdown.utility}` : null
                                                            ].filter(Boolean).join(' · ')
                                                            : '';
                                                        return (
                                                            <div className="w-full flex flex-col items-center justify-center gap-3 py-5">
                                                                <div className="text-cyan-200 text-lg font-black tracking-widest uppercase animate-pulse">
                                                                    {t('ai_thinking')}
                                                                </div>
                                                                <div className="inline-flex items-end gap-2 px-6 py-3 rounded-xl border-2 border-cyan-300/60 bg-cyan-900/30">
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                                                                </div>
                                                                <div className="text-cyan-100/80 text-sm font-semibold">
                                                                    {t('wait')}
                                                                </div>
                                                                {aiDecision && (
                                                                    <div className="text-[11px] text-cyan-200/90 font-bold bg-slate-900/40 border border-cyan-400/30 rounded-lg px-3 py-2 text-center space-y-1">
                                                                        <div>{decisionLabel} {targetText}</div>
                                                                        {scoreParts && <div className="opacity-80">{scoreParts}</div>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    const nextUnit = helpers.getNextUnitToAct();
                                                    if (!nextUnit) return <span className="text-white font-semibold">{t('select_unit')}</span>;
                                                    const player = gameState.players[gameState.currentPlayer];
                                                    const skipCost = (player.skipCountThisRound + 1) * 10;
                                                    const canAffordSkip = player.energy >= skipCost;
                                                    return (
                                                        <>
                                                            <button
                                                                onClick={() => handleUnitClick(nextUnit)}
                                                                className="w-full px-6 py-3 rounded flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-500 font-bold border-2 border-emerald-500 text-white shadow-lg"
                                                            >
                                                                <Play size={20} />
                                                                <span className="text-sm">{t('start_turn')}</span>
                                                            </button>
                                                            <button
                                                                onClick={() => actions.handleSkipTurn()}
                                                                disabled={!canAffordSkip}
                                                                className={`w-full px-6 py-3 rounded flex items-center justify-center gap-2 transition-all font-bold border-2 shadow-lg ${canAffordSkip
                                                                    ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-indigo-200'
                                                                    : 'bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed opacity-60'
                                                                    }`}
                                                            >
                                                                <div className="relative flex items-center gap-2">
                                                                    <ArrowRight size={20} />
                                                                    <span className="text-sm">{t('skip_turn')}</span>
                                                                    <span className="absolute left-full ml-2 flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded text-xs whitespace-nowrap">
                                                                        <Zap size={12} className="text-yellow-400" /> {skipCost}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div >
                <style>{`
                    @keyframes vfx-star {
                        0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                        50% { transform: translateY(-10px) scale(1.2); opacity: 0.8; }
                    }
                    .animate-vfx-star {
                        animation: vfx-star 2.5s infinite ease-in-out;
                    }
                    .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }
                    .scrollbar-hide {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}</style>
            </div >
        </>
    );
};

export default ControlPanel;
