import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ActionPacket, ActionPacketType, buildActionPacket, getAckFor, isActionPacket } from './protocol';

export type ConnectionStatus =
    | 'idle'
    | 'peer-opening'
    | 'peer-ready'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'disconnected'
    | 'error';

export interface LobbyRoomSnapshot {
    roomId: string;
    playerCount: number;
    maxPlayers: number;
    isOpen: boolean;
    isVisible: boolean;
}

interface SendPacketOptions {
    requireAck?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
}

interface PendingPacket {
    packet: ActionPacket;
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

export interface ConnectionContextValue {
    status: ConnectionStatus;
    isConnected: boolean;
    localPeerId: string | null;
    remotePeerId: string | null;
    reconnectAttempt: number;
    lastIncomingRaw: string | null;
    lastIncomingData: unknown;
    lastIncomingPacket: ActionPacket | null;
    lastMessageAt: number | null;
    error: string | null;
    lobbyRooms: LobbyRoomSnapshot[];
    generatePeerId: () => string;
    openPeer: (preferredId?: string) => Promise<string>;
    connectToPeer: (targetPeerId: string) => void;
    reconnect: () => Promise<boolean>;
    sendPacket: (packet: ActionPacket, options?: SendPacketOptions) => boolean;
    sendActionPacket: <TPayload>(
        input: SendActionPacketInput<TPayload>,
        options?: SendPacketOptions
    ) => ActionPacket<TPayload> | null;
    sendJson: (payload: unknown) => boolean;
    sendJsonString: (jsonString: string) => boolean;
    disconnect: () => void;
    destroyPeer: () => void;
}

const ACK_TIMEOUT_MS = 2500;
const ACK_MAX_RETRIES = 2;
const MAX_REMEMBERED_RECEIVED_SEQ = 512;

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

const formatErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
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

const createPeerInstance = (peerId: string, forcePublic = false): Peer => {
    const host = import.meta.env.VITE_PEER_HOST?.trim();
    console.log('[PeerJS Debug] VITE_PEER_HOST:', JSON.stringify(host));
    console.log('[PeerJS Debug] VITE_PEER_PORT:', JSON.stringify(import.meta.env.VITE_PEER_PORT));
    console.log('[PeerJS Debug] VITE_PEER_PATH:', JSON.stringify(import.meta.env.VITE_PEER_PATH));
    if (forcePublic || !host) {
        console.log('[PeerJS Debug] Using PUBLIC PeerJS server (no host configured)');
        return new Peer(peerId);
    }

    const portValue = Number(import.meta.env.VITE_PEER_PORT);
    const secureFlag = import.meta.env.VITE_PEER_SECURE?.toLowerCase();

    const config = {
        host,
        port: Number.isFinite(portValue) && portValue > 0 ? portValue : undefined,
        path: import.meta.env.VITE_PEER_PATH?.trim() || '/',
        secure: secureFlag ? secureFlag === 'true' : false,
        debug: 3
    };
    console.log('[PeerJS Debug] Using LOCAL PeerJS server:', JSON.stringify(config));
    return new Peer(peerId, config);
};

export const ConnectionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [localPeerId, setLocalPeerId] = useState<string | null>(null);
    const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [lastIncomingRaw, setLastIncomingRaw] = useState<string | null>(null);
    const [lastIncomingData, setLastIncomingData] = useState<unknown>(null);
    const [lastIncomingPacket, setLastIncomingPacket] = useState<ActionPacket | null>(null);
    const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const connectionRef = useRef<DataConnection | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const manualDisconnectRef = useRef(false);
    const nextSeqRef = useRef(1);
    const lastOpenedPeerIdRef = useRef<string | null>(null);
    const lastTargetPeerIdRef = useRef<string | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const pendingPacketsRef = useRef<Map<number, PendingPacket>>(new Map());
    const receivedSeqSetRef = useRef<Set<number>>(new Set());
    const receivedSeqOrderRef = useRef<number[]>([]);

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

    const sendRawString = useCallback((rawPayload: string): boolean => {
        const connection = connectionRef.current;
        if (!connection || !connection.open) {
            setError('No open data connection.');
            return false;
        }

        try {
            connection.send(rawPayload);
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
                packet,
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

    const scheduleReconnect = useCallback((reconnect: () => Promise<boolean>) => {
        if (manualDisconnectRef.current) {
            return;
        }
        if (!lastTargetPeerIdRef.current) {
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
            reconnect().then((ok) => {
                if (!ok) {
                    scheduleReconnect(reconnect);
                }
            }).catch(() => {
                scheduleReconnect(reconnect);
            });
        }, delayMs);
    }, []);

    const attachConnection = useCallback((
        connection: DataConnection,
        reconnect: () => Promise<boolean>
    ) => {
        if (connectionRef.current && connectionRef.current !== connection) {
            connectionRef.current.close();
        }

        connectionRef.current = connection;
        setRemotePeerId(connection.peer);
        setError(null);
        setStatus(connection.open ? 'connected' : 'connecting');

        connection.on('open', () => {
            clearReconnectTimer();
            reconnectAttemptsRef.current = 0;
            setReconnectAttempt(0);
            setRemotePeerId(connection.peer);
            setStatus('connected');
        });

        connection.on('data', (incoming: unknown) => {
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
        });

        connection.on('close', () => {
            connectionRef.current = null;
            setRemotePeerId(null);
            setStatus(peerRef.current ? 'peer-ready' : 'idle');
            scheduleReconnect(reconnect);
        });

        connection.on('error', (connectionError: unknown) => {
            setError(formatErrorMessage(connectionError));
            setStatus('error');
            scheduleReconnect(reconnect);
        });
    }, [clearPendingPacket, clearReconnectTimer, rememberReceivedSeq, scheduleReconnect, sendAckFor]);

    const openPeer = useCallback((preferredId?: string): Promise<string> => {
        const requestedId = preferredId?.trim() || generatePeerId();
        const canFallbackToPublic = Boolean(import.meta.env.VITE_PEER_HOST?.trim());
        manualDisconnectRef.current = false;
        lastOpenedPeerIdRef.current = requestedId;

        clearReconnectTimer();
        clearAllPendingPackets();
        clearReceivedSeqMemory();

        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
        }

        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        setError(null);
        setStatus('peer-opening');
        setLocalPeerId(null);
        setRemotePeerId(null);
        setLastIncomingRaw(null);
        setLastIncomingData(null);
        setLastIncomingPacket(null);
        setLastMessageAt(null);

        return new Promise<string>((resolve, reject) => {
            let settled = false;
            let fallbackAttempted = false;

            const bindPeerEvents = (peer: Peer, source: 'configured' | 'public') => {
                peerRef.current = peer;

                const reconnect = async (): Promise<boolean> => {
                    if (manualDisconnectRef.current) {
                        return false;
                    }

                    const reopenId = lastOpenedPeerIdRef.current;
                    if (!reopenId) {
                        setError('No previous local peer id available for reconnect.');
                        return false;
                    }

                    try {
                        await openPeer(reopenId);
                        const targetPeerId = lastTargetPeerIdRef.current;
                        if (targetPeerId) {
                            connectToPeer(targetPeerId);
                        }
                        return true;
                    } catch (reopenError) {
                        setError(`Reconnect failed: ${formatErrorMessage(reopenError)}`);
                        return false;
                    }
                };

                peer.once('open', (openedId: string) => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearReconnectTimer();
                    reconnectAttemptsRef.current = 0;
                    setReconnectAttempt(0);
                    lastOpenedPeerIdRef.current = openedId;
                    setLocalPeerId(openedId);
                    setStatus('peer-ready');
                    setError(null);
                    resolve(openedId);
                });

                peer.on('connection', (incomingConnection: DataConnection) => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    lastTargetPeerIdRef.current = incomingConnection.peer;
                    attachConnection(incomingConnection, reconnect);
                });

                peer.on('disconnected', () => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    setStatus('disconnected');
                    scheduleReconnect(reconnect);
                });

                peer.on('close', () => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    peerRef.current = null;
                    connectionRef.current = null;
                    clearAllPendingPackets();
                    setLocalPeerId(null);
                    setRemotePeerId(null);
                    setStatus('idle');
                });

                peer.on('error', (peerError: unknown) => {
                    if (peerRef.current !== peer) {
                        return;
                    }
                    const message = formatErrorMessage(peerError);

                    if (!settled && source === 'configured' && canFallbackToPublic && !fallbackAttempted) {
                        fallbackAttempted = true;
                        setError(`Local peer server unavailable, fallback to public server. (${message})`);
                        setStatus('peer-opening');
                        try {
                            peer.destroy();
                        } catch {
                            // no-op
                        }
                        bindPeerEvents(createPeerInstance(requestedId, true), 'public');
                        return;
                    }

                    setError(message);
                    setStatus('error');

                    if (settled) {
                        scheduleReconnect(reconnect);
                        return;
                    }

                    settled = true;
                    reject(new Error(message));
                });
            };

            bindPeerEvents(createPeerInstance(requestedId), 'configured');
        });
    }, [attachConnection, clearAllPendingPackets, clearReconnectTimer, generatePeerId, scheduleReconnect]);

    const connectToPeer = useCallback((targetPeerId: string) => {
        const peer = peerRef.current;
        const normalizedPeerId = targetPeerId.trim();
        manualDisconnectRef.current = false;

        // Use ref instead of state to avoid stale closure issue
        // when connectToPeer is called immediately after openPeer resolves
        const currentLocalId = lastOpenedPeerIdRef.current;
        if (!peer || !currentLocalId) {
            console.warn('[PeerJS Debug] connectToPeer blocked: peer=', !!peer, 'localId=', currentLocalId);
            setError('Local peer is not ready. Call openPeer() first.');
            setStatus('error');
            return;
        }

        if (!normalizedPeerId) {
            setError('Target peer ID is required.');
            return;
        }

        console.log('[PeerJS Debug] connectToPeer: connecting to', normalizedPeerId);
        lastTargetPeerIdRef.current = normalizedPeerId;
        clearReconnectTimer();
        setError(null);
        setStatus('connecting');

        const reconnect = async (): Promise<boolean> => {
            if (manualDisconnectRef.current) {
                return false;
            }

            const reopenId = lastOpenedPeerIdRef.current;
            if (!reopenId) {
                setError('No previous local peer id available for reconnect.');
                return false;
            }

            try {
                await openPeer(reopenId);
                const targetId = lastTargetPeerIdRef.current;
                if (targetId) {
                    connectToPeer(targetId);
                }
                return true;
            } catch (reopenError) {
                setError(`Reconnect failed: ${formatErrorMessage(reopenError)}`);
                return false;
            }
        };

        try {
            const connection = peer.connect(normalizedPeerId, {
                reliable: true
            });
            attachConnection(connection, reconnect);
        } catch (connectError) {
            setError(`Failed to connect: ${formatErrorMessage(connectError)}`);
            setStatus('error');
            scheduleReconnect(reconnect);
        }
    }, [attachConnection, clearReconnectTimer, openPeer, scheduleReconnect]);

    const reconnect = useCallback(async (): Promise<boolean> => {
        if (manualDisconnectRef.current) {
            return false;
        }

        const reopenId = lastOpenedPeerIdRef.current;
        if (!reopenId) {
            setError('No previous local peer id available for reconnect.');
            return false;
        }

        setStatus('reconnecting');
        try {
            await openPeer(reopenId);
            const targetPeerId = lastTargetPeerIdRef.current;
            if (targetPeerId) {
                connectToPeer(targetPeerId);
            }
            return true;
        } catch (reopenError) {
            setError(`Reconnect failed: ${formatErrorMessage(reopenError)}`);
            setStatus('error');
            return false;
        }
    }, [connectToPeer, openPeer]);

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

    const disconnect = useCallback(() => {
        manualDisconnectRef.current = true;
        clearReconnectTimer();
        clearAllPendingPackets();

        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
        }

        lastTargetPeerIdRef.current = null;
        setRemotePeerId(null);
        setError(null);
        setStatus(peerRef.current ? 'peer-ready' : 'idle');
    }, [clearAllPendingPackets, clearReceivedSeqMemory, clearReconnectTimer]);

    const destroyPeer = useCallback(() => {
        manualDisconnectRef.current = true;
        clearReconnectTimer();
        clearAllPendingPackets();
        clearReceivedSeqMemory();

        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
        }

        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        lastOpenedPeerIdRef.current = null;
        lastTargetPeerIdRef.current = null;
        reconnectAttemptsRef.current = 0;
        setReconnectAttempt(0);
        setLocalPeerId(null);
        setRemotePeerId(null);
        setError(null);
        setStatus('idle');
    }, [clearAllPendingPackets, clearReceivedSeqMemory, clearReconnectTimer]);

    useEffect(() => {
        return () => {
        clearReconnectTimer();
        clearAllPendingPackets();
        clearReceivedSeqMemory();
            if (connectionRef.current) {
                connectionRef.current.close();
            }
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, [clearAllPendingPackets, clearReceivedSeqMemory, clearReconnectTimer]);

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
        lobbyRooms: [],
        generatePeerId,
        openPeer,
        connectToPeer,
        reconnect,
        sendPacket,
        sendActionPacket,
        sendJson,
        sendJsonString,
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
        // PeerJS has no cloud lobby; keep empty list for unified UI contract.
        generatePeerId,
        openPeer,
        connectToPeer,
        reconnect,
        sendPacket,
        sendActionPacket,
        sendJson,
        sendJsonString,
        disconnect,
        destroyPeer
    ]);

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = (): ConnectionContextValue => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within a ConnectionProvider.');
    }
    return context;
};
