import React from 'react';
import {
    ConnectionProvider as PeerJsConnectionProvider,
    useConnection as usePeerJsConnection,
    type ConnectionContextValue
} from './PeerJsConnectionProvider';
import {
    PhotonConnectionProvider,
    getAvailablePhotonAppIds as getAvailablePhotonAppIdsFromPhoton,
    getPreferredPhotonAppId as getPreferredPhotonAppIdFromPhoton,
    setPreferredPhotonAppId as setPreferredPhotonAppIdFromPhoton,
    clearPreferredPhotonAppId as clearPreferredPhotonAppIdFromPhoton,
    usePhotonConnection
} from './PhotonConnectionProvider';

export type NetworkMode = 'peerjs' | 'photon';

const NETWORK_MODE_STORAGE_KEY = 'minechess_network_mode';

const normalizeNetworkMode = (value: string | null | undefined): NetworkMode | null => {
    const normalizedMode = (value || '').trim().toLowerCase();
    if (normalizedMode === 'photon') {
        return 'photon';
    }
    if (normalizedMode === 'peerjs') {
        return 'peerjs';
    }
    return null;
};

const getStoredNetworkMode = (): NetworkMode | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return normalizeNetworkMode(window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY));
    } catch {
        return null;
    }
};

const resolveNetworkMode = (): NetworkMode => {
    const storedMode = getStoredNetworkMode();
    if (storedMode) {
        return storedMode;
    }

    return normalizeNetworkMode(import.meta.env.VITE_NETWORK_MODE) ?? 'peerjs';
};

const NETWORK_MODE = resolveNetworkMode();

export const ConnectionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    if (NETWORK_MODE === 'photon') {
        return <PhotonConnectionProvider>{children}</PhotonConnectionProvider>;
    }
    return <PeerJsConnectionProvider>{children}</PeerJsConnectionProvider>;
};

export const useConnection = (): ConnectionContextValue => {
    if (NETWORK_MODE === 'photon') {
        return usePhotonConnection();
    }
    return usePeerJsConnection();
};

export const getNetworkMode = (): NetworkMode => NETWORK_MODE;

export const setPreferredNetworkMode = (mode: NetworkMode): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(NETWORK_MODE_STORAGE_KEY, mode);
    } catch {
        // no-op
    }
};

export const clearPreferredNetworkMode = (): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(NETWORK_MODE_STORAGE_KEY);
    } catch {
        // no-op
    }
};

export const getAvailablePhotonAppIds = (): string[] => getAvailablePhotonAppIdsFromPhoton();

export const getPreferredPhotonAppId = (): string => getPreferredPhotonAppIdFromPhoton();

export const setPreferredPhotonAppId = (appId: string): void => {
    setPreferredPhotonAppIdFromPhoton(appId);
};

export const clearPreferredPhotonAppId = (): void => {
    clearPreferredPhotonAppIdFromPhoton();
};
