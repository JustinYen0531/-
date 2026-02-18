import React from 'react';
import { GameState } from '../types';
import { AIDecisionInfo, AITuningProfile } from '../ai/types';

interface DevToolsPanelProps {
    open: boolean;
    onToggle: () => void;
    aiDecision: AIDecisionInfo | null;
    aiTuningProfile: AITuningProfile;
    setAiTuningProfile: (profile: AITuningProfile) => void;
    gameState: GameState;
}

const DevToolsPanel: React.FC<DevToolsPanelProps> = ({
    open,
    onToggle,
    aiDecision,
    aiTuningProfile,
    setAiTuningProfile,
    gameState
}) => {
    const unitLabel = aiDecision?.unitId ?? '--';
    const actionLabel = aiDecision?.action ?? '--';
    const formatTarget = (target: AIDecisionInfo['target']) => {
        if (!target) return '--';
        if (target.kind === 'cell') return `(${target.r + 1},${target.c + 1})`;
        if (target.kind === 'unit') return target.unit.type;
        return target.mineType;
    };
    const targetLabel = formatTarget(aiDecision?.target);

    const breakdown = aiDecision?.breakdown;
    const summary = breakdown
        ? [
            breakdown.attack ? `ATK ${breakdown.attack}` : null,
            breakdown.flag ? `FLAG ${breakdown.flag}` : null,
            breakdown.safety ? `SAFE ${breakdown.safety}` : null,
            breakdown.utility ? `UTIL ${breakdown.utility}` : null
        ].filter(Boolean).join(' · ')
        : '--';

    const rawTopCandidates = aiDecision?.rawTopCandidates ?? [];
    const finalTopCandidates = aiDecision?.finalTopCandidates ?? [];
    const rejectedReasons = aiDecision?.rejectedReasons ?? [];
    const rejectedSummary = aiDecision?.rejectedReasonSummary ?? { energy: 0, risk: 0, rules: 0 };

    return (
        <div className="fixed top-20 right-4 z-[90] font-sans pointer-events-auto">
            <button
                onClick={onToggle}
                className="mb-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border-2 border-cyan-400 bg-slate-900/90 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
            >
                {open ? 'DEVTOOLS - ON' : 'DEVTOOLS'}
            </button>
            {open && (
                <div className="w-[25rem] p-3 rounded-xl border-2 border-cyan-400/70 bg-slate-900/90 text-cyan-100 shadow-2xl shadow-cyan-500/30 space-y-3">
                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">
                        PvE Dev Tools
                    </div>
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-cyan-200">AI Tuning</div>
                        <div className="grid grid-cols-3 gap-1">
                            {(['aggressive', 'balanced', 'conservative'] as AITuningProfile[]).map(profile => (
                                <button
                                    key={profile}
                                    onClick={() => setAiTuningProfile(profile)}
                                    className={`px-1.5 py-1 rounded text-[9px] font-black border transition-all ${aiTuningProfile === profile
                                        ? 'bg-cyan-600 border-cyan-300 text-white'
                                        : 'bg-slate-800/60 border-slate-600 text-slate-300 hover:text-white'}`}
                                >
                                    {profile === 'aggressive' ? 'ATK' : profile === 'balanced' ? 'BAL' : 'SAFE'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 text-[10px]">
                        <div className="font-bold text-cyan-200">AI Decision</div>
                        <div>Unit: {unitLabel}</div>
                        <div>Action: {String(actionLabel).toUpperCase()}</div>
                        <div>Tuning: {aiDecision?.tuningProfile ? String(aiDecision.tuningProfile).toUpperCase() : String(aiTuningProfile).toUpperCase()}</div>
                        <div>Intent: {aiDecision?.intent ? String(aiDecision.intent).toUpperCase() : '--'}</div>
                        <div>Role: {aiDecision?.role ? String(aiDecision.role).toUpperCase() : '--'}</div>
                        <div>Opening: {aiDecision?.openingPlan ? String(aiDecision.openingPlan).toUpperCase() : 'NONE'}</div>
                        <div>Endgame: {aiDecision?.endgameMode ? `${String(aiDecision.endgameMode).toUpperCase()} (${aiDecision?.endgameUrgency?.toFixed(2) ?? '0.00'})` : 'NONE'}</div>
                        <div>Target: {targetLabel}</div>
                        <div>Score: {aiDecision?.score?.toFixed(1) ?? '--'}</div>
                        <div>Beam: {aiDecision?.lookaheadScore?.toFixed(1) ?? '--'}</div>
                        <div>Feint: {aiDecision?.isFeint ? `YES (FROM #${aiDecision?.sourceRank ?? 2})` : 'NO'}</div>
                        <div className="opacity-80">{summary}</div>
                        <div className="opacity-80">
                            Opp: A {aiDecision?.opponentAggression?.toFixed(1) ?? '--'} / F {aiDecision?.opponentFlagRush?.toFixed(1) ?? '--'} / M {aiDecision?.opponentMinePressure?.toFixed(1) ?? '--'}
                        </div>
                    </div>
                    <div className="space-y-1 text-[10px]">
                        <div className="font-bold text-cyan-200">Top-K (Scored)</div>
                        {rawTopCandidates.length === 0 && <div className="opacity-70">--</div>}
                        {rawTopCandidates.map(candidate => (
                            <div key={`raw-${candidate.rank}-${candidate.type}`} className="grid grid-cols-[24px_86px_1fr_56px] gap-1 opacity-90">
                                <div>#{candidate.rank}</div>
                                <div>{candidate.type.toUpperCase()}</div>
                                <div>{formatTarget(candidate.target)}</div>
                                <div className="text-right">{candidate.score.toFixed(1)}</div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1 text-[10px]">
                        <div className="font-bold text-cyan-200">Top-K (Final)</div>
                        {finalTopCandidates.length === 0 && <div className="opacity-70">--</div>}
                        {finalTopCandidates.map(candidate => (
                            <div key={`final-${candidate.rank}-${candidate.type}`} className="grid grid-cols-[24px_86px_1fr_90px] gap-1 opacity-90">
                                <div>#{candidate.rank}</div>
                                <div>{candidate.type.toUpperCase()}</div>
                                <div>{formatTarget(candidate.target)}</div>
                                <div className="text-right">{(candidate.lookaheadScore ?? candidate.score).toFixed(1)}</div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1 text-[10px]">
                        <div className="font-bold text-cyan-200">Rejected Reasons</div>
                        <div className="grid grid-cols-3 gap-1 text-[9px]">
                            <div className="rounded border border-cyan-500/40 bg-slate-800/60 px-1 py-0.5 text-center">ENERGY {rejectedSummary.energy}</div>
                            <div className="rounded border border-cyan-500/40 bg-slate-800/60 px-1 py-0.5 text-center">RISK {rejectedSummary.risk}</div>
                            <div className="rounded border border-cyan-500/40 bg-slate-800/60 px-1 py-0.5 text-center">RULES {rejectedSummary.rules}</div>
                        </div>
                        {rejectedReasons.length === 0 && <div className="opacity-70">--</div>}
                        {rejectedReasons.map((item, idx) => (
                            <div key={`${item.reason}-${item.action}-${idx}`} className="grid grid-cols-[58px_82px_1fr_24px] gap-1 opacity-90">
                                <div>{item.reason.toUpperCase()}</div>
                                <div>{item.action.toUpperCase()}</div>
                                <div>{item.detail}</div>
                                <div className="text-right">x{item.count}</div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1 text-[10px] text-cyan-200/80">
                        <div>Phase: {gameState.phase}</div>
                        <div>Turn: {gameState.turnCount}</div>
                        <div>Current: {gameState.currentPlayer}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevToolsPanel;
