import { useEffect } from 'react';
import { GameState, PlayerID } from '../types';
import { GRID_ROWS, GRID_COLS, UNIT_STATS } from '../constants';
import { getDisplayCost } from '../gameHelpers';

interface UseGameAIProps {
    gameState: GameState;
    attemptMove: (unitId: string, r: number, c: number, cost: number) => void;
    handleActionComplete: (actedUnitId: string | null) => void;
}

export const useGameAI = ({ gameState, attemptMove, handleActionComplete }: UseGameAIProps) => {
    // Use ref to avoid stale closures in setTimeout if needed, though dependency array handles most.
    // However, since we use a timeout, the state might change during the timeout?
    // Actually, in the original code, performAITurn used a Ref. 
    // Here, if we use useEffect([gameState.turnCount, ...]), we get the fresh state.

    // We need to prevent multiple triggers for the same turn state.
    // The original code used a check inside the function to ensure P2 turn.

    useEffect(() => {
        if (gameState.gameMode !== 'pve' || gameState.currentPlayer !== PlayerID.P2 || gameState.gameOver) {
            return;
        }

        // AI Turn Logic
        const performAITurn = () => {
            const p2Units = gameState.players[PlayerID.P2].units.filter(u => !u.isDead && !u.hasActedThisRound);

            if (p2Units.length === 0) {
                handleActionComplete(null);
                return;
            }

            // Simple AI: Pick random unit and random action
            const unit = p2Units[Math.floor(Math.random() * p2Units.length)];

            // 60% chance to move, 40% chance to pass
            if (Math.random() < 0.6) {
                // Try to move towards enemy flag
                const targetFlag = gameState.players[PlayerID.P1].flagPosition;
                const directions = [
                    { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
                ];

                let bestDir = directions[0];
                let bestDist = Math.abs(unit.r + bestDir.r - targetFlag.r) + Math.abs(unit.c + bestDir.c - targetFlag.c);

                for (const dir of directions) {
                    const newR = unit.r + dir.r;
                    const newC = unit.c + dir.c;
                    if (newR >= 0 && newR < GRID_ROWS && newC >= 0 && newC < GRID_COLS) {
                        const dist = Math.abs(newR - targetFlag.r) + Math.abs(newC - targetFlag.c);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestDir = dir;
                        }
                    }
                }

                const newR = unit.r + bestDir.r;
                const newC = unit.c + bestDir.c;

                if (newR >= 0 && newR < GRID_ROWS && newC >= 0 && newC < GRID_COLS) {
                    const baseCost = UNIT_STATS[unit.type].moveCost;
                    const cost = getDisplayCost(unit, baseCost, gameState);
                    attemptMove(unit.id, newR, newC, cost);
                    return;
                }
            }

            handleActionComplete(unit.id);
        };

        const timer = setTimeout(performAITurn, 1000);

        return () => clearTimeout(timer);
    }, [
        // Dependencies triggering the AI turn
        gameState.turnCount,
        gameState.currentPlayer,
        gameState.gameMode,
        gameState.gameOver,
        // We include specific unit states involved to ensure freshness if we were using memoized callback,
        // but since we use the whole gameState object, it should be enough (it changes on every move).
        // To be safe and avoid infinite loops if something doesn't change, we rely on turn/player change.
        // However, if AI moves one unit, `gameState` changes. 
        // If it's still P2 turn (because they have multiple moves? No, usually 1 move per turn/action phase unless rules differ), 
        // Wait, the game seems to be unit-based turn or player-based turn?
        // "performAITurn" checks "hasActedThisRound".
        // If P2 has multiple units, it seems they move one by one?
        // App.tsx logic: "handleActionComplete" -> if P2 done -> new round. AND "handleActionComplete" checks if next player has moves.
        // If P2 has more units, "handleActionComplete" keeps currentPlayer as P2.
        // So `gameState` updates -> Effect runs again -> AI moves next unit.
        gameState // Re-run whenever gameState changes
    ]);
};
