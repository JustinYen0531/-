
import React, { useMemo } from 'react';
import { Cell, Unit, Mine, PlayerID, UnitType } from '../types';
import { Shield, Crown, Eye, Bomb, Footprints, Flag, Diamond, Star } from 'lucide-react';
import { P1_FLAG_POS, P2_FLAG_POS } from '../constants';

interface GridCellProps {
  cell: Cell;
  unit?: Unit;
  mine?: Mine;
  isSelected: boolean;
  isValidMove: boolean;
  isAttackTarget: boolean;
  isSkillTarget?: boolean;
  currentPlayer: PlayerID;
  onClick: () => void;
  p1FlagLoc: { r: number, c: number };
  p2FlagLoc: { r: number, c: number };
  unitTier?: number; // New prop for visual upgrades
}

const GridCell: React.FC<GridCellProps> = ({
  cell,
  unit,
  mine,
  isSelected,
  isValidMove,
  isAttackTarget,
  isSkillTarget,
  currentPlayer,
  onClick,
  p1FlagLoc,
  p2FlagLoc,
  unitTier = 0
}) => {
  
  // Decide background color
  let bgColor = 'bg-gray-800';
  if (cell.c < 12) bgColor = 'bg-slate-900'; // P1 Zone
  else bgColor = 'bg-zinc-900'; // P2 Zone

  if (cell.isObstacle) bgColor = 'bg-gray-700 pattern-diagonal-lines';
  if (isSelected) bgColor = 'bg-yellow-900 ring-2 ring-yellow-500';
  else if (isValidMove) bgColor = 'bg-green-900/50 ring-1 ring-green-500 cursor-pointer animate-pulse';
  else if (isAttackTarget) bgColor = 'bg-red-900/50 ring-1 ring-red-500 cursor-pointer';
  else if (isSkillTarget) bgColor = 'bg-purple-900/50 ring-1 ring-purple-500 cursor-pointer animate-pulse'; 

  // Base Flags
  const isP1Base = cell.r === P1_FLAG_POS.r && cell.c === P1_FLAG_POS.c;
  const isP2Base = cell.r === P2_FLAG_POS.r && cell.c === P2_FLAG_POS.c;
  
  // Current Flags
  const isP1FlagHere = p1FlagLoc.r === cell.r && p1FlagLoc.c === cell.c;
  const isP2FlagHere = p2FlagLoc.r === cell.r && p2FlagLoc.c === cell.c;

  // Mine Visibility Logic - strict check
  const isMineVisible = !!mine && (mine.owner === currentPlayer || mine.revealedTo.includes(currentPlayer));

  const getUnitIcon = (type: UnitType, tier: number) => {
    // If General has tier > 0, render with stars
    if (type === UnitType.GENERAL && tier > 0) {
        return (
            <div className="relative">
                <Crown size={16} />
                <div className="absolute -top-2 -right-3 flex">
                    {Array.from({length: tier}).map((_, i) => (
                         <Star key={i} size={6} className="text-yellow-300 fill-yellow-300 drop-shadow-sm" />
                    ))}
                </div>
            </div>
        );
    }

    switch (type) {
      case UnitType.GENERAL: return <Crown size={16} />;
      case UnitType.MINESWEEPER: return <Eye size={16} />;
      case UnitType.RANGER: return <Footprints size={16} />;
      case UnitType.MAKER: return <Bomb size={16} />;
      case UnitType.DEFUSER: return <Shield size={16} />;
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`
        w-12 h-12 min-w-[3rem] min-h-[3rem] border border-gray-800 relative flex items-center justify-center select-none
        ${bgColor}
        transition-all duration-200
        ${cell.isObstacle ? 'opacity-80' : ''}
      `}
    >
      {/* Bases */}
      {isP1Base && <div className="absolute inset-0 border-4 border-blue-900/30 pointer-events-none" />}
      {isP2Base && <div className="absolute inset-0 border-4 border-red-900/30 pointer-events-none" />}

      {/* Ore - Visible even if unit is present, but style changes */}
      {cell.hasEnergyOre && (
        <div className={`absolute ${unit ? 'bottom-0.5 right-0.5 z-30' : 'inset-0 flex items-center justify-center'} transition-all`}>
            <Diamond 
                size={unit ? 12 : (cell.oreSize === 'large' ? 24 : cell.oreSize === 'medium' ? 18 : 14)} 
                className={`text-purple-400 ${!unit && 'animate-bounce'}`} 
                fill={unit ? 'currentColor' : 'none'}
            />
        </div>
      )}

      {/* Mine (Underneath unit) */}
      {mine && isMineVisible && !unit && (
        <div className={`absolute opacity-80 ${mine?.owner === PlayerID.P1 ? 'text-blue-500' : 'text-red-500'}`}>
          <div className="text-[10px] font-bold text-center absolute -top-3 left-0 right-0">{mine.type === 'Normal' ? '' : mine.type[0]}</div>
          <Bomb size={14} />
        </div>
      )}

      {/* Flag on Ground */}
      {isP1FlagHere && !unit && <Flag size={20} className="text-blue-500 absolute z-10 drop-shadow-md" fill="currentColor" />}
      {isP2FlagHere && !unit && <Flag size={20} className="text-red-500 absolute z-10 drop-shadow-md" fill="currentColor" />}

      {/* Unit */}
      {unit && !unit.isDead && (
        <div className={`
          relative z-20 w-10 h-10 rounded-full flex flex-col items-center justify-center
          ${unit?.owner === PlayerID.P1 ? 'bg-blue-800 text-blue-100 border-2 border-blue-400' : 'bg-red-800 text-red-100 border-2 border-red-400'}
          shadow-lg
          ${unit.hasActedThisRound ? 'grayscale opacity-80' : ''} 
          /* Ore Occupation Visual Cue */
          ${cell.hasEnergyOre ? 'ring-2 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]' : ''}
        `}>
          {getUnitIcon(unit.type, unitTier)}
          
          {/* Health Bar Mini */}
          <div className="absolute -bottom-1 w-8 h-1 bg-gray-900 rounded-full overflow-hidden">
            <div 
              className={`h-full ${unit.hp < unit.maxHp * 0.3 ? 'bg-red-500' : 'bg-green-500'}`} 
              style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
            />
          </div>

          {/* Carrying Flag Indicator */}
          {unit.hasFlag && (
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full p-0.5 animate-pulse border border-white">
              <Flag size={10} fill="currentColor" />
            </div>
          )}

          {/* Red Slash for Acted Units */}
          {unit.hasActedThisRound && (
            <div className="absolute inset-0 z-30 pointer-events-none">
                <svg viewBox="0 0 100 100" className="w-full h-full opacity-70">
                    <line x1="20" y1="20" x2="80" y2="80" stroke="red" strokeWidth="15" strokeLinecap="round" />
                </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(GridCell);
