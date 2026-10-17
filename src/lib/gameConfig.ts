/**
 * ════════════════════════════════════════════════════════════════════
 *  GAME TUNING — change the game here, everything else adapts.
 * ════════════════════════════════════════════════════════════════════
 *  STAGE_DURATIONS: snippet length (seconds, from 0:00) heard at each stage.
 *  STAGE_POINTS:    points awarded for a correct guess at that stage.
 *  Both arrays must be the same length (one entry per stage).
 */
export const STAGE_DURATIONS: number[] = [0.5, 1, 2, 4, 8];
export const STAGE_POINTS: number[] = [5, 4, 3, 2, 1];

/** Rounds per game (each round is a different song by the same artist). */
export const TOTAL_ROUNDS = 10;

/** Deezer previews are 30s — stages must stay below this. */
export const MAX_STAGE = STAGE_DURATIONS.length;
export const LONGEST_SNIPPET = STAGE_DURATIONS[STAGE_DURATIONS.length - 1];
export const MAX_GAME_POINTS =
  STAGE_POINTS[0] > 0 ? STAGE_POINTS[0] * TOTAL_ROUNDS : 0;
