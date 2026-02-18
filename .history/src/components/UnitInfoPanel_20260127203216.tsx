import React from 'react';
import { PlayerID, GameState, Unit, UnitType } from '../types';
import { Star, Skull, Swords, Zap, Move, Shield, Info } from '../icons';
import { getUnitIcon, getUnitName } from '../gameHelpers';
import { ENERGY_CAP_RATIO, UNIT_STATS } from '../constants';
import { Language } from '../i18n';

interface UnitInfoPanelProps {
    gameState: GameState;
    language: Language;
    t: (key: string, params?: Record<string, any>) => string;
    onUnitClick: (unit: Unit) => void;
}

const UnitInfoPanel: React.FC<UnitInfoPanelProps> = ({ gameState, t, onUnitClick, language }) => {
    const player = gameState.players[gameState.currentPlayer];
    const isPlacement = gameState.phase === 'placement';
    const selectedUnit = gameState.selectedUnitId
        ? (gameState.players[PlayerID.P1].units.find(u => u.id === gameState.selectedUnitId) ||
            gameState.players[PlayerID.P2].units.find(u => u.id === gameState.selectedUnitId))
        : null;

    const renderStat = (icon: React.ReactNode, label: string, value: string | number, colorClass: string) => (
        <div className="flex flex-col items-center px-3 py-1 bg-slate-900/40 border border-slate-700/50 rounded-lg min-w-[60px]">
            <div className={`${colorClass} mb-1`}>{icon}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{label}</div>
            <div className="text-sm font-black text-white">{value}</div>
        </div>
    );

    return (
        <div className="flex-[7] flex flex-row border-l-2 border-white/30 px-4 items-center h-full justify-between bg-slate-800/30 gap-4">

            {/* Squad Status Mini Icons */}
            <div className="flex flex-col justify-center items-center gap-1 border-r border-white/10 pr-4">
                <div className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">{t('squad')}</div>
                <div className="flex gap-2">
                    {player.units.map((u) => (
                        <button
                            key={u.id}
                            disabled={u.isDead}
                            onClick={() => onUnitClick(u)}
                            className={`
                                w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all relative
                                ${u.isDead ? 'bg-red-950/20 border-red-900 opacity-40' :
                                    gameState.selectedUnitId === u.id ? 'bg-cyan-500/30 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] scale-110' :
                                        'bg-slate-700/50 border-slate-600 hover:border-slate-400'}
                            `}
                        >
                            <div className={u.isDead ? 'text-slate-500' : u.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400'}>
                                {getUnitIcon(u.type, 18)}
                            </div>
                            {u.isDead && <Skull size={10} className="absolute inset-0 m-auto text-white/50" />}
                            {/* Tiny Health Bar Overlay */}
                            {!u.isDead && (
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900 rounded-b-lg overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Unit Details */}
            {selectedUnit ? (
                <div className="flex-1 flex items-center gap-6 animate-fade-in slide-in-bottom">
                    {/* Unit Mascot & Name */}
                    <div className="flex items-center gap-4 border-r border-white/10 pr-6">
                        <div className={`p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 ${selectedUnit.owner === PlayerID.P1 ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'}`}>
                            {getUnitIcon(selectedUnit.type, 48)}
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-xl font-black text-white leading-none mb-1 tracking-tight">{getUnitName(selectedUnit.type)}</h3>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <Shield size={14} className="text-emerald-400" />
                                    <div className="w-20 h-2.5 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${selectedUnit.hp < selectedUnit.maxHp * 0.3 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${(selectedUnit.hp / selectedUnit.maxHp) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-black font-mono text-white/70">{selectedUnit.hp}/{selectedUnit.maxHp}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats List */}
                    <div className="flex gap-2">
                        {renderStat(<Swords size={16} />, t('atk') || 'ATK', (UNIT_STATS as any)[selectedUnit.type].attackDmg || '-', 'text-red-400')}
                        {renderStat(<Move size={16} />, t('move_cost') || 'MOV', (UNIT_STATS as any)[selectedUnit.type].moveCost, 'text-blue-400')}
                        {renderStat(<Zap size={16} />, t('energy') || 'NRG', `${selectedUnit.energyUsedThisTurn}/${Math.floor(selectedUnit.startOfActionEnergy * ENERGY_CAP_RATIO)}`, 'text-yellow-400')}

                        {/* Status Effects */}
                        <div className="flex flex-col items-center px-4 py-1 bg-slate-900/60 border-2 border-cyan-500/30 rounded-lg min-w-[80px] shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]">
                            <div className="text-cyan-400 mb-1"><Info size={16} /></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Status</div>
                            <div className="text-[10px] font-black text-cyan-300">
                                {selectedUnit.isDead ? 'DEAD' : (selectedUnit.hasActedThisRound ? 'ACTED' : 'READY')}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 font-black italic tracking-widest gap-2 opacity-50">
                    <Info size={24} />
                    {t('select_unit_to_view_details')}
                </div>
            )}

            {/* Round Status */}
            <div className="shrink-0 flex flex-col items-end border-l border-white/10 pl-4">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('round')}</div>
                <div className="text-3xl font-black text-yellow-400 font-mono tracking-tighter leading-none">
                    {isPlacement ? gameState.turnCount : `${gameState.turnCount}-${player.units.filter(u => u.hasActedThisRound).length + 1}`}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase mt-1">
                    {isPlacement ? t('placement_phase') : t('action_phase')}
                </div>
            </div>
        </div>
    );
};

export default UnitInfoPanel;
