import React, { useEffect, useRef, useState } from 'react';
import { PlayerID, GameState, Unit, UnitType } from '../types';
import { Star, Skull, Zap } from '../icons';
import { getUnitIcon, getUnitNameKey } from '../gameHelpers';
import { ENERGY_CAP_RATIO } from '../constants';
import { Language } from '../i18n';

interface UnitInfoPanelProps {
    gameState: GameState;
    localPlayerId: PlayerID;
    language: Language;
    t: (key: string, params?: Record<string, any>) => string;
    onUnitClick: (unit: Unit) => void;
    onSwapUnits?: (id1: string, id2: string) => void;
}

const HOVER_PREVIEW_DELAY_MS = 500;
const PREVIEW_HIDE_ANIMATION_MS = 180;

const UnitInfoPanel: React.FC<UnitInfoPanelProps> = ({ gameState, localPlayerId, t, onUnitClick, language, onSwapUnits }) => {
    const isPvp = gameState.gameMode === 'pvp';
    const canShowEnemyPreview = true;
    const localPlayer = isPvp ? localPlayerId : PlayerID.P1;
    const enemyPlayer = localPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const isPlacement = gameState.phase === 'placement';
    const [isPreviewMounted, setIsPreviewMounted] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const previewShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previewHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Drag and drop state
    const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null);
    const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);
    const player = gameState.players[localPlayer];
    const enemyState = gameState.players[enemyPlayer];
    const enemyOrderedUnits = enemyState.unitDisplayOrder
        .map(id => enemyState.units.find(u => u.id === id))
        .filter((u): u is Unit => !!u);
    const enemyActedUnits = enemyOrderedUnits.filter(u => u.hasActedThisRound && !u.isDead);
    const enemyDeadUnits = enemyOrderedUnits.filter(u => u.isDead);
    const enemyRemainingUnits = enemyOrderedUnits.filter(u => !u.hasActedThisRound && !u.isDead);
    const enemyActiveUnit = enemyRemainingUnits.length > 0 ? enemyRemainingUnits[0] : null;
    const enemyWaitingUnits = enemyRemainingUnits.slice(1);
    const enemyDisplayList = isPlacement
        ? enemyOrderedUnits
        : [
            ...enemyActedUnits,
            ...(enemyActiveUnit ? [enemyActiveUnit] : []),
            ...enemyWaitingUnits,
            ...enemyDeadUnits
        ];

    useEffect(() => {
        return () => {
            if (previewShowTimerRef.current) {
                clearTimeout(previewShowTimerRef.current);
            }
            if (previewHideTimerRef.current) {
                clearTimeout(previewHideTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!canShowEnemyPreview) {
            setIsPreviewVisible(false);
            setIsPreviewMounted(false);
        }
    }, [canShowEnemyPreview]);

    const openPreview = () => {
        if (!canShowEnemyPreview) return;
        if (previewHideTimerRef.current) {
            clearTimeout(previewHideTimerRef.current);
            previewHideTimerRef.current = null;
        }
        if (!isPreviewMounted) {
            setIsPreviewMounted(true);
        }
        requestAnimationFrame(() => {
            setIsPreviewVisible(true);
        });
    };

    const handlePanelMouseEnter = () => {
        if (!canShowEnemyPreview) return;
        if (previewShowTimerRef.current) {
            clearTimeout(previewShowTimerRef.current);
        }
        if (previewHideTimerRef.current) {
            clearTimeout(previewHideTimerRef.current);
            previewHideTimerRef.current = null;
        }
        previewShowTimerRef.current = setTimeout(() => {
            openPreview();
        }, HOVER_PREVIEW_DELAY_MS);
    };

    const handlePanelMouseLeave = () => {
        if (previewShowTimerRef.current) {
            clearTimeout(previewShowTimerRef.current);
            previewShowTimerRef.current = null;
        }
        if (!isPreviewMounted) return;
        setIsPreviewVisible(false);
        previewHideTimerRef.current = setTimeout(() => {
            setIsPreviewMounted(false);
        }, PREVIEW_HIDE_ANIMATION_MS);
    };

    // Drag handlers - always allow dragging to reorder squad panel
    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, unitId: string) => {
        e.dataTransfer.setData('text/plain', unitId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedUnitId(unitId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, unitId: string) => {
        if (!draggedUnitId || draggedUnitId === unitId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverUnitId(unitId);
    };

    const handleDragLeave = () => {
        setDragOverUnitId(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLButtonElement>, targetUnitId: string) => {
        e.preventDefault();
        const sourceUnitId = e.dataTransfer.getData('text/plain');

        if (sourceUnitId && sourceUnitId !== targetUnitId && onSwapUnits) {
            onSwapUnits(sourceUnitId, targetUnitId);
        }

        setDraggedUnitId(null);
        setDragOverUnitId(null);
    };

    const handleDragEnd = () => {
        setDraggedUnitId(null);
        setDragOverUnitId(null);
    };

    return (
        <div
            className="flex-[7] relative flex flex-col border-l-2 border-white/30 px-4 items-center h-full justify-center bg-slate-800/30"
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
        >
            {canShowEnemyPreview && isPreviewMounted && (
                <div
                    className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-[-56px] z-30 transition-all duration-200 ease-out ${isPreviewVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                >
                    <div className="rounded-lg border border-cyan-400/40 bg-slate-900/75 backdrop-blur-[1px] px-2.5 py-1.5 shadow-[0_10px_22px_rgba(0,0,0,0.35)] pointer-events-none">
                        <div className="text-[10px] font-black tracking-widest text-slate-300 text-center mb-1.5">
                            敵方預覽
                        </div>
                        <div className="flex gap-1.5 justify-center">
                            {enemyDisplayList.map((u) => {
                                const levelA = enemyState.evolutionLevels[u.type].a;
                                const levelB = enemyState.evolutionLevels[u.type].b;
                                const tier = Math.max(levelA, levelB);
                                const isActed = u.hasActedThisRound;
                                const isActive = !isPlacement && (gameState.phase === 'action' || gameState.phase === 'thinking') && u.id === enemyActiveUnit?.id;
                                const isWaiting = !isPlacement && gameState.phase === 'action' && !isActed && !isActive && !u.isDead;
                                const enemyCanReorderInAction =
                                    gameState.phase === 'action' &&
                                    gameState.currentPlayer === enemyPlayer &&
                                    !gameState.activeUnitId &&
                                    !gameState.selectedUnitId;
                                const isSelected = gameState.selectedUnitId === u.id;
                                const playerColorBorder = u.owner === PlayerID.P1 ? 'border-cyan-500/60' : 'border-rose-500/60';
                                const playerColorBg = u.owner === PlayerID.P1 ? 'bg-cyan-900/20' : 'bg-red-900/20';
                                return (
                                    <div
                                        key={`preview-${u.id}`}
                                        className={`
                                            relative flex flex-col items-center w-[72px] h-[88px] rounded-md border-2 transition-all
                                            ${isActive ? `ring-2 ring-offset-2 ring-offset-slate-900 ${u.owner === PlayerID.P1 ? 'ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]' : 'ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]'}` : ''}
                                            ${isWaiting && enemyCanReorderInAction ? `brightness-90 border-dashed ${playerColorBorder} ${playerColorBg}` : ''}
                                            ${isWaiting && !enemyCanReorderInAction ? `brightness-95 border-slate-600 ${u.owner === PlayerID.P1 ? 'bg-cyan-900/35' : 'bg-red-900/35'}` : ''}
                                            ${u.isDead ? 'opacity-30 grayscale bg-red-950/50 border-red-600' : ''}
                                            ${isActed ? 'opacity-60 border-slate-500 bg-slate-800/60' : ''}
                                            ${isSelected && !isWaiting && !isActed && !u.isDead
                                                ? `${u.owner === PlayerID.P1 ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]' : 'bg-rose-900/80 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]'} scale-105`
                                                : ''}
                                            ${!isWaiting && !isActed && !u.isDead && !isActive && u.owner === PlayerID.P1
                                                ? 'bg-cyan-900/40 border-slate-600'
                                                : !isWaiting && !isActed && !u.isDead && !isActive
                                                    ? 'bg-red-900/40 border-slate-600'
                                                    : ''}
                                        `}
                                    >
                                        <div className="absolute top-0.5 left-1 text-[9px] font-black text-white/80">
                                            {u.type === UnitType.GENERAL ? 'Q' : u.type === UnitType.MINESWEEPER ? 'W' : u.type === UnitType.RANGER ? 'E' : u.type === UnitType.MAKER ? 'R' : 'T'}
                                        </div>
                                        <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
                                            {levelA > 0 && (
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: levelA }).map((_, i) => {
                                                        const variantA = enemyState.evolutionLevels[u.type].aVariant;
                                                        let colorClass = 'text-blue-400 fill-blue-400';
                                                        if (levelA === 3 && variantA) {
                                                            if (variantA === 1) colorClass = 'text-cyan-400 fill-cyan-400';
                                                            else if (variantA === 2) colorClass = 'text-purple-400 fill-purple-400';
                                                        } else if (i === 2 && variantA) {
                                                            if (variantA === 1) colorClass = 'text-cyan-400 fill-cyan-400';
                                                            else if (variantA === 2) colorClass = 'text-purple-400 fill-purple-400';
                                                        }
                                                        return <Star key={`preview-a-${u.id}-${i}`} size={7} className={`${colorClass} drop-shadow-sm`} />;
                                                    })}
                                                </div>
                                            )}
                                            {levelB > 0 && (
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: levelB }).map((_, i) => {
                                                        const variantB = enemyState.evolutionLevels[u.type].bVariant;
                                                        let colorClass = 'text-orange-400 fill-orange-400';
                                                        if (levelB === 3 && variantB) {
                                                            if (variantB === 1) colorClass = 'text-yellow-400 fill-yellow-400';
                                                            else if (variantB === 2) colorClass = 'text-rose-500 fill-rose-500';
                                                        } else if (i === 2 && variantB) {
                                                            if (variantB === 1) colorClass = 'text-yellow-400 fill-yellow-400';
                                                            else if (variantB === 2) colorClass = 'text-rose-500 fill-rose-500';
                                                        }
                                                        return <Star key={`preview-b-${u.id}-${i}`} size={7} className={`${colorClass} drop-shadow-sm`} />;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center w-full pt-1">
                                            <div className={`${u.owner === PlayerID.P1 ? 'text-cyan-300' : 'text-red-300'} flex items-center justify-center`}>
                                                {getUnitIcon(u.type, 22, tier)}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center gap-0.5 pb-0">
                                            <div className="w-11 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                                                <div
                                                    className={`${u.hp < u.maxHp * 0.3 ? 'bg-red-500' : 'bg-emerald-500'} h-full`}
                                                    style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                                                />
                                            </div>
                                            <div className="text-[8px] font-black text-white/90 font-mono">HP:{u.hp}</div>
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 pb-0.5 leading-none">
                                            {t(getUnitNameKey(u.type))}
                                        </div>
                                        {u.isDead && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Skull size={24} className="text-white/80" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="text-sm text-white mb-2 uppercase tracking-widest text-center w-full flex justify-between px-4 font-bold">
                <span className="text-base">{t('squad_status')}</span>
                <span className="text-yellow-400 font-black text-base">
                    {isPlacement ? `${t('round')} ${gameState.turnCount}` : `${t('round')} ${gameState.turnCount}-${player.units.filter(u => u.hasActedThisRound).length + player.skipCountThisRound + 1}`}
                </span>
            </div>

            <div className="flex gap-4 justify-center w-full">
                {(() => {
                    // Base display on the player's manual display order (unitDisplayOrder)
                    const orderedUnits = player.unitDisplayOrder
                        .map(id => player.units.find(u => u.id === id))
                        .filter((u): u is Unit => !!u);

                    const actedUnits = orderedUnits.filter(u => u.hasActedThisRound && !u.isDead);
                    const deadUnits = orderedUnits.filter(u => u.isDead);
                    const remainingUnits = orderedUnits.filter(u => !u.hasActedThisRound && !u.isDead);

                    // Priority in Action Phase:
                    // The FIRST available (not acted, not dead) unit in the manual order is 'Active'
                    let activeUnit: Unit | null = null;
                    let waitingUnits: Unit[] = [];

                    if (remainingUnits.length > 0) {
                        activeUnit = remainingUnits[0];
                        waitingUnits = remainingUnits.slice(1);
                    }

                    // Calculate display list
                    let displayList: Unit[] = [];
                    if (isPlacement) {
                        displayList = orderedUnits;
                    } else {
                        // Strategy: Finished units stay on far left. 
                        // The next playable unit is highlighted Green.
                        // Other waiting units come next, following manual order.
                        displayList = [...actedUnits];
                        if (activeUnit) displayList.push(activeUnit);
                        displayList = [...displayList, ...waitingUnits, ...deadUnits];
                    }

                    return displayList.map((u) => {
                        // Calculate Tier for Visuals
                        const levelA = player.evolutionLevels[u.type].a;
                        const levelB = player.evolutionLevels[u.type].b;
                        const tier = Math.max(levelA, levelB);

                        // Check if this unit can be swapped (placement phase)
                        const canSwap = isPlacement && gameState.selectedUnitId && gameState.selectedUnitId !== u.id;

                        // Drag visual states
                        const isDragging = draggedUnitId === u.id;
                        const isDragOver = dragOverUnitId === u.id && draggedUnitId !== u.id;

                        // Calculate visual states based on the object, not index
                        // Acted: u.hasActedThisRound
                        // Active: u === activeUnit (if action phase)
                        // Waiting: in waitingUnits list

                        const isActed = u.hasActedThisRound;
                        const isActive = !isPlacement && (gameState.phase === 'action' || gameState.phase === 'thinking') && u.id === activeUnit?.id;
                        const isWaiting = !isPlacement && gameState.phase === 'action' && !isActed && !isActive && !u.isDead;
                        const canReorderInAction =
                            gameState.phase === 'action' &&
                            gameState.currentPlayer === localPlayer &&
                            !gameState.activeUnitId &&
                            !gameState.selectedUnitId;
                        const canDragReorder = !u.isDead && (isPlacement || canReorderInAction);

                        // Player Color for Waiting State
                        const playerColorBorder = u.owner === PlayerID.P1 ? 'border-cyan-500/60' : 'border-rose-500/60';
                        const playerColorBg = u.owner === PlayerID.P1 ? 'bg-cyan-900/20' : 'bg-red-900/20';

                        return (
                            <div key={u.id} className="flex flex-col items-center gap-1">
                                <button
                                    disabled={u.isDead || isActed || (isWaiting && gameState.selectedUnitId !== null)}
                                    onClick={() => {
                                        // In action phase, before committing a unit, allow clicking waiting units to swap order
                                        if (canReorderInAction) {
                                            // Clicking a waiting unit: swap with the active unit
                                            onUnitClick(u);
                                            return;
                                        }
                                        if (!isPlacement && gameState.phase === 'action' && !gameState.selectedUnitId) return;
                                        onUnitClick(u);
                                    }}
                                    draggable={canDragReorder}
                                    onDragStart={(e) => handleDragStart(e, u.id)}
                                    onDragOver={(e) => handleDragOver(e, u.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, u.id)}
                                    onDragEnd={handleDragEnd}
                                    className={`
                                        relative flex flex-col items-center justify-between w-20 h-24 rounded-lg border-2 transition-all
                                        ${canDragReorder ? 'cursor-grab active:cursor-grabbing' : ''}
                                        ${isDragging ? 'opacity-50 scale-95 border-dashed' : ''}
                                        ${isDragOver ? 'bg-emerald-500/40 border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.6)] scale-105 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : ''}
                                        ${isActive && !isDragging && !isDragOver ? `ring-2 ring-offset-2 ring-offset-slate-900 ${u.owner === PlayerID.P1 ? 'ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]' : 'ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]'}` : ''}
                                        ${isWaiting && canReorderInAction && !isDragging && !isDragOver ? `brightness-90 border-dashed ${playerColorBorder} ${playerColorBg}` : ''}
                                        ${isWaiting && !canReorderInAction && !isDragging && !isDragOver ? `brightness-95 border-slate-600 ${u.owner === PlayerID.P1 ? 'bg-cyan-900/35' : 'bg-red-900/35'}` : ''}
                                        ${u.isDead ? 'opacity-30 grayscale cursor-not-allowed bg-red-950/50 border-red-600' : ''}
                                        ${isActed ? `opacity-60 cursor-not-allowed border-slate-500 ${u.owner === PlayerID.P1 ? 'bg-slate-800/60' : 'bg-slate-800/60'}` : ''}
                                        ${!isDragging && !isDragOver && !isWaiting && !isActed && canSwap
                                            ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                            : !isDragging && !isDragOver && !isWaiting && !isActed && gameState.selectedUnitId === u.id
                                                ? `${u.owner === PlayerID.P1 ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]' : 'bg-rose-900/80 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]'} scale-110 z-10`
                                                : !isDragging && !isDragOver && !isWaiting && !isActed && !isActive && u.owner === PlayerID.P1
                                                    ? 'bg-cyan-900/40 border-slate-600 hover:bg-cyan-900/60 hover:border-cyan-500'
                                                    : !isDragging && !isDragOver && !isWaiting && !isActed && !isActive ? 'bg-red-900/40 border-slate-600 hover:bg-red-900/60 hover:border-red-500' : ''
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
                                        {t(getUnitNameKey(u.type))}
                                    </div>

                                    {/* Resurrection Timer Display */}
                                    {u.isDead && u.respawnTimer > 0 && (
                                        <div className="text-[10px] font-black text-red-500 font-mono">
                                            {language === 'zh_tw' ? '復活' : 'RESPAWN'}:{u.respawnTimer}
                                        </div>
                                    )}
                                </button>

                                {/* Energy Cap Display */}
                                <div className="text-[10px] font-black text-cyan-300 font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-700 flex items-center gap-1">
                                    <Zap size={10} className="text-yellow-400" />
                                    <span>{u.energyUsedThisTurn}/{Math.floor(u.startOfActionEnergy * ENERGY_CAP_RATIO)}</span>
                                </div>
                            </div>
                        );
                    })
                })()}
            </div>
        </div>
    );
};

export default UnitInfoPanel;
