import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, PlayerID } from '../types';
import { AIDifficulty } from '../ai/types';
import { Language } from '../i18n';
import { FlaskConical, Cpu, DoorOpen, Swords, X, ArrowRight, HelpCircle, Crown, Bomb, Users, Info, Settings } from '../icons';
import Tutorial from './Tutorial';
import CircularMeteorShower from './CircularMeteorShower';
import {
    getAvailablePhotonAppIds,
    getNetworkMode,
    getPreferredPhotonAppId,
    setPreferredNetworkMode,
    setPreferredPhotonAppId as savePreferredPhotonAppId,
    type NetworkMode,
    useConnection
} from '../network/ConnectionProvider';
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
    allowDevToolsInPvpRoom: boolean;
    setAllowDevToolsInPvpRoom: (value: boolean) => void;
    detailMode: VisualDetailMode;
    t: (key: string, params?: Record<string, any>) => string;
}

interface LobbyPreviewRoom {
    id: string;
    name: string;
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
    { id: '1001', name: 'Elite Arena' },
    { id: '1002', name: 'Noobs Only' },
    { id: '1003', name: 'Test Room' },
    { id: '1004', name: 'Championship' },
    { id: '1005', name: 'Casual Play' }
];
const ONLINE_MATCH_ROOM_NAME_OPTIONS = [
    'Elite Arena',
    'Noobs Only',
    'Test Room',
    'Championship',
    'Casual Play'
] as const;

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

const OFFICIAL_SITE_PHOTON_APP_ID = '15b845ad-9011-4f7e-b9fd-78c9e8aab8dc';
const ITCH_IO_PHOTON_APP_ID = '9f22e99c-fdd6-45ce-98e1-0014d7115e98';

const getPhotonAppIdRank = (appId: string): number => {
    if (appId === OFFICIAL_SITE_PHOTON_APP_ID) {
        return 0;
    }
    if (appId === ITCH_IO_PHOTON_APP_ID) {
        return 1;
    }
    return 2;
};

const formatPhotonAppIdLabel = (appId: string): string => {
    const normalized = appId.trim();
    if (normalized.length <= 16) {
        return normalized;
    }
    return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

const getPhotonAppIdDisplayName = (appId: string, isZh: boolean): string => {
    if (appId === OFFICIAL_SITE_PHOTON_APP_ID) {
        return isZh ? '遊戲官網' : 'Official Website';
    }
    if (appId === ITCH_IO_PHOTON_APP_ID) {
        return 'itch.io';
    }
    return formatPhotonAppIdLabel(appId);
};

const isOnlineMatchRoomName = (value: string): boolean => (
    (ONLINE_MATCH_ROOM_NAME_OPTIONS as readonly string[]).includes(value)
);

const isTransientNetworkProbeError = (message: string): boolean => {
    const lower = message.trim().toLowerCase();
    return (
        lower.includes('nameserver') ||
        lower.includes('master peer error') ||
        lower.includes('master server closed connection') ||
        lower.includes('connect failed') ||
        lower.includes('connect closed') ||
        lower.includes('timeout') ||
        lower.includes('network connection lost') ||
        lower.includes('trying to reconnect')
    );
};

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

const formatConnectionError = (message: string, isZh: boolean): string => {
    const normalized = message.trim();
    const lower = normalized.toLowerCase();

    if (lower.includes('does not exist')) {
        return isZh ? '房間不存在，請確認房間 ID。' : 'Room does not exist. Check the Room ID.';
    }
    if (lower.includes('is full')) {
        return isZh ? '房間已滿，請更換房間。' : 'Room is full. Please choose another room.';
    }
    if (lower.includes('is closed')) {
        return isZh ? '房間已關閉，暫時無法加入。' : 'Room is closed and cannot be joined now.';
    }
    if (lower.includes('already exists')) {
        return isZh ? '房間 ID 已存在，請更換一組。' : 'Room ID already exists. Pick another one.';
    }
    if (lower.includes('photon authentication failed')) {
        return isZh ? 'Photon 驗證失敗，請檢查 App ID 設定。' : 'Photon authentication failed. Check your App ID config.';
    }
    if (lower.includes('photon region is invalid')) {
        return isZh ? 'Photon 區域設定錯誤，請檢查 VITE_PHOTON_REGION。' : 'Photon region is invalid. Check VITE_PHOTON_REGION.';
    }
    if (lower.includes('nameserver')) {
        return isZh
            ? 'Photon 雲端連線暫時不穩（NameServer）。系統會自動重試，請稍候。'
            : 'Photon cloud connection is unstable (NameServer). The system will retry automatically.';
    }
    if (lower.includes('master peer error') || lower.includes('master server closed connection')) {
        return isZh
            ? 'Photon 主伺服器連線中斷，系統正在自動重連。'
            : 'Photon master server connection was interrupted. Reconnecting automatically.';
    }
    if (lower.includes('connect failed') || lower.includes('connect closed') || lower.includes('timeout')) {
        return isZh
            ? 'Photon 連線逾時或失敗，請稍後再試。'
            : 'Photon connection failed or timed out. Please try again shortly.';
    }
    if (lower.includes('plugin mismatch') || lower.includes('unsupported plugin') || lower.includes('plugin error')) {
        return isZh
            ? 'Photon 房間插件設定不相容。請到 Photon Dashboard 檢查該 App ID 的 Plugin/Webhooks 設定。'
            : 'Photon room plugin settings are incompatible. Check Plugin/Webhooks config in Photon Dashboard for this App ID.';
    }
    if (lower.includes('network connection lost') || lower.includes('trying to reconnect')) {
        return isZh ? '連線中斷，系統正在嘗試自動重連。' : 'Connection lost. Trying to reconnect automatically.';
    }

    return normalized;
};

const isJoinFlowFatalError = (message: string): boolean => {
    const lower = message.toLowerCase();
    return (
        lower.includes('does not exist') ||
        lower.includes('is full') ||
        lower.includes('is closed') ||
        lower.includes('already exists') ||
        lower.includes('not allowed to join') ||
        lower.includes('already joined')
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
    allowDevToolsInPvpRoom,
    setAllowDevToolsInPvpRoom,
    detailMode,
    t
}) => {
    const networkMode = typeof getNetworkMode === 'function' ? getNetworkMode() : 'peerjs';
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
    const [delayedConnectionError, setDelayedConnectionError] = useState<string | null>(null);
    const [switchingNetworkMode, setSwitchingNetworkMode] = useState<NetworkMode | null>(null);
    const [showAdvancedNetworkInfo, setShowAdvancedNetworkInfo] = useState(false);
    const [preferredPhotonAppId, setPreferredPhotonAppIdState] = useState<string>(() => getPreferredPhotonAppId());
    const helloSentKeyRef = useRef('');
    const photonLobbyProbeRef = useRef(false);

    const {
        status: connectionStatus,
        isConnected,
        localPeerId,
        remotePeerId,
        reconnectAttempt,
        error: connectionError,
        lobbyRooms,
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
    const networkModeLabel = networkMode === 'photon'
        ? (isZh ? '線上對決' : 'Online Match')
        : (isZh ? '區域連線' : 'LAN Connection');
    const normalizedConnectionError = connectionError
        ? formatConnectionError(connectionError, isZh)
        : null;
    const peerIdValidationText = isZh
        ? 'Room ID 必須是 4 位數字。'
        : 'Room ID must be exactly 4 digits.';

    const uiText = {
        joinLobby: isZh ? '雙人對戰' : '2P Battle',
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
        switchMode: isZh ? '切換連線模式' : 'Switch Connection Mode',
        lanConnection: networkMode === 'photon'
            ? (isZh ? '線上對決 (Photon)' : 'Online Match (Photon)')
            : (isZh ? '區域連線 (PeerJS)' : 'LAN Connection (PeerJS)'),
        enterRoomCode: isZh ? '輸入房間碼' : 'Enter Room Code',
        inputRoomHint: networkMode === 'photon'
            ? (isZh ? '輸入 4 位數房間 ID 加入雲端房間' : 'Input a 4-digit room ID to join a cloud room')
            : (isZh ? '輸入 4 位數房間 ID 加入' : 'Input a 4-digit room ID to join'),
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
        roomNameSelectHint: isZh ? '請選擇房間名稱' : 'Select Room Name',
        roomNameLimitedOnline: isZh ? '線上對戰只能選擇指定房間名稱。' : 'Online Match allows only preset room names.',
        allowDevToolsInPvpRoom: isZh ? 'PvP 對戰開放 Dev Tools/Sandbox' : 'Allow Dev Tools/Sandbox in PvP',
        waiting: isZh ? '等待中' : 'Waiting',
        playing: isZh ? '遊戲中' : 'Playing',
        createLobby: isZh ? '創建大廳' : 'Create Room',
        refreshId: isZh ? '重產 ID' : 'New',
        status: isZh ? '連線狀態' : 'Status',
        connectionMode: isZh ? '連線模式' : 'Mode',
        modePhoton: isZh ? '線上對決' : 'Online Match',
        modePeerjs: isZh ? '區域連線' : 'LAN Connection',
        switchModeHint: isZh ? '切換後會自動重新整理。' : 'Switching mode will reload the page.',
        switchingMode: isZh ? '正在切換模式...' : 'Switching mode...',
        moreInfo: isZh ? '查看更多資訊' : 'View More Info',
        hideInfo: isZh ? '隱藏資訊' : 'Hide Info',
        photonAppIdTitle: isZh ? '現在正在何處遊玩?' : 'Where Are You Playing?',
        photonAppIdCurrent: isZh ? '目前位置' : 'Current Location',
        photonAppIdHint: isZh ? '選好後這個視窗會自動收起。' : 'This panel closes after you choose.',
        active: isZh ? '目前' : 'Active',
        roomCount: isZh ? '房間數' : 'Room Count',
        localPeer: isZh ? '本機 Peer ID' : 'Local Peer ID',
        remotePeer: isZh ? '遠端 Peer ID' : 'Remote Peer ID',
        joinedRoom: isZh ? '已加入房間' : 'Joined Room',
        noRoomYet: isZh ? '還沒有房間？' : 'No room yet?'
    };

    const pveDifficultyTitle = isZh ? '選擇AI難度' : 'Choose AI Difficulty';
    const latestDeveloperLog = derivedLogs[0] ?? null;
    const isLowDetail = detailMode === 'low';
    const isUltraLowDetail = detailMode === 'ultra_low';
    const roomIdPreview = roomId || (joinMode === 'join' ? roomCode.trim() : createRoomId.trim()) || '-';
    const visibleConnectionError = networkUiError || delayedConnectionError;
    const availablePhotonAppIds = getAvailablePhotonAppIds();
    const sortedPhotonAppIds = [...availablePhotonAppIds].sort((a, b) => (
        getPhotonAppIdRank(a) - getPhotonAppIdRank(b) || a.localeCompare(b)
    ));
    const preferredPhotonAppLabel = getPhotonAppIdDisplayName(preferredPhotonAppId, isZh);
    const normalizedCreateRoomName = createRoomName.trim();
    const isOnlineRoomNameValid = networkMode !== 'photon' || isOnlineMatchRoomName(normalizedCreateRoomName);
    const lobbyPreviewRooms = networkMode === 'photon'
        ? LOBBY_PREVIEW_ROOMS.filter((room) => isOnlineMatchRoomName(room.name))
        : LOBBY_PREVIEW_ROOMS;
    const liveLobbyRoomById = useMemo(() => {
        const lookup = new Map<string, { playerCount: number; maxPlayers: number; isOpen: boolean; isVisible: boolean }>();
        lobbyRooms.forEach((roomSnapshot) => {
            const normalizedId = roomSnapshot.roomId.trim();
            if (!normalizedId) {
                return;
            }
            lookup.set(normalizedId, {
                playerCount: Math.max(0, roomSnapshot.playerCount),
                maxPlayers: Math.max(1, roomSnapshot.maxPlayers || 2),
                isOpen: roomSnapshot.isOpen,
                isVisible: roomSnapshot.isVisible
            });
        });
        return lookup;
    }, [lobbyRooms]);
    const lobbyPreviewCards = useMemo(() => (
        lobbyPreviewRooms.map((room) => {
            const liveRoom = liveLobbyRoomById.get(room.id);
            const playerCount = liveRoom?.playerCount ?? 0;
            const maxPlayers = liveRoom?.maxPlayers ?? 2;
            const hasLiveRoom = Boolean(liveRoom);
            const canJoin = Boolean(liveRoom && liveRoom.isOpen && liveRoom.isVisible && playerCount < maxPlayers);
            return {
                ...room,
                playerCount,
                maxPlayers,
                hasLiveRoom,
                canJoin
            };
        })
    ), [lobbyPreviewRooms, liveLobbyRoomById]);
    const canCreateRoom = (
        isValidPeerId(createRoomId.trim()) &&
        normalizedCreateRoomName.length > 0 &&
        isOnlineRoomNameValid &&
        (!createRoomNeedsPassword || createRoomPassword.trim().length > 0)
    );

    useEffect(() => {
        if (networkMode !== 'photon') {
            return;
        }
        setPreferredPhotonAppIdState(getPreferredPhotonAppId());
    }, [networkMode, showJoinModal, showAdvancedNetworkInfo]);

    useEffect(() => {
        if (networkMode !== 'photon') {
            return;
        }
        setCreateRoomName((current) => (isOnlineMatchRoomName(current.trim()) ? current : ''));
    }, [networkMode, showJoinModal]);

    useEffect(() => {
        if (!showJoinModal) {
            photonLobbyProbeRef.current = false;
            return;
        }
        if (networkMode !== 'photon' || roomId) {
            return;
        }
        if (
            connectionStatus === 'peer-opening' ||
            connectionStatus === 'peer-ready' ||
            connectionStatus === 'connecting' ||
            connectionStatus === 'connected' ||
            connectionStatus === 'reconnecting'
        ) {
            return;
        }
        if (photonLobbyProbeRef.current) {
            return;
        }

        photonLobbyProbeRef.current = true;
        openPeer()
            .then(() => {
                setNetworkUiError((current) => {
                    if (!current) {
                        return current;
                    }
                    const lower = current.toLowerCase();
                    if (lower.includes('photon') || lower.includes('master') || lower.includes('region')) {
                        return null;
                    }
                    return current;
                });
            })
            .catch((probeError) => {
                const probeMessage = probeError instanceof Error ? probeError.message : String(probeError);
                if (isTransientNetworkProbeError(probeMessage)) {
                    setNetworkUiError(null);
                    return;
                }
                setNetworkUiError(probeMessage);
            });
    }, [connectionStatus, networkMode, openPeer, roomId, showJoinModal]);

    useEffect(() => {
        if (showJoinModal) {
            setShowAdvancedNetworkInfo(false);
        }
    }, [showJoinModal]);

    useEffect(() => {
        if (connectionStatus === 'peer-ready' || connectionStatus === 'connected') {
            setNetworkUiError((current) => {
                if (!current) {
                    return current;
                }
                return isTransientNetworkProbeError(current) ? null : current;
            });
        }
    }, [connectionStatus]);

    useEffect(() => {
        setDelayedConnectionError(null);
        if (!normalizedConnectionError || isConnected || connectionStatus === 'connected') {
            return;
        }

        const timer = window.setTimeout(() => {
            setDelayedConnectionError(normalizedConnectionError);
        }, 2000);

        return () => window.clearTimeout(timer);
    }, [connectionStatus, isConnected, normalizedConnectionError]);

    useEffect(() => {
        if (!roomId || isHost) {
            return;
        }
        if (connectionStatus !== 'error') {
            return;
        }

        const fallbackMessage = networkUiError || normalizedConnectionError;
        if (!fallbackMessage || !isJoinFlowFatalError(fallbackMessage)) {
            return;
        }

        disconnect();
        setRoomCode(roomId);
        setRoomId(null);
        setJoinedRoomName('');
        setJoinMode('join');
        setShowJoinModal(true);
        setNetworkUiError(fallbackMessage);
        helloSentKeyRef.current = '';
    }, [connectionStatus, disconnect, isHost, networkUiError, normalizedConnectionError, roomId, setRoomId]);

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

    const handleSwitchNetworkMode = (mode: NetworkMode) => {
        if (switchingNetworkMode || mode === networkMode) {
            return;
        }

        setSwitchingNetworkMode(mode);
        resetLobbyNetworkState();
        if (typeof setPreferredNetworkMode === 'function') {
            setPreferredNetworkMode(mode);
        }
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    const renderNetworkModeSwitcher = () => {
        const isSwitching = Boolean(switchingNetworkMode);
        return (
            <div className="rounded border border-slate-700 bg-slate-950/70 p-3 text-[11px] font-mono text-cyan-200">
                <div className="text-slate-300">{uiText.switchMode}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleSwitchNetworkMode('photon')}
                        disabled={isSwitching || networkMode === 'photon'}
                        className={`rounded border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            networkMode === 'photon'
                                ? 'border-cyan-400 bg-cyan-600/30 text-cyan-100'
                                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-500/70 hover:text-cyan-200'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        {uiText.modePhoton}
                    </button>
                    <button
                        onClick={() => handleSwitchNetworkMode('peerjs')}
                        disabled={isSwitching || networkMode === 'peerjs'}
                        className={`rounded border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            networkMode === 'peerjs'
                                ? 'border-cyan-400 bg-cyan-600/30 text-cyan-100'
                                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-500/70 hover:text-cyan-200'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        {uiText.modePeerjs}
                    </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                    {isSwitching ? uiText.switchingMode : uiText.switchModeHint}
                </div>
            </div>
        );
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
        if (networkMode === 'photon' && !isOnlineMatchRoomName(roomName)) {
            setNetworkUiError(uiText.roomNameLimitedOnline);
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
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 rounded-xl font-black text-lg shadow-2xl shadow-yellow-500/50 transform scale-[1.08] hover:scale-[1.12] transition-all duration-200 flex items-center justify-center gap-3 border-2 border-white/75"
                            >
                                <FlaskConical size={22} />
                                {t('sandbox_mode')}
                            </button>

                            <button
                                onClick={() => {
                                    setJoinMode('join');
                                    setNetworkUiError(null);
                                    setJoinRoomPassword('');
                                    setJoinedRoomName('');
                                    setShowJoinModal(true);
                                }}
                                className="mx-6 min-w-[170px] px-8 py-4 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 rounded-xl font-black text-lg shadow-2xl shadow-indigo-500/45 transform scale-[1.3] hover:scale-[1.36] transition-all duration-200 flex items-center justify-center gap-3 border-2 border-indigo-300 text-white"
                            >
                                <DoorOpen size={22} />
                                {uiText.joinLobby}
                            </button>

                            <div className="flex flex-wrap items-stretch justify-center gap-3">
                                <button
                                    onClick={() => setShowPveDifficultyPanel(prev => !prev)}
                                    className="relative min-w-[170px] px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl font-black text-lg shadow-2xl shadow-violet-500/50 transform scale-[1.08] hover:scale-[1.12] transition-all duration-200 flex items-center justify-center gap-3 border-2 border-violet-300"
                                >
                                    <Cpu size={22} />
                                    <span className="relative">
                                        <span>{t('pve_mode')}</span>
                                        <span className="absolute left-0 top-full -mt-1.5 text-[10px] font-semibold text-violet-100/80 whitespace-nowrap">
                                            {isZh ? '開發中' : 'In Development'}
                                        </span>
                                    </span>
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
                        <div className="w-full min-w-[320px] md:min-w-[420px]">
                            {renderNetworkModeSwitcher()}
                        </div>
                        <div className="rounded-2xl border border-cyan-500/60 bg-cyan-950/60 p-4 text-sm font-mono text-cyan-100 min-w-[320px] md:min-w-[420px]">
                            <div>{uiText.status}: {connectionStatus}</div>
                            <div>{uiText.connectionMode}: {networkModeLabel}</div>
                            <div className="break-all">{uiText.roomId}: {roomId || '-'}</div>
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
                        {uiText.joinedRoom}: {roomId}{joinedRoomName ? ` (${joinedRoomName})` : ''} · {networkModeLabel}
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
                                    {lobbyPreviewCards.map(room => {
                                        const isHighlighted = room.hasLiveRoom;
                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => {
                                                    if (!isHighlighted) return;
                                                    setJoinMode('join');
                                                    setRoomCode(room.id);
                                                    setNetworkUiError(null);
                                                }}
                                                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${isHighlighted
                                                    ? 'border-cyan-500/70 bg-slate-800/60 shadow-[0_0_18px_rgba(34,211,238,0.2)] hover:border-cyan-300 hover:bg-slate-800/85 cursor-pointer'
                                                    : 'border-slate-800 bg-slate-900/60 opacity-55 cursor-not-allowed'}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className={`font-black text-2xl md:text-3xl leading-tight ${isHighlighted ? 'text-white drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]' : 'text-slate-500'}`}>
                                                        {room.name}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                                                        {uiText.roomCount}
                                                    </div>
                                                    <div className={`mt-0.5 flex items-center gap-1 ${isHighlighted ? 'text-cyan-200' : 'text-slate-400'}`}>
                                                        <Users size={14} />
                                                        <span className="text-sm font-mono">{room.playerCount}/{room.maxPlayers}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="w-full lg:w-1/3 bg-slate-950/80 flex flex-col items-center justify-start p-6 pt-10 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, cyan 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                <div className="relative z-10 w-full max-w-sm h-full min-h-0 flex flex-col">
                                    <div className="space-y-4">
                                        {renderNetworkModeSwitcher()}

                                        {showAdvancedNetworkInfo && (
                                            <>
                                                {networkMode === 'photon' && sortedPhotonAppIds.length > 0 && (
                                                    <div className="rounded border border-slate-700 bg-slate-950/70 p-3 text-[11px] font-mono text-cyan-200">
                                                        <div className="text-slate-300">{uiText.photonAppIdTitle}</div>
                                                        <div className="mt-2 grid gap-2">
                                                            {sortedPhotonAppIds.map((appId) => {
                                                                const isActiveAppId = preferredPhotonAppId === appId;
                                                                return (
                                                                    <button
                                                                        key={appId}
                                                                        onClick={() => {
                                                                            savePreferredPhotonAppId(appId);
                                                                            setPreferredPhotonAppIdState(appId);
                                                                            setNetworkUiError(null);
                                                                            setShowAdvancedNetworkInfo(false);
                                                                        }}
                                                                        className={`flex items-center justify-between rounded border px-2 py-1.5 text-[11px] transition-colors ${
                                                                            isActiveAppId
                                                                                ? 'border-cyan-400 bg-cyan-600/30 text-cyan-100'
                                                                                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-500/70 hover:text-cyan-200'
                                                                        }`}
                                                                    >
                                                                        <span>{getPhotonAppIdDisplayName(appId, isZh)}</span>
                                                                        <span className={`text-[10px] ${isActiveAppId ? 'text-cyan-100' : 'text-slate-500'}`}>
                                                                            {isActiveAppId ? uiText.active : ''}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-2 text-[10px] text-slate-400">
                                                            {uiText.photonAppIdCurrent}: {preferredPhotonAppLabel || '-'}
                                                        </div>
                                                        <div className="mt-1 text-[10px] text-slate-500">
                                                            {uiText.photonAppIdHint}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="rounded border border-slate-700 bg-slate-950/70 p-3 text-[11px] font-mono text-cyan-200">
                                                    <div>{uiText.status}: {connectionStatus}</div>
                                                    <div>{uiText.connectionMode}: {networkModeLabel}</div>
                                                    <div className="break-all">{uiText.roomId}: {roomIdPreview}</div>
                                                    {networkMode === 'photon' && (
                                                        <div>{uiText.photonAppIdCurrent}: {preferredPhotonAppLabel || '-'}</div>
                                                    )}
                                                    <div className="break-all">{uiText.localPeer}: {localPeerId || '-'}</div>
                                                    <div className="break-all">{uiText.remotePeer}: {remotePeerId || '-'}</div>
                                                </div>
                                            </>
                                        )}

                                        {visibleConnectionError && (
                                            <div className="rounded border border-red-500/50 bg-red-950/40 p-2 text-xs text-red-200">
                                                {visibleConnectionError}
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
                                                {networkMode === 'photon' ? (
                                                    <select
                                                        value={createRoomName}
                                                        onChange={(event) => setCreateRoomName(event.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white cursor-pointer"
                                                    >
                                                        <option value="" className="bg-slate-900 text-slate-400">
                                                            {uiText.roomNameSelectHint}
                                                        </option>
                                                        {ONLINE_MATCH_ROOM_NAME_OPTIONS.map((name) => (
                                                            <option key={name} value={name} className="bg-slate-900 text-white">
                                                                {name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={createRoomName}
                                                        onChange={(event) => setCreateRoomName(event.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
                                                        placeholder={uiText.roomName}
                                                    />
                                                )}
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
                                                <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                                                    <span>{uiText.allowDevToolsInPvpRoom}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={allowDevToolsInPvpRoom}
                                                        onChange={(event) => setAllowDevToolsInPvpRoom(event.target.checked)}
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
                                                    disabled={!canCreateRoom}
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

                                    <div className="mt-auto pt-3 border-t border-slate-800/60 flex justify-center">
                                        <button
                                            onClick={() => setShowAdvancedNetworkInfo((current) => !current)}
                                            className="text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                                        >
                                            {showAdvancedNetworkInfo ? uiText.hideInfo : uiText.moreInfo}
                                        </button>
                                    </div>
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

