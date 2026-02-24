import { useCallback, useRef } from 'react';
import {
    GameState, PlayerID, Unit, Mine, UnitType,
    MineType, GameLog, Coordinates, PlayerState, VFXEffect, TargetMode, Building
} from '../types';
import {
    calculateAttackDamage,
    applyFlagAuraDamageReduction,
    checkEnergyCap as engineCheckEnergyCap,
    calculateEnergyIncome,
    calculateOreReward,
    calculateMineInteraction,
    shouldTriggerMine
} from '../gameEngine';
import {
    ENERGY_CAP_RATIO,
    P1_FLAG_POS, P2_FLAG_POS, TURN_TIMER, THINKING_TIMER,
    EVOLUTION_COSTS, UNIT_STATS, GRID_ROWS, GRID_COLS
} from '../constants';
import {
    getMineBaseCost, getUnitNameKey,
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
    t: (key: string, params?: Record<string, any>) => string;
}


export const usePlayerActions = ({
    setGameState,
    gameStateRef,
    setTargetMode,
    setSelectedMineType,
    setShowEvolutionTree,
    addVFX,
    addLog,
}: UsePlayerActionsProps) => {
    const energyCapWarnedTurnsRef = useRef<Set<string>>(new Set());
    const energyCapWarnedTurnCounterRef = useRef<number>(-1);

    const getLocalizedUnitName = useCallback((type: UnitType) => getUnitNameKey(type), []);

    const getUnit = useCallback((id: string, state: GameState = gameStateRef.current) => {
        const p1Unit = state.players[PlayerID.P1].units.find(u => u.id === id);
        if (p1Unit) return p1Unit;
        return state.players[PlayerID.P2].units.find(u => u.id === id);
    }, [gameStateRef]);

    // getDisplayCost removed as it was unused inside the hook body

    const checkEnergyCap = useCallback((unit: Unit, _player: PlayerState, cost: number) => {
        const state = gameStateRef.current;
        if (energyCapWarnedTurnCounterRef.current !== state.turnCount) {
            energyCapWarnedTurnCounterRef.current = state.turnCount;
            energyCapWarnedTurnsRef.current.clear();
        }

        if (!engineCheckEnergyCap(unit, cost)) {
            // One energy-cap warning per unit-action window to avoid log spam.
            const warnKey = `${state.turnCount}|${unit.owner}|${unit.id}|${unit.startOfActionEnergy}`;
            if (!energyCapWarnedTurnsRef.current.has(warnKey)) {
                energyCapWarnedTurnsRef.current.add(warnKey);
                const cap = Math.floor(unit.startOfActionEnergy * ENERGY_CAP_RATIO);
                addLog('log_energy_cap', 'error', { cap });
            }
            return false;
        }
        return true;
    }, [addLog, gameStateRef]);

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
                        income += calculateOreReward(cell.oreSize, nextTurn);
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
            newQuestStats.sweeperScansThisRound = 0;
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
            const occupiedPositions = new Set<string>();
            units.forEach(unit => {
                if (!unit.isDead) {
                    occupiedPositions.add(`${unit.r},${unit.c}`);
                }
            });
            const isPositionAvailable = (r: number, c: number) => (
                !occupiedPositions.has(`${r},${c}`) &&
                !newCells[r][c].isObstacle
            );

            return units.map((u, unitIndex) => {
                if (!u.isDead) {
                    occupiedPositions.delete(`${u.r},${u.c}`);
                }
                const newDuration = Math.max(0, (u.status.moveCostDebuffDuration || 0) - 1);

                // Kirin's Domain Round End Damage
                let roundEndDmg = 0;
                const enemyGenLevels = enemyPlayerState.evolutionLevels[UnitType.GENERAL];
                if (enemyGenLevels.b >= 3 && enemyGenLevels.bVariant === 2 && !u.isDead) { // B3-2
                    const flag = enemyPlayerState.flagPosition;
                    if (Math.abs(u.r - flag.r) <= 1 && Math.abs(u.c - flag.c) <= 1) {
                        roundEndDmg = applyFlagAuraDamageReduction(4, u, playerState).damage;
                        playerLogs.push({
                            turn: nextTurn,
                            messageKey: 'log_attack_hit',
                            params: { attacker: 'evol_gen_b_r3_2', target: getLocalizedUnitName(u.type), dmg: roundEndDmg },
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

                    const isOccupied = !isPositionAvailable(originalSpawnPos.r, originalSpawnPos.c);

                    if (isOccupied) {
                        const candidates: { r: number, c: number }[] = [];
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = originalSpawnPos.r + dr;
                                const nc = originalSpawnPos.c + dc;
                                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
                                    if (isPositionAvailable(nr, nc)) {
                                        candidates.push({ r: nr, c: nc });
                                    }
                                }
                            }
                        }

                        if (candidates.length > 0) {
                            respawnPos = candidates[Math.floor(Math.random() * candidates.length)];
                        } else {
                            const availableSpawns = spawnPositions.filter((pos) =>
                                isPositionAvailable(pos.r, pos.c)
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
                        params: { unit: getLocalizedUnitName(newU.type), r: respawnPos.r + 1, c: respawnPos.c + 1 },
                        type: 'info' as const,
                        owner: playerState.id
                    });
                }
                if (!newU.isDead) {
                    occupiedPositions.add(`${newU.r},${newU.c}`);
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
                    params: { unit: getLocalizedUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
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
                    return { ...u, hp: newHp };
                }
                return u;
            });
        }

        const spawnRoundOres = () => {
            const occupied = new Set<string>();
            [...updatedP1Units, ...updatedP2Units].forEach(u => {
                if (!u.isDead) occupied.add(`${u.r},${u.c}`);
            });
            prevState.buildings.forEach(b => {
                occupied.add(`${b.r},${b.c}`);
            });

            const candidates: Array<{ r: number; c: number }> = [];
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    const cell = newCells[r][c];
                    if (
                        c > 5 &&
                        c < 18 &&
                        !cell.isObstacle &&
                        !cell.isFlagBase &&
                        !cell.hasEnergyOre &&
                        !occupied.has(`${r},${c}`)
                    ) {
                        candidates.push({ r, c });
                    }
                }
            }

            if (candidates.length === 0) return;

            // Guarantee at least one new ore each round; scale up slightly in longer games.
            const spawnCount = Math.min(candidates.length, nextTurn >= 12 ? 2 : 1);
            for (let i = 0; i < spawnCount; i++) {
                const pick = Math.floor(Math.random() * candidates.length);
                const { r, c } = candidates[pick];
                candidates.splice(pick, 1);
                newCells[r][c].hasEnergyOre = true;
                const rand = Math.random();
                newCells[r][c].oreSize = rand < 0.6 ? 'small' : rand < 0.9 ? 'medium' : 'large';
            }
        };

        spawnRoundOres();

        setGameState({
            ...prevState,
            turnCount: nextTurn,
            currentPlayer: PlayerID.P1,
            phase: 'thinking',
            timeLeft: THINKING_TIMER,
            activeUnitId: null,
            selectedUnitId: null,
            cells: newCells,
            mines: prevState.mines,
            buildings: newBuildings,
            smokes: newSmokes,
            movements: [],
            // Count hints last 1 round; mark hints persist until explicitly cleared by board click.
            sensorResults: prevState.sensorResults.filter(sr => {
                if (sr.kind === 'mark') return true;
                return nextTurn - sr.createdTurn < 1;
            }),
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
                        params: { unit: getLocalizedUnitName(unit.type) },
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
                    params: { unit: getLocalizedUnitName(available.type) },
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
                    params: { unit: getLocalizedUnitName(healed.unitType), amount: healed.amount },
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
                        params: { unit: getLocalizedUnitName(unit.type), fromR: movement.from.r + 1, fromC: movement.from.c + 1, toR: movement.to.r + 1, toC: movement.to.c + 1 },
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
                if (player.nonGeneralFlagMovesMadeThisTurn >= 5) { addLog('log_flag_move_limit', 'error', { unit: getLocalizedUnitName(unit.type) }); return; }
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
        let result: any = null; // Hoisted for scope access
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
            const directContactMineIndex = state.mines.findIndex(m =>
                m.r === r &&
                m.c === c &&
                shouldTriggerMine(unit, m, state.players[unit.owner])
            );
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
                const kDmg = applyFlagAuraDamageReduction(2, unit, player, { r, c }).damage;
                newHp = Math.max(0, newHp - kDmg);
                addLog('log_attack_hit', 'combat', { attacker: 'evol_gen_b_r3_2', target: getLocalizedUnitName(unit.type), dmg: kDmg }, enemyPlayerId);

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
                chainHitDmg = applyFlagAuraDamageReduction(chainHitDmg, unit, state.players[unit.owner], { r, c }).damage;
                dmg = chainHitDmg;
                addLog('log_hit_mine', 'mine', { unit: getLocalizedUnitName(unit.type), dmg: chainHitDmg }, unit.owner);

                // Only chain to NORMAL mines within 5x5 range
                const normalMinesInRange = newMines.filter(m =>
                    m.id !== mine.id &&
                    m.type === MineType.NORMAL &&
                    Math.abs(m.r - r) <= 2 &&
                    Math.abs(m.c - c) <= 2
                );

                // Each chained normal mine explodes in Manhattan distance 2 for 8 damage to enemy units
                normalMinesInRange.forEach(nm => {
                    addLog('log_evol_mkr_chain', 'mine', { r: nm.r + 1, c: nm.c + 1 }, mine.owner);
                    addVFX('explosion', nm.r, nm.c, 'large'); // Show normal explosion for secondary mines

                    // Find enemy units in Manhattan distance 2 around this normal mine
                    const enemyPlayer = mine.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
                    state.players[enemyPlayer].units.forEach((u: Unit) => {
                        if (!u.isDead && (Math.abs(u.r - nm.r) + Math.abs(u.c - nm.c) <= 2)) {
                            const vuln = u.status.mineVulnerability || 0;
                            let aoeDmg = 8;
                            // Defuser reduction for AOE hit
                            if (u.type === UnitType.DEFUSER) {
                                aoeDmg = Math.floor(aoeDmg * 0.5);
                            }
                            aoeDmg = applyFlagAuraDamageReduction(aoeDmg, u, state.players[u.owner]).damage;

                            if (u.id === unit.id) {
                                // Accumulate damage for the triggering unit (handled by newHp later)
                                dmg += (aoeDmg + vuln);
                            } else {
                                // Apply damage via victims array to avoid mutating state and handle death properly
                                let currentHp = u.hp;
                                const existingVictim = nukeAoeVictims.find(v => v.unitId === u.id);
                                if (existingVictim) currentHp = existingVictim.newHp;

                                const targetNewHp = Math.max(0, currentHp - (aoeDmg + vuln));
                                const targetIsDead = targetNewHp === 0;
                                const targetRespawnTimer = (targetIsDead && u.type !== UnitType.GENERAL) ? (state.turnCount <= 10 ? 2 : 3) : 0;

                                if (existingVictim) {
                                    existingVictim.newHp = targetNewHp;
                                    existingVictim.isDead = targetIsDead;
                                    existingVictim.respawnTimer = targetRespawnTimer;
                                } else {
                                    nukeAoeVictims.push({
                                        unitId: u.id, owner: u.owner, newHp: targetNewHp, isDead: targetIsDead, respawnTimer: targetRespawnTimer
                                    });
                                }
                            }
                            addLog('log_chain_aoe', 'mine', { unit: getLocalizedUnitName(u.type), dmg: aoeDmg }, u.owner);
                        }
                    });
                });

                // Remove all chained normal mines
                newMines = newMines.filter(m => !normalMinesInRange.includes(m) && m.id !== mine.id);

                // Main Chain Pulse VFX
                addVFX('chain', r, c, 'large');
            } else {
                // Calculate interaction for scope usage
                result = calculateMineInteraction(unit, state.mines, r, c, state.players[unit.owner], unit.r, unit.c);
                if (result.triggered || result.isNukeTriggered) {
                    mineTriggered = true;
                    mineOwnerId = result.mineOwnerId;
                    dmg = result.damage;
                    appliedStatus = { ...appliedStatus, ...result.statusUpdates };
                    newMaxHp += result.newMaxHpBonus;
                    newHp = Math.min(newMaxHp, newHp + result.healAmount);
                    reflectDmg = result.reflectedDamage;
                    newSmokes.push(...result.createdSmokes);
                    result.logKeys.forEach((k: string) => {
                        if (k === 'log_smoke_deployed') {
                            addLog(k, 'error', { r: r + 1, c: c + 1 });
                        } else if (k === 'log_evol_def_a_heal') {
                            addLog(k, 'move', {}, unit.owner); // Blue for P1, Red for P2
                        } else {
                            addLog(k, 'evolution', undefined, unit.owner);
                        }
                    });
                    if (unit.type !== UnitType.DEFUSER) qStats.triggeredMineThisRound = true;
                    if (result.isNukeTriggered) {
                        const nukeBlastDamage = 12;
                        const inNukeBlastRange = (targetR: number, targetC: number) =>
                            (Math.abs(targetR - mine.r) + Math.abs(targetC - mine.c)) <= 2;

                        newMines = newMines.filter(m => m.owner === mine.owner || !inNukeBlastRange(m.r, m.c));
                        currentBuildings = currentBuildings.filter(b => b.owner === mine.owner || !inNukeBlastRange(b.r, b.c));
                        const allUnits = [...state.players[PlayerID.P1].units, ...state.players[PlayerID.P2].units];
                        allUnits.forEach(targetUnit => {
                            if (!targetUnit.isDead && inNukeBlastRange(targetUnit.r, targetUnit.c)) {
                                if (targetUnit.id === unit.id) return;

                                let damageToApply = nukeBlastDamage;
                                if (targetUnit.owner === mine.owner) {
                                    damageToApply = 6; // Friendly fire takes half damage
                                }
                                damageToApply = applyFlagAuraDamageReduction(damageToApply, targetUnit, state.players[targetUnit.owner]).damage;
                                // BUG-3 修復：去重，避免同一單位被重複計傷
                                const existingVictim = nukeAoeVictims.find(v => v.unitId === targetUnit.id);
                                const baseHp = existingVictim ? existingVictim.newHp : targetUnit.hp;
                                const targetNewHp = Math.max(0, baseHp - damageToApply);
                                const targetIsDead = targetNewHp === 0;
                                const targetRespawnTimer = (targetIsDead && targetUnit.type !== UnitType.GENERAL) ? (state.turnCount <= 10 ? 2 : 3) : 0;
                                if (existingVictim) {
                                    existingVictim.newHp = targetNewHp;
                                    existingVictim.isDead = targetIsDead;
                                    existingVictim.respawnTimer = targetRespawnTimer;
                                } else {
                                    nukeAoeVictims.push({ unitId: targetUnit.id, owner: targetUnit.owner, newHp: targetNewHp, isDead: targetIsDead, respawnTimer: targetRespawnTimer });
                                }
                                addLog('log_evol_nuke_blast_hit', 'combat', { unit: getLocalizedUnitName(targetUnit.type), dmg: damageToApply }, mine.owner);
                            }
                        });
                    } else {
                        newMines.splice(newMines.findIndex(m => m.id === mine.id), 1);
                    }

                    // Trigger VFX based on mine type
                    if (result.isNukeTriggered) {
                        addVFX('nuke', mine.r, mine.c, 'large');
                    } else if (mine.type === MineType.SMOKE) {
                        addVFX('smoke', mine.r, mine.c, 'large');
                    } else if (mine.type === MineType.SLOW) {
                        addVFX('slow', mine.r, mine.c, 'large');
                    } else {
                        addVFX('explosion', mine.r, mine.c, 'large');
                    }

                    addLog('log_hit_mine', 'mine', { unit: getLocalizedUnitName(unit.type), dmg }, unit.owner);
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
                // Apply team buffs from Defuser A2 if applicable (Excluding Defuser)
                let uMaxHp = u.maxHp;
                let uHp = u.hp;
                const baseTeamHeal = result?.teamHealAmount || 0;
                const lowHpTeamHeal = result?.teamLowHpHealAmount || baseTeamHeal;

                if (u.type !== UnitType.DEFUSER) {
                    uMaxHp += (result?.teamMaxHpBonus || 0);
                    const teamHealAmount = baseTeamHeal > 0 && uHp < uMaxHp * 0.5 ? lowHpTeamHeal : baseTeamHeal;
                    uHp = Math.min(uMaxHp, uHp + teamHealAmount);
                }

                if (u.id !== unit.id) {
                    return { ...u, maxHp: uMaxHp, hp: uHp };
                }
                const teamHealForActiveUnit = (u.type !== UnitType.DEFUSER)
                    ? (baseTeamHeal > 0 && newHp < uMaxHp * 0.5 ? lowHpTeamHeal : baseTeamHeal)
                    : 0;
                return {
                    ...u, r, c, hp: Math.min(uMaxHp, newHp + teamHealForActiveUnit),
                    maxHp: uMaxHp, isDead,
                    respawnTimer: (newHp <= 0 && unit.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0,
                    hasFlag: unit.hasFlag, hasActedThisRound: false,
                    energyUsedThisTurn: u.energyUsedThisTurn + totalCost,
                    carriedMine: u.carriedMine ? { ...u.carriedMine, r, c } : u.carriedMine,
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
                        const reflected = applyFlagAuraDamageReduction(reflectDmg, target, prev.players[enemyId]);
                        const newEnemyHp = Math.max(0, target.hp - reflected.damage);
                        const isEnemyDead = newEnemyHp === 0;
                        const enemyUpdatedUnits = enemyState.units.map(u => u.id === target.id ? { ...u, hp: newEnemyHp, isDead: isEnemyDead, respawnTimer: (isEnemyDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0 } : u);
                        playersUpdates[enemyId] = { ...enemyState, units: enemyUpdatedUnits };
                        addLog('log_evol_def_reflect_hit', 'move', { unit: getLocalizedUnitName(target.type), dmg: reflected.damage }, unit.owner);
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
            let finalPState = {
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

            // Keep carried mine visibility private by default.
            finalPState = {
                ...finalPState,
                units: finalPState.units.map((u: Unit) =>
                    u.id === unit.id
                        ? { ...u, carriedMineRevealed: false }
                        : u)
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
                addLog('log_unit_died', 'info', { unit: getLocalizedUnitName(unit.type), rounds: prev.turnCount <= 10 ? 2 : 3 }, unit.owner);
            }

            // 將軍死亡 = 遊戲結束
            let generalDied = isDead && unit.type === UnitType.GENERAL;
            let winnerFromGeneralDeath: PlayerID | null = null;
            if (generalDied) {
                winnerFromGeneralDeath = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            }

            // 檢查 Nuke AOE 是否殺死了將軍
            let nukeKilledP1General = false;
            let nukeKilledP2General = false;
            nukeAoeVictims.forEach(v => {
                const victimUnit = [...finalP1.units, ...finalP2.units].find((u: Unit) => u.id === v.unitId);
                if (victimUnit && victimUnit.type === UnitType.GENERAL && v.isDead) {
                    generalDied = true;
                    if (v.owner === PlayerID.P1) nukeKilledP1General = true;
                    else nukeKilledP2General = true;
                }
            });
            // BUG-4 修復：兩方將軍同時死於 Nuke → 平手
            if (nukeKilledP1General && nukeKilledP2General) {
                winnerFromGeneralDeath = null; // 平手
            } else if (nukeKilledP1General) {
                winnerFromGeneralDeath = PlayerID.P2;
            } else if (nukeKilledP2General) {
                winnerFromGeneralDeath = PlayerID.P1;
            }

            return {
                ...prev, activeUnitId: unit.id, mines: newMines, smokes: newSmokes, buildings: currentBuildings,
                movements: [...prev.movements, { unitId: unit.id, from: { r: unit.r, c: unit.c }, to: { r, c }, energy: totalCost }],
                players: { [PlayerID.P1]: finalP1, [PlayerID.P2]: finalP2 },
                lastActionTime: Date.now(),
                isTimeFrozen: true,
                gameOver: generalDied || prev.gameOver,
                winner: generalDied ? winnerFromGeneralDeath : prev.winner
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

        const isFlagA31Attack = attacker.hasFlag && genLevelA >= 3 && genVariantA === 1;
        const baseAttackCost = isFlagA31Attack ? 6 : UNIT_STATS[UnitType.GENERAL].attackCost;
        const cost = getEnemyTerritoryEnergyCost(attacker, baseAttackCost);
        const player = state.players[attacker.owner];
        if (player.energy < cost) { addLog('log_low_energy_attack', 'info'); return; }

        if (!checkEnergyCap(attacker, player, cost)) return;

        const { damage: dmg, logKey } = calculateAttackDamage(attacker, targetUnit, state.players[attacker.owner], state.players[targetUnit.owner], false);
        if (logKey) addLog(logKey, 'evolution', undefined, targetUnit.owner);

        let isDead = targetUnit.hp - dmg <= 0;
        let killReward = isDead ? 3 + Math.floor(state.players[targetUnit.owner].energy * 0.15) : 0;
        const previousMineVulnerability = targetUnit.status.mineVulnerability ?? 0;
        const nextMineVulnerability = genLevelA >= 1
            ? Math.min(2, previousMineVulnerability + 1)
            : previousMineVulnerability;
        const mineVulnerabilityIncreased =
            previousMineVulnerability < 2 &&
            nextMineVulnerability > previousMineVulnerability;
        const heavyStepsAlreadyActive =
            (targetUnit.status.moveCostDebuff ?? 0) > 0 &&
            (targetUnit.status.moveCostDebuffDuration ?? 0) > 0;

        setGameState(prev => {
            const pStats = prev.players[attacker.owner];
            const tStats = prev.players[targetUnit.owner];
            const attackerHeal = isFlagA31Attack ? 4 : 0;
            const isA32Dash = genLevelA === 3 && genVariantA === 2;
            const dirR = Math.sign(targetUnit.r - attacker.r);
            const dirC = Math.sign(targetUnit.c - attacker.c);

            const allUnits = [...prev.players[PlayerID.P1].units, ...prev.players[PlayerID.P2].units];
            const isOccupiedExcluding = (r: number, c: number, excludedIds: string[]) =>
                allUnits.some(ou => !ou.isDead && !excludedIds.includes(ou.id) && ou.r === r && ou.c === c);

            let targetFinalR = targetUnit.r;
            let targetFinalC = targetUnit.c;
            if (isA32Dash && !isDead) {
                // Push enemy up to 2 tiles, stopping at edge/obstacle/occupied.
                for (let step = 0; step < 2; step++) {
                    const nextR = targetFinalR + dirR;
                    const nextC = targetFinalC + dirC;
                    if (nextR < 0 || nextR >= GRID_ROWS || nextC < 0 || nextC >= GRID_COLS) break;
                    if (prev.cells[nextR][nextC].isObstacle) break;
                    if (isOccupiedExcluding(nextR, nextC, [targetUnit.id])) break;
                    targetFinalR = nextR;
                    targetFinalC = nextC;
                }
            }

            let attackerFinalR = attacker.r;
            let attackerFinalC = attacker.c;
            if (isA32Dash) {
                // A3-2: General ends one tile in front of enemy (along attack direction).
                // If target died, keep old behavior and step into target's original tile.
                const desiredR = isDead ? targetUnit.r : (targetFinalR - dirR);
                const desiredC = isDead ? targetUnit.c : (targetFinalC - dirC);
                const inBounds = desiredR >= 0 && desiredR < GRID_ROWS && desiredC >= 0 && desiredC < GRID_COLS;
                const blocked = !inBounds ||
                    prev.cells[desiredR][desiredC].isObstacle ||
                    isOccupiedExcluding(desiredR, desiredC, [attacker.id, targetUnit.id]);
                if (!blocked) {
                    attackerFinalR = desiredR;
                    attackerFinalC = desiredC;
                }
            }

            const updatedTargetUnits = tStats.units.map(u => {
                if (u.id === targetUnit.id) {
                    let newStatus = { ...u.status };
                    if (genLevelA >= 1) {
                        const currentMineVulnerability = newStatus.mineVulnerability ?? 0;
                        newStatus.mineVulnerability = Math.min(2, currentMineVulnerability + 1);
                    }
                    if (genLevelA >= 2) {
                        // General A2 uses a flat +2 move-cost debuff (not doubling),
                        // lasting this round and next round.
                        newStatus.moveCostDebuff = Math.max(newStatus.moveCostDebuff ?? 0, 2);
                        newStatus.moveCostDebuffDuration = Math.max(newStatus.moveCostDebuffDuration ?? 0, 2);
                    }
                    return { ...u, hp: Math.max(0, u.hp - dmg), isDead: u.hp - dmg <= 0, r: targetFinalR, c: targetFinalC, hasFlag: false, respawnTimer: (u.hp - dmg <= 0 && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0, status: newStatus };
                }
                return u;
            });

            const updatedAttackerUnits = pStats.units.map(u => u.id === attacker.id ? { ...u, r: isA32Dash ? attackerFinalR : u.r, c: isA32Dash ? attackerFinalC : u.c, hp: Math.min(u.maxHp, u.hp + attackerHeal), energyUsedThisTurn: u.energyUsedThisTurn + cost } : u);
            let newFlagPos = (targetUnit.hasFlag && isDead) ? { r: targetUnit.r, c: targetUnit.c } : tStats.flagPosition;
            let gameOver = isDead && targetUnit.type === UnitType.GENERAL;

            return {
                ...prev, gameOver, winner: gameOver ? attacker.owner : prev.winner,
                players: { ...prev.players, [attacker.owner]: { ...pStats, energy: pStats.energy - cost, energyFromKills: pStats.energyFromKills + killReward, questStats: { ...pStats.questStats, generalDamage: pStats.questStats.generalDamage + dmg }, units: updatedAttackerUnits }, [targetUnit.owner]: { ...tStats, units: updatedTargetUnits, flagPosition: newFlagPos } },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        addLog('log_attack_hit', 'combat', { attacker: getLocalizedUnitName(attacker.type), target: getLocalizedUnitName(targetUnit.type), dmg }, attacker.owner);
        if (isFlagA31Attack) {
            addLog('log_evol_gen_a_heal', 'evolution', undefined, attacker.owner);
        }
        if (genLevelA === 3 && genVariantA === 2) {
            addLog('log_evol_gen_a_knockback', 'evolution', undefined, attacker.owner);
        }
        if (genLevelA >= 1 && mineVulnerabilityIncreased) {
            addLog('log_evol_gen_a_mine_vuln', 'evolution', {
                unit: getLocalizedUnitName(targetUnit.type),
                stacks: nextMineVulnerability
            }, targetUnit.owner);
        }
        if (genLevelA >= 2 && !heavyStepsAlreadyActive) {
            addLog('log_evol_gen_a_heavy_steps_temp', 'evolution', { unit: getLocalizedUnitName(targetUnit.type) }, targetUnit.owner);
        }
        if (killReward > 0) addLog('log_kill_reward', 'info', { amount: killReward });
    }, [gameStateRef, getUnit, addLog, checkEnergyCap, setGameState, handleActionComplete]);

    const handlePickupFlag = useCallback(() => {
        const state = gameStateRef.current;
        const unit = state.selectedUnitId ? getUnit(state.selectedUnitId) : null;
        if (!unit) return;
        if (unit.hasFlag) return;
        if (unit.hasActedThisRound) return; // BUG-2 修復：已行動過的單位不得拿旗
        const player = state.players[unit.owner];
        const genLevelB = player.evolutionLevels[UnitType.GENERAL].b;
        const genVariantB = player.evolutionLevels[UnitType.GENERAL].bVariant;
        if (!(unit.type === UnitType.GENERAL || (genLevelB >= 3 && genVariantB === 1))) return;
        if (unit.r !== player.flagPosition.r || unit.c !== player.flagPosition.c) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return { ...prev, activeUnitId: unit.id, players: { ...prev.players, [unit.owner]: { ...p, units: p.units.map(u => u.id === unit.id ? { ...u, hasFlag: true } : u) } }, lastActionTime: Date.now(), isTimeFrozen: true };
        });
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
        addLog('log_flag_drop', 'move', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
    }, [gameStateRef, getUnit, setGameState, addLog]);

    const handleScanAction = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const scanUses = player.questStats.sweeperScansThisRound || 0;
        const baseCost = scanUses >= 2 ? 4 : 3;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        if (Math.abs(unit.r - r) + Math.abs(unit.c - c) > 3) {
            addLog('log_scan_range', 'info');
            return;
        }

        // Smoke Check
        const isSmoked = state.smokes.some(s => s.r === r && s.c === c && s.owner !== unit.owner);
        let isHubSmoke = false;
        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
        // Check for specific Ranger building smoke (A 3-1)
        const enemyHubs = state.buildings.filter(b => b.owner === enemyId && b.type === 'hub' && b.level === 3 && b.variant === 1);
        if (enemyHubs.some(b => (Math.abs(b.r - r) + Math.abs(b.c - c) <= 2))) {
            isHubSmoke = true;
        }

        if (isSmoked || isHubSmoke) {
            addLog('log_scan_smoke_blocked', 'error');
            return;
        }

        const markSuccess = state.mines.some(m => m.r === r && m.c === c && m.owner === enemyId);
        setGameState(prev => {
            const p = prev.players[unit.owner];
            const enemyPlayerId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            let hasEnemyMine = false;
            const nextMines = prev.mines.map(m => {
                if (m.r === r && m.c === c && m.owner === enemyPlayerId) {
                    hasEnemyMine = true;
                    if (!m.revealedTo.includes(unit.owner)) {
                        return { ...m, revealedTo: [...m.revealedTo, unit.owner] };
                    }
                }
                return m;
            });
            const nextSensorResults = [
                ...prev.sensorResults.filter(sr => !(sr.kind === 'mark' && sr.owner === unit.owner && sr.r === r && sr.c === c)),
                {
                    r,
                    c,
                    count: hasEnemyMine ? 1 : 0,
                    kind: 'mark' as const,
                    success: hasEnemyMine,
                    owner: unit.owner,
                    createdTurn: prev.turnCount
                }
            ];
            const qStats = {
                ...p.questStats,
                sweeperMinesMarked: p.questStats.sweeperMinesMarked + (hasEnemyMine ? 1 : 0),
                sweeperScansPerformed: (p.questStats.sweeperScansPerformed || 0) + 1,
                sweeperScansThisRound: (p.questStats.sweeperScansThisRound || 0) + 1
            };
            return {
                ...prev,
                mines: nextMines,
                sensorResults: nextSensorResults,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        questStats: qStats,
                        units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        addLog(markSuccess ? 'log_scan_mark_success' : 'log_scan_mark_fail', 'move', { r: r + 1, c: c + 1 }, unit.owner);
        // handleActionComplete(unit.id);
    }, [gameStateRef, addLog, checkEnergyCap, setGameState]);



    const handlePlaceMineAction = useCallback((unit: Unit, targetR: number, targetC: number, mineType: MineType) => {
        const state = gameStateRef.current;
        const player = state.players[unit.owner];
        const mkrLevelB = player.evolutionLevels[UnitType.MAKER].b;
        const mkrVariantB = player.evolutionLevels[UnitType.MAKER].bVariant;

        const factories = state.buildings.filter(b => b.owner === unit.owner && b.type === 'factory');
        const isInFactoryRange = factories.some(f => {
            if (f.level >= 2) {
                return Math.abs(f.r - targetR) + Math.abs(f.c - targetC) <= 2;
            }
            return Math.max(Math.abs(f.r - targetR), Math.abs(f.c - targetC)) <= 1;
        });
        // Range Check: Maker can place mines in cardinal directions (up, down, left, right) + self.
        // Keep Factory remote placement rules unchanged.
        const manhattanDist = Math.abs(unit.r - targetR) + Math.abs(unit.c - targetC);

        let isTargetable = manhattanDist <= 1; // Base cardinal + self
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
        const ownMineInCell = state.mines.find(m => m.r === targetR && m.c === targetC && m.owner === unit.owner);
        const revealedEnemyMineInCell = state.mines.find(m =>
            m.r === targetR &&
            m.c === targetC &&
            m.owner !== unit.owner &&
            m.revealedTo.includes(unit.owner)
        );
        const buildingInCell = state.buildings.find(b => b.r === targetR && b.c === targetC);

        const isSelfCell = unit.r === targetR && unit.c === targetC;
        const blockedByObstacle = cell.isObstacle && !isSelfCell;
        const blockedByOtherUnit = !!unitInCell && unitInCell.id !== unit.id;

        if (blockedByObstacle || blockedByOtherUnit) {
            addLog('log_obstacle', 'error');
            return;
        }
        if (buildingInCell) {
            addLog('log_obstacle', 'error');
            return;
        }
        // Allow stacking only when enemy mine is NOT revealed.
        if (ownMineInCell || revealedEnemyMineInCell) {
            addLog('log_space_has_mine', 'error');
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

        const hasWorkshopDiscount = mkrLevelB === 3 && mkrVariantB === 1 && isInFactoryRange;
        const baseMineCost = hasWorkshopDiscount ? 3 : getMineBaseCost(effectiveMineType);
        const cost = getEnemyTerritoryEnergyCost(unit, baseMineCost);

        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        const defLevelB = player.evolutionLevels[UnitType.DEFUSER].b;
        const defVariantB = player.evolutionLevels[UnitType.DEFUSER].bVariant;

        const ownMines = state.mines.filter(m => m.owner === unit.owner);
        const placedMinesCount = ownMines.filter(m => !m.isConverted).length;
        const totalMinesCount = ownMines.length;

        const maxPlacedLimit = (mkrLevelB === 3) ? (mkrVariantB === 2 ? 5 + factories.length * 2 : 8) : 5 + mkrLevelB;
        const maxTotalLimit = (defLevelB === 3 && defVariantB === 1) ? Math.max(maxPlacedLimit + 1, totalMinesCount) : maxPlacedLimit;

        if (placedMinesCount >= maxPlacedLimit || totalMinesCount >= (maxTotalLimit)) {
            addLog('log_max_mines', 'error');
            return;
        }

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
                sensorResults: prev.sensorResults.filter(sr => !(sr.kind === 'mark' && sr.r === targetR && sr.c === targetC)),
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
        const swpLevelA = player.evolutionLevels[UnitType.MINESWEEPER].a;
        const swpVariantA = player.evolutionLevels[UnitType.MINESWEEPER].aVariant;
        const baseCost = (swpLevelA === 3 && swpVariantA === 1) ? 5 : 6;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
            const swpLevelA = p.evolutionLevels[UnitType.MINESWEEPER].a;
            const variantA = p.evolutionLevels[UnitType.MINESWEEPER].aVariant;
            const towerLimit = (swpLevelA === 3 && variantA === 1) ? 2 : 1;
            const existingTowers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            let filteredBuildings = prev.buildings;
            if (existingTowers.length >= towerLimit) {
                const toRemove = existingTowers[0];
                filteredBuildings = filteredBuildings.filter(b => b.id !== toRemove.id);
            }

            const newBuilding: Building = {
                id: `tower-${unit.owner}-${Date.now()}`,
                type: 'tower',
                owner: unit.owner, r, c,
                level: swpLevelA,
                duration: swpLevelA === 1 ? 2 : undefined
            };
            return {
                ...prev,
                buildings: [...filteredBuildings, newBuilding],
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
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
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
        const cost = getEnemyTerritoryEnergyCost(unit, 4);
        if (player.energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, player, cost)) return;

        setGameState(prev => {
            const p = prev.players[unit.owner];
            if (prev.mines.some(m => m.r === r && m.c === c)) return prev;
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

            // BUG-5 修復：傳送落點有敵方地雷時，觸發地雷傷害
            const mineResult = calculateMineInteraction(unit, prev.mines, hub.r, hub.c, p, unit.r, unit.c);
            let newMines = prev.mines;
            let mineTriggeredDmg = 0;
            if (mineResult.triggered || mineResult.isNukeTriggered) {
                mineTriggeredDmg = mineResult.damage;
                newMines = prev.mines.filter((_, idx) => idx !== prev.mines.findIndex(m => m.r === hub.r && m.c === hub.c && m.owner !== unit.owner));
            }

            const newHp = Math.max(0, unit.hp - mineTriggeredDmg);
            const isDead = newHp <= 0;

            return {
                ...prev,
                mines: newMines,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: p.energy - cost,
                        units: p.units.map(u => u.id === unit.id
                            ? {
                                ...u,
                                r: hub.r,
                                c: hub.c,
                                hp: newHp,
                                isDead,
                                respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0,
                                carriedMine: u.carriedMine ? { ...u.carriedMine, r: hub.r, c: hub.c } : u.carriedMine,
                                energyUsedThisTurn: u.energyUsedThisTurn + cost
                            }
                            : u)
                    }
                },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });

        // Log mine trigger if any
        const freshState = gameStateRef.current;
        const mineAtHub = freshState.mines.find(m => m.r === hub.r && m.c === hub.c && m.owner !== unit.owner);
        if (mineAtHub) {
            addLog('log_hit_mine', 'mine', { unit: getLocalizedUnitName(unit.type), dmg: '?' }, unit.owner);
        }

        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, setGameState, handleActionComplete]);

    const handleDisarm = useCallback((unit: Unit, r: number, c: number) => {
        const state = gameStateRef.current;
        const mine = state.mines.find(m => m.r === r && m.c === c);
        if (!mine || mine.owner === unit.owner) return;
        const baseCost = (UNIT_STATS[UnitType.DEFUSER] as any).disarmCost ?? 2;
        const cost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, state.players[unit.owner], cost)) return;

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

        const hasEnemyMineInTowerRange = state.mines.some(m =>
            m.owner !== unit.owner &&
            towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
        );
        if (!hasEnemyMineInTowerRange) { addLog('log_no_mine', 'info'); return; }

        const cost = 2;
        if (state.players[unit.owner].energy < cost) { addLog('log_low_energy', 'info', { cost }); return; }
        if (!checkEnergyCap(unit, state.players[unit.owner], cost)) return;
        towers.forEach(t => addVFX('explosion', t.r, t.c, 'large'));
        const minesToBlast = state.mines.filter(m =>
            m.owner !== unit.owner &&
            towers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
        );
        minesToBlast.forEach(m => addVFX('explosion', m.r, m.c));

        setGameState(prev => {
            const p = prev.players[unit.owner];
            const activeTowers = prev.buildings.filter(b => b.owner === unit.owner && b.type === 'tower');
            const minesToRemove = new Set(prev.mines.filter(m =>
                m.owner !== unit.owner &&
                activeTowers.some(t => Math.abs(m.r - t.r) <= 1 && Math.abs(m.c - t.c) <= 1)
            ).map(m => m.id));

            const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;
            const updatedEnemyUnits = prev.players[enemyId].units.map(u => {
                if (u.isDead) return u;
                const inTowerRange = activeTowers.some(t => Math.abs(u.r - t.r) <= 1 && Math.abs(u.c - t.c) <= 1);
                if (!inTowerRange) return u;
                const detonateDmg = applyFlagAuraDamageReduction(3, u, prev.players[enemyId]).damage;
                const newHp = Math.max(0, u.hp - detonateDmg);
                const isDead = newHp === 0;
                return {
                    ...u,
                    hp: newHp,
                    isDead,
                    respawnTimer: (isDead && u.type !== UnitType.GENERAL) ? (prev.turnCount <= 10 ? 2 : 3) : 0
                };
            });

            return {
                ...prev,
                mines: prev.mines.filter(m => !minesToRemove.has(m.id)),
                buildings: prev.buildings.filter(b => !(b.owner === unit.owner && b.type === 'tower')),
                players: {
                    ...prev.players,
                    [unit.owner]: { ...p, energy: p.energy - cost, units: p.units.map(u => u.id === unit.id ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + cost } : u) },
                    [enemyId]: { ...prev.players[enemyId], units: updatedEnemyUnits }
                },
                lastActionTime: Date.now(), isTimeFrozen: true
            };
        });
        addLog('log_evol_swp_detonate', 'mine', { r: unit.r + 1, c: unit.c + 1 }, unit.owner);
        handleActionComplete(unit.id);
    }, [gameStateRef, addLog, addVFX, setGameState, handleActionComplete]);

    const handleRanger = useCallback((_subAction: 'pickup' | 'drop') => {
        return;
    }, []);

    const handleStealth = useCallback((unitId: string) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) return;
        const stealthCost = 3;
        const isActivatingStealth = !unit.status.isStealthed;
        const player = state.players[unit.owner];

        if (isActivatingStealth) {
            if (player.energy < stealthCost) {
                addLog('log_low_energy', 'info', { cost: stealthCost });
                return;
            }
            if (!checkEnergyCap(unit, player, stealthCost)) {
                return;
            }
        }

        setGameState(prev => {
            const p = prev.players[unit.owner];
            return {
                ...prev,
                players: {
                    ...prev.players,
                    [unit.owner]: {
                        ...p,
                        energy: isActivatingStealth ? (p.energy - stealthCost) : p.energy,
                        units: p.units.map(u => u.id === unitId ? {
                            ...u,
                            energyUsedThisTurn: isActivatingStealth ? (u.energyUsedThisTurn + stealthCost) : u.energyUsedThisTurn,
                            status: { ...u.status, isStealthed: !u.status.isStealthed }
                        } : u)
                    }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });
        if (isActivatingStealth) {
            addLog('log_stealth_activated', 'move', { unit: getLocalizedUnitName(unit.type) }, unit.owner);
        }
    }, [gameStateRef, getLocalizedUnitName, getUnit, setGameState, addLog, checkEnergyCap]);

    const handleSensorScan = useCallback((unitId: string, r: number, c: number) => {
        const state = gameStateRef.current;
        const unit = getUnit(unitId, state);
        if (!unit) return;
        const player = state.players[unit.owner];
        const swpB = player.evolutionLevels[UnitType.MINESWEEPER].b;
        const variantB = player.evolutionLevels[UnitType.MINESWEEPER].bVariant;

        // Sensor Scan is a 5x5 target area around caster (Chebyshev <= 2).
        const chebyshevDist = Math.max(Math.abs(unit.r - r), Math.abs(unit.c - c));
        if (chebyshevDist > 2) {
            addLog('log_scan_range', 'info');
            return;
        }

        const baseCost = swpB >= 3 ? 4 : 5;
        const finalCost = getEnemyTerritoryEnergyCost(unit, baseCost);
        if (player.energy < finalCost) {
            addLog('log_low_energy', 'info', { cost: finalCost });
            return;
        }
        if (!checkEnergyCap(unit, player, finalCost)) return;

        const enemyId = unit.owner === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1;

        setGameState(prev => {
            const nextPlayerState = prev.players[unit.owner];
            const nextUnitState = nextPlayerState.units.find(u => u.id === unitId);
            if (!nextUnitState) return prev;

            const nextSwpB = nextPlayerState.evolutionLevels[UnitType.MINESWEEPER].b;
            const nextBaseCost = nextSwpB >= 3 ? 4 : 5;
            const nextFinalCost = getEnemyTerritoryEnergyCost(nextUnitState, nextBaseCost);
            if (nextPlayerState.energy < nextFinalCost) return prev;
            if (!engineCheckEnergyCap(nextUnitState, nextFinalCost)) return prev;

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
                    nextSensorResults.push({ r: targetR, c: targetC, count, kind: 'count', owner: unit.owner, createdTurn: prev.turnCount });
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
                ...nextPlayerState,
                energy: nextPlayerState.energy - nextFinalCost,
                units: nextPlayerState.units.map(u =>
                    u.id === unitId ? { ...u, energyUsedThisTurn: u.energyUsedThisTurn + nextFinalCost } : u
                )
            };

            return {
                ...prev,
                mines: nextMines,
                sensorResults: nextSensorResults,
                players: { ...prev.players, [unit.owner]: nextPlayer }
            };
        });

        addVFX('scan', r, c, 'small');
        addLog('log_action_sensor_scan', 'move', { unit: getLocalizedUnitName(unit.type), r: r + 1, c: c + 1 }, unit.owner);
        setTargetMode(null);
    }, [gameStateRef, getUnit, checkEnergyCap, addLog, setGameState, addVFX, setTargetMode]);


    const handleEvolve = useCallback((unitType: UnitType, branch: 'a' | 'b', variant?: number): boolean => {
        const state = gameStateRef.current;
        const player = state.players[state.currentPlayer];
        const currentLevel = player.evolutionLevels[unitType][branch];
        // Quick pre-check (non-authoritative, just for fast UI feedback)
        if (currentLevel >= 3) return false;
        const preCheckCost = EVOLUTION_COSTS[currentLevel as keyof typeof EVOLUTION_COSTS];
        if (player.energy < preCheckCost) { addLog('log_low_energy', 'info', { cost: preCheckCost }); return false; }

        // Authoritative check inside reducer to prevent race conditions from rapid clicks
        let didEvolve = false;
        let evolvedLevel = 0;
        const actingPlayer = state.currentPlayer;

        setGameState(prev => {
            const p = prev.players[actingPlayer];
            const actualLevel = p.evolutionLevels[unitType][branch];
            if (actualLevel >= 3) return prev; // Already maxed (race: another click beat us)
            const cost = EVOLUTION_COSTS[actualLevel as keyof typeof EVOLUTION_COSTS];
            if (p.energy < cost) return prev; // Insufficient energy (race: energy was spent)

            const newLevel = actualLevel + 1;
            const variantKey = (branch + 'Variant') as keyof typeof p.evolutionLevels[typeof unitType];
            const newLevels = {
                ...p.evolutionLevels,
                [unitType]: {
                    ...p.evolutionLevels[unitType],
                    [branch]: newLevel,
                    [variantKey]: variant || p.evolutionLevels[unitType][variantKey]
                }
            };

            didEvolve = true;
            evolvedLevel = newLevel;

            return {
                ...prev,
                players: {
                    ...prev.players,
                    [actingPlayer]: { ...p, energy: p.energy - cost, evolutionLevels: newLevels }
                },
                lastActionTime: Date.now(),
                isTimeFrozen: true
            };
        });

        if (didEvolve) {
            addLog('log_evolved', 'move', { unit: getLocalizedUnitName(unitType), unitType, branch, level: evolvedLevel }, actingPlayer);
            if (evolvedLevel === 3) setShowEvolutionTree(false);
        }
        return didEvolve;
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
