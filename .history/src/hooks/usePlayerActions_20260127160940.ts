import { useCallback } from 'react';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, PlayerState, Building, Coordinates
} from '../types';
import {
    calculateAttackDamage, calculateEnergyIncome, calculateMineInteraction,
    checkEnergyCap as engineCheckEnergyCap
} from '../gameEngine';
import {
    GRID_ROWS, GRID_COLS, UNIT_STATS,
    ENERGY_REGEN, MAX_INTEREST, ENERGY_CAP_RATIO,
    P1_FLAG_POS, P2_FLAG_POS, ORE_REWARDS, MINE_DAMAGE, TURN_TIMER, THINKING_TIMER,
    EVOLUTION_CONFIG, EVOLUTION_COSTS, PLACEMENT_MINE_LIMIT,
    MAX_MINES_ON_BOARD
} from '../constants';
import { getStartingPositions } from '../gameInit';
import {
    getUnitTypeAbbr, getMineBaseCost, getUnitIcon, getUnitName,
    getEnemyTerritoryEnergyCost, getDisplayCost as getDisplayCostRaw
} from '../gameHelpers';

export type TargetMode = 'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null;

interface UsePlayerActionsProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameStateRef: React.MutableRefObject<GameState>;
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    selectedMineId: string | null;
    setSelectedMineId: (id: string | null) => void;
    selectedMineType: MineType;
    setSelectedMineType: (type: MineType) => void;
}

export const usePlayerActions = ({
    gameState,
    setGameState,
    gameStateRef,
    targetMode,
    setTargetMode,
    selectedMineId,
    setSelectedMineId,
    selectedMineType,
    setSelectedMineType
}: UsePlayerActionsProps) => {

    const addLog = useCallback((messageKey: string, type: GameLog['type'] = 'info', params?: Record<string, any>, owner?: PlayerID) => {
        setGameState(prev => ({
            ...prev,
            logs: [{ turn: prev.turnCount, messageKey, params, type, owner }, ...prev.logs].slice(0, 100)
        }));
    }, [setGameState]);

    const getUnit = useCallback((id: string, state: GameState = gameStateRef.current) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    }, [gameStateRef]);

    const getDisplayCost = useCallback((unit: Unit | null, baseCost: number, state: GameState = gameState, actionType: string = 'move') => {
        return getDisplayCostRaw(unit, baseCost, state, actionType);
    }, [gameState]);

    const checkEnergyCap = useCallback((unit: Unit, _player: PlayerState, cost: number) => {
        if (!engineCheckEnergyCap(unit, cost)) {
            const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
            addLog('log_energy_cap', 'error', { cap });
            return false;
        }
        return true;
    }, [addLog]);

    const spendEnergy = useCallback((pid: PlayerID, amount: number) => {
        setGameState(prev => ({
            ...prev,
            players: {
                ...prev.players,
                [pid]: {
                    ...prev.players[pid],
                    energy: prev.players[pid].energy - amount
                }
            }
        }));
    }, [setGameState]);

    const lockUnit = useCallback((unitId: string) => {
        setGameState(prev => {
            const unit = getUnit(unitId, prev);
            if (!unit) return prev;

            const playerState = prev.players[unit.owner];
            const updatedUnits = playerState.units.map(u =>
                u.id === unitId ? { ...u, startOfActionEnergy: playerState.energy } : u
            );

            return {
                ...prev,
                activeUnitId: unitId,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...playerState,
                        startOfActionEnergy: playerState.energy,
                        units: updatedUnits
                    }
                }
            };
        });
    }, [setGameState, getUnit]);

    const applyRadarScans = useCallback((state: GameState): Mine[] => {
        const newMines = [...state.mines];
        state.buildings.filter(b => b.type === 'tower').forEach(tower => {
            newMines.forEach((m, idx) => {
                if (Math.abs(m.r - tower.r) <= 1 && Math.abs(m.c - tower.c) <= 1) {
                    if (!m.revealedTo.includes(tower.owner)) {
                        newMines[idx] = { ...m, revealedTo: [...m.revealedTo, tower.owner] };
                    }
                }
            });
        });
        return newMines;
    }, []);

    const startActionPhase = useCallback(() => {
        setGameState(prev => {
            const updatedMines = applyRadarScans(prev);
            return {
                ...prev,
                phase: 'action',
                timeLeft: TURN_TIMER,
                mines: updatedMines,
                players: {
                    ...prev.players,
                    [PlayerID.P1]: {
                        ...prev.players[PlayerID.P1],
                        startOfActionEnergy: prev.players[PlayerID.P1].energy,
                        units: prev.players[PlayerID.P1].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P1].energy }))
                    },
                    [PlayerID.P2]: {
                        ...prev.players[PlayerID.P2],
                        startOfActionEnergy: prev.players[PlayerID.P2].energy,
                        units: prev.players[PlayerID.P2].units.map(u => ({ ...u, startOfActionEnergy: prev.players[PlayerID.P2].energy }))
                    }
                },
                logs: [{ turn: prev.turnCount, messageKey: 'log_action_phase', type: 'info' as const }, ...prev.logs]
            };
        });
        setTargetMode('move');
    }, [setGameState, applyRadarScans, setTargetMode]);

    const checkVictory = useCallback(() => {
        const state = gameStateRef.current;
        const p1State = state.players[PlayerID.P1];
        const p2State = state.players[PlayerID.P2];

        if (p1State.flagPosition.r === P2_FLAG_POS.r && p1State.flagPosition.c === P2_FLAG_POS.c) {
            setGameState(prev => ({ ...prev, gameOver: true, winner: PlayerID.P1 }));
            addLog('log_victory', 'info', { player: 'Player 1' });
        }
        if (p2State.flagPosition.r === P1_FLAG_POS.r && p2State.flagPosition.c === P1_FLAG_POS.c) {
            setGameState(prev => ({ ...prev, gameOver: true, winner: PlayerID.P2 }));
            addLog('log_victory', 'info', { player: 'Player 2' });
        }
    }, [gameStateRef, setGameState, addLog]);

    const handleActionComplete = useCallback((actedUnitId: string | null, timedOut: boolean = false) => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        let unitToMarkId = actedUnitId;
        let passLog: GameLog | null = null;

        if (timedOut) {
            addLog('log_timeout', 'info', { player: state.currentPlayer });
        }

        if (actedUnitId && !timedOut) {
            const unit = getUnit(actedUnitId, state);
            if (unit && unit.owner === state.currentPlayer && !unit.hasActedThisRound) {
                const unitMoved = state.movements.some(m => m.unitId === actedUnitId);
                const unitSpentEnergy = unit.energyUsedThisTurn > 0;

                if (!unitMoved && !unitSpentEnergy) {
                    passLog = {
                        turn: state.turnCount,
                        messageKey: 'log_pass_turn',
                        params: { unit: getUnitName(unit.type) },
                        type: 'move',
                        owner: unit.owner
                    };
                }
            }
        }

        if (!unitToMarkId) {
            const units = state.players[state.currentPlayer].units;
            const available = units.find(u => !u.isDead && !u.hasActedThisRound);
            if (available) {
                unitToMarkId = available.id;
                addLog('log_pass', 'info', { player: state.currentPlayer, unit: getUnitName(available.type) });
            }
        }

        let nextState = { ...state };
        let healedUnits: Array<{ unitId: string; unitType: UnitType; amount: number; owner: PlayerID }> = [];

        if (unitToMarkId) {
            const u = getUnit(unitToMarkId, state);
            if (u) {
                nextState = {
                    ...nextState,
                    selectedUnitId: null,
                    activeUnitId: null,
                    players: {
                        ...nextState.players,
                        [u.owner]: {
                            ...nextState.players[u.owner],
                            units: nextState.players[u.owner].units.map(unit => {
                                if (unit.id === u.id) {
                                    let updatedUnit = { ...unit, hasActedThisRound: true };
                                    if (!state.movements.some(m => m.unitId === u.id) && unit.energyUsedThisTurn === 0) {
                                        const healAmount = 3;
                                        const newHp = Math.min(unit.maxHp, unit.hp + healAmount);
                                        const actualHeal = newHp - unit.hp;
                                        updatedUnit.hp = newHp;
                                        if (actualHeal > 0) {
                                            healedUnits.push({ unitId: u.id, unitType: unit.type, amount: actualHeal, owner: u.owner });
                                        }
                                    }
                                    return updatedUnit;
                                }
                                return unit;
                            })
                        }
                    }
                };
            }
        }

        const p1Done = nextState.players[PlayerID.P1].units.every(u => u.isDead || u.hasActedThisRound);
        const p2Done = nextState.players[PlayerID.P2].units.every(u => u.isDead || u.hasActedThisRound);

        if (p1Done && p2Done) {
            startNewRound(nextState);
            setTargetMode(null);
        } else {
            let nextPlayer = state.currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const nextPlayerHasMoves = nextState.players[nextPlayer].units.some(u => !u.isDead && !u.hasActedThisRound);
            if (!nextPlayerHasMoves) {
                nextPlayer = state.currentPlayer;
            }

            let newLogs = [...nextState.logs];
            if (passLog) newLogs.unshift(passLog);

            healedUnits.forEach(healed => {
                newLogs.unshift({
                    turn: nextState.turnCount,
                    messageKey: 'log_passive_heal',
                    params: { unit: getUnitName(healed.unitType), amount: healed.amount },
                    type: 'move',
                    owner: healed.owner
                });
            });

            const movementsByUnit: Record<string, { unitId: string; from: Coordinates; to: Coordinates; }> = {};
            nextState.movements.forEach(movement => {
                if (!movementsByUnit[movement.unitId]) {
                    movementsByUnit[movement.unitId] = { unitId: movement.unitId, from: { ...movement.from }, to: { ...movement.to } };
                } else {
                    movementsByUnit[movement.unitId].to = { ...movement.to };
                }
            });
            Object.values(movementsByUnit).forEach(movement => {
                const unit = getUnit(movement.unitId, nextState);
                if (unit) {
                    newLogs.unshift({
                        turn: nextState.turnCount, messageKey: 'log_move_action',
                        params: { unit: getUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
                        type: 'move', owner: unit.owner
                    });
                }
            });

            let updatedPlayers = { ...nextState.players };
            if (nextPlayer === state.currentPlayer) {
                const nextPlayerState = updatedPlayers[nextPlayer];
                const nextUnit = nextPlayerState.units.find(u => !u.isDead && !u.hasActedThisRound);
                if (nextUnit) {
                    const currentEnergy = nextPlayerState.energy;
                    updatedPlayers[nextPlayer] = {
                        ...nextPlayerState,
                        startOfActionEnergy: currentEnergy,
                        units: nextPlayerState.units.map(u => u.id === nextUnit.id ? { ...u, startOfActionEnergy: currentEnergy } : u)
                    };
                }
            } else {
                const nextPlayerState = updatedPlayers[nextPlayer];
                updatedPlayers[nextPlayer] = {
                    ...nextPlayerState,
                    startOfActionEnergy: nextPlayerState.energy,
                    units: nextPlayerState.units.map(u => !u.isDead && !u.hasActedThisRound ? { ...u, startOfActionEnergy: nextPlayerState.energy } : u)
                };
            }

            setGameState({
                ...nextState,
                currentPlayer: nextPlayer,
                activeUnitId: null,
                selectedUnitId: null,
                timeLeft: TURN_TIMER,
                movements: [],
                logs: newLogs,
                players: updatedPlayers,
            });
            setTargetMode(null);
        }
    }, [gameStateRef, setGameState, addLog, setTargetMode, getUnit]); // Will need startNewRound added to deps but cyclic. Define startNewRound BEFORE passing to handleActionComplete.
    // Recursive dependency: handleActionComplete calls startNewRound. startNewRound updates state. 
    // We can define startNewRound as a const inside the hook but it needs to be used in handleActionComplete.
    // I'll define startNewRound first using useCallback. Or just define it as function if not passed as prop.

    // Correcting order: Define startNewRound first.
    // But wait, startNewRound needs to use setGameState.

    const startNewRound = useCallback((prevState: GameState) => {
        // ... (PLACEHOLDER FOR START NEW ROUND LOGIC - WILL FILL IN NEXT TOOL STEP) ...
    }, [setGameState, getUnit]);

    // Re-bind handleActionComplete to use the 'startNewRound' variable.
    // I will write the file with `let startNewRound ...` structure or use standard `const` and reorder in the actual final content.
    // Since I'm using `write_to_file` essentially as "create empty", I will use `replace_file_content` to fill properly.

    return {
        // ... placeholders ...
    }
};
