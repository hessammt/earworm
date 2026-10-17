# earworm. — a Heardle-style music guessing game

One artist. 10 songs. 5 ever-longer snippets (0.5s → 8s). Guess fast, bank
points, climb the global leaderboard.

Built with **Next.js (App Router) + TypeScript + Tailwind + PostgreSQL
(Drizzle ORM)**. Custom cookie/JWT auth, server-authoritative game state, and
a song archive seeded from the **Deezer public API** (no key required).

---

## Gameplay

- Start a game with a **random artist** or pick one from the archive.
- **10 rounds**, each a different song by that artist.
- Each round has **5 stages**: a snippet from 0:00 that doubles every stage
  (`0.5s → 1s → 2s → 4s → 8s`), worth `5 / 4 / 3 / 2 / 1` points.
- Guess via an **autocomplete search box** over the song archive (you must
  pick a song from the list). A **wrong guess or skip** moves you to the next
  stage with a longer snippet. Fail at stage 5 → 0 points and the answer is
  revealed.
- After 10 rounds: full **results screen** with per-round points and a
  play-again button.
- **Guests can play**, but points are only saved to accounts. Guests are
  nudged to sign up before and after games.

> Tuning lives in one file: **`src/lib/gameConfig.ts`**
> (stage durations, stage points, rounds per game). Change it and the whole
> game — UI, scoring, progress bar — adapts.

## Anti-cheat design

- The correct answer is **never sent to the browser** before a round ends.
  The client only holds an opaque `roundId`; guesses are validated and scored
  **on the server**.
- Full game state (rounds, stage, songs picked, points) lives **server-side**
  in Postgres — refreshing the page just restores it via `/api/game/current`.
- Audio is proxied through **`/api/audio/[roundId]`**, which resolves a fresh
  Deezer preview URL at play time (they expire) and streams the MP3. The
  browser never talks to Deezer (their API has no CORS support anyway).

## Local setup

### 1. Install

```bash
npm install
```

### 2. Environment variables (`.env`)

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
AUTH_SECRET=some-long-random-string   # signs session JWTs
```

### 3. Create the tables

```bash
npx drizzle-kit push
```

### 4. Seed the song archive

```bash
npx tsx scripts/seed.ts                    # default roster (~60 artists, thousands of songs)
npx tsx scripts/seed.ts "Daft Punk" "ABBA" # or pass your own artist names
npx tsx scripts/seed.ts --category=game-music "C418" "Toby Fox"  # tag artists
#   into a category — categories show up as their own playable tiles
#   (10 rounds mixed across every artist in the category)
```

The seed script is **idempotent** — re-run it any time with more artists to
keep growing the archive. Songs without a working 30s Deezer preview are
skipped automatically.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 — hit **PLAY BEFORE SIGNING UP** to try guest mode,
or create an account to save points and appear on the leaderboard.

## Deploy to Vercel (step by step)

1. **Push to GitHub.** From the project folder:
   ```bash
   git init && git add -A && git commit -m "earworm"
   git branch -M main
   git remote add origin https://github.com/<you>/earworm.git
   git push -u origin main
   ```
   (`.env` is gitignored — never commit it.)

2. **Import into Vercel.** vercel.com → *Add New… → Project* → import the
   repo → Deploy. The first deploy may fail health checks until env vars are
   set — that's fine.

3. **Create Postgres.** Project → *Storage* tab → *Create Database* →
   *Postgres (Neon)* → connect it to the project.

4. **Environment variables** (Project → Settings → Environment Variables,
   add for *Production* + *Preview*):
   - `DATABASE_URL` = the pooled connection string (copy the `POSTGRES_URL`
     value from Storage → your DB → *.env.local* tab)
   - `AUTH_SECRET` = generate with `openssl rand -hex 32`

5. **Create tables + seed the archive** — from your machine, pointed at prod:
   ```bash
   export DATABASE_URL="postgres://…"        # same pooled string as above
   npx drizzle-kit push                      # creates the 5 tables
   npx tsx scripts/seed.ts                   # default roster (~5 min)
   npx tsx scripts/seed.ts --category=game-music "C418" "Toby Fox" "Mick Gordon" "Jeremy Soule" "Koji Kondo" "Nobuo Uematsu" "Bear McCreary" "Gustavo Santaolalla" "Jesper Kyd" "Martin O'Donnell" "Lena Raine" "Darren Korb" "Yoko Shimomura" "Akira Yamaoka" "Grant Kirkhope" "Harry Gregson-Williams"
   ```
   On Windows PowerShell use `$env:DATABASE_URL="postgres://…"` instead of
   `export`. The seed script enables SSL automatically for remote databases.

6. **Redeploy** (Deployments → ⋯ → Redeploy, or just `git push` from now on).
   Verify: `https://<your-app>.vercel.app/api/artists` returns JSON, then
   play a guest game and sign up.

## Data model

| table         | purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `users`       | email, username, password hash                                 |
| `artists`     | name, Deezer artist id, image                                  |
| `songs`       | title, album, cover, Deezer track id, last known preview URL   |
| `games`       | owner (user **or** guest cookie), artist, status, total points |
| `game_rounds` | song per round, stage reached, status, points earned           |

Leaderboard = `SUM(games.total_points)` per user over completed games
(all-time / this ISO week / this month).

## Done vs. next

**Done**

- Full 10-round × 5-stage game loop with server-side state + resume on refresh
- Deezer seed script (top tracks per artist, idempotent) + play-time preview
  refresh + audio proxy
- Email/password auth (JWT cookie), guest mode with save-points prompts
- Global leaderboard: all-time / weekly / monthly, current user highlighted
- Profile: total points, games played, best game, accuracy, recent games
- Mobile-first dark UI: stage progress bar, play/pause with precise cut-off,
  points popup, correct/wrong flashes, keyboard-friendly autocomplete
  (Enter/arrows/Tab/Escape)

**Could come next**

- Google OAuth (swap the custom auth for Auth.js)
- Deezer genre-based archives, daily challenge mode, head-to-head duels
- Claim-a-guest-game flow (bank a just-finished guest game to a new account)
- Redis rate limiting on guess/audio endpoints + CDN caching for audio
- Social share cards for results
