import { GameState, PlayerID } from '../types';
import { AIOpponentModel } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const manhattan = (r1: number, c1: number, r2: number, c2: number) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

const opposite = (player: PlayerID) => (player === PlayerID.P1 ? PlayerID.P2 : PlayerID.P1);

export const createInitialOpponentModel = (): AIOpponentModel => ({
    aggression: 0,
    flagRush: 0,
    minePressure: 0,
    hotspots: {},
    samples: 0
});

export const updateOpponentModel = (
    prevModel: AIOpponentModel,
    prevState: GameState | null,
    nextState: GameState,
    aiPlayer: PlayerID = PlayerID.P2
): AIOpponentModel => {
    if (!prevState) return prevModel;

    const enemy = opposite(aiPlayer);
    const aiFlag = nextState.players[aiPlayer].flagPosition;

    const prevEnemyUnits = prevState.players[enemy].units.filter(u => !u.isDead);
    const nextEnemyUnits = nextState.players[enemy].units.filter(u => !u.isDead);
    const prevOwnUnits = prevState.players[aiPlayer].units;
    const nextOwnUnits = nextState.players[aiPlayer].units;

    const prevEnemyMines = prevState.mines.filter(m => m.owner === enemy).length;
    const nextEnemyMines = nextState.mines.filter(m => m.owner === enemy).length;

    let moveTowardFlagCount = 0;
    nextEnemyUnits.forEach(nextUnit => {
        const prevUnit = prevEnemyUnits.find(u => u.id === nextUnit.id);
        if (!prevUnit) return;
        const prevDist = manhattan(prevUnit.r, prevUnit.c, aiFlag.r, aiFlag.c);
        const nextDist = manhattan(nextUnit.r, nextUnit.c, aiFlag.r, aiFlag.c);
        if (nextDist < prevDist) moveTowardFlagCount += 1;
    });

    const enemyHasFlagCarrier = nextEnemyUnits.some(u => u.hasFlag);
    const mineDelta = Math.max(0, nextEnemyMines - prevEnemyMines);

    let ownHpLoss = 0;
    let ownDeaths = 0;
    nextOwnUnits.forEach(nextUnit => {
        const prevUnit = prevOwnUnits.find(u => u.id === nextUnit.id);
        if (!prevUnit) return;
        ownHpLoss += Math.max(0, prevUnit.hp - nextUnit.hp);
        if (!prevUnit.isDead && nextUnit.isDead) ownDeaths += 1;
    });

    const decay = 0.8;
    const aggressionGain = ownHpLoss * 0.08 + ownDeaths * 1.5;
    const flagRushGain = moveTowardFlagCount * 0.9 + (enemyHasFlagCarrier ? 1.7 : 0);
    const mineGain = mineDelta * 1.4;
    const hotspotDecay = 0.86;
    const hotspots: Record<string, number> = {};

    Object.entries(prevModel.hotspots).forEach(([key, value]) => {
        const decayed = value * hotspotDecay;
        if (decayed >= 0.35) hotspots[key] = decayed;
    });
    nextEnemyUnits.forEach(unit => {
        const key = `${unit.r},${unit.c}`;
        const gain = unit.hasFlag ? 2.4 : 1.2;
        hotspots[key] = clamp((hotspots[key] ?? 0) + gain, 0, 12);
    });

    return {
        aggression: clamp(prevModel.aggression * decay + aggressionGain, 0, 10),
        flagRush: clamp(prevModel.flagRush * decay + flagRushGain, 0, 10),
        minePressure: clamp(prevModel.minePressure * decay + mineGain, 0, 10),
        hotspots,
        samples: prevModel.samples + 1
    };
};
