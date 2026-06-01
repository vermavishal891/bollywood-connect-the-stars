/**
 * Full TMDB Ingestion Engine for Bollywood Connect
 * Discovers ALL Hindi movies from TMDB, fetches all actors from credits,
 * and stores rich metadata. Supports checkpoint/resume for long runs.
 */
import { prisma } from '@bollywood-connect/db';
import * as fs from 'fs';
import * as path from 'path';
import {
  discoverBollywoodMovies,
  getMovieDetails,
  getMovieCredits,
  getPersonDetails,
  getPersonMovieCredits,
  getImageUrl,
  TMDBMovie,
  TMDBError,
} from './tmdb';

// ── Types ──────────────────────────────────────────────────────────────────

interface Checkpoint {
  phase: 'idle' | 'discover' | 'movie_details' | 'actor_details' | 'complete';
  discoveredMovies: number[];       // tmdbIds
  processedMovies: number[];        // tmdbIds
  actorIds: number[];               // tmdbIds collected from credits
  processedActors: number[];        // tmdbIds
  movieData: Record<number, PartialMovieData>;
  actorData: Record<number, PartialActorData>;
  errors: string[];
  startedAt: string;
  lastUpdated: string;
}

interface PartialMovieData {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  releaseYear?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  popularity?: number;
  voteAverage?: number;
  voteCount?: number;
  runtime?: number;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  genre?: string;
  cast?: Array<{
    tmdbId: number;
    name: string;
    character: string;
    order: number;
    profilePath?: string | null;
  }>;
}

interface PartialActorData {
  tmdbId: number;
  name: string;
  popularity?: number;
  profilePath?: string | null;
  gender?: number;
  biography?: string;
  birthday?: string;
  deathday?: string | null;
  placeOfBirth?: string;
  knownForDepartment?: string;
  homepage?: string;
  imdbId?: string;
  alsoKnownAs?: string[];
}

interface IngestProgress {
  phase: string;
  discoveredMovies: number;
  processedMovies: number;
  totalActors: number;
  processedActors: number;
  errors: number;
  percentComplete: number;
}

// ── Config ─────────────────────────────────────────────────────────────────

const CHECKPOINT_PATH = path.join(process.cwd(), 'tmdb_checkpoint.json');
const MAX_RETRIES = 3;
const MIN_REQUEST_INTERVAL_MS = 250; // 4 req/sec max (conservative)

// ── State ──────────────────────────────────────────────────────────────────

let _cancelled = false;
let _lastRequestTime = 0;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Checkpoint I/O ─────────────────────────────────────────────────────────

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    } catch {
      // corrupt checkpoint, start fresh
    }
  }
  return {
    phase: 'idle',
    discoveredMovies: [],
    processedMovies: [],
    actorIds: [],
    processedActors: [],
    movieData: {},
    actorData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function saveCheckpoint(cp: Checkpoint) {
  cp.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function clearCheckpoint() {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    fs.unlinkSync(CHECKPOINT_PATH);
  }
}

// ── Rate-limited fetch wrapper ─────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  if (_cancelled) throw new Error('Ingestion cancelled');

  // Enforce minimum interval between requests
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  _lastRequestTime = Date.now();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchFn();
    } catch (err: any) {
      if (err instanceof TMDBError && err.status === 429) {
        const wait = 5000 * (attempt + 1);
        console.log(`[TMDB] Rate limited, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (attempt < retries - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Phase 1: Discover all Hindi movies ─────────────────────────────────────

export async function discoverAllHindiMovies(
  onProgress?: (msg: string) => void
): Promise<number[]> {
  const cp = loadCheckpoint();
  if (cp.phase !== 'idle' && cp.phase !== 'discover') {
    return cp.discoveredMovies;
  }

  cp.phase = 'discover';
  saveCheckpoint(cp);

  const discovered = new Set(cp.discoveredMovies);
  let page = 1;
  let totalPages = 1;

  onProgress?.(`Starting movie discovery...`);

  do {
    if (_cancelled) break;

    try {
      const data = await rateLimitedFetch(() => discoverBollywoodMovies(page));
      totalPages = data.total_pages;

      for (const movie of data.results) {
        discovered.add(movie.id);
      }

      cp.discoveredMovies = Array.from(discovered);
      saveCheckpoint(cp);

      onProgress?.(`Discovered page ${page}/${totalPages} — ${discovered.size} movies total`);
      page++;
    } catch (err: any) {
      cp.errors.push(`Discover page ${page}: ${err.message}`);
      saveCheckpoint(cp);
      onProgress?.(`Error on page ${page}: ${err.message}. Retrying...`);
      await sleep(5000);
    }
  } while (page <= totalPages && !_cancelled);

  onProgress?.(`Discovery complete: ${discovered.size} Hindi movies found`);
  return Array.from(discovered);
}

// ── Phase 2: Fetch movie details + credits ─────────────────────────────────

export async function fetchMovieDetailsAndCredits(
  onProgress?: (msg: string) => void
): Promise<void> {
  const cp = loadCheckpoint();
  if (cp.phase !== 'discover' && cp.phase !== 'movie_details') {
    return;
  }

  cp.phase = 'movie_details';
  saveCheckpoint(cp);

  const movieIds = cp.discoveredMovies.filter((id) => !cp.processedMovies.includes(id));
  const actorIdSet = new Set(cp.actorIds);
  let processed = 0;

  onProgress?.(`Fetching details for ${movieIds.length} movies...`);

  for (const movieId of movieIds) {
    if (_cancelled) break;

    try {
      const [details, credits] = await Promise.all([
        rateLimitedFetch(() => getMovieDetails(movieId)),
        rateLimitedFetch(() => getMovieCredits(movieId)),
      ]);

      const movieData: PartialMovieData = {
        tmdbId: movieId,
        title: details.title,
        originalTitle: details.original_title,
        overview: details.overview,
        releaseDate: details.release_date,
        releaseYear: details.release_date ? parseInt(details.release_date.split('-')[0]) : undefined,
        posterPath: details.poster_path,
        backdropPath: (details as any).backdrop_path,
        popularity: details.popularity,
        voteAverage: (details as any).vote_average,
        voteCount: (details as any).vote_count,
        runtime: (details as any).runtime,
        tagline: (details as any).tagline,
        status: (details as any).status,
        budget: (details as any).budget,
        revenue: (details as any).revenue,
        genre: details.genres?.[0]?.name || normalizeGenre(details.genre_ids),
        cast: credits.cast.slice(0, 30).map((c) => ({
          tmdbId: c.id,
          name: c.name,
          character: c.character,
          order: c.order,
          profilePath: c.profile_path,
        })),
      };

      cp.movieData[movieId] = movieData;

      for (const castMember of credits.cast.slice(0, 30)) {
        actorIdSet.add(castMember.id);
      }

      cp.actorIds = Array.from(actorIdSet);
      cp.processedMovies.push(movieId);
      processed++;

      if (processed % 10 === 0) {
        saveCheckpoint(cp);
        onProgress?.(`Movies: ${cp.processedMovies.length}/${cp.discoveredMovies.length} — Actors found: ${actorIdSet.size}`);
      }
    } catch (err: any) {
      cp.errors.push(`Movie ${movieId}: ${err.message}`);
      cp.processedMovies.push(movieId); // mark as processed so we don't retry infinitely
      saveCheckpoint(cp);
    }
  }

  saveCheckpoint(cp);
  onProgress?.(`Movie details complete. ${cp.processedMovies.length} movies, ${cp.actorIds.length} unique actors`);
}

// ── Phase 3: Fetch actor details ───────────────────────────────────────────

export async function fetchActorDetails(
  onProgress?: (msg: string) => void
): Promise<void> {
  const cp = loadCheckpoint();
  if (cp.phase !== 'movie_details' && cp.phase !== 'actor_details') {
    return;
  }

  cp.phase = 'actor_details';
  saveCheckpoint(cp);

  const actorIds = cp.actorIds.filter((id) => !cp.processedActors.includes(id));
  let processed = 0;

  onProgress?.(`Fetching details for ${actorIds.length} actors...`);

  for (const actorId of actorIds) {
    if (_cancelled) break;

    try {
      const person = await rateLimitedFetch(() => getPersonDetails(actorId));

      const actorData: PartialActorData = {
        tmdbId: actorId,
        name: person.name,
        popularity: person.popularity,
        profilePath: person.profile_path,
        gender: person.gender,
        biography: (person as any).biography,
        birthday: (person as any).birthday,
        deathday: (person as any).deathday,
        placeOfBirth: (person as any).place_of_birth,
        knownForDepartment: person.known_for_department,
        homepage: (person as any).homepage,
        imdbId: (person as any).imdb_id,
        alsoKnownAs: (person as any).also_known_as || [],
      };

      cp.actorData[actorId] = actorData;
      cp.processedActors.push(actorId);
      processed++;

      if (processed % 20 === 0) {
        saveCheckpoint(cp);
        onProgress?.(`Actors: ${cp.processedActors.length}/${cp.actorIds.length}`);
      }
    } catch (err: any) {
      cp.errors.push(`Actor ${actorId}: ${err.message}`);
      cp.processedActors.push(actorId);
      saveCheckpoint(cp);
    }
  }

  saveCheckpoint(cp);
  onProgress?.(`Actor details complete. ${cp.processedActors.length} actors`);
}

// ── Phase 4: Upsert everything to DB ───────────────────────────────────────

export async function upsertToDatabase(
  clearExisting = false,
  onProgress?: (msg: string) => void
): Promise<{
  actorsCreated: number;
  moviesCreated: number;
  castLinksCreated: number;
  aliasesCreated: number;
  errors: string[];
}> {
  const cp = loadCheckpoint();
  cp.phase = 'complete';
  saveCheckpoint(cp);

  const errors: string[] = [...cp.errors];

  if (clearExisting) {
    onProgress?.('Clearing existing TMDB data...');
    await prisma.gameMove.deleteMany();
    await prisma.game.deleteMany();
    await prisma.leaderboard.deleteMany();
    await prisma.dailyChallenge.deleteMany();
    await prisma.moderationQueue.deleteMany();
    await prisma.alias.deleteMany();
    await prisma.movieCast.deleteMany();
    await prisma.movie.deleteMany();
    await prisma.actor.deleteMany();
  }

  // ── Upsert Actors ──
  onProgress?.(`Upserting ${Object.keys(cp.actorData).length} actors...`);
  const actorTmdbToDbId = new Map<number, number>();
  let actorsCreated = 0;

  for (const actor of Object.values(cp.actorData)) {
    try {
      const existing = await prisma.actor.findFirst({
        where: { tmdbId: actor.tmdbId },
      });

      if (existing) {
        await prisma.actor.update({
          where: { id: existing.id },
          data: {
            name: actor.name,
            normalizedName: normalizeText(actor.name),
            profileImageUrl: getImageUrl(actor.profilePath ?? null, 'w185'),
            description: actor.biography || null,
            birthday: actor.birthday ? new Date(actor.birthday) : undefined,
            deathday: actor.deathday ? new Date(actor.deathday) : undefined,
            placeOfBirth: actor.placeOfBirth || null,
            knownForDepartment: actor.knownForDepartment || null,
            homepage: actor.homepage || null,
            imdbId: actor.imdbId || null,
            popularityScore: actor.popularity || 0,
            gender: actor.gender === 1 ? 'female' : actor.gender === 2 ? 'male' : null,
            isBollywood: true,
            isActive: true,
          },
        });
        actorTmdbToDbId.set(actor.tmdbId, existing.id);
      } else {
        const created = await prisma.actor.create({
          data: {
            tmdbId: actor.tmdbId,
            name: actor.name,
            normalizedName: normalizeText(actor.name),
            profileImageUrl: getImageUrl(actor.profilePath ?? null, 'w185'),
            description: actor.biography || null,
            birthday: actor.birthday ? new Date(actor.birthday) : undefined,
            deathday: actor.deathday ? new Date(actor.deathday) : undefined,
            placeOfBirth: actor.placeOfBirth || null,
            knownForDepartment: actor.knownForDepartment || null,
            homepage: actor.homepage || null,
            imdbId: actor.imdbId || null,
            popularityScore: actor.popularity || 0,
            gender: actor.gender === 1 ? 'female' : actor.gender === 2 ? 'male' : null,
            isBollywood: true,
            isActive: true,
          },
        });
        actorTmdbToDbId.set(actor.tmdbId, created.id);
        actorsCreated++;
      }
    } catch (err: any) {
      errors.push(`Actor upsert "${actor.name}": ${err.message}`);
    }
  }

  // ── Upsert Movies ──
  onProgress?.(`Upserting ${Object.keys(cp.movieData).length} movies...`);
  const movieTmdbToDbId = new Map<number, number>();
  let moviesCreated = 0;

  for (const movie of Object.values(cp.movieData)) {
    try {
      const existing = await prisma.movie.findFirst({
        where: { tmdbId: movie.tmdbId },
      });

      const moviePayload = {
        tmdbId: movie.tmdbId,
        title: movie.title,
        normalizedTitle: normalizeText(movie.title),
        originalTitle: movie.originalTitle || null,
        releaseYear: movie.releaseYear || null,
        releaseDate: movie.releaseDate ? new Date(movie.releaseDate) : undefined,
        originalLanguage: 'hi',
        posterUrl: getImageUrl(movie.posterPath ?? null, 'w342'),
        backdropUrl: getImageUrl(movie.backdropPath ?? null, 'w780'),
        description: movie.overview || null,
        runtime: movie.runtime || null,
        tagline: movie.tagline || null,
        status: movie.status || null,
        voteAverage: movie.voteAverage || null,
        voteCount: movie.voteCount || null,
        budget: movie.budget || null,
        revenue: movie.revenue || null,
        popularityScore: movie.popularity || 0,
        genre: movie.genre || 'drama',
        isHindi: true,
        isBollywood: true,
        isDocumentary: movie.genre === 'documentary',
        region: 'hindi',
      };

      if (existing) {
        await prisma.movie.update({ where: { id: existing.id }, data: moviePayload });
        movieTmdbToDbId.set(movie.tmdbId, existing.id);
      } else {
        const created = await prisma.movie.create({ data: moviePayload });
        movieTmdbToDbId.set(movie.tmdbId, created.id);
        moviesCreated++;
      }
    } catch (err: any) {
      errors.push(`Movie upsert "${movie.title}": ${err.message}`);
    }
  }

  // ── Create Cast Links ──
  onProgress?.('Creating cast links...');
  let castLinksCreated = 0;

  for (const movie of Object.values(cp.movieData)) {
    const movieDbId = movieTmdbToDbId.get(movie.tmdbId);
    if (!movieDbId) continue;

    for (const castMember of movie.cast || []) {
      const actorDbId = actorTmdbToDbId.get(castMember.tmdbId);
      if (!actorDbId) continue;

      try {
        const existing = await prisma.movieCast.findFirst({
          where: { movieId: movieDbId, actorId: actorDbId },
        });

        if (!existing) {
          await prisma.movieCast.create({
            data: {
              movieId: movieDbId,
              actorId: actorDbId,
              characterName: castMember.character || null,
              billingOrder: castMember.order,
            },
          });
          castLinksCreated++;
        }
      } catch (err: any) {
        errors.push(`Cast link ${movie.title} <-> ${castMember.name}: ${err.message}`);
      }
    }
  }

  // ── Create Aliases ──
  onProgress?.('Creating aliases...');
  let aliasesCreated = 0;

  // Actor aliases
  for (const actor of Object.values(cp.actorData)) {
    const actorDbId = actorTmdbToDbId.get(actor.tmdbId);
    if (!actorDbId) continue;

    for (const alias of actor.alsoKnownAs || []) {
      if (!alias || alias.length < 2) continue;
      try {
        const normalized = normalizeText(alias);
        const existing = await prisma.alias.findFirst({
          where: { entityType: 'actor', actorId: actorDbId, normalizedAlias: normalized },
        });
        if (!existing) {
          await prisma.alias.create({
            data: {
              entityType: 'actor',
              actorId: actorDbId,
              alias,
              normalizedAlias: normalized,
            },
          });
          aliasesCreated++;
        }
      } catch (err: any) {
        errors.push(`Alias "${alias}" for "${actor.name}": ${err.message}`);
      }
    }
  }

  // Movie aliases from original title
  for (const movie of Object.values(cp.movieData)) {
    if (!movie.originalTitle || movie.originalTitle === movie.title) continue;
    const movieDbId = movieTmdbToDbId.get(movie.tmdbId);
    if (!movieDbId) continue;

    try {
      const normalized = normalizeText(movie.originalTitle);
      const existing = await prisma.alias.findFirst({
        where: { entityType: 'movie', movieId: movieDbId, normalizedAlias: normalized },
      });
      if (!existing) {
        await prisma.alias.create({
          data: {
            entityType: 'movie',
            movieId: movieDbId,
            alias: movie.originalTitle,
            normalizedAlias: normalized,
          },
        });
        aliasesCreated++;
      }
    } catch (err: any) {
      errors.push(`Alias "${movie.originalTitle}" for "${movie.title}": ${err.message}`);
    }
  }

  // ── Fetch & Store Actor Movie Credits ──
  onProgress?.('Fetching actor movie credits from TMDB...');
  let creditsStored = 0;
  const actorEntries = Array.from(actorTmdbToDbId.entries());
  for (let i = 0; i < actorEntries.length; i++) {
    const [tmdbId, dbId] = actorEntries[i];
    try {
      // Clear existing credits first to avoid duplicates on re-runs
      await prisma.actorMovieCredit.deleteMany({ where: { actorId: dbId } });

      const credits = await rateLimitedFetch(() => getPersonMovieCredits(tmdbId));
      const creditData = credits.cast.map((c) => ({
        actorId: dbId,
        tmdbMovieId: c.id,
        title: c.title,
        popularity: c.popularity,
        character: c.character || null,
        releaseDate: c.release_date || null,
      }));

      if (creditData.length > 0) {
        await prisma.actorMovieCredit.createMany({ data: creditData });
        creditsStored += creditData.length;
      }

      if (i % 50 === 0) {
        onProgress?.(`Actor credits: ${i + 1}/${actorEntries.length}`);
      }
    } catch (err: any) {
      errors.push(`Actor credits ${tmdbId}: ${err.message}`);
    }
  }

  onProgress?.(`Ingestion complete! ${creditsStored} actor credits stored.`);
  return { actorsCreated, moviesCreated, castLinksCreated, aliasesCreated, errors };
}

// ── Full pipeline ──────────────────────────────────────────────────────────

export async function runFullTMDBIngestion(
  options: { clearExisting?: boolean } = {},
  onProgress?: (msg: string) => void
): Promise<{
  actorsCreated: number;
  moviesCreated: number;
  castLinksCreated: number;
  aliasesCreated: number;
  errors: string[];
}> {
  _cancelled = false;

  try {
    // Phase 1: Discover
    const cp = loadCheckpoint();
    if (cp.phase === 'idle') {
      await discoverAllHindiMovies(onProgress);
    }

    // Phase 2: Movie details
    if (!_cancelled) {
      await fetchMovieDetailsAndCredits(onProgress);
    }

    // Phase 3: Actor details
    if (!_cancelled) {
      await fetchActorDetails(onProgress);
    }

    // Phase 4: DB upsert
    if (!_cancelled) {
      const result = await upsertToDatabase(options.clearExisting, onProgress);
      clearCheckpoint();
      return result;
    }

    return { actorsCreated: 0, moviesCreated: 0, castLinksCreated: 0, aliasesCreated: 0, errors: ['Cancelled'] };
  } catch (err: any) {
    onProgress?.(`Fatal error: ${err.message}`);
    throw err;
  }
}

// ── Control functions ──────────────────────────────────────────────────────

export function cancelIngestion() {
  _cancelled = true;
}

export function getProgress(): IngestProgress {
  const cp = loadCheckpoint();
  const totalSteps = cp.discoveredMovies.length + cp.actorIds.length || 1;
  const completedSteps = cp.processedMovies.length + cp.processedActors.length;
  const percent = Math.min(100, Math.round((completedSteps / totalSteps) * 100));

  return {
    phase: cp.phase,
    discoveredMovies: cp.discoveredMovies.length,
    processedMovies: cp.processedMovies.length,
    totalActors: cp.actorIds.length,
    processedActors: cp.processedActors.length,
    errors: cp.errors.length,
    percentComplete: percent,
  };
}

export function resetCheckpoint() {
  clearCheckpoint();
  _cancelled = false;
}

// Helper re-export
import { normalizeGenre } from './tmdb';
