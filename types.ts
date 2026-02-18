
export enum PlayerID {
  P1 = 'P1',
  P2 = 'P2',
}

export enum UnitType {
  GENERAL = 'General',
  MINESWEEPER = 'Sweeper',
  RANGER = 'Ranger',
  MAKER = 'Maker',
  DEFUSER = 'Defuser',
}

export enum MineType {
  NORMAL = 'Normal',
  CHAIN = 'Chain',
  SLOW = 'Slow',
  SMOKE = 'Smoke',
}

export interface Coordinates {
  r: number; // row
  c: number; // column
}

// New: Status effects for units
export interface UnitStatus {
  mineVulnerability: number; // Permanent extra damage taken from mines
  moveCostDebuff: number; // Extra energy cost for next move (resets after move or round)
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerID;
  hp: number;
  maxHp: number;
  r: number;
  c: number;
  hasFlag: boolean;
  carriedMine: MineType | null; // For Ranger to carry a mine
  energyUsedThisTurn: number;
  isDead: boolean;
  respawnTimer: number; // 0 if alive, >0 if dead (turns remaining)
  hasActedThisRound: boolean; // Tracks if unit has acted in the current alternating phase
  status: UnitStatus; // New: Debuffs/Buffs
  stats: {
    damageDealt: number;
    minesSwept: number;
    stepsTaken: number;
    minesPlaced: number;
    minesTriggered: number;
  };
}

export interface Mine {
  id: string;
  owner: PlayerID;
  type: MineType;
  r: number;
  c: number;
  revealedTo: PlayerID[]; // List of players who can see this mine
}

export interface Cell {
  r: number;
  c: number;
  isObstacle: boolean;
  isFlagBase: PlayerID | null; // If this cell is a flag base
  hasEnergyOre: boolean;
  oreSize: 'small' | 'medium' | 'large' | null;
}

// Track progress for evolution quests
export interface QuestStats {
  generalDamage: number;
  generalFlagSteps: number;
  sweeperMinesMarked: number;
  consecutiveSafeRounds: number; // For Sweeper Branch B
  rangerSteps: number;
  rangerMinesMoved: number;
  makerMinesTriggeredByEnemy: number;
  makerMinesPlaced: number;
  defuserMinesSoaked: number;
  defuserMinesDisarmed: number;
  triggeredMineThisRound: boolean; // Helper for consecutiveSafeRounds
}

// Track current evolution level (0-3)
export interface EvolutionLevels {
  [UnitType.GENERAL]: { a: number; b: number };
  [UnitType.MINESWEEPER]: { a: number; b: number };
  [UnitType.RANGER]: { a: number; b: number };
  [UnitType.MAKER]: { a: number; b: number };
  [UnitType.DEFUSER]: { a: number; b: number };
}

export interface PlayerState {
  id: PlayerID;
  energy: number;
  startOfRoundEnergy: number; // Rule 1: Track start of round energy for 1/3 cap
  energyFromKills: number; // Track energy gained from kills this round
  placementMinesPlaced: number; // Track mines during phase 1
  flagPosition: Coordinates; // Current position of the flag (could be on a unit or on ground)
  basePosition: Coordinates; // Where the flag starts (and where enemy needs to bring it)
  units: Unit[];
  movesMadeThisTurn: number; // Kept for stats, but logic uses hasActedThisRound now
  hasResurrectedGeneral: boolean;
  questStats: QuestStats; // New
  evolutionLevels: EvolutionLevels; // New
}

export interface GameLog {
  turn: number;
  messageKey: string; // Changed from message to messageKey
  params?: Record<string, any>; // Add params for dynamic values
  type: 'info' | 'combat' | 'move' | 'mine' | 'evolution' | 'error';
}

export interface GameState {
  turnCount: number;
  currentPlayer: PlayerID;
  phase: 'thinking' | 'action' | 'placement'; // Added 'placement'
  gameMode: 'pvp' | 'pve'; // New: Game mode
  isPaused: boolean; // New: Pause state
  cells: Cell[][];
  mines: Mine[];
  players: Record<PlayerID, PlayerState>;
  selectedUnitId: string | null;
  activeUnitId: string | null; // The unit committed to acting this turn
  logs: GameLog[];
  gameOver: boolean;
  winner: PlayerID | null;
  timeLeft: number; 
}
