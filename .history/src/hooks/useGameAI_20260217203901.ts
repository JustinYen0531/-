import { useEffect, useRef } from 'react';
import {
    AI_MAX_ACTION_RETRIES,
    AI_THINK_DELAY_MS,
    AI_MAX_LOGGED_ACTIONS,
    AI_DECISION_BUDGET_MS,
    AI_ACTION_THINK_MS,
    AI_FEINT_CHANCE,
    AI_FEINT_COOLDOWN_TURNS,
    AI_FEINT_MAX_DELTA
} from '../ai/config';
import { MINE_DAMAGE } from '../constants';
import { buildAIPlanningContext } from '../ai/context';
import { collectRejectionSummary, summarizeRejectedReasonBuckets, summarizeTopCandidates } from '../ai/diagnostics';
import { executeAIAction } from '../ai/executor';
import { generateActionCandidatesForUnit, generateUnitCandidates } from '../ai/generator';
import { rerankActionsWithBeamLookahead } from '../ai/lookahead';
import { createInitialOpponentModel, updateOpponentModel } from '../ai/opponentModel';
import { chooseOpeningPlan } from '../ai/opening';
import { selectBestUnit, sortActionsByPriority } from '../ai/selector';
import {
    AI_TUNING_PROFILES,
    applyTuningToActionCandidates,
    applyTuningToPlanningContext,
    applyTuningToUnitCandidates
} from '../ai/tuning';
import { AIActionType, AIActions, AICandidateAction, AIDifficulty, AIDecisionInfo, AITuningProfile } from '../ai/types';
import { calculateAttackDamage } from '../gameEngine';
import { GameState, PlayerID, Unit, UnitType } from '../types';

interface UseGameAIProps {
    gameState: GameState;
    difficulty: AIDifficulty;
    tuningProfile: AITuningProfile;
    actions: AIActions;
    selectUnit: (unitId: string) => void;
    debug?: boolean;
    onDecision?: (info: AIDecisionInfo) => void;
}

const didActionApply = (before: GameState, after: GameState, unitId: string) => {
    const beforeUnit = before.players[PlayerID.P2].units.find(u => u.id === unitId);
    const afterUnit = after.players[PlayerID.P2].units.find(u => u.id === unitId);
    if (!beforeUnit || !afterUnit) return false;

    if (after.currentPlayer !== PlayerID.P2 || afterUnit.hasActedThisRound) return true;
    if (beforeUnit.r !== afterUnit.r || beforeUnit.c !== afterUnit.c) return true;
    if (beforeUnit.hp !== afterUnit.hp || beforeUnit.hasFlag !== afterUnit.hasFlag) return true;
    if (beforeUnit.energyUsedThisTurn !== afterUnit.energyUsedThisTurn) return true;
    if (before.players[PlayerID.P2].energy !== after.players[PlayerID.P2].energy) return true;
    if (before.mines.length !== after.mines.length || before.buildings.length !== after.buildings.length) return true;

    return false;
};

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const actionSortScore = (action: AICandidateAction, bonus: number) => (action.lookaheadScore ?? action.score) + bonus;
const AI_RECENT_ACTION_WINDOW = 6;
const AI_MOVE_STREAK_TRIGGER = 3;
const AI_MAX_ACTIONS_PER_UNIT = 3;
const AI_FOLLOW_UP_SCORE_THRESHOLD = 2;
const AI_FOLLOW_UP_DELAY_BASE = 280;
const AI_FOLLOW_UP_DELAY_JITTER = 220;
const AI_MOVE_DIVERSITY_MAX_DELTA: Record<AIDifficulty, number> = {
    easy: 7.5,
    normal: 5.5,
    hard: 4.5
};

const applyHardConstraints = (
    state: GameState,
    unit: Unit,
    actions: AICandidateAction[],
    planningContext: ReturnType<typeof buildAIPlanningContext>
) => {
    if (actions.length <= 1) {
        return actions;
    }

    const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
    const ownFlag = state.players[unit.owner].flagPosition;
    const enemyAliveUnits = state.players[enemyId].units.filter(u => !u.isDead);
    const enemyFlagCarrier = enemyAliveUnits.find(u => u.hasFlag) ?? null;
    const urgentFlagDefense = !!enemyFlagCarrier && manhattan(enemyFlagCarrier.r, enemyFlagCarrier.c, ownFlag.r, ownFlag.c) <= 5;
    const nearestEnemyToOwnFlag = enemyAliveUnits.reduce((best, enemyUnit) => {
        const dist = manhattan(enemyUnit.r, enemyUnit.c, ownFlag.r, ownFlag.c);
        return Math.min(best, dist);
    }, Number.POSITIVE_INFINITY);
    const strictFlagDefense = Number.isFinite(nearestEnemyToOwnFlag) && nearestEnemyToOwnFlag <= 3;

    const decorated = actions.map(action => {
        let bonus = 0;
        let lethal = false;
        let lethalOnCarrier = false;

        if (action.type === 'attack' && action.target?.kind === 'unit') {
            const target = action.target.unit;
            const { damage } = calculateAttackDamage(
                unit,
                target,
                state.players[unit.owner],
                state.players[target.owner],
                false
            );
            lethal = damage >= target.hp;
            lethalOnCarrier = lethal && target.hasFlag;
            if (lethal) bonus += 120;
            if (target.hasFlag) bonus += 110;
            if (strictFlagDefense) {
                const targetThreatToFlag = manhattan(target.r, target.c, ownFlag.r, ownFlag.c);
                if (targetThreatToFlag <= 2) bonus += 90;
            }
        }

        if (action.type === 'detonate_tower') {
            const ownTowers = state.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            if (ownTowers.length > 0) {
                const targetsInBlast = enemyAliveUnits.filter(enemyUnit =>
                    ownTowers.some(t => Math.abs(enemyUnit.r - t.r) <= 1 && Math.abs(enemyUnit.c - t.c) <= 1)
                );
                const killableTargets = targetsInBlast.filter(enemyUnit => enemyUnit.hp <= 3);
                if (killableTargets.length > 0) {
                    lethal = true;
                    bonus += killableTargets.length * 120;
                    if (killableTargets.some(enemyUnit => enemyUnit.hasFlag)) {
                        lethalOnCarrier = true;
                        bonus += 160;
                    }
                }
            }
        }

        if (action.type === 'throw_mine' && action.target?.kind === 'cell') {
            const targetCell = action.target;
            const enemyAtTarget = enemyAliveUnits.find(u => u.r === targetCell.r && u.c === targetCell.c);
            if (enemyAtTarget) {
                const wouldKill = enemyAtTarget.hp <= MINE_DAMAGE;
                if (wouldKill) {
                    lethal = true;
                    bonus += 110;
                }
                if (enemyAtTarget.hasFlag) {
                    bonus += 95;
                    if (wouldKill) {
                        lethalOnCarrier = true;
                        bonus += 120;
                    }
                }
            }
        }

        if (action.type === 'move_mine' && action.target?.kind === 'cell') {
            const targetCell = action.target;
            const defLevels = state.players[unit.owner].evolutionLevels[UnitType.DEFUSER];
            if (defLevels.b === 3 && defLevels.bVariant === 2) {
                const enemyAtTarget = enemyAliveUnits.find(u => u.r === targetCell.r && u.c === targetCell.c);
                if (enemyAtTarget) {
                    const damage = Math.floor(MINE_DAMAGE * 0.4);
                    const wouldKill = enemyAtTarget.hp <= damage;
                    if (wouldKill) {
                        lethal = true;
                        bonus += 95;
                    }
                    if (enemyAtTarget.hasFlag) {
                        bonus += 85;
                        if (wouldKill) {
                            lethalOnCarrier = true;
                            bonus += 110;
                        }
                    }
                }
            }
        }

        if (urgentFlagDefense && enemyFlagCarrier) {
            if (action.type === 'attack' && action.target?.kind === 'unit' && action.target.unit.hasFlag) {
                bonus += 180;
            } else if ((action.type === 'move' || action.type === 'teleport') && action.target?.kind === 'cell') {
                const before = manhattan(unit.r, unit.c, enemyFlagCarrier.r, enemyFlagCarrier.c);
                const after = manhattan(action.target.r, action.target.c, enemyFlagCarrier.r, enemyFlagCarrier.c);
                bonus += Math.max(0, before - after) * 30;
                if (after <= 1) {
                    bonus += 40;
                }
            } else if ((action.type === 'scan' || action.type === 'sensor_scan') && action.target?.kind === 'cell') {
                const toCarrier = manhattan(action.target.r, action.target.c, enemyFlagCarrier.r, enemyFlagCarrier.c);
                if (toCarrier <= 1) {
                    bonus += 35;
                }
            } else if (action.type === 'end_turn') {
                bonus -= 180;
            }
        }

        if (strictFlagDefense) {
            if ((action.type === 'move' || action.type === 'teleport') && action.target?.kind === 'cell') {
                const beforeOwnFlag = manhattan(unit.r, unit.c, ownFlag.r, ownFlag.c);
                const afterOwnFlag = manhattan(action.target.r, action.target.c, ownFlag.r, ownFlag.c);
                bonus += Math.max(0, beforeOwnFlag - afterOwnFlag) * 22;
                if (afterOwnFlag > beforeOwnFlag) {
                    bonus -= 35;
                }
            } else if (
                (action.type === 'place_mine' ||
                    action.type === 'place_tower' ||
                    action.type === 'convert_mine' ||
                    action.type === 'move_mine') &&
                action.target?.kind === 'cell'
            ) {
                const distToOwnFlag = manhattan(action.target.r, action.target.c, ownFlag.r, ownFlag.c);
                if (distToOwnFlag <= 2) bonus += 36;
            } else if (action.type === 'end_turn') {
                bonus -= 120;
            }
        }

        const lowHpGeneral = unit.type === UnitType.GENERAL && unit.maxHp > 0 && (unit.hp / unit.maxHp) <= 0.4;
        if (lowHpGeneral) {
            if ((action.type === 'move' || action.type === 'teleport') && action.target?.kind === 'cell') {
                const risk = planningContext.threatMap[action.target.r]?.[action.target.c] ?? 0;
                if (risk >= 22) {
                    bonus -= 220;
                } else if (risk <= 10) {
                    bonus += 20;
                }
            }
            if (action.type === 'attack' && !lethal) {
                bonus -= 60;
            }
        }

        return { action, bonus, lethal, lethalOnCarrier };
    });

    const byAdjustedScore = (a: typeof decorated[number], b: typeof decorated[number]) =>
        actionSortScore(b.action, b.bonus) - actionSortScore(a.action, a.bonus);

    const lethalCarrierActions = decorated.filter(item => item.lethalOnCarrier).sort(byAdjustedScore);
    if (lethalCarrierActions.length > 0) {
        const rest = decorated.filter(item => !item.lethalOnCarrier).sort(byAdjustedScore);
        return [...lethalCarrierActions, ...rest].map(item => item.action);
    }

    const lethalActions = decorated.filter(item => item.lethal).sort(byAdjustedScore);
    if (lethalActions.length > 0) {
        const rest = decorated.filter(item => !item.lethal).sort(byAdjustedScore);
        return [...lethalActions, ...rest].map(item => item.action);
    }

    return [...decorated].sort(byAdjustedScore).map(item => item.action);
};

const maybeApplyFeint = (
    actions: AICandidateAction[],
    difficulty: AIDifficulty,
    tuningProfile: AITuningProfile,
    endgameMode: AIDecisionInfo['endgameMode'],
    endgameUrgency: number,
    turnCount: number,
    lastFeintTurn: { current: number }
) => {
    const tuning = AI_TUNING_PROFILES[tuningProfile];
    let chance = AI_FEINT_CHANCE[difficulty] * tuning.feintChanceMultiplier;
    if (endgameMode === 'defense' && endgameUrgency >= 2.2) chance *= 0.35;
    if (endgameMode === 'race' && endgameUrgency >= 2.6) chance *= 0.5;
    if (chance <= 0 || actions.length < 2) return actions;

    if (turnCount - lastFeintTurn.current < AI_FEINT_COOLDOWN_TURNS) return actions;

    const first = actions[0];
    if (first.type === 'end_turn') return actions;

    const firstScore = first.lookaheadScore ?? first.score;
    const maxDelta = AI_FEINT_MAX_DELTA[difficulty] * tuning.feintMaxDeltaMultiplier;
    const candidates = actions.slice(1, 4)
        .map((action, idx) => ({ action, rank: idx + 2 }))
        .filter(({ action }) => action.type !== 'end_turn')
        .filter(({ action }) => {
            const candidateScore = action.lookaheadScore ?? action.score;
            if (firstScore - candidateScore > maxDelta) return false;

            const primarySafety = first.scoreBreakdown.safety ?? 0;
            const candidateSafety = action.scoreBreakdown.safety ?? 0;
            if (candidateSafety + 2 < primarySafety) return false;

            const primaryAttack = first.scoreBreakdown.attack ?? 0;
            const candidateAttack = action.scoreBreakdown.attack ?? 0;
            if (first.type === 'attack' && primaryAttack >= 10 && candidateAttack + 5 < primaryAttack) return false;

            return true;
        });
    if (candidates.length === 0) return actions;
    if (Math.random() >= chance) return actions;

    lastFeintTurn.current = turnCount;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const promoted = { ...picked.action, isFeint: true, sourceRank: picked.rank };
    const demoted = { ...first, isFeint: false, sourceRank: 1 };
    const rest = actions.filter((_, idx) => idx !== 0 && idx !== (picked.rank - 1));
    return [promoted, demoted, ...rest];
};

const maybeDiversifyFromMoveStreak = (
    actions: AICandidateAction[],
    difficulty: AIDifficulty,
    recentActionTypes: AIActionType[]
) => {
    if (actions.length <= 1) return actions;
    const primary = actions[0];
    if (primary.type !== 'move') return actions;

    const tail = recentActionTypes.slice(-AI_MOVE_STREAK_TRIGGER);
    if (tail.length < AI_MOVE_STREAK_TRIGGER || !tail.every(type => type === 'move')) {
        return actions;
    }

    const primaryScore = primary.lookaheadScore ?? primary.score;
    const maxDelta = AI_MOVE_DIVERSITY_MAX_DELTA[difficulty];
    const alternativeIndex = actions.findIndex((candidate, idx) => {
        if (idx === 0) return false;
        if (candidate.type === 'move' || candidate.type === 'end_turn') return false;
        const candidateScore = candidate.lookaheadScore ?? candidate.score;
        return (primaryScore - candidateScore) <= maxDelta;
    });

    if (alternativeIndex <= 0) return actions;
    const alternative = actions[alternativeIndex];
    return [alternative, ...actions.filter((_, idx) => idx !== alternativeIndex)];
};

export const useGameAI = ({
    gameState,
    difficulty,
    tuningProfile,
    actions,
    selectUnit,
    debug = false,
    onDecision
}: UseGameAIProps) => {
    const latestStateRef = useRef(gameState);
    const actionsRef = useRef(actions);
    const selectUnitRef = useRef(selectUnit);
    const onDecisionRef = useRef(onDecision);
    const opponentModelRef = useRef(createInitialOpponentModel());
    const lastModelSnapshotRef = useRef<GameState | null>(null);
    const lastFeintTurnRef = useRef(-999);
    const openingPlanRef = useRef<AIDecisionInfo['openingPlan']>(null);
    const lastTurnRef = useRef(0);
    const recentActionTypesRef = useRef<AIActionType[]>([]);
    useEffect(() => {
        latestStateRef.current = gameState;
    }, [gameState]);
    useEffect(() => {
        actionsRef.current = actions;
    }, [actions]);
    useEffect(() => {
        selectUnitRef.current = selectUnit;
    }, [selectUnit]);
    useEffect(() => {
        onDecisionRef.current = onDecision;
    }, [onDecision]);

    useEffect(() => {
        if (
            gameState.gameMode !== 'pve' ||
            gameState.currentPlayer !== PlayerID.P2 ||
            gameState.gameOver ||
            gameState.phase !== 'action'
        ) {
            return;
        }

        let cancelled = false;

        const performAITurn = () => {
            if (cancelled) return;

            const state = latestStateRef.current;
            if (state.turnCount < lastTurnRef.current) {
                openingPlanRef.current = null;
                opponentModelRef.current = createInitialOpponentModel();
                lastModelSnapshotRef.current = null;
                lastFeintTurnRef.current = -999;
                recentActionTypesRef.current = [];
            }
            lastTurnRef.current = state.turnCount;

            opponentModelRef.current = updateOpponentModel(
                opponentModelRef.current,
                lastModelSnapshotRef.current,
                state,
                PlayerID.P2
            );
            lastModelSnapshotRef.current = state;

            if (state.turnCount <= 6 && !openingPlanRef.current) {
                openingPlanRef.current = chooseOpeningPlan(
                    state,
                    difficulty,
                    tuningProfile,
                    opponentModelRef.current,
                    PlayerID.P2
                );
            }
            if (state.turnCount > 6) {
                openingPlanRef.current = null;
            }

            const baseContext = buildAIPlanningContext(
                state,
                difficulty,
                PlayerID.P2,
                opponentModelRef.current,
                openingPlanRef.current,
                tuningProfile
            );
            const planningContext = applyTuningToPlanningContext(baseContext, tuningProfile);
            const baseUnitCandidates = generateUnitCandidates(state, difficulty, planningContext, PlayerID.P2);
            const unitCandidates = applyTuningToUnitCandidates(baseUnitCandidates, tuningProfile);
            const sortedUnitCandidates = [...unitCandidates].sort((a, b) => b.score - a.score);
            const fallbackUnitCandidate = selectBestUnit(sortedUnitCandidates);
            if (!fallbackUnitCandidate) {
                actionsRef.current.handleActionComplete(null);
                return;
            }

            // Action-aware unit selection: among top-ranked units, pick the one with the strongest immediate action.
            const previewCandidates = sortedUnitCandidates.slice(0, Math.min(3, sortedUnitCandidates.length));
            let selectedUnit = fallbackUnitCandidate.unit;
            let selectedPreviewScore = Number.NEGATIVE_INFINITY;
            previewCandidates.forEach(candidate => {
                const candidateActions = applyTuningToActionCandidates(
                    generateActionCandidatesForUnit(state, candidate.unit, difficulty, planningContext),
                    tuningProfile
                );
                if (candidateActions.length === 0) return;
                const candidateSorted = sortActionsByPriority(candidateActions);
                const bestAction = candidateSorted[0];
                const bestActionScore = bestAction.lookaheadScore ?? bestAction.score;
                const combinedScore = bestActionScore + candidate.score * 0.2;
                if (combinedScore > selectedPreviewScore) {
                    selectedPreviewScore = combinedScore;
                    selectedUnit = candidate.unit;
                }
            });

            const baseActionCandidates = generateActionCandidatesForUnit(state, selectedUnit, difficulty, planningContext);
            const tunedActionCandidates = applyTuningToActionCandidates(baseActionCandidates, tuningProfile);
            const sortedByScore = sortActionsByPriority(tunedActionCandidates);
            const rawTopCandidates = summarizeTopCandidates(sortedByScore);
            const lookaheadRanked = rerankActionsWithBeamLookahead(state, sortedByScore, difficulty, PlayerID.P2, tuningProfile);
            const feintAdjustedActions = maybeApplyFeint(
                lookaheadRanked,
                difficulty,
                tuningProfile,
                planningContext.endgame.mode,
                planningContext.endgame.urgency,
                state.turnCount,
                lastFeintTurnRef
            );
            const constrainedActions = applyHardConstraints(state, selectedUnit, feintAdjustedActions, planningContext);
            const sortedActions = maybeDiversifyFromMoveStreak(
                constrainedActions,
                difficulty,
                recentActionTypesRef.current
            );
            const finalTopCandidates = summarizeTopCandidates(sortedActions);
            const rejectedReasons = collectRejectionSummary(state, selectedUnit, planningContext);
            const rejectedReasonSummary = summarizeRejectedReasonBuckets(rejectedReasons);
            if (debug) {
                const picks = sortedActions.slice(0, AI_MAX_LOGGED_ACTIONS);
                const summary = picks.length > 0
                    ? picks.map(p => `${p.type}${p.isFeint ? '*' : ''}:${(p.lookaheadScore ?? p.score).toFixed(1)}`).join(', ')
                    : 'no-action';
                const rejectedSummary = `E:${rejectedReasonSummary.energy} R:${rejectedReasonSummary.risk} RULE:${rejectedReasonSummary.rules}`;
                console.log(
                    `[AI:${difficulty}/${tuningProfile}] intent=${planningContext.intent} reserve=${planningContext.reserveEnergy} `
                    + `opening=${planningContext.opening.plan ?? 'none'} endgame=${planningContext.endgame.mode}:${planningContext.endgame.urgency.toFixed(2)} `
                    + `opp(a:${opponentModelRef.current.aggression.toFixed(1)} f:${opponentModelRef.current.flagRush.toFixed(1)} m:${opponentModelRef.current.minePressure.toFixed(1)}) `
                    + `unit=${selectedUnit.id} ${summary} rejected=${rejectedSummary}`
                );
            }

            const primaryAction = sortedActions[0];
            const candidatePressure = Math.min(6, Math.max(0, sortedActions.length - 1));
            const actionDelayBase = primaryAction ? (AI_ACTION_THINK_MS as any)[primaryAction.type] ?? 400 : 400;
            const humanLikeDelay = actionDelayBase + candidatePressure * 60;

            let startTime = 0;
            let unitActionsDone = 0;

            const tryFollowUp = () => {
                if (cancelled) return;
                if (unitActionsDone >= AI_MAX_ACTIONS_PER_UNIT) {
                    actionsRef.current.handleActionComplete(selectedUnit.id);
                    return;
                }
                const elapsed = Date.now() - startTime;
                if (elapsed > AI_DECISION_BUDGET_MS) {
                    actionsRef.current.handleActionComplete(selectedUnit.id);
                    return;
                }
                const freshState = latestStateRef.current;
                const freshUnit = freshState.players[PlayerID.P2].units.find(u => u.id === selectedUnit.id);
                if (!freshUnit || freshUnit.isDead || freshUnit.hasActedThisRound ||
                    freshState.currentPlayer !== PlayerID.P2 || freshState.phase !== 'action') {
                    return;
                }
                const freshBaseCtx = buildAIPlanningContext(
                    freshState, difficulty, PlayerID.P2,
                    opponentModelRef.current, openingPlanRef.current, tuningProfile
                );
                const freshCtx = applyTuningToPlanningContext(freshBaseCtx, tuningProfile);
                const freshRaw = applyTuningToActionCandidates(
                    generateActionCandidatesForUnit(freshState, freshUnit, difficulty, freshCtx),
                    tuningProfile
                );
                const freshSorted = sortActionsByPriority(freshRaw);
                const freshConstrained = applyHardConstraints(freshState, freshUnit, freshSorted, freshCtx);
                const followUps = freshConstrained.filter(a => a.type !== 'end_turn');
                const endScore = freshConstrained.find(a => a.type === 'end_turn')?.score ?? 0;
                if (followUps.length === 0 || followUps[0].score <= endScore + AI_FOLLOW_UP_SCORE_THRESHOLD) {
                    actionsRef.current.handleActionComplete(selectedUnit.id);
                    return;
                }
                const followUp = followUps[0];
                if (debug) {
                    console.log(
                        `[AI:${difficulty}/${tuningProfile}] follow-up #${unitActionsDone + 1}: `
                        + `${followUp.type}:${followUp.score.toFixed(1)} (endTurn:${endScore.toFixed(1)})`
                    );
                }
                if (onDecisionRef.current) {
                    const rejReasons = collectRejectionSummary(freshState, freshUnit, freshCtx);
                    onDecisionRef.current({
                        unitId: followUp.unitId, action: followUp.type, target: followUp.target,
                        mineType: followUp.mineType, score: followUp.score,
                        lookaheadScore: followUp.lookaheadScore, intent: freshCtx.intent,
                        role: freshCtx.unitRoles[followUp.unitId], tuningProfile,
                        openingPlan: freshCtx.opening.plan, endgameMode: freshCtx.endgame.mode,
                        endgameUrgency: freshCtx.endgame.urgency,
                        opponentAggression: freshCtx.opponentModel.aggression,
                        opponentFlagRush: freshCtx.opponentModel.flagRush,
                        opponentMinePressure: freshCtx.opponentModel.minePressure,
                        isFeint: followUp.isFeint, sourceRank: followUp.sourceRank,
                        breakdown: followUp.scoreBreakdown,
                        rawTopCandidates: summarizeTopCandidates(freshSorted),
                        finalTopCandidates: summarizeTopCandidates(freshConstrained),
                        rejectedReasons: rejReasons,
                        rejectedReasonSummary: summarizeRejectedReasonBuckets(rejReasons)
                    });
                }
                const before = latestStateRef.current;
                executeAIAction(followUp, {
                    state: before,
                    actions: actionsRef.current,
                    selectUnit: selectUnitRef.current
                });
                setTimeout(() => {
                    if (cancelled) return;
                    const after = latestStateRef.current;
                    const applied = didActionApply(before, after, selectedUnit.id);
                    if (!applied) {
                        actionsRef.current.handleActionComplete(selectedUnit.id);
                        return;
                    }
                    const recentActs = [...recentActionTypesRef.current, followUp.type];
                    recentActionTypesRef.current = recentActs.slice(-AI_RECENT_ACTION_WINDOW);
                    const updUnit = after.players[PlayerID.P2].units.find(u => u.id === selectedUnit.id);
                    if (
                        after.currentPlayer === PlayerID.P2 &&
                        after.phase === 'action' &&
                        updUnit && !updUnit.hasActedThisRound
                    ) {
                        unitActionsDone++;
                        if (unitActionsDone < AI_MAX_ACTIONS_PER_UNIT) {
                            setTimeout(() => tryFollowUp(), AI_FOLLOW_UP_DELAY_BASE + Math.random() * AI_FOLLOW_UP_DELAY_JITTER);
                        } else {
                            actionsRef.current.handleActionComplete(selectedUnit.id);
                        }
                    }
                }, 120);
            };

            const tryAction = (index: number) => {
                if (cancelled) return;

                if (startTime === 0) startTime = Date.now();
                const elapsed = Date.now() - startTime;
                if (elapsed > AI_DECISION_BUDGET_MS) {
                    actionsRef.current.handleActionComplete(selectedUnit.id);
                    return;
                }

                if (index >= sortedActions.length || index >= AI_MAX_ACTION_RETRIES) {
                    actionsRef.current.handleActionComplete(selectedUnit.id);
                    return;
                }

                const action = sortedActions[index];
                if (onDecisionRef.current) {
                    onDecisionRef.current({
                        unitId: action.unitId,
                        action: action.type,
                        target: action.target,
                        mineType: action.mineType,
                        score: action.score,
                        lookaheadScore: action.lookaheadScore,
                        intent: planningContext.intent,
                        role: planningContext.unitRoles[action.unitId],
                        tuningProfile,
                        openingPlan: planningContext.opening.plan,
                        endgameMode: planningContext.endgame.mode,
                        endgameUrgency: planningContext.endgame.urgency,
                        opponentAggression: planningContext.opponentModel.aggression,
                        opponentFlagRush: planningContext.opponentModel.flagRush,
                        opponentMinePressure: planningContext.opponentModel.minePressure,
                        isFeint: action.isFeint,
                        sourceRank: action.sourceRank,
                        breakdown: action.scoreBreakdown,
                        rawTopCandidates,
                        finalTopCandidates,
                        rejectedReasons,
                        rejectedReasonSummary
                    });
                }
                const before = latestStateRef.current;
                executeAIAction(action, {
                    state: before,
                    actions: actionsRef.current,
                    selectUnit: selectUnitRef.current
                });

                setTimeout(() => {
                    if (cancelled) return;
                    const after = latestStateRef.current;
                    const applied = didActionApply(before, after, selectedUnit.id);

                    if (!applied) {
                        tryAction(index + 1);
                        return;
                    }
                    const recentActions = [...recentActionTypesRef.current, action.type];
                    recentActionTypesRef.current = recentActions.slice(-AI_RECENT_ACTION_WINDOW);

                    const updatedUnit = after.players[PlayerID.P2].units.find(u => u.id === selectedUnit.id);
                    if (
                        after.currentPlayer === PlayerID.P2 &&
                        after.phase === 'action' &&
                        updatedUnit &&
                        !updatedUnit.hasActedThisRound
                    ) {
                        unitActionsDone++;
                        if (unitActionsDone < AI_MAX_ACTIONS_PER_UNIT) {
                            setTimeout(() => tryFollowUp(), AI_FOLLOW_UP_DELAY_BASE + Math.random() * AI_FOLLOW_UP_DELAY_JITTER);
                        } else {
                            actionsRef.current.handleActionComplete(selectedUnit.id);
                        }
                    }
                }, 120);
            };

            setTimeout(() => {
                if (cancelled) return;
                startTime = Date.now();
                tryAction(0);
            }, humanLikeDelay);
        };

        const timer = setTimeout(performAITurn, AI_THINK_DELAY_MS[difficulty]);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        gameState.turnCount,
        gameState.phase,
        gameState.currentPlayer,
        gameState.gameMode,
        gameState.gameOver,
        difficulty,
        tuningProfile
    ]);
};
