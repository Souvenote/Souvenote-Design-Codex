import { GENERATION_ACTIONS, generationCreditCost } from './generation-policy';

describe('generation credit policy', () => {
  it('locks the approved action costs', () => {
    expect(Object.fromEntries(GENERATION_ACTIONS.map((action) => [action, generationCreditCost(action)]))).toEqual({
      initial_image_song: 2,
      regenerate_image: 1,
      regenerate_song: 1,
      inside_message: 0,
    });
  });
});
