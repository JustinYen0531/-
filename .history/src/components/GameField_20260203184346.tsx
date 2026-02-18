import React, { useCallback, useRef } from 'react';
import { GameState, Unit, PlayerID, UnitType, VFXEffect, TargetMode } from '../types';
import GridCell from './GridCell';

interface GameFieldProps {
    gameState: GameState;
    targetMode: TargetMode;
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

                    const sResult = gameState.sensorResults?.find(sr => sr.r === r && sr.c === c && sr.owner === gameState.currentPlayer);

                    return (
                        <div key={`${r}-${c}`} className="relative">
                            <GridCell
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
                                    const isSkillTargeting = targetMode && targetMode !== 'move';
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
                                buildings={gameState.buildings}
                                isSmoked={isSmoked}
                                smokeOwner={smokesAtCell[0]?.owner}
                                forceShowMines={gameState.sandboxShowAllMines}
                            />
                            {sResult && (
                                <div className="absolute inset-0 pointer-events-none z-[40] flex flex-col items-center justify-center translate-x-1 -translate-y-1">
                                    {/* Map Pin Floating Container */}
                                    <div className="relative mb-6 animate-float-pin flex flex-col items-center opacity-85">
                                        {/* Pin Body (SVG) */}
                                        <div className="relative drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                                            <svg width="28" height="36" viewBox="0 0 384 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192C0 85.961 85.961 0 192 0C298.039 0 384 85.961 384 192C384 269.413 357.03 291.031 211.732 501.67C191.95 530.41 152.48 530.41 172.268 501.67Z" fill="#22d3ee" fillOpacity="0.8" />
                                                <circle cx="192" cy="192" r="120" fill="white" fillOpacity="0.9" />
                                            </svg>
                                            {/* Number inside the pin */}
                                            <div className="absolute top-0 left-0 w-full h-[26px] flex items-center justify-center text-cyan-800 font-extrabold text-base">
                                                {sResult.count}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Ground Shadow */}
                                    <div className="absolute bottom-2 translate-x-[-4px] w-3 h-1 bg-black/30 rounded-[100%] blur-[1px] animate-shadow-pulse"></div>
                                </div>
                            )}
                        </div>
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
                @keyframes vfx-debris {
                    0% { transform: translate(0,0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
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
                @keyframes float-pin {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes shadow-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(0.7); opacity: 0.2; }
                }
                .animate-vfx-explode { animation: vfx-explode 0.8s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-float-pin { animation: float-pin 2s ease-in-out infinite; }
                .animate-shadow-pulse { animation: shadow-pulse 2s ease-in-out infinite; }
                .animate-vfx-ring { animation: vfx-ring 0.8s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-impact-glow { animation: vfx-impact-glow 0.6s ease-out forwards; }
                .animate-vfx-nuke { animation: vfx-nuke 1.5s cubic-bezier(0.1, 1, 0.2, 1) forwards; }
                .animate-vfx-ring-large { animation: vfx-ring-large 1.2s ease-out forwards; }
                .animate-vfx-smoke { animation: vfx-smoke 1.2s ease-out forwards; }
                .animate-vfx-ice { animation: vfx-ice 1s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-chain-pulse { animation: vfx-chain-pulse 1s cubic-bezier(0.15, 1, 0.3, 1) forwards; }
                .animate-vfx-chain-core { animation: vfx-chain-core 1.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default GameField;
