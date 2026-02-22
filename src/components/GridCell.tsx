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
  const OutlineStrong = ({ d }: { d: string }) => (
    <path d={d} className="crystal-outline-strong" strokeLinecap="round" strokeLinejoin="round" />
  );
  const OutlineThin = ({ d }: { d: string }) => (
    <path d={d} className="crystal-outline-thin" strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`energy-crystal-container crystal-${oreSize} overflow-visible`}>
      {oreSize === 'small' && (
        <g transform="translate(3, 3) scale(0.94)">
          <Shard d="M50 5 L80 45 L50 95 L20 45 Z" className="crystal-facet-main" />
          <OutlineThin d="M50 5 L80 45 L50 95 L20 45 Z" />
          <OutlineStrong d="M50 5 L80 45 L50 95 L20 45 Z" />
        </g>
      )}

      {oreSize === 'medium' && (
        <g transform="translate(2, 2) scale(0.96)">
          <Shard d="M30 30 L45 50 L35 80 L15 60 Z" className="crystal-facet-dark" />
          <Shard d="M70 30 L55 50 L65 80 L85 60 Z" className="crystal-facet-dark" />
          <OutlineThin d="M30 30 L45 50 L35 80 L15 60 Z" />
          <OutlineThin d="M70 30 L55 50 L65 80 L85 60 Z" />
          <Outline d="M50 0 L80 40 L50 95 L20 40 Z" />
          <Shard d="M50 0 L80 40 L50 95 L20 40 Z" className="crystal-facet-main" />
          <Shard d="M50 0 L50 95" className="crystal-facet-light" />
          <circle cx="50" cy="50" r="6" className="crystal-core" />
          <OutlineStrong d="M50 0 L80 40 L50 95 L20 40 Z" />
        </g>
      )}

      {oreSize === 'large' && (
        <g>
          <Outline d="M50 5 L85 40 L50 95 L15 40 Z" />
          <Shard d="M30 40 L45 20 L60 40 L45 70 Z" className="crystal-facet-dark" />
          <Shard d="M70 40 L55 20 L40 40 L55 70 Z" className="crystal-facet-dark" />
          <Shard d="M50 5 L85 40 L50 95 L15 40 Z" className="crystal-facet-main" />
          <path d="M50 8 L50 92" className="crystal-center-cut" />
          <path d="M15 40 L85 40 L50 65 Z" className="crystal-hollow-center" />
          <circle cx="50" cy="50" r="8" className="crystal-core" />
          <Shard d="M20 60 L35 75 L25 90 L10 80 Z" className="crystal-facet-light" />
          <Shard d="M80 60 L65 75 L75 90 L90 80 Z" className="crystal-facet-light" />
          <OutlineThin d="M30 40 L45 20 L60 40 L45 70 Z" />
          <OutlineThin d="M70 40 L55 20 L40 40 L55 70 Z" />
          <OutlineStrong d="M50 5 L85 40 L50 95 L15 40 Z" />
        </g>
      )}
    </svg>
  );
};

interface GridCellProps {
  cell: Cell;
  phase: 'placement' | 'thinking' | 'action';
  unit?: Unit;
  mine?: Mine;
  scanMarkSuccess?: boolean | null;
  building?: Building;
  isSelected: boolean;
  isValidMove: boolean;
  isAttackTarget: boolean;
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
  evolutionFxNonce?: number;
  evolutionFxBranch?: 'a' | 'b' | null;
  hoveredPos?: { r: number, c: number } | null;
  onHover?: (r: number, c: number) => void;
}

const GridCell: React.FC<GridCellProps> = ({
  cell,
  phase,
  unit,
  mine,
  scanMarkSuccess = null,
  building,
  isSelected,
  isValidMove,
  isAttackTarget,
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
  selectedUnitLevelB = 0,
  evolutionFxNonce = 0,
  evolutionFxBranch = null,
  hoveredPos = null,
  onHover,
}) => {
  const [particles, setParticles] = React.useState<Array<{ id: string, x: number, y: number, color: string, delay: number }>>([]);
  const [flagBurstParticles, setFlagBurstParticles] = React.useState<Array<{ id: string, x: number, y: number, delay: number, size: number, duration: number }>>([]);
  const [flagBurstTheme, setFlagBurstTheme] = React.useState<'a' | 'b'>('a');
  const [isLocallyDismissed, setIsLocallyDismissed] = React.useState(false);
  const prevParticleFxNonce = React.useRef(evolutionFxNonce);
  const prevBurstFxNonce = React.useRef(evolutionFxNonce);

  // When the actual prop updates (e.g. cleared by game state or re-scanned), reset local state
  React.useEffect(() => {
    setIsLocallyDismissed(false);
  }, [scanMarkSuccess]);

  // Generate particles ONLY when the app emits a real evolution event.
  React.useEffect(() => {
    const hasNewFxSignal = evolutionFxNonce > 0 && evolutionFxNonce !== prevParticleFxNonce.current;
    const shouldPlay = hasNewFxSignal && !!unit && !unit.isDead;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (shouldPlay) {
      const newParticles = [];
      const particleCount = 12;
      const color = evolutionFxBranch === 'b' ? 'orange' : 'blue';

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
      timer = setTimeout(() => setParticles([]), 1200);
    }

    if (evolutionFxNonce > 0) prevParticleFxNonce.current = evolutionFxNonce;

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [evolutionFxBranch, evolutionFxNonce, unit?.id, unit?.isDead, evolutionLevelA, evolutionLevelB]);

  // Action highlighting:
  // - isInActionScope: within skill range (faint frame)
  // - isInActionRange: executable target (strong highlight)
  let isInActionScope = false;
  let isInActionRange = false;
  let actionRangeColor = '';

  if (phase !== 'thinking' && selectedUnit && targetMode) {
    const manhattanDist = Math.abs(selectedUnit.r - cell.r) + Math.abs(selectedUnit.c - cell.c);
    const chebyshevDist = Math.max(Math.abs(selectedUnit.r - cell.r), Math.abs(selectedUnit.c - cell.c));

    if (targetMode === 'move' && manhattanDist === 1 && !cell.isObstacle && !unit) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-emerald';
    } else if (targetMode === 'scan' && manhattanDist <= 3) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-blue';
    } else if (targetMode === 'sensor_scan' && chebyshevDist <= 2) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-cyan';
    } else if ((targetMode === 'place_tower' || targetMode === 'place_hub' || targetMode === 'place_factory') && manhattanDist === 0) {
      isInActionRange = true;
      actionRangeColor = targetMode === 'place_tower' ? 'cell-range-orange' : targetMode === 'place_factory' ? 'cell-range-cyan' : 'cell-range-indigo';
    } else if (targetMode === 'throw_mine' && manhattanDist <= 2 && !cell.isObstacle && !building && !mine && !unit) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-purple';
    } else if (targetMode === 'teleport' && !cell.isObstacle && !unit && !building) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-amber';
    } else if (targetMode === 'pickup_mine_select') {
      const pickupRange = selectedUnitLevelB >= 1 ? 2 : 0;
      if (manhattanDist <= pickupRange) {
        isInActionScope = true;
        actionRangeColor = 'cell-range-yellow';
      }
      if (manhattanDist <= pickupRange && mine && (mine.revealedTo.includes(currentPlayer) || mine.owner === currentPlayer)) {
        isInActionRange = true;
      }
    } else if (targetMode === 'disarm') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      const chebyshevDist = Math.max(dr, dc);

      if (selectedUnit.type === UnitType.DEFUSER) {
        const range = (selectedUnitLevelB >= 1) ? 3 : 2;
        if (dr + dc <= range) {
          isInActionScope = true;
          actionRangeColor = 'cell-range-amber';
          if (mine || (building && building.owner !== currentPlayer)) {
            isInActionRange = true;
          }
        }
      } else {
        if (chebyshevDist === 0) {
          isInActionScope = true;
          actionRangeColor = 'cell-range-pink';
          if (building && building.owner !== currentPlayer) {
            isInActionRange = true;
          }
        }
      }
    } else if (targetMode === 'attack' && selectedUnit) {
      let attackRange = 1;
      if (selectedUnit.type === UnitType.GENERAL) {
        attackRange = selectedGeneralLevelA >= 2 ? 2 : 1;
      }
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      const isCardinalDirection = dr === 0 || dc === 0;

      if (manhattanDist <= attackRange && isCardinalDirection) {
        isInActionScope = true;
        actionRangeColor = 'cell-range-red';
        // Strong highlight if there's an enemy unit to attack
        if (unit && unit.owner !== currentPlayer && !unit.isDead) {
          isInActionRange = true;
        }
      }
    } else if (targetMode === 'place_mine') {
      const factories = buildings.filter(b => b.owner === selectedUnit.owner && b.type === 'factory');
      const manhattanDistLocal = Math.abs(selectedUnit.r - cell.r) + Math.abs(selectedUnit.c - cell.c);
      let allowed = manhattanDistLocal <= 1;

      const isInFactoryRange = factories.some(f =>
        f.level >= 2
          ? (Math.abs(f.r - cell.r) + Math.abs(f.c - cell.c) <= 2)
          : (Math.max(Math.abs(f.r - cell.r), Math.abs(f.c - cell.c)) <= 1)
      );

      if (isInFactoryRange) allowed = true;

      // Obstacles, buildings, units, and other mines block placement
      if (allowed && !cell.isObstacle && !building && !mine && !unit) {
        isInActionRange = true;
        actionRangeColor = 'cell-range-purple';
      }
    } else if (targetMode === 'move_mine_start') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      if (dr + dc <= 2 && mine) {
        isInActionRange = true;
        actionRangeColor = 'cell-range-rose';
      }
    } else if (targetMode === 'move_mine_end') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      if (dr + dc <= 2 && !cell.isObstacle && !building && !mine && !unit) {
        isInActionRange = true;
        actionRangeColor = 'cell-range-rose';
      }
    } else if (targetMode === 'convert_mine') {
      const dr = Math.abs(selectedUnit.r - cell.r);
      const dc = Math.abs(selectedUnit.c - cell.c);
      if (dr + dc <= 2 && mine && mine.owner !== currentPlayer) {
        isInActionRange = true;
        actionRangeColor = 'cell-range-indigo';
      }
    }
  } else if (phase === 'placement' && targetMode === 'place_setup_mine') {
    const isP1Zone = cell.c < 12;
    const isMyZone = currentPlayer === PlayerID.P1 ? isP1Zone : !isP1Zone;
    if (isMyZone && !cell.isObstacle && !unit) {
      isInActionRange = true;
      actionRangeColor = 'cell-range-purple';
    }
  }

  // Base Flags
  const isP1Base = cell.r === P1_FLAG_POS.r && cell.c === P1_FLAG_POS.c;
  const isP2Base = cell.r === P2_FLAG_POS.r && cell.c === P2_FLAG_POS.c;

  // Current Flags
  const isP1FlagHere = p1FlagLoc.r === cell.r && p1FlagLoc.c === cell.c;
  const isP2FlagHere = p2FlagLoc.r === cell.r && p2FlagLoc.c === cell.c;

  // One-shot "small fireworks" when any unit upgrades (A=blue, B=orange).
  React.useEffect(() => {
    const hasNewFxSignal = evolutionFxNonce > 0 && evolutionFxNonce !== prevBurstFxNonce.current;
    const shouldBurst = hasNewFxSignal && !!unit && !unit.isDead;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (shouldBurst) {
      setFlagBurstTheme(evolutionFxBranch === 'b' ? 'b' : 'a');
      const count = 30;
      const burst = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 28 + Math.random() * 40;
        const jitter = (Math.random() - 0.5) * 8;
        burst.push({
          id: `flag-burst-${Date.now()}-${i}`,
          x: Math.cos(angle) * distance + jitter,
          y: Math.sin(angle) * distance + jitter,
          delay: Math.random() * 0.05,
          size: 5 + Math.random() * 5,
          duration: 0.66 + Math.random() * 0.25
        });
      }
      setFlagBurstParticles(burst);
      timer = setTimeout(() => setFlagBurstParticles([]), 980);
    }

    if (evolutionFxNonce > 0) prevBurstFxNonce.current = evolutionFxNonce;

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [evolutionFxBranch, evolutionFxNonce, unit?.id, unit?.isDead, evolutionLevelA, evolutionLevelB]);

  // Determine if THIS cell is a center of a focused building or domain
  // We need this to lift the center cell's Z-Index so its child range indicator overlays neighbors
  const isThisCellFocusedCenter = (() => {
    if (!hoveredPos) return false;

    const mouseR = hoveredPos.r;
    const mouseC = hoveredPos.c;

    // 1. Check if this cell has a building and that building's range is hovered
    if (building) {
      const dr = Math.abs(mouseR - cell.r);
      const dc = Math.abs(mouseC - cell.c);
      if (building.type === 'tower' && dr <= 1 && dc <= 1) return true;
      if (building.type === 'hub' && dr + dc <= 2) return true;
      if (building.type === 'factory') {
        const isLvl3 = building.level >= 2;
        if (isLvl3 && dr + dc <= 2) return true;
        if (!isLvl3 && dr <= 1 && dc <= 1) return true;
      }
    }

    // 2. Check if this cell has a flag and that flag's domain is hovered
    if (isP1FlagHere) {
      const dr = Math.abs(mouseR - cell.r);
      const dc = Math.abs(mouseC - cell.c);
      if (p1GeneralLevelB >= 2 && dr <= 2 && dc <= 2) return true; // 5x5 shield
      if (p1GeneralLevelB >= 3 && p1GeneralVariantB === 2 && dr <= 1 && dc <= 1) return true; // 3x3 kirin
    }
    if (isP2FlagHere) {
      const dr = Math.abs(mouseR - cell.r);
      const dc = Math.abs(mouseC - cell.c);
      if (p2GeneralLevelB >= 2 && dr <= 2 && dc <= 2) return true;
      if (p2GeneralLevelB >= 3 && p2GeneralVariantB === 2 && dr <= 1 && dc <= 1) return true;
    }

    return false;
  })();

  // Decide background color - P1 Zone (left) is blue, P2 Zone (right) is red
  let bgColor = 'bg-slate-900 border border-slate-800/20';

  if (cell.c < 12) {
    // P1 Zone - RTX Blue
    bgColor = 'rtx-cell-p1';
  } else {
    // P2 Zone - RTX Red
    bgColor = 'rtx-cell-p2';
  }

  let foregroundHighlightClass = '';
  let cellHighlightClass = '';
  if (cell.isObstacle) bgColor = 'bg-slate-800/90 border-2 border-slate-400/50 shadow-[0_0_15px_rgba(255,255,255,0.2),inset_0_0_10px_rgba(255,255,255,0.1)] pattern-diagonal-lines brightness-75';
  if (isInActionRange && targetMode === 'scan') cellHighlightClass = `cell-highlight-action-range ${actionRangeColor}`;
  else if (isSelected && targetMode !== 'scan') cellHighlightClass = 'cell-highlight-selected';
  else if (isValidMove) cellHighlightClass = 'cell-highlight-valid-move';
  else if (isAttackTarget) cellHighlightClass = 'cell-highlight-attack';
  else if (isInActionRange) cellHighlightClass = `cell-highlight-action-range ${actionRangeColor}`;
  else if (isInActionScope) cellHighlightClass = `cell-highlight-action-scope ${actionRangeColor}`;

  if (cellHighlightClass) {
    // Render highlight above occupying units so border cues stay visible.
    if (unit && !unit.isDead) foregroundHighlightClass = cellHighlightClass;
    else bgColor += ` ${cellHighlightClass}`;
  }

  // Checker for Damage Zone (General Path B 3-2)
  // Building range calculations are now handled by high-level indicators.
  const hubSmokeBuilding = buildings.find(b =>
    b.type === 'hub' &&
    b.level === 3 &&
    b.variant === 1 &&
    (Math.abs(cell.r - b.r) + Math.abs(cell.c - b.c) <= 2)
  );
  const isHub31Smoke = !!hubSmokeBuilding;
  const hasVisibleScanMiss = scanMarkSuccess === false && !isLocallyDismissed;
  // Functional colors based on building type, matching buttons
  const towerColor = '#fb923c'; // Amber/Orange for Detection Tower
  const hubColor = '#c084fc';   // Purple for Hub
  const factoryColor = '#22d3ee'; // Cyan for Autonomous Factory/Workshop
  const shieldColor = '#4ade80';  // Bright Emerald/Mint for Spirit Domain (high contrast vs board blue)
  const kirinColor = '#ffd700';   // Gold for Kirin Domain


  const friendlyTowerInRange = buildings.some(b =>
    b.type === 'tower' &&
    b.owner === currentPlayer &&
    Math.abs(cell.r - b.r) <= 1 &&
    Math.abs(cell.c - b.c) <= 1
  );

  // Building range borders are now handled by high-level indicators in each building's root cell,
  // so we no longer apply per-cell borders here for better visual clarity.

  const isAreaFocused = (targetR: number, targetC: number, rangeType: '3x3' | '5x5' | 'manhattan2'): boolean => {
    if (!hoveredPos) return false;

    // Check if the current mouse position (hoveredPos) is within the domain of the target
    const dr = Math.abs(hoveredPos.r - targetR);
    const dc = Math.abs(hoveredPos.c - targetC);

    if (rangeType === '3x3') {
      return dr <= 1.1 && dc <= 1.1; // Added 0.1 buffer for border stability
    } else if (rangeType === '5x5') {
      return dr <= 2.1 && dc <= 2.1;
    } else if (rangeType === 'manhattan2') {
      return dr + dc <= 2.1; // Added 0.1 buffer for diamond corner stability
    }
    return false;
  };

  // Mine Visibility Logic - strict check including smoke
  // When in Sandbox "Normal" mode, we filter strictly based on who the user currently "is" (currentPlayer)
  const isMineVisible = forceShowMines || (!!mine &&
    ((mine.owner === currentPlayer || mine.revealedTo.includes(currentPlayer) || friendlyTowerInRange)) &&
    !((isSmoked && smokeOwner !== currentPlayer) || (isHub31Smoke && hubSmokeBuilding?.owner !== currentPlayer))
  );
  const enemyPlayer = currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
  const mineIsKnownByEnemy = !!mine && (forceShowMines || mine.revealedTo.includes(enemyPlayer));
  // Eye icon: show only on my mines that are known by the enemy (to warn they are revealed)
  const shouldShowEye =
    mine && isMineVisible && !unit &&
    mine.owner === currentPlayer &&
    mineIsKnownByEnemy;
  const showCarriedMineIndicator = unit && unit.type === UnitType.RANGER && unit.carriedMine &&
    (unit.owner === currentPlayer || unit.carriedMineRevealed || friendlyTowerInRange);
  const showOreUnderUnitIndicator = !!unit && !!cell.hasEnergyOre;

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

  const renderGeneralBFlagMorph = (owner: PlayerID, levelB: number, variantB: 1 | 2 | null) => {
    const isBlueOwner = owner === PlayerID.P1;
    const palette = isBlueOwner
      ? {
        base: '#2563eb',
        deep: '#1e3a8a',
        highlight: '#38bdf8',
        variant: '#93c5fd',
        glow: 'rgba(37,99,235,0.45)',
        baseStroke: 'rgba(147,197,253,0.7)',
        clothStrokeLv1: 'rgba(191,219,254,0.9)',
        clothStrokeLv2: 'rgba(191,219,254,0.95)',
        clothStrokeLv3: 'rgba(191,219,254,1)',
        clothStrokeTop: 'rgba(219,234,254,1)',
        ornamentStroke: 'rgba(191,219,254,0.85)',
        ornamentStrokeTop: 'rgba(191,219,254,0.9)',
        ornamentCore: 'rgba(191,219,254,0.95)',
        ornamentCoreTop: 'rgba(219,234,254,0.98)',
      }
      : {
        base: '#dc2626',
        deep: '#7f1d1d',
        highlight: '#f87171',
        variant: '#fca5a5',
        glow: 'rgba(220,38,38,0.45)',
        baseStroke: 'rgba(248,113,113,0.7)',
        clothStrokeLv1: 'rgba(254,202,202,0.9)',
        clothStrokeLv2: 'rgba(254,202,202,0.95)',
        clothStrokeLv3: 'rgba(254,202,202,1)',
        clothStrokeTop: 'rgba(254,226,226,1)',
        ornamentStroke: 'rgba(254,202,202,0.85)',
        ornamentStrokeTop: 'rgba(254,202,202,0.9)',
        ornamentCore: 'rgba(254,202,202,0.95)',
        ornamentCoreTop: 'rgba(254,226,226,0.98)',
      };
    const accentColor = levelB >= 3 && variantB === 2 ? palette.variant : palette.base;
    const darkFill = palette.deep;
    const highlightFill = palette.highlight;

    return (
      <div className="absolute z-10 pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 48 48" className="relative z-10 w-[40px] h-[40px]" style={{ filter: `drop-shadow(0 0 10px ${palette.glow})` }}>
          {/* Pole + base (shared) */}
          <rect x="21.7" y="8" width="3.1" height="26.5" rx="1.4" fill="rgba(255,255,255,0.92)" />
          <rect x="14.5" y="35" width="19" height="5" rx="1.8" fill="rgba(15,23,42,0.92)" stroke={palette.baseStroke} strokeWidth="1" />

          {/* Lv0: plain starter pennant */}
          {levelB === 0 && (
            <>
              <path d="M24.8 11.8 L35.8 14.4 L24.8 17.8 Z" className="flag-cloth flag-cloth-lv1" fill={accentColor} stroke={palette.clothStrokeLv1} strokeWidth="1.05" />
            </>
          )}

          {/* Lv1: shifted from old Lv2 */}
          {levelB === 1 && (
            <>
              <path d="M24.8 10.8 L41 14.8 L35.8 17.2 L41 19.6 L24.8 23.7 Z" className="flag-cloth flag-cloth-lv2" fill={accentColor} stroke={palette.clothStrokeLv2} strokeWidth="1.25" />
              <path d="M28.3 13.6 L36.2 15.6 L28.3 17.7 Z" fill={darkFill} opacity="0.6" />
              <path d="M28.3 17.9 L36.2 19.9 L28.3 22 Z" fill={highlightFill} opacity="0.5" />
              <path d="M24 9.7 L21.8 11.8 L24 13.9 L26.2 11.8 Z" fill={highlightFill} opacity="0.9" />
            </>
          )}

          {/* Lv2: shifted from old Lv3 */}
          {levelB === 2 && (
            <>
              <path d="M24.8 9.2 L44 14.2 L38.4 17.4 L44 20.6 L24.8 25.6 L29 17.4 Z" className="flag-cloth flag-cloth-lv3" fill={accentColor} stroke={palette.clothStrokeLv3} strokeWidth="1.45" />
              <path d="M30.2 13.4 L40 16.1 L30.2 18.8 Z" fill={darkFill} opacity="0.72" />
              <path d="M30.2 19 L40 21.7 L30.2 24.4 Z" fill={highlightFill} opacity="0.62" />
              <path d="M26.4 10.9 L22.8 12.9 L26.4 14.9 Z" fill={highlightFill} opacity="0.78" />
              <path d="M26.4 19.9 L22.8 21.9 L26.4 23.9 Z" fill={highlightFill} opacity="0.78" />
              <path d="M24 7.1 L26.9 10.2 L24 13.2 L21.1 10.2 Z" fill={highlightFill} />
              <path d="M19.6 5.2 L24 2.2 L28.4 5.2 L27 9.8 L24 11.8 L21 9.8 Z" fill={highlightFill} opacity="0.9" stroke={palette.ornamentStroke} strokeWidth="0.9" />
              <circle cx="24" cy="17.4" r="1.2" fill={palette.ornamentCore} />
            </>
          )}

          {/* Lv3: imperial commander standard (new highest) */}
          {levelB >= 3 && (
            <>
              <path d="M24.8 8.6 L45.2 13.8 L39.1 17.4 L45.2 21 L24.8 26.2 L30.1 17.4 Z" className="flag-cloth flag-cloth-lv3" fill={accentColor} stroke={palette.clothStrokeTop} strokeWidth="1.6" />
              <path d="M31.2 13.1 L41.7 16 L31.2 18.9 Z" fill={darkFill} opacity="0.78" />
              <path d="M31.2 19.1 L41.7 22 L31.2 24.9 Z" fill={highlightFill} opacity="0.7" />
              <path d="M27.2 10.5 L22 13.2 L27.2 15.9 Z" fill={highlightFill} opacity="0.86" />
              <path d="M27.2 18.9 L22 21.6 L27.2 24.3 Z" fill={highlightFill} opacity="0.86" />
              <path d="M21.4 6.2 L24 3.6 L26.6 6.2 L26 9.7 L24 11.3 L22 9.7 Z" fill={highlightFill} opacity="0.92" stroke={palette.ornamentStrokeTop} strokeWidth="0.85" />
              <path d="M24 1.8 L27 3.7 L25.9 6.8 L22.1 6.8 L21 3.7 Z" fill={highlightFill} opacity="0.95" />
              <circle cx="24" cy="17.4" r="1.5" fill={palette.ornamentCoreTop} />
              <rect x="18.8" y="34.2" width="7.4" height="1.2" rx="0.6" fill={accentColor} opacity="0.92" />
            </>
          )}
        </svg>
      </div>
    );
  };

  const burstPalette = flagBurstTheme === 'b'
    ? {
      core: 'rgba(254,243,199,0.95)',
      mid: 'rgba(251,146,60,0.55)',
      fade: 'rgba(249,115,22,0)',
      ringA: 'rgba(254,215,170,0.9)',
      ringB: 'rgba(253,186,116,0.85)',
      glowA: 'rgba(249,115,22,0.95)',
      glowB: 'rgba(251,146,60,0.9)',
      particle: 'rgba(255,237,213,0.96)'
    }
    : {
      core: 'rgba(219,234,254,0.95)',
      mid: 'rgba(147,197,253,0.5)',
      fade: 'rgba(59,130,246,0)',
      ringA: 'rgba(191,219,254,0.9)',
      ringB: 'rgba(125,211,252,0.85)',
      glowA: 'rgba(59,130,246,0.9)',
      glowB: 'rgba(125,211,252,0.8)',
      particle: 'rgba(191,219,254,0.95)'
    };

  // Building Rendering
  const renderBuilding = () => {
    if (!building) return null;
    const colorClass = building.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400';
    const isLvl2 = building.level >= 2;
    const isLvl3 = building.level >= 3;


    if (building.type === 'tower') {
      const towerOwnerColor = building.owner === PlayerID.P1 ? '#22d3ee' : '#f87171';
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[145] overflow-visible">
          {/* Effect Range Indicator */}
          <div
            className={`building-range-indicator tower-range-indicator ${isAreaFocused(cell.r, cell.c, '3x3') ? 'range-focused' : ''}`}
            style={{
              borderColor: `${towerColor}cc`,
              color: towerColor,
              backgroundColor: isAreaFocused(cell.r, cell.c, '3x3') ? `${towerColor}22` : `${towerColor}14`
            }}
          />

          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-[0_0_10px_rgba(15,23,42,0.75)]">
              <defs>
                <linearGradient id={`towerBody-${building.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={towerOwnerColor} stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.97" />
                </linearGradient>
              </defs>

              {/* White-framed chassis */}
              <rect x="10" y="21" width="20" height="12" rx="3" fill={`url(#towerBody-${building.id})`} stroke="#ffffff" strokeWidth="1.2" />
              <rect x="18.2" y="9.5" width="3.6" height="12" rx="1.2" fill="#334155" stroke="#ffffff" strokeWidth="0.9" />
              <circle cx="20" cy="8" r="2.2" fill={towerOwnerColor} stroke="#ffffff" strokeWidth="0.9" />

              {/* Lv2: side fins + orbit ring */}
              {isLvl2 && (
                <>
                  <path d="M10 26 L6.5 24.5 L6.5 29.5 L10 28 Z" fill={towerOwnerColor} opacity="0.82" stroke="#ffffff" strokeWidth="0.8" />
                  <path d="M30 26 L33.5 24.5 L33.5 29.5 L30 28 Z" fill={towerOwnerColor} opacity="0.82" stroke="#ffffff" strokeWidth="0.8" />
                  <ellipse cx="20" cy="15.5" rx="10.8" ry="4.6" fill="none" stroke="#ffffff" strokeWidth="0.9" strokeDasharray="2.2 2.2" className="animate-[towerRotate_4s_linear_infinite]" />
                </>
              )}

              {/* Lv3: dual antenna + stronger scan ring */}
              {isLvl3 && (
                <>
                  <path d="M16.5 6.8 L14.4 4.7" stroke="#ffffff" strokeWidth="0.95" strokeLinecap="round" />
                  <path d="M23.5 6.8 L25.6 4.7" stroke="#ffffff" strokeWidth="0.95" strokeLinecap="round" />
                  <circle cx="20" cy="8" r="6.8" fill="none" stroke="#ffffff" strokeWidth="0.95" opacity="0.75" className="animate-pulse" />
                  <circle cx="20" cy="8" r="11.8" fill="none" stroke={towerOwnerColor} className="tower-antenna-signal" style={{ animationDelay: '0s' }} />
                </>
              )}
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
      const hubOwnerColor = building.owner === PlayerID.P1 ? '#22d3ee' : '#f87171';
      const hubLvl2 = building.level >= 2;
      const hubLvl3 = building.level >= 3;
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[145] overflow-visible">
          {/* Hub Boundary: Stepped Manhattan Distance 2 Diamond */}
          <svg
            className="absolute pointer-events-none overflow-visible"
            viewBox="0 0 100 100"
            style={{
              left: '-200%',
              right: '-200%',
              top: '-200%',
              bottom: '-200%',
              color: hubColor,
              filter: 'drop-shadow(0 0 1px currentColor)',
              opacity: isAreaFocused(cell.r, cell.c, 'manhattan2') ? 0.68 : 0.30,
              transform: `scale(${isAreaFocused(cell.r, cell.c, 'manhattan2') ? '1.005' : '1'})`,
              transition: 'all 0.15s ease-out'
            }}

          >
            <path
              d="M 40 4 A 4 4 0 0 1 44 0 L 56 0 A 4 4 0 0 1 60 4 L 60 16 A 4 4 0 0 0 64 20 L 76 20 A 4 4 0 0 1 80 24 L 80 36 A 4 4 0 0 0 84 40 L 96 40 A 4 4 0 0 1 100 44 L 100 56 A 4 4 0 0 1 96 60 L 84 60 A 4 4 0 0 0 80 64 L 80 76 A 4 4 0 0 1 76 80 L 64 80 A 4 4 0 0 0 60 84 L 60 96 A 4 4 0 0 1 56 100 L 44 100 A 4 4 0 0 1 40 96 L 40 84 A 4 4 0 0 0 36 80 L 24 80 A 4 4 0 0 1 20 76 L 20 64 A 4 4 0 0 0 16 60 L 4 60 A 4 4 0 0 1 0 56 L 0 44 A 4 4 0 0 1 4 40 L 16 40 A 4 4 0 0 0 20 36 L 20 24 A 4 4 0 0 1 24 20 L 36 20 A 4 4 0 0 0 40 16 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth={isAreaFocused(cell.r, cell.c, 'manhattan2') ? "1.9" : "1.5"}
              strokeDasharray={isAreaFocused(cell.r, cell.c, 'manhattan2') ? "none" : "4 2"}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: isAreaFocused(cell.r, cell.c, 'manhattan2') ? 0.95 : 0.85 }}
            />
          </svg>

          <div className="relative w-8 h-8 flex items-center justify-center animate-[towerFloat_3s_ease-in-out_infinite]">
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-[0_0_10px_rgba(15,23,42,0.75)]">
              <defs>
                <linearGradient id={`hubBody-${building.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={hubOwnerColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Body with crisp white border */}
              <rect x="8" y="8" width="24" height="24" rx="5" fill={`url(#hubBody-${building.id})`} stroke="#ffffff" strokeWidth="1.4" />
              <rect x="12" y="12" width="16" height="16" rx="3" fill="none" stroke={hubOwnerColor} strokeWidth="1.1" opacity="0.9" />

              {/* LV2: secondary inner frame + side nodes */}
              {hubLvl2 && (
                <>
                  <rect x="14.5" y="14.5" width="11" height="11" rx="2" fill="none" stroke="#ffffff" strokeWidth="0.95" opacity="0.9" />
                  <circle cx="10.8" cy="20" r="1.2" fill="#ffffff" opacity="0.9" />
                  <circle cx="29.2" cy="20" r="1.2" fill="#ffffff" opacity="0.9" />
                </>
              )}

              {/* LV3: crown antenna + orbit ring */}
              {hubLvl3 && (
                <>
                  <path d="M20 5 L20 8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="20" cy="4.2" r="1.2" fill="#ffffff" />
                  <circle cx="20" cy="20" r="10.2" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="2.4 2.4" className="animate-spin" style={{ transformOrigin: '20px 20px', animationDuration: '5s', opacity: 0.8 }} />
                </>
              )}

              <Cpu size={14} className={`${colorClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} />
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
      const isLvl2 = building.level >= 2;
      const isLvl3 = building.level >= 3;


      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[145] overflow-visible">
          {/* Effect Range Indicator */}
          {isLvl3 ? (
            <svg
              className="absolute pointer-events-none overflow-visible"
              viewBox="0 0 100 100"
              style={{
                left: '-200%',
                right: '-200%',
                top: '-200%',
                bottom: '-200%',
                color: factoryColor,
                filter: 'drop-shadow(0 0 1px currentColor)',
                opacity: isAreaFocused(cell.r, cell.c, 'manhattan2') ? 0.68 : 0.30,
                transform: `scale(${isAreaFocused(cell.r, cell.c, 'manhattan2') ? '1.005' : '1'})`,
                transition: 'all 0.1s ease-out' // Snappier
              }}
            >
              <path
                d="M 40 4 A 4 4 0 0 1 44 0 L 56 0 A 4 4 0 0 1 60 4 L 60 16 A 4 4 0 0 0 64 20 L 76 20 A 4 4 0 0 1 80 24 L 80 36 A 4 4 0 0 0 84 40 L 96 40 A 4 4 0 0 1 100 44 L 100 56 A 4 4 0 0 1 96 60 L 84 60 A 4 4 0 0 0 80 64 L 80 76 A 4 4 0 0 1 76 80 L 64 80 A 4 4 0 0 0 60 84 L 60 96 A 4 4 0 0 1 56 100 L 44 100 A 4 4 0 0 1 40 96 L 40 84 A 4 4 0 0 0 36 80 L 24 80 A 4 4 0 0 1 20 76 L 20 64 A 4 4 0 0 0 16 60 L 4 60 A 4 4 0 0 1 0 56 L 0 44 A 4 4 0 0 1 4 40 L 16 40 A 4 4 0 0 0 20 36 L 20 24 A 4 4 0 0 1 24 20 L 36 20 A 4 4 0 0 0 40 16 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth={isAreaFocused(cell.r, cell.c, 'manhattan2') ? "1.9" : "1.5"}
                strokeDasharray={isAreaFocused(cell.r, cell.c, 'manhattan2') ? "none" : "4 2"}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: isAreaFocused(cell.r, cell.c, 'manhattan2') ? 0.95 : 0.85 }}
              />
            </svg>
          ) : (
            <div
              className={`building-range-indicator tower-range-indicator ${isAreaFocused(cell.r, cell.c, '3x3') ? 'range-focused' : ''}`}
              style={{
                borderColor: `${factoryColor}cc`,
                color: factoryColor,
                backgroundColor: isAreaFocused(cell.r, cell.c, '3x3') ? `${factoryColor}22` : `${factoryColor}14`
              }}
            />
          )}

          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-[0_0_10px_rgba(15,23,42,0.7)]">
              <defs>
                <linearGradient id={`factoryBody-${building.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ownerColor} stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.98" />
                </linearGradient>
              </defs>

              {/* Level 3 outer ring (rendered behind the factory body) */}
              {isLvl3 && (
                <circle
                  cx="20"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.9"
                  strokeDasharray="3.2 2.4"
                  opacity="0.96"
                  className="animate-spin"
                  style={{
                    transformOrigin: '20px 22px',
                    animationDuration: '4s',
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.95))'
                  }}
                />
              )}

              {/* Main body */}
              <path
                d="M6 34 L34 34 L34 24 L30 20 L30 14 L24 14 L24 19 L16 14 L16 10 L10 10 L10 14 L6 24 Z"
                fill={`url(#factoryBody-${building.id})`}
                stroke="#ffffff"
                strokeWidth="1.15"
              />

              {/* Level 2 side modules */}
              {isLvl2 && (
                <>
                  <rect x="5" y="19" width="4" height="9" rx="1.2" fill={ownerColor} opacity="0.75" stroke="#ffffff" strokeWidth="0.9" />
                  <rect x="31" y="19" width="4" height="9" rx="1.2" fill={ownerColor} opacity="0.75" stroke="#ffffff" strokeWidth="0.9" />
                </>
              )}

              {/* Chimneys / stacks */}
              <rect x="11.5" y="4.5" width="4.2" height="9.5" rx="1" fill="#475569" stroke="#ffffff" strokeWidth="0.8" />
              {isLvl2 && <rect x="23.8" y="4.5" width="4.2" height="9.5" rx="1" fill="#475569" stroke="#ffffff" strokeWidth="0.8" />}

              {/* Level 3 crown and energy ring */}
              {isLvl3 && (
                <>
                  <rect x="13" y="1.8" width="14" height="2.8" rx="1.2" fill="#ffffff" opacity="0.9" />
                </>
              )}

              {isLvl3 && (
                <>
                  <circle cx="16" cy="25" r="1.6" fill="#ffffff" opacity="0.85" />
                  <circle cx="24" cy="25" r="1.6" fill="#ffffff" opacity="0.85" />
                </>
              )}

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
      onMouseEnter={() => onHover?.(cell.r, cell.c)}
      className={`
        relative w-full aspect-square flex items-center justify-center text-xs font-bold transition-all duration-300 rtx-cell-base
        ${bgColor}
        ${!cell.isObstacle ? 'hover:bg-opacity-90 hover:scale-[1.02]' : ''}
        ${(() => {
          // Priority Hierarchy (Highest to Lowest):
          // 0. Active sensor miss marker:
          // lift the whole cell above nearby building cells so marker stays visible/clickable.
          if (hasVisibleScanMiss) return 'z-[180]';
          // 1. Building / Domain source cells:
          // keep their extended range borders above any occupying units.
          if (building || isP1FlagHere || isP2FlagHere || isThisCellFocusedCenter) return 'z-[160]';
          // 2. Units with Evolution (accessories remain above regular units)
          if (unit && (evolutionLevelA >= 1 || evolutionLevelB >= 1)) return 'z-[150]';
          // 3. Regular Units
          if (unit) return 'z-[140]';
          // 4. Move/Action Highlights
          if (isValidMove || isAttackTarget || isInActionRange || isInActionScope) return 'z-[130]';
          // 5. Mines (below action highlights and pulses)
          if (mine) return 'z-[50]';
          // 6. Default
          return 'z-[1]';
        })()}
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
              size={unit ? 20 : (cell.oreSize === 'large' ? 40 : cell.oreSize === 'medium' ? 32 : 26)}
              oreSize={cell.oreSize || 'small'}
            />
          </div>
        )
      }

      {/* Mine (Underneath unit) */}
      {
        mine && isMineVisible && (
          <div className={`absolute opacity-95 drop-shadow-2xl animate-pulse ${unit ? 'bottom-0.5 left-0.5 z-[90]' : 'inset-0 flex items-center justify-center z-30'} ${mine?.owner === PlayerID.P1 ? 'text-cyan-400' : 'text-red-400'}`}>
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
                mine.type === MineType.SLOW ? 'SLOW' :
                  mine.type === MineType.SMOKE ? 'SMOKE' :
                    mine.type === MineType.CHAIN ? 'CHAIN' :
                      mine.type === MineType.NUKE ? 'NUKE' : ''}
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
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[190] group/miss">
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
                X
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
          renderGeneralBFlagMorph(PlayerID.P1, p1GeneralLevelB, p1GeneralVariantB)
        )}



        {/* P1 Shield Zone Perimeter (5x5) */}
        {isP1FlagHere && p1GeneralLevelB >= 2 && (
          <div
            className={`building-range-indicator factory-range-indicator shield-domain ${isAreaFocused(p1FlagLoc.r, p1FlagLoc.c, '5x5') ? 'range-focused' : ''}`}
            style={{
              borderColor: `${shieldColor}cc`,
              color: shieldColor,
              backgroundColor: isAreaFocused(p1FlagLoc.r, p1FlagLoc.c, '5x5') ? `${shieldColor}20` : `${shieldColor}12`
            }}
          />
        )}
        {/* P1 Kirin Domain Perimeter (3x3) */}
        {isP1FlagHere && p1GeneralLevelB >= 3 && p1GeneralVariantB === 2 && (
          <div
            className={`building-range-indicator tower-range-indicator kirin-domain ${isAreaFocused(p1FlagLoc.r, p1FlagLoc.c, '3x3') ? 'range-focused' : ''}`}
            style={{
              borderColor: `${kirinColor}cc`,
              color: kirinColor,
              backgroundColor: isAreaFocused(p1FlagLoc.r, p1FlagLoc.c, '3x3') ? `${kirinColor}20` : `${kirinColor}12`
            }}
          />
        )}
      </div>


      {/* P2 Flag and Spirit Domain Pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
        {/* Flag Icon - Only visible if no unit is on cell */}
        {isP2FlagHere && !unit && (
          renderGeneralBFlagMorph(PlayerID.P2, p2GeneralLevelB, p2GeneralVariantB)
        )}



        {/* P2 Shield Zone Perimeter (5x5) */}
        {isP2FlagHere && p2GeneralLevelB >= 2 && (
          <div
            className={`building-range-indicator factory-range-indicator shield-domain ${isAreaFocused(p2FlagLoc.r, p2FlagLoc.c, '5x5') ? 'range-focused' : ''}`}
            style={{
              borderColor: `${shieldColor}cc`,
              color: shieldColor,
              backgroundColor: isAreaFocused(p2FlagLoc.r, p2FlagLoc.c, '5x5') ? `${shieldColor}20` : `${shieldColor}12`
            }}
          />
        )}
        {/* P2 Kirin Domain Perimeter (3x3) */}
        {isP2FlagHere && p2GeneralLevelB >= 3 && p2GeneralVariantB === 2 && (
          <div
            className={`building-range-indicator tower-range-indicator kirin-domain ${isAreaFocused(p2FlagLoc.r, p2FlagLoc.c, '3x3') ? 'range-focused' : ''}`}
            style={{
              borderColor: `${kirinColor}cc`,
              color: kirinColor,
              backgroundColor: isAreaFocused(p2FlagLoc.r, p2FlagLoc.c, '3x3') ? `${kirinColor}20` : `${kirinColor}12`
            }}
          />
        )}
      </div>



      {/* Unit */}
      {
        unit && !unit.isDead && (
          <div
            className={`
            relative z-50 w-10 h-10 rounded-full flex flex-col items-center justify-center overflow-visible
            ${unit?.owner === PlayerID.P1 ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-cyan-100 border-2 border-cyan-400' : 'bg-gradient-to-br from-red-600 to-pink-700 text-red-100 border-2 border-red-400'}
            transition-all
            ${unit.hasActedThisRound ? 'opacity-80' : ''} 
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

            {flagBurstParticles.length > 0 && unit && !unit.isDead && (
              <>
                <div
                  className="absolute pointer-events-none rounded-full z-[170]"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: '66px',
                    height: '66px',
                    transform: 'translate(-50%, -50%)',
                    background: `radial-gradient(circle, ${burstPalette.core} 0%, ${burstPalette.mid} 45%, ${burstPalette.fade} 75%)`,
                    animation: 'flagBurstFlash 0.5s ease-out forwards'
                  }}
                />
                <div
                  className="absolute pointer-events-none rounded-full z-[170]"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: '28px',
                    height: '28px',
                    border: `1px solid ${burstPalette.ringA}`,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 14px ${burstPalette.glowA}`,
                    animation: 'flagBurstRing 0.72s cubic-bezier(0.18,0.9,0.35,1) forwards'
                  }}
                />
                <div
                  className="absolute pointer-events-none rounded-full z-[170]"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: '18px',
                    height: '18px',
                    border: `1px solid ${burstPalette.ringB}`,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 12px ${burstPalette.glowB}`,
                    animation: 'flagBurstRing 0.66s cubic-bezier(0.1,0.85,0.3,1) forwards',
                    animationDelay: '0.06s'
                  }}
                />
                {flagBurstParticles.map(p => (
                  <div
                    key={p.id}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      background: burstPalette.particle,
                      boxShadow: `0 0 12px ${burstPalette.glowA}`,
                      '--tx': `${p.x}px`,
                      '--ty': `${p.y}px`,
                      animation: `flagBurst ${p.duration}s cubic-bezier(0.15,0.8,0.35,1) forwards`,
                      animationDelay: `${p.delay}s`,
                      zIndex: 170
                    } as React.CSSProperties}
                  />
                ))}
              </>
            )}

            <div className={`unit-body absolute inset-0 rounded-full -z-10 ${unit.hasActedThisRound
              ? (unit.owner === PlayerID.P1 ? 'bg-blue-50/20' : 'bg-red-50/20')
              : (unit?.owner === PlayerID.P1 ? 'bg-gradient-to-br from-cyan-600 to-blue-700' : 'bg-gradient-to-br from-red-600 to-pink-700')
              }`} />

            <div className="unit-icon relative z-20">
              {/* Unit Icon with Stealth Effect */}
              <div className={`p-1 rounded-full ${isUnitStealthed ? 'stealth-overlay bg-white/5 blur-[0.5px]' : ''}`}>
                {getUnitIcon(unit.type)}
              </div>
            </div>

            {/* Evolution Accessories - Path A (Blue) */}
            {evolutionLevelA > 0 && (
              <div className="evolution-accessories-container absolute inset-0 z-[120] pointer-events-none overflow-visible">
                {/* LV1: 1 accessory at top */}
                {evolutionLevelA === 1 && (
                  <>
                    <div className="evolution-accessory" style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: 'rgb(96, 165, 250)',
                      borderRadius: '2px',
                      boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)',
                      zIndex: 10
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
                    <div className="evolution-accessory" style={{
                      position: 'absolute',
                      top: '-15px',
                      left: 'calc(50% - 4px)',
                      transform: 'rotate(45deg)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: 'rgb(96, 165, 250)',
                      borderRadius: '2px',
                      boxShadow: '0 0 4px rgba(96, 165, 250, 0.8)',
                      animation: 'accessoryBreatheTop 2s ease-in-out infinite',
                      zIndex: 10
                    }} />
                    {/* Bottom-left point */}
                    <div className="evolution-accessory" style={{
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
                    <div className="evolution-accessory" style={{
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
              </div>
            )}

            {/* Evolution Accessories - Path B (Orange) */}
            {evolutionLevelB > 0 && (
              <div className="evolution-accessories-container absolute inset-0 z-[120] pointer-events-none overflow-visible">
                {/* LV1: 1 accessory at bottom */}
                {evolutionLevelB === 1 && (
                  <>
                    <div className="evolution-accessory" style={{
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
                      '--breathe-y': '5px',
                      zIndex: 10
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
                    <div className="evolution-accessory" style={{
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
                    <div className="evolution-accessory" style={{
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
                    <div className="evolution-accessory" style={{
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
              </div>
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
            {showCarriedMineIndicator && unit?.carriedMine && (
              <div className="absolute -bottom-2 -left-2 bg-slate-900/95 rounded-full p-0.5 border border-amber-300 shadow-lg shadow-amber-500/30 z-[80]">
                {unit.carriedMine.type === MineType.NORMAL && <Bomb size={10} className="text-white" />}
                {unit.carriedMine.type === MineType.SMOKE && <Cloud size={10} className="text-slate-200" />}
                {unit.carriedMine.type === MineType.SLOW && <Snowflake size={10} className="text-blue-200" />}
                {unit.carriedMine.type === MineType.CHAIN && <Share2 size={10} className="text-purple-300" />}
                {unit.carriedMine.type === MineType.NUKE && <Radiation size={10} className="text-emerald-300" />}
              </div>
            )}

            {/* Standing On Ore Indicator */}
            {showOreUnderUnitIndicator && (
              <div className="absolute -bottom-2 -right-2 z-[80] pointer-events-none">
                <div className="relative w-[28px] h-[28px] flex items-center justify-center drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]">
                  <EnergyCrystal size={28} oreSize={cell.oreSize || 'small'} />
                </div>
              </div>
            )}

            {/* Team-colored Slash for Acted Units */}
            {unit.hasActedThisRound && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                <svg viewBox="0 0 100 100" className="w-full h-full opacity-70">
                  <line
                    x1="20" y1="20" x2="80" y2="80"
                    stroke={unit.owner === PlayerID.P1 ? '#1d4ed8' : '#b91c1c'}
                    strokeWidth="15"
                    strokeLinecap="round"
                  />
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

      {foregroundHighlightClass && (
        <div className={`absolute inset-0 rounded-sm pointer-events-none z-[155] ${foregroundHighlightClass}`} />
      )}
    </div >
  );
};

export default React.memo(GridCell);
