import React, { useEffect, useRef, useState } from 'react';
import { GameState, PlayerID } from '../types';
import { AIDifficulty } from '../ai/types';
import { Language } from '../i18n';
import { FlaskConical, Cpu, DoorOpen, Swords, X, ArrowRight, HelpCircle, Crown, Bomb, Users, Info, Settings } from '../icons';
import Tutorial from './Tutorial';
import CircularMeteorShower from './CircularMeteorShower';
import { useConnection } from '../network/ConnectionProvider';
import { AuthResultPayload } from '../network/protocol';
import developerLogOverviewRaw from '../../遊戲文章總覽.MD?raw';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { VisualDetailMode } from '../visualDetail';



interface GameModalsProps {
    view: 'lobby' | 'game';
    gameState: GameState;
    language: Language;
    aiDifficulty: AIDifficulty;
    setAiDifficulty: (diff: AIDifficulty) => void;
    onStartGame: (mode: 'pvp' | 'pve' | 'sandbox') => void;
    onExitGame: () => void;
    onRestart: () => void;
    onPauseToggle: () => void;
    isHost: boolean;
    setIsHost: (val: boolean) => void;
    roomId: string | null;
    setRoomId: (id: string | null) => void;
    onOpenSettings: () => void;
    detailMode: VisualDetailMode;
    t: (key: string, params?: Record<string, any>) => string;
}

interface LobbyPreviewRoom {
    id: string;
    name: string;
    players: number;
    maxPlayers: number;
    status: 'waiting' | 'playing';
}

interface DeveloperLogEntry {
    id: string;
    title: string;
    dateLabel: string;
    dateSortValue: number;
    content: string;
    preview: string;
}

const LOBBY_PREVIEW_ROOMS: LobbyPreviewRoom[] = [
    { id: '1001', name: 'Elite Arena', players: 1, maxPlayers: 2, status: 'waiting' },
    { id: '1002', name: 'Noobs Only', players: 2, maxPlayers: 2, status: 'playing' },
    { id: '1003', name: 'Test Room', players: 0, maxPlayers: 2, status: 'waiting' },
    { id: '1004', name: 'Championship', players: 2, maxPlayers: 2, status: 'playing' },
    { id: '1005', name: 'Casual Play', players: 1, maxPlayers: 2, status: 'waiting' },
    { id: '1006', name: 'Late Night', players: 1, maxPlayers: 2, status: 'waiting' }
];

const PEER_ID_PATTERN = /^\d{4}$/;
const DEVELOPER_LOG_HEADER_PATTERN = /^(\d+)\.\((\d{1,2})\/(\d{1,2})\)(.+)$/gm;

const normalizeDeveloperLogPreview = (content: string): string => {
    const normalized = content
        .replace(/\r/g, '')
        .replace(/^#+\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/[*`_~]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (normalized.length <= 160) {
        return normalized;
    }

    return `${normalized.slice(0, 160).trim()}...`;
};

const parseDeveloperLogs = (rawContent: string): DeveloperLogEntry[] => {
    const normalizedRaw = rawContent.replace(/\r\n/g, '\n');

    // Find all starting positions of headers
    const headerIndices: number[] = [];
    let match;
    const regex = new RegExp(DEVELOPER_LOG_HEADER_PATTERN);
    while ((match = regex.exec(normalizedRaw)) !== null) {
        headerIndices.push(match.index);
    }

    if (headerIndices.length === 0) return [];

    const logs: DeveloperLogEntry[] = [];

    for (let i = 0; i < headerIndices.length; i++) {
        const start = headerIndices[i];
        const end = i + 1 < headerIndices.length ? headerIndices[i + 1] : normalizedRaw.length;
        const rawArticle = normalizedRaw.slice(start, end).trim();

        // Extract title and date from the first line
        // We remove the '$' anchor because rawArticle contains the entire body
        const singleHeaderPattern = /^(\d+)\.\((\d{1,2})\/(\d{1,2})\)(.+)/;
        const headerMatch = rawArticle.match(singleHeaderPattern);
        if (headerMatch) {
            const id = headerMatch[1];
            const month = Number(headerMatch[2]);
            const day = Number(headerMatch[3]);
            const title = headerMatch[4].trim();

            // Content starts after the first line
            const contentLines = rawArticle.split('\n');
            const content = contentLines.slice(1).join('\n').trim();

            logs.push({
                id,
                title,
                dateLabel: `${headerMatch[2]}/${headerMatch[3]}`,
                dateSortValue: month * 100 + day,
                content: content,
                preview: normalizeDeveloperLogPreview(content)
            });
        }
    }

    return logs.sort((a, b) => b.dateSortValue - a.dateSortValue || Number(b.id) - Number(a.id));
};

const normalizePeerIdInput = (value: string): string => (
    value.replace(/\D/g, '').slice(0, 4)
);

const isValidPeerId = (value: string): boolean => PEER_ID_PATTERN.test(value);

const isAuthResultPayload = (payload: unknown): payload is AuthResultPayload => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const candidate = payload as Partial<AuthResultPayload>;
    return (
        typeof candidate.accepted === 'boolean' &&
        (candidate.reason === undefined || typeof candidate.reason === 'string') &&
        (candidate.roomName === undefined || typeof candidate.roomName === 'string')
    );
};

const GameModals: React.FC<GameModalsProps> = ({
    view,
    gameState,
    language,
    aiDifficulty,
    setAiDifficulty,
    onStartGame,
    onExitGame,
    onRestart,
    onPauseToggle,
    isHost,
    setIsHost,
    roomId,
    setRoomId,
    onOpenSettings,
    detailMode,
    t
}) => {
    // Dynamically derive DEVELOPER_LOGS to support localization from i18n.ts
    const derivedLogs: DeveloperLogEntry[] = (() => {
        // If the language is Traditional Chinese, always use the raw markdown file
        // to ensure the full original content is visible.
        if (language === 'zh_tw') {
            return parseDeveloperLogs(developerLogOverviewRaw);
        }

        const translatedLogs: DeveloperLogEntry[] = [];
        for (let i = 1; i <= 10; i++) {
            const title = t(`dev_log_${i}_title`);
            // If the key is returned same as key name, it's missing (usually t function behavior)
            // Or if it returns empty/missing.
            if (!title || title === `dev_log_${i}_title`) continue;

            translatedLogs.push({
                id: t(`dev_log_${i}_id`),
                title,
                dateLabel: t(`dev_log_${i}_date`),
                dateSortValue: i, // Simple sort for predefined ones
                content: t(`dev_log_${i}_content`),
                preview: normalizeDeveloperLogPreview(t(`dev_log_${i}_content`))
            });
        }

        if (translatedLogs.length > 0) {
            return translatedLogs.sort((a, b) => Number(b.id) - Number(a.id));
        }

        // Fallback to parsing the raw markdown file if no translations are found
        return parseDeveloperLogs(developerLogOverviewRaw);
    })();
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [joinMode, setJoinMode] = useState<'join' | 'create'>('join');
    const [roomCode, setRoomCode] = useState('');
    const [createRoomId, setCreateRoomId] = useState('');
    const [createRoomName, setCreateRoomName] = useState('');
    const [joinedRoomName, setJoinedRoomName] = useState('');
    const [createRoomNeedsPassword, setCreateRoomNeedsPassword] = useState(false);
    const [createRoomPassword, setCreateRoomPassword] = useState('');
    const [joinRoomPassword, setJoinRoomPassword] = useState('');
    const [networkUiError, setNetworkUiError] = useState<string | null>(null);
    const [showPveDifficultyPanel, setShowPveDifficultyPanel] = useState(false);
    const [showDeveloperLogModal, setShowDeveloperLogModal] = useState(false);
    const helloSentKeyRef = useRef('');

    const {
        status: connectionStatus,
        isConnected,
        localPeerId,
        remotePeerId,
        reconnectAttempt,
        error: connectionError,
        lastIncomingPacket,
        generatePeerId,
        openPeer,
        connectToPeer,
        reconnect,
        sendActionPacket,
        disconnect,
        destroyPeer
    } = useConnection();

    const isZh = language === 'zh_tw' || language === 'zh_cn';
    const peerIdValidationText = isZh
        ? 'Room ID 必須是 4 位數字。'
        : 'Room ID must be exactly 4 digits.';

    const uiText = {
        joinLobby: isZh ? '加入大廳' : 'Join Lobby',
        lobbyList: isZh ? '大廳列表' : 'Lobby List',
        tutorial: isZh ? '新手教學' : 'Tutorial',
        developerLog: isZh ? '開發者日誌' : 'Developer Log',
        latestArticle: isZh ? '最新文章' : 'Latest Post',
        allDeveloperLogs: isZh ? '文章總覽（新到舊）' : 'All posts (newest first)',
        emptyDeveloperLogs: isZh ? '目前沒有開發者日誌文章。' : 'No developer log entries yet.',
        leave: isZh ? '離開' : 'Leave',
        leaveLobby: isZh ? '離開大廳' : 'Leave Lobby',
        startGame: isZh ? '開始對戰' : 'Start Game',
        waitingForHost: isZh ? '等待房主開始遊戲' : 'Waiting for host to start game',
        reconnect: isZh ? '重新連線' : 'Reconnect',
        lanConnection: isZh ? '區域網路連線' : 'LAN Connection',
        enterRoomCode: isZh ? '輸入房間碼' : 'Enter Room Code',
        inputRoomHint: isZh ? '輸入 4 位數房間 ID 加入' : 'Input a 4-digit room ID to join',
        roomPassword: isZh ? '房間密碼' : 'Room Password',
        joinPasswordHint: isZh ? '若房間有密碼，請輸入密碼' : 'Enter password if room is protected',
        requirePassword: isZh ? '需要密碼' : 'Require Password',
        passwordRequired: isZh ? '已勾選需要密碼，請輸入密碼。' : 'Please enter a password for this room.',
        passwordRejected: isZh ? '房間密碼錯誤，無法加入。' : 'Incorrect room password.',
        passwordRejectedHost: isZh ? '有玩家輸入錯誤密碼，已拒絕加入。' : 'A player entered a wrong password and was rejected.',
        joinRoom: isZh ? '加入房間' : 'Join Room',
        createRoom: isZh ? '建立房間' : 'Create Room',
        joinExistingRoom: isZh ? '加入既有房間' : 'Join Existing Room',
        roomId: isZh ? '房間 ID' : 'Room ID',
        roomName: isZh ? '房間名稱' : 'Room Name',
        waiting: isZh ? '等待中' : 'Waiting',
        playing: isZh ? '遊戲中' : 'Playing',
        createLobby: isZh ? '創建大廳' : 'Create Room',
        refreshId: isZh ? '重產 ID' : 'New',
        status: isZh ? '連線狀態' : 'Status',
        localPeer: isZh ? '本機 Peer ID' : 'Local Peer ID',
        remotePeer: isZh ? '遠端 Peer ID' : 'Remote Peer ID',
        joinedRoom: isZh ? '已加入房間' : 'Joined Room',
        noRoomYet: isZh ? '還沒有房間？' : 'No room yet?'
    };

    const pveDifficultyTitle = isZh ? '選擇AI難度' : 'Choose AI Difficulty';
    const latestDeveloperLog = derivedLogs[0] ?? null;
    const isLowDetail = detailMode === 'low';
    const isUltraLowDetail = detailMode === 'ultra_low';

    useEffect(() => {
        if (joinMode !== 'create') {
            return;
        }

        setCreateRoomId((currentId) => currentId || generatePeerId());
    }, [generatePeerId, joinMode]);

    useEffect(() => {
        if (!roomId || !isConnected || !remotePeerId) return;

        const key = `${roomId}:${remotePeerId}`;
        if (helloSentKeyRef.current === key) return;

        sendActionPacket({
            type: 'HELLO',
            matchId: roomId,
            turn: gameState.turnCount,
            payload: {
                role: isHost ? 'host' : 'guest',
                peerId: localPeerId,
                password: isHost ? undefined : joinRoomPassword.trim()
            }
        });
        helloSentKeyRef.current = key;
    }, [gameState.turnCount, isConnected, isHost, joinRoomPassword, localPeerId, remotePeerId, roomId, sendActionPacket]);

    useEffect(() => {
        if (!lastIncomingPacket || !roomId) {
            return;
        }
        if (lastIncomingPacket.matchId !== roomId) {
            return;
        }

        if (isHost && lastIncomingPacket.type === 'HELLO') {
            const helloPayload = lastIncomingPacket.payload as {
                role?: unknown;
                password?: unknown;
            };
            if (helloPayload.role !== 'guest') {
                return;
            }

            const expectedPassword = createRoomNeedsPassword ? createRoomPassword.trim() : '';
            const providedPassword = typeof helloPayload.password === 'string'
                ? helloPayload.password.trim()
                : '';
            const accepted = !expectedPassword || providedPassword === expectedPassword;

            sendActionPacket({
                type: 'AUTH_RESULT',
                matchId: roomId,
                turn: gameState.turnCount,
                payload: {
                    accepted,
                    reason: accepted ? undefined : uiText.passwordRejected,
                    roomName: createRoomName.trim() || undefined
                }
            }, { requireAck: false });

            if (!accepted) {
                setNetworkUiError(uiText.passwordRejectedHost);
                disconnect();
                helloSentKeyRef.current = '';
            }
            return;
        }

        if (!isHost && lastIncomingPacket.type === 'AUTH_RESULT') {
            if (!isAuthResultPayload(lastIncomingPacket.payload)) {
                return;
            }

            if (lastIncomingPacket.payload.accepted) {
                const incomingRoomName = lastIncomingPacket.payload.roomName?.trim();
                if (incomingRoomName) {
                    setJoinedRoomName(incomingRoomName);
                }
                setNetworkUiError(null);
                return;
            }

            setNetworkUiError(lastIncomingPacket.payload.reason || uiText.passwordRejected);
            disconnect();
            setRoomId(null);
            setIsHost(false);
            setJoinedRoomName('');
            setJoinMode('join');
            setShowJoinModal(true);
            helloSentKeyRef.current = '';
        }
    }, [
        createRoomNeedsPassword,
        createRoomName,
        createRoomPassword,
        disconnect,
        gameState.turnCount,
        isHost,
        lastIncomingPacket,
        roomId,
        sendActionPacket,
        setIsHost,
        setRoomId,
        uiText.passwordRejected,
        uiText.passwordRejectedHost
    ]);

    const resetLobbyNetworkState = () => {
        destroyPeer();
        setRoomId(null);
        setIsHost(false);
        setJoinedRoomName('');
        setNetworkUiError(null);
        setRoomCode('');
        setJoinRoomPassword('');
        helloSentKeyRef.current = '';
    };

    const handleCreateRoom = async () => {
        const preferredRoomId = createRoomId.trim();
        const roomName = createRoomName.trim();
        const roomPassword = createRoomPassword.trim();
        if (!preferredRoomId || !roomName) return;
        if (!isValidPeerId(preferredRoomId)) {
            setNetworkUiError(peerIdValidationText);
            return;
        }
        if (createRoomNeedsPassword && !roomPassword) {
            setNetworkUiError(uiText.passwordRequired);
            return;
        }

        setNetworkUiError(null);
        try {
            const openedId = await openPeer(preferredRoomId);
            setRoomId(openedId);
            setIsHost(true);
            setJoinedRoomName(roomName);
            setShowJoinModal(false);
        } catch (openError) {
            setNetworkUiError(openError instanceof Error ? openError.message : String(openError));
        }
    };

    const handleJoinRoom = async () => {
        const targetRoomId = roomCode.trim();
        if (!targetRoomId) return;
        if (!isValidPeerId(targetRoomId)) {
            setNetworkUiError(peerIdValidationText);
            return;
        }

        setNetworkUiError(null);
        try {
            await openPeer();
            connectToPeer(targetRoomId);
            setRoomId(targetRoomId);
            setIsHost(false);
            setJoinedRoomName(LOBBY_PREVIEW_ROOMS.find((room) => room.id === targetRoomId)?.name || '');
            setShowJoinModal(false);
        } catch (openError) {
            setNetworkUiError(openError instanceof Error ? openError.message : String(openError));
        }
    };

    const handleStartMultiplayerGame = () => {
        if (!isHost || !roomId) return;
        onStartGame('pvp');
    };




    if (view === 'lobby') {
        return (
            <div
                className="flex flex-col items-center justify-center h-full p-4 relative w-full absolute inset-0 z-50 overflow-hidden"
                style={{
                    background: `
                        radial-gradient(72% 120% at -8% 50%, rgba(0, 185, 255, 0.58) 0%, rgba(0, 120, 255, 0.26) 38%, rgba(0, 0, 0, 0) 70%),
                        radial-gradient(72% 120% at 108% 50%, rgba(255, 40, 90, 0.62) 0%, rgba(255, 0, 80, 0.24) 38%, rgba(0, 0, 0, 0) 70%),
                        linear-gradient(90deg, #061a4a 0%, #24004a 50%, #4a0018 100%)
                    `
                }}
            >
                <CircularMeteorShower className="z-0 opacity-100" detailMode={detailMode} />
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
                    <div
                        className="absolute inset-0 mix-blend-screen"
                        style={{
                            opacity: isUltraLowDetail ? 0.35 : isLowDetail ? 0.5 : 0.7,
                            background: `
                                radial-gradient(70% 120% at 0% 52%, rgba(56, 189, 248, 0.28) 0%, rgba(56, 189, 248, 0.08) 38%, rgba(56, 189, 248, 0) 72%),
                                radial-gradient(70% 120% at 100% 52%, rgba(244, 63, 94, 0.28) 0%, rgba(244, 63, 94, 0.08) 38%, rgba(244, 63, 94, 0) 72%),
                                radial-gradient(32% 40% at 50% 54%, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0) 100%)
                            `
                        }}
                    />
                    <div className="absolute top-4 left-2 md:top-8 md:left-6 z-[1]">
                        <div
                            className="absolute inset-0 rounded-full bg-cyan-400/25 blur-[56px] scale-[1.85]"
                            style={{ animation: isUltraLowDetail ? 'none' : `cloud-flow ${isLowDetail ? 9 : 6}s ease-in-out infinite` }}
                        />
                        <div style={{ animation: isUltraLowDetail ? 'none' : `fadeInOut ${isLowDetail ? 6.2 : 4}s ease-in-out infinite` }}>
                            <Bomb size={220} className="text-cyan-300 drop-shadow-[0_0_28px_rgba(34,211,238,0.8)] relative z-10" />
                        </div>
                    </div>

                    <div className="absolute bottom-4 right-2 md:bottom-8 md:right-6 z-[1]">
                        <div
                            className="absolute inset-0 rounded-full bg-red-500/25 blur-[56px] scale-[1.85]"
                            style={{ animation: isUltraLowDetail ? 'none' : `cloud-flow ${isLowDetail ? 9 : 6}s ease-in-out infinite reverse` }}
                        />
                        <div style={{ animation: isUltraLowDetail ? 'none' : `fadeInOut ${isLowDetail ? 6.2 : 4}s ease-in-out infinite` }}>
                            <Crown size={240} className="text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.85)] relative z-10" />
                        </div>
                    </div>

                    <div
                        className="absolute inset-0"
                        style={{
                            opacity: isUltraLowDetail ? 0.03 : isLowDetail ? 0.06 : 0.1,
                            backgroundImage: `
                                linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent),
                                linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.08) 25%, rgba(0, 255, 255, 0.08) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.08) 75%, rgba(0, 255, 255, 0.08) 76%, transparent 77%, transparent)
                            `,
                            backgroundSize: isUltraLowDetail ? '100px 100px' : isLowDetail ? '80px 80px' : '60px 60px'
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-red-500/10" />
                </div>

                <div className="relative z-10 text-center space-y-3 pt-32 lg:pt-40">
                    <h1 className="neon-title text-5xl md:text-7xl font-black drop-shadow-2xl">
                        {t('app_title')}
                    </h1>
                    <p className="text-cyan-300 max-w-xl mx-auto font-semibold tracking-[0.08em]">{t('lobby_desc')}</p>
                </div>

                {!roomId ? (
                    <div className="relative z-10 mt-10 flex w-full max-w-5xl flex-col items-center gap-6">
                        <div className="flex flex-wrap items-stretch justify-center gap-6">
                            <button
                                onClick={() => onStartGame('sandbox')}
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 rounded-xl font-black text-lg shadow-2xl shadow-yellow-500/50 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-amber-300"
                            >
                                <FlaskConical size={22} />
                                {t('sandbox_mode')}
                            </button>

                            <div className="flex flex-wrap items-stretch justify-center gap-3">
                                <button
                                    onClick={() => setShowPveDifficultyPanel(prev => !prev)}
                                    className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl font-black text-lg shadow-2xl shadow-violet-500/50 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-violet-300"
                                >
                                    <Cpu size={22} />
                                    {t('pve_mode')}
                                </button>

                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-out ${showPveDifficultyPanel
                                        ? 'max-w-[240px] opacity-100 translate-x-0'
                                        : 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                                        }`}
                                >
                                    <div className="w-[220px] px-4 py-2.5 bg-slate-900/70 border border-violet-400/35 rounded-xl flex flex-col items-center justify-center gap-2 shadow-2xl shadow-violet-500/20">
                                        <div className="text-sm font-black text-slate-200">{pveDifficultyTitle}</div>
                                        <div className="flex items-center gap-2">
                                            {(['easy', 'normal', 'hard'] as AIDifficulty[]).map(level => (
                                                <button
                                                    key={level}
                                                    onClick={() => {
                                                        setAiDifficulty(level);
                                                        onStartGame('pve');
                                                    }}
                                                    className={`px-3 py-1 rounded-lg text-xs font-black border transition-all ${level === 'easy'
                                                        ? (aiDifficulty === level
                                                            ? 'bg-sky-500 text-white border-sky-200 shadow-[0_0_10px_rgba(14,165,233,0.45)]'
                                                            : 'bg-sky-600 text-white border-sky-400 hover:bg-sky-500')
                                                        : level === 'normal'
                                                            ? (aiDifficulty === level
                                                                ? 'bg-emerald-500 text-white border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                                                                : 'bg-emerald-600 text-white border-emerald-400 hover:bg-emerald-500')
                                                            : (aiDifficulty === level
                                                                ? 'bg-violet-600 text-white border-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.45)]'
                                                                : 'bg-violet-700 text-white border-violet-400 hover:bg-violet-600')
                                                        }`}
                                                >
                                                    {t(level)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setJoinMode('join');
                                    setNetworkUiError(null);
                                    setJoinRoomPassword('');
                                    setJoinedRoomName('');
                                    setShowJoinModal(true);
                                }}
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 rounded-xl font-black text-lg shadow-2xl shadow-indigo-500/45 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-indigo-300 text-white"
                            >
                                <DoorOpen size={22} />
                                {uiText.joinLobby}
                            </button>
                        </div>

                        {latestDeveloperLog && (
                            <button
                                onClick={() => setShowDeveloperLogModal(true)}
                                className="w-full max-w-lg rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center shadow-lg transition-all hover:bg-white/10 hover:scale-[1.01]"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase opacity-80">LATEST LOG</span>
                                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                                        <span className="text-[9px] font-bold text-slate-400 font-mono">{latestDeveloperLog.dateLabel}</span>
                                    </div>
                                    <h3 className="text-sm font-black text-white/90 truncate w-full">{latestDeveloperLog.title}</h3>
                                    <p className="text-[10px] text-slate-400 truncate w-full opacity-70">
                                        {latestDeveloperLog.preview}
                                    </p>
                                </div>
                            </button>
                        )}

                        <button
                            onClick={() => setShowTutorial(true)}
                            className="min-w-[150px] px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl font-black text-base shadow-xl shadow-emerald-500/30 transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 border-2 border-emerald-300"
                        >
                            <HelpCircle size={20} />
                            {uiText.tutorial}
                        </button>
                    </div>
                ) : (
                    <div className="relative z-10 mt-8 flex flex-col items-center gap-4">
                        <div className="rounded-2xl border border-cyan-500/60 bg-cyan-950/60 p-4 text-sm font-mono text-cyan-100 min-w-[320px] md:min-w-[420px]">
                            <div>{uiText.status}: {connectionStatus}</div>
                            <div className="break-all">{uiText.roomName}: {joinedRoomName || '-'}</div>
                            <div className="break-all">{uiText.localPeer}: {localPeerId || '-'}</div>
                            <div className="break-all">{uiText.remotePeer}: {remotePeerId || '-'}</div>
                        </div>

                        {isHost ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={resetLobbyNetworkState}
                                        className="px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white text-lg transition-all border-2 border-slate-500"
                                    >
                                        {uiText.leave}
                                    </button>
                                    <button
                                        onClick={handleStartMultiplayerGame}
                                        disabled={!isConnected || !remotePeerId}
                                        className="px-10 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl font-black text-lg shadow-2xl shadow-orange-500/50 transition-all duration-200 flex items-center gap-3 border-2 border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Swords size={22} />
                                        {uiText.startGame}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="text-lg font-bold text-cyan-300 animate-pulse">{uiText.waitingForHost}</div>
                                <button
                                    onClick={resetLobbyNetworkState}
                                    className="px-6 py-2 bg-slate-700/70 hover:bg-slate-600 rounded-lg text-slate-200 text-sm border border-slate-500"
                                >
                                    {uiText.leaveLobby}
                                </button>
                            </div>
                        )}

                        {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
                            <button
                                onClick={() => reconnect()}
                                className="px-4 py-2 border border-cyan-300/60 rounded-lg text-cyan-200 text-sm hover:bg-cyan-950/40"
                            >
                                {uiText.reconnect} #{reconnectAttempt}
                            </button>
                        )}
                    </div>
                )}

                {roomId && (
                    <div className="absolute top-4 left-4 z-20 bg-cyan-900/80 border border-cyan-500 px-4 py-2 rounded-full text-cyan-200 font-bold backdrop-blur-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        {uiText.joinedRoom}: {roomId}{joinedRoomName ? ` (${joinedRoomName})` : ''}
                    </div>
                )}

                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    <button
                        onClick={onOpenSettings}
                        className="p-2.5 bg-slate-900/70 hover:bg-slate-800/80 rounded-lg border border-cyan-500/40 transition-colors flex items-center gap-2 text-cyan-100"
                    >
                        <Settings size={16} />
                        <span className="text-xs font-bold">{t('settings')}</span>
                    </button>
                </div>

                {showJoinModal && (
                    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-md p-4">
                        <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl shadow-2xl shadow-cyan-500/20 max-w-6xl w-full h-[min(90vh,640px)] flex flex-col lg:flex-row overflow-hidden relative">
                            <button
                                onClick={() => {
                                    setNetworkUiError(null);
                                    setShowJoinModal(false);
                                }}
                                className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-700"
                            >
                                <X size={20} />
                            </button>

                            <div className="w-full lg:w-2/3 border-b lg:border-b-0 lg:border-r border-slate-700/80 bg-slate-900/60 flex flex-col min-h-0">
                                <div className="p-5 border-b border-slate-700/80 bg-slate-800/40">
                                    <h2 className="text-3xl font-black text-white flex items-center gap-2">
                                        <Users size={24} className="text-cyan-400" />
                                        {uiText.lobbyList}
                                    </h2>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {LOBBY_PREVIEW_ROOMS.map(room => {
                                        const canJoin = room.status === 'waiting';
                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => {
                                                    if (!canJoin) return;
                                                    setJoinMode('join');
                                                    setRoomCode(room.id);
                                                }}
                                                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${canJoin
                                                    ? 'border-slate-600 hover:border-cyan-400 bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer'
                                                    : 'border-slate-800 bg-slate-900/60 opacity-60 cursor-not-allowed'}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className={`font-black text-2xl md:text-3xl leading-tight ${canJoin ? 'text-white' : 'text-slate-500'}`}>
                                                        {room.name}
                                                    </div>
                                                    <div className="text-xs font-mono text-slate-400 mt-1">ID: {room.id}</div>
                                                </div>
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-black ${canJoin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                        {canJoin ? uiText.waiting : uiText.playing}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-slate-300">
                                                        <Users size={14} />
                                                        <span className="text-sm font-mono">{room.players}/{room.maxPlayers}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="w-full lg:w-1/3 bg-slate-950/80 flex flex-col items-center justify-start p-6 pt-10 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, cyan 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                <div className="relative z-10 w-full max-w-sm space-y-4">
                                    <div className="rounded border border-slate-700 bg-slate-950/70 p-3 text-[11px] font-mono text-cyan-200">
                                        <div>{uiText.status}: {connectionStatus}</div>
                                        <div className="break-all">{uiText.localPeer}: {localPeerId || '-'}</div>
                                        <div className="break-all">{uiText.remotePeer}: {remotePeerId || '-'}</div>
                                    </div>

                                    {(networkUiError || connectionError) && (
                                        <div className="rounded border border-red-500/50 bg-red-950/40 p-2 text-xs text-red-200">
                                            {networkUiError || connectionError}
                                        </div>
                                    )}

                                    {joinMode === 'join' ? (
                                        <div className="space-y-4">
                                            <div className="text-center">
                                                <h3 className="text-3xl font-black text-white mb-1">{uiText.enterRoomCode}</h3>
                                                <p className="text-xs text-slate-400">{uiText.inputRoomHint}</p>
                                            </div>

                                            <input
                                                type="text"
                                                value={roomCode}
                                                onChange={(event) => setRoomCode(normalizePeerIdInput(event.target.value))}
                                                className="w-full bg-slate-900 border-2 border-slate-700 rounded-lg p-4 text-white font-black text-center focus:border-cyan-500 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] outline-none text-2xl tracking-[0.2em] transition-all"
                                                placeholder="____"
                                                inputMode="numeric"
                                                pattern="[0-9]{4}"
                                                maxLength={4}
                                            />

                                            <input
                                                type="password"
                                                value={joinRoomPassword}
                                                onChange={(event) => setJoinRoomPassword(event.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                                                placeholder={uiText.joinPasswordHint}
                                                maxLength={32}
                                            />

                                            <button
                                                onClick={handleJoinRoom}
                                                disabled={!isValidPeerId(roomCode.trim())}
                                                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-white text-lg shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {uiText.joinRoom}
                                                <ArrowRight size={18} />
                                            </button>

                                            <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800/50">
                                                <span className="text-xs text-slate-500">{uiText.noRoomYet}</span>
                                                <button
                                                    onClick={() => setJoinMode('create')}
                                                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline"
                                                >
                                                    {uiText.createLobby}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="text-center">
                                                <h3 className="text-2xl font-black text-white mb-1">{uiText.createLobby}</h3>
                                                <p className="text-xs text-slate-400">{uiText.lanConnection}</p>
                                            </div>

                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={createRoomId}
                                                    onChange={(event) => setCreateRoomId(normalizePeerIdInput(event.target.value))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white font-mono"
                                                    placeholder={uiText.roomId}
                                                    inputMode="numeric"
                                                    pattern="[0-9]{4}"
                                                    maxLength={4}
                                                />
                                                <button
                                                    onClick={() => setCreateRoomId(generatePeerId())}
                                                    className="px-3 py-2 rounded border border-slate-600 text-xs font-bold hover:bg-slate-800"
                                                >
                                                    {uiText.refreshId}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={createRoomName}
                                                onChange={(event) => setCreateRoomName(event.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                                                placeholder={uiText.roomName}
                                            />
                                            <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                                                <span>{uiText.requirePassword}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={createRoomNeedsPassword}
                                                    onChange={(event) => {
                                                        const nextChecked = event.target.checked;
                                                        setCreateRoomNeedsPassword(nextChecked);
                                                        if (!nextChecked) {
                                                            setCreateRoomPassword('');
                                                        }
                                                    }}
                                                    className="h-4 w-4 accent-cyan-500"
                                                />
                                            </label>
                                            {createRoomNeedsPassword && (
                                                <input
                                                    type="password"
                                                    value={createRoomPassword}
                                                    onChange={(event) => setCreateRoomPassword(event.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                                                    placeholder={uiText.roomPassword}
                                                    maxLength={32}
                                                />
                                            )}
                                            <button
                                                onClick={handleCreateRoom}
                                                disabled={!isValidPeerId(createRoomId.trim()) || !createRoomName.trim() || (createRoomNeedsPassword && !createRoomPassword.trim())}
                                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {uiText.createRoom}
                                            </button>
                                            <button
                                                onClick={() => setJoinMode('join')}
                                                className="w-full py-2 text-cyan-300 text-sm underline"
                                            >
                                                {uiText.joinExistingRoom}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showDeveloperLogModal && (
                    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-md p-4">
                        <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl shadow-2xl shadow-cyan-500/20 max-w-5xl w-full h-[min(90vh,720px)] flex flex-col overflow-hidden relative">
                            <button
                                onClick={() => setShowDeveloperLogModal(false)}
                                className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-700"
                            >
                                <X size={20} />
                            </button>

                            <div className="px-6 py-5 border-b border-slate-700/80 bg-slate-900/80">
                                <h2 className="text-3xl font-black text-white flex items-center gap-3">
                                    <Info size={24} className="text-cyan-300" />
                                    {uiText.developerLog}
                                </h2>
                                <p className="mt-1 text-sm text-cyan-200/90">{uiText.allDeveloperLogs}</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {derivedLogs.length === 0 && (
                                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-5 text-slate-300">
                                        {uiText.emptyDeveloperLogs}
                                    </div>
                                )}
                                {derivedLogs.map((article: DeveloperLogEntry) => (
                                    <article key={article.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-lg font-black text-white">{article.title}</h3>
                                            <span className="rounded-md border border-cyan-400/35 bg-cyan-950/60 px-2.5 py-1 text-xs font-mono text-cyan-100">{article.dateLabel}</span>
                                        </div>
                                        <div className="mt-3 text-xs leading-relaxed text-slate-200 font-sans markdown-content">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                {article.content}
                                            </ReactMarkdown>
                                        </div>


                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <a
                    href="https://ratiostudio.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-900/70 px-4 py-1.5 text-cyan-100 shadow-lg shadow-cyan-500/15 backdrop-blur-sm hover:bg-slate-800 hover:border-cyan-300 transition-all cursor-pointer group"
                >
                    <span className="text-xs font-bold tracking-wide group-hover:text-white transition-colors">Ratio Studio</span>
                </a>

                {showTutorial && <Tutorial language={language} onClose={() => setShowTutorial(false)} />}
            </div>
        );
    }

    return (
        <>
            {gameState.gameOver && (
                <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                    <div className="text-center space-y-6">
                        <h1 className="text-7xl font-black text-yellow-400 drop-shadow-2xl animate-pulse">{t('game_over')}</h1>
                        <div className="text-5xl font-black">
                            {gameState.winner === PlayerID.P1 ? (
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Player 1 {t('wins')}</span>
                            ) : (
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-500">Player 2 {t('wins')}</span>
                            )}
                        </div>
                        <div className="flex gap-4 justify-center">
                            <button onClick={onRestart} className="px-8 py-4 bg-emerald-600 rounded-lg font-black text-lg">
                                {t('play_again')}
                            </button>
                            <button onClick={onExitGame} className="px-8 py-4 bg-slate-700 rounded-lg font-black text-lg">
                                {t('exit_lobby')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {gameState.isPaused && (
                <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
                    <div className="text-center space-y-6">
                        <h1 className="text-7xl font-black text-cyan-400 drop-shadow-2xl animate-pulse">{t('paused')}</h1>
                        <div className="flex gap-4 justify-center">
                            <button onClick={onPauseToggle} className="px-8 py-4 bg-cyan-600 rounded-lg font-black text-lg">
                                {t('resume')}
                            </button>
                            <button onClick={onExitGame} className="px-8 py-4 bg-slate-700 rounded-lg font-black text-lg">
                                {t('exit_lobby')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GameModals;
