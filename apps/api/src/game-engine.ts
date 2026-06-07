import { prisma } from '@bollywood-connect/db';
import { calculateScore, Difficulty, GameMode, THEMES } from '@bollywood-connect/shared';
import type { Prisma } from '@bollywood-connect/db';

const MIN_HIGH_POP_MOVIES = 5;
const MIN_MOVIE_POPULARITY = 3;
const SUPPORTED_THEME_IDS = new Set(THEMES.map((theme) => theme.id));

export interface GraphNode {
  type: 'actor' | 'movie';
  id: number;
}

export interface GraphBuildOptions {
  region?: string;
  theme?: string;
}

export interface GeneratedPuzzle {
  startNode: GraphNode;
  targetNode: GraphNode;
  path: GraphNode[];
  optimalMoves: number;
  region?: string;
  theme?: string;
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
}

export interface ModeScoreInput {
  mode: GameMode;
  difficulty: Difficulty;
  shortestEdges: number;
  actualEdges: number;
  timeTaken: number;
  hintsUsed: number;
  isPerfect?: boolean;
}

function createSeededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return ((hash >>> 0) % 1000000) / 1000000;
  };
}

function pickRandom<T>(items: T[], random = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

export function getThemeMovieWhere(theme?: string): Prisma.MovieWhereInput {
  if (!theme) return {};

  const config = THEMES.find((item) => item.id === theme);
  if (!config || !SUPPORTED_THEME_IDS.has(theme)) {
    return { id: -1 };
  }

  if (config.filter.decades) {
    const [from, to] = config.filter.decades;
    return { releaseYear: { gte: from, lte: to } };
  }

  if (config.filter.genres?.length) {
    return {
      OR: config.filter.genres.map((genre) => ({
        genre: { contains: genre, mode: 'insensitive' as const },
      })),
    };
  }

  return { id: -1 };
}

// Build adjacency lists from database
export async function buildGraph(options: GraphBuildOptions = {}) {
  const movieWhere: Prisma.MovieWhereInput = {
    isBollywood: true,
    ...(options.region ? { region: options.region } : {}),
    ...getThemeMovieWhere(options.theme),
  };

  const movies = await prisma.movie.findMany({
    where: movieWhere,
    select: { id: true },
  });

  const movieIds = movies.map((movie) => movie.id);
  if (movieIds.length === 0) {
    return { actors: [], movies, actorToMovies: new Map<number, number[]>(), movieToActors: new Map<number, number[]>() };
  }

  const cast = await prisma.movieCast.findMany({
    where: { movieId: { in: movieIds } },
  });

  const actorIds = [...new Set(cast.map((item) => item.actorId))];
  const actors = await prisma.actor.findMany({
    where: { id: { in: actorIds }, isBollywood: true, isActive: true },
    select: { id: true, popularityScore: true, knownForDepartment: true },
  });

  const validActorIds = new Set(actors.map((actor) => actor.id));
  const actorToMovies = new Map<number, number[]>();
  const movieToActors = new Map<number, number[]>();

  for (const c of cast) {
    if (!validActorIds.has(c.actorId)) continue;
    if (!actorToMovies.has(c.actorId)) actorToMovies.set(c.actorId, []);
    actorToMovies.get(c.actorId)!.push(c.movieId);

    if (!movieToActors.has(c.movieId)) movieToActors.set(c.movieId, []);
    movieToActors.get(c.movieId)!.push(c.actorId);
  }

  return { actors, movies, actorToMovies, movieToActors };
}

export function getNeighbors(
  node: GraphNode,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>
): GraphNode[] {
  if (node.type === 'actor') {
    const movies = actorToMovies.get(node.id) || [];
    return movies.map((id) => ({ type: 'movie' as const, id }));
  } else {
    const actors = movieToActors.get(node.id) || [];
    return actors.map((id) => ({ type: 'actor' as const, id }));
  }
}

export function getShortestPath(
  start: GraphNode,
  target: GraphNode,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>,
  excluded?: Set<string>
): GraphNode[] | null {
  const queue: GraphNode[][] = [[start]];
  const visited = new Set<string>([`${start.type}:${start.id}`]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    if (current.type === target.type && current.id === target.id) {
      return path;
    }

    for (const neighbor of getNeighbors(current, actorToMovies, movieToActors)) {
      const key = `${neighbor.type}:${neighbor.id}`;
      if (visited.has(key)) continue;
      if (excluded?.has(key)) continue;
      visited.add(key);
      queue.push([...path, neighbor]);
    }
  }

  return null;
}

export function validatePath(
  path: GraphNode[],
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>
): PathValidationResult {
  if (path.length < 2) {
    return { valid: false, error: 'Path must contain at least two nodes' };
  }

  const visited = new Set<string>();
  for (let index = 0; index < path.length; index++) {
    const current = path[index];
    const key = `${current.type}:${current.id}`;
    if (visited.has(key)) {
      return { valid: false, error: 'Path cannot repeat nodes' };
    }
    visited.add(key);

    if (index === 0) continue;
    const previous = path[index - 1];
    if (!isValidMove(previous, current, actorToMovies, movieToActors)) {
      return { valid: false, error: 'Path contains an invalid connection' };
    }
  }

  return { valid: true };
}

export function calculateModeScore(input: ModeScoreInput): number {
  const base = calculateScore(
    input.shortestEdges,
    input.actualEdges,
    input.timeTaken,
    input.hintsUsed,
    input.difficulty
  );

  const modeMultiplier: Record<GameMode, number> = {
    classic: 1,
    daily: 1.15,
    speedrun: 1.2,
    shortest: 1.25,
    party: 1,
    regional: 1.1,
    'movie-to-movie': 1.15,
    theme: 1.1,
  };

  const speedBonus = input.mode === 'speedrun' ? Math.max(0, 900 - input.timeTaken * 8) : 0;
  const perfectBonus = input.isPerfect && input.mode === 'shortest' ? 650 : 0;
  const dailyBonus = input.isPerfect && input.mode === 'daily' ? 150 : 0;

  return Math.max(0, Math.floor(base * modeMultiplier[input.mode] + speedBonus + perfectBonus + dailyBonus));
}

export function findShortestPath(
  startActorId: number,
  targetActorId: number,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>
): GraphNode[] | null {
  return getShortestPath({ type: 'actor', id: startActorId }, { type: 'actor', id: targetActorId }, actorToMovies, movieToActors);
}

export function findShortestPathFromNode(
  start: GraphNode,
  targetActorId: number,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>,
  excluded?: Set<string>
): GraphNode[] | null {
  return getShortestPath(start, { type: 'actor', id: targetActorId }, actorToMovies, movieToActors, excluded);
}

export function isValidMove(
  current: GraphNode,
  next: GraphNode,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>
): boolean {
  if (current.type === 'actor' && next.type === 'movie') {
    return (actorToMovies.get(current.id) || []).includes(next.id);
  }
  if (current.type === 'movie' && next.type === 'actor') {
    return (movieToActors.get(current.id) || []).includes(next.id);
  }
  return false;
}

export async function getQualifiedActorPool() {
  // Count high-popularity external credits per actor using raw query for performance
  const results = await prisma.$queryRaw<
    Array<{ actorId: number; popularityScore: number; knownForDepartment: string; creditCount: bigint }>
  >`
    SELECT a.id as "actorId", a."popularityScore", a."knownForDepartment", COUNT(amc.id) as "creditCount"
    FROM "Actor" a
    LEFT JOIN "ActorMovieCredit" amc ON amc."actorId" = a.id AND amc.popularity > ${MIN_MOVIE_POPULARITY}
    WHERE a."isBollywood" = true AND a."isActive" = true AND a."knownForDepartment" = 'Acting'
    GROUP BY a.id
    HAVING COUNT(amc.id) >= ${MIN_HIGH_POP_MOVIES}
  `;

  return results.map((r) => ({
    id: r.actorId,
    popularityScore: r.popularityScore,
    knownForDepartment: r.knownForDepartment,
  }));
}

export async function getCandidateActorPool(options: GraphBuildOptions = {}) {
  const { actors, actorToMovies } = await buildGraph(options);
  return actors.filter((actor) => (actorToMovies.get(actor.id)?.length || 0) > 0);
}

export async function isQualifiedStartActor(actorId: number): Promise<boolean> {
  const actor = await prisma.actor.findUnique({
    where: { id: actorId },
    select: {
      knownForDepartment: true,
      isBollywood: true,
      isActive: true,
    },
  });

  if (!actor || !actor.isBollywood || !actor.isActive || actor.knownForDepartment !== 'Acting') {
    return false;
  }

  const count = await prisma.actorMovieCredit.count({
    where: {
      actorId,
      popularity: { gt: MIN_MOVIE_POPULARITY },
    },
  });

  return count >= MIN_HIGH_POP_MOVIES;
}

export async function generatePair(difficulty: Difficulty) {
  const { actorToMovies, movieToActors } = await buildGraph();
  const actors = await getQualifiedActorPool();

  // Build non-overlapping pools by popularity score + minimum movie count.
  // Hard gate: only actors with knownForDepartment === 'Acting' AND at least
  // MIN_HIGH_POP_MOVIES movies with popularityScore > MIN_MOVIE_POPULARITY
  // can be start/end points. Difficulty tiers refine the pool further.
  const movieCount = (a: any) => actorToMovies.get(a.id)?.length || 0;
  let pool: typeof actors = [];

  if (difficulty === 'easy') {
    pool = actors.filter((a: any) => a.popularityScore >= 2 && movieCount(a) >= 5);
  } else if (difficulty === 'medium') {
    pool = actors.filter((a: any) => a.popularityScore >= 0.5 && a.popularityScore < 2 && movieCount(a) >= 3);
  } else if (difficulty === 'hard') {
    pool = actors.filter((a: any) => a.popularityScore < 0.5);
  } else {
    // legend — any qualified actor, but force longer paths
    pool = actors;
  }

  // Fallback: if pool is too small, relax constraints but stay within qualified actors
  if (pool.length < 10) {
    pool = actors.filter((a: any) => a.popularityScore >= 1 && movieCount(a) >= 3);
  }
  if (pool.length < 2) {
    throw new Error('Not enough qualified actors in database to generate a game pair');
  }

  const minEdges = { easy: 1, medium: 2, hard: 3, legend: 5 }[difficulty];
  const maxEdges = { easy: 3, medium: 5, hard: 7, legend: 12 }[difficulty];

  // Precompute edge counts for the pool to speed up random selection
  const poolEntries = pool.filter((a) => (actorToMovies.get(a.id)?.length || 0) >= minEdges);

  for (let attempt = 0; attempt < 2000; attempt++) {
    const start = poolEntries[Math.floor(Math.random() * poolEntries.length)];
    const target = poolEntries[Math.floor(Math.random() * poolEntries.length)];

    if (!start || !target) continue;
    if (start.id === target.id) continue;

    const path = findShortestPath(start.id, target.id, actorToMovies, movieToActors);
    if (!path) continue;

    const edges = (path.length - 1) / 2;
    if (edges >= minEdges && edges <= maxEdges) {
      return { startActorId: start.id, targetActorId: target.id, path };
    }
  }

  // Fallback: return first valid pair we can find regardless of edge count
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const start = pool[i];
      const target = pool[j];
      const path = findShortestPath(start.id, target.id, actorToMovies, movieToActors);
      if (path) {
        return { startActorId: start.id, targetActorId: target.id, path };
      }
    }
  }

  throw new Error('Could not find any valid actor pair for this difficulty');
}

function edgeCount(path: GraphNode[]) {
  return Math.max(0, path.length - 1);
}

async function generateActorPuzzle(
  difficulty: Difficulty,
  options: GraphBuildOptions = {},
  seed?: string
): Promise<GeneratedPuzzle> {
  if (!options.region && !options.theme && !seed) {
    const pair = await generatePair(difficulty);
    return {
      startNode: { type: 'actor', id: pair.startActorId },
      targetNode: { type: 'actor', id: pair.targetActorId },
      path: pair.path,
      optimalMoves: edgeCount(pair.path),
      region: options.region,
      theme: options.theme,
    };
  }

  const { actors, actorToMovies, movieToActors } = await buildGraph(options);
  const pool = actors.filter((actor) => (actorToMovies.get(actor.id)?.length || 0) > 0);
  if (pool.length < 2) {
    throw new Error('Not enough data yet to generate this mode. Try Hindi / Bollywood or Classic mode.');
  }

  const random = seed ? createSeededRandom(seed) : Math.random;
  const minEdges = { easy: 2, medium: 4, hard: 6, legend: 8 }[difficulty];
  const maxEdges = { easy: 6, medium: 10, hard: 14, legend: 24 }[difficulty];

  for (let attempt = 0; attempt < 2000; attempt++) {
    const start = pickRandom(pool, random);
    const target = pickRandom(pool, random);
    if (!start || !target || start.id === target.id) continue;

    const path = getShortestPath(
      { type: 'actor', id: start.id },
      { type: 'actor', id: target.id },
      actorToMovies,
      movieToActors
    );
    if (!path) continue;
    const edges = edgeCount(path);
    if (edges >= minEdges && edges <= maxEdges) {
      return {
        startNode: { type: 'actor', id: start.id },
        targetNode: { type: 'actor', id: target.id },
        path,
        optimalMoves: edges,
        region: options.region,
        theme: options.theme,
      };
    }
  }

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const path = getShortestPath(
        { type: 'actor', id: pool[i].id },
        { type: 'actor', id: pool[j].id },
        actorToMovies,
        movieToActors
      );
      if (path) {
        return {
          startNode: { type: 'actor', id: pool[i].id },
          targetNode: { type: 'actor', id: pool[j].id },
          path,
          optimalMoves: edgeCount(path),
          region: options.region,
          theme: options.theme,
        };
      }
    }
  }

  throw new Error('Could not find a valid connection for this mode yet.');
}

async function generateMoviePuzzle(
  difficulty: Difficulty,
  options: GraphBuildOptions = {},
  seed?: string
): Promise<GeneratedPuzzle> {
  const { movies, actorToMovies, movieToActors } = await buildGraph(options);
  const pool = movies.filter((movie) => (movieToActors.get(movie.id)?.length || 0) > 0);
  if (pool.length < 2) {
    throw new Error('Not enough movie data yet to generate Movie-to-Movie mode.');
  }

  const random = seed ? createSeededRandom(seed) : Math.random;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const start = pickRandom(pool, random);
    const target = pickRandom(pool, random);
    if (!start || !target || start.id === target.id) continue;
    const path = getShortestPath(
      { type: 'movie', id: start.id },
      { type: 'movie', id: target.id },
      actorToMovies,
      movieToActors
    );
    if (!path) continue;
    return {
      startNode: { type: 'movie', id: start.id },
      targetNode: { type: 'movie', id: target.id },
      path,
      optimalMoves: edgeCount(path),
      region: options.region,
      theme: options.theme,
    };
  }

  throw new Error('Could not find a valid movie-to-movie puzzle.');
}

export async function generatePuzzleByMode({
  mode,
  difficulty,
  region,
  theme,
  seed,
}: {
  mode: GameMode;
  difficulty: Difficulty;
  region?: string;
  theme?: string;
  seed?: string;
}): Promise<GeneratedPuzzle> {
  if (mode === 'movie-to-movie') {
    return generateMoviePuzzle(difficulty, { region, theme }, seed);
  }

  if (mode === 'regional') {
    return generateActorPuzzle(difficulty, { region: region || 'hindi' }, seed);
  }

  if (mode === 'theme') {
    return generateActorPuzzle(difficulty, { theme }, seed);
  }

  return generateActorPuzzle(difficulty, {}, seed);
}

export async function getHint(
  gameId: string,
  hintType: string
): Promise<{ message: string; bestNext?: GraphNode } | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: { orderBy: { moveNumber: 'asc' } } },
  });

  if (!game || game.status !== 'active') return null;

  const { actorToMovies, movieToActors } = await buildGraph({ region: game.region || undefined, theme: game.theme || undefined });
  const targetNode: GraphNode | null = game.targetMovieId
    ? { type: 'movie', id: game.targetMovieId }
    : game.targetActorId
      ? { type: 'actor', id: game.targetActorId }
      : null;

  if (!targetNode) return null;

  // Get current position
  const lastMove = game.moves[game.moves.length - 1];
  const currentNode: GraphNode = lastMove
    ? { type: lastMove.entityType as 'actor' | 'movie', id: lastMove.entityId }
    : game.startMovieId
      ? { type: 'movie', id: game.startMovieId }
      : game.startActorId
        ? { type: 'actor', id: game.startActorId }
        : targetNode;

  // Build set of already-visited nodes so we don't suggest revisiting them
  const excluded = new Set<string>();
  for (const move of game.moves) {
    excluded.add(`${move.entityType}:${move.entityId}`);
  }

  // Find shortest path from current position to target, excluding visited nodes
  const path = getShortestPath(currentNode, targetNode, actorToMovies, movieToActors, excluded);

  if (!path) return null;

  // The path starts at currentNode, so the next step is always at index 1
  const nextNode = path[1];
  if (!nextNode) return null;

  if (hintType === 'best-next') {
    if (nextNode.type === 'actor') {
      const actor = await prisma.actor.findUnique({ where: { id: nextNode.id } });
      if (actor) {
        return { message: `Best next step: ${actor.name}`, bestNext: nextNode };
      }
    } else {
      const movie = await prisma.movie.findUnique({ where: { id: nextNode.id } });
      if (movie) {
        return { message: `Best next step: ${movie.title}`, bestNext: nextNode };
      }
    }
    return { message: 'Here is the optimal next step', bestNext: nextNode };
  }

  if (hintType === 'first-letter') {
    if (nextNode.type === 'actor') {
      const actor = await prisma.actor.findUnique({ where: { id: nextNode.id } });
      if (actor) {
        return { message: `The actor starts with "${actor.name[0]}"` };
      }
    } else {
      const movie = await prisma.movie.findUnique({ where: { id: nextNode.id } });
      if (movie) {
        return { message: `The movie starts with "${movie.title[0]}"` };
      }
    }
  }

  if (hintType === 'decade') {
    if (nextNode.type === 'movie') {
      const movie = await prisma.movie.findUnique({ where: { id: nextNode.id } });
      if (movie?.releaseYear) {
        const decade = Math.floor(movie.releaseYear / 10) * 10;
        return { message: `This connection is from the ${decade}s` };
      }
    }
    return { message: 'Try a film from a different era' };
  }

  if (hintType === 'soft') {
    if (nextNode.type === 'movie') {
      const movie = await prisma.movie.findUnique({ where: { id: nextNode.id } });
      if (movie) {
        return { message: `Consider a ${movie.genre || ''} film${movie.releaseYear ? ` from ${movie.releaseYear}` : ''}` };
      }
    } else {
      const actor = await prisma.actor.findUnique({ where: { id: nextNode.id } });
      if (actor) {
        return { message: `Think about a co-star of ${actor.name}` };
      }
    }
  }

  return { message: 'Keep exploring the Bollywood connection!' };
}
