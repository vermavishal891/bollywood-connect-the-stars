import { prisma } from '@bollywood-connect/db';
import { Difficulty } from '@bollywood-connect/shared';

const MIN_HIGH_POP_MOVIES = 5;
const MIN_MOVIE_POPULARITY = 3;

export interface GraphNode {
  type: 'actor' | 'movie';
  id: number;
}

// Build adjacency lists from database
export async function buildGraph() {
  const actors = await prisma.actor.findMany({
    where: { isBollywood: true, isActive: true },
    select: { id: true, popularityScore: true, knownForDepartment: true },
  });

  const movies = await prisma.movie.findMany({
    where: { isBollywood: true },
    select: { id: true },
  });

  const cast = await prisma.movieCast.findMany();

  const actorToMovies = new Map<number, number[]>();
  const movieToActors = new Map<number, number[]>();

  for (const c of cast) {
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

export function findShortestPath(
  startActorId: number,
  targetActorId: number,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>
): GraphNode[] | null {
  return findShortestPathFromNode(
    { type: 'actor', id: startActorId },
    targetActorId,
    actorToMovies,
    movieToActors
  );
}

export function findShortestPathFromNode(
  start: GraphNode,
  targetActorId: number,
  actorToMovies: Map<number, number[]>,
  movieToActors: Map<number, number[]>,
  excluded?: Set<string>
): GraphNode[] | null {
  const queue: GraphNode[][] = [[start]];
  const visited = new Set<string>();
  visited.add(`${start.type}:${start.id}`);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    if (current.type === 'actor' && current.id === targetActorId) {
      return path;
    }

    const neighbors = getNeighbors(current, actorToMovies, movieToActors);
    for (const neighbor of neighbors) {
      const key = `${neighbor.type}:${neighbor.id}`;
      if (visited.has(key)) continue;
      if (excluded?.has(key)) continue;
      visited.add(key);
      queue.push([...path, neighbor]);
    }
  }

  return null;
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

export async function getHint(
  gameId: string,
  hintType: string
): Promise<{ message: string; bestNext?: GraphNode } | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: { orderBy: { moveNumber: 'asc' } } },
  });

  if (!game || game.status !== 'active') return null;

  const { actorToMovies, movieToActors } = await buildGraph();

  // Get current position
  const lastMove = game.moves[game.moves.length - 1];
  const currentNode: GraphNode = lastMove
    ? { type: lastMove.entityType as 'actor' | 'movie', id: lastMove.entityId }
    : { type: 'actor', id: game.startActorId };

  // Build set of already-visited nodes so we don't suggest revisiting them
  const excluded = new Set<string>();
  for (const move of game.moves) {
    excluded.add(`${move.entityType}:${move.entityId}`);
  }

  // Find shortest path from current position to target, excluding visited nodes
  const path = findShortestPathFromNode(
    currentNode,
    game.targetActorId,
    actorToMovies,
    movieToActors,
    excluded
  );

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
