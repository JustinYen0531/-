import React from 'react';
import { UnitType, MineType } from './types';
import { Crown, Eye, Footprints, Bomb, Shield } from './icons';

export const getUnitTypeAbbr = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return 'gen';
        case UnitType.MINESWEEPER: return 'swp';
        case UnitType.RANGER: return 'rng';
        case UnitType.MAKER: return 'mkr';
        case UnitType.DEFUSER: return 'def';
        default: return '';
    }
};

export const getMineBaseCost = (type: MineType): number => {
    switch (type) {
        case MineType.SLOW: return 2;
        case MineType.SMOKE: return 3;
        case MineType.NUKE: return 10;
        case MineType.CHAIN: return 5;
        default: return 3;
    }
};

export const getUnitIcon = (type: UnitType, size: number = 18, tier: number = 0) => {
    if (type === UnitType.GENERAL && tier > 0) {
        return (
            <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{
                filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))',
                strokeWidth: '3px',
                stroke: 'currentColor'
            }} />
        );
    }

    switch (type) {
        case UnitType.GENERAL: return <Crown size={size} className="text-yellow-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MINESWEEPER: return <Eye size={size} className="text-cyan-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.RANGER: return <Footprints size={size} className="text-emerald-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.MAKER: return <Bomb size={size} className="text-red-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(252, 165, 165, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        case UnitType.DEFUSER: return <Shield size={size} className="text-blue-300 drop-shadow-lg animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.6))', strokeWidth: '3px', stroke: 'currentColor' }} />;
        default: return null;
    }
};

export const getUnitName = (type: UnitType): string => {
    switch (type) {
        case UnitType.GENERAL: return '將軍';
        case UnitType.MINESWEEPER: return '掃雷';
        case UnitType.RANGER: return '遊俠';
        case UnitType.MAKER: return '製雷';
        case UnitType.DEFUSER: return '解雷';
        default: return '未知';
    }
};