import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { artists, gameRounds, games, songs } from "@/db/schema";
import {
  MAX_STAGE,
  STAGE_DURATIONS,
  STAGE_POINTS,
  TOTAL_ROUNDS,
} from "./gameConfig";
import { categoryLabel } from "./categories";
import type { GameState, GuessOutcome, RoundSnapshot } from "./types";
import type { Identity } from "./session";

export class GameError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function identityCondition(idn: Identity) {
  if (idn.userId) return eq(games.userId, idn.userId);
  if (idn.guestId) return eq(games.guestId, idn.guestId);
  throw new GameError(401, "Not signed in.");
}

async function findActiveGame(idn: Identity) {
  const cond = identityCondition(idn);
  const rows = await db
    .select()
    .from(games)
    .where(and(cond, eq(games.status, "in_progress")))
    .orderBy(sql`${games.createdAt} desc`)
    .limit(1);
  return rows[0] ?? null;
}

async function getActiveRound(gameId: string) {
  const rows = await db
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.gameId, gameId), eq(gameRounds.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

/** Start a new game. Any existing in-progress game for this player is abandoned. */
export async function startGame(
  idn: Identity,
  opts: { artistId?: string; category?: string } = {},
): Promise<GameState> {
  const cond = identityCondition(idn);
  await db
    .update(games)
    .set({ status: "abandoned", completedAt: new Date() })
    .where(and(cond, eq(games.status, "in_progress")));

  let picked: { id: string }[];
  let gameArtistId: string | null = null;
  let gameCategory: string | null = null;

  if (opts.category) {
    const slug = opts.category;
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
      throw new GameError(400, "Unknown category.");
    }
    picked = await db
      .select({ id: songs.id })
      .from(songs)
      .innerJoin(artists, eq(songs.artistId, artists.id))
      .where(and(eq(artists.category, slug), isNotNull(songs.previewUrl)))
      .orderBy(sql`random()`)
      .limit(TOTAL_ROUNDS);
    if (picked.length < TOTAL_ROUNDS) {
      throw new GameError(
        400,
        "Not enough songs in this category yet — seed more artists.",
      );
    }
    gameCategory = slug;
  } else {
    let chosenArtistId = opts.artistId;
    if (!chosenArtistId) {
      const eligible = await db
        .select({ id: artists.id })
        .from(artists)
        .innerJoin(songs, eq(songs.artistId, artists.id))
        .where(isNotNull(songs.previewUrl))
        .groupBy(artists.id)
        .having(sql`count(*) >= ${TOTAL_ROUNDS}`);
      if (eligible.length === 0) {
        throw new GameError(
          500,
          "The song archive is empty — run the seed script first.",
        );
      }
      chosenArtistId = eligible[Math.floor(Math.random() * eligible.length)].id;
    }

    picked = await db
      .select({ id: songs.id })
      .from(songs)
      .where(
        and(eq(songs.artistId, chosenArtistId), isNotNull(songs.previewUrl)),
      )
      .orderBy(sql`random()`)
      .limit(TOTAL_ROUNDS);
    if (picked.length < TOTAL_ROUNDS) {
      throw new GameError(
        400,
        "This artist doesn't have enough playable songs yet — pick another one.",
      );
    }
    gameArtistId = chosenArtistId;
  }

  const [game] = await db
    .insert(games)
    .values({
      userId: idn.userId,
      guestId: idn.userId ? null : idn.guestId,
      artistId: gameArtistId,
      category: gameCategory,
    })
    .returning({ id: games.id });

  await db.insert(gameRounds).values(
    picked.map((s, i) => ({
      gameId: game.id,
      songId: s.id,
      roundNumber: i + 1,
      stage: 1,
      status: i === 0 ? "active" : "pending",
    })),
  );

  return buildGameState(game.id);
}

/** Resume support: returns the in-progress game for this player, if any. */
export async function getCurrentGameState(
  idn: Identity,
): Promise<GameState | null> {
  if (!idn.userId && !idn.guestId) return null;
  const game = await findActiveGame(idn);
  if (!game) return null;
  return buildGameState(game.id);
}

export async function abandonGame(idn: Identity): Promise<void> {
  const cond = identityCondition(idn);
  await db
    .update(games)
    .set({ status: "abandoned", completedAt: new Date() })
    .where(and(cond, eq(games.status, "in_progress")));
}

export async function submitGuess(idn: Identity, songId: string) {
  const game = await findActiveGame(idn);
  if (!game) throw new GameError(404, "No active game. Start a new one.");
  const round = await getActiveRound(game.id);
  if (!round) throw new GameError(400, "This game is already finished.");
  if (!/^[0-9a-f-]{36}$/i.test(songId)) {
    throw new GameError(400, "Pick a song from the list to submit.");
  }

  const gs = await db
    .select({ id: songs.id, title: songs.title, artistName: artists.name })
    .from(songs)
    .innerJoin(artists, eq(songs.artistId, artists.id))
    .where(eq(songs.id, songId))
    .limit(1);
  if (!gs[0]) throw new GameError(400, "Pick a song from the list to submit.");

  let outcome: GuessOutcome;
  let awarded = 0;

  if (songId === round.songId) {
    outcome = "correct";
    awarded = STAGE_POINTS[round.stage - 1] ?? 0;
    await db
      .update(gameRounds)
      .set({ status: "correct", points: awarded, completedAt: new Date() })
      .where(eq(gameRounds.id, round.id));
    await advanceGame(game.id, round.roundNumber, awarded);
  } else if (round.stage >= MAX_STAGE) {
    outcome = "failed";
    await db
      .update(gameRounds)
      .set({ status: "failed", points: 0, completedAt: new Date() })
      .where(eq(gameRounds.id, round.id));
    await advanceGame(game.id, round.roundNumber, 0);
  } else {
    outcome = "wrong";
    await db
      .update(gameRounds)
      .set({ stage: round.stage + 1 })
      .where(eq(gameRounds.id, round.id));
  }

  const state = await buildGameState(game.id);
  return {
    outcome,
    awarded,
    guessed: { title: gs[0].title, artistName: gs[0].artistName },
    state,
  };
}

export async function skipStage(idn: Identity) {
  const game = await findActiveGame(idn);
  if (!game) throw new GameError(404, "No active game. Start a new one.");
  const round = await getActiveRound(game.id);
  if (!round) throw new GameError(400, "This game is already finished.");

  let outcome: "skipped" | "failed";
  if (round.stage >= MAX_STAGE) {
    outcome = "failed";
    await db
      .update(gameRounds)
      .set({ status: "failed", points: 0, completedAt: new Date() })
      .where(eq(gameRounds.id, round.id));
    await advanceGame(game.id, round.roundNumber, 0);
  } else {
    outcome = "skipped";
    await db
      .update(gameRounds)
      .set({ stage: round.stage + 1 })
      .where(eq(gameRounds.id, round.id));
  }

  const state = await buildGameState(game.id);
  return { outcome, state };
}

/** Move the game forward after a round resolves: bank points, open the next round. */
async function advanceGame(
  gameId: string,
  roundNumber: number,
  awarded: number,
) {
  if (roundNumber >= TOTAL_ROUNDS) {
    await db
      .update(games)
      .set({
        status: "completed",
        completedAt: new Date(),
        totalPoints: sql`${games.totalPoints} + ${awarded}`,
      })
      .where(eq(games.id, gameId));
  } else {
    await db
      .update(games)
      .set({ totalPoints: sql`${games.totalPoints} + ${awarded}` })
      .where(eq(games.id, gameId));
    await db
      .update(gameRounds)
      .set({ status: "active" })
      .where(
        and(
          eq(gameRounds.gameId, gameId),
          eq(gameRounds.roundNumber, roundNumber + 1),
        ),
      );
  }
}

/**
 * Build the sanitized state sent to the browser. The active round's song is
 * deliberately omitted — answers only appear after a round resolves.
 */
export async function buildGameState(gameId: string): Promise<GameState> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!game) throw new GameError(404, "Game not found");
  const artist = game.artistId
    ? (
        await db
          .select()
          .from(artists)
          .where(eq(artists.id, game.artistId))
          .limit(1)
      )[0]
    : null;

  const rows = await db
    .select({
      round: gameRounds,
      songTitle: songs.title,
      songArtist: artists.name,
      songAlbum: songs.album,
      songCover: songs.coverUrl,
    })
    .from(gameRounds)
    .innerJoin(songs, eq(gameRounds.songId, songs.id))
    .innerJoin(artists, eq(songs.artistId, artists.id))
    .where(eq(gameRounds.gameId, gameId))
    .orderBy(asc(gameRounds.roundNumber));

  const active = rows.find((r) => r.round.status === "active")?.round ?? null;

  const rounds: RoundSnapshot[] = rows
    .filter((r) => r.round.status === "correct" || r.round.status === "failed")
    .map((r) => ({
      roundNumber: r.round.roundNumber,
      status: r.round.status as "correct" | "failed",
      stage: r.round.stage,
      points: r.round.points,
      song: {
        title: r.songTitle,
        artistName: r.songArtist,
        album: r.songAlbum,
        coverUrl: r.songCover,
      },
    }));

  return {
    gameId: game.id,
    status: game.status === "completed" ? "completed" : "in_progress",
    isGuest: !game.userId,
    artist: artist
      ? { id: artist.id, name: artist.name, imageUrl: artist.imageUrl }
      : {
          id: game.category ?? "mixed",
          name: categoryLabel(game.category),
          imageUrl: null,
        },
    totalPoints: rows.reduce((sum, r) => sum + r.round.points, 0),
    totalRounds: TOTAL_ROUNDS,
    currentRoundNumber: active?.roundNumber ?? TOTAL_ROUNDS,
    stage: active?.stage ?? 0,
    roundId: active?.id ?? null,
    stageDurations: [...STAGE_DURATIONS],
    stagePoints: [...STAGE_POINTS],
    rounds,
  };
}
