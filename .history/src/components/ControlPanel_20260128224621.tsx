import React from 'react';
import {
    Zap, Dna, Play, ArrowRight, CheckCircle, Bomb, Swords,
    ArrowDownToLine, Flag, Eye, Radio, FlaskConical, Unlock,
    Cpu, Cloud, Snowflake, Share2, Radiation
} from 'lucide-react';
import {
    GameState, Unit, MineType, UnitType
} from '../types';
import {
    MAX_INTEREST, ENERGY_REGEN, ORE_REWARDS,
    UNIT_STATS, PLACEMENT_MINE_LIMIT,
    EVOLUTION_COSTS, EVOLUTION_CONFIG
} from '../constants';
import {
    getMineBaseCost
} from '../gameHelpers';
import UnitInfoPanel from './UnitInfoPanel';
import EvolutionTree from './EvolutionTree';

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
        handlePlaceMineAction: (unit: Unit, r: number, c: number, mineType: MineType) => void;
        handleEvolve: (type: UnitType, branch: 'a' | 'b', variant?: number) => void;
        handlePickupFlag: () => void;
        handleDropFlag: () => void;
        handleAttack: (attackerId: string, targetUnit: Unit) => void;
        // Add others as needed
    };
    helpers: {
        getUnit: (id: string | null) => Unit | null;
        getActionButtonIndex: (action: string, unit: Unit | null) => number;
        getEvolutionButtonStartIndex: (unit: Unit | null) => number;
        getDisplayCost: (unit: Unit | null, baseCost: number) => number;
        getNextUnitToAct: () => Unit | null;
    };
    phases: {
        finishPlacementPhase: () => void;
        startActionPhase: () => void;
    };
    handleUnitClick: (unit: Unit) => void;
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
    gameState, targetMode, setTargetMode,
    selectedMineType, setSelectedMineType,
    showEvolutionTree, setShowEvolutionTree,
    language, t, actions, helpers, phases, handleUnitClick,
    handleDisarmAction, handlePlaceTowerAction,
    handlePlaceFactoryAction, handlePlaceHubAction,
    handleRangerAction
}) => {
    // Flipped card state moved to EvolutionTree component
    const player = gameState.players[gameState.currentPlayer];
    const isThinking = gameState.phase === 'thinking';
    const isPlacement = gameState.phase === 'placement';

    // End Turn confirmation state
    const [endTurnConfirm, setEndTurnConfirm] = React.useState(false);

    // Reset confirmation when unit changes
    React.useEffect(() => {
        setEndTurnConfirm(false);
    }, [gameState.selectedUnitId]);

    // Helper function to set target mode and reset end turn confirmation
    const handleSetTargetMode = (mode: any) => {
        // Reset end turn confirmation
        setEndTurnConfirm(false);
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
                                                        onClick={() => handleSetTargetMode('move')}
                                                        className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'move' && !endTurnConfirm ? 'bg-emerald-600 shadow-lg shadow-emerald-500/50 scale-105 border-emerald-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-emerald-500 text-slate-300'}`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('move', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        <ArrowRight size={28} />
                                                        <span className="text-xs">{t('move')}</span>
                                                    </button>
                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
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

                                                    // --- ORDER MUST MATCH getActionButtonIndex in App.tsx ---
                                                    // Index 1: Move (already rendered above)

                                                    // Index 2: Placement skills (place_tower, place_factory, place_hub)
                                                    const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
                                                    const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
                                                    const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

                                                    if (canPlaceTower) {
                                                        buttons.push(
                                                            <div key="place_tower" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handlePlaceTowerAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_tower', unit)}</div>
                                                                    <Radio size={28} /> <span className="text-xs">設置塔</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, 8)}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canPlaceFactory) {
                                                        const mkrB = player.evolutionLevels[UnitType.MAKER].b;
                                                        buttons.push(
                                                            <div key="place_factory" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handlePlaceFactoryAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_factory', unit)}</div>
                                                                    <FlaskConical size={28} /> <span className="text-xs">設置工廠</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, (mkrB === 3 && player.evolutionLevels[UnitType.MAKER].bVariant === 2) ? 4 : 6)}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canPlaceHub) {
                                                        buttons.push(
                                                            <div key="place_hub" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handlePlaceHubAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_hub', unit)}</div>
                                                                    <Cpu size={28} /> <span className="text-xs">設置樞紐</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, 8)}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Index: Universal Dismantle (if on enemy building, NOT defuser)
                                                    if (unit.type !== UnitType.DEFUSER && gameState.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner)) {
                                                        buttons.push(
                                                            <div key="custom_dismantle" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleDisarmAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-indigo-500 text-slate-300">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('custom_dismantle', unit)}</div>
                                                                    <Unlock size={28} />
                                                                    <span className="text-xs">拆除建築</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, 3)}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Index: Unit-specific actions
                                                    if (unit.type === UnitType.GENERAL) {
                                                        const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
                                                        if (!unit.hasFlag || genLevelA >= 3 || (gameState as any).isGodMode) {
                                                            buttons.push(
                                                                <div key="attack" className="flex flex-col items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleSetTargetMode('attack')}
                                                                        className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'attack' && !endTurnConfirm ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-105 border-red-400' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-red-500 text-slate-300'}`}
                                                                    >
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('attack', unit)}</div>
                                                                        <Swords size={28} />
                                                                        <span className="text-xs">{t('attack')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
                                                                        <span className="text-yellow-400">⚡</span>
                                                                        <span>{helpers.getDisplayCost(unit, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } else if (unit.type === UnitType.MINESWEEPER) {
                                                        const swpB = player.evolutionLevels[UnitType.MINESWEEPER].b;
                                                        buttons.push(
                                                            <div key="scan" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleSetTargetMode('scan')} className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'scan' && !endTurnConfirm ? 'bg-cyan-600 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/50' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}>
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('scan', unit)}</div>
                                                                    <Eye size={28} /> <span className="text-xs">{t('scan')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, swpB >= 3 ? 3 : (swpB >= 2 ? 4 : 5))}</div>
                                                            </div>
                                                        );
                                                    } else if (unit.type === UnitType.MAKER) {
                                                        // Place Mine button
                                                        buttons.push(
                                                            <div key="place_mine_group" className="flex flex-col items-center gap-1 relative">
                                                                {targetMode === 'place_mine' && (
                                                                    <div className="absolute bottom-full mb-2 bg-slate-900 border-2 border-purple-500 rounded-lg p-1.5 flex gap-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
                                                                        {[MineType.NORMAL, MineType.SLOW, MineType.SMOKE, MineType.CHAIN, MineType.NUKE].map(type => {
                                                                            const mkrA = player.evolutionLevels[UnitType.MAKER].a;
                                                                            const mkrA_Var = player.evolutionLevels[UnitType.MAKER].aVariant;

                                                                            // Availability checks based on evolution
                                                                            let isAvailable = true;
                                                                            if (type === MineType.CHAIN && (mkrA < 3 || mkrA_Var !== 1)) isAvailable = false;
                                                                            if (type === MineType.NUKE && (mkrA < 3 || mkrA_Var !== 2)) isAvailable = false;

                                                                            if (!isAvailable) return null;

                                                                            return (
                                                                                <button
                                                                                    key={type}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSelectedMineType(type);
                                                                                    }}
                                                                                    className={`p-1.5 rounded border-2 transition-all flex flex-col items-center gap-0.5 min-w-[45px] ${selectedMineType === type ? 'bg-purple-600 border-white scale-110' : 'bg-slate-800 border-slate-700 hover:border-purple-400'}`}
                                                                                    title={t(`mine_${type.toLowerCase()}`)}
                                                                                >
                                                                                    {type === MineType.NORMAL && <Bomb size={16} className="text-white" />}
                                                                                    {type === MineType.SLOW && <Snowflake size={16} className="text-blue-200" />}
                                                                                    {type === MineType.SMOKE && <Cloud size={16} className="text-slate-300" />}
                                                                                    {type === MineType.CHAIN && <Share2 size={16} className="text-purple-400" />}
                                                                                    {type === MineType.NUKE && <Radiation size={16} className="text-emerald-400" />}
                                                                                    <span className="text-[8px] font-bold text-white leading-none">
                                                                                        {helpers.getDisplayCost(unit, getMineBaseCost(type))}
                                                                                    </span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        // If coming from end turn confirm, always set to place_mine
                                                                        // Otherwise toggle
                                                                        const newMode = endTurnConfirm ? 'place_mine' : (targetMode === 'place_mine' ? null : 'place_mine');
                                                                        handleSetTargetMode(newMode);
                                                                    }}
                                                                    className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'place_mine' && !endTurnConfirm ? 'bg-purple-600 border-white ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-purple-500/50' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}
                                                                >
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('place_mine', unit)}</div>
                                                                    <Bomb size={28} /> <span className="text-xs">{t('place_mine')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">
                                                                    <span className="text-yellow-400">⚡</span>
                                                                    <span>{helpers.getDisplayCost(unit, getMineBaseCost(selectedMineType))}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (unit.type === UnitType.RANGER) {
                                                        // Ranger-specific: pickup_mine, throw_mine, drop_mine
                                                        const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
                                                        const pickupRadius = rngLevelB >= 1 ? 1 : 0;
                                                        const mineInRange = gameState.mines.find(m =>
                                                            Math.abs(m.r - unit.r) <= pickupRadius &&
                                                            Math.abs(m.c - unit.c) <= pickupRadius &&
                                                            (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
                                                        );
                                                        if (!unit.carriedMine && mineInRange) {
                                                            buttons.push(
                                                                <div key="pickup_mine" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { handleRangerAction('pickup'); setEndTurnConfirm(false); }} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('pickup_mine', unit)}</div>
                                                                        <Bomb size={28} /> <span className="text-xs">拾取地雷</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.carriedMine) {
                                                            buttons.push(
                                                                <div key="throw_mine" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => handleSetTargetMode('throw_mine')} className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'throw_mine' && !endTurnConfirm ? 'bg-purple-600 border-purple-400 scale-105 shadow-lg shadow-purple-500/50' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'} text-slate-300`}>
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('throw_mine', unit)}</div>
                                                                        <Bomb size={28} /> <span className="text-xs">投擲地雷</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, 3)}</div>
                                                                </div>
                                                            );
                                                            buttons.push(
                                                                <div key="drop_mine" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { handleRangerAction('drop'); setEndTurnConfirm(false); }} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-yellow-600/70 hover:bg-yellow-600 border-yellow-500 text-white">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('drop_mine', unit)}</div>
                                                                        <ArrowDownToLine size={28} /> <span className="text-xs">{t('drop_mine')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                    } else if (unit.type === UnitType.DEFUSER) {
                                                        buttons.push(
                                                            <div key="disarm" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => handleSetTargetMode('disarm')} className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${targetMode === 'disarm' && !endTurnConfirm ? 'bg-cyan-600 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/50' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}>
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('disarm', unit)}</div>
                                                                    <Unlock size={28} /> <span className="text-xs">{t('disarm')}</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {helpers.getDisplayCost(unit, 3)}</div>
                                                            </div>
                                                        );
                                                    }

                                                    // Index: Flag pickup/drop (for General or when Gen B Level 3+)
                                                    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                                                    const canCarryFlag = unit.type === UnitType.GENERAL || genLevelB >= 3;
                                                    const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;

                                                    if (canCarryFlag) {
                                                        if (!unit.hasFlag && isAtFlag) {
                                                            buttons.push(
                                                                <div key="pickup_flag" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { actions.handlePickupFlag(); setEndTurnConfirm(false); }} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative bg-yellow-600/70 hover:bg-yellow-600 border-2 border-yellow-500 cursor-pointer text-white">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('pickup_flag', unit)}</div>
                                                                        <Flag size={28} />
                                                                        <span className="text-xs">{t('take')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ 0</div>
                                                                </div>
                                                            );
                                                        }
                                                        if (unit.hasFlag) {
                                                            buttons.push(
                                                                <div key="drop_flag" className="flex flex-col items-center gap-1">
                                                                    <button onClick={() => { actions.handleDropFlag(); setEndTurnConfirm(false); }} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative bg-yellow-600/70 hover:bg-yellow-600 border-2 border-yellow-500 shadow-lg shadow-yellow-500/50 text-white">
                                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('drop_flag', unit)}</div>
                                                                        <ArrowDownToLine size={28} />
                                                                        <span className="text-xs">{t('drop')}</span>
                                                                    </button>
                                                                    <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ 0</div>
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
                                                    const questStats = player.questStats;
                                                    const evolveButtons = [];

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

                                                    const canEvolveA = pLevels.a < 3 && player.energy >= EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS] && conditionMetA;
                                                    const canEvolveB = pLevels.b < 3 && player.energy >= EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS] && conditionMetB;

                                                    const evolveStartIndex = helpers.getEvolutionButtonStartIndex(unit);

                                                    if (canEvolveA) {
                                                        evolveButtons.push(
                                                            <div key="evolve_a" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => actions.handleEvolve(unit.type, 'a')} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 font-bold border-2 border-blue-400 shadow-lg text-white relative">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{evolveStartIndex}</div>
                                                                    <Dna size={28} /> <span className="text-xs">進化 A</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {EVOLUTION_COSTS[pLevels.a as keyof typeof EVOLUTION_COSTS]}</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (canEvolveB) {
                                                        evolveButtons.push(
                                                            <div key="evolve_b" className="flex flex-col items-center gap-1">
                                                                <button onClick={() => actions.handleEvolve(unit.type, 'b')} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 bg-orange-600 hover:bg-orange-500 font-bold border-2 border-orange-400 shadow-lg text-white relative">
                                                                    <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{canEvolveA ? evolveStartIndex + 1 : evolveStartIndex}</div>
                                                                    <Dna size={28} /> <span className="text-xs">進化 B</span>
                                                                </button>
                                                                <div className="bg-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold text-white">⚡ {EVOLUTION_COSTS[pLevels.b as keyof typeof EVOLUTION_COSTS]}</div>
                                                            </div>
                                                        );
                                                    }
                                                    return evolveButtons;
                                                })()}

                                                {/* End Turn */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            if (endTurnConfirm) {
                                                                actions.handleActionComplete(gameState.selectedUnitId);
                                                                setEndTurnConfirm(false);
                                                            } else {
                                                                setEndTurnConfirm(true);
                                                            }
                                                        }}
                                                        className={`w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 ${endTurnConfirm
                                                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-400 scale-105 shadow-lg shadow-slate-400/50'
                                                            : 'bg-slate-700 hover:bg-slate-600 border-slate-600'
                                                            } text-slate-200`}
                                                    >
                                                        <div className="absolute top-0.5 left-1.5 text-sm font-black text-white/90">{helpers.getActionButtonIndex('end_turn', helpers.getUnit(gameState.selectedUnitId))}</div>
                                                        <CheckCircle size={28} />
                                                        <span className="text-xs">{endTurnConfirm ? '確認' : t('end_turn')}</span>
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
