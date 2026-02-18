import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog
} from '../types';
import {
    calculateAttackDamage,
    checkEnergyCap as engineCheckEnergyCap
} from '../gameEngine';
import {
    ENERGY_REGEN, MAX_INTEREST, ENERGY_CAP_RATIO,
    P1_FLAG_POS, P2_FLAG_POS, ORE_REWARDS, TURN_TIMER, THINKING_TIMER,
    EVOLUTION_COSTS
} from '../constants';
import {
    getMineBaseCost, getUnitName,
    getEnemyTerritoryEnergyCost
} from '../gameHelpers';

export type TargetMode = 'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null;

interface UsePlayerActionsProps {
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameStateRef: React.MutableRefObject<GameState>;
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    selectedMineType: MineType;
}

export const usePlayerActions = ({
    setGameState,
    gameStateRef,
    targetMode,
    setTargetMode,
    selectedMineType,
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

    const checkEnergyCap = useCallback((unit: Unit, cost: number) => {
        if (!engineCheckEnergyCap(unit, cost)) {
            const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
            addLog('log_energy_cap', 'error', { cap });
            return false;
        }
        return true;
    }, [addLog]);

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

    const startNewRound = useCallback((prevState: GameState) => {
        const nextTurn = prevState.turnCount + 1;
        const p1 = prevState.players[PlayerID.P1];
        const p2 = prevState.players[PlayerID.P2];

        const p1Interest = Math.min(Math.floor(p1.energy / 10), MAX_INTEREST);
        const p2Interest = Math.min(Math.floor(p2.energy / 10), MAX_INTEREST);

        const p1OreIncome = p1.units.reduce((acc, u) => {
            if (u.isDead) return acc;
            const cell = prevState.cells[u.r][u.c];
            return acc + (cell.hasEnergyOre && cell.oreSize ? ORE_REWARDS[cell.oreSize] : 0);
        }, 0);
        const p2OreIncome = p2.units.reduce((acc, u) => {
            if (u.isDead) return acc;
            const cell = prevState.cells[u.r][u.c];
            return acc + (cell.hasEnergyOre && cell.oreSize ? ORE_REWARDS[cell.oreSize] : 0);
        }, 0);

        let regen = ENERGY_REGEN;
        if (nextTurn >= 12) regen = 50;
        else if (nextTurn >= 8) regen = 45;
        else if (nextTurn >= 4) regen = 40;

        const p1Income = regen + p1Interest + p1OreIncome + p1.energyFromKills;
        const p2Income = regen + p2Interest + p2OreIncome + p2.energyFromKills;

        const p1Updated = { ...p1, energy: p1.energy + p1Income, energyFromKills: 0, movesMadeThisTurn: 0, flagMovesMadeThisTurn: 0, nonGeneralFlagMovesMadeThisTurn: 0 };
        const p2Updated = { ...p2, energy: p2.energy + p2Income, energyFromKills: 0, movesMadeThisTurn: 0, flagMovesMadeThisTurn: 0, nonGeneralFlagMovesMadeThisTurn: 0 };

        const updatedP1Units = p1Updated.units.map(u => ({
            ...u,
            hasActedThisRound: false,
            energyUsedThisTurn: 0,
            status: { ...u.status, turnsSinceLastAction: (u.status.turnsSinceLastAction || 0) + 1 },
            respawnTimer: u.isDead ? Math.max(0, (u.respawnTimer || 0) - 1) : 0,
            hp: u.isDead && (u.respawnTimer || 0) === 1 ? u.maxHp : u.hp,
            isDead: u.isDead && (u.respawnTimer || 0) > 1,
            startOfActionEnergy: p1Updated.energy
        }));

        const updatedP2Units = p2Updated.units.map(u => ({
            ...u,
            hasActedThisRound: false,
            energyUsedThisTurn: 0,
            status: { ...u.status, turnsSinceLastAction: (u.status.turnsSinceLastAction || 0) + 1 },
            respawnTimer: u.isDead ? Math.max(0, (u.respawnTimer || 0) - 1) : 0,
            hp: u.isDead && (u.respawnTimer || 0) === 1 ? u.maxHp : u.hp,
            isDead: u.isDead && (u.respawnTimer || 0) > 1,
            startOfActionEnergy: p2Updated.energy
        }));

        const newMines = prevState.mines.filter(m => {
            const mkrLvlA = prevState.players[m.owner].evolutionLevels[UnitType.MAKER].a;
            return mkrLvlA >= 2 ? true : Math.random() > 0.1;
        });

        const newSmokes = prevState.smokes.map(s => ({ ...s, duration: s.duration - 1 })).filter(s => s.duration > 0);

        const newCells = prevState.cells.map(row => row.map(cell => ({
            ...cell,
            oreSize: cell.hasEnergyOre && Math.random() < 0.2 ? (Math.random() < 0.7 ? 'small' : (Math.random() < 0.9 ? 'medium' : 'large')) : cell.oreSize
        })));

        setGameState({
            ...prevState,
            turnCount: nextTurn,
            currentPlayer: PlayerID.P1,
            phase: 'thinking',
            timeLeft: THINKING_TIMER,
            activeUnitId: null,
            cells: newCells,
            mines: newMines,
            smokes: newSmokes,
            movements: [],
            players: { [PlayerID.P1]: { ...p1Updated, units: updatedP1Units }, [PlayerID.P2]: { ...p2Updated, units: updatedP2Units } },
            logs: [{ turn: nextTurn, messageKey: 'log_round_start', params: { round: nextTurn }, type: 'info' as const }, ...prevState.logs]
        });
    }, [setGameState]);

    const handleActionComplete = useCallback((actedUnitId: string | null, timedOut: boolean = false) => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        let targetUnitId = actedUnitId;
        if (timedOut) addLog('log_timeout', 'info', { player: state.currentPlayer });

        if (!targetUnitId) {
            const available = state.players[state.currentPlayer].units.find(u => !u.isDead && !u.hasActedThisRound);
            if (available) {
                targetUnitId = available.id;
                addLog('log_pass', 'info', { player: state.currentPlayer, unit: getUnitName(available.type) });
            }
        }

        setGameState(prev => {
            let nextState = { ...prev };
            if (targetUnitId) {
                const p = nextState.players[prev.currentPlayer];
                const updatedUnits = p.units.map(u => u.id === targetUnitId ? { ...u, hasActedThisRound: true } : u);
                nextState.players = { ...nextState.players, [prev.currentPlayer]: { ...p, units: updatedUnits } };
            }

            const p1Done = nextState.players[PlayerID.P1].units.every(u => u.isDead || u.hasActedThisRound);
            const p2Done = nextState.players[PlayerID.P2].units.every(u => u.isDead || u.hasActedThisRound);

            if (p1Done && p2Done) {
                setTimeout(() => startNewRound(gameStateRef.current), 0);
                return nextState;
            } else {
                let nextPlayer = prev.currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                if (nextState.players[nextPlayer].units.every(u => u.isDead || u.hasActedThisRound)) nextPlayer = prev.currentPlayer;

                return {
                    ...nextState,
                    currentPlayer: nextPlayer,
                    activeUnitId: null,
                    selectedUnitId: null,
                    timeLeft: TURN_TIMER,
                    movements: []
                };
            }
        });
        setTargetMode(null);
    }, [gameStateRef, setGameState, addLog, startNewRound, setTargetMode]);

    const attemptMove = useCallback((unitId: string, r: number, c: number, cost: number) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit || unit.hasActedThisRound) return;

        if (state.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (!checkEnergyCap(unit, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const newUnits = p.units.map(u => u.id === unitId ? { ...u, r, c, energyUsedThisTurn: u.energyUsedThisTurn + cost, hasActedThisRound: true } : u);
            const newMovements = [...prev.movements, { unitId, from: { r: unit.r, c: unit.c }, to: { r, c }, energy: cost }];

            return {
                ...prev,
                players: { ...prev.players, [unit.owner]: { ...p, units: newUnits, energy: p.energy - cost } },
                movements: newMovements
            };
        });

        addLog('log_move_action', 'move', { unit: getUnitName(unit.type), r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode('move');
        setTimeout(checkVictory, 100);
    }, [gameStateRef, getUnit, addLog, checkEnergyCap, setGameState, checkVictory, setTargetMode]);

    const executeAttack = useCallback((attackerId: string, targetUnit: Unit) => {
        const state = gameStateRef.current;
        const attacker = getUnit(attackerId, state);
        if (!attacker || attacker.type !== UnitType.GENERAL) return;

        const cost = getEnemyTerritoryEnergyCost(attacker, 8);
        if (state.players[attacker.owner].energy < cost) {
            addLog('log_low_energy_attack', 'info');
            return;
        }

        if (!checkEnergyCap(attacker, cost)) return;

        const { damage: dmg } = calculateAttackDamage(attacker, targetUnit, state.players[attacker.owner], state.players[targetUnit.owner], false);

        setGameState(prev => {
            const p = prev.players[attacker.owner];
            const tp = prev.players[targetUnit.owner];
            const newTUnits = tp.units.map(u => u.id === targetUnit.id ? { ...u, hp: Math.max(0, u.hp - dmg), isDead: u.hp - dmg <= 0 } : u);

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [attacker.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === attackerId ? { ...u, hasActedThisRound: true } : u) },
                    [targetUnit.owner]: { ...tp, units: newTUnits }
                }
            };
        });

        addLog('log_attack_hit', 'combat', { attacker: getUnitName(attacker.type), target: getUnitName(targetUnit.type), dmg }, attacker.owner);
        handleActionComplete(attackerId);
    }, [gameStateRef, getUnit, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handleMinePlacement = useCallback((unit: Unit, targetR: number, targetC: number) => {
        const state = gameStateRef.current;
        const cost = getEnemyTerritoryEnergyCost(unit, getMineBaseCost(selectedMineType));

        if (state.players[unit.owner].energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (!checkEnergyCap(unit, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const newMine: Mine = { id: `m-${Date.now()}`, owner: unit.owner, type: selectedMineType, r: targetR, c: targetC, revealedTo: [] };
            return {
                ...prev,
                mines: [...prev.mines, newMine],
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, hasActedThisRound: true } : u) } }
            };
        });

        addLog('log_place_mine', 'move', { unit: getUnitName(unit.type), r: targetR + 1, c: targetC + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, selectedMineType, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handleEvolution = useCallback((unitType: UnitType, branch: 'a' | 'b') => {
        const state = gameStateRef.current;
        const player = state.players[state.currentPlayer];
        const level = player.evolutionLevels[unitType][branch];
        const cost = EVOLUTION_COSTS[level as keyof typeof EVOLUTION_COSTS];

        if (player.energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        setGameState(prev => {
            const p = prev.players[prev.currentPlayer];
            const newLevels = { ...p.evolutionLevels };
            newLevels[unitType] = { ...newLevels[unitType], [branch]: level + 1 };

            return {
                ...prev,
                players: { ...prev.players, [prev.currentPlayer]: { ...p, energy: p.energy - cost, evolutionLevels: newLevels } }
            };
        });

        addLog('log_evolved', 'evolution', { unit: getUnitName(unitType), branch, level: level + 1 }, state.currentPlayer);
    }, [gameStateRef, addLog, setGameState]);

    const handleCellClick = useCallback((r: number, c: number) => {
        const state = gameStateRef.current;
        if (state.gameOver || state.isPaused) return;

        if (state.phase === 'placement') {
            // Placement logic
            return;
        }

        if (state.phase === 'thinking' || (state.gameMode === 'pve' && state.currentPlayer === PlayerID.P2)) return;

        const unitInCell = [...state.players[PlayerID.P1].units, ...state.players[PlayerID.P2].units].find(u => u.r === r && u.c === c && !u.isDead);

        if (state.selectedUnitId) {
            const unit = getUnit(state.selectedUnitId);
            if (!unit || unit.owner !== state.currentPlayer) return;

            if (targetMode === 'move') attemptMove(unit.id, r, c, 3);
            else if (targetMode === 'attack' && unitInCell && unitInCell.owner !== state.currentPlayer) executeAttack(unit.id, unitInCell);
            else if (targetMode === 'place_mine') handleMinePlacement(unit, r, c);
        } else if (unitInCell && unitInCell.owner === state.currentPlayer) {
            setGameState(prev => ({ ...prev, selectedUnitId: unitInCell.id }));
        }
    }, [gameStateRef, getUnit, targetMode, attemptMove, executeAttack, handleMinePlacement, setGameState]);

    return {
        handleCellClick,
        attemptMove,
        executeAttack,
        handleMinePlacement,
        handleEvolution,
        handleActionComplete,
        startNewRound
    };
};
