import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, PlayerState, Building, VFXEffect, TargetMode
} from './types';

import {
    UNIT_STATS, ENERGY_CAP_RATIO, MINE_DAMAGE,
    TURN_TIMER, THINKING_TIMER,
    PLACEMENT_MINE_LIMIT
} from './constants';

import {
    createInitialState
} from './gameInit';
import {
    checkEnergyCap as engineCheckEnergyCap,
    applyFlagAuraDamageReduction,
    calculateMineInteraction,
    shouldTriggerMine
} from './gameEngine';
import {
    getUnitNameKey, getEnemyTerritoryEnergyCost, getDisplayCost as getDisplayCostRaw
} from './gameHelpers';
import { useGameAI } from './hooks/useGameAI';
import { AIDecisionInfo, AIDifficulty, AITuningProfile } from './ai/types';
import { useGameLoop } from './hooks/useGameLoop';
import { usePlayerActions } from './hooks/usePlayerActions';
import { ChevronLeft, ChevronRight, Info, Snowflake } from './icons';
import { TRANSLATIONS, Language } from './i18n';
import SandboxPanel from './components/SandboxPanel';
import DevToolsPanel from './components/DevToolsPanel';
import GameHeader from './components/GameHeader';
import GameField from './components/GameField';
import ControlPanel from './components/ControlPanel';
import GameModals from './components/GameModals';
import ShaderPlanet from './components/ShaderPlanet';
import CommonSettingsModal from './components/CommonSettingsModal';
import { VisualDetailMode } from './visualDetail';
import { useConnection } from './network/ConnectionProvider';
import {
    StartGamePayload,
    ReadySetupMine
} from './network/protocol';
import {
    isReadyPayload,
    isMovePayload,
    isAttackPayload,
    isScanPayload,
    isSensorScanPayload,
    isPlaceMinePayload,
    isFlagActionPayload,
    isEvolvePayload,
    isEndTurnPayload,
    isStateSyncPayload,
    isUnitTypeValue,
    serializeLogParams,
    dedupeLogsBySignature,
    ENEMY_MINE_LOG_KEYS,
    PRIVATE_HINT_LOG_KEYS,
    ONCE_PER_TURN_HINT_LOG_KEYS,
    toSerializableGameState,
    fromSerializableGameState,
    mergePlacementMines,
    getSetupMines,
    unionPlacementMines,
    upsertPlacementLogs,
} from './appHelpers';

const PRIVATE_HINT_LOG_TTL_TURNS = 1;

type SfxName = 'click' | 'place_mine' | 'attack' | 'mine_hit' | 'error' | 'victory' | 'defeat';

const BASE_URL = import.meta.env.BASE_URL || './';
const toAssetUrl = (relativePath: string): string =>
    `${BASE_URL.replace(/\/?$/, '/')}${relativePath.replace(/^\/+/, '')}`;

const SFX_SOURCE: Record<SfxName, string> = {
    click: toAssetUrl('sfx/click.wav'),
    place_mine: toAssetUrl('sfx/place-mine.wav'),
    attack: toAssetUrl('sfx/attack.wav'),
    mine_hit: toAssetUrl('sfx/mine-hit.wav'),
    error: toAssetUrl('sfx/error.wav'),
    victory: toAssetUrl('sfx/victory.wav'),
    defeat: toAssetUrl('sfx/defeat.wav')
};

const LOG_SFX_MAP: Partial<Record<string, { sound: SfxName; cooldownMs?: number; volume?: number }>> = {
    log_select_action: { sound: 'click', cooldownMs: 60, volume: 0.7 },
    log_move_action: { sound: 'click', cooldownMs: 60, volume: 0.75 },
    log_skip_turn: { sound: 'click', cooldownMs: 60, volume: 0.7 },
    log_pass_turn: { sound: 'click', cooldownMs: 60, volume: 0.7 },
    log_place_mine: { sound: 'place_mine', cooldownMs: 120, volume: 0.9 },
    log_throw_mine: { sound: 'place_mine', cooldownMs: 120, volume: 0.9 },
    log_mine_placed: { sound: 'place_mine', cooldownMs: 120, volume: 0.9 },
    log_mine_disarmed: { sound: 'click', cooldownMs: 120, volume: 0.8 },
    log_pickup_mine: { sound: 'click', cooldownMs: 120, volume: 0.85 },
    log_attack_hit: { sound: 'attack', cooldownMs: 140, volume: 0.95 },
    log_evol_def_reflect_hit: { sound: 'attack', cooldownMs: 140, volume: 0.95 },
    log_hit_mine: { sound: 'mine_hit', cooldownMs: 220, volume: 1 },
    log_chain_aoe: { sound: 'mine_hit', cooldownMs: 220, volume: 1 },
    log_evol_nuke_blast_hit: { sound: 'mine_hit', cooldownMs: 220, volume: 1 }
};


export default function App() {
    const [view, setView] = useState<'lobby' | 'game'>('lobby');
    const [gameState, setGameState] = useState<GameState>(createInitialState('pvp'));
    const [targetMode, setTargetMode] = useState<TargetMode>(null);
    const [selectedMineId, setSelectedMineId] = useState<string | null>(null);
    const [showEvolutionTree, setShowEvolutionTree] = useState(false);
    const [language, setLanguage] = useState<Language>('en');
    const [musicVolume, setMusicVolume] = useState(0.15);
    const [sfxVolume, setSfxVolume] = useState(0);
    const [showCommonSettings, setShowCommonSettings] = useState(false);
    const [disableBoardShake, setDisableBoardShake] = useState(false);
    const [detailMode, setDetailMode] = useState<VisualDetailMode>('normal');
    const [showGameStartAnimation, setShowGameStartAnimation] = useState(false);
    const [showLog, setShowLog] = useState(true);
    const [pvpPerspectivePlayer, setPvpPerspectivePlayer] = useState<PlayerID | null>(null);
    // Lobby state managed in GameModals, but Room ID/Host raised to App for persistence/networking
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [selectedMineType, setSelectedMineType] = useState<MineType>(MineType.NORMAL);
    const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
    const [aiTuningProfile, setAiTuningProfile] = useState<AITuningProfile>('balanced');
    const [hoveredPos, setHoveredPos] = useState<{ r: number, c: number } | null>(null);
    const [clearPetalsNonce, setClearPetalsNonce] = useState(0);
    const [aiDebug] = useState(false);
    const [aiDecision, setAiDecision] = useState<AIDecisionInfo | null>(null);
    const [evolutionFxEvent, setEvolutionFxEvent] = useState<{
        owner: PlayerID;
        unitType: UnitType;
        unitId: string;
        r: number;
        c: number;
        branch: 'a' | 'b';
        nonce: number;
    } | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const sfxAudioRef = useRef<Map<SfxName, HTMLAudioElement>>(new Map());
    const sfxLastPlayedRef = useRef<Map<SfxName, number>>(new Map());
    const lastSfxLogRef = useRef<string>('');
    const lastWinnerSfxRef = useRef<string>('');
    const lastEvolutionFxFromLogRef = useRef<string>('');
    const lastEvolutionFxEmitRef = useRef<{ signature: string; ts: number } | null>(null);
    const evolutionFxClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingRemoteActionRef = useRef(false);
    const lastHandledPacketSeqRef = useRef<number | null>(null);
    const lastLogEmitRef = useRef<Map<string, number>>(new Map());
    const placementMinesRef = useRef<Mine[]>([]);
    const autoEndedDeadUnitKeyRef = useRef<string | null>(null);
    const logScrollRef = useRef<HTMLDivElement>(null);
    const {
        isConnected: isNetworkConnected,
        lastIncomingPacket,
        sendActionPacket,
        disconnect
    } = useConnection();

    const [sandboxPos, setSandboxPos] = useState({ x: 0, y: 0 });
    const [isSandboxCollapsed, setIsSandboxCollapsed] = useState(false);
    const [showDevTools, setShowDevTools] = useState(false);
    const [allowDevToolsInAiChallenge, setAllowDevToolsInAiChallenge] = useState(false);
    const [allowDevToolsInPvpRoom, setAllowDevToolsInPvpRoom] = useState(false);
    const sandboxDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });
    const clampSandboxPos = useCallback((pos: { x: number; y: number }) => {
        if (typeof window === 'undefined') {
            return pos;
        }
        const minX = -8;
        const minY = -72;
        const maxX = Math.max(minX, window.innerWidth - 72);
        const maxY = Math.max(minY, window.innerHeight - 88);
        return {
            x: Math.min(Math.max(pos.x, minX), maxX),
            y: Math.min(Math.max(pos.y, minY), maxY),
        };
    }, []);

    const onSandboxDragStart = (e: React.MouseEvent) => {
        sandboxDragRef.current = {
            isDragging: true,
            startX: e.clientX - sandboxPos.x,
            startY: e.clientY - sandboxPos.y,
        };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!sandboxDragRef.current.isDragging) return;

            // Direct state update for zero-latency response
            setSandboxPos(clampSandboxPos({
                x: e.clientX - sandboxDragRef.current.startX,
                y: e.clientY - sandboxDragRef.current.startY,
            }));
        };
        const onMouseUp = () => {
            sandboxDragRef.current.isDragging = false;
        };

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [clampSandboxPos]);

    useEffect(() => {
        if (view !== 'game') return;
        setSandboxPos(prev => clampSandboxPos(prev));
    }, [view, isSandboxCollapsed, clampSandboxPos]);

    useEffect(() => {
        if (view !== 'game') return;
        const onResize = () => setSandboxPos(prev => clampSandboxPos(prev));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [view, clampSandboxPos]);

    useEffect(() => {
        const cache = sfxAudioRef.current;
        (Object.keys(SFX_SOURCE) as SfxName[]).forEach((sound) => {
            if (cache.has(sound)) return;
            const audio = new Audio(SFX_SOURCE[sound]);
            audio.preload = 'auto';
            cache.set(sound, audio);
        });
    }, []);

    const isDevToolsAllowedInCurrentMatch = gameState.gameMode === 'sandbox'
        || (gameState.gameMode === 'pve' && allowDevToolsInAiChallenge)
        || (gameState.gameMode === 'pvp' && allowDevToolsInPvpRoom);

    useEffect(() => {
        if (!isDevToolsAllowedInCurrentMatch && showDevTools) {
            setShowDevTools(false);
        }
    }, [isDevToolsAllowedInCurrentMatch, showDevTools]);

    useEffect(() => {
        if (targetMode !== 'place_setup_mine' || gameState.phase !== 'placement') {
            return;
        }

        const localPlayer = gameState.gameMode === 'pvp'
            ? (isHost ? PlayerID.P1 : PlayerID.P2)
            : gameState.currentPlayer;

        if (gameState.players[localPlayer].placementMinesPlaced >= PLACEMENT_MINE_LIMIT) {
            setTargetMode(null);
        }
    }, [gameState, isHost, targetMode]);

    // Safety: entering Planning/Action should not carry previous selections/active units.
    const prevPhaseRef = useRef(gameState.phase);
    useEffect(() => {
        const enteredThinking = gameState.phase === 'thinking' && prevPhaseRef.current !== 'thinking';
        const enteredAction = gameState.phase === 'action' && prevPhaseRef.current !== 'action';
        if (enteredThinking || enteredAction) {
            setTargetMode(null);
            setGameState(prev => {
                let next = prev;
                let changed = false;

                if (prev.selectedUnitId !== null || prev.activeUnitId !== null) {
                    next = { ...next, selectedUnitId: null, activeUnitId: null };
                    changed = true;
                }

                if (enteredThinking) {
                    const hasRoundStartLog = next.logs.some(log =>
                        log.turn === next.turnCount && log.messageKey === 'log_round_start'
                    );
                    if (!hasRoundStartLog) {
                        next = {
                            ...next,
                            logs: [{ turn: next.turnCount, messageKey: 'log_round_start', params: { round: next.turnCount }, type: 'info' as const }, ...next.logs]
                        };
                        changed = true;
                    }
                }

                if (enteredAction) {
                    const hasActionPhaseLog = next.logs.some(log =>
                        log.turn === next.turnCount && log.messageKey === 'log_action_phase'
                    );
                    if (!hasActionPhaseLog) {
                        next = {
                            ...next,
                            logs: [{ turn: next.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...next.logs]
                        };
                        changed = true;
                    }
                }

                return changed ? next : prev;
            });
        }
        prevPhaseRef.current = gameState.phase;
    }, [gameState.phase]);




    const t = useCallback((key: string, params?: Record<string, any>) => {
        const translations = (TRANSLATIONS[language] || {}) as any;
        const fallbackEn = TRANSLATIONS.en as any;
        const fallbackZhTw = TRANSLATIONS.zh_tw as any;
        const fallbackZhCn = TRANSLATIONS.zh_cn as any;
        let text = translations[key]
            ?? fallbackEn[key]
            ?? fallbackZhTw[key]
            ?? fallbackZhCn[key]
            ?? key;
        if (params) {
            text = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match: string, rawKey: string) => {
                const v = params[rawKey];
                if (v === undefined || v === null) return '';

                let strVal = String(v);
                // Auto-translate: if the whole value is a known translation key
                if (translations[strVal] || fallbackEn[strVal] || fallbackZhTw[strVal] || fallbackZhCn[strVal]) {
                    strVal = translations[strVal]
                        ?? fallbackEn[strVal]
                        ?? fallbackZhTw[strVal]
                        ?? fallbackZhCn[strVal]
                        ?? strVal;
                } else {
                    // Translate embedded keys like "unit_general(2,1), unit_maker(1,3)"
                    strVal = strVal.replace(
                        /unit_\w+/g,
                        (match) => translations[match] ?? fallbackEn[match] ?? fallbackZhTw[match] ?? fallbackZhCn[match] ?? match
                    );
                }
                return strVal;
            });
        }
        return text;
    }, [language]);

    const gameStateRef = useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (gameState.gameMode === 'pvp' && gameState.phase === 'placement') {
            placementMinesRef.current = unionPlacementMines(placementMinesRef.current, getSetupMines(gameState.mines));
            return;
        }
        placementMinesRef.current = [];
    }, [gameState.gameMode, gameState.phase, gameState.mines]);

    const emitEvolutionFx = useCallback((owner: PlayerID, unitType: UnitType, branch: 'a' | 'b') => {
        const ownerUnits = gameStateRef.current.players[owner].units;
        const targetUnit = ownerUnits.find(u => u.type === unitType && !u.isDead);
        if (!targetUnit) return;
        const signature = `${owner}|${unitType}|${branch}`;
        lastEvolutionFxEmitRef.current = { signature, ts: Date.now() };
        const nonce = Date.now() + Math.random();
        setEvolutionFxEvent({
            owner,
            unitType,
            unitId: targetUnit.id,
            r: targetUnit.r,
            c: targetUnit.c,
            branch,
            nonce
        });
        if (evolutionFxClearTimerRef.current) {
            clearTimeout(evolutionFxClearTimerRef.current);
        }
        // Keep event alive long enough for React to finish re-rendering the full
        // component tree (GameField → GridCell useEffect). 120ms was too short on
        // busy frames and caused the effect to be cleared before GridCell could
        // read the new nonce, resulting in the upgrade animation being skipped.
        evolutionFxClearTimerRef.current = setTimeout(() => {
            setEvolutionFxEvent(prev => (prev && prev.nonce === nonce ? null : prev));
        }, 600);
    }, []);

    useEffect(() => () => {
        if (evolutionFxClearTimerRef.current) {
            clearTimeout(evolutionFxClearTimerRef.current);
        }
    }, []);

    useEffect(() => {
        const latestLog = gameState.logs[0];
        if (!latestLog || !latestLog.owner) return;

        // When a sandbox downgrade happens, reset the dedup ref so the next
        // upgrade on the same unit/branch/level will correctly fire the effect.
        if (latestLog.messageKey === 'log_devolved') {
            lastEvolutionFxFromLogRef.current = '';
            return;
        }

        if (latestLog.messageKey !== 'log_evolved') return;
        const unitTypeRaw = latestLog.params?.unitType;
        if (!isUnitTypeValue(unitTypeRaw)) return;
        const branchRaw = String(latestLog.params?.branch ?? '').trim().toLowerCase();
        const branch: 'a' | 'b' = branchRaw.startsWith('b') ? 'b' : 'a';
        const signature = `${latestLog.turn}|${latestLog.owner}|${unitTypeRaw}|${branch}|${String(latestLog.params?.level ?? '')}`;
        if (signature === lastEvolutionFxFromLogRef.current) return;
        lastEvolutionFxFromLogRef.current = signature;

        const directSig = `${latestLog.owner}|${unitTypeRaw}|${branch}`;
        const recent = lastEvolutionFxEmitRef.current;
        if (recent && recent.signature === directSig && Date.now() - recent.ts < 700) return;

        emitEvolutionFx(latestLog.owner, unitTypeRaw, branch);
    }, [emitEvolutionFx, gameState.logs]);

    // Reset selected mine type on mount to prevent persistence
    useEffect(() => {
        setSelectedMineType(MineType.NORMAL);
    }, []);

    // Ref to always get latest selectedMineType (avoids stale closure in useCallback)
    const selectedMineTypeRef = useRef(selectedMineType);
    useEffect(() => {
        selectedMineTypeRef.current = selectedMineType;
    }, [selectedMineType]);


    // --- Timer Logic ---
    // --- Timer Logic (Moved to useGameLoop) ---
    // See useGameLoop hook at the bottom of the component

    const playSfx = useCallback((sound: SfxName, cooldownMs: number = 100, volumeMultiplier: number = 1) => {
        if (view !== 'game' || sfxVolume <= 0) return;
        const now = Date.now();
        const lastPlayed = sfxLastPlayedRef.current.get(sound) ?? 0;
        if (cooldownMs > 0 && now - lastPlayed < cooldownMs) return;

        const cache = sfxAudioRef.current;
        let audio = cache.get(sound);
        if (!audio) {
            audio = new Audio(SFX_SOURCE[sound]);
            audio.preload = 'auto';
            cache.set(sound, audio);
        }

        sfxLastPlayedRef.current.set(sound, now);
        audio.currentTime = 0;
        audio.volume = Math.min(1, Math.max(0, sfxVolume * volumeMultiplier));
        audio.play().catch(() => {
            // Browser autoplay policy may block playback before first user interaction.
        });
    }, [view, sfxVolume]);


    const addLog = (messageKey: string, type: GameLog['type'] = 'info', params?: Record<string, any>, owner?: PlayerID) => {
        // Private hint logs should only be generated for local actions, never while replaying remote packets.
        if (applyingRemoteActionRef.current && PRIVATE_HINT_LOG_KEYS.has(messageKey)) {
            return;
        }
        const localActor = (() => {
            const state = gameStateRef.current;
            if (state.gameMode === 'pvp') {
                return isHost ? PlayerID.P1 : PlayerID.P2;
            }
            return state.currentPlayer;
        })();
        const resolvedOwner = owner ?? (PRIVATE_HINT_LOG_KEYS.has(messageKey) ? localActor : undefined);
        let normalizedParams = params;
        if (messageKey === 'log_evol_gen_a_mine_vuln') {
            const incomingStacks = Number(params?.stacks);
            if (!Number.isFinite(incomingStacks)) {
                const unitName = params?.unit;
                const existingStacks = gameStateRef.current.logs
                    .filter(log =>
                        log.messageKey === 'log_evol_gen_a_mine_vuln' &&
                        log.owner === resolvedOwner &&
                        (!unitName || log.params?.unit === unitName)
                    )
                    .map(log => Number(log.params?.stacks))
                    .filter(v => Number.isFinite(v));
                const highestSeen = existingStacks.length > 0 ? Math.max(...existingStacks) : 0;
                const inferredStacks = Math.min(2, Math.max(1, highestSeen + 1));
                normalizedParams = { ...(params ?? {}), stacks: inferredStacks };
            }
        }
        const paramSignature = serializeLogParams(normalizedParams);
        const logSignature = `${messageKey}|${resolvedOwner ?? 'global'}|${paramSignature}`;
        const now = Date.now();
        const lastEmitAt = lastLogEmitRef.current.get(logSignature) ?? 0;
        // Prevent rapid duplicate spam from repeated clicks/network echoes.
        if (now - lastEmitAt < 1200) {
            return;
        }
        setGameState(prev => {
            if (
                messageKey === 'log_mine_limit' &&
                prev.logs.some(log => log.messageKey === 'log_mine_limit')
            ) {
                return prev;
            }

            const latestLog = prev.logs[0];
            if (
                latestLog &&
                latestLog.messageKey === messageKey &&
                latestLog.owner === resolvedOwner &&
                serializeLogParams(latestLog.params) === paramSignature
            ) {
                return prev;
            }

            if (PRIVATE_HINT_LOG_KEYS.has(messageKey)) {
                if (ONCE_PER_TURN_HINT_LOG_KEYS.has(messageKey)) {
                    const existsThisTurn = prev.logs.some(log =>
                        log.turn === prev.turnCount &&
                        log.messageKey === messageKey &&
                        log.owner === resolvedOwner
                    );
                    if (existsThisTurn) {
                        return prev;
                    }
                }

                const existsInCurrentTurn = prev.logs.some(log =>
                    log.turn === prev.turnCount &&
                    log.messageKey === messageKey &&
                    log.owner === resolvedOwner &&
                    serializeLogParams(log.params) === paramSignature
                );
                if (existsInCurrentTurn) {
                    return prev;
                }
            }

            lastLogEmitRef.current.set(logSignature, now);
            return {
                ...prev,
                logs: [{ turn: prev.turnCount, messageKey, params: normalizedParams, type, owner: resolvedOwner }, ...prev.logs].slice(0, 100)
            };
        });
    };

    useEffect(() => {
        if (view !== 'game') return;
        const latestLog = gameState.logs[0];
        if (!latestLog) return;

        const signature = [
            latestLog.turn,
            latestLog.messageKey,
            latestLog.owner ?? 'global',
            latestLog.type,
            serializeLogParams(latestLog.params)
        ].join('|');

        if (lastSfxLogRef.current === signature) return;
        lastSfxLogRef.current = signature;

        const mapped = LOG_SFX_MAP[latestLog.messageKey];
        if (mapped) {
            playSfx(mapped.sound, mapped.cooldownMs ?? 100, mapped.volume ?? 1);
            return;
        }

        if (latestLog.type === 'error') {
            playSfx('error', 250, 0.85);
        }
    }, [gameState.logs, playSfx, view]);

    useEffect(() => {
        if (!gameState.gameOver || !gameState.winner) {
            lastWinnerSfxRef.current = '';
            return;
        }

        const winnerSignature = `${gameState.turnCount}|${gameState.winner}`;
        if (lastWinnerSfxRef.current === winnerSignature) return;
        lastWinnerSfxRef.current = winnerSignature;

        const localPlayer = gameState.gameMode === 'pvp'
            ? (isHost ? PlayerID.P1 : PlayerID.P2)
            : PlayerID.P1;
        playSfx(gameState.winner === localPlayer ? 'victory' : 'defeat', 0, 1);
    }, [gameState.gameMode, gameState.gameOver, gameState.turnCount, gameState.winner, isHost, playSfx]);

    const addVFX = (type: VFXEffect['type'], r: number, c: number, size: VFXEffect['size'] = 'medium') => {
        setGameState(prev => ({
            ...prev,
            vfx: [...prev.vfx, {
                id: `vfx-${Date.now()}-${Math.random()}`,
                type, r, c, size,
                startTime: Date.now()
            }]
        }));
    };

    // VFX Cleanup Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setGameState(prev => {
                if (prev.vfx.length === 0) return prev;
                const filtered = prev.vfx.filter(v => now - v.startTime < 2000);
                if (filtered.length === prev.vfx.length) return prev;
                return { ...prev, vfx: filtered };
            });
        }, 500);
        return () => clearInterval(timer);
    }, []);

    const getUnit = (id: string, state: GameState = gameStateRef.current) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    };

    const handleStartGame = useCallback((mode: 'pvp' | 'pve' | 'sandbox', externalInitialState?: GameState) => {
        setPvpPerspectivePlayer(mode === 'pvp' ? (isHost ? PlayerID.P1 : PlayerID.P2) : null);

        const initialState = externalInitialState || createInitialState(mode);
        placementMinesRef.current = mode === 'pvp' && initialState.phase === 'placement'
            ? getSetupMines(initialState.mines)
            : [];
        setGameState(initialState);
        setView('game');

        setShowGameStartAnimation(true);
        setTargetMode(null);
        setSandboxPos({ x: 0, y: 0 });
        setIsSandboxCollapsed(false);

        // Broadcast start to Guest if we are the Host
        if (mode === 'pvp' && isHost && roomId && !externalInitialState) {
            sendActionPacket({
                type: 'START_GAME',
                matchId: roomId,
                turn: 1,
                payload: {
                    mode: 'pvp',
                    initialState: toSerializableGameState(initialState),
                    allowDevTools: allowDevToolsInPvpRoom
                }
            });
        }

        // Hide animation after 3 seconds
        setTimeout(() => {
            setShowGameStartAnimation(false);
        }, 3000);
    }, [allowDevToolsInPvpRoom, isHost, roomId, sendActionPacket]);

    const handleExitGame = useCallback((origin: 'local' | 'remote' = 'local') => {
        const state = gameStateRef.current;
        if (
            origin === 'local' &&
            state.gameMode === 'pvp' &&
            roomId &&
            isNetworkConnected &&
            !applyingRemoteActionRef.current
        ) {
            sendActionPacket({
                type: 'LEAVE_MATCH',
                matchId: roomId,
                turn: state.turnCount,
                payload: {}
            });
            // Force leave room locally as well, so both sides cannot stay in-match.
            setTimeout(() => disconnect(), 80);
        } else if (state.gameMode === 'pvp') {
            // Remote leave or fallback path: ensure local network session is also closed.
            disconnect();
        }
        setPvpPerspectivePlayer(null);
        setShowDevTools(false);
        setRoomId(null);
        setIsHost(false);
        setView('lobby');
    }, [disconnect, isNetworkConnected, roomId, sendActionPacket]);

    useEffect(() => {
        if (view !== 'game') return;
        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp') return;
        if (isNetworkConnected) return;
        handleExitGame('remote');
    }, [handleExitGame, isNetworkConnected, view]);

    const handleRestart = () => {
        setPvpPerspectivePlayer(gameState.gameMode === 'pvp' ? (isHost ? PlayerID.P1 : PlayerID.P2) : null);
        setGameState(createInitialState(gameState.gameMode));
        setTargetMode(null);
        setAiDecision(null);
        setSandboxPos({ x: 0, y: 0 });
        setIsSandboxCollapsed(false);
        setShowDevTools(false);
    };

    const selectUnitForAI = useCallback((unitId: string) => {
        setGameState(prev => ({ ...prev, selectedUnitId: unitId }));
    }, []);







    // --- Helper: Get display cost for UI ---
    const getDisplayCost = (unit: Unit | null, baseCost: number, state: GameState = gameState, actionType: string = 'move') => {
        return getDisplayCostRaw(unit, baseCost, state, actionType);
    };

    const getAuthoritativeMoveCost = useCallback((unit: Unit, state: GameState): number => {
        const player = state.players[unit.owner];
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;

        let baseCost = UNIT_STATS[unit.type].moveCost;
        if (unit.hasFlag) {
            if (unit.type === UnitType.GENERAL) {
                // B3-1: General flag move cost reduced to 4.
                baseCost = (genLevelB >= 3 && genVariantB === 1)
                    ? 4
                    : UNIT_STATS[UnitType.GENERAL].flagMoveCost;
            } else {
                // B3-1: Any unit carrying flag uses cost 4.
                baseCost = (genLevelB >= 3 && genVariantB === 1) ? 4 : 5;
            }
        } else if (unit.type === UnitType.RANGER && unit.carriedMine) {
            baseCost = 3;
        }

        return getDisplayCost(unit, baseCost, state, 'move');
    }, [getDisplayCost]);

    // Rule 1: Energy Cap Check
    const checkEnergyCap = (unit: Unit, _player: PlayerState, cost: number) => {
        if (!engineCheckEnergyCap(unit, cost)) {
            const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
            addLog('log_energy_cap', 'error', { cap });
            return false;
        }
        return true;
    };

    const spendEnergy = (pid: PlayerID, amount: number) => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                [pid]: {
                    ...prev.players[pid],
                    energy: prev.players[pid].energy - amount
                }
            }
        }));
    };

    const handleHoverCell = useCallback((r: number, c: number | null) => {
        setHoveredPos(c === null ? null : { r, c });
    }, []);

    const resolveLocalPlayer = (state: GameState): PlayerID => {
        if (state.gameMode === 'pvp') {
            return isHost ? PlayerID.P1 : PlayerID.P2;
        }
        return state.currentPlayer;
    };

    const resolveFirstMoverFromBids = useCallback((
        p1Bid: number,
        p2Bid: number,
        turnCount: number
    ): { firstMover: PlayerID; isTie: boolean } => {
        if (p1Bid > p2Bid) {
            return { firstMover: PlayerID.P1, isTie: false };
        }
        if (p2Bid > p1Bid) {
            return { firstMover: PlayerID.P2, isTie: false };
        }

        // Deterministic tie-breaker so host/guest never diverge on currentPlayer.
        const seed = `${roomId ?? 'pvp'}:${turnCount}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) {
            hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
        }
        const firstMover = (hash % 2 === 0) ? PlayerID.P1 : PlayerID.P2;
        return { firstMover, isTie: true };
    }, [roomId]);

    const buildPlacementReadySnapshot = (state: GameState, playerId: PlayerID): ReadySetupMine[] => {
        return getSetupMines(state.mines)
            .filter(m => m.owner === playerId)
            .map(m => ({ r: m.r, c: m.c }));
    };



    const finishPlacementPhase = () => {
        const state = gameStateRef.current;
        const localPlayer = resolveLocalPlayer(state);

        // Prevent repeated calls in PvP if already ready
        if (state.gameMode === 'pvp' && state.pvpReadyState?.[localPlayer]) {
            return;
        }

        // Send ready packet in PvP
        if (state.gameMode === 'pvp' && roomId && isNetworkConnected) {
            const setupMines = buildPlacementReadySnapshot(state, localPlayer);
            sendActionPacket({
                type: 'PLAYER_READY',
                matchId: roomId,
                turn: state.turnCount,
                payload: { playerId: localPlayer, phase: 'placement', setupMines }
            });
        }

        setGameState(prev => {
            const newLogs = upsertPlacementLogs(prev.logs, prev, localPlayer);

            // PvP mode: mark this player as ready, only transition when both are ready
            if (prev.gameMode === 'pvp') {
                const newReadyState = {
                    [PlayerID.P1]: prev.pvpReadyState?.[PlayerID.P1] ?? false,
                    [PlayerID.P2]: prev.pvpReadyState?.[PlayerID.P2] ?? false,
                    [localPlayer]: true,
                };
                const bothReady = newReadyState[PlayerID.P1] && newReadyState[PlayerID.P2];

                if (bothReady) {
                    const stabilizedSetupMines = unionPlacementMines(
                        getSetupMines(prev.mines),
                        placementMinesRef.current
                    );
                    return {
                        ...prev,
                        phase: 'thinking',
                        timeLeft: THINKING_TIMER,
                        mines: [...prev.mines.filter(m => !m.id.startsWith('pm-')), ...stabilizedSetupMines],
                        selectedUnitId: null,
                        targetMode: null,
                        pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
                        pvpEnergyBids: { [PlayerID.P1]: 0, [PlayerID.P2]: 0 },
                        logs: [{ turn: 1, messageKey: 'log_round_start', params: { round: 1 }, type: 'info' as const }, ...newLogs]
                    };
                } else {
                    // Only this player confirmed -> stay in placement, mark ready
                    return {
                        ...prev,
                        pvpReadyState: newReadyState,
                        logs: newLogs,
                    };
                }
            }

            // Non-PvP: immediate transition
            return {
                ...prev,
                phase: 'thinking',
                timeLeft: THINKING_TIMER,
                selectedUnitId: null,
                targetMode: null,
                logs: [{ turn: 1, messageKey: 'log_round_start', params: { round: 1 }, type: 'info' as const }, ...newLogs]
            };
        });
    };

    const applyRadarScans = (state: GameState): Mine[] => {
        const newMines = [...state.mines];
        state.buildings.filter(b => b.type === 'tower').forEach(tower => {
            newMines.forEach((m, idx) => {
                if (Math.abs(m.r - tower.r) <= 1 && Math.abs(m.c - tower.c) <= 1) {
                    if (!m.revealedTo.includes(tower.owner)) {
                        newMines[idx] = { ...m, revealedTo: [...m.revealedTo, tower.owner] };
                    }
                }
            });
        });
        return newMines;
    };

    const startActionPhase = (energyBid: number = 0, playerIdOverride?: PlayerID) => {
        const state = gameStateRef.current;
        const localPlayer = playerIdOverride ?? resolveLocalPlayer(state);
        const localBid = Math.max(0, Math.min(energyBid, state.players[localPlayer].energy));

        // Prevent repeated calls in PvP if already ready
        if (state.gameMode === 'pvp' && state.pvpReadyState?.[localPlayer]) {
            return;
        }

        // Send ready packet in PvP
        if (state.gameMode === 'pvp' && roomId && isNetworkConnected) {
            sendActionPacket({
                type: 'PLAYER_READY',
                matchId: roomId,
                turn: state.turnCount,
                payload: { playerId: localPlayer, phase: 'thinking', energyBid: localBid }
            });
        }

        setGameState(prev => {
            // PvP mode: require both players to confirm
            if (prev.gameMode === 'pvp') {
                const newReadyState = {
                    [PlayerID.P1]: prev.pvpReadyState?.[PlayerID.P1] ?? false,
                    [PlayerID.P2]: prev.pvpReadyState?.[PlayerID.P2] ?? false,
                    [localPlayer]: true,
                };
                const bothReady = newReadyState[PlayerID.P1] && newReadyState[PlayerID.P2];

                if (bothReady) {
                    // Both confirmed -> resolve initiative bid, then transition to action phase
                    const p1Bid = localPlayer === PlayerID.P1
                        ? localBid
                        : (prev.pvpEnergyBids?.[PlayerID.P1] ?? 0);
                    const p2Bid = localPlayer === PlayerID.P2
                        ? localBid
                        : (prev.pvpEnergyBids?.[PlayerID.P2] ?? 0);
                    const { firstMover, isTie } = resolveFirstMoverFromBids(p1Bid, p2Bid, prev.turnCount);
                    const firstMoverLog: import('./types').GameLog = isTie
                        ? { turn: prev.turnCount, messageKey: 'log_first_mover_tie', params: {}, type: 'info' as const }
                        : {
                            turn: prev.turnCount,
                            messageKey: 'log_first_mover',
                            params: { player: firstMover === PlayerID.P1 ? 'P1' : 'P2' },
                            type: 'info' as const
                        };
                    const p1AfterBid = Math.max(0, prev.players[PlayerID.P1].energy - p1Bid);
                    const p2AfterBid = Math.max(0, prev.players[PlayerID.P2].energy - p2Bid);
                    const updatedMines = applyRadarScans(prev);
                    return {
                        ...prev,
                        phase: 'action',
                        timeLeft: TURN_TIMER,
                        currentPlayer: firstMover,
                        selectedUnitId: null,
                        activeUnitId: null,
                        mines: updatedMines,
                        pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
                        pvpEnergyBids: { [PlayerID.P1]: 0, [PlayerID.P2]: 0 },
                        players: {
                            ...prev.players,
                            [PlayerID.P1]: {
                                ...prev.players[PlayerID.P1],
                                energy: p1AfterBid,
                                startOfActionEnergy: p1AfterBid,
                                units: prev.players[PlayerID.P1].units.map(u => ({ ...u, startOfActionEnergy: p1AfterBid }))
                            },
                            [PlayerID.P2]: {
                                ...prev.players[PlayerID.P2],
                                energy: p2AfterBid,
                                startOfActionEnergy: p2AfterBid,
                                units: prev.players[PlayerID.P2].units.map(u => ({ ...u, startOfActionEnergy: p2AfterBid }))
                            }
                        },
                        logs: [firstMoverLog, { turn: prev.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...prev.logs]
                    };
                } else {
                    // Only this player confirmed -> stay in thinking, mark ready + store bid
                    return {
                        ...prev,
                        pvpReadyState: newReadyState,
                        pvpEnergyBids: {
                            [PlayerID.P1]: prev.pvpEnergyBids?.[PlayerID.P1] ?? 0,
                            [PlayerID.P2]: prev.pvpEnergyBids?.[PlayerID.P2] ?? 0,
                            [localPlayer]: localBid,
                        },
                    };
                }
            }

            // Non-PvP: immediate transition
            const updatedMines = applyRadarScans(prev);
            return {
                ...prev,
                phase: 'action',
                timeLeft: TURN_TIMER,
                selectedUnitId: null,
                activeUnitId: null,
                mines: updatedMines,
                players: {
                    ...prev.players,
                    [PlayerID.P1]: {
                        ...prev.players[PlayerID.P1],
                        startOfActionEnergy: prev.players[PlayerID.P1].energy,
                        units: prev.players[PlayerID.P1].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P1].energy }))
                    },
                    [PlayerID.P2]: {
                        ...prev.players[PlayerID.P2],
                        startOfActionEnergy: prev.players[PlayerID.P2].energy,
                        units: prev.players[PlayerID.P2].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P2].energy }))
                    }
                },
                logs: [{ turn: prev.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...prev.logs]
            };
        });
        // Reset targetMode to null when entering action phase
        setTargetMode(null);
    };

    const clearMissMarksImmediatelyAt = (targetR: number, targetC: number, owner?: PlayerID) => {
        flushSync(() => {
            setGameState(prev => {
                const ownerToClear = owner ?? resolveLocalPlayer(prev);
                const filtered = prev.sensorResults.filter(
                    sr => !(sr.kind === 'mark' && sr.owner === ownerToClear && sr.r === targetR && sr.c === targetC && sr.success !== true)
                );
                if (filtered.length === prev.sensorResults.length) return prev;
                return { ...prev, sensorResults: filtered };
            });
        });
    };

    const clearScanMarksAtCells = (
        sensorResults: GameState['sensorResults'],
        cells: Array<{ r: number; c: number }>
    ): GameState['sensorResults'] => {
        if (!cells.length) return sensorResults;
        const keys = new Set(cells.map(cell => `${cell.r},${cell.c}`));
        return sensorResults.filter(sr => !(sr.kind === 'mark' && keys.has(`${sr.r},${sr.c}`)));
    };

    const clearCountMarkersImmediatelyAt = (targetR: number, targetC: number, owner: PlayerID) => {
        flushSync(() => {
            setGameState(prev => {
                const filtered = prev.sensorResults.filter(
                    sr => !((sr.kind ?? 'count') === 'count' && sr.owner === owner && sr.r === targetR && sr.c === targetC)
                );
                if (filtered.length === prev.sensorResults.length) return prev;
                return { ...prev, sensorResults: filtered };
            });
        });
    };

    const handleUnitClick = (unit: Unit) => {
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;
        // Lock human input during AI turn in PvE.
        if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;
        if (state.gameMode === 'pvp' && roomId) {
            const localPlayer = resolveLocalPlayer(state);
            if (state.phase !== 'placement' && state.currentPlayer !== localPlayer) return;
        }

        // Placement Phase Logic for Units
        if (state.phase === 'placement') {
            const actingPlayer = resolveLocalPlayer(state);

            if (unit.owner !== actingPlayer) return;

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            if (state.selectedUnitId) {
                const selected = getUnit(state.selectedUnitId);
                if (selected && selected.owner === unit.owner && selected.id !== unit.id) {
                    // Swap!
                    swapUnits(selected.id, unit.id);
                    return;
                }
            }
            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            return;
        }

        if (state.gameMode === 'pve' && unit.owner === PlayerID.P2 && state.currentPlayer === PlayerID.P1 && targetMode !== 'attack') {
            return;
        }

        if (state.phase === 'thinking') {
            // Planning phase: disable unit selection entirely to avoid carrying pre-selection into action phase.
            if (state.selectedUnitId || state.activeUnitId) {
                setGameState(prev => ({ ...prev, selectedUnitId: null, activeUnitId: null, targetMode: null }));
            }
            setTargetMode(null);
            return;
        }

        if (unit.hasActedThisRound && unit.owner === state.currentPlayer) {
            addLog('log_unit_acted', 'info');
            return;
        }

        if (state.activeUnitId && state.activeUnitId !== unit.id) {
            if (unit.owner === state.currentPlayer) {
                return;
            }
            // Allow attacking enemy units even if another unit is active
            if (unit.owner !== state.currentPlayer && targetMode === 'attack' && state.selectedUnitId) {
                // Continue to attack logic below
            } else {
                return;
            }
        }

        if (unit.owner === state.currentPlayer) {
            if (unit.isDead) return;

            // In action phase, before committing, allow swapping unit order
            if (state.phase === 'action' && !state.activeUnitId && !state.selectedUnitId) {
                const player = state.players[state.currentPlayer];
                const firstAliveId = player.unitDisplayOrder.find(id => {
                    const u = player.units.find(un => un.id === id);
                    return u && !u.isDead && !u.hasActedThisRound;
                });

                // If clicking a unit that is NOT the current first-in-line, just swap and return
                if (firstAliveId && firstAliveId !== unit.id) {
                    swapUnitDisplayOrder(firstAliveId, unit.id);
                    return; // Don't select, just swap
                }
                // If clicking the first-in-line unit, proceed to select it below
            }

            // Disable deselection when clicking the same unit
            if (state.selectedUnitId === unit.id) {
                return;
            }

            // If a unit is already selected, don't allow switching to another unit
            if (state.selectedUnitId) {
                return;
            }

            setGameState(prev => ({ ...prev, selectedUnitId: unit.id }));
            setTargetMode('move');
        } else {
            // General Rule: Cannot select enemy units.
            // Sandbox Exception: You CAN select enemy units to drag them or evolve them!
            if (targetMode === 'attack' && state.selectedUnitId) {
                executeAttackAction(state.selectedUnitId, unit);
            }
        }
    };

    const swapUnits = (id1: string, id2: string) => {
        setGameState(prev => {
            // Determine owner from unit ID
            let owner = PlayerID.P1;
            let p = prev.players[PlayerID.P1];
            let u1Index = p.units.findIndex(u => u.id === id1);

            if (u1Index === -1) {
                owner = PlayerID.P2;
                p = prev.players[PlayerID.P2];
                u1Index = p.units.findIndex(u => u.id === id1);
            }

            if (u1Index === -1) return prev; // Unit 1 not found
            const u2Index = p.units.findIndex(u => u.id === id2); // Unit 2 must be same owner
            if (u2Index === -1) return prev;

            const newUnits = [...p.units];
            const u1 = newUnits[u1Index];
            const u2 = newUnits[u2Index];

            // Swap coords
            const tempR = u1.r;
            const tempC = u1.c;
            newUnits[u1Index] = { ...u1, r: u2.r, c: u2.c };
            newUnits[u2Index] = { ...u2, r: tempR, c: tempC };

            return {
                ...prev,
                selectedUnitId: null,
                players: {
                    ...prev.players,
                    [owner]: { ...p, units: newUnits }
                }
            }
        });
        addLog('log_swap', 'info');

        // Keep remote squad/board preview in sync during placement swaps.
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('swap_units');
        }
    };

    // Swap the display order of units in the squad panel (not board positions)
    const swapUnitDisplayOrder = (id1: string, id2: string) => {
        setGameState(prev => {
            const findOwner = (unitId: string) => {
                if (prev.players[PlayerID.P1].units.some(u => u.id === unitId)) return PlayerID.P1;
                if (prev.players[PlayerID.P2].units.some(u => u.id === unitId)) return PlayerID.P2;
                return null;
            };
            const owner = findOwner(id1) ?? findOwner(id2);
            if (!owner) return prev;

            const p = prev.players[owner];
            const order = [...p.unitDisplayOrder];
            const idx1 = order.indexOf(id1);
            const idx2 = order.indexOf(id2);

            if (idx1 === -1 || idx2 === -1) return prev;

            [order[idx1], order[idx2]] = [order[idx2], order[idx1]];

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [owner]: { ...p, unitDisplayOrder: order }
                }
            };
        });

        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('swap_display_order');
        }
    };




    const handlePlaceTowerAction = (unit: Unit, r: number, c: number) => {
        const swpLevelA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].aVariant;
        const hasMineAtCell = gameState.mines.some(m => m.r === r && m.c === c);

        const baseCost = (swpLevelA === 3 && variantA === 1) ? 5 : 6;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }
        if (hasMineAtCell) {
            addLog('log_space_has_mine', 'error');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
            const p = prev.players[unit.owner];
            const towerLimit = (swpLevelA === 3 && variantA === 1) ? 2 : 1;
            const existingTowers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');

            let filteredBuildings = prev.buildings;
            if (existingTowers.length >= towerLimit) {
                const toRemove = existingTowers[0];
                filteredBuildings = filteredBuildings.filter(b => b.id !== toRemove.id);
            }

            const newBuilding: Building = {
                id: `tower-${unit.owner}-${Date.now()}`,
                type: 'tower',
                owner: unit.owner,
                r, c,
                level: swpLevelA,
                duration: swpLevelA >= 2 ? undefined : 2
            };

            const newMines = prev.mines.map(m => {
                if (Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1) {
                    if (!m.revealedTo.includes(unit.owner)) {
                        return { ...m, revealedTo: [...m.revealedTo, unit.owner] };
                    }
                }
                return m;
            });

            return {
                ...prev,
                buildings: [...filteredBuildings, newBuilding],
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    {
                        turn: prev.turnCount, messageKey: 'log_placed_building', params: {
                            unit: getUnitNameKey(unit.type),
                            type: 'building_tower'
                        }, owner: unit.owner, type: 'move' as const
                    },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('place_tower');
        }
    };

    const handleDetonateTowerAction = (unit: Unit) => {
        const swpLevelA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].aVariant;
        if (swpLevelA !== 3 || variantA !== 2) return;

        const towers = gameState.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
        if (towers.length === 0) return;

        const hasEnemyMineInTowerRange = gameState.mines.some(m =>
            m.owner !== unit.owner &&
            towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
        );
        if (!hasEnemyMineInTowerRange) {
            addLog('log_no_mine', 'info');
            return;
        }

        const cost = 2;
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);
        towers.forEach(t => addVFX('explosion', t.r, t.c, 'large'));
        const minesToBlast = gameState.mines.filter(m =>
            m.owner !== unit.owner &&
            towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
        );
        minesToBlast.forEach(m => addVFX('explosion', m.r, m.c));

        setGameState(prev => {
            const towers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            if (towers.length === 0) return prev;

            // Remove enemy mines (disarm behavior) in 3x3 range of any tower.
            const minesToRemove = new Set(prev.mines.filter(m =>
                m.owner !== unit.owner &&
                towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
            ).map(m => m.id));
            const removedMineCells = prev.mines
                .filter(m => minesToRemove.has(m.id))
                .map(m => ({ r: m.r, c: m.c }));

            const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            let enemyGeneralKilled = false;
            const updatedEnemyUnits = prev.players[enemyId].units.map(u => {
                if (u.isDead) return u;
                const inTowerRange = towers.some(t => Math.abs(u.r - t.r) <= 1 && Math.abs(u.c - t.c) <= 1);
                if (!inTowerRange) return u;

                const detonateDmg = applyFlagAuraDamageReduction(3, u, prev.players[enemyId]).damage;
                const newHp = Math.max(0, u.hp - detonateDmg);
                const isDead = newHp === 0;
                if (isDead && u.type === UnitType.GENERAL) enemyGeneralKilled = true;

                return {
                    ...u,
                    hp: newHp,
                    isDead,
                    respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0
                };
            });

            const remainingBuildings = prev.buildings.filter(b =>
                !(b.owner === unit.owner && b.type === 'tower')
            );

            return {
                ...prev,
                mines: prev.mines.filter(m => !minesToRemove.has(m.id)),
                sensorResults: clearScanMarksAtCells(prev.sensorResults, removedMineCells),
                buildings: remainingBuildings,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    },
                    [enemyId]: {
                        ...prev.players[enemyId],
                        units: updatedEnemyUnits
                    },
                },
                gameOver: enemyGeneralKilled || prev.gameOver,
                winner: enemyGeneralKilled ? unit.owner : prev.winner,
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_swp_detonate', 'mine', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('detonate_tower');
        }
    };



    const lockUnit = (unitId: string) => {
        setGameState(prev => {
            const unit = getUnit(unitId, prev);
            if (!unit) return prev;

            const playerState = prev.players[unit.owner];
            const updatedUnits = playerState.units.map(u =>
                u.id === unitId ? { ...u, startOfActionEnergy: playerState.energy } : u
            );

            return {
                ...prev,
                activeUnitId: unitId,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...playerState,
                        startOfActionEnergy: playerState.energy,
                        units: updatedUnits
                    }
                }
            };
        });
    };



    const handleRangerAction = (subAction: 'pickup' | 'drop') => {
        const state = gameStateRef.current;
        const unitId = state.selectedUnitId;
        if (!unitId) return;
        const unit = getUnit(unitId, state);
        if (!unit || unit.type !== UnitType.RANGER) return;
        const p = state.players[unit.owner];

        if (subAction === 'pickup') {
            const rngLevelB = p.evolutionLevels[UnitType.RANGER].b;
            const pickupRange = rngLevelB >= 1 ? 2 : 0;

            const minesInRange = state.mines.filter(m =>
                (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );

            if (minesInRange.length === 0) {
                addLog('log_no_mine', 'error');
                return;
            }

            if (minesInRange.length === 1 || pickupRange === 0) {
                handlePickupMineAt(unit, minesInRange[0].r, minesInRange[0].c);
            } else {
                setTargetMode('pickup_mine_select');
            }
        } else {
            if (!unit.carriedMine) return;
            const existingMine = state.mines.find(m => m.r === unit.r && m.c === unit.c);
            if (existingMine) {
                addLog('log_space_has_mine', 'info');
                return;
            }
            if (state.cells[unit.r][unit.c].isObstacle) {
                addLog('log_obstacle', 'info');
                return;
            }

            setGameState(prev => {
                const p = prev.players[unit.owner];
                const liveUnit = p.units.find(u => u.id === unit.id);
                if (!liveUnit || !liveUnit.carriedMine) return prev;
                const newUnits = p.units.map(u => u.id === unit.id ? { ...u, carriedMine: null } : u);
                const towerRevealOwners = Array.from(new Set(
                    prev.buildings
                        .filter(b =>
                            b.type === 'tower' &&
                            Math.abs(b.r - liveUnit.r) <= 1 &&
                            Math.abs(b.c - liveUnit.c) <= 1
                        )
                        .map(b => b.owner)
                ));
                const revealedTo = Array.from(new Set([unit.owner, ...towerRevealOwners]));

                const newMine: Mine = {
                    // Preserve mine identity across pickup/drop in the same match.
                    id: liveUnit.carriedMine.id,
                    owner: unit.owner,
                    type: liveUnit.carriedMine.type,
                    r: liveUnit.r,
                    c: liveUnit.c,
                    revealedTo
                };

                return {
                    ...prev,
                    mines: [...prev.mines, newMine],
                    sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r: liveUnit.r, c: liveUnit.c }]),
                    players: {
                        ...prev.players,
                        [unit.owner]: { ...p, units: newUnits }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_place_mine', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
            lockUnit(unit.id);
            if (canBroadcastAction(unit.owner) && roomId) {
                sendGameStateDeferred('ranger_drop_mine');
            }
        }
    };

    const handlePickupMineAt = (unit: Unit, r: number, c: number) => {
        const liveState = gameStateRef.current;
        const liveUnit = getUnit(unit.id, liveState);
        if (!liveUnit || liveUnit.type !== UnitType.RANGER) {
            addLog('log_no_mine', 'error');
            setTargetMode(null);
            return;
        }
        const livePlayer = liveState.players[liveUnit.owner];
        const livePickupRange = livePlayer.evolutionLevels[UnitType.RANGER].b >= 1 ? 2 : 0;
        const liveDist = Math.abs(liveUnit.r - r) + Math.abs(liveUnit.c - c);
        const livePickableAtCell = liveState.mines.some(m =>
            m.r === r &&
            m.c === c &&
            liveDist <= livePickupRange &&
            (m.owner === liveUnit.owner || m.revealedTo.includes(liveUnit.owner))
        );
        if (!livePickableAtCell) {
            addLog('log_no_mine', 'error');
            setTargetMode(null);
            return;
        }

        let pickedMine: Mine | null = null;
        let pickedUnitId: string | null = null;

        setGameState(prev => {
            const owner = unit.owner;
            const p = prev.players[owner];
            const liveUnit = p.units.find(u => u.id === unit.id);
            if (!liveUnit || liveUnit.type !== UnitType.RANGER || liveUnit.carriedMine) return prev;

            const rngLevelB = p.evolutionLevels[UnitType.RANGER].b;
            const pickupRange = rngLevelB >= 1 ? 2 : 0;
            const dist = Math.abs(liveUnit.r - r) + Math.abs(liveUnit.c - c);
            if (dist > pickupRange) return prev;

            const pickableMines = prev.mines.filter(m =>
                m.r === r &&
                m.c === c &&
                (m.owner === owner || m.revealedTo.includes(owner))
            );
            if (pickableMines.length === 0) return prev;

            // Prefer picking own mine when multiple mines are stacked in the same cell.
            const mine = pickableMines.find(m => m.owner === owner) ?? pickableMines[0];
            pickedMine = mine;
            pickedUnitId = liveUnit.id;

            const qStats = { ...p.questStats };
            if (!qStats.rangerMinesMovedThisRound) qStats.rangerMinesMovedThisRound = new Set();
            else qStats.rangerMinesMovedThisRound = new Set(qStats.rangerMinesMovedThisRound);

            if (!qStats.rangerMinesMovedThisRound.has(mine.id)) {
                qStats.rangerMinesMoved += 1;
                qStats.rangerMinesMovedThisRound.add(mine.id);
            }

            const newUnits = p.units.map(u => u.id === liveUnit.id ? { ...u, carriedMine: mine, carriedMineRevealed: false } : u);

            return {
                ...prev,
                mines: prev.mines.filter(m => m.id !== mine.id),
                sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r, c }]),
                players: { ...prev.players, [owner]: { ...p, units: newUnits, questStats: qStats } },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        if (!pickedMine || !pickedUnitId) {
            addLog('log_no_mine', 'error');
            setTargetMode(null);
            return;
        }

        addLog('log_pickup_mine', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        lockUnit(pickedUnitId);
        setTargetMode(null);
        if (canBroadcastAction(unit.owner) && roomId) {
            sendGameStateDeferred('ranger_pickup_mine');
        }
    };

    const handleStealthAction = (
        unitId: string,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) return;
        const stealthCost = 3;
        const isActivatingStealth = !unit.status.isStealthed;
        const player = state.players[unit.owner];

        if (isActivatingStealth) {
            if (player.energy < stealthCost) {
                addLog('log_low_energy', 'info', { cost: stealthCost });
                return;
            }
            if (!checkEnergyCap(unit, player, stealthCost)) {
                return;
            }
        }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const updatedUnits = p.units.map(u => u.id === unitId ? {
                ...u,
                energyUsedThisTurn: isActivatingStealth ? (u.energyUsedThisTurn + stealthCost) : u.energyUsedThisTurn,
                status: { ...u.status, isStealthed: !u.status.isStealthed }
            } : u);

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: isActivatingStealth ? (p.energy - stealthCost) : p.energy,
                        units: updatedUnits
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        if (isActivatingStealth) {
            addLog('log_stealth_activated', 'move', { unit: t(getUnitNameKey(unit.type)) }, unit.owner);
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast) {
            sendGameStateDeferred('stealth_toggle');
        }
    };


    const handlePlaceHubAction = (unit: Unit, r: number, c: number) => {
        const baseCost = 4;
        const cost = getDisplayCost(unit, baseCost, gameState, 'place_hub');
        const hasMineAtCell = gameState.mines.some(m => m.r === r && m.c === c);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }
        if (hasMineAtCell) {
            addLog('log_space_has_mine', 'error');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
            const p = prev.players[unit.owner];
            const filteredBuildings = prev.buildings.filter(b => !(b.owner === unit.owner && b.type === 'hub'));
            const hubLevelA = p.evolutionLevels[UnitType.RANGER].a;
            const hubVariantA = p.evolutionLevels[UnitType.RANGER].aVariant;
            const newBuilding: Building = {
                id: `hub-${unit.owner}-${Date.now()}`,
                type: 'hub',
                owner: unit.owner,
                r, c,
                level: hubLevelA,
                variant: hubVariantA,
                duration: undefined
            };

            return {
                ...prev,
                buildings: [...filteredBuildings, newBuilding],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { unit: getUnitNameKey(unit.type), type: 'building_hub' }, owner: unit.owner, type: 'move' as const },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('place_hub');
        }
    };

    const handleTeleportToHubAction = (unit: Unit) => {
        const hub = gameState.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        if (!hub) return;

        const levelA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].a;
        const variantA = gameState.players[unit.owner].evolutionLevels[UnitType.RANGER].aVariant;

        let cost = 5; // Default for others (A3-2)
        if (unit.type === UnitType.RANGER) {
            if (levelA >= 2) {
                if (levelA === 3 && variantA === 2) cost = 3; // A3-2: Ranger Cost 3
                else cost = 0; // A2: Ranger Cost 0 (Consumable)
            } else {
                cost = 4; // Base Ranger? Or cannot teleport?
                // Actually Base Ranger cannot teleport without Hub.
                // Hub allows teleport.
                // If Level 1 Hub? Can trigger move cost reduction.
                // But Action "Teleport" is A2+.
                // If A1 Ranger tries to teleport? Should fail or not be available?
                // Assuming button only available if valid.
            }
        } else {
            // Non-Ranger
            if (!(levelA === 3 && variantA === 2)) return; // Only A3-2 allows others
            cost = 5;
        }

        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        // Check if hub is blocked by another unit
        const isOccupied = gameState.players[PlayerID.P1].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead) ||
            gameState.players[PlayerID.P2].units.some(u => u.r === hub.r && u.c === hub.c && !u.isDead);

        if (isOccupied && !(hub.r === unit.r && hub.c === unit.c)) {
            addLog('log_unit_on_hub', 'info');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const pId = unit.owner;
            const pState = prev.players[pId];
            const liveUnit = pState.units.find(u => u.id === unit.id);
            const liveHub = prev.buildings.find(b => b.owner === pId && b.type === 'hub');
            if (!liveUnit || !liveHub) return prev;

            // Tier 2: Hub disappears when Ranger teleports. Tier 3.2: Hub persists? 
            // Description indicates the Lv2 Ranger teleport consumes the hub.
            const levelA = pState.evolutionLevels[UnitType.RANGER].a;
            const variantA = pState.evolutionLevels[UnitType.RANGER].aVariant;

            let shouldDestroyHub = true;

            if (levelA === 3 && variantA === 2) {
                shouldDestroyHub = false; // Persistent Hub
            } else if (levelA >= 2 && unit.type === UnitType.RANGER) {
                shouldDestroyHub = true; // Consumable free teleport
            }

            const newBuildings = shouldDestroyHub
                ? prev.buildings.filter(b => !(b.owner === pId && b.type === 'hub'))
                : prev.buildings;

            // Teleporting onto enemy mines should trigger mine interaction the same way as normal movement.
            const proximityNukeIndex = prev.mines.findIndex(m =>
                m.type === MineType.NUKE &&
                m.owner !== pId &&
                Math.abs(m.r - liveHub.r) <= 1 &&
                Math.abs(m.c - liveHub.c) <= 1 &&
                Math.max(Math.abs(m.r - liveUnit.r), Math.abs(m.c - liveUnit.c)) > 1
            );
            let triggeredMineIndex = -1;
            if (proximityNukeIndex !== -1) {
                triggeredMineIndex = proximityNukeIndex;
            } else {
                triggeredMineIndex = prev.mines.findIndex(m =>
                    m.r === liveHub.r &&
                    m.c === liveHub.c &&
                    shouldTriggerMine(liveUnit, m, pState)
                );
            }

            const mineResult = calculateMineInteraction(
                liveUnit,
                prev.mines,
                liveHub.r,
                liveHub.c,
                pState,
                liveUnit.r,
                liveUnit.c,
                prev.isGodMode ?? false
            );

            const mineTriggered = mineResult.triggered || mineResult.isNukeTriggered;
            const mineDamage = mineTriggered ? mineResult.damage : 0;
            const updatedStatus = mineTriggered
                ? { ...liveUnit.status, ...mineResult.statusUpdates }
                : liveUnit.status;
            const newSmokes = mineResult.createdSmokes.length > 0
                ? [...prev.smokes, ...mineResult.createdSmokes]
                : prev.smokes;
            const newMines = (mineTriggered && triggeredMineIndex !== -1)
                ? prev.mines.filter((_, idx) => idx !== triggeredMineIndex)
                : prev.mines;

            const newHp = Math.max(0, liveUnit.hp - mineDamage);
            const isDead = newHp <= 0;
            const respawnTimer = (isDead && liveUnit.type !== UnitType.GENERAL)
                ? (prev.turnCount <= 10 ? 2 : 3)
                : 0;
            const generalDied = isDead && liveUnit.type === UnitType.GENERAL;

            return {
                ...prev,
                mines: newMines,
                smokes: newSmokes,
                buildings: newBuildings,
                players: {
                    ...prev.players,
                    [pId]: {
                        ...pState,
                        flagPosition: liveUnit.hasFlag ? { r: liveHub.r, c: liveHub.c } : pState.flagPosition,
                        units: pState.units.map(u => u.id === unit.id ? {
                            ...u,
                            r: liveHub.r,
                            c: liveHub.c,
                            hp: newHp,
                            isDead,
                            respawnTimer,
                            status: updatedStatus,
                            carriedMine: u.carriedMine ? { ...u.carriedMine, r: liveHub.r, c: liveHub.c } : u.carriedMine,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost
                        } : u)
                    }
                },
                gameOver: generalDied || prev.gameOver,
                winner: generalDied ? (pId === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1) : prev.winner,
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('teleport_hub');
        }
    };

    const handleThrowMineAction = (unit: Unit, r: number, c: number) => {
        if (!unit.carriedMine) return;
        const thrownMineType = unit.carriedMine.type;
        const baseCost = 5;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        const range = 2; // Manhattan Distance 2
        const dist = Math.abs(unit.r - r) + Math.abs(unit.c - c);
        if (dist > range) {
            addLog('log_scan_range', 'info');
            return;
        }

        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const hasEnemyUnitAtTarget = gameState.players[enemyId].units
            .some(u => u.r === r && u.c === c && !u.isDead);
        if (!hasEnemyUnitAtTarget) {
            addLog('log_throw_requires_enemy', 'error');
            return;
        }
        const targetUnitForLog = gameState.players[enemyId].units.find(u => !u.isDead && u.r === r && u.c === c);

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        const mineBaseDamageByType: Record<MineType, number> = {
            [MineType.NORMAL]: MINE_DAMAGE,
            [MineType.SLOW]: 4,
            [MineType.SMOKE]: 7,
            [MineType.CHAIN]: 6,
            [MineType.NUKE]: 12
        };

        const pendingLogs: Array<{ key: string; type: GameLog['type']; params?: Record<string, any>; owner?: PlayerID }> = [];
        let didApplyThrow = false;

        setGameState(prev => {
            const ownerId = unit.owner;
            const enemyId = ownerId === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const ownerState = prev.players[ownerId];
            const liveThrower = ownerState.units.find(u => u.id === unit.id);
            if (!liveThrower || !liveThrower.carriedMine) return prev;

            const liveTarget = prev.players[enemyId].units.find(u => !u.isDead && u.r === r && u.c === c);
            if (!liveTarget) return prev;
            didApplyThrow = true;

            const thrownMine = liveThrower.carriedMine;
            const newEnergy = ownerState.energy - cost;

            let nextPlayers = {
                ...prev.players,
                [ownerId]: {
                    ...ownerState,
                    energy: newEnergy,
                    startOfActionEnergy: newEnergy,
                    units: ownerState.units.map(u => u.id === liveThrower.id ? {
                        ...u,
                        carriedMine: null,
                        energyUsedThisTurn: u.energyUsedThisTurn + cost,
                        startOfActionEnergy: u.energyUsedThisTurn === 0 ? newEnergy : u.startOfActionEnergy,
                    } : u)
                }
            };
            let nextMines = [...prev.mines];
            let nextBuildings = [...prev.buildings];
            let nextSmokes = [...prev.smokes];

            const applyDamageToUnit = (pid: PlayerID, unitId: string, baseDmg: number, hitR: number, hitC: number) => {
                const targetPlayer = nextPlayers[pid];
                const targetUnit = targetPlayer.units.find(u => u.id === unitId);
                if (!targetUnit || targetUnit.isDead) return 0;
                const dmg = applyFlagAuraDamageReduction(baseDmg, targetUnit, targetPlayer, { r: hitR, c: hitC }).damage;
                const newHp = Math.max(0, targetUnit.hp - dmg);
                const isDead = newHp === 0;
                nextPlayers = {
                    ...nextPlayers,
                    [pid]: {
                        ...targetPlayer,
                        units: targetPlayer.units.map(u => u.id === unitId ? {
                            ...u,
                            hp: newHp,
                            isDead,
                            respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : u.respawnTimer
                        } : u)
                    }
                };
                return dmg;
            };

            const primaryBase = Math.floor((mineBaseDamageByType[thrownMine.type] ?? MINE_DAMAGE) * 0.5);
            const primaryDmg = applyDamageToUnit(enemyId, liveTarget.id, primaryBase, r, c);
            pendingLogs.push({
                key: 'log_hit_mine',
                type: 'mine',
                params: { unit: t(getUnitNameKey(liveTarget.type)), dmg: primaryDmg },
                owner: enemyId
            });

            if (thrownMine.type === MineType.SLOW) {
                const targetPlayer = nextPlayers[enemyId];
                nextPlayers = {
                    ...nextPlayers,
                    [enemyId]: {
                        ...targetPlayer,
                        units: targetPlayer.units.map(u => u.id === liveTarget.id ? {
                            ...u,
                            status: {
                                ...u.status,
                                moveCostDebuff: Math.max(u.status.moveCostDebuff ?? 0, 2),
                                moveCostDebuffDuration: Math.max(u.status.moveCostDebuffDuration ?? 0, 2)
                            }
                        } : u)
                    }
                };
                pendingLogs.push({ key: 'log_heavy_steps', type: 'evolution', owner: enemyId });
            } else if (thrownMine.type === MineType.SMOKE) {
                const smokeIdBase = `throw-smoke-${Date.now()}`;
                const boardRows = prev.cells.length;
                const boardCols = prev.cells[0]?.length ?? 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < boardRows && nc >= 0 && nc < boardCols) {
                            nextSmokes.push({
                                id: `${smokeIdBase}-${dr}-${dc}`,
                                r: nr,
                                c: nc,
                                owner: ownerId,
                                duration: 3
                            });
                        }
                    }
                }
                pendingLogs.push({ key: 'log_smoke_deployed', type: 'error', params: { r: r + 1, c: c + 1 } });
            } else if (thrownMine.type === MineType.CHAIN) {
                const normalMinesInRange = nextMines.filter(m =>
                    m.type === MineType.NORMAL &&
                    m.owner === ownerId &&
                    Math.abs(m.r - r) <= 2 &&
                    Math.abs(m.c - c) <= 2
                );
                const enemyUnits = nextPlayers[enemyId].units.filter(u => !u.isDead);
                normalMinesInRange.forEach(nm => {
                    enemyUnits.forEach(u => {
                        if (Math.abs(u.r - nm.r) + Math.abs(u.c - nm.c) <= 2) {
                            const aoeDmg = applyDamageToUnit(enemyId, u.id, Math.floor(8 * 0.5), u.r, u.c);
                            pendingLogs.push({
                                key: 'log_chain_aoe',
                                type: 'mine',
                                params: { unit: t(getUnitNameKey(u.type)), dmg: aoeDmg },
                                owner: enemyId
                            });
                        }
                    });
                });
                nextMines = nextMines.filter(m => !normalMinesInRange.some(nm => nm.id === m.id));
                if (normalMinesInRange.length > 0) {
                    pendingLogs.push({ key: 'log_evol_mkr_chain', type: 'mine', params: { r: r + 1, c: c + 1 }, owner: ownerId });
                }
            } else if (thrownMine.type === MineType.NUKE) {
                const inBlast = (rr: number, cc: number) => (Math.abs(rr - r) + Math.abs(cc - c)) <= 2;
                nextMines = nextMines.filter(m => m.owner === ownerId || !inBlast(m.r, m.c));
                nextBuildings = nextBuildings.filter(b => b.owner === ownerId || !inBlast(b.r, b.c));
                [PlayerID.P1, PlayerID.P2].forEach(pid => {
                    nextPlayers[pid].units
                        .filter(u => !u.isDead && u.id !== liveTarget.id && inBlast(u.r, u.c))
                        .forEach(u => {
                            const baseBlastDmg = pid === ownerId ? 3 : 6;
                            const blastDmg = applyDamageToUnit(pid, u.id, baseBlastDmg, u.r, u.c);
                            pendingLogs.push({
                                key: 'log_evol_nuke_blast_hit',
                                type: 'combat',
                                params: { unit: t(getUnitNameKey(u.type)), dmg: blastDmg },
                                owner: ownerId
                            });
                        });
                });
            }

            return {
                ...prev,
                activeUnitId: liveThrower.id,
                players: nextPlayers,
                mines: nextMines,
                buildings: nextBuildings,
                smokes: nextSmokes,
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        if (!didApplyThrow) return;
        addLog('log_throw_mine', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        pendingLogs.forEach((entry) => addLog(entry.key, entry.type, entry.params, entry.owner));
        setTargetMode(null);
        if (canBroadcastAction(unit.owner) && roomId) {
            sendGameStateDeferred('throw_mine');
        }
    };

    const handlePlaceFactoryAction = (unit: Unit, r: number, c: number) => {
        const baseCost = 6;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        const hasMineAtCell = gameState.mines.some(m => m.r === r && m.c === c);
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (unit.r !== r || unit.c !== c) {
            addLog('log_maker_range', 'info');
            return;
        }
        if (hasMineAtCell) {
            addLog('log_space_has_mine', 'error');
            return;
        }

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        setGameState(prev => {
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
            const p = prev.players[unit.owner];
            const mkrLevelB = p.evolutionLevels[UnitType.MAKER].b;
            const mkrVariantB = p.evolutionLevels[UnitType.MAKER].bVariant;
            const factoryLimit = (mkrLevelB === 3 && mkrVariantB === 2) ? 2 : 1;

            let existingFactories = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
            if (existingFactories.length >= factoryLimit) {
                existingFactories.shift();
            }


            const newFactory: Building = {
                id: `factory-${unit.owner}-${Date.now()}`,
                type: 'factory',
                owner: unit.owner,
                r, c,
                level: mkrLevelB,
                duration: undefined
            };

            return {
                ...prev,
                buildings: [...prev.buildings.filter(b => b.type !== 'factory' || b.owner !== unit.owner || existingFactories.find(ef => ef.id === b.id)), newFactory],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id ? {
                            ...u,
                            energyUsedThisTurn: u.energyUsedThisTurn + cost,
                            isLocked: true
                        } : u)
                    }
                },
                logs: [
                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { unit: getUnitNameKey(unit.type), type: 'building_factory' }, owner: unit.owner, type: 'move' as const },
                    ...prev.logs
                ],
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('place_factory');
        }
    };

    const handleDisarmAction = (unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const defLevelB = state.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;

        const enemyMineAtLocation = state.mines.find(m =>
            m.r === r && m.c === c && m.owner !== unit.owner
        );

        // 1. Identify Target & Action Type
        // Mine Priority
        const revealedMineIndex = state.mines.findIndex(m =>
            m.r === r && m.c === c && m.owner !== unit.owner && m.revealedTo.includes(unit.owner)
        );
        // Building Priority (if no mine or fallback)
        const buildingIndex = state.buildings.findIndex(b => b.r === r && b.c === c && b.owner !== unit.owner);

        let actionType: 'mine' | 'building' | null = null;
        if (revealedMineIndex !== -1) {
            actionType = 'mine';
        } else if (buildingIndex !== -1) {
            actionType = 'building';
        }

        if (!actionType) {
            if (enemyMineAtLocation && !enemyMineAtLocation.revealedTo.includes(unit.owner)) {
                addLog('log_mine_not_revealed', 'info');
            } else {
                addLog('log_no_mine', 'info');
            }
            return;
        }

        // 2. Range & Cost Check
        const dr = Math.abs(unit.r - r);
        const dc = Math.abs(unit.c - c);
        const chebyshevDist = Math.max(dr, dc);
        let baseCost = 2;
        let inRange = false;

        if (actionType === 'mine') {
            const stats = UNIT_STATS[unit.type] as any;
            baseCost = stats.disarmCost || 2;

            // Defuser ranges
            if (unit.type === UnitType.DEFUSER) {
                const range = (defLevelB >= 1) ? 3 : 2;
                const dr = Math.abs(unit.r - r);
                const dc = Math.abs(unit.c - c);
                inRange = (dr + dc) <= range;
            } else {
                // Non-Defuser: Range 0 (must be on top)
                inRange = (chebyshevDist === 0);
            }
        } else {
            // Building Dismantle
            baseCost = 2; // Fixed cost for dismantling buildings
            inRange = (chebyshevDist === 0); // Must be standing on it
        }

        if (!inRange) {
            addLog('log_disarm_range', 'info');
            return;
        }

        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);

        // 3. Energy Check
        if (state.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }
        if (!checkEnergyCap(unit, state.players[unit.owner], cost)) return;

        // 4. Action Execution — BUG-1 修復：合併為單一 atomic setGameState

        if (actionType === 'mine') {
            setGameState(prev => {
                const p = prev.players[unit.owner];
                const newEnergy = p.energy - cost;
                const newMines = prev.mines.filter((_, idx) => idx !== revealedMineIndex);
                const qStats = { ...p.questStats, defuserMinesDisarmed: p.questStats.defuserMinesDisarmed + 1 };
                return {
                    ...prev,
                    mines: newMines,
                    sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r, c }]),
                    activeUnitId: unit.id,
                    players: {
                        ...prev.players,
                        [unit.owner]: {
                            ...p,
                            energy: newEnergy,
                            questStats: qStats,
                            units: p.units.map(u => u.id === unit.id ? {
                                ...u,
                                energyUsedThisTurn: u.energyUsedThisTurn + cost,
                                startOfActionEnergy: u.energyUsedThisTurn === 0 ? newEnergy : u.startOfActionEnergy,
                            } : u)
                        }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_mine_disarmed', 'mine', { r: r + 1, c: c + 1 }, unit.owner);
        } else {
            setGameState(prev => {
                const p = prev.players[unit.owner];
                const newEnergy = p.energy - cost;
                const newBuildings = prev.buildings.filter((_, idx) => idx !== buildingIndex);
                return {
                    ...prev,
                    buildings: newBuildings,
                    activeUnitId: unit.id,
                    players: {
                        ...prev.players,
                        [unit.owner]: {
                            ...p,
                            energy: newEnergy,
                            units: p.units.map(u => u.id === unit.id ? {
                                ...u,
                                energyUsedThisTurn: u.energyUsedThisTurn + cost,
                                startOfActionEnergy: u.energyUsedThisTurn === 0 ? newEnergy : u.startOfActionEnergy,
                            } : u)
                        }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            });
            addLog('log_building_dismantled', 'info', { r: r + 1, c: c + 1 }, unit.owner);
        }
        setTargetMode(null);
    };

    const handleMoveEnemyMineAction = (unit: Unit, fromR: number, fromC: number, toR: number, toC: number) => {
        const defLevelB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;
        const variantB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].bVariant;
        if (defLevelB < 2) return;

        const isVariantDamage = (defLevelB === 3 && variantB === 2);
        const cost = isVariantDamage ? 5 : 2;
        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const enemyAtTarget = gameState.players[enemyId].units.find(u => u.r === toR && u.c === toC && !u.isDead);
        const unitAtTarget = [...gameState.players[PlayerID.P1].units, ...gameState.players[PlayerID.P2].units]
            .find(u => u.r === toR && u.c === toC && !u.isDead);
        const mineAtTarget = gameState.mines.find(m => m.r === toR && m.c === toC);
        const buildingAtTarget = gameState.buildings.find(b => b.r === toR && b.c === toC);
        const cellAtTarget = gameState.cells[toR]?.[toC];
        const canDamageEnemyUnit = isVariantDamage && !!enemyAtTarget;
        const hasBlockingUnit = !!unitAtTarget && !canDamageEnemyUnit;

        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        // Must be in Diamond Range (Manhattan distance <= 2)
        const dr = Math.abs(unit.r - fromR);
        const dc = Math.abs(unit.c - fromC);
        if (dr + dc > 2) return;

        // Target must be in range too
        const tr = Math.abs(unit.r - toR);
        const tc = Math.abs(unit.c - toC);
        if (tr + tc > 2) return;
        if (!cellAtTarget || cellAtTarget.isObstacle || buildingAtTarget || mineAtTarget || hasBlockingUnit) return;

        const mineIndex = gameState.mines.findIndex(m =>
            m.r === fromR &&
            m.c === fromC &&
            m.owner !== unit.owner &&
            m.revealedTo.includes(unit.owner)
        );
        if (mineIndex === -1) return;

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const mine = prev.mines[mineIndex];
            const newMines = [...prev.mines];

            // Check if moving to enemy unit for damage
            const enemyAtTarget = prev.players[enemyId].units.find(u => u.r === toR && u.c === toC && !u.isDead);

            if (isVariantDamage && enemyAtTarget) {
                // Damage Logic
                const dmg = applyFlagAuraDamageReduction(
                    Math.floor(MINE_DAMAGE * 0.4),
                    enemyAtTarget,
                    prev.players[enemyId]
                ).damage;
                const newHp = Math.max(0, enemyAtTarget.hp - dmg);
                const isDead = newHp === 0;
                let respawnTimer = 0;
                if (isDead && enemyAtTarget.type !== UnitType.GENERAL) {
                    respawnTimer = prev.turnCount <= 10 ? 2 : 3;
                }

                // Add Damage Log
                addLog('log_evol_def_move_mine_skill_damage', 'combat', { unit: t(getUnitNameKey(enemyAtTarget.type)), dmg }, unit.owner);

                return {
                    ...prev,
                    mines: newMines.filter((_, i) => i !== mineIndex),
                    sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r: fromR, c: fromC }, { r: toR, c: toC }]),
                    players: {
                        ...prev.players,
                        [enemyId]: {
                            ...prev.players[enemyId],
                            units: prev.players[enemyId].units.map(u => u.id === enemyAtTarget.id ? { ...u, hp: newHp, isDead, respawnTimer } : u)
                        },
                        [unit.owner]: {
                            ...prev.players[unit.owner],
                            units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                        }
                    },
                    lastActionTime: Date.now(),
                    isTimeFrozen: true
                };
            }

            // Regular Move
            newMines[mineIndex] = { ...mine, r: toR, c: toC };
            return {
                ...prev,
                mines: newMines,
                sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r: fromR, c: fromC }, { r: toR, c: toC }]),
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_def_move_mine', 'move', undefined, unit.owner);
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('move_enemy_mine');
        }
    };

    const handleConvertEnemyMineAction = (unit: Unit, r: number, c: number) => {
        const defLevelB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].b;
        const variantB = gameState.players[unit.owner].evolutionLevels[UnitType.DEFUSER].bVariant;
        if (defLevelB !== 3 || variantB !== 1) return;

        const cost = 5;
        if (gameState.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        const mineIndex = gameState.mines.findIndex(m =>
            m.r === r &&
            m.c === c &&
            m.owner !== unit.owner &&
            m.revealedTo.includes(unit.owner)
        );
        if (mineIndex === -1) return;

        // Range Check: Manhattan distance <= 2
        const dr = Math.abs(unit.r - r);
        const dc = Math.abs(unit.c - c);
        if (dr + dc > 2) return;

        if (!checkEnergyCap(unit, gameState.players[unit.owner], cost)) return;

        // Mine Limit Check (5 + 1 Logic)
        const ownMinesCount = gameState.mines.filter(m => m.owner === unit.owner).length;
        const player = gameState.players[unit.owner];
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;
        const factories = gameState.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const maxPlacedLimit = (mkrLevelB === 3) ? (mkrVariantB === 2 ? 5 + factories.length * 2 : 8) : 5 + mkrLevelB;
        if (ownMinesCount >= maxPlacedLimit + 1) {
            addLog('log_max_mines', 'error');
            return;
        }

        spendEnergy(unit.owner, cost);
        lockUnit(unit.id);

        setGameState(prev => {
            const mine = prev.mines[mineIndex];
            const newMines = [...prev.mines];
            newMines[mineIndex] = { ...mine, owner: unit.owner, revealedTo: [unit.owner], isConverted: true };

            return {
                ...prev,
                mines: newMines,
                sensorResults: clearScanMarksAtCells(prev.sensorResults, [{ r, c }]),
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...prev.players[unit.owner],
                        units: prev.players[unit.owner].units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_evol_def_convert_mine', 'mine', { r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
        if (!applyingRemoteActionRef.current && roomId && isNetworkConnected) {
            sendGameStateDeferred('convert_enemy_mine');
        }
    };



    const handlePause = () => {
        setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    };

    // --- Background Music Control ---
    useEffect(() => {
        if (!audioRef.current) return;

        if (view === 'game') {
            if (gameState.isPaused || musicVolume === 0) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked, user can click to start
                });
            }
        } else if (view === 'lobby') {
            // Play music in lobby
            if (musicVolume === 0) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked, user can click to start
                });
            }
        }
    }, [gameState.isPaused, musicVolume, view]);

    // --- Initialize Background Music ---
    useEffect(() => {
        if (!audioRef.current) return;

        audioRef.current.loop = true;
        audioRef.current.volume = musicVolume;

        if (musicVolume > 0) {
            if (view === 'game' && !gameState.isPaused) {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked
                });
            } else if (view === 'lobby') {
                audioRef.current.play().catch(() => {
                    // Autoplay might be blocked
                });
            }
        }
    }, [view, musicVolume, gameState.isPaused]);

    // --- Keyboard Control for Unit Selection (Q, W, E, R, T) ---
    // --- Keyboard Control for Unit Selection (Moved to useGameLoop) ---


    // --- Helper: Calculate button index for action buttons ---
    const getActionButtonIndex = (
        actionType: string,
        unit: Unit | null | undefined,
        state: GameState = gameState
    ): number => {
        if (!unit) return -1;

        let index = 0;

        // Button 1: Move (always first)
        if (actionType === 'move') return 1;
        index = 2;

        const player = state.players[unit.owner];

        // Button 2: Placement skills (if available)
        const canPlaceTower = unit.type === UnitType.MINESWEEPER && player.evolutionLevels[UnitType.MINESWEEPER].a >= 1;
        const canPlaceFactory = unit.type === UnitType.MAKER && player.evolutionLevels[UnitType.MAKER].b >= 1;
        const canPlaceHub = unit.type === UnitType.RANGER && player.evolutionLevels[UnitType.RANGER].a >= 1;

        if (canPlaceTower || canPlaceFactory || canPlaceHub) {
            if (actionType === 'place_tower' || actionType === 'place_factory' || actionType === 'place_hub') return index;
            index++;
        }

        // --- Universal Dismantle (If on enemy building) ---
        const isOnEnemyBuilding = state.buildings.some(b => b.r === unit.r && b.c === unit.c && b.owner !== unit.owner);
        if (isOnEnemyBuilding) {
            if (actionType === 'custom_dismantle') return index;
            index++;
        }

        // Button 3+: Unit-specific actions
        if (unit.type === UnitType.GENERAL) {
            const genLevelA = player.evolutionLevels[UnitType.GENERAL].a;
            const canAttack = !unit.hasFlag || genLevelA >= 3;

            if (canAttack) {
                if (actionType === 'attack') return index;
                index++;
            }
        } else if (unit.type === UnitType.MINESWEEPER) {
            if (actionType === 'scan') return index;
            index++;
            // Sensor Scan (Path B)
            const swpLevelB = player.evolutionLevels[UnitType.MINESWEEPER].b;
            if (swpLevelB >= 1) {
                if (actionType === 'sensor_scan') return index;
                index++;
            }
            // Detonate Tower (Path A 3-2)
            const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
            const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
            const hasTower = state.buildings.some(b => b.owner === unit.owner && b.type === 'tower');
            if (swpLevelA === 3 && swpVariantA === 2 && hasTower) {
                if (actionType === 'detonate_tower') return index;
                index++;
            }
        } else if (unit.type === UnitType.MAKER) {
            if (actionType === 'place_mine') return index;
            index++;
        } else if (unit.type === UnitType.RANGER) {
            const rngLevelB = player.evolutionLevels[UnitType.RANGER].b;
            const pickupRange = rngLevelB >= 1 ? 2 : 0;
            const mineInRange = state.mines.find(m =>
                (Math.abs(m.r - unit.r) + Math.abs(m.c - unit.c) <= pickupRange) &&
                (m.owner === unit.owner || m.revealedTo.includes(unit.owner))
            );
            if (!unit.carriedMine && mineInRange) {
                if (actionType === 'pickup_mine') return index;
                index++;
            }

            // Ghost Steps:
            // - B2 / B3-2: active stealth toggle
            // - B3-1: passive permanent stealth, no toggle action
            const isB31 = rngLevelB >= 3 && player.evolutionLevels[UnitType.RANGER].bVariant === 1;
            if (rngLevelB >= 2 && !isB31) {
                if (actionType === 'stealth') return index;
                index++;
            }

            if (unit.carriedMine) {
                if (actionType === 'throw_mine') return index;
                index++;
                if (actionType === 'drop_mine') return index;
                index++;
            }
        } else if (unit.type === UnitType.DEFUSER) {
            if (actionType === 'disarm') return index;
            index++;
            const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
            if (defLevelB >= 2) {
                if (actionType === 'move_mine' || actionType === 'move_mine_start' || actionType === 'move_mine_end') return index;
                index++;
            }
            if (defLevelB === 3 && player.evolutionLevels[UnitType.DEFUSER].bVariant === 1) {
                if (actionType === 'convert_mine') return index;
                index++;
            }
        }

        // --- Teleport Action (Moved After unit-specific skills) ---
        const rangerLevelA = player.evolutionLevels[UnitType.RANGER].a;
        const rangerVariantA = player.evolutionLevels[UnitType.RANGER].aVariant;
        const hasHub = state.buildings.some(b => b.owner === unit.owner && b.type === 'hub');
        const canTeleport = ((unit.type === UnitType.RANGER && rangerLevelA >= 2) || (rangerLevelA === 3 && rangerVariantA === 2)) && hasHub;
        if (canTeleport) {
            if (actionType === 'teleport') return index;
            index++;
        }

        // Global Pickup/Drop Action (for Flag)
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;
        const canCarryFlag = unit.type === UnitType.GENERAL || (genLevelB >= 3 && genVariantB === 1);
        const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;
        if (canCarryFlag) {
            if (!unit.hasFlag && isAtFlag) {
                if (actionType === 'pickup_flag') return index;
                index++;
            }
            if (unit.hasFlag) {
                if (actionType === 'drop_flag') return index;
                index++;
            }
        }

        // Flag pickup/drop for non-General units (when Gen B Level 3+)
        if (unit.type !== UnitType.GENERAL) {
            const player = state.players[unit.owner];
            const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
            const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;
            const canCarry = genLevelB >= 3 && genVariantB === 1;
            const isAtFlag = unit.r === player.flagPosition.r && unit.c === player.flagPosition.c;

            if (canCarry) {
                if (!unit.hasFlag && isAtFlag) {
                    if (actionType === 'pickup_flag') return index;
                    index++;
                }
                if (unit.hasFlag) {
                    if (actionType === 'drop_flag') return index;
                    index++;
                }
            }
        }

        // Evolution buttons - no longer need hotkeys (moved to the right)
        if (actionType === 'end_turn') {
            // Evolution buttons are now after end_turn and don't have hotkeys
            // So we don't count them
            return index;
        }

        return -1;
    };



    const getEvolutionButtonStartIndex = (unit: Unit | null | undefined): number => {
        if (!unit) return -1;
        const keys = ['evolve_a_1', 'evolve_a', 'evolve_a_2', 'evolve_b_1', 'evolve_b', 'evolve_b_2'];
        for (const key of keys) {
            const idx = getActionButtonIndex(key, unit);
            if (idx > 0) return idx;
        }
        return -1; // Should not happen if evolution is showing
    };

    // --- Keyboard Control for Action Selection (Moved to useGameLoop) ---


    // --- Keyboard Control for Movement (Moved to useGameLoop) ---


    // --- Keyboard Control for Evolution Tree (Moved to useGameLoop) ---






    /*
    // Apply Reflection Damage (Defuser A3-1)
    if (reflectDmg > 0) {
        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const enemyState = nextStatePlayers[enemyId];
        if (enemyState.units.length > 0) {
            // Find lowest HP living enemy
            const livingEnemies = enemyState.units.filter(u => !u.isDead);
            if (livingEnemies.length > 0) {
                // Sort by HP, then ID (stability)
                livingEnemies.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
                const target = livingEnemies[0];
     
                const newEnemyHp = Math.max(0, target.hp - reflectDmg);
                const isEnemyDead = newEnemyHp === 0;
                let respawnTimer = 0;
                if (isEnemyDead && target.type !== UnitType.GENERAL) {
                    respawnTimer = nextTurn <= 10 ? 2 : 3;
                }
     
                // Update Enemy
                nextStatePlayers[enemyId] = {
                    ...enemyState,
                    units: enemyState.units.map(u => u.id === target.id ? { ...u, hp: newEnemyHp, isDead: isEnemyDead, respawnTimer } : u)
                };
     
                // Add Log
                newLogs.unshift({
                    turn: nextTurn,
                    messageKey: 'log_evol_def_reflect_hit', // Make sure this key exists or use generic
                    params: { unit: t(getUnitNameKey(target.type)), dmg: reflectDmg },
                    type: 'combat' as const,
                    owner: unit.owner
                });
            }
        }
    }
     
    // Apply Unit Update (HP, MaxHP, Position, Energy)
    const pState = nextStatePlayers[unit.owner];
    nextStatePlayers[unit.owner] = {
        ...pState,
        units: pState.units.map(u => u.id === unit.id ? {
            ...u,
            r, c,
            hp: newHp,
            maxHp: newMaxHp, // Update MaxHP
            isDead,
            energyUsedThisTurn: u.energyUsedThisTurn + totalCost,
            status: appliedStatus,
            carriedMine: appliedStatus.carriedMine !== undefined ? appliedStatus.carriedMine : u.carriedMine
        } : u),
        questStats: qStats
    };
     
    return {
        ...prevState,
        turnCount: nextTurn, // Why nextTurn? attemptMove does NOT increment turn count. 
        // Wait, logic above was using turnCount. attemptMove logic:
        // "nextTurn" was typically used for "Start New Round".
        // Here we are inside "attemptMove", which does NOT change turnCount.
        // Oh, I see "nextTurn" usage in the previous code block (Step 997).
        // Line 3400: `respawnTimer = nextTurn <= 10...`
        // Wait, `nextTurn` is NOT defined in `attemptMove`.
        // `attemptMove` uses `currentState.turnCount`.
        // I should use `currentState.turnCount`.
        // But wait, the previous `startNewRound` function defined `nextTurn`.
        // `attemptMove` is separate.
        // I must replace usage of `nextTurn` with `currentState.turnCount`.
     
        // Correction: `attemptMove` shouldn't update `turnCount`. 
        // I should just update players.
     
        phase: 'action', // Ensure we stay in action
        timeLeft: prevState.timeLeft, // Keep time
        activeUnitId: unit.id, // Set active? Or just move?
        // Usually move -> lock unit -> done.
        cells: prevState.cells, // Cells don't change unless obstacle? (Mine removal is in mines)
        mines: newMines,
        buildings: currentBuildings, // Update buildings (Hub removal) (Wait, Hub removal was in `handleTeleport`?)
        // `currentBuildings` defined in `attemptMove` logic earlier? Yes line 3528.
     
        movements: [...prevState.movements, { unitId: unit.id, from: { r: unit.r, c: unit.c }, to: { r, c } }],
        players: nextStatePlayers,
        logs: [...newLogs, ...prevState.logs]
    };
        });
    };
    */






    // Initialize Player Actions
    const playerActions = usePlayerActions({
        setGameState,
        gameStateRef,
        targetMode,
        setTargetMode,
        setSelectedMineType,
        setShowEvolutionTree,
        addVFX,
        addLog,
        t,
    });

    const getLocalNetworkPlayer = useCallback((): PlayerID | null => {
        if (!roomId || !isNetworkConnected) {
            return null;
        }
        return isHost ? PlayerID.P1 : PlayerID.P2;
    }, [isHost, isNetworkConnected, roomId]);

    const canBroadcastAction = useCallback((owner?: PlayerID): boolean => {
        if (applyingRemoteActionRef.current) {
            return false;
        }
        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp') {
            return false;
        }
        const localPlayer = getLocalNetworkPlayer();
        if (!localPlayer) {
            return false;
        }
        if (state.currentPlayer !== localPlayer) {
            return false;
        }
        if (owner && owner !== localPlayer) {
            return false;
        }
        return true;
    }, [getLocalNetworkPlayer]);

    const sendGameState = useCallback((reason: string) => {
        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp' || !roomId || !isNetworkConnected) {
            return;
        }
        sendActionPacket({
            type: 'STATE_SYNC',
            matchId: roomId,
            turn: state.turnCount,
            payload: {
                reason,
                state: toSerializableGameState(state),
                allowDevTools: allowDevToolsInPvpRoom
            }
        });
    }, [allowDevToolsInPvpRoom, isNetworkConnected, roomId, sendActionPacket]);

    const sendGameStateDeferred = useCallback((reason: string) => {
        // Lower-latency default sync.
        setTimeout(() => {
            sendGameState(reason);
        }, 8);

        // Keep a second sync only for race-prone transitions.
        const needsResync =
            reason.includes('skip_turn') ||
            reason.includes('end_turn') ||
            reason.includes('remote_') ||
            reason.includes('ready_phase_mismatch') ||
            reason.includes('sandbox_new_round') ||
            reason.includes('sandbox_toggle_timer_pause');

        if (needsResync) {
            setTimeout(() => {
                sendGameState(`${reason}_resync`);
            }, 32);
        }
    }, [sendGameState]);

    const stripCarriedMineMirrors = useCallback((state: GameState): GameState => {
        const carriedMineIds = new Set<string>();
        [PlayerID.P1, PlayerID.P2].forEach(pid => {
            state.players[pid].units.forEach(u => {
                if (u.carriedMine?.id) {
                    carriedMineIds.add(u.carriedMine.id);
                }
            });
        });
        if (carriedMineIds.size === 0) {
            return state;
        }
        const filteredMines = state.mines.filter(m => !carriedMineIds.has(m.id));
        if (filteredMines.length === state.mines.length) {
            return state;
        }
        return { ...state, mines: filteredMines };
    }, []);

    useEffect(() => {
        if (!roomId || !isNetworkConnected) {
            return;
        }

        const retryTimer = setInterval(() => {
            const state = gameStateRef.current;
            if (state.gameMode !== 'pvp') {
                return;
            }
            if (state.phase !== 'placement' && state.phase !== 'thinking') {
                return;
            }

            const localPlayer = getLocalNetworkPlayer();
            if (!localPlayer) {
                return;
            }
            const remotePlayer = localPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const localReady = state.pvpReadyState?.[localPlayer] ?? false;
            const remoteReady = state.pvpReadyState?.[remotePlayer] ?? false;

            if (!localReady || remoteReady) {
                return;
            }

            sendActionPacket({
                type: 'PLAYER_READY',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    playerId: localPlayer,
                    phase: state.phase,
                    setupMines: state.phase === 'placement'
                        ? buildPlacementReadySnapshot(state, localPlayer)
                        : undefined,
                    energyBid: state.phase === 'thinking'
                        ? (state.pvpEnergyBids?.[localPlayer] ?? 0)
                        : undefined
                }
            });

            if (isHost) {
                sendGameState('ready_retry_sync');
            }
        }, 1500);

        return () => clearInterval(retryTimer);
    }, [buildPlacementReadySnapshot, getLocalNetworkPlayer, isHost, isNetworkConnected, roomId, sendActionPacket, sendGameState]);

    const executeMoveAction = useCallback((
        unitId: string,
        r: number,
        c: number,
        cost: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) {
            return;
        }
        // Never trust packet-supplied movement energy in PvP.
        // Recalculate from current authoritative state on receiver.
        const authoritativeCost = getAuthoritativeMoveCost(unit, state);

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'MOVE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId,
                    r,
                    c,
                    cost: authoritativeCost
                }
            });
        }

        // `cost` here is packet/request value; ignored in favor of authoritativeCost.
        void cost;
        playerActions.attemptMove(unitId, r, c, authoritativeCost);

        if (shouldBroadcast) {
            sendGameStateDeferred('move');
        }
    }, [canBroadcastAction, getAuthoritativeMoveCost, getUnit, playerActions.attemptMove, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeAttackAction = useCallback((
        attackerId: string,
        targetUnit: Unit,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const attacker = getUnit(attackerId, state);
        if (!attacker) {
            return;
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(attacker.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'ATTACK',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    attackerId,
                    targetId: targetUnit.id
                }
            });
        }

        playerActions.handleAttack(attackerId, targetUnit);

        if (shouldBroadcast) {
            sendGameStateDeferred('attack');
        }
    }, [canBroadcastAction, getUnit, playerActions.handleAttack, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeScanAction = useCallback((
        unit: Unit,
        r: number,
        c: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SCAN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId: unit.id,
                    r,
                    c
                }
            });
        }

        playerActions.handleScanAction(unit, r, c);

        if (shouldBroadcast) {
            sendGameStateDeferred('scan');
        }
    }, [canBroadcastAction, playerActions.handleScanAction, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeSensorScanAction = useCallback((
        unitId: string,
        r: number,
        c: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) {
            return;
        }

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SENSOR_SCAN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId,
                    r,
                    c
                }
            });
        }

        playerActions.handleSensorScan(unitId, r, c);

        if (shouldBroadcast) {
            sendGameStateDeferred('sensor_scan');
        }
    }, [canBroadcastAction, getUnit, playerActions.handleSensorScan, roomId, sendActionPacket, sendGameStateDeferred]);

    const executePlaceMineAction = useCallback((
        unit: Unit,
        r: number,
        c: number,
        mineType: MineType,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'PLACE_MINE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitId: unit.id,
                    r,
                    c,
                    mineType
                }
            });
        }

        playerActions.handleMinePlacement(unit, r, c, mineType);

        if (shouldBroadcast) {
            sendGameStateDeferred('place_mine');
        }
    }, [canBroadcastAction, playerActions.handleMinePlacement, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeEvolveAction = useCallback((
        unitType: UnitType,
        branch: 'a' | 'b',
        variant?: number,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'EVOLVE',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    unitType,
                    branch,
                    variant
                }
            });
        }
        if (origin === 'local') {
            let didEvolve = false;
            flushSync(() => {
                didEvolve = playerActions.handleEvolution(unitType, branch, variant);
            });
            if (didEvolve) {
                emitEvolutionFx(state.currentPlayer, unitType, branch);
            }
            if (didEvolve && shouldBroadcast) {
                // Wait one frame so gameStateRef has committed the evolved levels before syncing.
                window.setTimeout(() => {
                    sendGameState('evolve_after_commit');
                }, 16);
            }
            return;
        }

        const didEvolve = playerActions.handleEvolution(unitType, branch, variant);
        if (didEvolve) {
            emitEvolutionFx(state.currentPlayer, unitType, branch);
        }
    }, [canBroadcastAction, emitEvolutionFx, playerActions.handleEvolution, roomId, sendActionPacket, sendGameState]);

    const executeEndTurnAction = useCallback((
        actedUnitId: string | null,
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;
        const isTimedOut = state.phase === 'action' && state.timeLeft <= 0;

        if (origin === 'local' && isTimedOut && targetMode === 'move_mine_end' && selectedMineId) {
            // Timeout during target selection means the move-mine action fails:
            // no energy spent and no mine relocation.
            setSelectedMineId(null);
            setTargetMode(null);
        }

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'END_TURN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    actedUnitId
                }
            });
        }

        playerActions.handleActionComplete(actedUnitId);

        if (shouldBroadcast) {
            sendGameStateDeferred('end_turn');
        }
    }, [
        canBroadcastAction,
        playerActions.handleActionComplete,
        roomId,
        selectedMineId,
        sendActionPacket,
        sendGameStateDeferred,
        setTargetMode,
        targetMode
    ]);

    useEffect(() => {
        if (gameState.phase !== 'action' || gameState.gameOver || gameState.isPaused) return;

        if (gameState.gameMode === 'pvp') {
            const localPlayer = isHost ? PlayerID.P1 : PlayerID.P2;
            if (gameState.currentPlayer !== localPlayer) return;
        }

        const actingUnitId = gameState.activeUnitId ?? gameState.selectedUnitId;
        if (!actingUnitId) return;

        const actingUnit =
            gameState.players[PlayerID.P1].units.find(u => u.id === actingUnitId) ||
            gameState.players[PlayerID.P2].units.find(u => u.id === actingUnitId);
        if (!actingUnit) return;
        if (actingUnit.owner !== gameState.currentPlayer) return;
        if (!actingUnit.isDead || actingUnit.hasActedThisRound) return;

        const dedupeKey = `${gameState.turnCount}:${gameState.currentPlayer}:${actingUnit.id}`;
        if (autoEndedDeadUnitKeyRef.current === dedupeKey) return;
        autoEndedDeadUnitKeyRef.current = dedupeKey;

        executeEndTurnAction(actingUnit.id);
    }, [
        executeEndTurnAction,
        gameState.activeUnitId,
        gameState.currentPlayer,
        gameState.gameMode,
        gameState.gameOver,
        gameState.isPaused,
        gameState.phase,
        gameState.players,
        gameState.selectedUnitId,
        gameState.turnCount,
        isHost
    ]);

    const executeSkipTurnAction = useCallback((
        origin: 'local' | 'remote' = 'local'
    ) => {
        const state = gameStateRef.current;
        const shouldBroadcast = origin === 'local' && canBroadcastAction() && !!roomId;

        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'SKIP_TURN',
                matchId: roomId,
                turn: state.turnCount,
                payload: {
                    actedUnitId: null
                }
            });
        }

        playerActions.handleSkipTurn();

        if (shouldBroadcast) {
            sendGameStateDeferred('skip_turn');
        }
    }, [canBroadcastAction, playerActions.handleSkipTurn, roomId, sendActionPacket, sendGameStateDeferred]);

    const executePickupFlagAction = useCallback((
        origin: 'local' | 'remote' = 'local',
        unitIdOverride?: string
    ) => {
        const state = gameStateRef.current;
        const actingUnitId = unitIdOverride ?? state.selectedUnitId;
        if (!actingUnitId) return;
        const unit = getUnit(actingUnitId, state);
        if (!unit) return;
        if (unit.hasFlag) return;
        const player = state.players[unit.owner];
        if (unit.r !== player.flagPosition.r || unit.c !== player.flagPosition.c) return;

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'PICKUP_FLAG',
                matchId: roomId,
                turn: state.turnCount,
                payload: { unitId: unit.id }
            });
        }

        playerActions.handlePickupFlag(actingUnitId);

        if (shouldBroadcast) {
            sendGameStateDeferred('pickup_flag');
        }
    }, [canBroadcastAction, getUnit, playerActions.handlePickupFlag, roomId, sendActionPacket, sendGameStateDeferred]);

    const executeDropFlagAction = useCallback((
        origin: 'local' | 'remote' = 'local',
        unitIdOverride?: string
    ) => {
        const state = gameStateRef.current;
        const actingUnitId = unitIdOverride ?? state.selectedUnitId;
        if (!actingUnitId) return;
        const unit = getUnit(actingUnitId, state);
        if (!unit) return;
        if (!unit.hasFlag) return;

        const shouldBroadcast = origin === 'local' && canBroadcastAction(unit.owner) && !!roomId;
        if (shouldBroadcast && roomId) {
            sendActionPacket({
                type: 'DROP_FLAG',
                matchId: roomId,
                turn: state.turnCount,
                payload: { unitId: unit.id }
            });
        }

        playerActions.handleDropFlag(actingUnitId);

        if (shouldBroadcast) {
            sendGameStateDeferred('drop_flag');
        }
    }, [canBroadcastAction, getUnit, playerActions.handleDropFlag, roomId, sendActionPacket, sendGameStateDeferred]);

    useEffect(() => {
        if (!lastIncomingPacket) return;
        if (lastHandledPacketSeqRef.current === lastIncomingPacket.seq) return;
        lastHandledPacketSeqRef.current = lastIncomingPacket.seq;

        if (roomId && lastIncomingPacket.matchId !== roomId) {
            return;
        }

        if (lastIncomingPacket.type === 'START_GAME') {
            const payload = lastIncomingPacket.payload as StartGamePayload;
            if (!isHost && view === 'lobby') {
                if (typeof payload.allowDevTools === 'boolean') {
                    setAllowDevToolsInPvpRoom(payload.allowDevTools);
                }
                const syncedInitialState = payload.initialState ? fromSerializableGameState(payload.initialState) : null;
                handleStartGame('pvp', syncedInitialState || undefined);
            }
            return;
        }


        if (view !== 'game') {
            return;
        }

        const state = gameStateRef.current;
        if (state.gameMode !== 'pvp') {
            return;
        }

        const expectedRemoteOwner = isHost ? PlayerID.P2 : PlayerID.P1;
        const isValidRemoteActionWindow = () => (
            state.phase === 'action' &&
            state.currentPlayer === expectedRemoteOwner &&
            state.turnCount === lastIncomingPacket.turn &&
            !state.gameOver
        );

        applyingRemoteActionRef.current = true;
        try {
            const { type, payload } = lastIncomingPacket;

            if (type === 'STATE_SYNC') {
                if (!isStateSyncPayload(payload)) {
                    return;
                }
                if (!isHost && typeof payload.allowDevTools === 'boolean') {
                    setAllowDevToolsInPvpRoom(payload.allowDevTools);
                }
                const syncedState = fromSerializableGameState(payload.state);
                if (!syncedState) {
                    return;
                }

                // CRITICAL: Merge synced state with local UI state to prevent "weird jumps"
                // This keeps the player's current selection and perspective while updating global board state.
                setGameState(prev => {
                    let nextSyncedState = stripCarriedMineMirrors(syncedState);
                    if (nextSyncedState.gameMode === 'pvp' && nextSyncedState.phase === 'placement') {
                        // Placement mines are monotonic in setup phase; never let an older sync remove local mines.
                        const mergedPlacementMines = mergePlacementMines(
                            mergePlacementMines(getSetupMines(prev.mines), placementMinesRef.current),
                            getSetupMines(nextSyncedState.mines)
                        );
                        placementMinesRef.current = mergedPlacementMines;
                        const p1MineCount = mergedPlacementMines.filter(m => m.owner === PlayerID.P1).length;
                        const p2MineCount = mergedPlacementMines.filter(m => m.owner === PlayerID.P2).length;
                        const mergedReadyState = {
                            [PlayerID.P1]: (prev.pvpReadyState?.[PlayerID.P1] ?? false) || (nextSyncedState.pvpReadyState?.[PlayerID.P1] ?? false),
                            [PlayerID.P2]: (prev.pvpReadyState?.[PlayerID.P2] ?? false) || (nextSyncedState.pvpReadyState?.[PlayerID.P2] ?? false),
                        };

                        nextSyncedState = {
                            ...nextSyncedState,
                            mines: [...nextSyncedState.mines.filter(m => !m.id.startsWith('pm-')), ...mergedPlacementMines],
                            pvpReadyState: mergedReadyState,
                            players: {
                                ...nextSyncedState.players,
                                [PlayerID.P1]: {
                                    ...nextSyncedState.players[PlayerID.P1],
                                    placementMinesPlaced: p1MineCount
                                },
                                [PlayerID.P2]: {
                                    ...nextSyncedState.players[PlayerID.P2],
                                    placementMinesPlaced: p2MineCount
                                }
                            }
                        };
                    }

                    const localPlayer = resolveLocalPlayer(prev);
                    const preservedLocalPrivateLogs = prev.logs.filter(
                        log => PRIVATE_HINT_LOG_KEYS.has(log.messageKey) && log.owner === localPlayer
                    );
                    const syncedPublicLogs = nextSyncedState.logs.filter(log =>
                        !PRIVATE_HINT_LOG_KEYS.has(log.messageKey) || log.owner === localPlayer
                    );
                    const mergedLogs = dedupeLogsBySignature([...preservedLocalPrivateLogs, ...syncedPublicLogs]).slice(0, 100);
                    const keepLocalSelection = prev.phase === nextSyncedState.phase && nextSyncedState.phase === 'action';
                    return {
                        ...nextSyncedState,
                        logs: mergedLogs,
                        // Preserve LOCAL UI state
                        selectedUnitId: keepLocalSelection ? prev.selectedUnitId : null,
                        activeUnitId: keepLocalSelection ? prev.activeUnitId : null,
                        // Do NOT preserve pause flags locally; sandbox pause must sync across both players.
                        isPaused: nextSyncedState.isPaused,
                        isSandboxTimerPaused: nextSyncedState.isSandboxTimerPaused,

                        // Preserve UI animation state
                        vfx: prev.vfx,
                    };
                });
                return;
            }


            if (type === 'PLAYER_READY') {
                if (!isReadyPayload(payload)) return;
                if (payload.playerId !== expectedRemoteOwner) {
                    return;
                }
                if (lastIncomingPacket.turn !== state.turnCount) {
                    if (isHost) {
                        sendGameStateDeferred('ready_turn_mismatch');
                    } else if (roomId && isNetworkConnected) {
                        const localPlayer = resolveLocalPlayer(state);
                        sendActionPacket({
                            type: 'PLAYER_READY',
                            matchId: roomId,
                            turn: state.turnCount,
                            payload: {
                                playerId: localPlayer,
                                phase: state.phase,
                                setupMines: state.phase === 'placement'
                                    ? buildPlacementReadySnapshot(state, localPlayer)
                                    : undefined,
                                energyBid: state.phase === 'thinking'
                                    ? (state.pvpEnergyBids?.[localPlayer] ?? 0)
                                    : undefined
                            }
                        });
                    }
                    return;
                }
                if (state.phase !== payload.phase) {
                    if (isHost) {
                        sendGameStateDeferred('ready_phase_mismatch');
                    } else if (roomId && isNetworkConnected) {
                        const localPlayer = resolveLocalPlayer(state);
                        sendActionPacket({
                            type: 'PLAYER_READY',
                            matchId: roomId,
                            turn: state.turnCount,
                            payload: {
                                playerId: localPlayer,
                                phase: state.phase,
                                setupMines: state.phase === 'placement'
                                    ? buildPlacementReadySnapshot(state, localPlayer)
                                    : undefined,
                                energyBid: state.phase === 'thinking'
                                    ? (state.pvpEnergyBids?.[localPlayer] ?? 0)
                                    : undefined
                            }
                        });
                    }
                    return;
                }

                // Mark remote player as ready
                setGameState(prev => {
                    const incomingSetupMines = payload.phase === 'placement'
                        ? (payload.setupMines ?? []).map(m => ({
                            id: `pm-${payload.playerId}-${m.r}-${m.c}`,
                            owner: payload.playerId,
                            type: MineType.NORMAL,
                            r: m.r,
                            c: m.c,
                            revealedTo: [payload.playerId]
                        } as Mine))
                        : [];
                    const mergedSetupMines = payload.phase === 'placement'
                        ? unionPlacementMines(getSetupMines(prev.mines), incomingSetupMines)
                        : getSetupMines(prev.mines);
                    if (payload.phase === 'placement') {
                        placementMinesRef.current = unionPlacementMines(placementMinesRef.current, incomingSetupMines);
                    }
                    const nextMines = payload.phase === 'placement'
                        ? [...prev.mines.filter(m => !m.id.startsWith('pm-')), ...mergedSetupMines]
                        : prev.mines;

                    const logsWithRemotePlacement = payload.phase === 'placement'
                        ? upsertPlacementLogs(prev.logs, { ...prev, mines: nextMines }, payload.playerId)
                        : prev.logs;
                    const newReadyState = {
                        [PlayerID.P1]: prev.pvpReadyState?.[PlayerID.P1] ?? false,
                        [PlayerID.P2]: prev.pvpReadyState?.[PlayerID.P2] ?? false,
                        [payload.playerId]: true
                    };

                    const bothReady = newReadyState[PlayerID.P1] && newReadyState[PlayerID.P2];

                    if (prev.phase !== payload.phase) {
                        return prev;
                    }

                    // Check if phase transition is needed
                    if (bothReady) {
                        if (payload.phase === 'placement') {
                            // Both confirmed setup -> transition to ready (thinking) phase.
                            const stabilizedSetupMines = unionPlacementMines(
                                mergedSetupMines,
                                placementMinesRef.current
                            );
                            return {
                                ...prev,
                                phase: 'thinking',
                                timeLeft: THINKING_TIMER,
                                mines: [...prev.mines.filter(m => !m.id.startsWith('pm-')), ...stabilizedSetupMines],
                                selectedUnitId: null,
                                activeUnitId: null,
                                pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false },
                                pvpEnergyBids: { [PlayerID.P1]: 0, [PlayerID.P2]: 0 },
                                logs: [{ turn: 1, messageKey: 'log_round_start', params: { round: 1 }, type: 'info' as const }, ...logsWithRemotePlacement]
                            };
                        } else {
                            const storedRemoteBid = prev.pvpEnergyBids?.[payload.playerId] ?? 0;
                            const remotePlayerEnergy = prev.players[payload.playerId].energy;
                            const remoteBid = Math.max(0, Math.min(payload.energyBid ?? storedRemoteBid, remotePlayerEnergy));
                            const localPlayerId = resolveLocalPlayer(prev);
                            const localPlayerEnergy = prev.players[localPlayerId].energy;
                            const localBidStored = Math.max(0, Math.min(prev.pvpEnergyBids?.[localPlayerId] ?? 0, localPlayerEnergy));
                            const p1Bid = payload.playerId === PlayerID.P1 ? remoteBid : localBidStored;
                            const p2Bid = payload.playerId === PlayerID.P2 ? remoteBid : localBidStored;
                            const { firstMover, isTie } = resolveFirstMoverFromBids(p1Bid, p2Bid, prev.turnCount);
                            const firstMoverLog: import('./types').GameLog = isTie
                                ? { turn: prev.turnCount, messageKey: 'log_first_mover_tie', params: {}, type: 'info' as const }
                                : {
                                    turn: prev.turnCount,
                                    messageKey: 'log_first_mover',
                                    params: { player: firstMover === PlayerID.P1 ? 'P1' : 'P2' },
                                    type: 'info' as const
                                };
                            const p1AfterBid = Math.max(0, prev.players[PlayerID.P1].energy - p1Bid);
                            const p2AfterBid = Math.max(0, prev.players[PlayerID.P2].energy - p2Bid);
                            const updatedMines = applyRadarScans(prev);
                            return {
                                ...prev,
                                phase: 'action',
                                timeLeft: TURN_TIMER,
                                currentPlayer: firstMover,
                                selectedUnitId: null,
                                activeUnitId: null,
                                mines: updatedMines,
                                pvpReadyState: { [PlayerID.P1]: false, [PlayerID.P2]: false }, // Reset but won't be used in action phase
                                pvpEnergyBids: { [PlayerID.P1]: 0, [PlayerID.P2]: 0 },
                                players: {
                                    ...prev.players,
                                    [PlayerID.P1]: {
                                        ...prev.players[PlayerID.P1],
                                        energy: p1AfterBid,
                                        startOfActionEnergy: p1AfterBid,
                                        units: prev.players[PlayerID.P1].units.map(u => ({ ...u, startOfActionEnergy: p1AfterBid }))
                                    },
                                    [PlayerID.P2]: {
                                        ...prev.players[PlayerID.P2],
                                        energy: p2AfterBid,
                                        startOfActionEnergy: p2AfterBid,
                                        units: prev.players[PlayerID.P2].units.map(u => ({ ...u, startOfActionEnergy: p2AfterBid }))
                                    }
                                },
                                logs: [firstMoverLog, { turn: prev.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...logsWithRemotePlacement]
                            }
                        }
                    }

                    // Store the remote player's bid if not both ready yet
                    const updatedBids = payload.phase === 'thinking' ? {
                        [PlayerID.P1]: prev.pvpEnergyBids?.[PlayerID.P1] ?? 0,
                        [PlayerID.P2]: prev.pvpEnergyBids?.[PlayerID.P2] ?? 0,
                        [payload.playerId]: payload.energyBid ?? (prev.pvpEnergyBids?.[payload.playerId] ?? 0),
                    } : prev.pvpEnergyBids;

                    return {
                        ...prev,
                        mines: nextMines,
                        pvpReadyState: newReadyState,
                        pvpEnergyBids: updatedBids,
                        logs: logsWithRemotePlacement
                    };
                });
                if (isHost) {
                    sendGameStateDeferred('remote_ready_applied');
                }
                return;
            }

            if (type === 'MOVE') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isMovePayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner) {
                    return;
                }
                executeMoveAction(payload.unitId, payload.r, payload.c, payload.cost, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_move_applied');
                }
                return;
            }

            if (type === 'ATTACK') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isAttackPayload(payload)) {
                    return;
                }
                const attacker = getUnit(payload.attackerId, state);
                const target = getUnit(payload.targetId, state);
                if (!attacker || !target || attacker.owner !== expectedRemoteOwner) {
                    return;
                }
                executeAttackAction(payload.attackerId, target, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_attack_applied');
                }
                return;
            }

            if (type === 'SCAN') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isScanPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MINESWEEPER) {
                    return;
                }
                executeScanAction(unit, payload.r, payload.c, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_scan_applied');
                }
                return;
            }

            if (type === 'SENSOR_SCAN') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isSensorScanPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MINESWEEPER) {
                    return;
                }
                executeSensorScanAction(payload.unitId, payload.r, payload.c, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_sensor_scan_applied');
                }
                return;
            }

            if (type === 'PLACE_MINE') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isPlaceMinePayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner || unit.type !== UnitType.MAKER) {
                    return;
                }
                executePlaceMineAction(unit, payload.r, payload.c, payload.mineType, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_place_mine_applied');
                }
                return;
            }

            if (type === 'PICKUP_FLAG') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isFlagActionPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner) {
                    return;
                }
                executePickupFlagAction('remote', payload.unitId);
                if (isHost) {
                    sendGameStateDeferred('remote_pickup_flag_applied');
                }
                return;
            }

            if (type === 'DROP_FLAG') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isFlagActionPayload(payload)) {
                    return;
                }
                const unit = getUnit(payload.unitId, state);
                if (!unit || unit.owner !== expectedRemoteOwner) {
                    return;
                }
                executeDropFlagAction('remote', payload.unitId);
                if (isHost) {
                    sendGameStateDeferred('remote_drop_flag_applied');
                }
                return;
            }

            if (type === 'EVOLVE') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isEvolvePayload(payload)) {
                    return;
                }
                executeEvolveAction(payload.unitType, payload.branch, payload.variant, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_evolve_applied');
                }
                return;
            }

            if (type === 'LEAVE_MATCH') {
                handleExitGame('remote');
                return;
            }

            if (type === 'END_TURN') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                if (!isEndTurnPayload(payload)) {
                    return;
                }
                executeEndTurnAction(payload.actedUnitId, 'remote');
                if (isHost) {
                    sendGameStateDeferred('remote_end_turn_applied');
                }
                return;
            }

            if (type === 'SKIP_TURN') {
                if (!isValidRemoteActionWindow()) {
                    return;
                }
                executeSkipTurnAction('remote');
                if (isHost) {
                    sendGameStateDeferred('remote_skip_turn_applied');
                }
            }
        } finally {
            applyingRemoteActionRef.current = false;
        }
    }, [
        buildPlacementReadySnapshot,
        executeAttackAction,
        executeDropFlagAction,
        executeEndTurnAction,
        executeEvolveAction,
        executeMoveAction,
        executePickupFlagAction,
        executePlaceMineAction,
        executeScanAction,
        executeSensorScanAction,
        executeSkipTurnAction,
        getUnit,
        handleStartGame,
        isHost,
        isNetworkConnected,
        lastIncomingPacket,
        resolveLocalPlayer,
        resolveFirstMoverFromBids,
        roomId,
        sendActionPacket,
        sendGameStateDeferred,
        setGameState,
        view
    ]);

    const handleCellClick = (r: number, c: number) => {
        // === IMMEDIATE TIME FREEZE - FIRST LINE === 
        // Set frozen state BEFORE any logic to ensure UI updates in the same frame as the click.
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;

        // Manual dismiss for MISS markers: clicking that MISS cell clears it immediately.
        console.log('[DEBUG MISS] handleCellClick called at', r, c, 'sensorResults:', state.sensorResults.filter(sr => sr.kind === 'mark'));
        const localPlayer = resolveLocalPlayer(state);
        const clickedCellHasMiss = state.sensorResults.some(
            sr => sr.kind === 'mark' &&
                sr.owner === localPlayer &&
                sr.r === r &&
                sr.c === c &&
                sr.success !== true
        );
        console.log('[DEBUG MISS] clickedCellHasMiss:', clickedCellHasMiss, 'localPlayer:', localPlayer);
        if (clickedCellHasMiss) {
            console.log('[DEBUG MISS] Clearing miss at', r, c);
            clearMissMarksImmediatelyAt(r, c, localPlayer);
            return;
        }

        // Check if this action will cause time freeze
        const isActionPotentiallyFreezing =
            targetMode === 'move' || targetMode === 'attack' || targetMode === 'scan' ||
            targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'place_tower' ||
            targetMode === 'place_factory' || targetMode === 'place_hub' || targetMode === 'teleport' ||
            targetMode === 'throw_mine' || targetMode === 'convert_mine';

        // GUARD CLAUSE: Only freeze if NOT already frozen (prevents state overlapping)
        if (isActionPotentiallyFreezing && !state.isTimeFrozen) {
            // INSTANT FREEZE: Set both ref (for immediate UI) and state (for timer logic) 
            // Use flushSync to guarantee DOM update happens NOW, not on next tick
            flushSync(() => {
                setGameState(prev => ({
                    ...prev,
                    isTimeFrozen: true,
                    lastActionTime: Date.now()
                }));
            });
        }

        // Execute logic synchronously - no delays
        executeCellClickLogic(r, c);
    };

    const executeCellClickLogic = (r: number, c: number) => {
        const state = gameStateRef.current; // Re-fetch current state inside the deferred execution
        if (state.gameOver || state.isPaused) return;
        if (state.gameMode === 'pvp' && roomId && state.phase !== 'placement') {
            const localPlayer = resolveLocalPlayer(state);
            if (state.currentPlayer !== localPlayer) return;
        }

        const cell = state.cells[r][c];
        const unitInCell = state.players[PlayerID.P1].units.find(u => u.r === r && u.c === c && !u.isDead) ||
            state.players[PlayerID.P2].units.find(u => u.r === r && u.c === c && !u.isDead);

        if (state.phase === 'placement') {
            // Determine acting player for Placement Phase logic
            const actingPlayerId = resolveLocalPlayer(state);

            if (targetMode === 'place_setup_mine') {
                // Valid Zone Check
                // Correct logic: if P1, allowed in P1 zone; if P2, allowed in P2 zone.
                const isP1Zone = c < 12;
                const isMyZone = actingPlayerId === PlayerID.P1 ? isP1Zone : !isP1Zone;

                if (!isMyZone) {
                    addLog('log_mine_zone', 'error');
                    return;
                }

                if (cell.isObstacle || unitInCell) {
                    addLog('log_obstacle', 'error');
                    return;
                }

                const player = state.players[actingPlayerId];
                const hasMineAtCell = state.mines.some(m => m.r === r && m.c === c);
                if (hasMineAtCell) {
                    addLog('log_space_has_mine', 'error');
                    return;
                }

                if (player.placementMinesPlaced >= PLACEMENT_MINE_LIMIT) {
                    setTargetMode(null);
                    return;
                }

                let placedSuccessfully = false;
                let placementFailReason: 'limit' | 'occupied' | null = null;
                setGameState(prev => {
                    const p = prev.players[actingPlayerId];
                    const prevHasMineAtCell = prev.mines.some(m => m.r === r && m.c === c);
                    if (p.placementMinesPlaced >= PLACEMENT_MINE_LIMIT) {
                        placementFailReason = 'limit';
                        return prev;
                    }
                    if (prevHasMineAtCell) {
                        placementFailReason = 'occupied';
                        return prev;
                    }
                    placedSuccessfully = true;
                    const newSetupMine: Mine = {
                        id: `pm-${actingPlayerId}-${r}-${c}`,
                        owner: actingPlayerId,
                        type: MineType.NORMAL,
                        r,
                        c,
                        revealedTo: [actingPlayerId]
                    };
                    // Keep placement mine cache in lockstep with reducer updates to avoid ready-click races.
                    placementMinesRef.current = unionPlacementMines(placementMinesRef.current, [newSetupMine]);
                    return {
                        ...prev,
                        mines: [...prev.mines, newSetupMine],
                        players: {
                            ...prev.players,
                            [actingPlayerId]: { ...p, placementMinesPlaced: p.placementMinesPlaced + 1 }
                        }
                    }
                });
                if (!placedSuccessfully) {
                    if (placementFailReason === 'occupied') {
                        addLog('log_space_has_mine', 'error');
                    }
                    // Keep placement mode active so player can continue placing without re-toggling.
                    return;
                }
                if (player.placementMinesPlaced + 1 >= PLACEMENT_MINE_LIMIT) {
                    setTargetMode(null);
                }
                if (state.gameMode === 'pvp' && roomId && isNetworkConnected && !applyingRemoteActionRef.current) {
                    sendGameStateDeferred('place_setup_mine');
                }
                return;
            }

            // Rule 4: "Cannot move to other places, can only swap"
            // If clicking empty cell, DO NOTHING in placement phase (unless placing mine above)
            if (!unitInCell) {
                return;
            }
            // If clicking own unit, handle selection (which leads to swap logic in handleUnitClick)
            if (unitInCell.owner === actingPlayerId) {
                handleUnitClick(unitInCell);
            }
            return;
        }

        // Thinking Phase
        if (state.phase === 'thinking') return;

        if (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2) return;

        // Handle Skill Targeting - MUST BE BEFORE unitInCell CHECK
        if (state.selectedUnitId && (targetMode === 'scan' || targetMode === 'sensor_scan' || targetMode === 'place_mine' || targetMode === 'disarm' || targetMode === 'teleport' || targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'throw_mine' || targetMode === 'place_factory' || targetMode === 'move_mine_start' || targetMode === 'move_mine_end' || targetMode === 'convert_mine' || targetMode === 'pickup_mine_select')) {
            const unit = getUnit(state.selectedUnitId);
            if (unit) {
                if (targetMode === 'teleport') {
                    // Sandbox Drag: keep target constraints aligned with board highlights.
                    const targetCell = state.cells[r]?.[c];
                    const hasUnitAtTarget = state.players[PlayerID.P1].units.some(u => u.r === r && u.c === c && !u.isDead) ||
                        state.players[PlayerID.P2].units.some(u => u.r === r && u.c === c && !u.isDead);
                    const hasBuildingAtTarget = state.buildings.some(b => b.r === r && b.c === c);
                    if (!targetCell || targetCell.isObstacle || hasUnitAtTarget || hasBuildingAtTarget) {
                        return;
                    }
                    setGameState(prev => {
                        const pId = unit.owner;
                        const pState = prev.players[pId];
                        const newUnits = pState.units.map(u => u.id === unit.id ? { ...u, r, c } : u);
                        return {
                            ...prev,
                            players: { ...prev.players, [pId]: { ...pState, units: newUnits } }
                        };
                    });
                    setTargetMode(null);
                    return;
                }
                if (targetMode === 'scan' && unit.type === UnitType.MINESWEEPER) {
                    executeScanAction(unit, r, c);
                    return;
                }
                if (targetMode === 'sensor_scan' && unit.type === UnitType.MINESWEEPER) {
                    executeSensorScanAction(unit.id, r, c);
                    return;
                }
                if (targetMode === 'place_mine' && unit.type === UnitType.MAKER) {
                    const currentMineType = selectedMineTypeRef.current;
                    console.log('[DEBUG] App.tsx handleCellClick - selectedMineTypeRef.current:', currentMineType);
                    executePlaceMineAction(unit, r, c, currentMineType);
                    return;
                }
                if (targetMode === 'disarm' && unit.type === UnitType.DEFUSER) {
                    handleDisarmAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_tower' && unit.type === UnitType.MINESWEEPER) {
                    handlePlaceTowerAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_hub' && unit.type === UnitType.RANGER) {
                    handlePlaceHubAction(unit, r, c);
                    return;
                }
                if (targetMode === 'throw_mine' && unit.type === UnitType.RANGER) {
                    handleThrowMineAction(unit, r, c);
                    return;
                }
                if (targetMode === 'place_factory' && unit.type === UnitType.MAKER) {
                    handlePlaceFactoryAction(unit, r, c);
                    return;
                }
                if (targetMode === 'move_mine_start' && unit.type === UnitType.DEFUSER) {
                    const mine = state.mines.find(m =>
                        m.r === r &&
                        m.c === c &&
                        m.owner !== unit.owner &&
                        m.revealedTo.includes(unit.owner)
                    );
                    if (mine) {
                        setSelectedMineId(mine.id);
                        setTargetMode('move_mine_end');
                        addLog('log_select_action', 'info', undefined, unit.owner); // Generic 'selected' with yellow color
                    }
                    return;
                }
                if (targetMode === 'move_mine_end' && unit.type === UnitType.DEFUSER && selectedMineId) {
                    const mine = state.mines.find(m => m.id === selectedMineId);
                    if (mine) {
                        handleMoveEnemyMineAction(unit, mine.r, mine.c, r, c);
                    }
                    setSelectedMineId(null);
                    setTargetMode(null);
                    return;
                }
                if (targetMode === 'convert_mine' && unit.type === UnitType.DEFUSER) {
                    const mine = state.mines.find(m =>
                        m.r === r &&
                        m.c === c &&
                        m.owner !== unit.owner &&
                        m.revealedTo.includes(unit.owner)
                    );
                    if (mine) {
                        handleConvertEnemyMineAction(unit, r, c);
                    }
                    return;
                }
                if (targetMode === 'pickup_mine_select' && unit.type === UnitType.RANGER) {
                    handlePickupMineAt(unit, r, c);
                    return;
                }
            }
        }

        if (unitInCell) {
            if (unitInCell.owner === state.currentPlayer) {
                handleUnitClick(unitInCell);
                return;
            }
            if (targetMode === 'attack' && state.selectedUnitId) {
                handleUnitClick(unitInCell);
                return;
            }
        }

        if (state.selectedUnitId) {
            const unit = getUnit(state.selectedUnitId);
            if (!unit || unit.owner !== state.currentPlayer) return;

            if (targetMode === 'move') {
                const dist = Math.abs(unit.r - r) + Math.abs(unit.c - c);
                if (dist === 1 && !unitInCell && !state.cells[r][c].isObstacle) {
                    // --- General Evolution Logic: Path B (Reduce Flag Move Cost) ---
                    const player = state.players[unit.owner];
                    const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
                    const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;

                    let baseCost = UNIT_STATS[unit.type].moveCost;
                    if (unit.hasFlag) {
                        if (unit.type === UnitType.GENERAL) {
                            // Gen Path B Level 3-1: Cost reduced to 4 (normally 5)
                            baseCost = (genLevelB >= 3 && genVariantB === 1) ? 4 : UNIT_STATS[UnitType.GENERAL].flagMoveCost;
                        } else if (genLevelB >= 3 && genVariantB === 1) {
                            // Gen Path B Level 3-1: Any unit can carry flag, cost is 4
                            baseCost = 4;
                        } else {
                            // Fallback for non-General units
                            baseCost = 5;
                        }
                    } else if (unit.type === UnitType.RANGER && unit.carriedMine) {
                        // Ranger carrying mine costs 3 to move
                        baseCost = 3;
                    }

                    // Apply debuffs and territory costs via getDisplayCost
                    const finalCost = getDisplayCost(unit, baseCost, state);
                    executeMoveAction(unit.id, r, c, finalCost);
                }
            }
        }
    };

    // Initialize Game Loop and Listeners
    const gameLoopActions = {
        ...playerActions,
        attemptMove: executeMoveAction,
        handleAttack: executeAttackAction,
        handleScanAction: executeScanAction,
        handlePlaceMineAction: executePlaceMineAction,
        handleEvolution: executeEvolveAction,
        handleActionComplete: executeEndTurnAction,
        handleSkipTurn: executeSkipTurnAction,
        addLog,
        startActionPhase,
        finishPlacementPhase,
        handleUnitClick,
        applyRadarScans,
        handlePlaceTowerAction,
        handlePlaceFactoryAction,
        handlePlaceHubAction,
        handleTeleportToHubAction,
        handleDisarmAction,
        handleDetonateTowerAction,
        handleStealth: handleStealthAction,
        handleRangerAction,
        handlePickupFlag: executePickupFlagAction,
        handleDropFlag: executeDropFlagAction,
        setShowEvolutionTree,
        getLocalizedUnitName: (type: UnitType) => t(getUnitNameKey(type)),
        getActionButtonIndex,
        // Bug 10 fix: playerActions spread 帶入 hook 版（無網路廣播），
        // 用 App.tsx 版（有廣播）統一覆蓋，確保 AI/GameLoop 都走正確路徑
        handlePlaceTower: handlePlaceTowerAction,
        handlePlaceFactory: handlePlaceFactoryAction,
        handlePlaceHub: handlePlaceHubAction,
        handleTeleportToHub: handleTeleportToHubAction,
        handleDisarm: handleDisarmAction,
        handleDetonateTower: handleDetonateTowerAction,
    };


    // Visual perspective should be stable from room role, independent of socket ready timing.
    const localPerspectivePlayer = (gameState.gameMode === 'pvp')
        ? (pvpPerspectivePlayer ?? (isHost ? PlayerID.P1 : PlayerID.P2))
        : null;
    const localControlPlayer = gameState.gameMode === 'pvp'
        ? (getLocalNetworkPlayer() ?? localPerspectivePlayer ?? (isHost ? PlayerID.P1 : PlayerID.P2))
        : PlayerID.P1;
    const localLogOwnerPlayerId = gameState.gameMode === 'pvp'
        ? (isHost ? PlayerID.P1 : PlayerID.P2)
        : PlayerID.P1;
    const shouldHideEnemyMineLogs = gameState.gameMode === 'pvp' || gameState.gameMode === 'pve';
    const shouldFlipBoard = gameState.gameMode === 'pvp' && localPerspectivePlayer === PlayerID.P2;
    useGameLoop({
        gameStateRef,
        setGameState,
        view,
        targetMode,
        setTargetMode,
        isBoardFlippedForLocal: shouldFlipBoard,
        localPlayerId: localPerspectivePlayer,
        actions: gameLoopActions
    });

    // Use the AI Hook
    useGameAI({
        gameState,
        difficulty: aiDifficulty,
        tuningProfile: aiTuningProfile,
        selectUnit: selectUnitForAI,
        debug: aiDebug,
        onDecision: (info) => setAiDecision(info),
        actions: {
            attemptMove: executeMoveAction,
            handleAttack: executeAttackAction,
            handleScanAction: executeScanAction,
            handleSensorScan: executeSensorScanAction,
            handleMinePlacement: executePlaceMineAction,
            handlePlaceTowerAction,
            handlePlaceFactoryAction,
            handlePlaceHubAction,
            handleTeleportToHubAction,
            handleDetonateTowerAction,
            handleThrowMineAction,
            handlePickupMineAt,
            handleMoveEnemyMineAction,
            handleConvertEnemyMineAction,
            handleRangerAction,
            handleDisarm: handleDisarmAction,
            handleEvolution: executeEvolveAction,
            handlePickupFlag: executePickupFlagAction,
            handleDropFlag: executeDropFlagAction,
            handleActionComplete: executeEndTurnAction
        }
    });
    const isLowDetail = detailMode === 'low';
    const isUltraLowDetail = detailMode === 'ultra_low';
    const detailScale = isUltraLowDetail ? 0.45 : isLowDetail ? 0.72 : 1;
    const leftSideAura = shouldFlipBoard ? 'rgba(255, 50, 100, 0.58)' : 'rgba(0, 150, 255, 0.58)';
    const rightSideAura = shouldFlipBoard ? 'rgba(0, 150, 255, 0.58)' : 'rgba(255, 50, 100, 0.58)';
    const leftPlanetTheme: 'blue' | 'red' = shouldFlipBoard ? 'red' : 'blue';
    const rightPlanetTheme: 'blue' | 'red' = shouldFlipBoard ? 'blue' : 'red';
    const activeTurnPlanetTheme: 'blue' | 'red' | null =
        gameState.phase === 'action'
            ? (gameState.currentPlayer === PlayerID.P1 ? 'blue' : 'red')
            : null;
    const actionUrgencyProgress = gameState.phase === 'action'
        ? Math.min(1, Math.max(0, 1 - gameState.timeLeft / TURN_TIMER))
        : 0;
    // Only the current side's planet accelerates; the other side stays at normal spin speed.
    const bluePlanetSpinSpeed = ((gameState.phase === 'action' && gameState.currentPlayer === PlayerID.P1)
        ? 1 + Math.pow(actionUrgencyProgress, 1.2) * 1.9
        : 1) * detailScale;
    const redPlanetSpinSpeed = ((gameState.phase === 'action' && gameState.currentPlayer === PlayerID.P2)
        ? 1 + Math.pow(actionUrgencyProgress, 1.32) * 2.1
        : 1) * detailScale;
    const isLeftPlanetTurnActive = leftPlanetTheme === activeTurnPlanetTheme;
    const isRightPlanetTurnActive = rightPlanetTheme === activeTurnPlanetTheme;
    const isLeftPlanetTurnInactive = activeTurnPlanetTheme !== null && !isLeftPlanetTurnActive;
    const isRightPlanetTurnInactive = activeTurnPlanetTheme !== null && !isRightPlanetTurnActive;
    const rightAuraCenter = showLog ? '52% 42%' : '70% 42%';
    const neutralAuraCenter = showLog ? '41% 20%' : '50% 20%';
    const meteorCount = isUltraLowDetail ? 6 : isLowDetail ? 12 : 25;
    const isLocalPlayerTurn = gameState.gameMode === 'pvp'
        ? (
            gameState.phase === 'placement' ||
            gameState.phase === 'thinking' ||
            localControlPlayer === gameState.currentPlayer
        )
        : gameState.gameMode === 'sandbox'
            ? true
            : (gameState.currentPlayer === PlayerID.P1);
    const privateHintMinTurn = Math.max(1, gameState.turnCount - PRIVATE_HINT_LOG_TTL_TURNS + 1);
    const filteredLogs = gameState.logs.filter((log) => {
        if (log.messageKey === 'log_mine_limit') return false;
        if (gameState.gameMode === 'sandbox') return true;
        if (PRIVATE_HINT_LOG_KEYS.has(log.messageKey)) {
            if (!log.owner || log.owner !== localLogOwnerPlayerId) return false;
            return log.turn >= privateHintMinTurn;
        }
        if (!shouldHideEnemyMineLogs) return true;
        if (!log.owner) return true;
        if (!ENEMY_MINE_LOG_KEYS.has(log.messageKey)) return true;
        return log.owner === localLogOwnerPlayerId;
    });
    // Keep existing rows stable: older messages stay on top, new ones append below.
    const displayedLogs = filteredLogs.slice().reverse();
    const latestDisplayedLog = displayedLogs[displayedLogs.length - 1];
    const latestDisplayedLogSignature = latestDisplayedLog
        ? `${latestDisplayedLog.turn}|${latestDisplayedLog.messageKey}|${latestDisplayedLog.owner ?? 'global'}|${serializeLogParams(latestDisplayedLog.params)}|${latestDisplayedLog.type}`
        : '';

    useEffect(() => {
        if (!showLog) return;
        const logList = logScrollRef.current;
        if (!logList) return;
        logList.scrollTop = logList.scrollHeight;
    }, [latestDisplayedLogSignature, showLog]);

    return (
        <div className="w-full h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none">
            {/* Background Music */}
            <audio
                ref={audioRef}
                src={view === 'lobby' ? toAssetUrl('lobby-bgm.mp3') : toAssetUrl('the-final-boss-battle-158700.mp3')}
                loop
            />

            {/* Modals & Lobby System */}
            <GameModals
                view={view}
                gameState={gameState}
                language={language}
                aiDifficulty={aiDifficulty}
                setAiDifficulty={setAiDifficulty}
                onStartGame={handleStartGame}
                onExitGame={handleExitGame}
                onRestart={handleRestart}
                onPauseToggle={handlePause}
                isHost={isHost}
                setIsHost={setIsHost}
                roomId={roomId}
                setRoomId={setRoomId}
                onOpenSettings={() => setShowCommonSettings(true)}
                allowDevToolsInPvpRoom={allowDevToolsInPvpRoom}
                setAllowDevToolsInPvpRoom={setAllowDevToolsInPvpRoom}
                detailMode={detailMode}
                t={t}
            />

            <CommonSettingsModal
                open={showCommonSettings}
                onClose={() => setShowCommonSettings(false)}
                language={language}
                setLanguage={setLanguage}
                musicVolume={musicVolume}
                setMusicVolume={setMusicVolume}
                sfxVolume={sfxVolume}
                setSfxVolume={setSfxVolume}
                allowDevToolsInAiChallenge={allowDevToolsInAiChallenge}
                setAllowDevToolsInAiChallenge={setAllowDevToolsInAiChallenge}
                disableBoardShake={disableBoardShake}
                setDisableBoardShake={setDisableBoardShake}
                detailMode={detailMode}
                setDetailMode={setDetailMode}
            />

            {view === 'game' && (
                <>
                    {/* Game Start Animation */}
                    {showGameStartAnimation && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 animate-fade-out" style={{
                            animation: 'fadeOut 3s ease-in-out forwards'
                        }}>
                            <style>{`
                @keyframes fadeOut {
                  0% { opacity: 1; }
                  70% { opacity: 1; }
                  100% { opacity: 0; }
                }
              `}</style>
                            <div className="text-center">
                                <div className="text-6xl font-black text-white mb-4 animate-pulse">
                                    {t(gameState.gameMode + '_mode')}
                                </div>
                                <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                                    {t('battle_start')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game Header */}
                    {/* Game Header */}
                    <GameHeader
                        gameState={gameState}
                        onPauseToggle={handlePause}
                        onExitGame={handleExitGame}
                        onOpenSettings={() => setShowCommonSettings(true)}
                        onClearPetals={() => setClearPetalsNonce(Date.now())}
                        t={t}
                    />

                    {/* Main Game Area */}
                    <div className={`flex-1 flex flex-col overflow-hidden relative ${showLog ? 'game-area--log-open' : 'game-area--log-closed'}`}
                        style={{
                            background: 'linear-gradient(135deg, #0a0e27 0%, #1a0033 25%, #0a0e27 50%, #1a0033 75%, #0a0e27 100%)',
                            backgroundSize: '400% 400%',
                            animation: isUltraLowDetail ? 'none' : `gradientShift ${isLowDetail ? 22 : 15}s ease infinite`
                        }}>
                        {/* Neon Grid Background */}
                        <div className="absolute inset-0"
                            style={{
                                opacity: isUltraLowDetail ? 0.04 : isLowDetail ? 0.07 : 0.1,
                                backgroundImage: `
                       linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent),
                       linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent)
                     `,
                                backgroundSize: isUltraLowDetail ? '96px 96px' : isLowDetail ? '76px 76px' : '60px 60px',
                                pointerEvents: 'none',
                                zIndex: 1
                            }}>
                        </div>

                        {/* Meteors - Behind Board */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9 }}>
                            <style>{`
                                @keyframes meteorFall {
                                    0% {
                                        transform: translateY(-200px) translateX(0);
                                        opacity: 0;
                                    }
                                    10% {
                                        opacity: 1;
                                    }
                                    90% {
                                        opacity: 1;
                                    }
                                    100% {
                                        transform: translateY(calc(100vh + 200px)) translateX(400px);
                                        opacity: 0;
                                    }
                                }
                            `}</style>
                            {Array.from({ length: meteorCount }).map((_, i) => (
                                <div
                                    key={`meteor-${i}`}
                                    className="absolute"
                                    style={{
                                        left: `${(i * 13 + 7) % 100}%`,
                                        top: '-200px',
                                        animation: `meteorFall ${isUltraLowDetail ? 6.8 : isLowDetail ? 5.1 : 3 + (i % 5)}s linear infinite`,
                                        animationDelay: `${i * 0.5}s`,
                                        opacity: 0
                                    }}
                                >
                                    <div style={{
                                        width: '2px',
                                        height: `${(isUltraLowDetail ? 54 : isLowDetail ? 66 : 80) + (i % 6) * (isUltraLowDetail ? 10 : isLowDetail ? 14 : 20)}px`,
                                        background: 'linear-gradient(to bottom, rgba(0, 255, 255, 0), rgba(200, 255, 255, 0.8))',
                                        boxShadow: `0 0 ${isUltraLowDetail ? 8 : isLowDetail ? 11 : 15}px rgba(0, 255, 255, 0.6)`,
                                        transform: 'rotate(-25deg)',
                                        transformOrigin: 'bottom center'
                                    }} />
                                </div>
                            ))}
                        </div>

                        {/* Background Decorative Elements */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
                            {/* Aurora Effect */}
                            {!isUltraLowDetail && (
                                <div className="absolute inset-0 opacity-40 mix-blend-screen" style={{ zIndex: 0 }}>
                                    <div className="absolute inset-[-50%]" style={{
                                        background: 'linear-gradient(45deg, transparent 40%, rgba(0, 255, 128, 0.3) 50%, transparent 60%)',
                                        filter: `blur(${isLowDetail ? 46 : 60}px)`,
                                        animation: `aurora-flow ${isLowDetail ? 11 : 8}s ease-in-out infinite alternate`,
                                        transformOrigin: 'center'
                                    }}></div>
                                    {!isLowDetail && (
                                        <div className="absolute inset-[-50%]" style={{
                                            background: 'linear-gradient(-45deg, transparent 40%, rgba(50, 255, 100, 0.2) 50%, transparent 60%)',
                                            filter: 'blur(40px)',
                                            animation: 'aurora-flow 12s ease-in-out infinite alternate-reverse',
                                            transformOrigin: 'center',
                                            animationDelay: '-4s'
                                        }}></div>
                                    )}
                                </div>
                            )}

                            {/* Neon Planets */}
                            <div className="neon-planets-layer">
                                <ShaderPlanet
                                    theme={leftPlanetTheme}
                                    spinDirection={leftPlanetTheme === 'red' ? -1 : 1}
                                    isTurnActive={isLeftPlanetTurnActive}
                                    motionSpeed={leftPlanetTheme === 'blue' ? bluePlanetSpinSpeed : redPlanetSpinSpeed}
                                    detailMode={detailMode}
                                    className={`planet-left ${isLeftPlanetTurnInactive ? 'shader-planet-turn-inactive' : ''}`.trim()}
                                />
                                <ShaderPlanet
                                    theme={rightPlanetTheme}
                                    spinDirection={rightPlanetTheme === 'red' ? -1 : 1}
                                    isTurnActive={isRightPlanetTurnActive}
                                    motionSpeed={rightPlanetTheme === 'blue' ? bluePlanetSpinSpeed : redPlanetSpinSpeed}
                                    detailMode={detailMode}
                                    className={`planet-right ${isRightPlanetTurnInactive ? 'shader-planet-turn-inactive' : ''}`.trim()}
                                />
                            </div>

                            {/* Animated Energy Waves - Blue - Slower */}
                            <div className="absolute inset-0" style={{
                                background: `radial-gradient(circle at 30% 42%, ${leftSideAura} 0%, transparent 50%)`,
                                animation: isUltraLowDetail ? 'none' : `pulse ${isLowDetail ? 6.2 : 4.6}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                                opacity: isUltraLowDetail ? 0.35 : isLowDetail ? 0.62 : 1,
                                zIndex: 1
                            }}></div>

                            {/* Animated Energy Waves - Red - Slower */}
                            <div className="absolute inset-0" style={{
                                background: `radial-gradient(circle at ${rightAuraCenter}, ${rightSideAura} 0%, transparent 50%)`,
                                animation: isUltraLowDetail ? 'none' : `pulse ${isLowDetail ? 6.2 : 4.6}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                                animationDelay: '0.25s',
                                opacity: isUltraLowDetail ? 0.35 : isLowDetail ? 0.62 : 1,
                                zIndex: 1
                            }}></div>

                            {/* Animated Energy Waves - Purple - Slower */}
                            {!isUltraLowDetail && (
                                <div className="absolute inset-0" style={{
                                    background: `radial-gradient(circle at ${neutralAuraCenter}, rgba(150, 50, 255, ${isLowDetail ? 0.28 : 0.5}) 0%, transparent 50%)`,
                                    animation: `pulse ${isLowDetail ? 7.6 : 6}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                                    animationDelay: '1s',
                                    zIndex: 1
                                }}></div>
                            )}
                        </div>

                        {/* Content Container */}
                        <div className="flex-1 flex flex-row overflow-hidden relative" style={{ zIndex: 10 }}>

                            {/* Board + Timer Container */}
                            <div className="flex-1 flex flex-col overflow-visible relative">
                                {/* Game Board */}
                                <GameField
                                    gameState={gameState}
                                    targetMode={targetMode}
                                    handleCellClick={handleCellClick}
                                    handleUnitClick={handleUnitClick}
                                    onDismissMiss={clearMissMarksImmediatelyAt}
                                    onDismissCount={clearCountMarkersImmediatelyAt}
                                    isFlipped={pvpPerspectivePlayer === PlayerID.P2}
                                    viewerPlayerId={gameState.gameMode === 'pvp' ? (pvpPerspectivePlayer ?? undefined) : gameState.gameMode === 'sandbox' ? gameState.currentPlayer : PlayerID.P1}
                                    hoveredPos={hoveredPos}
                                    onHoverCell={handleHoverCell}
                                    disableBoardShake={disableBoardShake}
                                    evolutionFxEvent={evolutionFxEvent}
                                    clearPetalsNonce={clearPetalsNonce}
                                />

                                {/* Timer Bar Below Board */}
                                <div className="w-full px-8 py-3 flex items-center justify-center gap-6 relative z-20">
                                    <span className="text-white font-bold text-lg min-w-[80px]">
                                        {gameState.phase === 'placement' ? t('placement_phase') : gameState.phase === 'thinking' ? t('planning_phase') : t('action_phase')}
                                    </span>
                                    <div className="flex-1 max-w-2xl">
                                        <div className="w-full h-5 bg-slate-900 rounded-full overflow-hidden border-2 border-white/50 shadow-lg">
                                            {(() => {
                                                const maxTime = gameState.phase === 'placement' ? 45 : gameState.phase === 'thinking' ? 30 : 15;
                                                const percentage = (gameState.timeLeft / maxTime) * 100;
                                                // 顏色邏輯
                                                const color = percentage >= 67 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/60' :
                                                    percentage >= 34 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/60' :
                                                        'bg-red-500 shadow-lg shadow-red-500/60';
                                                // Sync transition with time freeze: 
                                                // If frozen, use very fast transition to halt visual movement instantly.
                                                // Normal: 1s linear transition for smooth countdown.
                                                const transitionClass = percentage >= 99
                                                    ? ''
                                                    : gameState.isTimeFrozen
                                                        ? 'transition-none'
                                                        : 'transition-all duration-150 ease-linear';
                                                return (
                                                    <div
                                                        className={`h-full ${color} ${transitionClass}`}
                                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end min-w-[80px]">
                                        <div
                                            className={`transition-opacity duration-75 ease-in-out ${gameState.isTimeFrozen ? 'opacity-100' : 'opacity-0'}`}
                                        >
                                            <Snowflake size={18} className="text-cyan-300 animate-spin-slow" />
                                        </div>
                                        <span className={`font-bold text-lg text-right transition-colors duration-75 ${gameState.isTimeFrozen ? 'text-cyan-300' : 'text-white'}`}>
                                            {Math.ceil(gameState.timeLeft)}s
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Log Panel Container */}
                            <div className={`shrink-0 z-20 relative transition-all duration-500 ease-in-out flex flex-row ${showLog ? 'w-80' : 'w-0'}`}>

                                {/* Toggle Button - Floating on the left edge of the panel */}
                                <button
                                    onClick={() => setShowLog(!showLog)}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-8 h-24 bg-slate-900 border-2 border-white border-r-0 rounded-l-2xl flex flex-col items-center justify-center text-white hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] z-30 group"
                                    title={showLog ? t('hide_log') : t('show_log')}
                                >
                                    {showLog ? <ChevronRight size={20} className="group-hover:scale-125 transition-transform" /> : <ChevronLeft size={20} className="group-hover:scale-125 transition-transform" />}
                                    <div className="text-[10px] font-black uppercase vertical-text mt-1 opacity-50 group-hover:opacity-100 transition-opacity">LOG</div>
                                </button>

                                {/* Log Panel Content */}
                                <div className={`w-80 h-full bg-slate-900 border-l-4 border-white flex flex-col text-sm transition-all duration-500 ${!showLog ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <div className="shrink-0 p-3 font-black border-b-2 border-white bg-slate-800 flex items-center gap-2 text-white">
                                        <Info size={18} />
                                        <span className="text-lg whitespace-nowrap overflow-hidden">{t('update_log')}</span>
                                    </div>

                                    <div ref={logScrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 text-sm scrollbar-thin scrollbar-thumb-white/30">
                                        {displayedLogs.map((log, i) => {
                                            const logKey = `${log.turn}|${log.messageKey}|${log.type}|${log.owner ?? 'global'}|${serializeLogParams(log.params)}|${displayedLogs.length - i}`;
                                            const isEvolutionAnnouncementLog = log.messageKey === 'log_evolved';
                                            const evolutionPrefix = isEvolutionAnnouncementLog && log.owner
                                                ? (
                                                    language === 'en'
                                                        ? (log.owner === localLogOwnerPlayerId ? '[ALLY] ' : '[ENEMY] ')
                                                        : language === 'zh_cn'
                                                            ? (log.owner === localLogOwnerPlayerId ? '[我方] ' : '[敌方] ')
                                                            : (log.owner === localLogOwnerPlayerId ? '[我方] ' : '[敵方] ')
                                                )
                                                : '';
                                            let resolvedLogParams = log.params;
                                            if (log.messageKey === 'log_devolved') {
                                                const p: Record<string, any> = { ...(resolvedLogParams || {}) };
                                                const unitTypeRaw = p.unitType;
                                                const unitType = isUnitTypeValue(unitTypeRaw) ? unitTypeRaw : null;
                                                const branchRaw = typeof p.branch === 'string' ? p.branch.toLowerCase() : '';
                                                const branch = branchRaw === 'a' || branchRaw === 'b' ? branchRaw : null;

                                                if (!p.unit && unitType) {
                                                    p.unit = getUnitNameKey(unitType);
                                                }
                                                if (typeof p.branch === 'string') {
                                                    p.branch = p.branch.toUpperCase();
                                                }
                                                if ((p.level === undefined || p.level === null || p.level === '') && log.owner && unitType && branch) {
                                                    p.level = gameState.players[log.owner].evolutionLevels[unitType][branch];
                                                }
                                                resolvedLogParams = p;
                                            }
                                            const translatedLogText = t(log.messageKey, resolvedLogParams);
                                            const firstMoverPlayerLabel = (() => {
                                                const player = String(log.params?.player ?? '');
                                                if (player === 'P1') {
                                                    return language === 'en' ? 'Blue' : (language === 'zh_cn' ? '蓝方' : '藍方');
                                                }
                                                if (player === 'P2') {
                                                    return language === 'en' ? 'Red' : (language === 'zh_cn' ? '红方' : '紅方');
                                                }
                                                return player;
                                            })();
                                            const fallbackFirstMoverText = (() => {
                                                if (log.messageKey === 'log_first_mover') {
                                                    if (language === 'en') return `${firstMoverPlayerLabel} won the initiative bid! First to move.`;
                                                    if (language === 'zh_cn') return `${firstMoverPlayerLabel} 的竞价胜出！获得先手权。`;
                                                    return `${firstMoverPlayerLabel} 的競標勝出！獲得先手權。`;
                                                }
                                                if (log.messageKey === 'log_first_mover_tie') {
                                                    if (language === 'en') return 'Initiative bid tied! First mover decided randomly.';
                                                    if (language === 'zh_cn') return '竞价平局！先手随机决定。';
                                                    return '競標平局！先手由隨機決定。';
                                                }
                                                return null;
                                            })();
                                            const logText = `${evolutionPrefix}${translatedLogText === log.messageKey && fallbackFirstMoverText ? fallbackFirstMoverText : translatedLogText}`;
                                            // Determine color primarily by owner side.
                                            // Any owned log is side-colored so players can see who acted.
                                            let bgColor = 'bg-slate-800/50 border-white text-white';

                                            if (PRIVATE_HINT_LOG_KEYS.has(log.messageKey)) {
                                                bgColor = 'bg-slate-700/40 border-slate-500 text-slate-200';
                                            } else if (isEvolutionAnnouncementLog) {
                                                bgColor = 'bg-purple-950/40 border-purple-500 text-purple-200';
                                            } else if (log.owner === PlayerID.P1) {
                                                bgColor = 'bg-blue-950/40 border-blue-500 text-blue-200';
                                            } else if (log.owner === PlayerID.P2) {
                                                bgColor = 'bg-red-950/40 border-red-500 text-red-200';
                                            } else if (log.type === 'error') {
                                                bgColor = 'bg-slate-700/40 border-slate-500 text-slate-300';
                                            } else {
                                                // Ownerless system/info logs
                                                bgColor = 'bg-yellow-950/40 border-yellow-500 text-yellow-200';
                                            }

                                            return (
                                                <div key={logKey} className={`p-2 rounded border-l-4 leading-tight font-bold text-xs ${bgColor}`}>
                                                    <span className="opacity-60 text-[10px] mr-2 font-bold text-gray-400">[{log.turn}]</span>
                                                    {logText}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Control Panel */}
                    <ControlPanel
                        gameState={gameState}
                        targetMode={targetMode}
                        setTargetMode={setTargetMode}
                        selectedMineType={selectedMineType}
                        setSelectedMineType={setSelectedMineType}
                        showEvolutionTree={showEvolutionTree}
                        setShowEvolutionTree={setShowEvolutionTree}
                        language={language}
                        isLocalPlayerTurn={isLocalPlayerTurn}
                        localPlayerId={localControlPlayer}
                        t={t}
                        aiDecision={aiDecision}
                        actions={{
                            handleActionComplete: executeEndTurnAction,
                            handleSkipTurn: executeSkipTurnAction,
                            handleScanAction: executeScanAction,
                            handlePlaceMineAction: executePlaceMineAction,
                            handleEvolve: executeEvolveAction,
                            handlePickupFlag: executePickupFlagAction,
                            handleDropFlag: executeDropFlagAction,
                            handleAttack: executeAttackAction,
                            handleStealth: handleStealthAction,
                        }}
                        helpers={{
                            getUnit: (id) => id ? (getUnit(id) ?? null) : null,
                            getActionButtonIndex: (action, unit) => unit ? getActionButtonIndex(action, unit) : -1,
                            getEvolutionButtonStartIndex,
                            getDisplayCost,
                            getNextUnitToAct: () => {
                                const player = gameState.players[gameState.currentPlayer];
                                // Use display order so swapping works
                                for (const unitId of player.unitDisplayOrder) {
                                    const unit = player.units.find(u => u.id === unitId);
                                    if (unit && !unit.isDead && !unit.hasActedThisRound) return unit;
                                }
                                return null;
                            }
                        }}
                        phases={{
                            finishPlacementPhase,
                            startActionPhase
                        }}
                        handleUnitClick={handleUnitClick}
                        handleDisarmAction={handleDisarmAction}
                        handlePlaceTowerAction={handlePlaceTowerAction}
                        handleDetonateTowerAction={handleDetonateTowerAction}
                        handlePlaceFactoryAction={handlePlaceFactoryAction}
                        handlePlaceHubAction={handlePlaceHubAction}
                        handleTeleportToHubAction={handleTeleportToHubAction}
                        handleStealthAction={handleStealthAction}
                        handleRangerAction={handleRangerAction}
                        swapUnits={swapUnitDisplayOrder}
                    />
                    {view === 'game' && isDevToolsAllowedInCurrentMatch && (
                        <DevToolsPanel
                            open={showDevTools}
                            onToggle={() => setShowDevTools(prev => !prev)}
                            aiDecision={aiDecision}
                            aiTuningProfile={aiTuningProfile}
                            setAiTuningProfile={setAiTuningProfile}
                            gameState={gameState}
                        />
                    )}

                    {/* Sandbox Panel */}
                    {/* Sandbox Panel moved to global overlay */}

                    {/* Sandbox Panel - Only visible in Sandbox Mode */}
                    {view === 'game' && isDevToolsAllowedInCurrentMatch && (
                        <SandboxPanel
                            gameState={gameState}
                            setGameState={setGameState}
                            startNewRound={playerActions.startNewRound}
                            language={language}
                            isSandboxCollapsed={isSandboxCollapsed}
                            setIsSandboxCollapsed={setIsSandboxCollapsed}
                            sandboxPos={sandboxPos}
                            onSandboxDragStart={onSandboxDragStart}
                            targetMode={targetMode}
                            setTargetMode={setTargetMode}
                            localPlayerId={localControlPlayer}
                            onStateMutated={(reason: string) => sendGameStateDeferred(`sandbox_${reason}`)}
                        />
                    )}

                </>
            )}
        </div>
    );
}




