import { FastifyInstance } from 'fastify';
import { prisma } from '@bollywood-connect/db';
import { normalizeText, Difficulty, GameMode, REGIONS, THEMES } from '@bollywood-connect/shared';
import {
  buildGraph,
  calculateModeScore,
  generatePuzzleByMode,
  getShortestPath,
  getThemeMovieWhere,
  isValidMove,
  getHint,
  type GraphNode,
} from './game-engine';
import { registerAuthRoutes, optionalAuthHook, adminHook } from './auth';

function normalize(value: string) {
  return normalizeText(value);
}

const gameModes = new Set<GameMode>([
  'classic',
  'daily',
  'speedrun',
  'shortest',
  'party',
  'regional',
  'movie-to-movie',
  'theme',
]);

function asGameMode(value?: string): GameMode {
  return value && gameModes.has(value as GameMode) ? (value as GameMode) : 'classic';
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function startOfDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function isBetterLeaderboardScore(mode: string, next: { score: number; timeTaken: number; movesCount: number }, current: { score: number; timeTaken: number; movesCount: number }) {
  if (mode === 'speedrun') {
    if (next.timeTaken !== current.timeTaken) return next.timeTaken < current.timeTaken;
    return next.movesCount < current.movesCount;
  }
  if (mode === 'shortest') {
    if (next.movesCount !== current.movesCount) return next.movesCount < current.movesCount;
    return next.score > current.score;
  }
  return next.score > current.score;
}

async function getNodeName(node: GraphNode) {
  if (node.type === 'actor') {
    return (await prisma.actor.findUnique({ where: { id: node.id }, select: { name: true } }))?.name || '';
  }
  return (await prisma.movie.findUnique({ where: { id: node.id }, select: { title: true } }))?.title || '';
}

function getPuzzleDataError(error: unknown) {
  if (!(error instanceof Error)) return null;
  return error.message.startsWith('Not enough') || error.message.includes('must be actor-to-actor')
    ? error.message
    : null;
}

async function getOrCreateDailyChallenge() {
  const dateKey = todayKey();
  const date = startOfDateKey(dateKey);
  const existing = await prisma.dailyChallenge.findUnique({
    where: { date },
    include: { startActor: true, targetActor: true },
  });
  if (existing) return existing;

  const puzzle = await generatePuzzleByMode({
    mode: 'daily',
    difficulty: 'medium',
    seed: dateKey,
  });
  if (puzzle.startNode.type !== 'actor' || puzzle.targetNode.type !== 'actor') {
    throw new Error('Daily challenge must be actor-to-actor');
  }

  return prisma.dailyChallenge.create({
    data: {
      date,
      startActorId: puzzle.startNode.id,
      targetActorId: puzzle.targetNode.id,
      difficulty: 'medium',
      description: 'One shared Bollywood connection for everyone today.',
    },
    include: { startActor: true, targetActor: true },
  });
}

export async function registerRoutes(app: FastifyInstance) {
  // Auth routes
  await registerAuthRoutes(app);

  // Search actors and movies
  app.get('/search', async (request, reply) => {
    const { q, region, theme } = request.query as { q?: string; region?: string; theme?: string };
    if (!q || q.length < 2) return { actors: [], movies: [] };

    const normalized = normalize(q);
    const themeMovieWhere = getThemeMovieWhere(theme);
    const movieFilter =
      region || theme
        ? {
            movies: {
              some: {
                movie: {
                  ...(region ? { region } : {}),
                  ...themeMovieWhere,
                },
              },
            },
          }
        : {};

    // Search aliases first
    const aliases = await prisma.alias.findMany({
      where: { normalizedAlias: { contains: normalized } },
      take: 10,
    });

    const actorIds = aliases.filter((a: any) => a.entityType === 'actor' && a.actorId).map((a: any) => a.actorId!);
    const movieIds = aliases.filter((a: any) => a.entityType === 'movie' && a.movieId).map((a: any) => a.movieId!);

    const actors = await prisma.actor.findMany({
      where: {
        isBollywood: true,
        ...movieFilter,
        OR: [
          { id: { in: actorIds } },
          { normalizedName: { contains: normalized } },
        ],
      },
      orderBy: { popularityScore: 'desc' },
      take: 10,
    });

    const movies = await prisma.movie.findMany({
      where: {
        isBollywood: true,
        ...(region ? { region } : {}),
        AND: [
          themeMovieWhere,
          {
            OR: [
              { id: { in: movieIds } },
              { normalizedTitle: { contains: normalized } },
            ],
          },
        ],
      },
      orderBy: { popularityScore: 'desc' },
      take: 10,
    });

    return { actors, movies };
  });

  // Get actor by ID
  app.get('/actors/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.actor.findUnique({
      where: { id: parseInt(id) },
      include: { movies: { include: { movie: true } } },
    });
  });

  // Get movie by ID
  app.get('/movies/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.movie.findUnique({
      where: { id: parseInt(id) },
      include: { actors: { include: { actor: true } } },
    });
  });

  // Create a new game
  app.post('/games', { onRequest: optionalAuthHook }, async (request, reply) => {
    const body = request.body as {
      difficulty?: Difficulty;
      mode?: string;
      theme?: string;
      region?: string;
      startActorId?: number;
      targetActorId?: number;
      playerName?: string;
    };

    const mode = asGameMode(body.mode);
    const difficulty = body.difficulty || 'medium';
    let startNode: GraphNode;
    let targetNode: GraphNode;
    let optimalMoves: number | undefined;
    let dailyDate: string | undefined;

    try {
      if (mode === 'daily') {
        const challenge = await getOrCreateDailyChallenge();
        startNode = { type: 'actor', id: challenge.startActorId };
        targetNode = { type: 'actor', id: challenge.targetActorId };
        dailyDate = todayKey(challenge.date);
        const { actorToMovies, movieToActors } = await buildGraph();
        const path = getShortestPath(startNode, targetNode, actorToMovies, movieToActors);
        optimalMoves = path ? path.length - 1 : undefined;
      } else if (body.startActorId && body.targetActorId && mode !== 'movie-to-movie') {
        const startActorId = body.startActorId;
        const targetActorId = body.targetActorId;
        const [startActor, targetActor] = await Promise.all([
          prisma.actor.findFirst({ where: { id: startActorId, isBollywood: true, isActive: true }, select: { id: true } }),
          prisma.actor.findFirst({ where: { id: targetActorId, isBollywood: true, isActive: true }, select: { id: true } }),
        ]);
        if (!startActor || !targetActor) {
          return reply.status(400).send({ error: 'Actor is not available in the Bollywood graph' });
        }
        startNode = { type: 'actor', id: startActorId };
        targetNode = { type: 'actor', id: targetActorId };
        const { actorToMovies, movieToActors } = await buildGraph();
        const path = getShortestPath(startNode, targetNode, actorToMovies, movieToActors);
        if (!path) {
          return reply.status(400).send({ error: 'These actors do not have a valid connection yet' });
        }
        optimalMoves = path.length - 1;
      } else {
        const puzzle = await generatePuzzleByMode({
          mode,
          difficulty,
          region: body.region,
          theme: body.theme,
        });
        startNode = puzzle.startNode;
        targetNode = puzzle.targetNode;
        optimalMoves = puzzle.optimalMoves;
      }
    } catch (error) {
      const message = getPuzzleDataError(error);
      if (message) return reply.status(400).send({ error: message });
      throw error;
    }

    const user = request.user;
    const playerName = user?.username || body.playerName || 'Anonymous';
    const startName = await getNodeName(startNode);

    const game = await prisma.game.create({
      data: {
        startActorId: startNode.type === 'actor' ? startNode.id : null,
        targetActorId: targetNode.type === 'actor' ? targetNode.id : null,
        startMovieId: startNode.type === 'movie' ? startNode.id : null,
        targetMovieId: targetNode.type === 'movie' ? targetNode.id : null,
        difficulty,
        mode,
        theme: body.theme,
        region: mode === 'regional' ? body.region || 'hindi' : body.region,
        playerName,
        userId: user?.id || null,
        optimalMoves,
        dailyDate,
      },
      include: { startActor: true, targetActor: true, startMovie: true, targetMovie: true },
    });

    // Add first move (start node)
    await prisma.gameMove.create({
      data: {
        gameId: game.id,
        moveNumber: 1,
        entityType: startNode.type,
        entityId: startNode.id,
        entityName: startName,
      },
    });

    return game;
  });

  // Get game by ID
  app.get('/games/:gameId', async (request) => {
    const { gameId } = request.params as { gameId: string };
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        startActor: true,
        targetActor: true,
        startMovie: true,
        targetMovie: true,
        moves: { orderBy: { moveNumber: 'asc' } },
      },
    });
    if (!game) return null;

    // Enrich moves with image URLs
    const enrichedMoves = await Promise.all(
      game.moves.map(async (move: any) => {
        if (move.entityType === 'actor') {
          const actor = await prisma.actor.findUnique({
            where: { id: move.entityId },
            select: { profileImageUrl: true, trivia: true, description: true },
          });
          return { ...move, imageUrl: actor?.profileImageUrl || null, trivia: actor?.trivia || null, description: actor?.description || null };
        } else {
          const movie = await prisma.movie.findUnique({
            where: { id: move.entityId },
            select: { posterUrl: true, trivia: true, description: true },
          });
          return { ...move, imageUrl: movie?.posterUrl || null, trivia: movie?.trivia || null, description: movie?.description || null };
        }
      })
    );

    return { ...game, moves: enrichedMoves };
  });

  // Make a move
  app.post('/games/:gameId/move', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const { entityType, entityId } = request.body as { entityType: 'actor' | 'movie'; entityId: number };

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { moves: { orderBy: { moveNumber: 'asc' } } },
    });

    if (!game || game.status !== 'active') {
      return reply.status(400).send({ error: 'Game not active' });
    }

    const lastMove = game.moves[game.moves.length - 1];
    const currentNode: GraphNode = lastMove
      ? { type: lastMove.entityType as 'actor' | 'movie', id: lastMove.entityId }
      : game.startMovieId
        ? { type: 'movie', id: game.startMovieId }
        : game.startActorId
          ? { type: 'actor', id: game.startActorId }
          : { type: entityType, id: entityId };

    const nextNode: GraphNode = { type: entityType, id: entityId };
    const targetNode: GraphNode | null = game.targetMovieId
      ? { type: 'movie', id: game.targetMovieId }
      : game.targetActorId
        ? { type: 'actor', id: game.targetActorId }
        : null;

    if (!targetNode) {
      return reply.status(400).send({ error: 'Game target missing' });
    }

    const { actorToMovies, movieToActors } = await buildGraph({ region: game.region || undefined, theme: game.theme || undefined });

    if (!isValidMove(currentNode, nextNode, actorToMovies, movieToActors)) {
      return reply.status(400).send({ error: 'Invalid move' });
    }

    // Check if already visited
    const alreadyVisited = game.moves.some((m: any) => m.entityType === entityType && m.entityId === entityId);
    if (alreadyVisited) {
      return reply.status(400).send({ error: 'Already visited this node' });
    }

    const entityName =
      entityType === 'actor'
        ? (await prisma.actor.findUnique({ where: { id: entityId } }))?.name
        : (await prisma.movie.findUnique({ where: { id: entityId } }))?.title;

    if (!entityName) {
      return reply.status(400).send({ error: 'Entity not found' });
    }

    const move = await prisma.gameMove.create({
      data: {
        gameId,
        moveNumber: game.moves.length + 1,
        entityType,
        entityId,
        entityName,
      },
    });

    // Check win condition
    if (entityType === targetNode.type && entityId === targetNode.id) {
      const now = new Date();
      const timeTaken = Math.floor((now.getTime() - game.createdAt.getTime()) / 1000);

      const startNode: GraphNode | null = game.startMovieId
        ? { type: 'movie', id: game.startMovieId }
        : game.startActorId
          ? { type: 'actor', id: game.startActorId }
          : null;
      const path = startNode ? getShortestPath(startNode, targetNode, actorToMovies, movieToActors) : null;
      const shortestPathLength = path ? path.length - 1 : game.optimalMoves || 0;
      const actualMoves = game.moves.length; // excluding first node
      const isPerfect = shortestPathLength > 0 && actualMoves === shortestPathLength;

      const score = calculateModeScore({
        mode: asGameMode(game.mode),
        difficulty: game.difficulty as Difficulty,
        shortestEdges: shortestPathLength,
        actualEdges: actualMoves,
        timeTaken,
        hintsUsed: game.hintsUsed,
        isPerfect,
      });

      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'completed',
          completedAt: now,
          movesCount: actualMoves,
          timeTaken,
          score,
          optimalMoves: shortestPathLength,
          isPerfect,
        },
      });

      // Add to leaderboard
      const startName = startNode ? await getNodeName(startNode) : '';
      const targetName = await getNodeName(targetNode);
      const leaderboardData = {
        playerName: game.playerName || 'Anonymous',
        userId: game.userId,
        gameId,
        difficulty: game.difficulty,
        mode: game.mode,
        movesCount: actualMoves,
        timeTaken,
        hintsUsed: game.hintsUsed,
        score,
        startActor: startName,
        targetActor: targetName,
        pathLength: shortestPathLength,
        dailyDate: game.dailyDate,
        region: game.region,
        theme: game.theme,
        optimalMoves: shortestPathLength,
        isPerfect,
      };

      if (game.mode === 'daily' && game.userId && game.dailyDate) {
        const existing = await prisma.leaderboard.findFirst({
          where: { userId: game.userId, mode: 'daily', dailyDate: game.dailyDate },
        });
        if (!existing) {
          await prisma.leaderboard.create({ data: leaderboardData });
        } else if (isBetterLeaderboardScore(game.mode, leaderboardData, existing)) {
          await prisma.leaderboard.update({
            where: { id: existing.id },
            data: { ...leaderboardData, gameId: existing.gameId },
          });
        }
      } else {
        await prisma.leaderboard.create({
        data: {
          ...leaderboardData,
        },
        });
      }

      return { move, won: true, score, timeTaken, optimalMoves: shortestPathLength, isPerfect };
    }

    await prisma.game.update({
      where: { id: gameId },
      data: { movesCount: game.moves.length },
    });

    return { move, won: false };
  });

  // Undo last move
  app.post('/games/:gameId/undo', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { moves: { orderBy: { moveNumber: 'asc' } } },
    });

    if (!game || game.status !== 'active' || game.moves.length <= 1) {
      return reply.status(400).send({ error: 'Cannot undo' });
    }

    const lastMove = game.moves[game.moves.length - 1];
    await prisma.gameMove.delete({ where: { id: lastMove.id } });
    await prisma.game.update({
      where: { id: gameId },
      data: { undoCount: { increment: 1 } },
    });

    return { undone: true };
  });

  // Reset game
  app.post('/games/:gameId/reset', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game) return reply.status(404).send({ error: 'Game not found' });

    await prisma.gameMove.deleteMany({ where: { gameId } });
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'active', movesCount: 0, hintsUsed: 0, undoCount: 0, score: 0 },
    });

    // Recreate first move
    const startNode: GraphNode | null = game.startMovieId
      ? { type: 'movie', id: game.startMovieId }
      : game.startActorId
        ? { type: 'actor', id: game.startActorId }
        : null;
    if (!startNode) {
      return reply.status(400).send({ error: 'Game start missing' });
    }

    await prisma.gameMove.create({
      data: {
        gameId,
        moveNumber: 1,
        entityType: startNode.type,
        entityId: startNode.id,
        entityName: await getNodeName(startNode),
      },
    });

    return { reset: true };
  });

  // Get hint
  app.post('/games/:gameId/hint', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const { type } = request.body as { type?: string };

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== 'active') {
      return reply.status(400).send({ error: 'Game not active' });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: { hintsUsed: { increment: 1 } },
    });

    const hint = await getHint(gameId, type || 'soft');
    return hint || { message: 'No hint available' };
  });

  // Get leaderboard
  app.get('/leaderboard', async (request) => {
    const { difficulty, mode, limit = '50', date, region, theme } = request.query as {
      difficulty?: string;
      mode?: string;
      limit?: string;
      date?: string;
      region?: string;
      theme?: string;
    };

    const orderBy =
      mode === 'speedrun'
        ? [{ timeTaken: 'asc' as const }, { movesCount: 'asc' as const }, { score: 'desc' as const }]
        : mode === 'shortest'
          ? [{ movesCount: 'asc' as const }, { timeTaken: 'asc' as const }, { score: 'desc' as const }]
          : [{ score: 'desc' as const }, { timeTaken: 'asc' as const }];

    const entries = await prisma.leaderboard.findMany({
      where: {
        ...(difficulty ? { difficulty } : {}),
        ...(mode ? { mode } : {}),
        ...(date ? { dailyDate: date } : {}),
        ...(region ? { region } : {}),
        ...(theme ? { theme } : {}),
      },
      orderBy,
      take: parseInt(limit),
    });

    return entries as any[];
  });

  // Get daily challenge
  app.get('/daily', { onRequest: optionalAuthHook }, async (request) => {
    const challenge = await getOrCreateDailyChallenge();
    const date = todayKey(challenge.date);
    const completedToday = request.user
      ? await prisma.leaderboard.findFirst({
          where: { userId: request.user.id, mode: 'daily', dailyDate: date },
          orderBy: { score: 'desc' },
        })
      : null;

    return { ...challenge, date, completedToday };
  });

  // Submit daily challenge
  app.post('/daily/submit', async (request) => {
    const { gameId } = request.body as { gameId: string };
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    return { game };
  });

  app.get('/game/modes', async () => {
    return { modes: [...gameModes] };
  });

  app.get('/metadata/regions', async () => {
    const counts = await prisma.movie.groupBy({
      by: ['region'],
      _count: { region: true },
      where: { isBollywood: true },
    });
    const countMap = new Map(counts.map((item) => [item.region || 'unknown', item._count.region]));
    return REGIONS.map((region) => ({
      ...region,
      availableMovies: countMap.get(region.id) || 0,
      available: (countMap.get(region.id) || 0) > 0,
    }));
  });

  app.get('/metadata/themes', async () => {
    const themes = await Promise.all(
      THEMES.map(async (theme) => {
        const availableMovies = await prisma.movie.count({
          where: {
            isBollywood: true,
            ...getThemeMovieWhere(theme.id),
          },
        });
        return {
          ...theme,
          supported: availableMovies > 0,
          availableMovies,
          available: availableMovies > 0,
        };
      })
    );
    return themes;
  });

  // ===== ADMIN ROUTES (protected by adminHook) =====
  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', adminHook);

    // Admin stats
    adminApp.get('/stats', async () => {
      const [
        totalActors,
        totalMovies,
        totalGames,
        totalPlayers,
        pendingModerations,
      ] = await Promise.all([
        prisma.actor.count(),
        prisma.movie.count(),
        prisma.game.count(),
        prisma.game.groupBy({ by: ['playerId'] }).then((r) => r.length),
        prisma.moderationQueue.count({ where: { status: 'pending' } }),
      ]);

      return {
        totalActors,
        totalMovies,
        totalGames,
        totalPlayers,
        pendingModerations,
      };
    });

    // Admin moderation queue
    adminApp.get('/moderation', async () => {
      return prisma.moderationQueue.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
    });

    // Get all actors (for admin)
    adminApp.get('/actors', async (request) => {
      const { skip = '0', take = '50' } = request.query as { skip?: string; take?: string };
      return prisma.actor.findMany({
        skip: parseInt(skip),
        take: parseInt(take),
        orderBy: { popularityScore: 'desc' },
      });
    });

    // Get all movies (for admin)
    adminApp.get('/movies', async (request) => {
      const { skip = '0', take = '50' } = request.query as { skip?: string; take?: string };
      return prisma.movie.findMany({
        skip: parseInt(skip),
        take: parseInt(take),
        orderBy: { releaseYear: 'desc' },
      });
    });

    // ===== TMDB INGESTION ENDPOINTS =====

    // Check TMDB connection
    adminApp.get('/tmdb/status', async () => {
      const { checkTMDBConnection } = await import('./ingestion.js');
      return checkTMDBConnection();
    });

    // Start full TMDB ingestion
    adminApp.post('/tmdb/ingest', async (request, reply) => {
      const { ingestBollywoodFromTMDB } = await import('./ingestion.js');
      const body = request.body as {
        actorCount?: number;
        moviePages?: number;
        includeRegional?: boolean;
      };

      const jobId = `ingest-${Date.now()}`;
      reply.send({ jobId, status: 'started', message: 'Ingestion started in background' });

      try {
        const result = await ingestBollywoodFromTMDB(body);
        console.log(`[${jobId}] Ingestion complete:`, result);
      } catch (err: any) {
        console.error(`[${jobId}] Ingestion failed:`, err.message);
      }
    });

    // Refresh all TMDB data
    adminApp.post('/tmdb/refresh', async (request, reply) => {
      const { refreshTMDBData } = await import('./ingestion.js');
      const body = request.body as {
        actorCount?: number;
        moviePages?: number;
        includeRegional?: boolean;
      };

      const jobId = `refresh-${Date.now()}`;
      reply.send({ jobId, status: 'started', message: 'Refresh started in background' });

      try {
        const result = await refreshTMDBData(body);
        console.log(`[${jobId}] Refresh complete:`, result);
      } catch (err: any) {
        console.error(`[${jobId}] Refresh failed:`, err.message);
      }
    });

    // Start full TMDB ingestion (Hindi movies + all actors)
    adminApp.post('/tmdb/full-ingest', async (request, reply) => {
      const { runFullTMDBIngestion, resetCheckpoint } = await import('./tmdb-ingestion.js');
      const body = request.body as { clearExisting?: boolean };

      resetCheckpoint();
      const jobId = `full-ingest-${Date.now()}`;
      reply.send({ jobId, status: 'started', message: 'Full TMDB ingestion started. This may take 1-2 hours.' });

      try {
        const result = await runFullTMDBIngestion(
          { clearExisting: body.clearExisting },
          (msg: string) => console.log(`[${jobId}] ${msg}`)
        );
        console.log(`[${jobId}] Full ingestion complete:`, result);
      } catch (err: any) {
        console.error(`[${jobId}] Full ingestion failed:`, err.message);
      }
    });

    // Get full ingestion progress
    adminApp.get('/tmdb/progress', async () => {
      const { getProgress } = await import('./tmdb-ingestion.js');
      return getProgress();
    });

    // Cancel running ingestion
    adminApp.post('/tmdb/cancel', async () => {
      const { cancelIngestion } = await import('./tmdb-ingestion.js');
      cancelIngestion();
      return { cancelled: true };
    });

    // Reset checkpoint
    adminApp.post('/tmdb/reset', async () => {
      const { resetCheckpoint } = await import('./tmdb-ingestion.js');
      resetCheckpoint();
      return { reset: true };
    });

    // ===== WIKIPEDIA INGESTION ENDPOINTS =====

    // Check Wikipedia dataset status
    adminApp.get('/wikipedia/status', async () => {
      const { checkWikipediaStatus } = await import('./wikipedia-ingestion.js');
      return checkWikipediaStatus();
    });

    // Ingest from pre-built Wikipedia dataset
    adminApp.post('/wikipedia/ingest', async (request, reply) => {
      const { ingestFromWikipediaDataset } = await import('./wikipedia-ingestion.js');
      const body = request.body as { clearExisting?: boolean };

      const jobId = `wiki-ingest-${Date.now()}`;
      reply.send({ jobId, status: 'started', message: 'Wikipedia ingestion started' });

      try {
        const result = await ingestFromWikipediaDataset({ clearExisting: body.clearExisting });
        console.log(`[${jobId}] Wikipedia ingestion complete:`, result);
      } catch (err: any) {
        console.error(`[${jobId}] Wikipedia ingestion failed:`, err.message);
      }
    });

    // Run live Wikipedia scraper
    adminApp.post('/wikipedia/scrape', async (request, reply) => {
      const { runWikipediaScraper } = await import('./wikipedia-ingestion.js');
      const body = request.body as { years?: string };

      const result = await runWikipediaScraper(body.years);
      return result;
    });
  }, { prefix: '/admin' });
}
