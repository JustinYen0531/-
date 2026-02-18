import { AICandidateAction, AICandidateUnit } from './types';

const ACTION_PRIORITY: Record<AICandidateAction['type'], number> = {
    attack: 90,
    pickup_flag: 80,
    detonate_tower: 79,
    evolve_a_1: 78,
    evolve_a_2: 78,
    evolve_b_1: 76,
    evolve_b_2: 76,
    evolve_a: 74,
    evolve_b: 72,
    convert_mine: 71,
    move_mine: 69,
    teleport: 67,
    throw_mine: 66,
    place_tower: 64,
    place_factory: 63,
    place_hub: 62,
    pickup_mine: 61,
    drop_mine: 60,
    place_mine: 60,
    disarm: 55,
    sensor_scan: 50,
    scan: 45,
    move: 35,
    drop_flag: 20,
    end_turn: 0
};

export const selectBestUnit = (candidates: AICandidateUnit[]): AICandidateUnit | null => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.score - a.score)[0];
};

export const sortActionsByPriority = (candidates: AICandidateAction[]): AICandidateAction[] => {
    return [...candidates].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return ACTION_PRIORITY[b.type] - ACTION_PRIORITY[a.type];
    });
};

export const selectBestAction = (candidates: AICandidateAction[]): AICandidateAction | null => {
    const sorted = sortActionsByPriority(candidates);
    return sorted.length > 0 ? sorted[0] : null;
};
