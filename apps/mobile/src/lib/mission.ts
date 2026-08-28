export const MISSION_STAGES = ['WORKSPACE', 'INVESTIGATE', 'PLAN', 'CHANGE', 'VERIFY', 'REVIEW'] as const;

const STAGE_BY_STATE: Record<string, number> = {
  queued: 0,
  provisioning: 0,
  investigating: 1,
  planning: 2,
  implementing: 3,
  verifying: 4,
  ready_for_review: 5,
  completed: MISSION_STAGES.length,
};

export const MISSION_TERMINAL = new Set(['ready_for_review', 'completed', 'failed', 'cancelled']);
export const MISSION_STOPPED = new Set(['failed', 'cancelled']);

/** Index of the stage a mission is currently working on. */
export function missionStage(state: string): number {
  return STAGE_BY_STATE[state] ?? 0;
}

export function missionStageLabel(state: string): string {
  if (state === 'completed') return 'SHIPPED';
  if (MISSION_STOPPED.has(state)) return state.toUpperCase();
  return MISSION_STAGES[missionStage(state)] ?? 'WORKSPACE';
}

export function humanState(state: string): string {
  return state.replaceAll('_', ' ').toUpperCase();
}
