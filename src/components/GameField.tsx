import React, { useCallback, useRef } from 'react';
import { GameState, Unit, PlayerID, UnitType, TargetMode } from '../types';
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
    evolutionFxEvent = null
}) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const viewerPlayer = viewerPlayerId ?? gameState.currentPlayer;

    const rowCount = gameState.cells.length;
    const colCount = gameState.cells[0]?.length || 0;

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
                @keyframes boardExplosionPulse {
                    0% { transform: scale(0.25); opacity: 0.95; }
                    65% { transform: scale(1.1); opacity: 0.8; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                @keyframes boardExplosionSpark {
                    0% { transform: scale(0.2); opacity: 0.9; }
                    100% { transform: scale(1.9); opacity: 0; }
                }
                @keyframes boardScanPing {
                    0% { transform: scale(0.2); opacity: 0.95; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
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

                        const minesAtCell = gameState.mines.filter(m => m.r === r && m.c === c);
                        const visibleMine = gameState.sandboxShowAllMines
                            ? minesAtCell[0]
                            : minesAtCell.find(m => m.owner === viewerPlayer) ||
                            minesAtCell.find(m => m.revealedTo.includes(viewerPlayer)) ||
                            undefined;
                        const mine = visibleMine;

                        const building = gameState.buildings.find(b => b.r === r && b.c === c);
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
                                    buildings={gameState.buildings}
                                    isSmoked={isSmoked}
                                    smokeOwner={smokesAtCell[0]?.owner}
                                    forceShowMines={gameState.sandboxShowAllMines}
                                    evolutionFxNonce={cellEvolutionFxNonce}
                                    evolutionFxBranch={cellEvolutionFxBranch}
                                    onDismissMiss={markResult?.success === false && onDismissMiss ? () => onDismissMiss(r, c, viewerPlayer) : undefined}
                                    hoveredPos={hoveredPos}
                                />
                                {gameState.vfx
                                    .filter(v => v.r === r && v.c === c)
                                    .map(v => {
                                        const sizePx = v.size === 'large' ? 44 : v.size === 'small' ? 22 : 32;
                                        const isExplosion = v.type === 'explosion';
                                        const isScan = v.type === 'scan';
                                        if (!isExplosion && !isScan) return null;
                                        return (
                                            <div
                                                key={v.id}
                                                className="absolute inset-0 pointer-events-none z-[70] flex items-center justify-center"
                                            >
                                                <div
                                                    style={{
                                                        width: `${sizePx}px`,
                                                        height: `${sizePx}px`,
                                                        borderRadius: '9999px',
                                                        background: isExplosion
                                                            ? 'radial-gradient(circle, rgba(255,245,180,0.95) 0%, rgba(255,130,0,0.9) 38%, rgba(255,40,0,0.55) 62%, rgba(255,40,0,0) 100%)'
                                                            : 'radial-gradient(circle, rgba(180,255,255,0.95) 0%, rgba(56,189,248,0.7) 45%, rgba(56,189,248,0) 100%)',
                                                        boxShadow: isExplosion
                                                            ? '0 0 14px rgba(255,120,0,0.9), 0 0 24px rgba(255,70,0,0.55)'
                                                            : '0 0 14px rgba(56,189,248,0.85)',
                                                        animation: isExplosion
                                                            ? 'boardExplosionPulse 420ms ease-out forwards'
                                                            : 'boardScanPing 520ms ease-out forwards'
                                                    }}
                                                />
                                                {isExplosion && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            width: `${Math.round(sizePx * 0.55)}px`,
                                                            height: `${Math.round(sizePx * 0.55)}px`,
                                                            borderRadius: '9999px',
                                                            border: '2px solid rgba(255,230,150,0.9)',
                                                            animation: 'boardExplosionSpark 380ms ease-out forwards'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                {countResult && (
                                    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center">
                                        <div className="group/scanpin relative mb-6 animate-float-pin flex flex-col items-center opacity-100">
                                            <div className="relative drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] pointer-events-none">
                                                <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M32 16C32 24.8366 16 42 16 42C16 42 0 24.8366 0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16Z" fill="#000000" />
                                                    <path d="M31 16C31 23.5 16 39.5 16 39.5C16 39.5 1 23.5 1 16C1 7.71573 7.71573 1 16 1C24.2843 1 31 7.71573 31 16Z" stroke="#22d3ee" strokeWidth="2.2" />
                                                </svg>
                                                <div className="absolute top-0 left-0 w-[32px] h-[42px] flex items-center justify-center">
                                                    <span className="text-cyan-100 font-black text-[18px] leading-none -mt-2 drop-shadow-[0_0_4px_rgba(34,211,238,0.95)]">
                                                        {countResult.count}
                                                    </span>
                                                </div>
                                            </div>
                                            {onDismissCount && (
                                                <button
                                                    type="button"
                                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/85 border border-cyan-200/80 text-cyan-100 text-[10px] leading-none font-black flex items-center justify-center pointer-events-auto opacity-0 group-hover/scanpin:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 hover:bg-slate-800"
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
            </div>
        </div>
    );
};

export default GameField;
