import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    ActionPacket,
    ActionPacketType,
    buildActionPacket,
    getAckFor,
    isActionPacket
} from './protocol';
import type {
    ConnectionContextValue,
    LobbyRoomSnapshot,
    ConnectionStatus,
    OpenPeerOptions,
    RoomMatchStatus
} from './PeerJsConnectionProvider';

interface SendPacketOptions {
    requireAck?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
}

interface PendingPacket {
    encoded: string;
    retries: number;
    timeoutMs: number;
    maxRetries: number;
    timer: ReturnType<typeof setTimeout> | null;
}

interface SendActionPacketInput<TPayload> {
    type: ActionPacketType;
    matchId: string;
    turn: number;
    payload: TPayload;
}

interface PhotonConfig {
    appId: string;
    appVersion: string;
    region: string;
    protocol: 'ws' | 'wss';
}

interface PhotonConnectOptions {
    roomToCreate?: string;
    localPeerId?: string;
    roomLabel?: string;
    matchStatus?: RoomMatchStatus;
}

type PhotonActorLike = {
    actorNr?: number;
    isLocal?: boolean;
    userId?: string;
    name?: string;
};

type PhotonRoomInfoLike = {
    name?: string;
    playerCount?: number;
    maxPlayers?: number;
    isOpen?: boolean;
    isVisible?: boolean;
    removed?: boolean;
    getCustomProperty?: (key: string) => unknown;
    getCustomProperties?: () => Record<string, unknown>;
    customProperties?: Record<string, unknown>;
    _customProperties?: Record<string, unknown>;
};

type PhotonClientLike = {
    connectToRegionMaster: (region: string) => boolean;
    disconnect: () => void;
    joinRoom: (roomName: string, options?: Record<string, unknown>) => boolean;
    leaveRoom?: () => boolean;
    raiseEvent: (code: number, payload: unknown, options?: Record<string, unknown>) => void;
    isJoinedToRoom: () => boolean;
    myRoom?: () => {
        name?: string;
        setCustomProperty?: (key: string, value: unknown) => void;
        setIsOpen?: (isOpen: boolean) => void;
    } | null;
    availableRooms?: () => PhotonRoomInfoLike[];
    myRoomActorsArray?: () => PhotonActorLike[];
    setUserId?: (userId: string) => void;
    onStateChange?: (state: number) => void;
    onJoinRoom?: (createdByMe: boolean) => void;
    onActorJoin?: (actor: PhotonActorLike) => void;
    onActorLeave?: (actor: PhotonActorLike, isInactive: boolean) => void;
    onEvent?: (code: number, data: unknown, actorNr: number) => void;
    onError?: (code: number, message: string) => void;
    onRoomList?: (roomInfos: PhotonRoomInfoLike[]) => void;
    onRoomListUpdate?: (
        roomInfos: PhotonRoomInfoLike[],
        roomsUpdated: PhotonRoomInfoLike[],
        roomsAdded: PhotonRoomInfoLike[],
        roomsRemoved: PhotonRoomInfoLike[]
    ) => void;
    onOperationResponse?: (
        errorCode: number,
        errorMsg: string,
        code: number,
        content: Record<string, unknown>
    ) => void;
};

interface LoadBalancingClientCtor {
    new (protocol: number, appId: string, appVersion: string): PhotonClientLike;
    State: Record<string, number>;
}

type PhotonModuleLike = {
    ConnectionProtocol: {
        Ws: number;
        Wss: number;
    };
    PhotonPeer?: {
        setWebSocketImpl?: (impl: unknown) => void;
    };
    LoadBalancing: {
        LoadBalancingClient: LoadBalancingClientCtor;
        Constants: {
            ReceiverGroup: {
                Others: number;
            };
            ErrorCode?: Record<string, number>;
            OperationCode?: {
                CreateGame?: number;
                JoinGame?: number;
                Leave?: number;
            };
        };
    };
};

const ACK_TIMEOUT_MS = 2500;
const ACK_MAX_RETRIES = 2;
const MAX_REMEMBERED_RECEIVED_SEQ = 512;
const PHOTON_EVENT_CODE = 1;
const PHOTON_APP_ID_STORAGE_KEY = 'minechess_photon_app_id';
const DEFAULT_PHOTON_PRIMARY_APP_ID = '15b845ad-9011-4f7e-b9fd-78c9e8aab8dc';
const DEFAULT_PHOTON_SECONDARY_APP_ID = '9f22e99c-fdd6-45ce-98e1-0014d7115e98';
const DEFAULT_PHOTON_REGION = 'us';
const DEFAULT_PHOTON_VERSION = '1.0';
const DEFAULT_PHOTON_PROTOCOL: PhotonConfig['protocol'] = 'wss';

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

let photonModulePromise: Promise<PhotonModuleLike> | null = null;

const loadPhotonModule = async (): Promise<PhotonModuleLike> => {
    if (!photonModulePromise) {
        photonModulePromise = import('photon-realtime').then((loaded) => {
            const resolved = (loaded as { default?: unknown }).default ?? loaded;
            return resolved as PhotonModuleLike;
        });
    }
    return photonModulePromise;
};

const formatErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

const normalizeLobbyRooms = (roomInfos: PhotonRoomInfoLike[] | null | undefined): LobbyRoomSnapshot[] => {
    if (!Array.isArray(roomInfos)) {
        return [];
    }

    const readCustomProperty = (room: PhotonRoomInfoLike, key: string): unknown => {
        if (typeof room.getCustomProperty === 'function') {
            return room.getCustomProperty(key);
        }
        if (typeof room.getCustomProperties === 'function') {
            return room.getCustomProperties()?.[key];
        }
        if (room.customProperties && key in room.customProperties) {
            return room.customProperties[key];
        }
        if (room._customProperties && key in room._customProperties) {
            return room._customProperties[key];
        }
        return undefined;
    };

    const normalizeMatchStatus = (
        rawStatus: unknown,
        playerCount: number,
        maxPlayers: number,
        isOpen: boolean
    ): RoomMatchStatus => {
        if (rawStatus === 'waiting_players' || rawStatus === 'waiting_start' || rawStatus === 'playing') {
            return rawStatus;
        }
        if (!isOpen) {
            return 'playing';
        }
        if (playerCount >= maxPlayers) {
            return 'waiting_start';
        }
        return 'waiting_players';
    };

    return roomInfos
        .filter((room) => room && !room.removed && typeof room.name === 'string' && room.name.trim().length > 0)
        .map((room) => {
            const roomId = room.name?.trim() || '';
            const rawMaxPlayers = typeof room.maxPlayers === 'number' ? room.maxPlayers : 0;
            const maxPlayers = rawMaxPlayers > 0 ? rawMaxPlayers : 2;
            const playerCount = typeof room.playerCount === 'number' ? Math.max(0, room.playerCount) : 0;
            const isOpen = room.isOpen !== false;
            const roomLabel = typeof readCustomProperty(room, 'roomLabel') === 'string'
                ? String(readCustomProperty(room, 'roomLabel')).trim()
                : '';
            const matchStatus = normalizeMatchStatus(
                readCustomProperty(room, 'matchStatus'),
                playerCount,
                maxPlayers,
                isOpen
            );
            return {
                roomId,
                playerCount,
                maxPlayers,
                isOpen,
                isVisible: room.isVisible !== false,
                roomLabel: roomLabel || undefined,
                matchStatus
            };
        })
        .sort((a, b) => a.roomId.localeCompare(b.roomId));
};

const toRawString = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const normalizePhotonAppId = (value: string | null | undefined): string | null => {
    const normalized = (value || '').trim();
    if (!normalized) {
        return null;
    }
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized);
    return isGuid ? normalized : null;
};

const dedupePhotonAppIds = (input: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    input.forEach((candidate) => {
        const normalized = normalizePhotonAppId(candidate);
        if (!normalized) {
            return;
        }
        const dedupeKey = normalized.toLowerCase();
        if (seen.has(dedupeKey)) {
            return;
        }
        seen.add(dedupeKey);
        result.push(normalized);
    });
    return result;
};

const getBuiltInPhotonAppIds = (): string[] => dedupePhotonAppIds([
    DEFAULT_PHOTON_PRIMARY_APP_ID,
    DEFAULT_PHOTON_SECONDARY_APP_ID
]);

const getEnvPhotonAppIds = (): string[] => dedupePhotonAppIds([
    import.meta.env.VITE_PHOTON_APP_ID,
    import.meta.env.VITE_PHOTON_APP_ID_BACKUP
]);

export const getAvailablePhotonAppIds = (): string[] => (
    dedupePhotonAppIds([
        ...getEnvPhotonAppIds(),
        ...getBuiltInPhotonAppIds()
    ])
);

export const getPreferredPhotonAppId = (): string => {
    const available = getAvailablePhotonAppIds();
    const fallback = available[0] || DEFAULT_PHOTON_PRIMARY_APP_ID;
    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const stored = normalizePhotonAppId(window.localStorage.getItem(PHOTON_APP_ID_STORAGE_KEY));
        return stored || fallback;
    } catch {
        return fallback;
    }
};

export const setPreferredPhotonAppId = (appId: string): void => {
    if (typeof window === 'undefined') {
        return;
    }

    const normalized = normalizePhotonAppId(appId);
    if (!normalized) {
        return;
    }

    try {
        window.localStorage.setItem(PHOTON_APP_ID_STORAGE_KEY, normalized);
    } catch {
        // no-op
    }
};

export const clearPreferredPhotonAppId = (): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(PHOTON_APP_ID_STORAGE_KEY);
    } catch {
        // no-op
    }
};

const getPhotonAppIdCandidates = (preferredAppId: string): string[] => (
    dedupePhotonAppIds([
        preferredAppId,
        ...getAvailablePhotonAppIds()
    ])
);

const resolvePhotonConfig = (): PhotonConfig => {
    const appId = getPreferredPhotonAppId();
    const appVersion = (import.meta.env.VITE_PHOTON_APP_VERSION || DEFAULT_PHOTON_VERSION).trim();
    const region = (import.meta.env.VITE_PHOTON_REGION || DEFAULT_PHOTON_REGION).trim();
    const protocolValue = (import.meta.env.VITE_PHOTON_PROTOCOL || DEFAULT_PHOTON_PROTOCOL)
        .trim()
        .toLowerCase();

    return {
        appId: appId || DEFAULT_PHOTON_PRIMARY_APP_ID,
        appVersion: appVersion || DEFAULT_PHOTON_VERSION,
        region: region || DEFAULT_PHOTON_REGION,
        protocol: protocolValue === 'ws' ? 'ws' : 'wss'
    };
};

const normalizeRoomId = (value: string): string => value.trim();

const normalizePhotonActorId = (actor: PhotonActorLike): string => {
    const byUserId = actor.userId?.trim();
    if (byUserId) {
        return byUserId;
    }

    if (typeof actor.actorNr === 'number') {
        return String(actor.actorNr);
    }

    const byName = actor.name?.trim();
    if (byName) {
        return byName;
    }

    return '';
};

const DEFAULT_PHOTON_ERROR_CODES = {
    InvalidAuthentication: 32767,
    GameIdAlreadyExists: 32766,
    GameFull: 32765,
    GameClosed: 32764,
    ServerFull: 32762,
    GameDoesNotExist: 32758,
    InvalidRegion: 32756,
    PluginReportedError: 32752,
    PluginMismatch: 32751,
    JoinFailedPeerAlreadyJoined: 32750,
    JoinFailedFoundInactiveJoiner: 32749,
    JoinFailedWithRejoinerNotFound: 32748,
    JoinFailedFoundExcludedUserId: 32747,
    JoinFailedFoundActiveJoiner: 32746
} as const;

const getPhotonCode = (
    errorCodes: Record<string, number> | undefined,
    key: keyof typeof DEFAULT_PHOTON_ERROR_CODES
): number => errorCodes?.[key] ?? DEFAULT_PHOTON_ERROR_CODES[key];

const isFatalReconnectError = (
    errorCode: number,
    errorCodes: Record<string, number> | undefined
): boolean => {
    const fatalErrors = new Set<number>([
        getPhotonCode(errorCodes, 'InvalidAuthentication'),
        getPhotonCode(errorCodes, 'InvalidRegion'),
        getPhotonCode(errorCodes, 'PluginReportedError'),
        getPhotonCode(errorCodes, 'PluginMismatch'),
        getPhotonCode(errorCodes, 'GameIdAlreadyExists'),
        getPhotonCode(errorCodes, 'GameFull'),
        getPhotonCode(errorCodes, 'GameClosed'),
        getPhotonCode(errorCodes, 'GameDoesNotExist'),
        getPhotonCode(errorCodes, 'JoinFailedPeerAlreadyJoined'),
        getPhotonCode(errorCodes, 'JoinFailedFoundInactiveJoiner'),
        getPhotonCode(errorCodes, 'JoinFailedWithRejoinerNotFound'),
        getPhotonCode(errorCodes, 'JoinFailedFoundExcludedUserId'),
        getPhotonCode(errorCodes, 'JoinFailedFoundActiveJoiner')
    ]);

    return fatalErrors.has(errorCode);
};

const formatPhotonOperationError = (input: {
    errorCode: number;
    errorMessage: string;
    operationCode: number;
    operationCodes?: Record<string, number>;
    errorCodes?: Record<string, number>;
    roomId: string | null;
}): string => {
    const roomLabel = input.roomId ? `Room ${input.roomId}` : 'Room';
    const joinGameCode = input.operationCodes?.JoinGame;
    const createGameCode = input.operationCodes?.CreateGame;
    const isJoinRoomOp = input.operationCode === joinGameCode;
    const isCreateRoomOp = input.operationCode === createGameCode;
    const fallback = input.errorMessage?.trim() || `Photon operation failed (${input.errorCode}).`;

    if (input.errorCode === getPhotonCode(input.errorCodes, 'GameDoesNotExist')) {
        return `${roomLabel} does not exist.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'GameFull')) {
        return `${roomLabel} is full.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'GameClosed')) {
        return `${roomLabel} is closed.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'GameIdAlreadyExists')) {
        return `${roomLabel} already exists. Choose another Room ID.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'JoinFailedPeerAlreadyJoined')) {
        return `You already joined ${roomLabel}.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'JoinFailedFoundActiveJoiner')) {
        return `${roomLabel} already has an active session for this user.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'JoinFailedFoundExcludedUserId')) {
        return `You are not allowed to join ${roomLabel}.`;
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'InvalidAuthentication')) {
        return 'Photon authentication failed. Check VITE_PHOTON_APP_ID.';
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'InvalidRegion')) {
        return 'Photon region is invalid. Check VITE_PHOTON_REGION.';
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'ServerFull')) {
        return 'Photon server is busy. Please try again in a moment.';
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'PluginMismatch')) {
        return 'Photon plugin mismatch. Check your Photon dashboard plugin settings for this App ID.';
    }
    if (input.errorCode === getPhotonCode(input.errorCodes, 'PluginReportedError')) {
        return `Photon plugin error: ${fallback}`;
    }

    if (isJoinRoomOp && !input.errorMessage?.trim()) {
        return `Failed to join ${roomLabel}. (${input.errorCode})`;
    }
    if (isCreateRoomOp && !input.errorMessage?.trim()) {
        return `Failed to create ${roomLabel}. (${input.errorCode})`;
    }

    return fallback;
};

const shouldRetryWithBackupAppId = (message: string, roomToCreate: string): boolean => {
    const normalized = (message || '').trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    if (roomToCreate && normalized.includes('already exists')) {
        return false;
    }

    if (normalized.includes('is full') || normalized.includes('is closed')) {
        return false;
    }

    return true;
};

export const PhotonConnectionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [localPeerId, setLocalPeerId] = useState<string | null>(null);
    const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [lastIncomingRaw, setLastIncomingRaw] = useState<string | null>(null);
    const [lastIncomingData, setLastIncomingData] = useState<unknown>(null);
    const [lastIncomingPacket, setLastIncomingPacket] = useState<ActionPacket | null>(null);
    const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lobbyRooms, setLobbyRooms] = useState<LobbyRoomSnapshot[]>([]);

    const photonModuleRef = useRef<PhotonModuleLike | null>(null);
    const clientRef = useRef<PhotonClientLike | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectFnRef = useRef<(() => Promise<boolean>) | null>(null);
    const autoReconnectBlockedRef = useRef(false);
    const lastOperationErrorRef = useRef<{ message: string; at: number } | null>(null);
    const manualDisconnectRef = useRef(false);
    const nextSeqRef = useRef(1);
    const reconnectAttemptsRef = useRef(0);
    const pendingPacketsRef = useRef<Map<number, PendingPacket>>(new Map());
    const receivedSeqSetRef = useRef<Set<number>>(new Set());
    const receivedSeqOrderRef = useRef<number[]>([]);
    const lastOpenedPeerIdRef = useRef<string | null>(null);
    const lastTargetRoomIdRef = useRef<string | null>(null);
    const localCreatedRoomRef = useRef(false);
    const currentRoomIdRef = useRef<string | null>(null);

    const generatePeerId = useCallback(() => {
        const randomNumber = Math.floor(Math.random() * 10000);
        return randomNumber.toString().padStart(4, '0');
    }, []);

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (manualDisconnectRef.current) {
            return;
        }
        if (autoReconnectBlockedRef.current) {
            return;
        }
        if (!lastOpenedPeerIdRef.current) {
            return;
        }
        if (!localCreatedRoomRef.current && !lastTargetRoomIdRef.current) {
            return;
        }
        if (reconnectTimerRef.current) {
            return;
        }

        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;
        setReconnectAttempt(nextAttempt);
        setStatus('reconnecting');

        const delayMs = Math.min(1000 * Math.pow(2, Math.max(0, nextAttempt - 1)), 10000);
        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            const reconnectFn = reconnectFnRef.current;
            if (!reconnectFn) {
                return;
            }

            reconnectFn()
                .then((ok) => {
                    if (ok) {
                        return;
                    }
                    scheduleReconnect();
                })
                .catch(() => {
                    scheduleReconnect();
                });
        }, delayMs);
    }, []);

    const clearPendingPacket = useCallback((seq: number) => {
        const pending = pendingPacketsRef.current.get(seq);
        if (pending?.timer) {
            clearTimeout(pending.timer);
        }
        pendingPacketsRef.current.delete(seq);
    }, []);

    const clearAllPendingPackets = useCallback(() => {
        pendingPacketsRef.current.forEach((pending) => {
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
        });
        pendingPacketsRef.current.clear();
    }, []);

    const rememberReceivedSeq = useCallback((seq: number) => {
        if (receivedSeqSetRef.current.has(seq)) {
            return;
        }

        receivedSeqSetRef.current.add(seq);
        receivedSeqOrderRef.current.push(seq);
        if (receivedSeqOrderRef.current.length <= MAX_REMEMBERED_RECEIVED_SEQ) {
            return;
        }

        const staleSeq = receivedSeqOrderRef.current.shift();
        if (typeof staleSeq === 'number') {
            receivedSeqSetRef.current.delete(staleSeq);
        }
    }, []);

    const clearReceivedSeqMemory = useCallback(() => {
        receivedSeqSetRef.current.clear();
        receivedSeqOrderRef.current = [];
    }, []);

    const clearTransport = useCallback(() => {
        const client = clientRef.current;
        if (!client) {
            return;
        }

        try {
            client.disconnect();
        } catch {
            // no-op
        }
        clientRef.current = null;
    }, []);

    const getPreferredErrorMessage = useCallback((fallbackMessage: string): string => {
        const recentOperationError = lastOperationErrorRef.current;
        if (!recentOperationError) {
            return fallbackMessage;
        }

        const elapsedMs = Date.now() - recentOperationError.at;
        const isRecent = elapsedMs >= 0 && elapsedMs <= 8000;
        if (!isRecent) {
            return fallbackMessage;
        }

        const genericMessage = fallbackMessage.toLowerCase();
        if (
            genericMessage.includes('master peer error') ||
            genericMessage.includes('master server closed connection') ||
            genericMessage.includes('game server closed connection') ||
            genericMessage.includes('game peer error')
        ) {
            return recentOperationError.message;
        }

        return fallbackMessage;
    }, []);

    const sendRawString = useCallback((rawPayload: string): boolean => {
        const client = clientRef.current;
        const photonModule = photonModuleRef.current;
        if (!client || !photonModule || !client.isJoinedToRoom()) {
            setError('No open data connection.');
            return false;
        }

        try {
            client.raiseEvent(PHOTON_EVENT_CODE, rawPayload, {
                receivers: photonModule.LoadBalancing.Constants.ReceiverGroup.Others
            });
            return true;
        } catch (sendError) {
            setError(`Failed to send data: ${formatErrorMessage(sendError)}`);
            setStatus('error');
            return false;
        }
    }, []);

    const schedulePendingTimeout = useCallback((seq: number) => {
        const pending = pendingPacketsRef.current.get(seq);
        if (!pending) {
            return;
        }

        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        pending.timer = setTimeout(() => {
            const current = pendingPacketsRef.current.get(seq);
            if (!current) {
                return;
            }

            if (current.retries >= current.maxRetries) {
                clearPendingPacket(seq);
                setError(`Packet timeout (seq ${seq}) after ${current.maxRetries + 1} attempts.`);
                setStatus('error');
                return;
            }

            current.retries += 1;
            const sent = sendRawString(current.encoded);
            if (!sent) {
                return;
            }

            schedulePendingTimeout(seq);
        }, pending.timeoutMs);
    }, [clearPendingPacket, sendRawString]);

    const sendPacket = useCallback((packet: ActionPacket, options?: SendPacketOptions): boolean => {
        let encoded = '';
        try {
            encoded = JSON.stringify(packet);
        } catch (serializationError) {
            setError(`Failed to serialize packet: ${formatErrorMessage(serializationError)}`);
            return false;
        }

        const sent = sendRawString(encoded);
        if (!sent) {
            return false;
        }

        setError(null);
        const requireAck = options?.requireAck ?? packet.type !== 'ACK';
        if (requireAck && packet.type !== 'ACK') {
            clearPendingPacket(packet.seq);
            pendingPacketsRef.current.set(packet.seq, {
                encoded,
                retries: 0,
                timeoutMs: options?.timeoutMs ?? ACK_TIMEOUT_MS,
                maxRetries: options?.maxRetries ?? ACK_MAX_RETRIES,
                timer: null
            });
            schedulePendingTimeout(packet.seq);
        }

        return true;
    }, [clearPendingPacket, schedulePendingTimeout, sendRawString]);

    const sendActionPacket = useCallback(<TPayload,>(
        input: SendActionPacketInput<TPayload>,
        options?: SendPacketOptions
    ): ActionPacket<TPayload> | null => {
        const packet = buildActionPacket({
            type: input.type,
            matchId: input.matchId,
            turn: input.turn,
            payload: input.payload,
            seq: nextSeqRef.current++
        });

        const sent = sendPacket(packet, options);
        if (!sent) {
            return null;
        }
        return packet;
    }, [sendPacket]);

    const sendAckFor = useCallback((packet: ActionPacket) => {
        sendActionPacket({
            type: 'ACK',
            matchId: packet.matchId,
            turn: packet.turn,
            payload: { ackFor: packet.seq }
        }, { requireAck: false });
    }, [sendActionPacket]);

    const processIncoming = useCallback((incoming: unknown) => {
        const raw = toRawString(incoming);
        let parsed: unknown = incoming;

        if (typeof incoming === 'string') {
            try {
                parsed = JSON.parse(incoming);
            } catch {
                parsed = incoming;
            }
        }

        setLastIncomingRaw(raw);
        setLastIncomingData(parsed);
        setLastMessageAt(Date.now());

        if (!isActionPacket(parsed)) {
            return;
        }

        if (parsed.type === 'ACK') {
            const ackFor = getAckFor(parsed);
            if (ackFor !== null) {
                clearPendingPacket(ackFor);
                setError(null);
            }
            return;
        }

        if (receivedSeqSetRef.current.has(parsed.seq)) {
            sendAckFor(parsed);
            return;
        }

        rememberReceivedSeq(parsed.seq);
        setLastIncomingPacket(parsed);
        sendAckFor(parsed);
    }, [clearPendingPacket, rememberReceivedSeq, sendAckFor]);

    const refreshRemotePeer = useCallback((fallbackStatus: ConnectionStatus) => {
        const client = clientRef.current;
        if (!client || typeof client.myRoomActorsArray !== 'function') {
            setRemotePeerId(null);
            setStatus(fallbackStatus);
            return;
        }

        const actors = client.myRoomActorsArray();
        const remoteActor = actors.find((actor) => !actor?.isLocal);
        const normalizedRemote = remoteActor ? normalizePhotonActorId(remoteActor) : '';
        const nextRemotePeerId = normalizedRemote || null;
        setRemotePeerId(nextRemotePeerId);
        setStatus(nextRemotePeerId ? 'connected' : fallbackStatus);
    }, []);

    const connectPhotonWithConfig = useCallback(async (
        config: PhotonConfig,
        options: PhotonConnectOptions
    ): Promise<string> => {
        if (!config.appId) {
            throw new Error('Photon App ID is missing. Set VITE_PHOTON_APP_ID or select one in More Info.');
        }

        const roomToCreate = options.roomToCreate ? normalizeRoomId(options.roomToCreate) : '';
        const localPeer = options.localPeerId?.trim() || generatePeerId();
        const normalizedRoomLabel = options.roomLabel?.trim() || '';
        const initialMatchStatus: RoomMatchStatus = options.matchStatus || 'waiting_players';
        const customGameProperties: Record<string, unknown> = {
            matchStatus: initialMatchStatus
        };
        if (normalizedRoomLabel) {
            customGameProperties.roomLabel = normalizedRoomLabel;
        }
        manualDisconnectRef.current = false;
        autoReconnectBlockedRef.current = false;
        lastOperationErrorRef.current = null;
        clearReconnectTimer();
        clearAllPendingPackets();
        clearReceivedSeqMemory();

        clearTransport();
        reconnectAttemptsRef.current = 0;
        setReconnectAttempt(0);
        setStatus('peer-opening');
        setError(null);
        setRemotePeerId(null);
        setLastIncomingRaw(null);
        setLastIncomingData(null);
        setLastIncomingPacket(null);
        setLastMessageAt(null);
        setLobbyRooms([]);
        setLocalPeerId(localPeer);

        lastOpenedPeerIdRef.current = localPeer;
        lastTargetRoomIdRef.current = roomToCreate || null;
        localCreatedRoomRef.current = Boolean(roomToCreate);
        currentRoomIdRef.current = null;

        const photonModule = await loadPhotonModule();
        photonModuleRef.current = photonModule;

        if (
            typeof window !== 'undefined' &&
            typeof window.WebSocket === 'function' &&
            photonModule.PhotonPeer?.setWebSocketImpl
        ) {
            photonModule.PhotonPeer.setWebSocketImpl(window.WebSocket);
        }

        const protocol = config.protocol === 'ws'
            ? photonModule.ConnectionProtocol.Ws
            : photonModule.ConnectionProtocol.Wss;
        const LBC = photonModule.LoadBalancing.LoadBalancingClient;
        const client = new LBC(protocol, config.appId, config.appVersion);
        clientRef.current = client;

        const uniqueUserIdSuffix = Math.random().toString(36).slice(2, 8);
        if (typeof client.setUserId === 'function') {
            client.setUserId(`minechess-${localPeer}-${uniqueUserIdSuffix}`);
        }

        return new Promise<string>((resolve, reject) => {
            let settled = false;
            let roomJoinRequested = false;
            const states = LBC.State as Record<string, number>;

            const resolveOnce = (value: string) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(value);
            };

            const rejectOnce = (reason: string) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(new Error(reason));
            };

            client.onStateChange = (nextState: number) => {
                if (nextState === states.JoinedLobby) {
                    if (!roomToCreate) {
                        setStatus('peer-ready');
                        resolveOnce(localPeer);
                        return;
                    }

                    setStatus('connecting');
                    roomJoinRequested = true;
                    const joinStarted = client.joinRoom(roomToCreate, {
                        createIfNotExists: true,
                        maxPlayers: 2,
                        isVisible: true,
                        isOpen: true,
                        customGameProperties,
                        propsListedInLobby: ['roomLabel', 'matchStatus']
                    });
                    if (!joinStarted) {
                        const message = `Failed to create room ${roomToCreate}.`;
                        setError(message);
                        setStatus('error');
                        rejectOnce(message);
                    }
                    return;
                }

                if (nextState === states.Joined) {
                    const joinedRoom = client.myRoom?.()?.name?.trim() || roomToCreate || '';
                    currentRoomIdRef.current = joinedRoom || null;
                    if (joinedRoom) {
                        lastTargetRoomIdRef.current = joinedRoom;
                    }
                    refreshRemotePeer('connecting');
                    resolveOnce(roomToCreate ? (joinedRoom || roomToCreate) : localPeer);
                    return;
                }

                if (nextState === states.Disconnected) {
                    setRemotePeerId(null);
                    setLobbyRooms([]);
                    if (manualDisconnectRef.current) {
                        setStatus('idle');
                        return;
                    }

                    setStatus('disconnected');
                    if (!autoReconnectBlockedRef.current) {
                        setError('Network connection lost. Trying to reconnect...');
                    }
                    scheduleReconnect();
                }
            };

            client.onJoinRoom = (_createdByMe: boolean) => {
                const joinedRoom = client.myRoom?.()?.name?.trim() || roomToCreate || '';
                currentRoomIdRef.current = joinedRoom || null;
                if (joinedRoom) {
                    lastTargetRoomIdRef.current = joinedRoom;
                }
                refreshRemotePeer('connecting');
                if (roomToCreate) {
                    resolveOnce(joinedRoom || roomToCreate);
                }
            };

            client.onActorJoin = (_actor: PhotonActorLike) => {
                refreshRemotePeer('connecting');
            };

            client.onActorLeave = (_actor: PhotonActorLike, _isInactive: boolean) => {
                refreshRemotePeer('connecting');
            };

            client.onEvent = (code: number, data: unknown, _actorNr: number) => {
                if (code !== PHOTON_EVENT_CODE) {
                    return;
                }
                processIncoming(data);
            };

            client.onRoomList = (roomInfos: PhotonRoomInfoLike[]) => {
                setLobbyRooms(normalizeLobbyRooms(roomInfos));
            };

            client.onRoomListUpdate = (roomInfos: PhotonRoomInfoLike[]) => {
                setLobbyRooms(normalizeLobbyRooms(roomInfos));
            };

            client.onError = (_errorCode: number, message: string) => {
                const normalized = getPreferredErrorMessage(message || 'Photon network error.');
                setError(normalized);
                setStatus('error');
                if (!autoReconnectBlockedRef.current) {
                    scheduleReconnect();
                }
                rejectOnce(normalized);
            };

            client.onOperationResponse = (errorCode: number, errorMessage: string, operationCode: number) => {
                if (!errorCode) {
                    return;
                }

                const constants = photonModule.LoadBalancing.Constants;
                const operationCodes = constants.OperationCode;
                const errorCodes = constants.ErrorCode;
                const message = formatPhotonOperationError({
                    errorCode,
                    errorMessage,
                    operationCode,
                    operationCodes,
                    errorCodes,
                    roomId: currentRoomIdRef.current || lastTargetRoomIdRef.current
                });
                lastOperationErrorRef.current = {
                    message,
                    at: Date.now()
                };
                setError(message);
                setStatus('error');

                const isRoomJoinFailure =
                    operationCode === operationCodes?.CreateGame || operationCode === operationCodes?.JoinGame;
                if (isRoomJoinFailure && isFatalReconnectError(errorCode, errorCodes)) {
                    autoReconnectBlockedRef.current = true;
                    clearReconnectTimer();
                }

                if (!settled && (isRoomJoinFailure || !roomJoinRequested)) {
                    rejectOnce(message);
                }
            };

            const connected = client.connectToRegionMaster(config.region);
            if (!connected) {
                const message = `Failed to connect to Photon region "${config.region}".`;
                setStatus('error');
                setError(message);
                rejectOnce(message);
            }
        });
    }, [
        clearReconnectTimer,
        clearAllPendingPackets,
        clearReceivedSeqMemory,
        clearTransport,
        getPreferredErrorMessage,
        generatePeerId,
        processIncoming,
        refreshRemotePeer,
        scheduleReconnect
    ]);

    const connectPhoton = useCallback(async (options: PhotonConnectOptions): Promise<string> => {
        const baseConfig = resolvePhotonConfig();
        const roomToCreate = options.roomToCreate ? normalizeRoomId(options.roomToCreate) : '';
        const localPeer = options.localPeerId?.trim() || generatePeerId();
        const appIdCandidates = getPhotonAppIdCandidates(baseConfig.appId);
        let lastError: unknown = null;

        for (let index = 0; index < appIdCandidates.length; index += 1) {
            const appId = appIdCandidates[index];
            try {
                const connectResult = await connectPhotonWithConfig(
                    { ...baseConfig, appId },
                    { ...options, roomToCreate, localPeerId: localPeer }
                );
                if (appId !== baseConfig.appId) {
                    setPreferredPhotonAppId(appId);
                }
                return connectResult;
            } catch (attemptError) {
                lastError = attemptError;
                const message = formatErrorMessage(attemptError);
                const isLastAttempt = index >= appIdCandidates.length - 1;
                if (isLastAttempt || !shouldRetryWithBackupAppId(message, roomToCreate)) {
                    throw attemptError instanceof Error ? attemptError : new Error(message);
                }
                setError(`Photon App ID failed (${appId.slice(0, 8)}...). Retrying backup App ID...`);
            }
        }

        const fallbackError = formatErrorMessage(lastError);
        throw new Error(fallbackError || 'Photon connection failed.');
    }, [connectPhotonWithConfig, generatePeerId]);

    const openPeer = useCallback((preferredId?: string, options?: OpenPeerOptions): Promise<string> => {
        const roomToCreate = preferredId?.trim();
        return connectPhoton({
            roomToCreate,
            roomLabel: options?.roomLabel,
            matchStatus: options?.matchStatus
        });
    }, [connectPhoton]);

    const connectToPeer = useCallback((targetPeerId: string) => {
        const client = clientRef.current;
        const roomId = normalizeRoomId(targetPeerId);
        manualDisconnectRef.current = false;
        const currentLocalId = lastOpenedPeerIdRef.current;

        if (!client || !currentLocalId) {
            setError('Local peer is not ready. Call openPeer() first.');
            setStatus('error');
            return;
        }

        if (!roomId) {
            setError('Target peer ID is required.');
            return;
        }

        lastTargetRoomIdRef.current = roomId;
        localCreatedRoomRef.current = false;
        currentRoomIdRef.current = null;
        clearAllPendingPackets();
        clearReceivedSeqMemory();
        setError(null);
        setStatus('connecting');

        try {
            const joinStarted = client.joinRoom(roomId, { createIfNotExists: false });
            if (!joinStarted) {
                setError(`Failed to join room ${roomId}.`);
                setStatus('error');
            }
        } catch (connectError) {
            setError(`Failed to connect: ${formatErrorMessage(connectError)}`);
            setStatus('error');
        }
    }, [clearAllPendingPackets, clearReceivedSeqMemory]);

    const reconnect = useCallback(async (): Promise<boolean> => {
        if (manualDisconnectRef.current) {
            return false;
        }

        const lastLocalPeer = lastOpenedPeerIdRef.current;
        if (!lastLocalPeer) {
            setError('No previous local peer id available for reconnect.');
            return false;
        }

        autoReconnectBlockedRef.current = false;
        clearReconnectTimer();
        setStatus('reconnecting');
        reconnectAttemptsRef.current += 1;
        setReconnectAttempt(reconnectAttemptsRef.current);

        try {
            const targetRoomId = lastTargetRoomIdRef.current;
            if (!targetRoomId) {
                await connectPhoton({ localPeerId: lastLocalPeer });
                return true;
            }

            if (localCreatedRoomRef.current) {
                await connectPhoton({ localPeerId: lastLocalPeer, roomToCreate: targetRoomId });
                return true;
            }

            await connectPhoton({ localPeerId: lastLocalPeer });
            connectToPeer(targetRoomId);
            return true;
        } catch (reopenError) {
            setError(`Reconnect failed: ${formatErrorMessage(reopenError)}`);
            setStatus('error');
            return false;
        }
    }, [clearReconnectTimer, connectPhoton, connectToPeer]);

    useEffect(() => {
        reconnectFnRef.current = reconnect;
    }, [reconnect]);

    const sendJson = useCallback((payload: unknown): boolean => {
        let serialized = '';
        try {
            serialized = JSON.stringify(payload);
        } catch (serializationError) {
            setError(`Failed to serialize payload: ${formatErrorMessage(serializationError)}`);
            return false;
        }

        const sent = sendRawString(serialized);
        if (sent) {
            setError(null);
        }
        return sent;
    }, [sendRawString]);

    const sendJsonString = useCallback((jsonString: string): boolean => {
        const normalizedJson = jsonString.trim();
        if (!normalizedJson) {
            setError('Payload is empty.');
            return false;
        }

        try {
            JSON.parse(normalizedJson);
        } catch (parseError) {
            setError(`Invalid JSON string: ${formatErrorMessage(parseError)}`);
            return false;
        }

        const sent = sendRawString(normalizedJson);
        if (sent) {
            setError(null);
        }
        return sent;
    }, [sendRawString]);

    const setRoomMatchStatus = useCallback((nextStatus: RoomMatchStatus) => {
        const client = clientRef.current;
        if (!client || !client.isJoinedToRoom()) {
            return;
        }
        const room = client.myRoom?.();
        if (!room) {
            return;
        }

        try {
            room.setCustomProperty?.('matchStatus', nextStatus);
            if (nextStatus === 'playing') {
                room.setIsOpen?.(false);
            } else {
                room.setIsOpen?.(true);
            }
        } catch {
            // no-op
        }
    }, []);

    const disconnect = useCallback(() => {
        manualDisconnectRef.current = true;
        autoReconnectBlockedRef.current = true;
        clearReconnectTimer();
        clearAllPendingPackets();

        const client = clientRef.current;
        if (client?.isJoinedToRoom()) {
            try {
                client.leaveRoom?.();
            } catch {
                // no-op
            }
        }

        currentRoomIdRef.current = null;
        lastTargetRoomIdRef.current = null;
        lastOperationErrorRef.current = null;
        setRemotePeerId(null);
        setLobbyRooms([]);
        setError(null);
        setStatus(client ? 'peer-ready' : 'idle');
    }, [clearAllPendingPackets, clearReconnectTimer]);

    const destroyPeer = useCallback(() => {
        manualDisconnectRef.current = true;
        autoReconnectBlockedRef.current = true;
        clearReconnectTimer();
        clearAllPendingPackets();
        clearReceivedSeqMemory();
        clearTransport();

        lastOpenedPeerIdRef.current = null;
        lastTargetRoomIdRef.current = null;
        localCreatedRoomRef.current = false;
        currentRoomIdRef.current = null;
        lastOperationErrorRef.current = null;
        reconnectAttemptsRef.current = 0;
        setReconnectAttempt(0);
        setLocalPeerId(null);
        setRemotePeerId(null);
        setLobbyRooms([]);
        setError(null);
        setStatus('idle');
    }, [clearAllPendingPackets, clearReceivedSeqMemory, clearReconnectTimer, clearTransport]);

    useEffect(() => {
        return () => {
            clearReconnectTimer();
            clearAllPendingPackets();
            clearReceivedSeqMemory();
            clearTransport();
        };
    }, [clearAllPendingPackets, clearReceivedSeqMemory, clearReconnectTimer, clearTransport]);

    const value = useMemo<ConnectionContextValue>(() => ({
        status,
        isConnected: status === 'connected',
        localPeerId,
        remotePeerId,
        reconnectAttempt,
        lastIncomingRaw,
        lastIncomingData,
        lastIncomingPacket,
        lastMessageAt,
        error,
        lobbyRooms,
        generatePeerId,
        openPeer,
        connectToPeer,
        reconnect,
        sendPacket,
        sendActionPacket,
        sendJson,
        sendJsonString,
        setRoomMatchStatus,
        disconnect,
        destroyPeer
    }), [
        status,
        localPeerId,
        remotePeerId,
        reconnectAttempt,
        lastIncomingRaw,
        lastIncomingData,
        lastIncomingPacket,
        lastMessageAt,
        error,
        lobbyRooms,
        generatePeerId,
        openPeer,
        connectToPeer,
        reconnect,
        sendPacket,
        sendActionPacket,
        sendJson,
        sendJsonString,
        setRoomMatchStatus,
        disconnect,
        destroyPeer
    ]);

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
};

export const usePhotonConnection = (): ConnectionContextValue => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within a ConnectionProvider.');
    }
    return context;
};
