import { useCallback } from 'react';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, Coordinates, PlayerState
} from '../types';
import {
    calculateAttackDamage,
    checkEnergyCap as engineCheckEnergyCap,
    calculateEnergyIncome,
    calculateMineInteraction
} from '../gameEngine';
import {
    ENERGY_CAP_RATIO,
    P1_FLAG_POS, P2_FLAG_POS, ORE_REWARDS, TURN_TIMER, THINKING_TIMER,
    EVOLUTION_COSTS, UNIT_STATS, GRID_ROWS, GRID_COLS
} from '../constants';
import {
    getMineBaseCost, getUnitName,
    getEnemyTerritoryEnergyCost
} from '../gameHelpers';
import { getStartingPositions } from '../gameInit';

export type TargetMode = 'move' | 'attack' | 'scan' | 'place_mine' | 'place_setup_mine' | 'disarm' | 'teleport' | 'place_tower' | 'place_hub' | 'throw_mine' | 'place_factory' | 'move_mine_start' | 'move_mine_end' | 'convert_mine' | 'pickup_mine_select' | 'stealth' | null;

interface UsePlayerActionsProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameStateRef: React.MutableRefObject<GameState>;
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    selectedMineType: MineType;
    setSelectedMineType: (type: MineType) => void;
    setShowEvolutionTree: (show: boolean) => void;
}

export const usePlayerActions = ({
    setGameState,
    gameStateRef,
    setTargetMode,
    selectedMineType,
    setSelectedMineType,
    setShowEvolutionTree,
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

    // getDisplayCost removed as it was unused inside the hook body

    const checkEnergyCap = useCallback((unit: Unit, _player: PlayerState, cost: number) => {
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

        const newSmokes = prevState.smokes
            .map(s => ({ ...s, duration: s.duration - 1 }))
            .filter(s => s.duration > 0);

        const newCells = prevState.cells.map(row => row.map(cell => ({ ...cell })));

        const calculateOreIncomeAndConsume = (units: Unit[]) => {
            let income = 0;
            units.forEach(u => {
                if (!u.isDead) {
                    const cell = newCells[u.r][u.c];
                    if (cell.hasEnergyOre && cell.oreSize) {
                        income += ORE_REWARDS[cell.oreSize];
                        cell.hasEnergyOre = false;
                        cell.oreSize = null;
                    }
                }
            });
            return income;
        };

        const p1OreIncome = calculateOreIncomeAndConsume(p1.units);
        const p2OreIncome = calculateOreIncomeAndConsume(p2.units);

        const updatePlayerQuest = (player: PlayerState, oreIncome: number) => {
            let newQuestStats = { ...player.questStats };
            if (!newQuestStats.triggeredMineThisRound) {
                newQuestStats.consecutiveSafeRounds += 1;
            }
            newQuestStats.triggeredMineThisRound = false;
            newQuestStats.rangerMinesMovedThisRound = new Set();

            const newEnergy = calculateEnergyIncome(player.energy, nextTurn, oreIncome, player.energyFromKills);

            return {
                ...player,
                energy: newEnergy,
                startOfRoundEnergy: newEnergy,
                startOfActionEnergy: newEnergy,
                energyFromKills: 0,
                movesMadeThisTurn: 0,
                flagMovesMadeThisTurn: 0,
                nonGeneralFlagMovesMadeThisTurn: 0,
                questStats: newQuestStats,
            };
        };

        const resetUnits = (units: Unit[], playerState: PlayerState, playerLogs: GameLog[]) => {
            return units.map((u, unitIndex) => {
                const newDuration = Math.max(0, (u.status.moveCostDebuffDuration || 0) - 1);
                let newU = {
                    ...u,
                    hasActedThisRound: false,
                    energyUsedThisTurn: 0,
                    startOfActionEnergy: playerState.energy,
                    status: {
                        ...u.status,
                        moveCostDebuffDuration: newDuration,
                        moveCostDebuff: newDuration > 0 ? u.status.moveCostDebuff : 0
                    }
                };

                if (newU.isDead && newU.respawnTimer > 0) {
                    newU.respawnTimer -= 1;
                }

                if (newU.isDead && newU.respawnTimer === 0 && newU.type !== UnitType.GENERAL) {
                    const spawnPositions = getStartingPositions(playerState.id);
                    const originalSpawnPos = spawnPositions[unitIndex];
                    let respawnPos = originalSpawnPos;

                    const isOccupied = units.some((unit, idx) =>
                        idx !== unitIndex && unit.r === originalSpawnPos.r && unit.c === originalSpawnPos.c && !unit.isDead
                    );

                    if (isOccupied) {
                        const candidates: { r: number, c: number }[] = [];
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = originalSpawnPos.r + dr;
                                const nc = originalSpawnPos.c + dc;
                                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                    const cellOccupied = units.some((unit, idx) =>
                                        idx !== unitIndex && unit.r === nr && unit.c === nc && !unit.isDead
                                    );
                                    const cellObstacle = newCells[nr][nc].isObstacle;
                                    if (!cellOccupied && !cellObstacle) {
                                        candidates.push({ r: nr, c: nc });
                                    }
                                }
                            }
                        }

                        if (candidates.length > 0) {
                            respawnPos = candidates[Math.floor(Math.random() * candidates.length)];
                        } else {
                            const availableSpawns = spawnPositions.filter((pos) =>
                                !units.some((unit, uidx) =>
                                    uidx !== unitIndex && unit.r === pos.r && unit.c === pos.c && !unit.isDead
                                )
                            );
                            if (availableSpawns.length > 0) {
                                respawnPos = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
                            }
                        }
                    }

                    newU.isDead = false;
                    newU.hp = newU.maxHp;
                    newU.r = respawnPos.r;
                    newU.c = respawnPos.c;
                    newU.respawnTimer = 0;

                    playerLogs.unshift({
                        turn: nextTurn,
                        messageKey: 'log_unit_resurrected',
                        params: { unit: getUnitName(newU.type), r: respawnPos.r + 1, c: respawnPos.c + 1 },
                        type: 'info' as const,
                        owner: playerState.id
                    });
                }
                return newU;
            });
        };

        const p1Updated = updatePlayerQuest(p1, p1OreIncome);
        const p2Updated = updatePlayerQuest(p2, p2OreIncome);

        let newLogs = [...prevState.logs];
        const movementsByUnit: Record<string, { unitId: string; from: Coordinates; to: Coordinates; }> = {};
        prevState.movements.forEach(movement => {
            if (!movementsByUnit[movement.unitId]) {
                movementsByUnit[movement.unitId] = {
                    unitId: movement.unitId,
                    from: { ...movement.from },
                    to: { ...movement.to }
                };
            } else {
                movementsByUnit[movement.unitId].to = { ...movement.to };
            }
        });

        Object.values(movementsByUnit).forEach(movement => {
            const unit = getUnit(movement.unitId, prevState);
            if (unit) {
                newLogs.unshift({
                    turn: prevState.turnCount,
                    messageKey: 'log_move_action',
                    params: { unit: getUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
                    type: 'move' as const,
                    owner: unit.owner
                });
            }
        });

        const p1Logs: GameLog[] = [];
        const p2Logs: GameLog[] = [];
        const p1ResetUnits = resetUnits(p1.units, p1Updated, p1Logs);
        const p2ResetUnits = resetUnits(p2.units, p2Updated, p2Logs);

        newLogs = [...p1Logs, ...p2Logs, ...newLogs];

        let updatedP1Units = p1ResetUnits;
        let updatedP2Units = p2ResetUnits;

        const p1FlagPos = p1Updated.flagPosition;
        const p1GenLevelB = p1Updated.evolutionLevels[UnitType.GENERAL].b;
        if (p1GenLevelB >= 1) {
            updatedP1Units = updatedP1Units.map(u => {
                if (!u.isDead && u.c <= p1FlagPos.c) {
                    const newHp = Math.min(u.maxHp, u.hp + 1);
                    if (newHp > u.hp) {
                        newLogs.unshift({ turn: nextTurn, messageKey: 'log_evol_gen_b_heal', type: 'evolution', owner: PlayerID.P1 });
                    }
                    return { ...u, hp: newHp };
                }
                return u;
            });
        }

        const p2FlagPos = p2Updated.flagPosition;
        const p2GenLevelB = p2Updated.evolutionLevels[UnitType.GENERAL].b;
        if (p2GenLevelB >= 1) {
            updatedP2Units = updatedP2Units.map(u => {
                if (!u.isDead && u.c >= p2FlagPos.c) {
                    const newHp = Math.min(u.maxHp, u.hp + 1);
                    if (newHp > u.hp) {
                        newLogs.unshift({ turn: nextTurn, messageKey: 'log_evol_gen_b_heal', type: 'evolution', owner: PlayerID.P2 });
                    }
                    return { ...u, hp: newHp };
                }
                return u;
            });
        }

        setGameState({
            ...prevState,
            turnCount: nextTurn,
            currentPlayer: PlayerID.P1,
            phase: 'thinking',
            timeLeft: THINKING_TIMER,
            activeUnitId: null,
            cells: prevState.cells, // Should update ore spawn if needed
            mines: prevState.mines,
            smokes: newSmokes,
            movements: [],
            players: {
                [PlayerID.P1]: { ...p1Updated, units: updatedP1Units },
                [PlayerID.P2]: { ...p2Updated, units: updatedP2Units }
            },
            logs: [{ turn: nextTurn, messageKey: 'log_round_start', params: { round: nextTurn }, type: 'info' as const }, ...newLogs]
        });
    }, [getUnit, setGameState]);

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
                        type: 'move' as const,
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
            setTimeout(() => startNewRound(gameStateRef.current), 0);
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
                    type: 'move' as const,
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
                        turn: nextState.turnCount,
                        messageKey: 'log_move_action',
                        params: { unit: getUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
                        type: 'move' as const,
                        owner: unit.owner
                    });
                }
            });

            let updatedPlayers = { ...nextState.players };
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
    }, [gameStateRef, setGameState, addLog, startNewRound, setTargetMode, getUnit]);

    const attemptMove = useCallback((unitId: string, r: number, c: number, cost: number) => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        const unit = getUnit(unitId, state);
        if (!unit || unit.hasActedThisRound) return;

        const player = state.players[unit.owner];
        if (player.energy < cost) {
            addLog('log_low_energy', 'info', { cost });
            return;
        }

        if (!checkEnergyCap(unit, player, cost)) return;

        if (unit.hasFlag) {
            if (unit.type === UnitType.GENERAL) {
                if (player.flagMovesMadeThisTurn >= 5) { addLog('log_general_flag_move_limit', 'error'); return; }
            } else {
                if (player.nonGeneralFlagMovesMadeThisTurn >= 5) { addLog('log_flag_move_limit', 'error', { unit: getUnitName(unit.type) }); return; }
            }
        }

        if (state.cells[r][c].isObstacle) return;
        const isOccupied = state.players[PlayerID.P1].units.some(u => u.r === r && u.c === c && !u.isDead) ||
            state.players[PlayerID.P2].units.some(u => u.r === r && u.c === c && !u.isDead);
        if (isOccupied) return;

        let newMines = [...state.mines];
        let currentBuildings = [...state.buildings];
        let totalCost = cost;
        let mineTriggered = false;
        let mineOwnerId: PlayerID | null = null;
        let isDead = false;
        let newHp = unit.hp;
        let newMaxHp = unit.maxHp;
        let appliedStatus = { ...unit.status };
        let reflectDmg = 0;
        let newSmokes = [...state.smokes];
        let nukeAoeVictims: any[] = [];
        let qStats = { ...player.questStats };

        const proximityNukeIndex = state.mines.findIndex(m =>
            m.type === MineType.NUKE &&
            m.owner !== unit.owner &&
            Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1
        );
        let activeMineIndex = -1;
        let mineToTrigger: Mine | undefined;

        if (proximityNukeIndex !== -1) {
            activeMineIndex = proximityNukeIndex;
            mineToTrigger = state.mines[activeMineIndex];
        } else {
            const directContactMineIndex = state.mines.findIndex(m => m.r === r && m.c === c);
            if (directContactMineIndex !== -1) {
                activeMineIndex = directContactMineIndex;
                mineToTrigger = state.mines[activeMineIndex];
            }
        }

        let dmg = 0;
        if (activeMineIndex !== -1 && mineToTrigger) {
            const mine = mineToTrigger;
            if (mine.type === MineType.CHAIN && mine.owner !== unit.owner && (!mine.immuneUnitIds || !mine.immuneUnitIds.includes(unit.id))) {
                mineTriggered = true;
                mineOwnerId = mine.owner;
                dmg = 6;
                const subMines = newMines.filter(m => m.id !== mine.id && Math.abs(m.r - r) <= 2 && Math.abs(m.c - c) <= 2);
                subMines.forEach(sm => {
                    addLog('log_evol_mkr_chain', 'mine', { r: sm.r + 1, c: sm.c + 1 });
                    dmg += 2;
                    if (sm.type === MineType.SMOKE) {
                        const smokeIdBase = `smoke-chain-${Date.now()}-${sm.id}`;
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = sm.r + dr, nc = sm.c + dc;
                                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                    newSmokes.push({ id: `${smokeIdBase}-${dr}-${dc}`, r: nr, c: nc, owner: sm.owner, duration: 3 });
                                }
                            }
                        }
                    } else if (sm.type === MineType.SLOW) {
                        appliedStatus.moveCostDebuff = (appliedStatus.moveCostDebuff || 0) + 6;
                    } else if (sm.type === MineType.NUKE) {
                        newMines = newMines.filter(m => !(Math.abs(m.r - sm.r) <= 1 && Math.abs(m.c - sm.c) <= 1));
                        currentBuildings = currentBuildings.filter(b => !(Math.abs(b.r - sm.r) <= 1 && Math.abs(b.c - sm.c) <= 1));
                    }
                });
                newMines = newMines.filter(m => !subMines.includes(m) && m.id !== mine.id);
                addLog('log_hit_mine', 'mine', { unit: getUnitName(unit.type), dmg }, unit.owner);
            } else {
                const result = calculateMineInteraction(unit, state.mines, r, c, state.players[unit.owner]);
                if (result.triggered || result.isNukeTriggered) {
                    mineTriggered = true;
                    mineOwnerId = result.mineOwnerId;
                    dmg = result.damage;
                    appliedStatus = { ...appliedStatus, ...result.statusUpdates };
                    newMaxHp += result.newMaxHpBonus;
                    newHp = Math.min(newMaxHp, newHp + result.healAmount);
                    reflectDmg = result.reflectedDamage;
                    newSmokes.push(...result.createdSmokes);
                    result.logKeys.forEach(k => addLog(k, 'evolution'));
                    if (unit.type !== UnitType.DEFUSER) qStats.triggeredMineThisRound = true;
                    if (result.isNukeTriggered) {
                        const nukeBlastDamage = 6;
                        newMines = newMines.filter(m => !(Math.abs(m.r - mine.r) <= 1 && Math.abs(m.c - mine.c) <= 1));
                        currentBuildings = currentBuildings.filter(b => !(Math.abs(b.r - mine.r) <= 1 && Math.abs(b.c - mine.c) <= 1));
                        const allUnits = [...state.players[PlayerID.P1].units, ...state.players[PlayerID.P2].units];
                        allUnits.forEach(targetUnit => {
                            if (!targetUnit.isDead && Math.abs(targetUnit.r - mine.r) <= 1 && Math.abs(targetUnit.c - mine.c) <= 1) {
                                if (targetUnit.id === unit.id) return;
                                let damageToApply = nukeBlastDamage;
                                let targetNewHp = Math.max(0, targetUnit.hp - damageToApply);
                                let targetIsDead = targetNewHp === 0;
                                let targetRespawnTimer = (targetIsDead && targetUnit.type !== UnitType.GENERAL) ? (state.turnCount <= 10 ? 2 : 3) : 0;
                                nukeAoeVictims.push({ unitId: targetUnit.id, owner: targetUnit.owner, newHp: targetNewHp, isDead: targetIsDead, respawnTimer: targetRespawnTimer });
                                addLog('log_evol_nuke_blast_hit', 'combat', { unit: getUnitName(targetUnit.type), dmg: damageToApply }, mine.owner);
                            }
                        });
                    } else {
                        newMines.splice(newMines.findIndex(m => m.id === mine.id), 1);
                    }
                    addLog('log_hit_mine', 'mine', { unit: getUnitName(unit.type), dmg }, unit.owner);
                }
            }
        }

        newHp = Math.max(0, newHp - dmg);
        if (newHp <= 0) { isDead = true; newHp = 0; }

        setGameState(prev => {
            const prevPlayerState = prev.players[unit.owner];
            const updatedUnits = prevPlayerState.units.map(u => {
                if (u.id !== unit.id) return u;
                return {
                    ...u, r, c, hp: newHp, maxHp: newMaxHp, isDead,
                    respawnTimer: (newHp <= 0 && unit.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0,
                    hasFlag: unit.hasFlag, hasActedThisRound: false,
                    energyUsedThisTurn: u.energyUsedThisTurn + totalCost,
                    status: appliedStatus,
                    startOfActionEnergy: u.energyUsedThisTurn === 0 ? prevPlayerState.energy : u.startOfActionEnergy,
                    stats: { ...u.stats, stepsTaken: u.stats.stepsTaken + 1, minesTriggered: u.stats.minesTriggered + (mineTriggered ? 1 : 0) }
                };
            });

            let playersUpdates: any = { [unit.owner]: { ...prevPlayerState, units: updatedUnits } };
            if (reflectDmg > 0) {
                const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                const enemyState = prev.players[enemyId];
                if (enemyState.units.length > 0) {
                    const livingEnemies = enemyState.units.filter(u => !u.isDead);
                    if (livingEnemies.length > 0) {
                        livingEnemies.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
                        const target = livingEnemies[0];
                        const newEnemyHp = Math.max(0, target.hp - reflectDmg);
                        const isEnemyDead = newEnemyHp === 0;
                        const enemyUpdatedUnits = enemyState.units.map(u => u.id === target.id ? { ...u, hp: newEnemyHp, isDead: isEnemyDead, respawnTimer: (isEnemyDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0 } : u);
                        playersUpdates[enemyId] = { ...enemyState, units: enemyUpdatedUnits };
                        addLog('log_evol_def_reflect_hit', 'combat', { unit: getUnitName(target.type), dmg: reflectDmg }, unit.owner);
                    }
                }
            } else {
                const opponentId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                playersUpdates[opponentId] = prev.players[opponentId];
            }

            let finalP1 = playersUpdates[PlayerID.P1];
            let finalP2 = playersUpdates[PlayerID.P2];
            if (mineTriggered && mineOwnerId) {
                if (mineOwnerId === PlayerID.P1) finalP1 = { ...finalP1, questStats: { ...finalP1.questStats, makerMinesTriggeredByEnemy: finalP1.questStats.makerMinesTriggeredByEnemy + 1 } };
                else finalP2 = { ...finalP2, questStats: { ...finalP2.questStats, makerMinesTriggeredByEnemy: finalP2.questStats.makerMinesTriggeredByEnemy + 1 } };
            }

            const pId = unit.owner;
            const finalCurrentPlayer = pId === PlayerID.P1 ? finalP1 : finalP2;
            const finalPState = {
                ...finalCurrentPlayer,
                energy: prevPlayerState.energy - totalCost,
                questStats: qStats,
                flagPosition: (unit.hasFlag) ? { r, c } : prevPlayerState.flagPosition,
                movesMadeThisTurn: prevPlayerState.movesMadeThisTurn + 1,
                flagMovesMadeThisTurn: (unit.hasFlag && unit.type === UnitType.GENERAL) ? prevPlayerState.flagMovesMadeThisTurn + 1 : prevPlayerState.flagMovesMadeThisTurn,
                nonGeneralFlagMovesMadeThisTurn: (unit.hasFlag && unit.type !== UnitType.GENERAL) ? prevPlayerState.nonGeneralFlagMovesMadeThisTurn + 1 : prevPlayerState.nonGeneralFlagMovesMadeThisTurn,
            };

            if (pId === PlayerID.P1) finalP1 = finalPState;
            else finalP2 = finalPState;

            nukeAoeVictims.forEach(v => {
                let targetP = v.owner === PlayerID.P1 ? finalP1 : finalP2;
                const newUnits = targetP.units.map((u: Unit) => u.id === v.unitId ? { ...u, hp: v.newHp, isDead: v.isDead, respawnTimer: v.respawnTimer } : u);
                if (v.owner === PlayerID.P1) finalP1 = { ...finalP1, units: newUnits };
                else finalP2 = { ...finalP2, units: newUnits };
            });

            if (isDead && unit.type !== UnitType.GENERAL) {
                addLog('log_unit_died', 'info', { unit: getUnitName(unit.type), rounds: prev.turnCount <= 10 ? 2 : 3 }, unit.owner);
            }

            return {
                ...prev, activeUnitId: unit.id, mines: newMines, smokes: newSmokes, buildings: currentBuildings,
                movements: [...prev.movements, { unitId: unit.id, from: { r: unit.r, c: unit.c }, to: { r, c }, energy: totalCost }],
                players: { [PlayerID.P1]: finalP1, [PlayerID.P2]: finalP2 }
            };
        });

        setTimeout(checkVictory, 100);
    }, [gameStateRef, getUnit, addLog, checkEnergyCap, setGameState, checkVictory]);

    const handleAttack = useCallback((attackerId: string, targetUnit: Unit) => {
        const state = gameStateRef.current;
        const attacker = getUnit(attackerId, state);
        if (!attacker || attacker.type !== UnitType.GENERAL) return;

        const genLevelA = state.players[attacker.owner].evolutionLevels[UnitType.GENERAL].a;
        const attackRange = (genLevelA >= 2) ? 2 : 1;
        const dist = Math.abs(attacker.r - targetUnit.r) + Math.abs(attacker.c - targetUnit.c);
        const isCardinal = Math.abs(attacker.r - targetUnit.r) === 0 || Math.abs(attacker.c - targetUnit.c) === 0;

        if (dist > attackRange || !isCardinal) { addLog('log_out_of_range', 'info'); return; }

        const genVariantA = state.players[attacker.owner].evolutionLevels[UnitType.GENERAL].aVariant;
        if (attacker.hasFlag && !(genLevelA >= 3 && genVariantA === 1)) return;

        const baseAttackCost = UNIT_STATS[UnitType.GENERAL].attackCost;
        const cost = getEnemyTerritoryEnergyCost(attacker, baseAttackCost);
        const player = state.players[attacker.owner];
        if (player.energy < cost) { addLog('log_low_energy_attack', 'info'); return; }

        if (!checkEnergyCap(attacker, player, cost)) return;

        const { damage: dmg, logKey } = calculateAttackDamage(attacker, targetUnit, state.players[attacker.owner], state.players[targetUnit.owner], false);
        if (logKey) addLog(logKey, 'evolution');

        let isDead = targetUnit.hp - dmg <= 0;
        let killReward = isDead ? 3 + Math.floor(state.players[targetUnit.owner].energy * 0.15) : 0;

        setGameState(prev => {
            const pStats = prev.players[attacker.owner];
            const tStats = prev.players[targetUnit.owner];
            let attackerHeal = (attacker.type === UnitType.GENERAL && genLevelA >= 3 && attacker.hasFlag && genVariantA === 1) ? 2 : 0;

            const updatedTargetUnits = tStats.units.map(u => {
                if (u.id === targetUnit.id) {
                    let newStatus = { ...u.status };
                    if (genLevelA >= 2) { newStatus.moveCostDebuff = (newStatus.moveCostDebuff ?? 0) + 2; newStatus.moveCostDebuffDuration = 3; }
                    let finalR = u.r, finalC = u.c;
                    if (genLevelA === 3 && genVariantA === 2 && !isDead) {
                        const dr = u.r - attacker.r, dc = u.c - attacker.c;
                        const tr = u.r + (dr === 0 ? 0 : dr > 0 ? 1 : -1), tc = u.c + (dc === 0 ? 0 : dc > 0 ? 1 : -1);
                        if (tr >= 0 && tr < GRID_ROWS && tc >= 0 && tc < GRID_COLS && !prev.cells[tr][tc].isObstacle) {
                            const occ = [...prev.players[PlayerID.P1].units, ...prev.players[PlayerID.P2].units].some(ou => ou.r === tr && ou.c === tc && !ou.isDead);
                            if (!occ) { finalR = tr; finalC = tc; }
                        }
                    }
                    return { ...u, hp: Math.max(0, u.hp - dmg), isDead: u.hp - dmg <= 0, r: finalR, c: finalC, hasFlag: false, respawnTimer: (u.hp - dmg <= 0 && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0, status: newStatus };
                }
                return u;
            });

            const updatedAttackerUnits = pStats.units.map(u => u.id === attacker.id ? { ...u, r: (genLevelA === 3 && genVariantA === 2) ? targetUnit.r : u.r, c: (genLevelA === 3 && genVariantA === 2) ? targetUnit.c : u.c, hp: Math.min(u.maxHp, u.hp + attackerHeal), energyUsedThisTurn: u.energyUsedThisTurn + cost } : u);
            let newFlagPos = (targetUnit.hasFlag && isDead) ? { r: targetUnit.r, c: targetUnit.c } : tStats.flagPosition;
            let gameOver = isDead && targetUnit.type === UnitType.GENERAL;

            return {
                ...prev, gameOver, winner: gameOver ? attacker.owner : prev.winner,
                players: { ...prev.players, [attacker.owner]: { ...pStats, energy: pStats.energy - cost, energyFromKills: pStats.energyFromKills + killReward, questStats: { ...pStats.questStats, generalDamage: pStats.questStats.generalDamage + dmg }, units: updatedAttackerUnits }, [targetUnit.owner]: { ...tStats, units: updatedTargetUnits, flagPosition: newFlagPos } }
            };
        });

        addLog('log_attack_hit', 'combat', { attacker: getUnitName(attacker.type), target: getUnitName(targetUnit.type), dmg }, attacker.owner);
        if (killReward > 0) addLog('log_kill_reward', 'info', { amount: killReward });
        handleActionComplete(attackerId);
    }, [gameStateRef, getUnit, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePickupFlag = useCallback(() => {
        const state = gameStateRef.current;
        const unit = state.selectedUnitId ? getUnit(state.selectedUnitId) : null;
        if (!unit) return;
        const player = state.players[unit.owner];
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;
        if (!(unit.type === UnitType.GENERAL || (genLevelB >= 3 && genVariantB === 1))) return;
        if (unit.r !== player.flagPosition.r || unit.c !== player.flagPosition.c) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return { ...prev, activeUnitId: unit.id, players: { ...prev.players, [unit.owner]: { ...p, units: p.units.map(u => u.id === unit.id ? { ...u, hasFlag: true } : u) } } };
        });
        addLog('log_committed', 'info');
        addLog('log_flag_pickup', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
    }, [gameStateRef, getUnit, setGameState, addLog]);

    const handleDropFlag = useCallback(() => {
        const state = gameStateRef.current;
        const unit = state.selectedUnitId ? getUnit(state.selectedUnitId) : null;
        if (!unit || !unit.hasFlag) return;
        setGameState(prev => {
            const p = prev.players[unit.owner];
            return { ...prev, activeUnitId: unit.id, players: { ...prev.players, [unit.owner]: { ...p, units: p.units.map(u => u.id === unit.id ? { ...u, hasFlag: false } : u), flagPosition: { r: unit.r, c: unit.c } } } };
        });
        addLog('log_committed', 'info');
        addLog('log_flag_drop', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
    }, [gameStateRef, getUnit, setGameState, addLog]);

    const handleScanAction = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const swpLevelA = state.players[unit.owner].evolutionLevels[UnitType.MINESWEEPER].a;
        const baseCost = swpLevelA >= 1 ? 5 : 8;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        const player = state.players[unit.owner];
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        const scanRadius = swpLevelA >= 2 ? 2 : 1;
        if (Math.abs(unit.r - r) > scanRadius || Math.abs(unit.c - c) > scanRadius) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            let markedCount = 0;
            const newMines = prev.mines.map(m => {
                if (Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1) {
                    if (!m.revealedTo.includes(unit.owner)) { markedCount++; return { ...m, revealedTo: [...m.revealedTo, unit.owner] }; }
                }
                return m;
            });
            const qStats = { ...p.questStats, sweeperMinesMarked: p.questStats.sweeperMinesMarked + markedCount };
            return { ...prev, mines: newMines, players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, questStats: qStats, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } } };
        });
        addLog('log_scan_action', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePlaceMineAction = useCallback((unit: Unit, targetR: number, targetC: number, mineType: MineType) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;

        const factories = state.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const isInFactoryRange = factories.some(f => Math.max(Math.abs(f.r - targetR), Math.abs(f.c - targetC)) <= (f.level >= 2 ? 2 : 1));
        const currentMinesCount = state.mines.filter(m => m.owner === unit.owner).length;

        // Range Check: Maker can place mines in adjacent 1-radius (3x3 area around it)
        const dist = Math.max(Math.abs(unit.r - targetR), Math.abs(unit.c - targetC));
        if (dist > 1) {
            addLog('log_maker_range', 'error');
            return;
        }

        // Validation: Target Territory
        const isP1Zone = targetC < 12;
        const isMyZone = unit.owner === PlayerID.P1 ? isP1Zone : !isP1Zone;
        if (!isMyZone && mkrLevelB < 1) {
            addLog('log_mine_zone', 'error');
            return;
        }

        // Occupancy & Obstacle Check
        const cell = state.cells[targetR][targetC];
        const unitInCell = state.players[PlayerID.P1].units.find(u => u.r === targetR && u.c === targetC && !u.isDead) ||
            state.players[PlayerID.P2].units.find(u => u.r === targetR && u.c === targetC && !u.isDead);
        const mineInCell = state.mines.find(m => m.r === targetR && m.c === targetC);

        if (cell.isObstacle || unitInCell || mineInCell) {
            addLog('log_obstacle', 'error');
            return;
        }

        // Use the passed mine type instead of potentially stale selectedMineType from scope
        const effectiveMineType = mineType;

        const isFree = mkrLevelB === 3 && mkrVariantB === 1 && isInFactoryRange;
        const cost = getEnemyTerritoryEnergyCost(unit, isFree ? 0 : getMineBaseCost(effectiveMineType));

        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        const maxLimit = (mkrLevelB === 3) ? (mkrVariantB === 2 ? 5 + factories.length * 2 : 8) : 5 + mkrLevelB;
        if (currentMinesCount >= maxLimit) { addLog('log_max_mines', 'error'); return; }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return {
                ...prev,
                mines: [...prev.mines, {
                    id: `m-${Date.now()}`,
                    owner: unit.owner,
                    type: effectiveMineType,
                    r: targetR,
                    c: targetC,
                    revealedTo: [],
                    immuneUnitIds: prev.players[PlayerID.P1].units.concat(prev.players[PlayerID.P2].units).filter(u => u.r === targetR && u.c === targetC).map(u => u.id)
                }],
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        questStats: { ...p.questStats, makerMinesPlaced: p.questStats.makerMinesPlaced + 1 },
                        units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                }
            };
        });
        addLog('log_mine_placed', 'mine', { r: targetR + 1, c: targetC + 1 }, unit.owner);
        setTargetMode(null);
        setSelectedMineType(MineType.NORMAL);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, setTargetMode, handleActionComplete]);


    const handleEvolve = useCallback((unitType: UnitType, branch: 'a' | 'b', variant?: number) => {
        const state = gameStateRef.current;
        const player = state.players[state.currentPlayer];
        const currentLevel = player.evolutionLevels[unitType][branch];
        if (currentLevel >= 3) return;
        const cost = EVOLUTION_COSTS[currentLevel as keyof typeof EVOLUTION_COSTS];
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }

        setGameState(prev => {
            const p = prev.players[prev.currentPlayer];
            const newLevels = { ...p.evolutionLevels, [unitType]: { ...p.evolutionLevels[unitType], [branch]: currentLevel + 1, [branch + 'Variant']: variant || p.evolutionLevels[unitType][branch + 'Variant' as keyof typeof p.evolutionLevels[typeof unitType]] } };
            return { ...prev, players: { ...prev.players, [prev.currentPlayer]: { ...p, energy: p.energy - cost, evolutionLevels: newLevels } } };
        });
        addLog('log_evolved', 'evolution', { unit: getUnitName(unitType), branch, level: currentLevel + 1 }, state.currentPlayer);
        if (currentLevel + 1 === 3) setShowEvolutionTree(false);
    }, [gameStateRef, addLog, setGameState, setShowEvolutionTree]);

    return {
        handleCellClick: (_r: number, _c: number) => { }, // Placeholder for App.tsx's click logic if needed
        attemptMove,
        handleAttack,
        handleMinePlacement: handlePlaceMineAction,
        handleEvolution: handleEvolve,
        handleActionComplete,
        startNewRound,
        handlePickupFlag,
        handleDropFlag,
        handleScanAction,
        handleEvolve
    };
};
