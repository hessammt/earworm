/** Shared API payload types (safe to import from client components). */

export type RoundSnapshot = {
  roundNumber: number;
  status: "correct" | "failed";
  stage: number;
  points: number;
  /** artistName matters for category games (mixed artists per round). */
  song: {
    title: string;
    artistName: string;
    album: string | null;
    coverUrl: string | null;
  };
};

/**
 * Sanitized game state. It NEVER contains the active round's song identity —
 * the browser only learns an answer after the round has ended.
 * `roundId` is an opaque token used to stream audio from our backend.
 */
export type GameState = {
  gameId: string;
  status: "in_progress" | "completed";
  isGuest: boolean;
  artist: { id: string; name: string; imageUrl: string | null };
  totalPoints: number;
  totalRounds: number;
  currentRoundNumber: number;
  /** Stage of the active round (1..N). 0 when the game is completed. */
  stage: number;
  roundId: string | null;
  stageDurations: number[];
  stagePoints: number[];
  /** Completed rounds only, in order. */
  rounds: RoundSnapshot[];
};

export type GuessOutcome = "correct" | "wrong" | "failed";

export type GuessResponse = {
  error?: string;
  outcome?: GuessOutcome;
  awarded?: number;
  guessed?: { title: string; artistName: string };
  state?: GameState;
};

export type SkipResponse = {
  error?: string;
  outcome?: "skipped" | "failed";
  state?: GameState;
};

export type StartResponse = { error?: string; state?: GameState };
export type CurrentResponse = { state: GameState | null };

export type SearchResult = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
};

export type ArtistInfo = {
  id: string;
  name: string;
  imageUrl: string | null;
  songCount: number;
};

export type CategoryInfo = {
  slug: string;
  name: string;
  description: string;
  songCount: number;
  artistCount: number;
};
