import React from 'react';
import { RefreshCw, Zap, ChevronRight, ChevronLeft } from '../icons';
import { GameState, PlayerID } from '../types';

interface SandboxPanelProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    isSandboxCollapsed: boolean;
    setIsSandboxCollapsed: (collapsed: boolean) => void;
    sandboxPos: { x: number, y: number };
    onSandboxDragStart: (e: React.MouseEvent) => void;
    language: string;
    addLog: (messageKey: string, type: any, params?: any) => void;
}

const SandboxPanel: React.FC<SandboxPanelProps> = ({
    gameState, setGameState, isSandboxCollapsed, setIsSandboxCollapsed,
    sandboxPos, onSandboxDragStart, language, addLog
}) => {
    if (gameState.gameMode !== 'sandbox') return null;

    const addEnergy = (pid: PlayerID, amount: number) => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                [pid]: {
                    ...prev.players[pid],
                    energy: prev.players[pid].energy + amount
                }
            }
        }));
    };

    const resetUnits = () => {
        setGameState(prev => {
            const resetP = (p: any) => ({
                ...p,
                units: p.units.map((u: any) => ({
                    ...u,
                    hp: u.maxHp,
                    isDead: false,
                    respawnTimer: 0,
                    energyUsedThisTurn: 0,
                    hasActedThisRound: false,
                    isLocked: false
                }))
            });
            return {
                ...prev,
                players: {
                    [PlayerID.P1]: resetP(prev.players[PlayerID.P1]),
                    [PlayerID.P2]: resetP(prev.players[PlayerID.P2])
                }
            };
        });
        addLog('log_evolved', 'info', { unit: language === 'zh_tw' ? '所有單位' : 'All Units', branch: 'Reset', level: 0 });
    };

    const toggleAllMines = () => {
        setGameState(prev => ({ ...prev, sandboxShowAllMines: !prev.sandboxShowAllMines }));
    };

    return (
        <div
            className={`fixed z-[100] bg-slate-900/95 border-2 border-amber-500/50 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 ${isSandboxCollapsed ? 'w-12 h-12' : 'w-64'}`}
            style={{
                left: `${sandboxPos.x}px`,
                top: `${sandboxPos.y}px`,
            }}
        >
            {/* Header / Drag Handle */}
            <div
                onMouseDown={onSandboxDragStart}
                className="bg-amber-500/20 p-2 flex items-center justify-between cursor-move border-b border-amber-500/30"
            >
                {!isSandboxCollapsed && (
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <RefreshCw size={12} className="animate-spin-slow" /> Sandbox Tools
                    </span>
                )}
                <button
                    onClick={() => setIsSandboxCollapsed(!isSandboxCollapsed)}
                    className="p-1 hover:bg-amber-500/20 rounded text-amber-400 transition-colors"
                >
                    {isSandboxCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {!isSandboxCollapsed && (
                <div className="p-3 space-y-4">
                    {/* Energy 1 */}
                    <div className="space-y-1">
                        <div className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">Player 1 Energy</div>
                        <div className="flex gap-1">
                            {[10, 50, 100].map(amt => (
                                <button
                                    key={`p1-en-${amt}`}
                                    onClick={() => addEnergy(PlayerID.P1, amt)}
                                    className="flex-1 py-1 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 rounded text-[10px] font-bold text-blue-300 transition-all active:scale-95"
                                >
                                    +{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Energy 2 */}
                    <div className="space-y-1">
                        <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Player 2 Energy</div>
                        <div className="flex gap-1">
                            {[10, 50, 100].map(amt => (
                                <button
                                    key={`p2-en-${amt}`}
                                    onClick={() => addEnergy(PlayerID.P2, amt)}
                                    className="flex-1 py-1 bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 rounded text-[10px] font-bold text-red-300 transition-all active:scale-95"
                                >
                                    +{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Tools */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={resetUnits}
                            className="flex flex-col items-center justify-center p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-700/50 rounded-lg group transition-all"
                        >
                            <RefreshCw size={16} className="text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-[8px] mt-1 font-bold text-emerald-300 uppercase">Revive All</span>
                        </button>
                        <button
                            onClick={toggleAllMines}
                            className={`flex flex-col items-center justify-center p-2 border rounded-lg transition-all ${gameState.sandboxShowAllMines ? 'bg-amber-500/30 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                            <Zap size={16} />
                            <span className="text-[8px] mt-1 font-bold uppercase">Reveal Mines</span>
                        </button>
                    </div>

                    {/* Timer Control */}
                    <button
                        onClick={() => setGameState(prev => ({ ...prev, isSandboxTimerPaused: !prev.isSandboxTimerPaused }))}
                        className={`w-full py-2 rounded font-black text-[10px] uppercase tracking-widest border transition-all ${gameState.isSandboxTimerPaused ? 'bg-red-600 border-red-400 text-white animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                    >
                        {gameState.isSandboxTimerPaused ? 'Timer Paused' : 'Pause Game Timer'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SandboxPanel;
