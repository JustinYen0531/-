import React, { useCallback, useRef } from 'react';
import { GameState, Unit, PlayerID, UnitType, VFXEffect } from '../types';
import GridCell from './GridCell';

interface GameFieldProps {
    gameState: GameState;
    targetMode: 'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null;
    handleCellClick: (r: number, c: number) => void;
    handleUnitClick: (unit: Unit) => void;
}

const GameField: React.FC<GameFieldProps> = ({
    gameState,
    targetMode,
    handleCellClick,
    handleUnitClick
}) => {
    const boardRef = useRef<HTMLDivElement>(null);

    const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
        if (!boardRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        // Subtle tilt: max 2 degrees
        const rotateX = ((y - centerY) / centerY) * -2;
        const rotateY = ((x - centerX) / centerX) * 2;
        boardRef.current.style.transform = `perspective(2000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        boardRef.current.style.transition = 'transform 0.1s ease-out';
    }, []);

    const handleBoardMouseLeave = useCallback(() => {
        if (!boardRef.current) return;
        boardRef.current.style.transform = `perspective(2000px) rotateX(0deg) rotateY(0deg)`;
        boardRef.current.style.transition = 'transform 0.5s ease-out';
    }, []);

    const getUnit = (id: string, state: GameState = gameState) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };

    return (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-visible"
            style={{ zIndex: 10 }}
            onMouseMove={handleBoardMouseMove}
            onMouseLeave={handleBoardMouseLeave}
        >
            <div ref={boardRef} className="grid gap-0 border-4 border-white bg-slate-900 rounded-lg overflow-visible relative z-10 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                style={{
                    gridTemplateColumns: `repeat(${gameState.cells[0]?.length || 15}, 48px)`,
                    gridTemplateRows: `repeat(${gameState.cells.length || 15}, 48px)`,
                    animation: 'gentleBreathe 4s ease-in-out infinite',
                    transformStyle: 'preserve-3d'
                }}>

                {/* Center Divider Line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(255,255,255,0.4)] z-20 transform -translate-x-1/2"
                    style={{ animation: 'gentleBreathe 4s ease-in-out infinite' }}></div>

                {gameState.cells.map((row, r) => row.map((cell, c) => {
                    const smokesAtCell = gameState.smokes.filter(s => s.r === r && s.c === c);
                    const isSmoked = smokesAtCell.length > 0;
                    const isSmokedByEnemy = smokesAtCell.some(s => s.owner !== gameState.currentPlayer);

                    const realUnit = [...gameState.players[PlayerID.P1].units, ...gameState.players[PlayerID.P2].units]
                        .find(u => u.r === r && u.c === c && !u.isDead);
                    const isUnitStealthed = realUnit?.status.isStealthed;
                    const isVisible = realUnit && (
                        realUnit.owner === gameState.currentPlayer ||
                        (!isSmokedByEnemy && !isUnitStealthed)
                    );
                    const unit = isVisible ? realUnit : undefined;

                    const realMine = gameState.mines.find(m => m.r === r && m.c === c);
                    const mine = realMine;

                    const building = gameState.buildings.find(b => b.r === r && b.c === c);

                    const selectedUnit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : undefined;
                    const selectedUnitOwner = selectedUnit ? gameState.players[selectedUnit.owner] : null;
                    // For attack range: if selected unit is General, use its Path A level; otherwise use team's General Path A level
                    const selectedGeneralLevelA = selectedUnitOwner ? selectedUnitOwner.evolutionLevels[UnitType.GENERAL].a : 0;

                    // For unit display: use the unit at this cell's Path A level
                    const cellUnitLevelA = unit ? gameState.players[unit.owner].evolutionLevels[unit.type].a : 0;

                    return (
                        <GridCell
                            key={`${r}-${c}`}
                            cell={cell}
                            unit={unit}
                            mine={mine}
                            building={building}
                            isSelected={gameState.selectedUnitId === unit?.id}
                            isValidMove={false}
                            isAttackTarget={false}
                            isSkillTarget={false}
                            currentPlayer={gameState.currentPlayer}
                            isUnitStealthed={!!(isUnitStealthed && realUnit?.owner === gameState.currentPlayer)}
                            onClick={() => {
                                // For skill targeting modes, handleCellClick should take priority
                                const isSkillTargeting = (targetMode as any) && (targetMode as any) !== 'move';
                                if (isSkillTargeting) {
                                    handleCellClick(r, c);
                                } else if (unit) {
                                    handleUnitClick(unit);
                                } else {
                                    handleCellClick(r, c);
                                }
                            }}
                            p1FlagLoc={gameState.players[PlayerID.P1].flagPosition}
                            p2FlagLoc={gameState.players[PlayerID.P2].flagPosition}
                            targetMode={targetMode as any}
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
                            buildings={gameState.buildings}
                            isSmoked={isSmoked}
                            smokeOwner={smokesAtCell[0]?.owner}
                            forceShowMines={gameState.sandboxShowAllMines}
                        />
                    );
                }))}

                {/* VFX Overlay Layer */}
                <div className="absolute inset-0 pointer-events-none z-[100] overflow-visible">
                    {gameState.vfx.map((vfx: VFXEffect) => (
                        <div
                            key={vfx.id}
                            className="absolute"
                            style={{
                                left: `${vfx.c * 48 + 24}px`,
                                top: `${vfx.r * 48 + 24}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {vfx.type === 'explosion' && (
                                <div className="w-12 h-12 relative">
                                    <div className="absolute inset-0 bg-orange-500 rounded-full animate-vfx-explode opacity-0"></div>
                                    <div className="absolute inset-0 border-4 border-yellow-300 rounded-full animate-vfx-ring opacity-0"></div>
                                </div>
                            )}
                            {vfx.type === 'nuke' && (
                                <div className="w-24 h-24 relative">
                                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-vfx-nuke opacity-0"></div>
                                    <div className="absolute inset-[-48px] border-8 border-emerald-300 rounded-full animate-vfx-ring-large opacity-0"></div>
                                </div>
                            )}
                            {vfx.type === 'smoke' && (
                                <div className="w-16 h-16 bg-slate-400/60 rounded-full blur-xl animate-vfx-smoke opacity-0"></div>
                            )}
                            {vfx.type === 'slow' && (
                                <div className="w-12 h-12 border-2 border-cyan-300 bg-cyan-200/30 rounded-lg rotate-45 animate-vfx-ice opacity-0"></div>
                            )}
                            {vfx.type === 'chain' && (
                                <div className={`relative flex items-center justify-center ${vfx.size === 'large' ? 'w-[240px] h-[240px]' : 'w-[144px] h-[144px]'}`}>
                                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full animate-vfx-chain-pulse opacity-0"></div>
                                    <div className="absolute inset-[20%] border-2 border-purple-400 rounded-full animate-vfx-chain-pulse opacity-0" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="absolute inset-[40%] bg-purple-600/20 rounded-full animate-vfx-chain-core opacity-0"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes vfx-explode {
                    0% { transform: scale(0.1); opacity: 1; }
                    50% { opacity: 0.8; }
                    100% { transform: scale(2); opacity: 0; }
                }
                @keyframes vfx-ring {
                    0% { transform: scale(0.5); opacity: 1; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes vfx-nuke {
                    0% { transform: scale(0.1); opacity: 1; filter: brightness(2); }
                    30% { transform: scale(3); opacity: 1; filter: brightness(1); }
                    100% { transform: scale(4); opacity: 0; }
                }
                @keyframes vfx-ring-large {
                    0% { transform: scale(0.1); opacity: 1; }
                    100% { transform: scale(5); opacity: 0; }
                }
                @keyframes vfx-smoke {
                    0% { transform: scale(0.5); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: scale(3); opacity: 0; }
                }
                @keyframes vfx-ice {
                    0% { transform: scale(0.1) rotate(45deg); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: scale(1.5) rotate(135deg); opacity: 0; }
                }
                @keyframes vfx-chain-pulse {
                    0% { transform: scale(0.1); opacity: 1; border-width: 8px; }
                    100% { transform: scale(1.2); opacity: 0; border-width: 1px; }
                }
                @keyframes vfx-chain-core {
                    0% { transform: scale(0.1); opacity: 0.8; }
                    50% { opacity: 0.4; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .animate-vfx-explode { animation: vfx-explode 0.6s ease-out forwards; }
                .animate-vfx-ring { animation: vfx-ring 0.6s ease-out forwards; }
                .animate-vfx-nuke { animation: vfx-nuke 1s ease-out forwards; }
                .animate-vfx-ring-large { animation: vfx-ring-large 1s ease-out forwards; }
                .animate-vfx-smoke { animation: vfx-smoke 0.8s ease-out forwards; }
                .animate-vfx-ice { animation: vfx-ice 0.6s ease-out forwards; }
                .animate-vfx-chain-pulse { animation: vfx-chain-pulse 0.7s ease-out forwards; }
                .animate-vfx-chain-core { animation: vfx-chain-core 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default GameField;
