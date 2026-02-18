import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { PlayerID, UnitType, MineType } from '../types';
import { Shield, Crown, Eye, Bomb, Footprints, Flag, Cpu, FlaskConical, Cloud, Share2, Radiation, Snowflake } from 'lucide-react';
import { P1_FLAG_POS, P2_FLAG_POS } from '../constants';
import './GridCell.css';
const EnergyCrystal = ({ size, oreSize = 'small' }) => {
    const Shard = ({ d, className = "crystal-facet-main" }) => (_jsx("path", { d: d, className: `crystal-facet ${className}`, strokeLinecap: "round", strokeLinejoin: "round" }));
    const Outline = ({ d }) => (_jsx("path", { d: d, className: "crystal-outline", strokeLinecap: "round", strokeLinejoin: "round" }));
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", className: "energy-crystal-container overflow-visible", children: [oreSize === 'small' && (_jsxs("g", { transform: "translate(5, 5) scale(0.9)", children: [_jsx(Outline, { d: "M50 5 L80 45 L50 95 L20 45 Z" }), _jsx(Shard, { d: "M50 5 L80 45 L50 95 L20 45 Z", className: "crystal-facet-main" }), _jsx(Shard, { d: "M50 5 L50 95", className: "crystal-facet-light" }), _jsx(Shard, { d: "M20 45 L80 45", className: "crystal-facet-dark" })] })), oreSize === 'medium' && (_jsxs("g", { transform: "translate(5, 5) scale(0.9)", children: [_jsx(Outline, { d: "M50 0 L80 40 L50 95 L20 40 Z" }), _jsx(Shard, { d: "M50 0 L80 40 L50 95 L20 40 Z", className: "crystal-facet-main" }), _jsx(Shard, { d: "M50 0 L50 95", className: "crystal-facet-light" }), _jsx(Shard, { d: "M30 30 L45 50 L35 80 L15 60 Z", className: "crystal-facet-dark" }), _jsx(Shard, { d: "M70 30 L55 50 L65 80 L85 60 Z", className: "crystal-facet-dark" })] })), oreSize === 'large' && (_jsxs("g", { children: [_jsx(Outline, { d: "M50 5 L85 40 L50 95 L15 40 Z" }), _jsx(Shard, { d: "M30 40 L45 20 L60 40 L45 70 Z", className: "crystal-facet-dark" }), _jsx(Shard, { d: "M70 40 L55 20 L40 40 L55 70 Z", className: "crystal-facet-dark" }), _jsx(Shard, { d: "M50 5 L85 40 L50 95 L15 40 Z", className: "crystal-facet-main" }), _jsx(Shard, { d: "M50 5 L50 95", className: "crystal-facet-light" }), _jsx("path", { d: "M15 40 L85 40 L50 65 Z", className: "crystal-hollow-center" }), _jsx("circle", { cx: "50", cy: "50", r: "8", className: "crystal-core" }), _jsx(Shard, { d: "M20 60 L35 75 L25 90 L10 80 Z", className: "crystal-facet-light" }), _jsx(Shard, { d: "M80 60 L65 75 L75 90 L90 80 Z", className: "crystal-facet-light" })] }))] }));
};
const GridCell = ({ cell, unit, mine, building, isSelected, isValidMove, isAttackTarget, isSkillTarget, currentPlayer, onClick, p1FlagLoc, p2FlagLoc, targetMode, selectedUnit, selectedGeneralLevelA = 0, evolutionLevelA = 0, evolutionLevelB = 0, p1GeneralLevelB = 0, p2GeneralLevelB = 0, p1GeneralVariantB = null, p2GeneralVariantB = null, evolutionVariantA = null, evolutionVariantB = null, buildings = [], isSmoked = false, smokeOwner, forceShowMines = false, isUnitStealthed = false }) => {
    const [particles, setParticles] = React.useState([]);
    const prevLevelA = React.useRef(evolutionLevelA);
    const prevLevelB = React.useRef(evolutionLevelB);
    // Generate particles ONLY when evolution level changes (not on every render)
    React.useEffect(() => {
        const levelAChanged = evolutionLevelA > prevLevelA.current;
        const levelBChanged = evolutionLevelB > prevLevelB.current;
        if (levelAChanged || levelBChanged) {
            const newParticles = [];
            const particleCount = 12;
            const color = levelAChanged ? 'blue' : 'orange';
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const distance = 30 + Math.random() * 20;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                newParticles.push({
                    id: `${Date.now()}-${i}`,
                    x,
                    y,
                    color,
                    delay: i * 0.06
                });
            }
            setParticles(newParticles);
            const timer = setTimeout(() => setParticles([]), 1200);
            return () => clearTimeout(timer);
        }
        prevLevelA.current = evolutionLevelA;
        prevLevelB.current = evolutionLevelB;
    }, [evolutionLevelA, evolutionLevelB]);
    // 計算是否在可執行區域內
    let isInActionRange = false;
    let actionRangeColor = '';
    if (selectedUnit && targetMode) {
        const manhattanDist = Math.abs(selectedUnit.r - cell.r) + Math.abs(selectedUnit.c - cell.c);
        const chebyshevDist = Math.max(Math.abs(selectedUnit.r - cell.r), Math.abs(selectedUnit.c - cell.c));
        if (targetMode === 'move' && manhattanDist === 1) {
            isInActionRange = true;
            actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
        }
        else if (targetMode === 'scan' && chebyshevDist <= 1) {
            isInActionRange = true;
            actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
        }
        else if ((targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'place_factory') && manhattanDist === 0) {
            isInActionRange = true;
            actionRangeColor = 'action-range-on-spot';
        }
        else if (targetMode === 'throw_mine' && chebyshevDist <= 1) {
            isInActionRange = true;
            actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
        }
        else if (targetMode === 'place_mine' && manhattanDist === 1) {
            isInActionRange = true;
            actionRangeColor = 'border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.6)]';
        }
        else if (targetMode === 'disarm') {
            const dr = Math.abs(selectedUnit.r - cell.r);
            const dc = Math.abs(selectedUnit.c - cell.c);
            if (chebyshevDist <= 1) {
                isInActionRange = true;
                actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]';
            }
            // 上下左右延伸到距離 2
            else if (chebyshevDist === 2 && (dr === 0 || dc === 0)) {
                isInActionRange = true;
                actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]';
            }
        }
        else if (targetMode === 'attack' && selectedUnit) {
            // Calculate attack range based on selected unit type and evolution level
            let attackRange = 1;
            // If selected unit is General, check its Path A evolution level
            if (selectedUnit.type === UnitType.GENERAL) {
                // selectedGeneralLevelA contains the General's Path A level
                attackRange = selectedGeneralLevelA >= 2 ? 2 : 1;
            }
            // For attack range, only allow cardinal directions (up, down, left, right)
            // Not diagonal directions
            const dr = Math.abs(selectedUnit.r - cell.r);
            const dc = Math.abs(selectedUnit.c - cell.c);
            // Check if target is in cardinal direction (either dr=0 or dc=0)
            const isCardinalDirection = dr === 0 || dc === 0;
            if (manhattanDist <= attackRange && isCardinalDirection) {
                isInActionRange = true;
                actionRangeColor = 'border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
            }
        }
        else if (targetMode === 'place_mine') {
            // Updated Place Mine Highlighting Logic
            const mkrLevelB = evolutionLevelB;
            const factories = buildings.filter(b => b.owner === selectedUnit.owner && b.type === 'factory');
            // Check mines outside of factory range to see if wild placement limit is reached
            let allowed = false;
            const manhattanDist = Math.abs(selectedUnit.r - cell.r) + Math.abs(selectedUnit.c - cell.c);
            // Base Range: 1
            if (manhattanDist <= 1)
                allowed = true;
            // B1+: Range 1 Chebyshev (3x3)
            if (mkrLevelB >= 1) {
                const chebyshevDist = Math.max(Math.abs(selectedUnit.r - cell.r), Math.abs(selectedUnit.c - cell.c));
                if (chebyshevDist <= 1)
                    allowed = true;
            }
            // Factory Range Extension
            const isInFactoryRange = factories.some(f => Math.max(Math.abs(f.r - cell.r), Math.abs(f.c - cell.c)) <= (f.level >= 2 ? 2 : 1));
            if (isInFactoryRange)
                allowed = true;
            if (allowed) {
                isInActionRange = true;
                actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.6)]';
            }
        }
        else if (targetMode === 'move_mine_start' || targetMode === 'move_mine_end' || targetMode === 'convert_mine') {
            const dr = Math.abs(selectedUnit.r - cell.r);
            const dc = Math.abs(selectedUnit.c - cell.c);
            if (dr <= 2 && dc <= 2) {
                isInActionRange = true;
                actionRangeColor = (targetMode === 'convert_mine') ? 'border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]' : 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
            }
        }
    }
    // Decide background color - P1 Zone (left) is blue, P2 Zone (right) is red
    let bgColor = 'bg-slate-900 border border-slate-700/30';
    if (cell.c < 12) {
        // P1 Zone - Blue Neon
        bgColor = 'bg-blue-950/80 border border-cyan-500/30 shadow-[inset_0_0_4px_#22d3ee,0_0_6px_rgba(34,211,238,0.1)]';
    }
    else {
        // P2 Zone - Red Neon
        bgColor = 'bg-red-950/80 border border-red-500/30 shadow-[inset_0_0_4px_#ef4444,0_0_6px_rgba(239,68,68,0.1)]';
    }
    if (cell.isObstacle)
        bgColor = 'bg-slate-700 border-2 border-white/70 shadow-[0_0_6px_rgba(255,255,255,0.3),inset_0_0_6px_rgba(255,255,255,0.1)] animate-breathe pattern-diagonal-lines';
    if (isInActionRange && targetMode === 'scan')
        bgColor = `bg-slate-900 border-2 ${actionRangeColor}`;
    else if (isSelected && targetMode !== 'scan')
        bgColor = 'bg-yellow-900/60 ring-2 ring-yellow-400 border-2 border-yellow-400 shadow-lg shadow-yellow-500/50';
    else if (isValidMove)
        bgColor = 'bg-emerald-900/60 ring-2 ring-emerald-400 border-2 border-emerald-400 cursor-pointer animate-pulse shadow-lg shadow-emerald-500/40';
    else if (isAttackTarget)
        bgColor = 'bg-red-900/60 ring-2 ring-red-400 border-2 border-red-400 cursor-pointer shadow-lg shadow-red-500/40';
    else if (isSkillTarget)
        bgColor = 'bg-purple-900/60 ring-2 ring-purple-400 border-2 border-purple-400 cursor-pointer animate-pulse shadow-lg shadow-purple-500/40';
    else if (isInActionRange)
        bgColor = `bg-slate-900 border-2 ${actionRangeColor}`;
    // Base Flags
    const isP1Base = cell.r === P1_FLAG_POS.r && cell.c === P1_FLAG_POS.c;
    const isP2Base = cell.r === P2_FLAG_POS.r && cell.c === P2_FLAG_POS.c;
    // Current Flags
    const isP1FlagHere = p1FlagLoc.r === cell.r && p1FlagLoc.c === cell.c;
    const isP2FlagHere = p2FlagLoc.r === cell.r && p2FlagLoc.c === cell.c;
    // Checker for Damage Zone (General Path B 3-2)
    const isInsideP1DamageZone = p1GeneralLevelB >= 3 && p1GeneralVariantB === 2 &&
        Math.abs(cell.r - p1FlagLoc.r) <= 1 && Math.abs(cell.c - p1FlagLoc.c) <= 1;
    const isInsideP2DamageZone = p2GeneralLevelB >= 3 && p2GeneralVariantB === 2 &&
        Math.abs(cell.r - p2FlagLoc.r) <= 1 && Math.abs(cell.c - p2FlagLoc.c) <= 1;
    // Checker for Shield Zone (General Path B 2+) - 5x5 Range
    const isInsideP1ShieldZone = p1GeneralLevelB >= 2 &&
        Math.abs(cell.r - p1FlagLoc.r) <= 2 && Math.abs(cell.c - p1FlagLoc.c) <= 2;
    const isInsideP2ShieldZone = p2GeneralLevelB >= 2 &&
        Math.abs(cell.r - p2FlagLoc.r) <= 2 && Math.abs(cell.c - p2FlagLoc.c) <= 2;
    // Checker for Factory Range (Maker Path B)
    const factoryRangeBuilding = buildings.find(b => b.type === 'factory' &&
        Math.abs(cell.r - b.r) <= (b.level >= 2 ? 2 : 1) &&
        Math.abs(cell.c - b.c) <= (b.level >= 2 ? 2 : 1));
    const isInsideFactoryRange = !!factoryRangeBuilding;
    // Checker for Hub Area (Ranger Path A) - 3x3 Range
    const hubBoundaryBuilding = buildings.find(b => b.type === 'hub' &&
        Math.abs(cell.r - b.r) <= 1 &&
        Math.abs(cell.c - b.c) <= 1);
    const isInsideHubRange = !!hubBoundaryBuilding;
    const isHub31Smoke = hubBoundaryBuilding && hubBoundaryBuilding.level === 3 && hubBoundaryBuilding.variant === 1;
    if (isInsideHubRange && !cell.isObstacle) {
        bgColor = `${bgColor} border-2 border-dashed ${hubBoundaryBuilding.owner === PlayerID.P1 ? 'border-cyan-500/50' : 'border-red-500/50'}`;
    }
    // Mine Visibility Logic - strict check including smoke
    // When in Sandbox "Normal" mode, we filter strictly based on who the user currently "is" (currentPlayer)
    const isMineVisible = forceShowMines || (!!mine &&
        (mine.owner === currentPlayer || mine.revealedTo.includes(currentPlayer)) &&
        !((isSmoked && smokeOwner !== currentPlayer) || (isHub31Smoke && hubBoundaryBuilding?.owner !== currentPlayer)));
    const getUnitIcon = (type) => {
        // Color mapping for each unit type
        const colorMap = {
            [UnitType.GENERAL]: 'text-yellow-300',
            [UnitType.MINESWEEPER]: 'text-cyan-300',
            [UnitType.RANGER]: 'text-emerald-300',
            [UnitType.MAKER]: 'text-red-300',
            [UnitType.DEFUSER]: 'text-blue-300'
        };
        const color = colorMap[type] || 'text-white';
        switch (type) {
            case UnitType.GENERAL: return _jsx(Crown, { size: 18, strokeWidth: 3, className: `${color} drop-shadow-lg animate-pulse`, style: { filter: 'drop-shadow(0 0 6px rgba(253, 224, 71, 0.8))' } });
            case UnitType.MINESWEEPER: return _jsx(Eye, { size: 18, strokeWidth: 3, className: `${color} drop-shadow-lg animate-pulse`, style: { filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.8))' } });
            case UnitType.RANGER: return _jsx(Footprints, { size: 18, strokeWidth: 3, className: `${color} drop-shadow-lg animate-pulse`, style: { filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.8))' } });
            case UnitType.MAKER: return _jsx(Bomb, { size: 18, strokeWidth: 3, className: `${color} drop-shadow-lg animate-pulse`, style: { filter: 'drop-shadow(0 0 6px rgba(252, 165, 165, 0.8))' } });
            case UnitType.DEFUSER: return _jsx(Shield, { size: 18, strokeWidth: 3, className: `${color} drop-shadow-lg animate-pulse`, style: { filter: 'drop-shadow(0 0 6px rgba(147, 197, 253, 0.8))' } });
            default: return null;
        }
    };
    // Building Rendering
    const renderBuilding = () => {
        if (!building)
            return null;
        const colorClass = building.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400';
        const accentColor = building.owner === PlayerID.P1 ? '#22d3ee' : '#ef4444';
        const isLvl2 = building.level >= 1;
        const isLvl3 = building.level >= 2;
        if (building.type === 'tower') {
            return (_jsxs("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible", children: [_jsx("div", { className: "building-range-indicator", style: { borderColor: `${accentColor}20` } }), _jsxs("div", { className: `relative w-8 h-8 flex items-center justify-center`, children: [_jsxs("svg", { viewBox: "0 0 40 40", className: "w-full h-full drop-shadow-lg", children: [_jsx("rect", { x: "18", y: "15", width: "4", height: "20", rx: "1", fill: "#475569" }), _jsx("rect", { x: "10", y: "32", width: "20", height: "4", rx: "1", fill: "#1e293b", stroke: "#475569" }), isLvl2 && (_jsx("ellipse", { cx: "20", cy: "20", rx: "15", ry: "6", fill: "none", stroke: accentColor, strokeWidth: "1", strokeDasharray: "4 2", className: "animate-[towerRotate_4s_linear_infinite]" })), isLvl3 && (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "20", cy: "12", r: "6", fill: "none", stroke: accentColor, strokeWidth: "0.5", className: "animate-pulse" }), _jsx("path", { d: "M12 10 L8 6", stroke: accentColor, strokeWidth: "1.5", strokeLinecap: "round", className: "animate-pulse" }), _jsx("path", { d: "M28 10 L32 6", stroke: accentColor, strokeWidth: "1.5", strokeLinecap: "round", className: "animate-pulse" })] })), _jsx("circle", { cx: "20", cy: "12", r: "3", fill: accentColor, className: "tower-core-glow" }), _jsx("rect", { x: "19.5", y: "4", width: "1", height: "8", fill: accentColor, className: "animate-pulse" }), _jsx("circle", { cx: "20", cy: "12", r: "8", fill: "none", stroke: accentColor, className: "tower-antenna-signal", style: { animationDelay: '0s' } }), _jsx("circle", { cx: "20", cy: "12", r: "14", fill: "none", stroke: accentColor, className: "tower-antenna-signal", style: { animationDelay: '0.5s' } })] }), (building.duration ?? 0) > 0 && (_jsx("div", { className: `absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-800 border border-${building.owner === PlayerID.P1 ? 'cyan' : 'red'}-400 flex items-center justify-center text-[8px] font-black text-white shadow-lg z-30`, children: building.duration }))] })] }));
        }
        else if (building.type === 'hub') {
            return (_jsxs("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible", children: [_jsx("div", { className: "building-range-indicator hub-range-indicator", style: { borderColor: `${accentColor}40`, borderStyle: 'dashed' } }), _jsx("div", { className: "relative w-8 h-8 flex items-center justify-center animate-[towerFloat_3s_ease-in-out_infinite]", children: _jsxs("svg", { viewBox: "0 0 40 40", className: "w-full h-full drop-shadow-xl", children: [_jsx("rect", { x: "8", y: "8", width: "24", height: "24", rx: "4", fill: "#1e293b", stroke: accentColor, strokeWidth: "2" }), _jsx("path", { d: "M12 20 L28 20 M20 12 L20 28", stroke: accentColor, strokeWidth: "1", opacity: "0.3" }), _jsx("circle", { cx: "20", cy: "20", r: "6", fill: "none", stroke: accentColor, strokeWidth: "1", strokeDasharray: "2 2", className: "animate-spin" }), isLvl2 && _jsx("rect", { x: "14", y: "14", width: "12", height: "12", rx: "1", fill: "none", stroke: accentColor, className: "animate-pulse" }), isLvl3 && _jsx("circle", { cx: "20", cy: "20", r: "2", fill: accentColor, className: "animate-ping" }), _jsx(Cpu, { size: 16, className: `${colorClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` })] }) })] }));
        }
        else if (building.type === 'factory') {
            const ownerColor = building.owner === PlayerID.P1 ? '#3b82f6' : '#ef4444'; // Blue vs Red
            const ownerAccent = building.owner === PlayerID.P1 ? '#22d3ee' : '#f87171';
            return (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible", children: _jsx("div", { className: "relative w-8 h-8 flex items-center justify-center", children: _jsxs("svg", { viewBox: "0 0 40 40", className: "w-full h-full drop-shadow-[0_0_8px_rgba(30,41,59,0.5)]", children: [_jsx("path", { d: "M5 35 L35 35 L35 25 L30 20 L30 15 L25 15 L25 20 L15 15 L15 10 L10 10 L10 15 L5 25 Z", fill: ownerColor, stroke: "#1e293b", strokeWidth: "1.5", className: "transition-colors duration-500" }), _jsx("rect", { x: "12", y: "5", width: "4", height: "10", fill: "#475569", stroke: "#1e293b" }), building.level >= 2 && _jsx("rect", { x: "22", y: "5", width: "4", height: "10", fill: "#475569", stroke: "#1e293b" }), _jsxs("g", { className: "smoke-container", children: [_jsx("circle", { cx: "14", cy: "2", r: "2.5", fill: "#94a3b8", className: "animate-[smoke_2s_infinite_ease-out]" }), building.level >= 2 && _jsx("circle", { cx: "24", cy: "2", r: "2.5", fill: "#94a3b8", className: "animate-[smoke_2s_infinite_0.7s_ease-out]" })] }), _jsx("circle", { cx: "20", cy: "27", r: "6", fill: ownerAccent, opacity: "0.3", className: "animate-ping" }), _jsx(FlaskConical, { size: 14, className: "text-white absolute top-[22px] left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" })] }) }) }));
        }
        return null;
    };
    return (_jsxs("div", { onClick: onClick, className: `
        relative w-full aspect-square flex items-center justify-center text-xs font-bold transition-all duration-300
        ${bgColor}
        ${!cell.isObstacle ? 'hover:bg-opacity-90 hover:scale-[1.02] hover:z-30' : ''}
        ${unit ? ((evolutionLevelA >= 1 || evolutionLevelB >= 1 || isSelected) ? 'z-50' : 'z-20') : (mine ? 'z-10' : '')}
        group overflow-visible rounded-sm
      `, id: `cell-${cell.r}-${cell.c}`, children: [renderBuilding(), isP1Base && _jsx("div", { className: "absolute inset-0 border-4 border-cyan-500/40 pointer-events-none shadow-inset shadow-cyan-500/20" }), isP2Base && _jsx("div", { className: "absolute inset-0 border-4 border-red-500/40 pointer-events-none shadow-inset shadow-red-500/20" }), cell.hasEnergyOre && (_jsx("div", { className: `absolute ${unit ? 'bottom-0.5 right-0.5 z-30' : 'inset-0 flex items-center justify-center'} transition-all`, children: _jsx(EnergyCrystal, { size: unit ? 16 : (cell.oreSize === 'large' ? 32 : cell.oreSize === 'medium' ? 24 : 18), oreSize: cell.oreSize || 'small' }) })), mine && isMineVisible && (_jsxs("div", { className: `absolute opacity-95 drop-shadow-2xl animate-pulse ${unit ? 'bottom-0.5 left-0.5 z-10' : 'inset-0 flex items-center justify-center'} ${mine?.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400'}`, children: [mine.owner === currentPlayer && !unit && (_jsx("div", { className: `absolute inset-0 rounded-full border-2 ${mine.owner === PlayerID.P1 ? 'border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'border-red-400/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`, style: { transform: 'scale(1.2)', zIndex: 100 } })), _jsx("div", { className: `text-[11px] font-black text-center ${unit ? 'hidden' : 'absolute -top-4 left-0 right-0'} text-white`, children: mine.type === MineType.NORMAL ? '' :
                            mine.type === MineType.SLOW ? '減' :
                                mine.type === MineType.SMOKE ? '煙' :
                                    mine.type === MineType.CHAIN ? '連' :
                                        mine.type === MineType.NUKE ? '核' : '' }), mine.type === MineType.NORMAL && _jsx(Bomb, { size: unit ? 16 : 28, className: "drop-shadow-lg" }), mine.type === MineType.SMOKE && _jsx(Cloud, { size: unit ? 16 : 28, className: "drop-shadow-lg text-slate-300" }), mine.type === MineType.SLOW && _jsx(Snowflake, { size: unit ? 16 : 28, className: "drop-shadow-lg text-blue-200" }), mine.type === MineType.CHAIN && _jsx(Share2, { size: unit ? 16 : 28, className: "drop-shadow-lg text-purple-400" }), mine.type === MineType.NUKE && _jsx(Radiation, { size: unit ? 16 : 28, className: "drop-shadow-lg text-emerald-400" })] })), isHub31Smoke && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-70", children: _jsx(Cloud, { size: 24, className: `drop-shadow-lg ${hubBoundaryBuilding?.owner === PlayerID.P1 ? 'text-cyan-200' : 'text-red-200'}` }) })), _jsxs("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible", children: [isP1FlagHere && !unit && (_jsx(Flag, { size: 20, className: "text-cyan-400 absolute z-10 drop-shadow-lg animate-pulse", fill: "currentColor" })), isP1FlagHere && p1GeneralLevelB >= 3 && p1GeneralVariantB === 2 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-1" }), _jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-2" }), _jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-3" })] }))] }), isInsideP1ShieldZone && (_jsx("div", { className: "absolute inset-0 shield-domain-p1 pointer-events-none", style: { zIndex: 0 } })), isInsideP1DamageZone && (_jsx("div", { className: "absolute inset-0 damage-domain-p1 pointer-events-none", style: { zIndex: 0 } })), _jsxs("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible", children: [isP2FlagHere && !unit && (_jsx(Flag, { size: 20, className: "text-red-400 absolute z-10 drop-shadow-lg animate-pulse", fill: "currentColor" })), isP2FlagHere && p2GeneralLevelB >= 3 && p2GeneralVariantB === 2 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-1" }), _jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-2" }), _jsx("div", { className: "flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-3" })] }))] }), isInsideP2ShieldZone && (_jsx("div", { className: "absolute inset-0 shield-domain-p2 pointer-events-none", style: { zIndex: 0 } })), isInsideP2DamageZone && (_jsx("div", { className: "absolute inset-0 damage-domain-p2 pointer-events-none", style: { zIndex: 0 } })), isInsideFactoryRange && (_jsx("div", { className: "absolute inset-0 factory-domain pointer-events-none", style: { zIndex: 0 } })), unit && !unit.isDead && (_jsxs("div", { className: `
            relative z-20 w-10 h-10 rounded-full flex flex-col items-center justify-center overflow-visible
            ${unit?.owner === PlayerID.P1 ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-cyan-100 border-2 border-cyan-400' : 'bg-gradient-to-br from-red-600 to-pink-700 text-red-100 border-2 border-red-400'}
            transition-all
            ${unit.hasActedThisRound ? 'opacity-90' : ''} 
            ${unit.hasActedThisRound ? '[&>.unit-body]:grayscale [&>.unit-icon]:grayscale' : ''} 
            ${cell.hasEnergyOre ? 'ring-2 ring-purple-500' : ''}
            ${unit?.owner === PlayerID.P1 ? 'before:absolute before:inset-0 before:bg-cyan-400/20 before:rounded-full before:-z-10 before:blur-md' : 'before:absolute before:inset-0 before:bg-red-400/20 before:rounded-full before:-z-10 before:blur-md'}
            ${evolutionLevelA > 0 && evolutionLevelB === 0 ? (evolutionLevelA === 1 ? 'evolution-aura-a-lv1' : evolutionLevelA === 2 ? 'evolution-aura-a-lv2' : 'evolution-aura-a-lv3') : ''}
            ${evolutionLevelB > 0 && evolutionLevelA === 0 ? (evolutionLevelB === 1 ? 'evolution-aura-b-lv1' : evolutionLevelB === 2 ? 'evolution-aura-b-lv2' : 'evolution-aura-b-lv3') : ''}
            ${evolutionLevelA > 0 && evolutionLevelB > 0 ? (Math.max(evolutionLevelA, evolutionLevelB) === 1 ? 'evolution-aura-gold-lv1' : Math.max(evolutionLevelA, evolutionLevelB) === 2 ? 'evolution-aura-gold-lv2' : 'evolution-aura-gold-lv3') : ''}
          `, style: {
                    animation: evolutionLevelA > 0 && evolutionLevelB > 0
                        ? `spin 2s linear infinite, spinReverse 2s linear infinite`
                        : evolutionLevelA > 0
                            ? 'spin 2s linear infinite'
                            : evolutionLevelB > 0
                                ? 'spinReverse 2s linear infinite'
                                : 'none',
                    boxShadow: unit?.owner === PlayerID.P1 ? '0 0 12px rgba(34, 211, 238, 0.6)' : '0 0 12px rgba(239, 68, 68, 0.6)'
                }, children: [_jsx("div", { className: `unit-body absolute inset-0 rounded-full -z-10 ${unit?.owner === PlayerID.P1 ? 'bg-gradient-to-br from-cyan-600 to-blue-700' : 'bg-gradient-to-br from-red-600 to-pink-700'}` }), _jsx("div", { className: "unit-icon relative z-20", children: _jsx("div", { className: `p-1 rounded-full ${isUnitStealthed ? 'stealth-overlay bg-white/5 blur-[0.5px]' : ''}`, children: getUnitIcon(unit.type) }) }), evolutionLevelA > 0 && (_jsxs(_Fragment, { children: [evolutionLevelA === 1 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            top: '-12px',
                                            left: '50%',
                                            transform: 'translateX(-50%) rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(96, 165, 250)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '38px',
                                            height: '38px',
                                            border: '1px solid rgba(96, 165, 250, 0.4)',
                                            borderRadius: '50%',
                                            pointerEvents: 'none'
                                        } })] })), evolutionLevelA === 2 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            top: '-15px',
                                            left: 'calc(50% - 4px)',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(96, 165, 250)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)',
                                            animation: 'accessoryBreatheTop 2s ease-in-out infinite'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: '-8px',
                                            left: '-8px',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(96, 165, 250)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)',
                                            animation: 'accessoryBreatheBottomLeft 2s ease-in-out infinite'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: '-8px',
                                            right: '-8px',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(96, 165, 250)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)',
                                            animation: 'accessoryBreatheBottomRight 2s ease-in-out infinite'
                                        } })] })), evolutionLevelA === 3 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% - 38px)', // -34px - 4px
                                            left: 'calc(50% - 4px)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantA === 2 ? 'rgb(168, 85, 247)' : 'rgb(147, 197, 253)', // Purple vs Light Blue
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantA === 2 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(147, 197, 253, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '0px',
                                            '--breathe-y': '-5px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% - 14.5px)', // -10.5px - 4px
                                            left: 'calc(50% + 28.3px)', // +32.3px - 4px
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantA === 2 ? 'rgb(168, 85, 247)' : 'rgb(147, 197, 253)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantA === 2 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(147, 197, 253, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '4px',
                                            '--breathe-y': '-2px'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% + 23.5px)', // +27.5px - 4px
                                            left: 'calc(50% + 16px)', // +20px - 4px
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantA === 2 ? 'rgb(168, 85, 247)' : 'rgb(147, 197, 253)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantA === 2 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(147, 197, 253, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '3px',
                                            '--breathe-y': '4px'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% + 23.5px)', // +27.5px - 4px
                                            left: 'calc(50% - 24px)', // -20px - 4px
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantA === 2 ? 'rgb(168, 85, 247)' : 'rgb(147, 197, 253)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantA === 2 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(147, 197, 253, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '-3px',
                                            '--breathe-y': '4px'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% - 14.5px)', // -10.5px - 4px
                                            left: 'calc(50% - 36.3px)', // -32.3px - 4px
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantA === 2 ? 'rgb(168, 85, 247)' : 'rgb(147, 197, 253)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantA === 2 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(147, 197, 253, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '-4px',
                                            '--breathe-y': '-2px'
                                        } })] }))] })), evolutionLevelB > 0 && (_jsxs(_Fragment, { children: [evolutionLevelB === 1 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: '-12px',
                                            left: 'calc(50% - 4px)',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(251, 146, 60)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(251, 146, 60, 0.8)',
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '0px',
                                            '--breathe-y': '5px'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '38px',
                                            height: '38px',
                                            border: '1px solid rgba(251, 146, 60, 0.4)',
                                            borderRadius: '50%',
                                            pointerEvents: 'none'
                                        } })] })), evolutionLevelB === 2 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: '-15px',
                                            left: 'calc(50% - 4px)',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(251, 146, 60)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(251, 146, 60, 0.8)',
                                            animation: 'accessoryBreatheTop 2s ease-in-out infinite'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            top: '-8px',
                                            left: '-8px',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(251, 146, 60)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(251, 146, 60, 0.8)',
                                            animation: 'accessoryBreatheBottomLeft 2s ease-in-out infinite'
                                        } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            transform: 'rotate(45deg)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'rgb(251, 146, 60)',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(251, 146, 60, 0.8)',
                                            animation: 'accessoryBreatheBottomRight 2s ease-in-out infinite'
                                        } })] })), evolutionLevelB === 3 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% + 30px)', // +34px - 4px
                                            left: 'calc(50% - 4px)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantB === 2 ? 'rgb(239, 68, 68)' : 'rgb(250, 204, 21)', // Red vs Yellow-400
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '0px',
                                            '--breathe-y': '5px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% + 6.5px)', // +10.5px - 4px
                                            left: 'calc(50% + 28.3px)', // +32.3px - 4px
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantB === 2 ? 'rgb(239, 68, 68)' : 'rgb(250, 204, 21)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '4px',
                                            '--breathe-y': '2px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% - 31.5px)', // -27.5px - 4px
                                            left: 'calc(50% + 16px)', // +20.0px - 4px
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantB === 2 ? 'rgb(239, 68, 68)' : 'rgb(250, 204, 21)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '3px',
                                            '--breathe-y': '-4px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% - 31.5px)', // -27.5px - 4px
                                            left: 'calc(50% - 24px)', // -20.0px - 4px
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantB === 2 ? 'rgb(239, 68, 68)' : 'rgb(250, 204, 21)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '-3px',
                                            '--breathe-y': '-4px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: 'calc(50% + 6.5px)', // +10.5px - 4px
                                            left: 'calc(50% - 36.3px)', // -32.3px - 4px
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: evolutionVariantB === 2 ? 'rgb(239, 68, 68)' : 'rgb(250, 204, 21)',
                                            borderRadius: '2px',
                                            boxShadow: `0 0 4px ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)'}`,
                                            animation: 'accessoryBreathe 2s ease-in-out infinite',
                                            '--breathe-x': '-4px',
                                            '--breathe-y': '2px',
                                            transform: 'rotate(45deg)'
                                        } }), _jsx("div", { className: "evolution-accessory", style: {
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '40px',
                                            height: '40px',
                                            border: `1px solid ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.4)'}`,
                                            borderRadius: '50%',
                                            pointerEvents: 'none'
                                        } })] }))] })), particles.map(p => (_jsx("div", { className: `evolution-particle ${p.color === 'blue' ? 'evolution-particle-blue' : 'evolution-particle-orange'}`, style: {
                            '--tx': `${p.x}px`,
                            '--ty': `${p.y}px`,
                            animation: `${p.delay % 2 === 0 ? 'particleFloat' : 'particleFloatAlt'} 1s ease-out forwards`,
                            animationDelay: `${p.delay}s`,
                            left: '50%',
                            top: '50%',
                            marginLeft: '-2px',
                            marginTop: '-2px'
                        } }, p.id))), _jsx("div", { className: "absolute -bottom-1 w-8 h-2 bg-slate-950 rounded-full overflow-hidden border-2 border-slate-700 shadow-lg", children: _jsx("div", { className: `h-full transition-all ${unit.hp < unit.maxHp * 0.3 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'}`, style: { width: `${(unit.hp / unit.maxHp) * 100}%` } }) }), unit.hasFlag && (_jsx("div", { className: "absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full p-0.5 animate-pulse border-2 border-yellow-300 shadow-lg shadow-yellow-500/50", children: _jsx(Flag, { size: 10, fill: "currentColor" }) })), unit.hasActedThisRound && (_jsx("div", { className: "absolute inset-0 z-30 pointer-events-none", children: _jsx("svg", { viewBox: "0 0 100 100", className: "w-full h-full opacity-80", children: _jsx("line", { x1: "20", y1: "20", x2: "80", y2: "80", stroke: "#ef4444", strokeWidth: "15", strokeLinecap: "round" }) }) }))] })), unit && unit.isDead && (_jsx("div", { className: "absolute inset-0 z-20 bg-slate-700/80 flex items-center justify-center rounded-full border-2 border-red-500", children: _jsx("span", { className: "text-2xl font-black text-red-400", children: "DEAD" }) })), (isSmoked || isHub31Smoke) && (_jsxs("div", { className: "absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-sm", children: [_jsx("div", { className: `absolute inset-0 ${(isHub31Smoke ? hubBoundaryBuilding.owner : smokeOwner) === PlayerID.P1 ? 'bg-cyan-900/40' : 'bg-red-900/40'} mix-blend-overlay` }), _jsx("div", { className: "absolute inset-[-20%] bg-slate-400/40 blur-2xl animate-pulse" }), _jsx(Cloud, { size: 44, className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" }), _jsx(Cloud, { size: 32, className: "absolute top-0 left-0 text-slate-200/40 animate-[towerFloat_4s_infinite]" }), _jsx(Cloud, { size: 28, className: "absolute bottom-0 right-0 text-slate-300/40 animate-[towerFloat_5s_infinite_reverse]" }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" })] }))] }));
};
export default React.memo(GridCell, (prevProps, nextProps) => {
    // Return true if props are equal (no re-render), false if different (re-render)
    // Custom comparison to ensure evolutionLevelA changes trigger re-render
    if (prevProps.selectedGeneralLevelA !== nextProps.selectedGeneralLevelA)
        return false;
    if (prevProps.evolutionLevelA !== nextProps.evolutionLevelA)
        return false;
    if (prevProps.evolutionLevelB !== nextProps.evolutionLevelB)
        return false;
    if (prevProps.targetMode !== nextProps.targetMode)
        return false;
    if (prevProps.selectedUnit !== nextProps.selectedUnit)
        return false;
    if (prevProps.isSelected !== nextProps.isSelected)
        return false;
    if (prevProps.isValidMove !== nextProps.isValidMove)
        return false;
    if (prevProps.isAttackTarget !== nextProps.isAttackTarget)
        return false;
    if (prevProps.isSkillTarget !== nextProps.isSkillTarget)
        return false;
    if (prevProps.cell !== nextProps.cell)
        return false;
    if (prevProps.unit !== nextProps.unit)
        return false;
    if (prevProps.mine !== nextProps.mine)
        return false;
    if (prevProps.building !== nextProps.building)
        return false;
    if (prevProps.buildings !== nextProps.buildings)
        return false;
    if (prevProps.p1FlagLoc !== nextProps.p1FlagLoc)
        return false;
    if (prevProps.p2FlagLoc !== nextProps.p2FlagLoc)
        return false;
    if (prevProps.evolutionVariantA !== nextProps.evolutionVariantA)
        return false;
    if (prevProps.evolutionVariantB !== nextProps.evolutionVariantB)
        return false;
    if (prevProps.p1GeneralLevelB !== nextProps.p1GeneralLevelB)
        return false;
    if (prevProps.p2GeneralLevelB !== nextProps.p2GeneralLevelB)
        return false;
    if (prevProps.isSmoked !== nextProps.isSmoked)
        return false;
    if (prevProps.smokeOwner !== nextProps.smokeOwner)
        return false;
    if (prevProps.forceShowMines !== nextProps.forceShowMines)
        return false;
    if (prevProps.isUnitStealthed !== nextProps.isUnitStealthed)
        return false;
    if (prevProps.currentPlayer !== nextProps.currentPlayer)
        return false;
    return true;
});
