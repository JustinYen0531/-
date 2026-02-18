import { GameState, PlayerID } from '../types';
import { AIEndgameState } from './types';

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const opposite = (player: PlayerID) => (player === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1);

export const evaluateEndgameState = (
    state: GameState,
    aiPlayer: PlayerID = PlayerID.P2
): AIEndgameState => {
    const enemy = opposite(aiPlayer);
    const ownAliveUnits = state.players[aiPlayer].units.filter(u => !u.isDead);
    const enemyAliveUnits = state.players[enemy].units.filter(u => !u.isDead);
    const ownAlive = ownAliveUnits.length;
    const enemyAlive = enemyAliveUnits.length;

    const ownCarrier = ownAliveUnits.find(u => u.hasFlag);
    const enemyCarrier = enemyAliveUnits.find(u => u.hasFlag);

    const lowPopulation = ownAlive + enemyAlive <= 5;
    const lateTurn = state.turnCount >= 18;
    const carrierPressure = Boolean(ownCarrier || enemyCarrier);
    const isEndgame = lowPopulation || lateTurn || carrierPressure;

    if (!isEndgame) {
        return { isEndgame: false, mode: 'none', urgency: 0, ownAlive, enemyAlive };
    }

    if (ownCarrier) {
        const enemyFlag = state.players[enemy].flagPosition;
        const dist = manhattan(ownCarrier.r, ownCarrier.c, enemyFlag.r, enemyFlag.c);
        const urgency = clamp(1.2 + (11 - dist) * 0.22 + (enemyAlive <= 2 ? 0.45 : 0), 1, 4.2);
        return { isEndgame: true, mode: 'race', urgency, ownAlive, enemyAlive };
    }

    if (enemyCarrier) {
        const ownFlag = state.players[aiPlayer].flagPosition;
        const dist = manhattan(enemyCarrier.r, enemyCarrier.c, ownFlag.r, ownFlag.c);
        const urgency = clamp(1.4 + (10 - dist) * 0.24 + (ownAlive <= 2 ? 0.55 : 0), 1, 4.6);
        return { isEndgame: true, mode: 'defense', urgency, ownAlive, enemyAlive };
    }

    const urgency = clamp(0.9 + (state.turnCount - 14) * 0.12 + (lowPopulation ? 0.5 : 0), 0.9, 3.5);
    return { isEndgame: true, mode: 'attrition', urgency, ownAlive, enemyAlive };
};
