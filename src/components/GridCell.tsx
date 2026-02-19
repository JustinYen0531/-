import React from 'react';
import { Cell, Unit, Mine, PlayerID, UnitType, Building, MineType, TargetMode } from '../types';
import { Shield, Crown, Eye, Bomb, Footprints, Flag, Cpu, FlaskConical, Cloud, Share2, Radiation, Snowflake } from '../icons';
import { P1_FLAG_POS, P2_FLAG_POS } from '../constants';
import './GridCell.css';

const EnergyCrystal: React.FC<{ size: number, oreSize?: 'small' | 'medium' | 'large' }> = ({ size, oreSize = 'small' }) => {
  const Shard = ({ d, className = "crystal-facet-main" }: { d: string, className?: string }) => (
    <path d={d} className={`crystal-facet ${className}`} strokeLinecap="round" strokeLinejoin="round" />
  );

  const Outline = ({ d }: { d: string }) => (
    <path d={d} className="crystal-outline" strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="energy-crystal-container overflow-visible">
      {oreSize === 'small' && (
        <g transform="translate(5, 5) scale(0.9)">
          <Outline d="M50 5 L80 45 L50 95 L20 45 Z" />
          <Shard d="M50 5 L80 45 L50 95 L20 45 Z" className="crystal-facet-main" />
          <Shard d="M50 5 L50 95" className="crystal-facet-light" />
          <Shard d="M20 45 L80 45" className="crystal-facet-dark" />
        </g>
      )}

      {oreSize === 'medium' && (
        <g transform="translate(5, 5) scale(0.9)">
          <Outline d="M50 0 L80 40 L50 95 L20 40 Z" />
          <Shard d="M50 0 L80 40 L50 95 L20 40 Z" className="crystal-facet-main" />
          <Shard d="M50 0 L50 95" className="crystal-facet-light" />
          <Shard d="M30 30 L45 50 L35 80 L15 60 Z" className="crystal-facet-dark" />
          <Shard d="M70 30 L55 50 L65 80 L85 60 Z" className="crystal-facet-dark" />
        </g>
      )}

      {oreSize === 'large' && (
        <g>
          <Outline d="M50 5 L85 40 L50 95 L15 40 Z" />
          <Shard d="M30 40 L45 20 L60 40 L45 70 Z" className="crystal-facet-dark" />
          <Shard d="M70 40 L55 20 L40 40 L55 70 Z" className="crystal-facet-dark" />
          <Shard d="M50 5 L85 40 L50 95 L15 40 Z" className="crystal-facet-main" />
          <Shard d="M50 5 L50 95" className="crystal-facet-light" />
          <path d="M15 40 L85 40 L50 65 Z" className="crystal-hollow-center" />
          <circle cx="50" cy="50" r="8" className="crystal-core" />
          <Shard d="M20 60 L35 75 L25 90 L10 80 Z" className="crystal-facet-light" />
          <Shard d="M80 60 L65 75 L75 90 L90 80 Z" className="crystal-facet-light" />
        </g>
      )}
    </svg>
  );
};

interface GridCellProps {
  cell: Cell;
  unit?: Unit;
  mine?: Mine;
  scanMarkSuccess?: boolean | null;
  building?: Building;
  isSelected: boolean;
  isValidMove: boolean;
  isAttackTarget: boolean;
  isSkillTarget?: boolean;
  currentPlayer: PlayerID;
  onClick: () => void;
  onDismissMiss?: () => void;
  p1FlagLoc: { r: number, c: number };
  p2FlagLoc: { r: number, c: number };
  targetMode?: TargetMode;
  selectedUnit?: Unit;
  selectedGeneralLevelA?: number;
  evolutionLevelA?: number;
  evolutionLevelB?: number;
  evolutionVariantA?: 1 | 2 | null;
  evolutionVariantB?: 1 | 2 | null;
  p1GeneralLevelB?: number;
  p2GeneralLevelB?: number;
  p1GeneralVariantB?: 1 | 2 | null;
  p2GeneralVariantB?: 1 | 2 | null;
  buildings?: Building[];
  isSmoked?: boolean;
  smokeOwner?: PlayerID;
  forceShowMines?: boolean;
  isUnitStealthed?: boolean;
  selectedUnitLevelB?: number;
}

const GridCell: React.FC<GridCellProps> = ({
  cell,
  unit,
  mine,
  scanMarkSuccess = null,
  building,
  isSelected,
  isValidMove,
  isAttackTarget,
  isSkillTarget,
  currentPlayer,
  onClick,
  onDismissMiss,
  p1FlagLoc,
  p2FlagLoc,
  targetMode,
  selectedUnit,
  selectedGeneralLevelA = 0,
  evolutionLevelA = 0,
  evolutionLevelB = 0,
  p1GeneralLevelB = 0,
  p2GeneralLevelB = 0,
  p1GeneralVariantB = null,
  p2GeneralVariantB = null,
  evolutionVariantA = null,
  evolutionVariantB = null,
  buildings = [],
  isSmoked = false,
  smokeOwner,
  forceShowMines = false,
  isUnitStealthed = false,
  selectedUnitLevelB = 0
}) => {
  const [particles, setParticles] = React.useState<Array<{ id: string, x: number, y: number, color: string, delay: number }>>([]);
  const [isLocallyDismissed, setIsLocallyDismissed] = React.useState(false);
  const prevLevelA = React.useRef(evolutionLevelA);
  const prevLevelB = React.useRef(evolutionLevelB);

  // When the actual prop updates (e.g. cleared by game state or re-scanned), reset local state
  React.useEffect(() => {
    setIsLocallyDismissed(false);
  }, [scanMarkSuccess]);

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

    if (targetMode === 'move' && manhattanDist === 1 && !cell.isObstacle && !unit) {
      isInActionRange = true;
      actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
    } else if (targetMode === 'scan' && manhattanDist <= 3) {
      isInActionRange = true;
      actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
    } else if (targetMode === 'sensor_scan' && chebyshevDist <= 2) {
      isInActionRange = true;
      actionRangeColor = 'border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]';
    } else if ((targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'place_factory') && manhattanDist === 0) {
      isInActionRange = true;
      actionRangeColor = 'action-range-on-spot';
    } else if (targetMode === 'throw_mine' && manhattanDist <= 2) {
      isInActionRange = true;
      actionRangeColor = 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
    } else if (targetMode === 'pickup_mine_select' && manhattanDist <= (selectedUnitLevelB >= 1 ? 2 : 0)) {
      isInActionRange = true;
      actionRangeColor = 'border-yellow-600 shadow-[0_0_10px_rgba(202,138,4,0.6)]';
    } else if (targetMode === 'disarm') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      const chebyshevDist = Math.max(dr, dc);

      // Check if selected unit is a Defuser
      if (selectedUnit.type === UnitType.DEFUSER) {
        const range = (selectedUnitLevelB >= 1) ? 3 : 2;
        if (dr + dc <= range) {
          isInActionRange = true;
          actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]';
        }
      } else {
        // Non-Defuser: Only on-spot
        if (chebyshevDist === 0) {
          isInActionRange = true;
          actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.6)]';
        }
      }
    } else if (targetMode === 'attack' && selectedUnit) {
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
    } else if (targetMode === 'place_mine') {
      // Updated Place Mine Highlighting Logic
      const factories = buildings.filter(b => b.owner === selectedUnit.owner && b.type === 'factory');

      // Self placement is always '+' range (Manhattan <= 1).
      // Factory placement range is handled separately below.
      const manhattanDist = Math.abs(selectedUnit.r - cell.r) + Math.abs(selectedUnit.c - cell.c);
      let allowed = manhattanDist <= 1;

      // Factory Range Extension
      const isInFactoryRange = factories.some(f =>
        f.level >= 2
          ? (Math.abs(f.r - cell.r) + Math.abs(f.c - cell.c) <= 2)
          : (Math.max(Math.abs(f.r - cell.r), Math.abs(f.c - cell.c)) <= 1)
      );

      if (isInFactoryRange) allowed = true;

      if (allowed) {
        isInActionRange = true;
        actionRangeColor = 'border-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.6)]';
      }
    } else if (targetMode === 'move_mine_start' || targetMode === 'move_mine_end' || targetMode === 'convert_mine') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      if (dr + dc <= 2) {
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
  } else {
    // P2 Zone - Red Neon
    bgColor = 'bg-red-950/80 border border-red-500/30 shadow-[inset_0_0_4px_#ef4444,0_0_6px_rgba(239,68,68,0.1)]';
  }

  if (cell.isObstacle) bgColor = 'bg-slate-700 border-2 border-white/70 shadow-[0_0_6px_rgba(255,255,255,0.3),inset_0_0_6px_rgba(255,255,255,0.1)] animate-breathe pattern-diagonal-lines';
  if (isInActionRange && targetMode === 'scan') bgColor = `bg-slate-900 border-2 ${actionRangeColor}`;
  else if (isSelected && targetMode !== 'scan') bgColor = 'bg-yellow-900/60 ring-2 ring-yellow-400 border-2 border-yellow-400 shadow-lg shadow-yellow-500/50';
  else if (isValidMove) bgColor = 'bg-emerald-900/60 ring-2 ring-emerald-400 border-2 border-emerald-400 cursor-pointer animate-pulse shadow-lg shadow-emerald-500/40';
  else if (isAttackTarget) bgColor = 'bg-red-900/60 ring-2 ring-red-400 border-2 border-red-400 cursor-pointer shadow-lg shadow-red-500/40';
  else if (isSkillTarget) bgColor = 'bg-purple-900/60 ring-2 ring-purple-400 border-2 border-purple-400 cursor-pointer animate-pulse shadow-lg shadow-purple-500/40';
  else if (isInActionRange) bgColor = `bg-slate-900 border-2 ${actionRangeColor}`;

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
  const factoryRangeBuilding = buildings.find(b =>
    b.type === 'factory' &&
    (
      b.level >= 2
        ? (Math.abs(cell.r - b.r) + Math.abs(cell.c - b.c) <= 2)
        : (Math.abs(cell.r - b.r) <= 1 && Math.abs(cell.c - b.c) <= 1)
    )
  );
  const isInsideFactoryRange = !!factoryRangeBuilding;

  // Checker for Hub Area (Ranger Path A Tier 1) - Manhattan Distance 2
  const hubMoveZoneBuilding = buildings.find(b =>
    b.type === 'hub' &&
    (Math.abs(cell.r - b.r) + Math.abs(cell.c - b.c) <= 2)
  );
  const isInsideHubRange = !!hubMoveZoneBuilding;

  // Ranger Path A3-1 smoke uses Manhattan Distance 2 around the hub
  const hubSmokeBuilding = buildings.find(b =>
    b.type === 'hub' &&
    b.level === 3 &&
    b.variant === 1 &&
    (Math.abs(cell.r - b.r) + Math.abs(cell.c - b.c) <= 2)
  );
  const isHub31Smoke = !!hubSmokeBuilding;

  if (isInsideHubRange && !cell.isObstacle) {
    bgColor = `${bgColor} border-2 border-dashed ${hubMoveZoneBuilding!.owner === PlayerID.P1 ? 'border-cyan-500/50' : 'border-red-500/50'}`;
  }

  // Checker for Tower Range - 3x3 Range
  const towerBuilding = buildings.find(b =>
    b.type === 'tower' &&
    Math.abs(cell.r - b.r) <= 1 &&
    Math.abs(cell.c - b.c) <= 1
  );
  const isInsideTowerRange = !!towerBuilding;
  const friendlyTowerInRange = buildings.some(b =>
    b.type === 'tower' &&
    b.owner === currentPlayer &&
    Math.abs(cell.r - b.r) <= 1 &&
    Math.abs(cell.c - b.c) <= 1
  );

  if (isInsideTowerRange && !cell.isObstacle) {
    bgColor = `${bgColor} border-2 border-dotted ${towerBuilding!.owner === PlayerID.P1
      ? '!border-cyan-300/90 shadow-[inset_0_0_8px_rgba(34,211,238,0.45)]'
      : '!border-rose-300/90 shadow-[inset_0_0_8px_rgba(244,63,94,0.4)]'
      }`;
  }


  // Mine Visibility Logic - strict check including smoke
  // When in Sandbox "Normal" mode, we filter strictly based on who the user currently "is" (currentPlayer)
  const isMineVisible = forceShowMines || (!!mine &&
    ((mine.owner === currentPlayer || mine.revealedTo.includes(currentPlayer) || friendlyTowerInRange)) &&
    !((isSmoked && smokeOwner !== currentPlayer) || (isHub31Smoke && hubSmokeBuilding?.owner !== currentPlayer))
  );
  const enemyPlayer = currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
  const mineIsRevealedToViewer = !!mine && (forceShowMines || mine.revealedTo.includes(currentPlayer));
  const mineIsKnownByEnemy = !!mine && mine.revealedTo.includes(enemyPlayer);
  // Eye icon: show only on my mines that are known by the enemy (to warn they are revealed)
  const shouldShowEye =
    mine && isMineVisible && !unit &&
    mine.owner === currentPlayer &&
    mineIsKnownByEnemy;
  const showCarriedMineIndicator = unit && unit.type === UnitType.RANGER && unit.carriedMine &&
    (unit.owner === currentPlayer || unit.carriedMineRevealed || friendlyTowerInRange);

  const getUnitIcon = (type: UnitType) => {
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
      case UnitType.GENERAL: return <Crown size={18} strokeWidth={3} className={`${color} drop-shadow-lg animate-pulse`} style={{ filter: 'drop-shadow(0 0 6px rgba(253, 224, 71, 0.8))' }} />;
      case UnitType.MINESWEEPER: return <Eye size={18} strokeWidth={3} className={`${color} drop-shadow-lg animate-pulse`} style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.8))' }} />;
      case UnitType.RANGER: return <Footprints size={18} strokeWidth={3} className={`${color} drop-shadow-lg animate-pulse`} style={{ filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.8))' }} />;
      case UnitType.MAKER: return <Bomb size={18} strokeWidth={3} className={`${color} drop-shadow-lg animate-pulse`} style={{ filter: 'drop-shadow(0 0 6px rgba(252, 165, 165, 0.8))' }} />;
      case UnitType.DEFUSER: return <Shield size={18} strokeWidth={3} className={`${color} drop-shadow-lg animate-pulse`} style={{ filter: 'drop-shadow(0 0 6px rgba(147, 197, 253, 0.8))' }} />;
      default: return null;
    }
  };

  // Building Rendering
  const renderBuilding = () => {
    if (!building) return null;
    const colorClass = building.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400';
    const accentColor = building.owner === PlayerID.P1 ? '#22d3ee' : '#ef4444';
    const isLvl2 = building.level >= 1;
    const isLvl3 = building.level >= 2;

    if (building.type === 'tower') {
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible">
          {/* Effect Range Indicator - Removed global indicator in favor of per-cell border */}

          <div className={`relative w-8 h-8 flex items-center justify-center`}>
            {/* Core & Base */}
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-lg">
              {/* Pillar */}
              <rect x="18" y="15" width="4" height="20" rx="1" fill="#475569" />
              <rect x="10" y="32" width="20" height="4" rx="1" fill="#1e293b" stroke="#475569" />

              {/* Level 2: Floating Ring */}
              {isLvl2 && (
                <ellipse cx="20" cy="20" rx="15" ry="6" fill="none" stroke={accentColor} strokeWidth="1" strokeDasharray="4 2" className="animate-[towerRotate_4s_linear_infinite]" />
              )}

              {/* Level 3: Extra Parts */}
              {isLvl3 && (
                <>
                  <circle cx="20" cy="12" r="6" fill="none" stroke={accentColor} strokeWidth="0.5" className="animate-pulse" />
                  <path d="M12 10 L8 6" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" />
                  <path d="M28 10 L32 6" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" />
                </>
              )}

              {/* Antenna and Core */}
              <circle cx="20" cy="12" r="3" fill={accentColor} className="tower-core-glow" />
              <rect x="19.5" y="4" width="1" height="8" fill={accentColor} className="animate-pulse" />

              {/* Radar Pings */}
              <circle cx="20" cy="12" r="8" fill="none" stroke={accentColor} className="tower-antenna-signal" style={{ animationDelay: '0s' }} />
              <circle cx="20" cy="12" r="14" fill="none" stroke={accentColor} className="tower-antenna-signal" style={{ animationDelay: '0.5s' }} />
            </svg>

            {/* Duration Display */}
            {(building.duration ?? 0) > 0 && (
              <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-800 border border-${building.owner === PlayerID.P1 ? 'cyan-400' : 'red-400'} flex items-center justify-center text-[8px] font-black text-white shadow-lg z-30`}>
                {building.duration}
              </div>
            )}
          </div>
        </div>
      );
    } else if (building.type === 'hub') {
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible">
          {/* Hub Boundary: Dashed Line (Manhattan Distance 2) */}
          <div className="building-range-indicator hub-range-indicator" style={{ borderColor: `${accentColor}40`, borderStyle: 'dashed' }} />

          <div className="relative w-8 h-8 flex items-center justify-center animate-[towerFloat_3s_ease-in-out_infinite]">
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-xl">
              <rect x="8" y="8" width="24" height="24" rx="4" fill="#1e293b" stroke={accentColor} strokeWidth="2" />
              <path d="M12 20 L28 20 M20 12 L20 28" stroke={accentColor} strokeWidth="1" opacity="0.3" />
              <circle cx="20" cy="20" r="6" fill="none" stroke={accentColor} strokeWidth="1" strokeDasharray="2 2" className="animate-spin" />

              {/* Hub Levels */}
              {isLvl2 && <rect x="14" y="14" width="12" height="12" rx="1" fill="none" stroke={accentColor} className="animate-pulse" />}
              {isLvl3 && <circle cx="20" cy="20" r="2" fill={accentColor} className="animate-ping" />}

              <Cpu size={16} className={`${colorClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} />
            </svg>

            {/* Duration Display */}
            {(building.duration ?? 0) > 0 && (
              <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-800 border border-${building.owner === PlayerID.P1 ? 'cyan-400' : 'red-400'} flex items-center justify-center text-[8px] font-black text-white shadow-lg z-30`}>
                {building.duration}
              </div>
            )}
          </div>
        </div>
      );
    } else if (building.type === 'factory') {
      const ownerColor = building.owner === PlayerID.P1 ? '#3b82f6' : '#ef4444'; // Blue vs Red
      const ownerAccent = building.owner === PlayerID.P1 ? '#22d3ee' : '#f87171';
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-visible">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-[0_0_8px_rgba(30,41,59,0.5)]">
              {/* Base structure - now colors based on owner */}
              <path
                d="M5 35 L35 35 L35 25 L30 20 L30 15 L25 15 L25 20 L15 15 L15 10 L10 10 L10 15 L5 25 Z"
                fill={ownerColor}
                stroke="#1e293b"
                strokeWidth="1.5"
                className="transition-colors duration-500"
              />
              {/* Chimneys */}
              <rect x="12" y="5" width="4" height="10" fill="#475569" stroke="#1e293b" />
              {building.level >= 2 && <rect x="22" y="5" width="4" height="10" fill="#475569" stroke="#1e293b" />}

              {/* Enhanced Smoke for LV3/Active */}
              <g className="smoke-container">
                <circle cx="14" cy="2" r="2.5" fill="#94a3b8" className="animate-[smoke_2s_infinite_ease-out]" />
                {building.level >= 2 && <circle cx="24" cy="2" r="2.5" fill="#94a3b8" className="animate-[smoke_2s_infinite_0.7s_ease-out]" />}
              </g>

              {/* Core Glow */}
              <circle cx="20" cy="27" r="6" fill={ownerAccent} opacity="0.3" className="animate-ping" />
              <FlaskConical size={14} className="text-white absolute top-[22px] left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
            </svg>

            {/* Duration Display */}
            {(building.duration ?? 0) > 0 && (
              <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-800 border border-${building.owner === PlayerID.P1 ? 'cyan-400' : 'red-400'} flex items-center justify-center text-[8px] font-black text-white shadow-lg z-30`}>
                {building.duration}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };
  return (
    <div
      onClick={onClick}
      className={`
        relative w-full aspect-square flex items-center justify-center text-xs font-bold transition-all duration-300
        ${bgColor}
        ${!cell.isObstacle ? 'hover:bg-opacity-90 hover:scale-[1.02] hover:z-30' : ''}
        ${unit ? ((evolutionLevelA >= 1 || evolutionLevelB >= 1 || isSelected) ? 'z-50' : 'z-20') : (mine ? 'z-10' : '')}
        group overflow-visible rounded-sm
      `}
      id={`cell-${cell.r}-${cell.c}`}
    >
      {/* Dynamic Background Effects */}
      {renderBuilding()}
      {/* Bases */}
      {isP1Base && <div className="absolute inset-0 border-4 border-cyan-500/40 pointer-events-none shadow-inset shadow-cyan-500/20" />}
      {isP2Base && <div className="absolute inset-0 border-4 border-red-500/40 pointer-events-none shadow-inset shadow-red-500/20" />}

      {/* Ore - Visible even if unit is present, but style changes */}
      {
        cell.hasEnergyOre && (
          <div className={`absolute ${unit ? 'bottom-0.5 right-0.5 z-30' : 'inset-0 flex items-center justify-center'} transition-all`}>
            <EnergyCrystal
              size={unit ? 16 : (cell.oreSize === 'large' ? 32 : cell.oreSize === 'medium' ? 24 : 18)}
              oreSize={cell.oreSize || 'small'}
            />
          </div>
        )
      }

      {/* Mine (Underneath unit) */}
      {
        mine && isMineVisible && (
          <div className={`absolute opacity-95 drop-shadow-2xl animate-pulse ${unit ? 'bottom-0.5 left-0.5 z-40' : 'inset-0 flex items-center justify-center z-30'} ${mine?.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400'}`}>
            {/* Friendly Mine Visual Hint (Ring and Glow) - Use very high z-index and ensure overflow-visible on parent */}
            {mine.owner === currentPlayer && !unit && (
              <div
                className={`absolute inset-0 rounded-full border-2 ${mine.owner === PlayerID.P1 ? 'border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'border-red-400/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                style={{ transform: 'scale(1.2)', zIndex: 100 }}
              />
            )}
            {shouldShowEye && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-900 border border-white/60 flex items-center justify-center shadow-lg shadow-black/50 z-[120]">
                <Eye size={11} className="text-white drop-shadow-md" />
              </div>
            )}

            <div className={`text-[11px] font-black text-center ${unit ? 'hidden' : 'absolute -top-4 left-0 right-0'} text-white`}>
              {mine.type === MineType.NORMAL ? '' :
                mine.type === MineType.SLOW ? '減' :
                  mine.type === MineType.SMOKE ? '煙' :
                    mine.type === MineType.CHAIN ? '連' :
                      mine.type === MineType.NUKE ? '核' : ''}
            </div>
            {mine.type === MineType.NORMAL && <Bomb size={unit ? 16 : 28} className="drop-shadow-lg" />}
            {mine.type === MineType.SMOKE && <Cloud size={unit ? 16 : 28} className="drop-shadow-lg text-slate-300" />}
            {mine.type === MineType.SLOW && <Snowflake size={unit ? 16 : 28} className="drop-shadow-lg text-blue-200" />}
            {mine.type === MineType.CHAIN && <Share2 size={unit ? 16 : 28} className="drop-shadow-lg text-purple-400" />}
            {mine.type === MineType.NUKE && <Radiation size={unit ? 16 : 28} className="drop-shadow-lg text-emerald-400" />}
          </div>
        )
      }

      {/* Scan miss mark (kept below mine layer so mine visuals are never blocked) */}
      {scanMarkSuccess === false && !isLocallyDismissed && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 group/miss">
          <div
            className="relative px-1.5 py-0.5 rounded text-[10px] font-black border bg-red-600/90 text-red-50 border-red-200 pointer-events-auto cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              setIsLocallyDismissed(true); // Optimistic update: hide immediately
              if (onDismissMiss) onDismissMiss();
            }}
          >
            MISS
            {/* Close hint - appears on hover at top-right */}
            {onDismissMiss && (
              <span
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-slate-800 border border-red-300 text-red-200 flex items-center justify-center text-[8px] font-bold leading-none opacity-0 group-hover/miss:opacity-100 transition-opacity duration-150 hover:bg-red-700 hover:border-white hover:text-white shadow-md"
              >
                ✕
              </span>
            )}
          </div>
        </div>
      )}

      {/* Minimalist Persistent Smoke Effect */}
      {
        (isSmoked || isHub31Smoke) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-30">
            <Cloud
              size={28}
              className={`animate-[gentleBreathe_8s_infinite_ease-in-out] ${(isHub31Smoke ? hubSmokeBuilding?.owner : smokeOwner) === PlayerID.P1 ? 'text-cyan-200' : 'text-red-200'
                }`}
            />
          </div>
        )
      }

      {/* P1 Flag and Spirit Domain Pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
        {/* Flag Icon - Only visible if no unit is on cell */}
        {isP1FlagHere && !unit && (
          <Flag size={20} className="text-cyan-400 absolute z-10 drop-shadow-lg animate-pulse" fill="currentColor" />
        )}

        {/* Pulse Waves - Visible even if General carries flag */}
        {isP1FlagHere && p1GeneralLevelB >= 3 && p1GeneralVariantB === 2 && (
          <>
            <div className="flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-1" />
            <div className="flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-2" />
            <div className="flag-pulse-wave flag-pulse-wave-p1 flag-pulse-wave-3" />
          </>
        )}
      </div>

      {/* P1 Shield Zone 5x5 Indicator */}
      {
        isInsideP1ShieldZone && (
          <div
            className="absolute inset-0 shield-domain-p1 pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )
      }

      {/* P1 Damage Zone 3x3 Indicator */}
      {
        isInsideP1DamageZone && (
          <div
            className="absolute inset-0 damage-domain-p1 pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )
      }

      {/* P2 Flag and Spirit Domain Pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
        {/* Flag Icon - Only visible if no unit is on cell */}
        {isP2FlagHere && !unit && (
          <Flag size={20} className="text-red-400 absolute z-10 drop-shadow-lg animate-pulse" fill="currentColor" />
        )}

        {/* Pulse Waves - Visible even if General carries flag */}
        {isP2FlagHere && p2GeneralLevelB >= 3 && p2GeneralVariantB === 2 && (
          <>
            <div className="flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-1" />
            <div className="flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-2" />
            <div className="flag-pulse-wave flag-pulse-wave-p2 flag-pulse-wave-3" />
          </>
        )}
      </div>

      {/* P2 Shield Zone 5x5 Indicator */}
      {
        isInsideP2ShieldZone && (
          <div
            className="absolute inset-0 shield-domain-p2 pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )
      }

      {/* P2 Damage Zone 3x3 Indicator */}
      {
        isInsideP2DamageZone && (
          <div
            className="absolute inset-0 damage-domain-p2 pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )
      }

      {/* Factory Range Indicator (Maker Path B) */}
      {
        isInsideFactoryRange && (
          <div
            className="absolute inset-0 factory-domain pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )
      }


      {/* Unit */}
      {
        unit && !unit.isDead && (
          <div
            className={`
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
          `}
            style={{
              animation: evolutionLevelA > 0 && evolutionLevelB > 0
                ? `spin 2s linear infinite, spinReverse 2s linear infinite`
                : evolutionLevelA > 0
                  ? 'spin 2s linear infinite'
                  : evolutionLevelB > 0
                    ? 'spinReverse 2s linear infinite'
                    : 'none',
              boxShadow: unit?.owner === PlayerID.P1 ? '0 0 12px rgba(34, 211, 238, 0.6)' : '0 0 12px rgba(239, 68, 68, 0.6)'
            }}
          >

            <div className={`unit-body absolute inset-0 rounded-full -z-10 ${unit?.owner === PlayerID.P1 ? 'bg-gradient-to-br from-cyan-600 to-blue-700' : 'bg-gradient-to-br from-red-600 to-pink-700'}`} />

            <div className="unit-icon relative z-20">
              {/* Unit Icon with Stealth Effect */}
              <div className={`p-1 rounded-full ${isUnitStealthed ? 'stealth-overlay bg-white/5 blur-[0.5px]' : ''}`}>
                {getUnitIcon(unit.type)}
              </div>
            </div>

            {/* Evolution Accessories - Path A (Blue) */}
            {evolutionLevelA > 0 && (
              <>
                {/* LV1: 1 accessory at top */}
                {evolutionLevelA === 1 && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: 'rgb(96, 165, 250)',
                      borderRadius: '2px',
                      boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)'
                    }} />
                    {/* Circle outline for LV1 */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '38px',
                      height: '38px',
                      border: '1px solid rgba(96, 165, 250, 0.4)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />
                  </>
                )}

                {/* LV2: 3 accessories - Triangle formation */}
                {evolutionLevelA === 2 && (
                  <>
                    {/* Top point */}
                    <div style={{
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
                    }} />
                    {/* Bottom-left point */}
                    <div style={{
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
                    }} />
                    {/* Bottom-right point */}
                    <div style={{
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
                    }} />
                  </>
                )}

                {/* LV3: 5 accessories - Pentagon formation (Point Up) - Regular Pentagon */
                /* R = 34px. Center (0,0) relative to unit center.
                   Angles: 0 (Top), 72 (TR), 144 (BR), 216 (BL), 288 (TL)
                   Top: y = -34, x = 0
                   TR: y = -10.5, x = 32.3
                   BR: y = 27.5, x = 20.0
                   BL: y = 27.5, x = -20.0
                   TL: y = -10.5, x = -32.3
                   Note: 4px offset for dot centering.
                */}
                {evolutionLevelA === 3 && (
                  <>
                    {/* Top point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Top-Right point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Bottom-Right point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Bottom-Left point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Top-Left point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                  </>
                )}
              </>
            )}

            {/* Evolution Accessories - Path B (Orange) */}
            {evolutionLevelB > 0 && (
              <>
                {/* LV1: 1 accessory at bottom */}
                {evolutionLevelB === 1 && (
                  <>
                    <div style={{
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
                    } as React.CSSProperties} />
                    {/* Circle outline for LV1 */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '38px',
                      height: '38px',
                      border: '1px solid rgba(251, 146, 60, 0.4)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />
                  </>
                )}

                {/* LV2: 3 accessories - Inverted Triangle formation */}
                {evolutionLevelB === 2 && (
                  <>
                    {/* Bottom point */}
                    <div style={{
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
                    }} />
                    {/* Top-left point */}
                    <div style={{
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
                    }} />
                    {/* Top-right point */}
                    <div style={{
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
                    }} />
                  </>
                )}

                {/* LV3: 5 accessories - Inverted Pentagon formation (Point Down) - Regular Pentagon */
                /* R = 34px. Center (0,0) relative to unit center.
                   Angles: 180 (Bottom), 108 (BR), 36 (TR), 324 (TL), 252 (BL)
                   Bottom: y = 34, x = 0
                   BR: y = 10.5, x = 32.3
                   TR: y = -27.5, x = 20.0
                   TL: y = -27.5, x = -20.0
                   BL: y = 10.5, x = -32.3
                   Note: 4px offset for dot centering.
                   Color: rgb(250, 204, 21) is Yellow-400 for Variant 1
                */}
                {evolutionLevelB === 3 && (
                  <>
                    {/* Bottom point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Bottom-Right point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Top-Right point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Top-Left point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Bottom-Left point */}
                    <div className="evolution-accessory" style={{
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
                    } as React.CSSProperties} />
                    {/* Circle outline for LV3 */}
                    <div className="evolution-accessory" style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '40px',
                      height: '40px',
                      border: `1px solid ${evolutionVariantB === 2 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.4)'}`,
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />
                  </>
                )}
              </>
            )}

            {/* Particles */}
            {particles.map(p => (
              <div
                key={p.id}
                className={`evolution-particle ${p.color === 'blue' ? 'evolution-particle-blue' : 'evolution-particle-orange'}`}
                style={{
                  '--tx': `${p.x}px`,
                  '--ty': `${p.y}px`,
                  animation: `${p.delay % 2 === 0 ? 'particleFloat' : 'particleFloatAlt'} 1s ease-out forwards`,
                  animationDelay: `${p.delay}s`,
                  left: '50%',
                  top: '50%',
                  marginLeft: '-2px',
                  marginTop: '-2px'
                } as React.CSSProperties}
              />
            ))}

            {/* Health Bar Mini */}
            <div className="absolute -bottom-1 w-8 h-2 bg-slate-950 rounded-full overflow-hidden border-2 border-slate-700 shadow-lg">
              <div
                className={`h-full transition-all ${unit.hp < unit.maxHp * 0.3 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'}`}
                style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
              />
            </div>

            {/* Carrying Flag Indicator */}
            {unit.hasFlag && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full p-0.5 animate-pulse border-2 border-yellow-300 shadow-lg shadow-yellow-500/50">
                <Flag size={10} fill="currentColor" />
              </div>
            )}

            {/* Carrying Mine Indicator (Ranger) */}
            {showCarriedMineIndicator && (
              <div className="absolute -bottom-2 -left-2 bg-slate-900/90 rounded-full p-0.5 border border-amber-300 shadow-lg shadow-amber-500/30 z-30">
                {unit.carriedMine.type === MineType.NORMAL && <Bomb size={10} className="text-white" />}
                {unit.carriedMine.type === MineType.SMOKE && <Cloud size={10} className="text-slate-200" />}
                {unit.carriedMine.type === MineType.SLOW && <Snowflake size={10} className="text-blue-200" />}
                {unit.carriedMine.type === MineType.CHAIN && <Share2 size={10} className="text-purple-300" />}
                {unit.carriedMine.type === MineType.NUKE && <Radiation size={10} className="text-emerald-300" />}
              </div>
            )}

            {/* Red Slash for Acted Units */}
            {unit.hasActedThisRound && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                <svg viewBox="0 0 100 100" className="w-full h-full opacity-80">
                  <line x1="20" y1="20" x2="80" y2="80" stroke="#ef4444" strokeWidth="15" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        )
      }

      {/* Dead Unit */}
      {
        unit && unit.isDead && (
          <div className="absolute inset-0 z-20 bg-slate-700/80 flex items-center justify-center rounded-full border-2 border-red-500">
            <span className="text-2xl font-black text-red-400">DEAD</span>
          </div>
        )
      }
      {/* Smoke Effect Overlay (Mine Smoke or Hub 3-1 Smoke) */}
      {(isSmoked || isHub31Smoke) && (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-sm">
          <div className={`absolute inset-0 ${(isHub31Smoke ? hubSmokeBuilding!.owner : smokeOwner) === PlayerID.P1 ? 'bg-cyan-900/40' : 'bg-red-900/40'} mix-blend-overlay`} />
          <div className="absolute inset-[-20%] bg-slate-400/40 blur-2xl animate-pulse" />
          <Cloud size={44} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          <Cloud size={32} className="absolute top-0 left-0 text-slate-200/40 animate-[towerFloat_4s_infinite]" />
          <Cloud size={28} className="absolute bottom-0 right-0 text-slate-300/40 animate-[towerFloat_5s_infinite_reverse]" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
        </div>
      )}
    </div >
  );
};

export default React.memo(GridCell, (prevProps, nextProps) => {
  // Return true if props are equal (no re-render), false if different (re-render)
  // Custom comparison to ensure evolutionLevelA changes trigger re-render
  if (prevProps.selectedGeneralLevelA !== nextProps.selectedGeneralLevelA) return false;
  if (prevProps.evolutionLevelA !== nextProps.evolutionLevelA) return false;
  if (prevProps.evolutionLevelB !== nextProps.evolutionLevelB) return false;
  if (prevProps.targetMode !== nextProps.targetMode) return false;
  if (prevProps.selectedUnit !== nextProps.selectedUnit) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isValidMove !== nextProps.isValidMove) return false;
  if (prevProps.isAttackTarget !== nextProps.isAttackTarget) return false;
  if (prevProps.isSkillTarget !== nextProps.isSkillTarget) return false;
  if (prevProps.cell !== nextProps.cell) return false;
  if (prevProps.unit !== nextProps.unit) return false;
  if (prevProps.mine !== nextProps.mine) return false;
  if (prevProps.building !== nextProps.building) return false;
  if (prevProps.buildings !== nextProps.buildings) return false;
  if (prevProps.p1FlagLoc !== nextProps.p1FlagLoc) return false;
  if (prevProps.p2FlagLoc !== nextProps.p2FlagLoc) return false;
  if (prevProps.evolutionVariantA !== nextProps.evolutionVariantA) return false;
  if (prevProps.evolutionVariantB !== nextProps.evolutionVariantB) return false;
  if (prevProps.p1GeneralLevelB !== nextProps.p1GeneralLevelB) return false;
  if (prevProps.p2GeneralLevelB !== nextProps.p2GeneralLevelB) return false;
  if (prevProps.isSmoked !== nextProps.isSmoked) return false;
  if (prevProps.smokeOwner !== nextProps.smokeOwner) return false;
  if (prevProps.forceShowMines !== nextProps.forceShowMines) return false;
  if (prevProps.isUnitStealthed !== nextProps.isUnitStealthed) return false;
  if (prevProps.currentPlayer !== nextProps.currentPlayer) return false;
  return true;
});
