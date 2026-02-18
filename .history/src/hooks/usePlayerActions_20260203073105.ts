import { useCallback } from 'react';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, Coordinates, PlayerState, VFXEffect, TargetMode, Building
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


interface UsePlayerActionsProps {
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameStateRef: React.MutableRefObject<GameState>;
    targetMode: TargetMode;
    setTargetMode: (mode: TargetMode) => void;
    setSelectedMineType: (type: MineType) => void;
    setShowEvolutionTree: (show: boolean) => void;
    addVFX: (type: VFXEffect['type'], r: number, c: number, size?: VFXEffect['size']) => void;
    addLog: (messageKey: string, type?: GameLog['type'], params?: Record<string, any>, owner?: PlayerID) => void;
}


export const usePlayerActions = ({
    setGameState,
    gameStateRef,
    setTargetMode,
    setSelectedMineType,
    setShowEvolutionTree,
    addVFX,
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

        const newBuildings = prevState.buildings
            .map(b => (b.duration !== undefined ? { ...b, duration: b.duration - 1 } : b))
            .filter(b => b.duration === undefined || b.duration > 0);

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
            newQuestStats.flagSpiritDamageTakenThisTurn = new Set();

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
                skipCountThisRound: 0,
                questStats: newQuestStats,
            };
        };

        const resetUnits = (units: Unit[], playerState: PlayerState, enemyPlayerState: PlayerState, playerLogs: GameLog[]) => {
            return units.map((u, unitIndex) => {
                const newDuration = Math.max(0, (u.status.moveCostDebuffDuration || 0) - 1);

                // Kirin's Domain Round End Damage
                let roundEndDmg = 0;
                const enemyGenLevels = enemyPlayerState.evolutionLevels[UnitType.GENERAL];
                if (enemyGenLevels.b >= 3 && enemyGenLevels.bVariant === 2 && !u.isDead) { // B3-2
                    const flag = enemyPlayerState.flagPosition;
                    if (Math.abs(u.r - flag.r) <= 1 && Math.abs(u.c - flag.c) <= 1) {
                        roundEndDmg = 3;
                        playerLogs.push({
                            turn: nextTurn,
                            messageKey: 'log_attack_hit',
                            params: { attacker: '旗靈領域', target: getUnitName(u.type), dmg: 3 },
                            type: 'combat',
                            owner: enemyPlayerState.id
                        });
                    }
                }

                let currentHp = Math.max(0, u.hp - roundEndDmg);
                let isDead = currentHp <= 0;

                let newU = {
                    ...u,
                    hp: currentHp,
                    isDead: isDead,
                    hasActedThisRound: false,
                    energyUsedThisTurn: 0,
                    startOfActionEnergy: playerState.energy,
                    status: {
                        ...u.status,
                        moveCostDebuffDuration: newDuration,
                        moveCostDebuff: newDuration > 0 ? u.status.moveCostDebuff : 0
                    }
                };

                if (isDead && !u.isDead) { // Died this round end
                    newU.respawnTimer = (newU.type !== UnitType.GENERAL) ? (nextTurn <= 10 ? 2 : 3) : 0;
                }

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
                    newU.status = {
                        moveCostDebuff: 0,
                        moveCostDebuffDuration: 0,
                        mineVulnerability: 0
                    };

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
        const p1ResetUnits = resetUnits(p1.units, p1Updated, p2Updated, p1Logs);
        const p2ResetUnits = resetUnits(p2.units, p2Updated, p1Updated, p2Logs);

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
            selectedUnitId: null,
            cells: prevState.cells, // Should update ore spawn if needed
            mines: prevState.mines,
            buildings: newBuildings,
            smokes: newSmokes,
            movements: [],
            players: {
                [PlayerID.P1]: { ...p1Updated, units: updatedP1Units },
                [PlayerID.P2]: { ...p2Updated, units: updatedP2Units }
            },
            logs: [{ turn: nextTurn, messageKey: 'log_round_start', params: { round: nextTurn }, type: 'info' as const }, ...newLogs]
        });
    }, [getUnit, setGameState]);

    const handleActionComplete = useCallback((actedUnitId: string | null) => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        let unitToMarkId = actedUnitId;
        let passLog: GameLog | null = null;

        // Timeout log removed as per user request
        // if (timedOut) {
        //     addLog('log_timeout', 'info', { player: state.currentPlayer });
        // }

        if (actedUnitId) {
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
                passLog = {
                    turn: state.turnCount,
                    messageKey: 'log_pass_turn',
                    params: { unit: getUnitName(available.type) },
                    type: 'move',
                    owner: available.owner
                };
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
                    questStats: { ...nextPlayerState.questStats, flagSpiritDamageTakenThisTurn: new Set() },
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

    // Skip turn without marking unit as acted - costs escalating energy
    const handleSkipTurn = useCallback(() => {
        const state = gameStateRef.current;
        if (state.phase === 'thinking' || state.phase === 'placement') return;

        const player = state.players[state.currentPlayer];
        const skipCost = (player.skipCountThisRound + 1) * 10; // 10, 20, 30...

        if (player.energy < skipCost) {
            addLog('log_low_energy', 'error', { cost: skipCost });
            return;
        }

        // Log the skip
        addLog('log_skip_turn', 'info', { cost: skipCost, skipCount: player.skipCountThisRound + 1 }, state.currentPlayer);

        // Switch to next player without marking current unit as acted
        let nextPlayer = state.currentPlayer === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const nextPlayerHasMoves = state.players[nextPlayer].units.some(u => !u.isDead && !u.hasActedThisRound);
        if (!nextPlayerHasMoves) {
            // Check if both players are done (all units acted)
            const currentPlayerDone = player.units.every(u => u.isDead || u.hasActedThisRound);
            if (currentPlayerDone) {
                // All done, start new round
                setTimeout(() => startNewRound(gameStateRef.current), 0);
                setTargetMode(null);
                return;
            }
            // Next player has no moves, stay on current player
            nextPlayer = state.currentPlayer;
        }

        // Update state: deduct energy, increment skip count
        setGameState(prev => ({
            ...prev,
            currentPlayer: nextPlayer,
            activeUnitId: null,
            selectedUnitId: null,
            timeLeft: TURN_TIMER,
            movements: [],
            players: {
                ...prev.players,
                [state.currentPlayer]: {
                    ...prev.players[state.currentPlayer],
                    energy: prev.players[state.currentPlayer].energy - skipCost,
                    skipCountThisRound: prev.players[state.currentPlayer].skipCountThisRound + 1,
                }
            }
        }));
        setTargetMode(null);
    }, [gameStateRef, setGameState, addLog, startNewRound, setTargetMode]);

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
            Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1 &&
            // Fix: Only trigger if the unit was outside the 3x3 range of this specific mine
            Math.max(Math.abs(m.r - unit.r), Math.abs(m.c - unit.c)) > 1
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

        // Kirin's Domain Entry Damage (General B3-2)
        const enemyPlayerId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        const enemyGenLevels = state.players[enemyPlayerId].evolutionLevels[UnitType.GENERAL];
        if (enemyGenLevels.b >= 3 && enemyGenLevels.bVariant === 2) {
            const flag = state.players[enemyPlayerId].flagPosition;
            const wasInZone = Math.abs(unit.r - flag.r) <= 1 && Math.abs(unit.c - flag.c) <= 1;
            const isInZone = Math.abs(r - flag.r) <= 1 && Math.abs(c - flag.c) <= 1;

            const alreadyTookDmg = qStats.flagSpiritDamageTakenThisTurn?.has(unit.id);
            if (!wasInZone && isInZone && !alreadyTookDmg) {
                const kDmg = 3;
                newHp = Math.max(0, newHp - kDmg);
                addLog('log_attack_hit', 'combat', { attacker: '旗靈領域', target: getUnitName(unit.type), dmg: kDmg }, enemyPlayerId);

                if (!qStats.flagSpiritDamageTakenThisTurn) qStats.flagSpiritDamageTakenThisTurn = new Set();
                qStats.flagSpiritDamageTakenThisTurn = new Set(qStats.flagSpiritDamageTakenThisTurn);
                qStats.flagSpiritDamageTakenThisTurn.add(unit.id);
            }
        }

        let dmg = 0;
        if (activeMineIndex !== -1 && mineToTrigger) {
            const mine = mineToTrigger;
            if (mine.type === MineType.CHAIN && mine.owner !== unit.owner && (!mine.immuneUnitIds || !mine.immuneUnitIds.includes(unit.id))) {
                mineTriggered = true;
                mineOwnerId = mine.owner;
                let chainHitDmg = 6;
                // Defuser reduction for initial hit
                if (unit.type === UnitType.DEFUSER) {
                    chainHitDmg = Math.floor(chainHitDmg * 0.5);
                }
                dmg = chainHitDmg;
                addLog('log_hit_mine', 'mine', { unit: getUnitName(unit.type), dmg: chainHitDmg }, unit.owner);

                // Only chain to NORMAL mines within 5x5 range
                const normalMinesInRange = newMines.filter(m =>
                    m.id !== mine.id &&
                    m.type === MineType.NORMAL &&
                    Math.abs(m.r - r) <= 2 &&
                    Math.abs(m.c - c) <= 2
                );

                // Each chained normal mine explodes in 3x3 range for 6 damage to enemy units
                normalMinesInRange.forEach(nm => {
                    addLog('log_evol_mkr_chain', 'mine', { r: nm.r + 1, c: nm.c + 1 }, mine.owner);
                    addVFX('explosion', nm.r, nm.c); // Show normal explosion for secondary mines

                    // Find enemy units in 3x3 range around this normal mine
                    const enemyPlayer = mine.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                    state.players[enemyPlayer].units.forEach((u: Unit) => {
                        if (!u.isDead && Math.abs(u.r - nm.r) <= 1 && Math.abs(u.c - nm.c) <= 1) {
                            const vuln = u.status.mineVulnerability || 0;
                            let aoeDmg = 6;
                            // Defuser reduction for AOE hit
                            if (u.type === UnitType.DEFUSER) {
                                aoeDmg = Math.floor(aoeDmg * 0.5);
                            }

                            if (u.id === unit.id) {
                                // Accumulate damage for the triggering unit (handled by newHp later)
                                dmg += (aoeDmg + vuln);
                            } else {
                                // Apply immediate damage to other units
                                u.hp = Math.max(0, u.hp - (aoeDmg + vuln));
                            }
                            addLog('log_chain_aoe', 'mine', { unit: getUnitName(u.type), dmg: aoeDmg }, u.owner);
                        }
                    });
                });

                // Remove all chained normal mines
                newMines = newMines.filter(m => !normalMinesInRange.includes(m) && m.id !== mine.id);

                // Main Chain Pulse VFX
                addVFX('chain', r, c, 'large');
            } else {
                const result = calculateMineInteraction(unit, state.mines, r, c, state.players[unit.owner], unit.r, unit.c);
                if (result.triggered || result.isNukeTriggered) {
                    mineTriggered = true;
                    mineOwnerId = result.mineOwnerId;
                    dmg = result.damage;
                    appliedStatus = { ...appliedStatus, ...result.statusUpdates };
                    newMaxHp += result.newMaxHpBonus;
                    newHp = Math.min(newMaxHp, newHp + result.healAmount);
                    reflectDmg = result.reflectedDamage;
                    newSmokes.push(...result.createdSmokes);
                    result.logKeys.forEach(k => {
                        if (k === 'log_smoke_deployed') {
                            addLog(k, 'error', { r: r + 1, c: c + 1 });
                        } else {
                            addLog(k, 'evolution');
                        }
                    });
                    if (unit.type !== UnitType.DEFUSER) qStats.triggeredMineThisRound = true;
                    if (result.isNukeTriggered) {
                        const nukeBlastDamage = 12;
                        newMines = newMines.filter(m => !(Math.abs(m.r - mine.r) <= 1 && Math.abs(m.c - mine.c) <= 1));
                        currentBuildings = currentBuildings.filter(b => !(Math.abs(b.r - mine.r) <= 1 && Math.abs(b.c - mine.c) <= 1));
                        const allUnits = [...state.players[PlayerID.P1].units, ...state.players[PlayerID.P2].units];
                        allUnits.forEach(targetUnit => {
                            if (!targetUnit.isDead && Math.abs(targetUnit.r - mine.r) <= 1 && Math.abs(targetUnit.c - mine.c) <= 1) {
                                if (targetUnit.id === unit.id) return;

                                let damageToApply = nukeBlastDamage;
                                if (targetUnit.owner === mine.owner) {
                                    damageToApply = 6; // Friendly fire takes half damage
                                }
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

                    // Trigger VFX based on mine type
                    if (result.isNukeTriggered) {
                        addVFX('nuke', mine.r, mine.c);
                    } else if (mine.type === MineType.SMOKE) {
                        addVFX('smoke', mine.r, mine.c);
                    } else if (mine.type === MineType.SLOW) {
                        addVFX('slow', mine.r, mine.c);
                    } else {
                        addVFX('explosion', mine.r, mine.c);
                    }

                    addLog('log_hit_mine', 'mine', { unit: getUnitName(unit.type), dmg }, unit.owner);
                }
            }
        }

        if (unit.type === UnitType.RANGER) {
            qStats.rangerSteps += 1;
        }
        if (unit.hasFlag) {
            qStats.generalFlagSteps += 1;
        }
        if (mineTriggered && unit.type === UnitType.DEFUSER) {
            qStats.defuserMinesSoaked += 1;
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
                    status: (unit.type === UnitType.RANGER &&
                        prevPlayerState.evolutionLevels[UnitType.RANGER].b >= 3 &&
                        prevPlayerState.evolutionLevels[UnitType.RANGER].bVariant === 1 &&
                        !mineTriggered)
                        ? { ...appliedStatus, isStealthed: true }
                        : appliedStatus,
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

            // Increment maker trigger stats for the mine OWNER
            if (mineTriggered && mineOwnerId) {
                if (mineOwnerId === PlayerID.P1) {
                    finalP1 = { ...finalP1, questStats: { ...finalP1.questStats, makerMinesTriggeredByEnemy: finalP1.questStats.makerMinesTriggeredByEnemy + 1 } };
                } else {
                    finalP2 = { ...finalP2, questStats: { ...finalP2.questStats, makerMinesTriggeredByEnemy: finalP2.questStats.makerMinesTriggeredByEnemy + 1 } };
                }
            }

            const pId = unit.owner;
            const movingPlayerState = pId === PlayerID.P1 ? finalP1 : finalP2;
            const finalPState = {
                ...movingPlayerState,
                energy: prevPlayerState.energy - totalCost,
                questStats: pId === PlayerID.P1 ? finalP1.questStats : finalP2.questStats, // Use current stats if updated above
                flagPosition: (unit.hasFlag) ? { r, c } : prevPlayerState.flagPosition,
                movesMadeThisTurn: prevPlayerState.movesMadeThisTurn + 1,
                flagMovesMadeThisTurn: (unit.hasFlag && unit.type === UnitType.GENERAL) ? prevPlayerState.flagMovesMadeThisTurn + 1 : prevPlayerState.flagMovesMadeThisTurn,
                nonGeneralFlagMovesMadeThisTurn: (unit.hasFlag && unit.type !== UnitType.GENERAL) ? prevPlayerState.nonGeneralFlagMovesMadeThisTurn + 1 : prevPlayerState.nonGeneralFlagMovesMadeThisTurn,
            };

            // Re-apply the specific unit-move-related qStats updates to the moving player
            finalPState.questStats = {
                ...finalPState.questStats,
                ...qStats // Includes rangerSteps, generalFlagSteps, defuserMinesSoaked
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
                players: { [PlayerID.P1]: finalP1, [PlayerID.P2]: finalP2 },
                lastActionTime: Date.now(),
                isTimeFrozen: prev.isTimeFrozen || true  // Maintain freeze if already frozen
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
                    if (genLevelA >= 1) { newStatus.mineVulnerability = 2; }
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
                players: { ...prev.players, [attacker.owner]: { ...pStats, energy: pStats.energy - cost, energyFromKills: pStats.energyFromKills + killReward, questStats: { ...pStats.questStats, generalDamage: pStats.questStats.generalDamage + dmg }, units: updatedAttackerUnits }, [targetUnit.owner]: { ...tStats, units: updatedTargetUnits, flagPosition: newFlagPos } },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_attack_hit', 'combat', { attacker: getUnitName(attacker.type), target: getUnitName(targetUnit.type), dmg }, attacker.owner);
        if (genLevelA >= 1) {
            addLog('log_evol_gen_a_mine_vuln', 'evolution', { unit: getUnitName(targetUnit.type) }, targetUnit.owner);
        }
        if (genLevelA >= 2) {
            addLog('log_evol_gen_a_heavy_steps_temp', 'evolution', { unit: getUnitName(targetUnit.type) }, targetUnit.owner);
        }
        if (killReward > 0) addLog('log_kill_reward', 'info', { amount: killReward });
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
            return { ...prev, activeUnitId: unit.id, players: { ...prev.players, [unit.owner]: { ...p, units: p.units.map(u => u.id === unit.id ? { ...u, hasFlag: true } : u) } }, lastActionTime: Date.now(), isTimeFrozen: true };
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
            return { ...prev, activeUnitId: unit.id, players: { ...prev.players, [unit.owner]: { ...p, units: p.units.map(u => u.id === unit.id ? { ...u, hasFlag: false } : u), flagPosition: { r: unit.r, c: unit.c } } }, lastActionTime: Date.now(), isTimeFrozen: true };
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

        if (Math.abs(unit.r - r) + Math.abs(unit.c - c) > 3) return;

        // Smoke Check
        const isSmoked = state.smokes.some(s => s.r === r && s.c === c && s.owner !== unit.owner);
        let isHubSmoke = false;
        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        // Check for specific Ranger building smoke (A 3-1)
        const enemyHubs = state.buildings.filter(b => b.owner === enemyId && b.type === 'hub' && b.level === 3 && b.variant === 1);
        if (enemyHubs.some(b => Math.abs(b.r - r) <= 1 && Math.abs(b.c - c) <= 1)) {
            isHubSmoke = true;
        }

        if (isSmoked || isHubSmoke) {
            addLog('log_scan_smoke_blocked', 'error');
            return;
        }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            let markedCount = 0;
            const newMines = prev.mines.map(m => {
                if (Math.abs(m.r - r) + Math.abs(m.c - c) <= 3) {
                    if (!m.revealedTo.includes(unit.owner)) { markedCount++; return { ...m, revealedTo: [...m.revealedTo, unit.owner] }; }
                }
                return m;
            });
            const qStats = { ...p.questStats, sweeperMinesMarked: p.questStats.sweeperMinesMarked + markedCount };
            return { ...prev, mines: newMines, players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, questStats: qStats, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } }, lastActionTime: Date.now(), isTimeFrozen: true };
        });
        addLog('log_scan_action', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        // handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePlaceMineAction = useCallback((unit: Unit, targetR: number, targetC: number, mineType: MineType) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;

        const factories = state.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const isInFactoryRange = factories.some(f => Math.max(Math.abs(f.r - targetR), Math.abs(f.c - targetC)) <= (f.level >= 2 ? 2 : 1));
        const currentMinesCount = state.mines.filter(m => m.owner === unit.owner).length;

        // Range Check: Maker can place mines in cardinal directions (up, down, left, right) + self
        const manhattanDist = Math.abs(unit.r - targetR) + Math.abs(unit.c - targetC);
        const chebyshevDist = Math.max(Math.abs(unit.r - targetR), Math.abs(unit.c - targetC));

        let isTargetable = false;
        if (manhattanDist <= 1) isTargetable = true; // Base cardinal + self
        if (mkrLevelB >= 1 && chebyshevDist <= 1) isTargetable = true; // Path B1: Expaned to 3x3 square
        if (isInFactoryRange) isTargetable = true; // Remote placement via Factory

        if (!isTargetable) {
            addLog('log_maker_range', 'error');
            return;
        }


        // Territory restriction removed - Maker can place mines anywhere

        // Occupancy & Obstacle Check
        const cell = state.cells[targetR][targetC];
        const unitInCell = state.players[PlayerID.P1].units.find(u => u.r === targetR && u.c === targetC && !u.isDead) ||
            state.players[PlayerID.P2].units.find(u => u.r === targetR && u.c === targetC && !u.isDead);
        // Only check for own mines - allow placing on enemy mines
        const ownMineInCell = state.mines.find(m => m.r === targetR && m.c === targetC && m.owner === unit.owner);

        if (cell.isObstacle || unitInCell || ownMineInCell) {
            addLog('log_obstacle', 'error');
            return;
        }

        // Use the passed mine type instead of potentially stale selectedMineType from scope
        const effectiveMineType = mineType;

        // Evolution Level Check for Special Mines
        const mkrLevelA = player.evolutionLevels[UnitType.MAKER].a;
        const mkrVariantA = player.evolutionLevels[UnitType.MAKER].aVariant;
        if (effectiveMineType === MineType.SLOW && mkrLevelA < 1) { addLog('log_low_energy_evolve', 'error'); return; }
        if (effectiveMineType === MineType.SMOKE && mkrLevelA < 2) { addLog('log_low_energy_evolve', 'error'); return; }
        if (effectiveMineType === MineType.CHAIN && (mkrLevelA < 3 || mkrVariantA !== 1)) { addLog('log_low_energy_evolve', 'error'); return; }
        if (effectiveMineType === MineType.NUKE && (mkrLevelA < 3 || mkrVariantA !== 2)) { addLog('log_low_energy_evolve', 'error'); return; }

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
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        addLog('log_mine_placed', 'mine', { r: targetR + 1, c: targetC + 1 }, unit.owner);
        setTargetMode(null);
        setSelectedMineType(MineType.NORMAL);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, setTargetMode, setSelectedMineType]);


    const handlePlaceTower = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const cost = getEnemyTerritoryEnergyCost(unit, 10);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const swpLevelA = p.evolutionLevels[UnitType.MINESWEEPER].a;
            const variantA = p.evolutionLevels[UnitType.MINESWEEPER].aVariant;
            const towerLimit = (swpLevelA === 3 && variantA === 1) ? 2 : 1;
            const existingTowers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            if (existingTowers.length >= towerLimit) { addLog('log_max_buildings', 'error'); return prev; }

            const newBuilding: Building = {
                id: `tower-${unit.owner}-${Date.now()}`,
                type: 'tower',
                owner: unit.owner, r, c,
                level: swpLevelA,
                duration: swpLevelA === 1 ? 2 : undefined
            };
            return {
                ...prev,
                buildings: [...prev.buildings, newBuilding],
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_built_tower', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePlaceFactory = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const cost = getEnemyTerritoryEnergyCost(unit, 15);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const mkrLevelB = p.evolutionLevels[UnitType.MAKER].b;
            const existing = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
            if (existing.length >= 1) { addLog('log_max_buildings', 'error'); return prev; }

            const newBuilding: Building = {
                id: `factory-${unit.owner}-${Date.now()}`,
                type: 'factory',
                owner: unit.owner, r, c, level: mkrLevelB
            };
            return {
                ...prev,
                buildings: [...prev.buildings, newBuilding],
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_built_factory', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePlaceHub = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const cost = getEnemyTerritoryEnergyCost(unit, 12);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const rngLevelA = p.evolutionLevels[UnitType.RANGER].a;
            const existing = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'hub');
            if (existing.length >= 1) { addLog('log_max_buildings', 'error'); return prev; }

            const newBuilding: Building = {
                id: `hub-${unit.owner}-${Date.now()}`,
                type: 'hub',
                owner: unit.owner, r, c, level: rngLevelA
            };
            return {
                ...prev,
                buildings: [...prev.buildings, newBuilding],
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_built_hub', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handleTeleportToHub = useCallback((unit: Unit) => {
        const state = gameStateRef.current;
        const hub = state.buildings.find(b => b.owner === unit.owner && b.type === 'hub');
        if (!hub) return;
        const cost = getEnemyTerritoryEnergyCost(unit, 5);
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const targetCellOccupied = prev.players[PlayerID.P1].units.concat(prev.players[PlayerID.P2].units).some(u => u.r === hub.r && u.c === hub.c && !u.isDead);
            if (targetCellOccupied) { addLog('log_obstacle', 'error'); return prev; }

            return {
                ...prev,
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, r: hub.r, c: hub.c, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, setGameState, handleActionComplete]);

    const handleDisarm = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const mine = state.mines.find(m => m.r === r && m.c === c);
        if (!mine || mine.owner === unit.owner) return;
        const cost = getEnemyTerritoryEnergyCost(unit, 10);
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return {
                ...prev,
                mines: prev.mines.filter(m => m.id !== mine.id),
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p, energy: p.energy - cost,
                        questStats: { ...p.questStats, defuserMinesDisarmed: p.questStats.defuserMinesDisarmed + 1 },
                        units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_mine_disarmed', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, setGameState, handleActionComplete]);

    const handleDetonateTower = useCallback((unit: Unit) => {
        const state = gameStateRef.current;
        const towers = state.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
        if (towers.length === 0) return;
        const cost = getEnemyTerritoryEnergyCost(unit, 15);
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            let detonationCount = 0;
            const newMines = prev.mines.filter(m => {
                const inRange = towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1);
                if (inRange) detonationCount++;
                return !inRange;
            });
            return {
                ...prev,
                mines: newMines,
                players: { ...prev.players, [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) } },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_scan_action', 'mine', { r: unit.r, c: unit.c }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, setGameState, handleActionComplete]);

    const handleRanger = useCallback((_subAction: 'pickup' | 'drop') => {
        addLog('log_committed', 'info');
    }, [addLog]);

    const handleStealth = useCallback((unitId: string) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) return;
        const cost = getEnemyTerritoryEnergyCost(unit, 10);
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p, energy: p.energy - cost,
                        units: p.units.map(u => u.id === unitId ? { ...u, isStealth: true, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_stealth_activated', 'move', { unit: getUnitName(unit.type) }, unit.owner);
        handleActionComplete(unitId);
    }, [gameStateRef, getUnit, addLog, setGameState, handleActionComplete]);

    const handleSensorScan = useCallback((unitId: string, r: number, c: number) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) return;
        const player = state.players[unit.owner];
        const swpB = player.evolutionLevels[UnitType.MINESWEEPER].b;
        const variantB = player.evolutionLevels[UnitType.MINESWEEPER].bVariant;

        const cost = swpB >= 3 ? 3 : (swpB >= 2 ? 4 : 5);
        if (!checkEnergyCap(unit, player, cost)) return;

        const finalCost = (swpB === 3 && variantB === 2) ? 6 : cost;
        if (unit.owner === state.currentPlayer && player.energy < finalCost) return;

        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;

        setGameState(prev => {
            let nextMines = [...prev.mines];
            let nextSensorResults = [...prev.sensorResults];

            const executeAnalysis = (targetR: number, targetC: number, isRevealMode: boolean) => {
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rr = targetR + dr;
                        const cc = targetC + dc;
                        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;

                        const mIdx = nextMines.findIndex(m => m.r === rr && m.c === cc && m.owner === enemyId);
                        if (mIdx !== -1) {
                            count++;
                            if (isRevealMode) {
                                if (!nextMines[mIdx].revealedTo.includes(unit.owner)) {
                                    nextMines[mIdx] = {
                                        ...nextMines[mIdx],
                                        revealedTo: [...nextMines[mIdx].revealedTo, unit.owner]
                                    };
                                }
                            }
                        }
                    }
                }
                if (!isRevealMode) {
                    nextSensorResults.push({ r: targetR, c: targetC, count, owner: unit.owner });
                }
            };

            const isPathB3_2 = swpB === 3 && variantB === 2;
            executeAnalysis(r, c, isPathB3_2);

            if (swpB >= 2) {
                const centerMine = nextMines.find(m => m.r === r && m.c === c && m.owner === enemyId);
                if (centerMine && !centerMine.revealedTo.includes(unit.owner)) {
                    const idx = nextMines.indexOf(centerMine);
                    nextMines[idx] = { ...centerMine, revealedTo: [...centerMine.revealedTo, unit.owner] };
                }
            }

            if (swpB === 3 && variantB === 1) {
                executeAnalysis(unit.r, unit.c, false);
            }

            const nextPlayer = {
                ...prev.players[unit.owner],
                energy: prev.players[unit.owner].energy - finalCost,
                units: prev.players[unit.owner].units.map(u =>
                    u.id === unitId ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + finalCost } : u
                )
            };

            return {
                ...prev,
                mines: nextMines,
                sensorResults: nextSensorResults,
                players: { ...prev.players, [unit.owner]: nextPlayer }
            };
        });

        addVFX('explosion', r, c, 'small');
        addLog('log_action_sensor_scan', 'info', { r, c }, unit.owner);
        setTargetMode(null);
    }, [gameStateRef, getUnit, checkEnergyCap, addLog, setGameState, addVFX, setTargetMode]);


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
            return { ...prev, players: { ...prev.players, [prev.currentPlayer]: { ...p, energy: p.energy - cost, evolutionLevels: newLevels } }, lastActionTime: Date.now(), isTimeFrozen: true };
        });
        addLog('log_evolved', 'evolution', { unit: getUnitName(unitType), branch, level: currentLevel + 1 }, state.currentPlayer);
        if (currentLevel + 1 === 3) setShowEvolutionTree(false);
    }, [gameStateRef, addLog, setGameState, setShowEvolutionTree]);

    return {
        handleCellClick: (_r: number, _c: number) => { },
        attemptMove,
        handleAttack,
        handleMinePlacement: handlePlaceMineAction,
        handleActionComplete,
        handleSkipTurn,
        startNewRound,
        handlePickupFlag,
        handleDropFlag,
        handleScanAction,
        handleSensorScan,
        handleEvolution: handleEvolve,
        handlePlaceTower,
        handlePlaceFactory,
        handlePlaceHub,
        handleTeleportToHub,
        handleDisarm,
        handleDetonateTower,
        handleRanger,
        handleStealth,
    };
};
