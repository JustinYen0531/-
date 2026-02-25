import React, { useCallback, useRef } from 'react';
import { GameState, Unit, PlayerID, UnitType, TargetMode, VFXEffect } from '../types';
import GridCell from './GridCell';

interface GameFieldProps {
    gameState: GameState;
    targetMode: TargetMode;
    handleCellClick: (r: number, c: number) => void;
    handleUnitClick: (unit: Unit) => void;
    onDismissMiss?: (r: number, c: number, owner?: PlayerID) => void;
    onDismissCount?: (r: number, c: number, owner: PlayerID) => void;
    isFlipped?: boolean;
    viewerPlayerId?: PlayerID;
    hoveredPos: { r: number, c: number } | null;
    onHoverCell?: (r: number, c: number | null) => void;
    disableBoardShake?: boolean;
    evolutionFxEvent?: {
        owner: PlayerID;
        unitType: UnitType;
        unitId: string;
        r: number;
        c: number;
        branch: 'a' | 'b';
        nonce: number;
    } | null;
    clearPetalsNonce?: number;
}

const GameField: React.FC<GameFieldProps> = ({
    gameState,
    targetMode,
    handleCellClick,
    handleUnitClick,
    onDismissMiss,
    onDismissCount,
    isFlipped = false,
    viewerPlayerId,
    hoveredPos,
    onHoverCell,
    disableBoardShake = false,
    evolutionFxEvent = null,
    clearPetalsNonce = 0
}) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const viewerPlayer = viewerPlayerId ?? gameState.currentPlayer;

    const rowCount = gameState.cells.length;
    const colCount = gameState.cells[0]?.length || 0;
    const carriedMineIds = new Set(
        [...gameState.players[PlayerID.P1].units, ...gameState.players[PlayerID.P2].units]
            .map(u => u.carriedMine?.id)
            .filter((id): id is string => !!id)
    );
    const displayBuildings = gameState.buildings.map((b) => {
        if (b.type !== 'factory') return b;
        const ownerMakerB = gameState.players[b.owner].evolutionLevels[UnitType.MAKER].b;
        return {
            ...b,
            level: Math.max(b.level ?? 1, ownerMakerB)
        };
    });

    const getUnit = (id: string, state: GameState = gameState) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };

    const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
        if (!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Centralized hover detection
        const colSize = rect.width / colCount;
        const rowSize = rect.height / rowCount;

        const c = Math.floor(x / colSize);
        const r = Math.floor(y / rowSize);

        // Check if within bounds
        if (r >= 0 && r < rowCount && c >= 0 && c < colCount) {
            const actualC = isFlipped ? colCount - 1 - c : c;
            if (hoveredPos?.r !== r || hoveredPos?.c !== actualC) {
                onHoverCell?.(r, actualC);
            }
        } else if (hoveredPos !== null) {
            onHoverCell?.(null as any, null as any);
        }

        if (disableBoardShake) {
            return;
        }

        // Tilt logic - use requestAnimationFrame or just direct style for best performance
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateY = ((x - centerX) / centerX) * 2; // Swapped X/Y rotation for natural feel
        const rotateX = ((y - centerY) / centerY) * -2;

        // Direct style update is faster than React state for this
        boardRef.current.style.transform = `perspective(2000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }, [rowCount, colCount, isFlipped, hoveredPos, onHoverCell, disableBoardShake]);

    const handleBoardMouseLeave = useCallback(() => {
        if (!boardRef.current) return;
        if (!disableBoardShake) {
            boardRef.current.style.transform = `perspective(2000px) rotateX(0deg) rotateY(0deg)`;
            boardRef.current.style.transition = 'transform 0.5s ease-out';
        }
        onHoverCell?.(null as any, null as any);
    }, [onHoverCell, disableBoardShake]);

    const toActualCol = (displayCol: number): number => (
        isFlipped ? colCount - 1 - displayCol : displayCol
    );

    return (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-visible"
            style={{ zIndex: 10 }}
            onMouseMove={handleBoardMouseMove}
            onMouseLeave={handleBoardMouseLeave}
        >
            <style>{`
                @keyframes vfx-explode {
                    0% { transform: scale(0.1); opacity: 1; filter: brightness(3) blur(0px); }
                    15% { transform: scale(1.2); opacity: 1; filter: brightness(2) blur(2px); }
                    100% { transform: scale(2.5); opacity: 0; filter: brightness(1) blur(12px); }
                }
                @keyframes vfx-ring {
                    0% { transform: scale(0.1); opacity: 1; border-width: 12px; }
                    20% { transform: scale(2); opacity: 0.8; border-width: 6px; }
                    100% { transform: scale(5); opacity: 0; border-width: 0px; }
                }
                @keyframes vfx-impact-glow {
                    0% { transform: scale(0.1); opacity: 1; }
                    10% { transform: scale(3); opacity: 0.4; }
                    100% { transform: scale(4); opacity: 0; }
                }
                @keyframes vfx-nuke {
                    0% { transform: scale(0.1); opacity: 1; filter: brightness(3); }
                    15% { transform: scale(3); opacity: 1; filter: brightness(1.5); }
                    100% { transform: scale(4.5); opacity: 0; filter: blur(20px); }
                }
                @keyframes vfx-ring-large {
                    0% { transform: scale(0.1); opacity: 1; }
                    100% { transform: scale(6); opacity: 0; }
                }
                @keyframes vfx-smoke {
                    0% { transform: scale(0.5); opacity: 0; }
                    15% { opacity: 1; }
                    100% { transform: scale(3.5); opacity: 0; filter: blur(15px); }
                }
                @keyframes vfx-ice {
                    0% { transform: scale(0.1) rotate(45deg); opacity: 1; filter: brightness(2); }
                    15% { transform: scale(1.3) rotate(60deg); opacity: 1; filter: brightness(1.5); }
                    100% { transform: scale(2) rotate(135deg); opacity: 0; filter: blur(8px); }
                }
                @keyframes vfx-chain-pulse {
                    0% { transform: scale(0.1); opacity: 1; border-width: 12px; }
                    15% { transform: scale(1); opacity: 1; border-width: 6px; }
                    100% { transform: scale(1.6); opacity: 0; border-width: 1px; }
                }
                @keyframes vfx-chain-core {
                    0% { transform: scale(0.1); opacity: 1; filter: brightness(2); }
                    10% { transform: scale(1.5); opacity: 1; }
                    100% { transform: scale(0.5); opacity: 0; filter: blur(10px); }
                }
                @keyframes vfx-scan-ring {
                    0% { transform: scale(0.3); opacity: 1; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                @keyframes boardScanPinFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-2px); }
                }
                @keyframes boardScanPinPulse {
                    0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.65; }
                    100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
                }
                @keyframes boardScanPinDigitBreathe {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-0.5px) scale(1.05); }
                }
                @keyframes float-pin {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes shadow-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(0.7); opacity: 0.2; }
                }
                .animate-vfx-explode { animation: vfx-explode 0.8s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-ring { animation: vfx-ring 0.8s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-impact-glow { animation: vfx-impact-glow 0.6s ease-out forwards; }
                .animate-vfx-nuke { animation: vfx-nuke 1.5s cubic-bezier(0.1, 1, 0.2, 1) forwards; }
                .animate-vfx-ring-large { animation: vfx-ring-large 1.2s ease-out forwards; }
                .animate-vfx-smoke { animation: vfx-smoke 1.2s ease-out forwards; }
                .animate-vfx-ice { animation: vfx-ice 1s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-chain-pulse { animation: vfx-chain-pulse 1s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-chain-core { animation: vfx-chain-core 1.2s ease-out forwards; }
                .animate-vfx-scan-ring { animation: vfx-scan-ring 0.9s ease-out forwards; }
                .animate-float-pin { animation: float-pin 2s ease-in-out infinite; }
                .animate-shadow-pulse { animation: shadow-pulse 2s ease-in-out infinite; }
            `}</style>
            <div ref={boardRef} className="grid gap-0 border-4 border-white bg-slate-900 rounded-lg overflow-hidden relative z-10 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                style={{
                    gridTemplateColumns: `repeat(${colCount || 15}, 48px)`,
                    gridTemplateRows: `repeat(${rowCount || 15}, 48px)`,
                    animation: disableBoardShake ? 'none' : "gentleBreathe 8s ease-in-out infinite",
                    transformStyle: 'preserve-3d',
                    filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 30px rgba(0, 255, 255, 0.4)) drop-shadow(0 0 45px rgba(255, 0, 255, 0.4))'
                }}>

                {/* Center Divider Line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/35 z-20 transform -translate-x-1/2 overflow-visible">
                    {/* Thin white center line */}
                    <div className="absolute inset-0 bg-white/45"></div>
                    <div className="absolute left-[-1px] right-[-1px] inset-y-0 bg-white/20 blur-[0.8px]"></div>
                    {/* Keep subtle cyan motion accents */}
                    <div className="absolute inset-0 bg-cyan-400/10 blur-[1px]"></div>
                    <div className="absolute left-[-2px] right-[-2px] h-[30%] bg-gradient-to-b from-transparent via-cyan-400/60 to-transparent blur-[3px]"
                        style={{ animation: 'dividerFlow 12s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}></div>
                    <div className="absolute left-[-2px] right-[-2px] h-[15%] bg-gradient-to-b from-transparent via-white/40 to-transparent blur-[1px]"
                        style={{ animation: 'dividerFlow 8s linear infinite reverse' }}></div>
                </div>

                {Array.from({ length: rowCount }).map((_, displayR) => (
                    Array.from({ length: colCount }).map((_, displayC) => {
                        const r = displayR;
                        const c = toActualCol(displayC);
                        const cell = gameState.cells[r]?.[c];
                        if (!cell) return null;

                        const smokesAtCell = gameState.smokes.filter(s => s.r === r && s.c === c);
                        const isSmoked = smokesAtCell.length > 0;
                        const isSmokedByEnemy = smokesAtCell.some(s => s.owner !== viewerPlayer);

                        const realUnit = [...gameState.players[PlayerID.P1].units, ...gameState.players[PlayerID.P2].units]
                            .find(u => u.r === r && u.c === c && !u.isDead);
                        const isUnitStealthed = realUnit?.status.isStealthed;
                        const isVisible = realUnit && (
                            realUnit.owner === viewerPlayer ||
                            (!isSmokedByEnemy && !isUnitStealthed)
                        );
                        const unit = isVisible ? realUnit : undefined;

                        const minesAtCell = gameState.mines.filter(m => m.r === r && m.c === c && !carriedMineIds.has(m.id));
                        const visibleMine = gameState.sandboxShowAllMines
                            ? minesAtCell[0]
                            : minesAtCell.find(m => m.owner === viewerPlayer) ||
                            minesAtCell.find(m => m.revealedTo.includes(viewerPlayer)) ||
                            undefined;
                        const mine = visibleMine;

                        const building = displayBuildings.find(b => b.r === r && b.c === c);
                        const selectedUnitId = gameState.selectedUnitId;
                        const selectedUnit = selectedUnitId ? getUnit(selectedUnitId) : undefined;
                        const selectedUnitOwner = selectedUnit ? gameState.players[selectedUnit.owner] : null;
                        const selectedGeneralLevelA = selectedUnitOwner ? selectedUnitOwner.evolutionLevels[UnitType.GENERAL].a : 0;
                        const cellUnitLevelA = unit ? gameState.players[unit.owner].evolutionLevels[unit.type].a : 0;
                        const cellEvolutionFxNonce =
                            unit &&
                                evolutionFxEvent &&
                                unit.id === evolutionFxEvent.unitId &&
                                r === evolutionFxEvent.r &&
                                c === evolutionFxEvent.c
                                ? evolutionFxEvent.nonce
                                : 0;
                        const cellEvolutionFxBranch: 'a' | 'b' | null =
                            unit &&
                                evolutionFxEvent &&
                                unit.id === evolutionFxEvent.unitId &&
                                r === evolutionFxEvent.r &&
                                c === evolutionFxEvent.c
                                ? evolutionFxEvent.branch
                                : null;

                        const cellSensorResults = gameState.sensorResults?.filter(sr =>
                            sr.r === r && sr.c === c && sr.owner === viewerPlayer
                        ) || [];
                        const countResult = [...cellSensorResults].reverse().find(sr => (sr.kind ?? 'count') === 'count');
                        const markResult = [...cellSensorResults].reverse().find(sr => sr.kind === 'mark');
                        const isBlueCountOwner = (countResult?.owner ?? viewerPlayer) === PlayerID.P1;
                        const pinStroke = isBlueCountOwner ? '#22d3ee' : '#f87171';
                        const pinTextClass = isBlueCountOwner ? 'text-cyan-100' : 'text-red-100';
                        const pinTextGlow = isBlueCountOwner
                            ? 'drop-shadow-[0_0_4px_rgba(34,211,238,0.95)]'
                            : 'drop-shadow-[0_0_4px_rgba(248,113,113,0.95)]';
                        const pinCloseClass = isBlueCountOwner
                            ? 'bg-slate-900/85 border-cyan-200/80 text-cyan-100 hover:bg-slate-800'
                            : 'bg-slate-900/85 border-red-200/80 text-red-100 hover:bg-slate-800';
                        const pinPulseColor = isBlueCountOwner ? 'rgba(34, 211, 238, 0.6)' : 'rgba(248, 113, 113, 0.6)';
                        const pinAuraColor = isBlueCountOwner ? 'rgba(34,211,238,0.35)' : 'rgba(248,113,113,0.35)';

                        let cellIsValidMove = false;
                        if (selectedUnit && targetMode === 'move') {
                            const dist = Math.abs(selectedUnit.r - r) + Math.abs(selectedUnit.c - c);
                            cellIsValidMove = dist === 1 && !cell.isObstacle && !realUnit;
                        }

                        let cellIsAttackTarget = false;
                        if (selectedUnit && targetMode === 'attack' && unit && unit.owner !== selectedUnit.owner) {
                            const dr = Math.abs(selectedUnit.r - r);
                            const dc = Math.abs(selectedUnit.c - c);
                            if ((dr + dc) <= (selectedGeneralLevelA >= 2 ? 2 : 1) && (dr === 0 || dc === 0)) {
                                cellIsAttackTarget = true;
                            }
                        }

                        return (
                            <div key={`${displayR}-${displayC}`} className="relative">
                                <GridCell
                                    cell={cell}
                                    phase={gameState.phase}
                                    unit={unit}
                                    mine={mine}
                                    hasMineAtCell={minesAtCell.length > 0}
                                    scanMarkSuccess={markResult ? !!markResult.success : null}
                                    building={building}
                                    isSelected={gameState.selectedUnitId === unit?.id}
                                    isValidMove={cellIsValidMove}
                                    isAttackTarget={cellIsAttackTarget}
                                    currentPlayer={viewerPlayer}
                                    isUnitStealthed={!!(isUnitStealthed && realUnit?.owner === viewerPlayer)}
                                    onClick={() => {
                                        if (markResult?.success === false) {
                                            handleCellClick(r, c);
                                            return;
                                        }
                                        // In placement phase, unit clicks should always go to unit handling
                                        // so swap/selection keeps working even when setup-mine mode is active.
                                        if (gameState.phase === 'placement' && unit) {
                                            handleUnitClick(unit);
                                            return;
                                        }
                                        const isSkillTargeting = targetMode && targetMode !== 'move';
                                        if (isSkillTargeting) handleCellClick(r, c);
                                        else if (unit) handleUnitClick(unit);
                                        else handleCellClick(r, c);
                                    }}
                                    p1FlagLoc={gameState.players[PlayerID.P1].flagPosition}
                                    p2FlagLoc={gameState.players[PlayerID.P2].flagPosition}
                                    targetMode={targetMode}
                                    selectedUnit={selectedUnit}
                                    selectedGeneralLevelA={selectedGeneralLevelA}
                                    evolutionLevelA={cellUnitLevelA}
                                    evolutionLevelB={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].b : 0}
                                    evolutionVariantA={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].aVariant : undefined}
                                    evolutionVariantB={unit ? gameState.players[unit.owner].evolutionLevels[unit.type].bVariant : undefined}
                                    p1GeneralLevelB={gameState.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].b}
                                    p2GeneralLevelB={gameState.players[PlayerID.P2].evolutionLevels[UnitType.GENERAL].b}
                                    p1GeneralVariantB={gameState.players[PlayerID.P1].evolutionLevels[UnitType.GENERAL].bVariant}
                                    p2GeneralVariantB={gameState.players[PlayerID.P2].evolutionLevels[UnitType.GENERAL].bVariant}
                                    selectedUnitLevelB={selectedUnit ? gameState.players[selectedUnit.owner].evolutionLevels[selectedUnit.type].b : 0}
                                    selectedUnitVariantB={selectedUnit ? gameState.players[selectedUnit.owner].evolutionLevels[selectedUnit.type].bVariant : null}
                                    buildings={displayBuildings}
                                    isSmoked={isSmoked}
                                    smokeOwner={smokesAtCell[0]?.owner}
                                    forceShowMines={gameState.sandboxShowAllMines}
                                    evolutionFxNonce={cellEvolutionFxNonce}
                                    evolutionFxBranch={cellEvolutionFxBranch}
                                    clearPetalsNonce={clearPetalsNonce}
                                    onDismissMiss={markResult?.success === false && onDismissMiss ? () => onDismissMiss(r, c, viewerPlayer) : undefined}
                                    hoveredPos={hoveredPos}
                                />
                                {countResult && (
                                    <div className="absolute inset-0 z-[260] flex flex-col items-center justify-center">
                                        <div className="group/scanpin relative mb-6 flex flex-col items-center opacity-100 p-2 -m-2">
                                            <div
                                                className="relative drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] pointer-events-none"
                                                style={{ animation: 'boardScanPinFloat 1.9s ease-in-out infinite' }}
                                            >
                                                <div
                                                    className="absolute rounded-full"
                                                    style={{
                                                        left: '50%',
                                                        top: '36%',
                                                        width: '22px',
                                                        height: '22px',
                                                        border: `1.5px solid ${pinPulseColor}`,
                                                        boxShadow: `0 0 10px ${pinAuraColor}`,
                                                        animation: 'boardScanPinPulse 1.5s ease-out infinite'
                                                    }}
                                                />
                                                <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M32 16C32 24.8366 16 42 16 42C16 42 0 24.8366 0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16Z" fill="#000000" />
                                                    <path d="M31 16C31 23.5 16 39.5 16 39.5C16 39.5 1 23.5 1 16C1 7.71573 7.71573 1 16 1C24.2843 1 31 7.71573 31 16Z" stroke={pinStroke} strokeWidth="2.2" />
                                                </svg>
                                                <div className="absolute top-0 left-0 w-[32px] h-[42px] flex items-center justify-center">
                                                    <span
                                                        className={`${pinTextClass} font-black text-[18px] leading-none -mt-2 ${pinTextGlow}`}
                                                        style={{ animation: 'boardScanPinDigitBreathe 1.9s ease-in-out infinite' }}
                                                    >
                                                        {countResult.count}
                                                    </span>
                                                </div>
                                            </div>
                                            {onDismissCount && (
                                                <button
                                                    type="button"
                                                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border text-[10px] leading-none font-black flex items-center justify-center pointer-events-auto opacity-0 group-hover/scanpin:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 ${pinCloseClass}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDismissCount(r, c, viewerPlayer);
                                                    }}
                                                >
                                                    x
                                                </button>
                                            )}
                                            <div className="w-4 h-1 bg-black/40 blur-[2px] rounded-full mt-1 animate-pulse pointer-events-none"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ))}

                {/* VFX Overlay Layer */}
                <div className="absolute inset-0 pointer-events-none z-[100] overflow-visible">
                    {gameState.vfx.map((vfx: VFXEffect) => (
                        <div
                            key={vfx.id}
                            className="absolute"
                            style={{
                                left: `${toActualCol(vfx.c) * 48 + 24}px`,
                                top: `${vfx.r * 48 + 24}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {vfx.type === 'explosion' && (
                                <div className="w-12 h-12 relative">
                                    <div className="absolute inset-0 bg-white rounded-full animate-vfx-impact-glow opacity-0"></div>
                                    <div className="absolute inset-0 bg-orange-600 rounded-full animate-vfx-explode opacity-0"></div>
                                    <div className="absolute inset-2 bg-yellow-400 rounded-full animate-vfx-explode opacity-0" style={{ animationDelay: '0.05s' }}></div>
                                    <div className="absolute inset-0 border-4 border-yellow-300 rounded-full animate-vfx-ring opacity-0"></div>
                                </div>
                            )}
                            {vfx.type === 'nuke' && (
                                <div className="w-24 h-24 relative">
                                    <div className="absolute inset-[-48px] bg-white rounded-full animate-vfx-impact-glow opacity-0" style={{ animationDuration: '1s' }}></div>
                                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-vfx-nuke opacity-0"></div>
                                    <div className="absolute inset-[-48px] border-8 border-emerald-300 rounded-full animate-vfx-ring-large opacity-0"></div>
                                </div>
                            )}
                            {vfx.type === 'smoke' && (
                                <div className="w-16 h-16 bg-slate-400/60 rounded-full blur-xl animate-vfx-smoke opacity-0"></div>
                            )}
                            {vfx.type === 'slow' && (
                                <div className="w-12 h-12 relative">
                                    <div className="absolute inset-[-12px] bg-cyan-400 rounded-full animate-vfx-impact-glow opacity-0"></div>
                                    <div className="absolute inset-0 border-2 border-cyan-300 bg-cyan-200/30 rounded-lg rotate-45 animate-vfx-ice opacity-0"></div>
                                    <div className="absolute inset-2 border-2 border-white/40 rounded-lg rotate-[15deg] animate-vfx-ice opacity-0" style={{ animationDelay: '0.1s' }}></div>
                                </div>
                            )}
                            {vfx.type === 'scan' && (
                                <div className="w-16 h-16 relative">
                                    <div className="absolute inset-[-10px] bg-cyan-300/40 rounded-full animate-vfx-impact-glow opacity-0"></div>
                                    <div className="absolute inset-0 border-2 border-cyan-300 rounded-full animate-vfx-scan-ring opacity-0"></div>
                                    <div className="absolute inset-2 border-2 border-cyan-400 rounded-full animate-vfx-scan-ring opacity-0" style={{ animationDelay: '0.12s' }}></div>
                                    <div className="absolute inset-4 border border-white/70 rounded-full animate-vfx-scan-ring opacity-0" style={{ animationDelay: '0.22s' }}></div>
                                </div>
                            )}
                            {vfx.type === 'chain' && (
                                <div className={`relative flex items-center justify-center ${vfx.size === 'large' ? 'w-[240px] h-[240px]' : 'w-[144px] h-[144px]'}`}>
                                    <div className="absolute inset-0 bg-purple-600 rounded-full animate-vfx-impact-glow opacity-0" style={{ animationDuration: '0.8s' }}></div>
                                    <div className="absolute inset-0 border-4 border-purple-400 rounded-full animate-vfx-chain-pulse opacity-0"></div>
                                    <div className="absolute inset-8 border-2 border-purple-300 rounded-full animate-vfx-chain-pulse opacity-0" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="absolute w-4 h-4 bg-white rounded-full animate-vfx-chain-core opacity-0"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameField;
