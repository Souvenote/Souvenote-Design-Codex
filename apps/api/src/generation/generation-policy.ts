export const GENERATION_ACTIONS = [
  'initial_image',
  'initial_image_song',
  'regenerate_image',
  'regenerate_song',
  'inside_message',
] as const;

export type GenerationAction = (typeof GENERATION_ACTIONS)[number];

export const GENERATION_FAILURE_CATEGORIES = [
  'provider_failed',
  'timed_out',
  'policy_blocked',
  'invalid_result',
] as const;

export type GenerationFailureCategory = (typeof GENERATION_FAILURE_CATEGORIES)[number];

const CREDIT_COST: Readonly<Record<GenerationAction, number>> = Object.freeze({
  initial_image: 1,
  initial_image_song: 2,
  regenerate_image: 1,
  regenerate_song: 1,
  inside_message: 0,
});

export function generationCreditCost(action: GenerationAction): number {
  return CREDIT_COST[action];
}
