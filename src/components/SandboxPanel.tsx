import React from 'react';
import { GameState, PlayerID, TargetMode } from '../types';
import { Language } from '../i18n';
import { FlaskConical, X, Zap, Shield, ShieldAlert, RefreshCw, Play, Pause, Hand } from '../icons';
import { getUnitNameKey } from '../gameHelpers';

interface SandboxPanelProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    startNewRound: (state?: GameState) => void;
    language: Language;
    isSandboxCollapsed: boolean;
    setIsSandboxCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    sandboxPos: { x: number, y: number };
    onSandboxDragStart: (e: React.MouseEvent) => void;
    targetMode: TargetMode;
    setTargetMode: React.Dispatch<React.SetStateAction<TargetMode>>;
    localPlayerId?: PlayerID;
    onStateMutated?: (reason: string) => void;
}

const SandboxPanel: React.FC<SandboxPanelProps> = ({
    gameState,
    setGameState,
    startNewRound,
    language,
    isSandboxCollapsed,
    setIsSandboxCollapsed,
    sandboxPos,
    onSandboxDragStart,
    targetMode,
    setTargetMode,
    localPlayerId,
    onStateMutated
}) => {
    const notifyStateMutated = (reason: string) => {
        onStateMutated?.(reason);
    };

    // Helper functions
    const getUnit = (id: string, state: GameState = gameState) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };

    const addEnergy = () => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                // In sandbox mode, boost whoever is currently taking the turn.
                // In non-sandbox devtools contexts, keep local-player targeting.
                [prev.gameMode === 'sandbox' ? prev.currentPlayer : (localPlayerId ?? prev.currentPlayer)]: {
                    ...prev.players[prev.gameMode === 'sandbox' ? prev.currentPlayer : (localPlayerId ?? prev.currentPlayer)],
                    energy: prev.players[prev.gameMode === 'sandbox' ? prev.currentPlayer : (localPlayerId ?? prev.currentPlayer)].energy + 100
                }
            }
        }));
        notifyStateMutated('add_energy');
    };

    const evolveCurrentUnit = (branch: 'a' | 'b', variant?: 1 | 2) => {
        if (!gameState.selectedUnitId) return;
        setGameState(prev => {
            // 直接查找單位，不限制於當前回合玩家
            const unit = getUnit(prev.selectedUnitId || '', prev);
            if (!unit) return prev;

            const p = prev.players[unit.owner];
            const newLevels = JSON.parse(JSON.stringify(p.evolutionLevels));
            const curLevel = newLevels[unit.type][branch];

            if (curLevel < 3) {
                newLevels[unit.type][branch] = curLevel + 1;
                if (curLevel + 1 === 3 && variant) {
                    if (branch === 'a') newLevels[unit.type].aVariant = variant;
                    else newLevels[unit.type].bVariant = variant;
                }
            }

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, evolutionLevels: newLevels }
                },
                logs: [{
                    turn: prev.turnCount,
                    messageKey: 'log_evolved',
                    params: {
                        unit: getUnitNameKey(unit.type),
                        unitType: unit.type,
                        branch: branch.toUpperCase() + (variant ? `- ${variant} ` : ''),
                        level: newLevels[unit.type][branch]
                    },
                    type: 'evolution' as const,
                    owner: unit.owner
                }, ...prev.logs]
            };
        });
        notifyStateMutated(`evolve_${branch} `);
    };

    const downgradeCurrentUnit = (branch: 'a' | 'b') => {
        if (!gameState.selectedUnitId) return;
        setGameState(prev => {
            const unit = getUnit(prev.selectedUnitId || '', prev);
            if (!unit) return prev;

            const p = prev.players[unit.owner];
            const newLevels = JSON.parse(JSON.stringify(p.evolutionLevels));
            const curLevel = newLevels[unit.type][branch];
            const variantKey = branch === 'a' ? 'aVariant' : 'bVariant';

            if (curLevel <= 0) return prev;

            const newLevel = curLevel - 1;
            newLevels[unit.type][branch] = newLevel;
            if (newLevel < 3) {
                newLevels[unit.type][variantKey] = null;
            }

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, evolutionLevels: newLevels }
                },
                logs: [{
                    turn: prev.turnCount,
                    messageKey: 'log_devolved',
                    params: {
                        unit: getUnitNameKey(unit.type),
                        unitType: unit.type,
                        branch: branch.toUpperCase(),
                        level: newLevel
                    },
                    type: 'info' as const,
                    owner: unit.owner
                }, ...prev.logs]
            };
        });
        notifyStateMutated(`downgrade_${branch} `);
    };

    const toggleGodMode = () => {
        setGameState(prev => ({
            ...prev,
            isGodMode: !prev.isGodMode,
            logs: [{
                turn: prev.turnCount,
                messageKey: !prev.isGodMode ? 'log_god_mode_enabled' : 'log_god_mode_disabled',
                params: {},
                type: 'info' as const
            }, ...prev.logs]
        }));
        notifyStateMutated('toggle_god_mode');
    };

    const skipToNextRound = () => {
        startNewRound();
        notifyStateMutated('new_round');
    };

    const healAll = () => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                [PlayerID.P1]: {
                    ...prev.players[PlayerID.P1],
                    units: prev.players[PlayerID.P1].units.map(u => ({ ...u, hp: u.maxHp, isDead: false, respawnTimer: 0 }))
                },
                [PlayerID.P2]: {
                    ...prev.players[PlayerID.P2],
                    units: prev.players[PlayerID.P2].units.map(u => ({ ...u, hp: u.maxHp, isDead: false, respawnTimer: 0 }))
                }
            }
        }));
        notifyStateMutated('heal_all');
    };

    const updateUnitStat = (stat: 'hp' | 'maxHp', change: number) => {
        if (!gameState.selectedUnitId) return;
        setGameState(prev => {
            // 直接查找單位，不限制於當前回合玩家
            const unit = getUnit(prev.selectedUnitId || '', prev);
            if (!unit) return prev;

            const p = prev.players[unit.owner];
            const newUnits = p.units.map(u => {
                if (u.id === unit.id) {
                    const newVal = Math.max(1, (u[stat] as number) + change);
                    const updatedUnit = { ...u, [stat]: newVal };
                    if (stat === 'maxHp' && updatedUnit.hp > newVal) {
                        updatedUnit.hp = newVal;
                    }
                    if (stat === 'hp' && updatedUnit.hp > updatedUnit.maxHp) {
                        updatedUnit.hp = updatedUnit.maxHp;
                    }
                    return updatedUnit;
                }
                return u;
            });

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, units: newUnits }
                }
            };
        });
        notifyStateMutated(`update_unit_${stat} `);
    };

    return (
        <div
            className={`fixed top-20 left-4 z-[60] bg-slate-900/95 border-2 border-yellow-500 rounded-xl flex flex-col backdrop-blur-md no-neon-text ${isSandboxCollapsed ? 'w-12 h-12 p-0 cursor-pointer hover:bg-slate-800' : 'p-4 min-w-[200px]'} transition-[width,height,padding,background-color] duration-300`}
            style={{
                transform: `translate3d(${sandboxPos.x}px, ${sandboxPos.y}px, 0)`,
                willChange: 'transform'
            }}
            onClick={(e) => {
                if (isSandboxCollapsed) {
                    setIsSandboxCollapsed(false);
                    e.stopPropagation();
                }
            }}
        >
            {/* Drag Handle & Header */}
            <div
                onMouseDown={(e) => {
                    onSandboxDragStart(e);
                    // Stop propagation to prevent clicking through when dragging
                    if (isSandboxCollapsed) e.stopPropagation();
                }}
                className={`flex items-center select-none ${isSandboxCollapsed ? 'w-full h-full justify-center cursor-move' : 'justify-between gap-3 cursor-move border-b border-yellow-500/30 pb-2 mb-3'}`}
            >
                <div className="flex items-center gap-2">
                    <FlaskConical size={isSandboxCollapsed ? 24 : 18} className="text-yellow-400" />
                    {!isSandboxCollapsed && (
                        <span className="text-yellow-400 font-black text-sm tracking-wider">
                            {language === 'zh_tw' ? '開發者工具' : 'SANDBOX TOOLS'}
                        </span>
                    )}
                </div>
                {!isSandboxCollapsed && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSandboxCollapsed(true);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-yellow-400"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {!isSandboxCollapsed && (
                <div className="grid grid-cols-1 gap-2">
                    <button onClick={addEnergy} className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95">
                        <Zap size={14} />
                        {language === 'zh_tw' ? '增加 100 能量' : '+100 Energy'}
                    </button>

                    <button onClick={healAll} className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95">
                        <Shield size={14} />
                        {language === 'zh_tw' ? '治療全員' : 'Heal All'}
                    </button>
                    <button
                        onClick={toggleGodMode}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 ${gameState.isGodMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >
                        <ShieldAlert size={14} />
                        {language === 'zh_tw' ? (gameState.isGodMode ? '關閉上帝模式' : '開啟上帝模式') : 'God Mode'}
                    </button>
                    <button
                        onClick={skipToNextRound}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs transition-all transform active:scale-95"
                    >
                        <RefreshCw size={14} />
                        {language === 'zh_tw' ? '跳過回合' : 'New Round'}
                    </button>
                    <button
                        onClick={() => {
                            setGameState(prev => ({ ...prev, isSandboxTimerPaused: !prev.isSandboxTimerPaused }));
                            notifyStateMutated('toggle_timer_pause');
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 ${gameState.isSandboxTimerPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}
                    >
                        {gameState.isSandboxTimerPaused ? <Play size={14} /> : <Pause size={14} />}
                        {gameState.isSandboxTimerPaused ? (language === 'zh_tw' ? '恢復計時' : 'Resume Timer') : (language === 'zh_tw' ? '暫停計時' : 'Pause Timer')}
                    </button>
                    <button
                        onClick={() => setTargetMode(targetMode === 'teleport' ? null : 'teleport')}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs transition-all transform active:scale-95 ${targetMode === 'teleport' ? 'bg-purple-500 text-white ring-2 ring-purple-300' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'}`}
                    >
                        <Hand size={14} />
                        {language === 'zh_tw' ? '移動單位' : 'Drag Unit'}
                    </button>
                    <div className="border-t border-slate-700 my-1 opacity-50"></div>
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{language === 'zh_tw' ? '單位進化 (選中單位)' : 'Evolve Selected'}</div>
                    <div className="flex flex-col gap-1.5">
                        {(() => {
                            const unit = gameState.selectedUnitId ? getUnit(gameState.selectedUnitId) : null;
                            if (!unit) return <div className="text-[10px] text-slate-500 italic text-center py-1 bg-slate-800/30 rounded">{language === 'zh_tw' ? '未選擇單位' : 'No unit selected'}</div>;

                            const levels = gameState.players[unit.owner].evolutionLevels[unit.type];

                            return (
                                <>
                                    <div className="flex gap-1 items-center">
                                        <span className="text-[9px] font-black w-4 text-blue-400">A</span>
                                        {levels.a < 2 ? (
                                            <button onClick={() => evolveCurrentUnit('a')} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95">
                                                {language === 'zh_tw' ? `進化 A(LV${levels.a}→${levels.a + 1})` : `LV${levels.a} →${levels.a + 1} `}
                                            </button>
                                        ) : levels.a === 2 ? (
                                            <div className="flex-1 flex gap-1">
                                                <button onClick={() => evolveCurrentUnit('a', 1)} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-blue-400/50">
                                                    3-1
                                                </button>
                                                <button onClick={() => evolveCurrentUnit('a', 2)} className="flex-1 px-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-blue-400/50">
                                                    3-2
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 py-1 bg-blue-900/30 text-blue-400/50 rounded-lg font-black text-[10px] text-center border border-blue-500/20">{language === 'zh_tw' ? 'A 已滿級' : 'A MAX'}</div>
                                        )}
                                        <button
                                            onClick={() => downgradeCurrentUnit('a')}
                                            disabled={levels.a <= 0}
                                            className={`px-2 py-1.5 rounded-lg font-black text-[10px] transition-all border ${levels.a > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500' : 'bg-slate-800/40 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                                            title="Downgrade A -1"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <span className="text-[9px] font-black w-4 text-orange-400">B</span>
                                        {levels.b < 2 ? (
                                            <button onClick={() => evolveCurrentUnit('b')} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95">
                                                {language === 'zh_tw' ? `進化 B(LV${levels.b}→${levels.b + 1})` : `LV${levels.b} →${levels.b + 1} `}
                                            </button>
                                        ) : levels.b === 2 ? (
                                            <div className="flex-1 flex gap-1">
                                                <button onClick={() => evolveCurrentUnit('b', 1)} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-orange-400/50">
                                                    3-1
                                                </button>
                                                <button onClick={() => evolveCurrentUnit('b', 2)} className="flex-1 px-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] transition-all transform active:scale-95 border border-orange-400/50">
                                                    3-2
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 py-1 bg-orange-900/30 text-orange-400/50 rounded-lg font-black text-[10px] text-center border border-orange-500/20">{language === 'zh_tw' ? 'B 已滿級' : 'B MAX'}</div>
                                        )}
                                        <button
                                            onClick={() => downgradeCurrentUnit('b')}
                                            disabled={levels.b <= 0}
                                            className={`px-2 py-1.5 rounded-lg font-black text-[10px] transition-all border ${levels.b > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500' : 'bg-slate-800/40 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                                            title="Downgrade B -1"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1 border-t border-slate-700/50 pt-1.5 mt-0.5">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">{language === 'zh_tw' ? '屬性調整' : 'STATS ADJUST'}</div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-black text-emerald-400">HP</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => updateUnitStat('hp', -1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">-</button>
                                                <div className="min-w-[30px] text-center font-mono text-xs text-emerald-300 bg-emerald-950/30 rounded px-1 flex items-center justify-center">{unit.hp}</div>
                                                <button onClick={() => updateUnitStat('hp', 1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">+</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-black text-rose-400">MAX</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => updateUnitStat('maxHp', -1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">-</button>
                                                <div className="min-w-[30px] text-center font-mono text-xs text-rose-300 bg-rose-950/30 rounded px-1 flex items-center justify-center">{unit.maxHp}</div>
                                                <button onClick={() => updateUnitStat('maxHp', 1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-md font-black text-xs border border-slate-600">+</button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SandboxPanel;
