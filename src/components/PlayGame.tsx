"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Gamepad2,
  ListMusic,
  Loader2,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  SkipForward,
  Trophy,
  X,
} from "lucide-react";
import type {
  ArtistInfo,
  CategoryInfo,
  GameState,
  SearchResult,
} from "@/lib/types";

type Phase = "loading" | "menu" | "playing" | "reveal" | "results";

export default function PlayGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<GameState | null>(null);
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [artistFilter, setArtistFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ── audio ─────────────────────────────────────────────────────── */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 of the LONGEST stage
  const [audioBroken, setAudioBroken] = useState(false);
  const limitRef = useRef(8);
  const totalRef = useRef(8);

  /* ── guessing ──────────────────────────────────────────────────── */
  const [query, setQuery] = useState("");
  const [sug, setSug] = useState<SearchResult[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const stage = state?.stage ?? 1;
  const durations = useMemo(
    () => state?.stageDurations ?? [0.5, 1, 2, 4, 8],
    [state],
  );
  const stagePoints = useMemo(
    () => state?.stagePoints ?? [5, 4, 3, 2, 1],
    [state],
  );
  const total = durations[durations.length - 1];
  const limit = durations[Math.min(Math.max(stage - 1, 0), durations.length - 1)];

  useEffect(() => {
    limitRef.current = limit;
    totalRef.current = total;
  }, [limit, total]);

  /* ── boot: resume in-progress game, else show artist menu ──────── */
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/game/current", { cache: "no-store" });
        const d = (await r.json()) as { state: GameState | null };
        if (d.state && d.state.status === "in_progress") {
          setState(d.state);
          setPhase("playing");
          return;
        }
      } catch {
        /* fall through to menu */
      }
      await loadMenu();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMenu = useCallback(async () => {
    setPhase("menu");
    setError(null);
    try {
      const r = await fetch("/api/artists", { cache: "no-store" });
      const d = (await r.json()) as {
        artists: ArtistInfo[];
        categories?: CategoryInfo[];
      };
      setArtists(d.artists ?? []);
      setCategories(d.categories ?? []);
    } catch {
      setError("Could not load the artist list.");
    }
  }, []);

  /* ── audio element lifecycle ───────────────────────────────────── */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setAudioBroken(true);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
    };
  }, []);

  // New round → new audio source.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || phase !== "playing" || !state?.roundId) return;
    setAudioBroken(false);
    el.src = `/api/audio/${state.roundId}`;
    el.load();
    setProgress(0);
    setPlaying(false);
  }, [state?.roundId, phase]);

  // rAF loop: precise cut at the stage limit + smooth progress.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = audioRef.current;
      if (el) {
        const lim = limitRef.current;
        const tot = totalRef.current;
        const t = Math.min(el.currentTime, lim);
        setProgress(tot > 0 ? t / tot : 0);
        if (!el.paused && el.currentTime >= lim) {
          el.pause();
          el.currentTime = lim;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    if (el.currentTime >= limitRef.current - 0.03) el.currentTime = 0;
    el.play().catch(() => {});
  }, []);

  const resetPlayback = useCallback((autoplay: boolean) => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    el.currentTime = 0;
    setProgress(0);
    if (autoplay) el.play().catch(() => setPlaying(false));
    else setPlaying(false);
  }, []);

  /* ── game actions ──────────────────────────────────────────────── */
  async function start(payload?: { artistId?: string; category?: string }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const d = (await r.json()) as { state?: GameState; error?: string };
      if (!r.ok || !d.state) {
        setError(d.error ?? "Could not start the game.");
        setBusy(false);
        return;
      }
      setState(d.state);
      setQuery("");
      setSelected(null);
      setSug([]);
      setFlash(null);
      setPhase("playing");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  async function quit() {
    setBusy(true);
    audioRef.current?.pause();
    await fetch("/api/game/abandon", { method: "POST" }).catch(() => {});
    setState(null);
    setBusy(false);
    await loadMenu();
  }

  function handleOutcome(
    outcome: "correct" | "wrong" | "failed",
    st: GameState,
  ) {
    setState(st);
    setFlashKey((k) => k + 1);
    if (outcome === "correct") {
      setFlash("correct");
      audioRef.current?.pause();
      setPhase("reveal");
    } else if (outcome === "failed") {
      setFlash("wrong");
      audioRef.current?.pause();
      setPhase("reveal");
    } else {
      setFlash("wrong");
      setTimeout(() => setFlash(null), 500);
      resetPlayback(true);
    }
  }

  async function submitGuess() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: selected.id }),
      });
      const d = (await r.json()) as {
        outcome?: "correct" | "wrong" | "failed";
        state?: GameState;
        error?: string;
      };
      if (!r.ok || !d.state) {
        setError(d.error ?? "Guess failed — try again.");
        setBusy(false);
        return;
      }
      setQuery("");
      setSelected(null);
      setSug([]);
      setSugOpen(false);
      handleOutcome(d.outcome ?? "wrong", d.state);
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/game/skip", { method: "POST" });
      const d = (await r.json()) as {
        outcome?: "skipped" | "failed";
        state?: GameState;
        error?: string;
      };
      if (!r.ok || !d.state) {
        setError(d.error ?? "Skip failed — try again.");
        setBusy(false);
        return;
      }
      handleOutcome(d.outcome === "failed" ? "failed" : "wrong", d.state);
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  function next() {
    if (!state) return;
    setFlash(null);
    setProgress(0);
    setPhase(state.status === "completed" ? "results" : "playing");
  }

  /* ── autocomplete ──────────────────────────────────────────────── */
  function onQueryChange(v: string) {
    setQuery(v);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 1) {
      setSug([]);
      setSugOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/songs/search?q=${encodeURIComponent(v)}`);
        const d = (await r.json()) as { results: SearchResult[] };
        setSug(d.results ?? []);
        setSugOpen(true);
        setActiveIdx(-1);
      } catch {
        /* ignore */
      }
    }, 180);
  }

  function pick(s: SearchResult) {
    setSelected(s);
    setQuery(s.title);
    setSugOpen(false);
    setSug([]);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, sug.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sugOpen && activeIdx >= 0 && sug[activeIdx]) {
        pick(sug[activeIdx]);
      } else if (selected) {
        void submitGuess();
      } else if (sugOpen && sug[0]) {
        pick(sug[0]);
      }
    } else if (e.key === "Tab" && sugOpen && activeIdx >= 0 && sug[activeIdx]) {
      pick(sug[activeIdx]);
    } else if (e.key === "Escape") {
      setSugOpen(false);
    }
  }

  /* ═══════════════ render ═══════════════ */

  const filteredArtists = artists.filter((a) =>
    a.name.toLowerCase().includes(artistFilter.trim().toLowerCase()),
  );

  return (
    <div className="relative mx-auto w-full max-w-xl px-4 pb-24 pt-6 sm:pt-10">
      <audio ref={audioRef} preload="auto" playsInline />

      {flash && (
        <div
          key={flashKey}
          className={`flash-overlay pointer-events-none fixed inset-0 z-50 ${
            flash === "correct" ? "bg-acid" : "bg-danger"
          }`}
        />
      )}

      {phase === "loading" && (
        <div className="grid place-items-center py-32">
          <Loader2 className="size-8 animate-spin text-acid" />
        </div>
      )}

      {/* ── ARTIST MENU ─────────────────────────────────────────── */}
      {phase === "menu" && (
        <div className="fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-acid">
            10 rounds · one artist · {stagePoints[0] * 10} pts max
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Choose your artist
          </h1>
          <p className="mt-2 text-sm text-muted">
            Every round is a different song by the same artist. Get it in half
            a second for maximum points.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            onClick={() => void start()}
            disabled={busy}
            className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-acid text-lg font-bold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Shuffle className="size-5" strokeWidth={2.5} />
            )}
            SURPRISE ME
          </button>

          {categories.length > 0 && (
            <div className="mt-4 space-y-3">
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => void start({ category: c.slug })}
                  disabled={busy}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-acid/40 bg-gradient-to-r from-acid/15 via-panel to-panel p-4 text-left transition hover:border-acid hover:from-acid/25 disabled:opacity-60"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-acid text-black">
                    <Gamepad2 className="size-6" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-bold uppercase tracking-wide text-acid">
                      {c.name}
                      <span className="rounded-full bg-acid/20 px-2 py-0.5 text-[9px] font-bold tracking-widest text-acid">
                        MIXED
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {c.description} · {c.artistCount} artists · {c.songCount}{" "}
                      songs
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-acid transition group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          )}

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              placeholder="Filter artists…"
              className="h-12 w-full rounded-xl border border-line bg-panel pl-11 pr-4 text-sm outline-none placeholder:text-muted focus:border-acid/60"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredArtists.map((a) => (
              <button
                key={a.id}
                onClick={() => void start({ artistId: a.id })}
                disabled={busy}
                className="group rounded-2xl border border-line bg-panel p-2.5 text-left transition hover:border-acid/60 hover:bg-panel2 disabled:opacity-60"
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid aspect-square w-full place-items-center rounded-xl bg-panel2">
                    <ListMusic className="size-8 text-muted" />
                  </div>
                )}
                <div className="mt-2 truncate px-1 text-sm font-semibold">
                  {a.name}
                </div>
                <div className="px-1 pb-1 text-xs text-muted">
                  {a.songCount} songs
                </div>
              </button>
            ))}
          </div>
          {filteredArtists.length === 0 && !error && (
            <p className="mt-8 text-center text-sm text-muted">
              No artist matches that filter.
            </p>
          )}
        </div>
      )}

      {/* ── PLAYING ─────────────────────────────────────────────── */}
      {phase === "playing" && state && (
        <div className="fade-up" key={state.roundId ?? "round"}>
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full border border-line bg-panel px-4 py-1.5 text-xs font-semibold tracking-wide">
              ROUND{" "}
              <span className="text-acid">{state.currentRoundNumber}</span>/
              {state.totalRounds}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative rounded-full bg-acid px-4 py-1.5 text-xs font-bold text-black">
                {state.totalPoints} PTS
              </div>
              <button
                onClick={() => void quit()}
                disabled={busy}
                title="Quit game"
                aria-label="Quit game"
                className="rounded-full border border-line bg-panel p-2 text-muted transition hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {state.artist.name}
          </h1>

          {state.isGuest && (
            <Link
              href="/signup"
              className="mt-3 flex items-center gap-2 rounded-xl border border-acid/30 bg-acid/10 px-4 py-2.5 text-xs font-medium text-acid transition hover:bg-acid/15"
            >
              <LogIn className="size-4 shrink-0" />
              Playing as guest — points won&apos;t be saved. Sign up to keep
              them.
            </Link>
          )}

          {/* stage chips */}
          <div className="mt-5 grid grid-cols-5 gap-1.5">
            {durations.map((d, i) => {
              const st =
                i + 1 < stage ? "past" : i + 1 === stage ? "current" : "future";
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-1 py-2 text-center transition ${
                    st === "current"
                      ? "border-acid bg-acid/10"
                      : st === "past"
                        ? "border-line/50 bg-panel opacity-40"
                        : "border-line bg-panel"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${st === "current" ? "text-acid" : ""}`}
                  >
                    {d % 1 !== 0 ? d.toFixed(1) : d}s
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {st === "past" ? (
                      <X className="mx-auto size-3" />
                    ) : (
                      `+${stagePoints[i]}`
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* player card */}
          <div
            className={`mt-4 rounded-3xl border bg-panel p-5 sm:p-6 ${
              flash === "wrong" ? "shake border-danger/60" : "border-line"
            }`}
          >
            {/* progress bar over the longest stage, with stage ticks */}
            <div className="relative pt-3">
              <div className="relative h-3 overflow-visible rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-acid transition-[width] duration-100 ease-linear"
                  style={{ width: `${Math.min(progress, 1) * 100}%` }}
                />
                {durations.slice(0, -1).map((d, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 w-px bg-ink"
                    style={{ left: `${(d / total) * 100}%` }}
                  />
                ))}
                {/* limit knob */}
                <div
                  className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-acid"
                  style={{ left: `${(limit / total) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-medium text-muted">
                <span>0s</span>
                <span>
                  {total % 1 !== 0 ? total.toFixed(1) : total}s max
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold">
                {limit % 1 !== 0 ? limit.toFixed(1) : limit}s snippet
              </span>
              <span className="font-bold text-acid">
                {stagePoints[stage - 1]} pts on the line
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className={`grid size-24 place-items-center rounded-full bg-acid text-black transition hover:scale-105 active:scale-95 ${
                  playing ? "ring-pulse" : ""
                }`}
              >
                {playing ? (
                  <Pause className="size-10 fill-current" />
                ) : (
                  <Play className="ml-1 size-10 fill-current" />
                )}
              </button>
            </div>
            {audioBroken && (
              <p className="mt-3 text-center text-xs text-danger">
                This preview failed to load — press skip to move on.
              </p>
            )}
          </div>

          {/* guess box */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
            {selected && (
              <button
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear selection"
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-muted transition hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              onFocus={() => sug.length > 0 && setSugOpen(true)}
              onBlur={() => setTimeout(() => setSugOpen(false), 150)}
              placeholder="Type the song title…"
              autoComplete="off"
              className={`h-14 w-full rounded-2xl border bg-panel pl-11 pr-11 text-base outline-none placeholder:text-muted ${
                selected
                  ? "border-acid/70 text-acid"
                  : "border-line focus:border-acid/60"
              }`}
            />

            {sugOpen && sug.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-line bg-panel2 shadow-2xl shadow-black/60">
                {sug.map((s, i) => (
                  <li key={s.id}>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(s);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        i === activeIdx ? "bg-white/10" : ""
                      }`}
                    >
                      {s.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.coverUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-panel">
                          <ListMusic className="size-4 text-muted" />
                        </div>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {s.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {s.artist}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {sugOpen && sug.length === 0 && query.trim().length > 0 && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-line bg-panel2 px-4 py-3 text-sm text-muted shadow-2xl shadow-black/60">
                No song in the archive matches that title.
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-3">
            <button
              onClick={() => void submitGuess()}
              disabled={!selected || busy}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-acid text-base font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Check className="size-5" strokeWidth={3} />
              )}
              SUBMIT
            </button>
            <button
              onClick={() => void skip()}
              disabled={busy}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-6 text-base font-bold text-white transition hover:border-white/40 disabled:opacity-40"
            >
              <SkipForward className="size-5" strokeWidth={2.5} />
              SKIP
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── REVEAL ──────────────────────────────────────────────── */}
      {phase === "reveal" && state && state.rounds.length > 0 && (
        <RevealCard
          key={state.rounds[state.rounds.length - 1].roundNumber}
          state={state}
          onNext={next}
          busy={busy}
        />
      )}

      {/* ── RESULTS ─────────────────────────────────────────────── */}
      {phase === "results" && state && (
        <div className="fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-acid">
            Game over · {state.artist.name}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Results</h1>

          <div className="mt-6 rounded-3xl border border-acid/30 bg-gradient-to-b from-acid/10 to-transparent p-6 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">
              Final score
            </div>
            <div className="mt-1 text-6xl font-bold tracking-tight text-acid">
              {state.totalPoints}
            </div>
            <div className="mt-1 text-xs text-muted">
              of {state.stagePoints[0] * state.totalRounds} possible points
            </div>
          </div>

          <ul className="mt-6 space-y-2">
            {state.rounds.map((r) => (
              <li
                key={r.roundNumber}
                className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2.5"
              >
                <span className="w-6 text-center text-xs font-bold text-muted">
                  {r.roundNumber}
                </span>
                {r.song.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.song.coverUrl}
                    alt=""
                    loading="lazy"
                    className="size-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-panel2">
                    <ListMusic className="size-4 text-muted" />
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {r.song.title}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {r.song.artistName}
                    </span>
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      r.status === "correct" ? "text-acid" : "text-danger"
                    }`}
                  >
                    {r.status === "correct" ? (
                      <>
                        <Check className="size-3" strokeWidth={3} /> Guessed at{" "}
                        {state.stageDurations[r.stage - 1] % 1 !== 0
                          ? state.stageDurations[r.stage - 1].toFixed(1)
                          : state.stageDurations[r.stage - 1]}
                        s
                      </>
                    ) : (
                      <>
                        <X className="size-3" strokeWidth={3} /> Missed
                      </>
                    )}
                  </span>
                </span>
                <span
                  className={`text-lg font-bold ${
                    r.points > 0 ? "text-acid" : "text-muted"
                  }`}
                >
                  {r.points > 0 ? `+${r.points}` : "0"}
                </span>
              </li>
            ))}
          </ul>

          {state.isGuest && (
            <Link
              href="/signup"
              className="mt-6 flex items-center gap-3 rounded-2xl border border-acid/40 bg-acid/10 p-4 transition hover:bg-acid/15"
            >
              <LogIn className="size-5 shrink-0 text-acid" />
              <span className="text-sm">
                <span className="font-bold text-acid">
                  Your {state.totalPoints} points weren&apos;t saved.
                </span>{" "}
                <span className="text-muted">
                  Create an account to bank every point and join the
                  leaderboard.
                </span>
              </span>
            </Link>
          )}

          <div className="mt-6 grid gap-3">
            <button
              onClick={() => void start()}
              disabled={busy}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-acid text-base font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <RotateCcw className="size-5" strokeWidth={2.5} />
              )}
              PLAY AGAIN (NEW ARTIST)
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void loadMenu()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel text-sm font-bold transition hover:border-white/40"
              >
                <ListMusic className="size-4" /> Pick artist
              </button>
              <Link
                href="/leaderboard"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel text-sm font-bold transition hover:border-white/40"
              >
                <Trophy className="size-4" /> Leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Round-end reveal card ─────────────────────────────────────────── */
function RevealCard({
  state,
  onNext,
  busy,
}: {
  state: GameState;
  onNext: () => void;
  busy: boolean;
}) {
  const round = state.rounds[state.rounds.length - 1];
  const isLast = state.status === "completed";
  const duration = state.stageDurations[round.stage - 1];

  return (
    <div className="pop-in">
      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-bold uppercase tracking-[0.3em] ${
            round.status === "correct" ? "text-acid" : "text-danger"
          }`}
        >
          {round.status === "correct" ? "Correct" : "The answer was"}
        </p>
        <p className="text-xs font-semibold text-muted">
          Round {round.roundNumber}/{state.totalRounds}
        </p>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-3xl border border-line bg-panel">
        <div className="relative">
          {round.song.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={round.song.coverUrl}
              alt={round.song.title}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center bg-panel2">
              <ListMusic className="size-16 text-muted" />
            </div>
          )}
          {round.status === "correct" && (
            <div
              className="float-score absolute inset-x-0 top-8 text-center text-6xl font-bold text-acid drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
            >
              +{round.points}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-16">
            <div className="text-2xl font-bold tracking-tight">
              {round.song.title}
            </div>
            <div className="mt-0.5 text-sm text-white/70">
              {round.song.artistName}
              {round.song.album ? ` · ${round.song.album}` : ""}
            </div>
            {round.status === "correct" && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-acid px-3 py-1 text-xs font-bold text-black">
                <Check className="size-3.5" strokeWidth={3} />
                Guessed at {duration % 1 !== 0 ? duration.toFixed(1) : duration}
                s
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={busy}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acid text-base font-bold text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {isLast ? "SEE RESULTS" : "NEXT ROUND"}
        <ArrowRight className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
