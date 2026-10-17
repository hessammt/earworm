import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Auth + profile in one place (stats are computed from games/rounds). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 24 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const artists = pgTable("artists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  deezerArtistId: bigint("deezer_artist_id", { mode: "number" })
    .notNull()
    .unique(),
  imageUrl: text("image_url"),
  /** Optional grouping slug, e.g. "game-music" (enables category games). */
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    album: varchar("album", { length: 500 }),
    coverUrl: text("cover_url"),
    deezerTrackId: bigint("deezer_track_id", { mode: "number" })
      .notNull()
      .unique(),
    /** Last known Deezer preview URL (expires — refreshed at play time). */
    previewUrl: text("preview_url"),
    duration: integer("duration"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("songs_artist_idx").on(t.artistId),
    index("songs_title_idx").on(t.title),
  ],
);

/** status: in_progress | completed | abandoned */
export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    guestId: varchar("guest_id", { length: 64 }),
    /** Null for category games (songs drawn from a whole artist category). */
    artistId: uuid("artist_id").references(() => artists.id),
    /** Category slug when this is a category game, e.g. "game-music". */
    category: varchar("category", { length: 50 }),
    status: varchar("status", { length: 20 }).notNull().default("in_progress"),
    totalPoints: integer("total_points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("games_user_idx").on(t.userId),
    index("games_guest_idx").on(t.guestId),
    index("games_status_idx").on(t.status),
  ],
);

/** status: pending | active | correct | failed */
export const gameRounds = pgTable(
  "game_rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id),
    roundNumber: integer("round_number").notNull(),
    stage: integer("stage").notNull().default(1),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    points: integer("points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("game_rounds_game_idx").on(t.gameId)],
);
