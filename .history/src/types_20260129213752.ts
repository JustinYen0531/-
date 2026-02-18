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
  SLOW = 'Slow',
  SMOKE = 'Smoke',
  NUKE = 'Nuke',
  CHAIN = 'Chain',
}

export interface SensorResult {
  r: number;
  c: number;
  count: number;
  owner: PlayerID;
}

export interface Coordinates {
  r: number;
  c: number;
}

export interface UnitStatus {
  moveCostDebuff: number;
  moveCostDebuffDuration?: number;
  mineVulnerability?: number;
  isStealthed?: boolean;
  turnsSinceLastAction?: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerID;
  r: number;
  c: number;
  hp: number;
  maxHp: number;
  energyUsedThisTurn: number;
  startOfActionEnergy: number;
  startOfRoundEnergy?: number;
  hasActedThisRound: boolean;
  isDead: boolean;
  respawnTimer: number;
  hasFlag: boolean;
  carriedMine?: Mine | null;
  status: UnitStatus;
  stats: {
    kills: number;
    deaths: number;
    minesPlaced: number;
    minesTriggered: number;
    damageDealt: number;
    damageTaken: number;
    flagCaptures: number;
    flagReturns: number;
    stepsTaken: number;
    minesSwept?: number;
  };
}

export interface Mine {
  id: string;
  type: MineType;
  owner: PlayerID;
  r: number;
  c: number;
  revealedTo: PlayerID[];
  immuneUnitIds?: string[]; // IDs of units immune to this mine until they leave its range
}

export interface Building {
  id: string;
  type: 'tower' | 'hub' | 'factory';
  owner: PlayerID;
  r: number;
  c: number;
  level: number;
  variant?: number | null;
  duration?: number;
}

export interface PlayerState {
  id: PlayerID;
  energy: number;
  energyFromKills: number;
  units: Unit[];
  evolutionPoints: number;
  evolutionLevels: EvolutionLevels;
  flagPosition: Coordinates;
  basePosition: Coordinates;
  movesMadeThisTurn: number;
  flagMovesMadeThisTurn: number;
  nonGeneralFlagMovesMadeThisTurn: number;
  placementMinesPlaced: number;
  questStats: QuestStats;
  startOfActionEnergy?: number;
  startOfRoundEnergy?: number;
  hasResurrectedGeneral?: boolean;
}

export interface EvolutionLevels {
  [UnitType.GENERAL]: { a: number; b: number; aVariant: 1 | 2 | null; bVariant: 1 | 2 | null };
  [UnitType.MINESWEEPER]: { a: number; b: number; aVariant: 1 | 2 | null; bVariant: 1 | 2 | null };
  [UnitType.RANGER]: { a: number; b: number; aVariant: 1 | 2 | null; bVariant: 1 | 2 | null };
  [UnitType.MAKER]: { a: number; b: number; aVariant: 1 | 2 | null; bVariant: 1 | 2 | null };
  [UnitType.DEFUSER]: { a: number; b: number; aVariant: 1 | 2 | null; bVariant: 1 | 2 | null };
}

export interface QuestStats {
  generalDamage: number;
  generalFlagSteps: number;
  sweeperMinesMarked: number;
  sweeperScansPerformed: number;
  sweeperMinesRevealed: number;
  sweeperDetonatedMines: number;
  consecutiveSafeRounds: number;
  rangerSteps: number;
  rangerMinesMoved: number;
  rangerMinesMovedThisRound?: Set<string>;
  makerMinesPlaced: number;
  makerMinesTriggeredByEnemy: number;
  defuserMinesSoaked: number;
  defuserMinesDisarmed: number;
  triggeredMineThisRound: boolean;
  flagSpiritDamageTakenThisTurn?: Set<string>;
}

export interface GameLog {
  turn: number;
  messageKey: string;
  params?: Record<string, any>;
  owner?: PlayerID;
  type: 'info' | 'combat' | 'mine' | 'evolution' | 'error' | 'move';
}

export interface Cell {
  r: number;
  c: number;
  isObstacle: boolean;
  isFlagBase: PlayerID | null;
  hasEnergyOre?: boolean;
  oreSize?: 'small' | 'medium' | 'large' | null;
}

export interface SmokeEffect {
  id: string;
  r: number;
  c: number;
  owner: PlayerID;
  duration: number;
}

export interface VFXEffect {
  id: string;
  type: 'explosion' | 'nuke' | 'smoke' | 'slow' | 'heal' | 'shield' | 'chain';
  r: number;
  c: number;
  size?: 'small' | 'medium' | 'large';
  startTime: number;
}

export interface GameState {
  turnCount: number;
  phase: 'placement' | 'thinking' | 'action';
  players: Record<PlayerID, PlayerState>;
  cells: Cell[][];
  mines: Mine[];
  buildings: Building[];
  smokes: SmokeEffect[];
  currentPlayer: PlayerID;
  selectedUnitId: string | null;
  activeUnitId: string | null;
  logs: GameLog[];
  gameMode: 'pvp' | 'pve' | 'sandbox';
  isPaused: boolean;
  gameOver: boolean;
  winner: PlayerID | null;
  timeLeft: number;
  movements: { unitId: string; from: Coordinates; to: Coordinates; energy: number }[];
  isSandboxTimerPaused?: boolean;
  isGodMode?: boolean;
  sandboxShowAllMines?: boolean;
  lastActionTime?: number;
  isTimeFrozen?: boolean;
  vfx: VFXEffect[];
}