import { FastifyInstance } from 'fastify';
import { prisma } from '@bollywood-connect/db';
import { calculateScore, normalizeText, Difficulty } from '@bollywood-connect/shared';
import { buildGraph, findShortestPath, isValidMove, generatePair, getHint } from './game-engine';
import { registerAuthRoutes, optionalAuthHook } from './auth';

function normalize(value: string) {
  return normalizeText(value);
}

export async function registerRoutes(app: FastifyInstance) {
  // Auth routes
  await registerAuthRoutes(app);

  // Search actors and movies
  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return { actors: [], movies: [] };

    const normalized = normalize(q);

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
        OR: [
          { id: { in: movieIds } },
          { normalizedTitle: { contains: normalized } },
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
  app.post('/games', { onRequest: optionalAuthHook }, async (request) => {
    const body = request.body as {
      difficulty?: Difficulty;
      mode?: string;
      theme?: string;
      region?: string;
      startActorId?: number;
      targetActorId?: number;
      playerName?: string;
    };

    let startActorId = body.startActorId;
    let targetActorId = body.targetActorId;

    if (!startActorId || !targetActorId) {
      const pair = await generatePair(body.difficulty || 'medium');
      startActorId = pair.startActorId;
      targetActorId = pair.targetActorId;
    }

    const user = request.user;
    const playerName = user?.username || body.playerName || 'Anonymous';

    const game = await prisma.game.create({
      data: {
        startActorId,
        targetActorId,
        difficulty: body.difficulty || 'medium',
        mode: body.mode || 'classic',
        theme: body.theme,
        region: body.region,
        playerName,
        userId: user?.id || null,
      },
      include: { startActor: true, targetActor: true },
    });

    // Add first move (start actor)
    await prisma.gameMove.create({
      data: {
        gameId: game.id,
        moveNumber: 1,
        entityType: 'actor',
        entityId: startActorId,
        entityName: game.startActor.name,
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
    const currentNode = lastMove
      ? { type: lastMove.entityType as 'actor' | 'movie', id: lastMove.entityId }
      : { type: 'actor' as const, id: game.startActorId };

    const nextNode = { type: entityType, id: entityId };

    const { actorToMovies, movieToActors } = await buildGraph();

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
    if (entityType === 'actor' && entityId === game.targetActorId) {
      const now = new Date();
      const timeTaken = Math.floor((now.getTime() - game.createdAt.getTime()) / 1000);

      const path = findShortestPath(game.startActorId, game.targetActorId, actorToMovies, movieToActors);
      const shortestPathLength = path ? Math.floor((path.length - 1) / 2) : 0;
      const actualMoves = game.moves.length; // excluding first node

      const score = calculateScore(shortestPathLength, actualMoves, timeTaken, game.hintsUsed, game.difficulty as Difficulty);

      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'completed',
          completedAt: now,
          movesCount: actualMoves,
          timeTaken,
          score,
        },
      });

      // Add to leaderboard
      const startActor = await prisma.actor.findUnique({ where: { id: game.startActorId } });
      const targetActor = await prisma.actor.findUnique({ where: { id: game.targetActorId } });

      await prisma.leaderboard.create({
        data: {
          playerName: game.playerName || 'Anonymous',
          userId: game.userId,
          gameId,
          difficulty: game.difficulty,
          mode: game.mode,
          movesCount: actualMoves,
          timeTaken,
          hintsUsed: game.hintsUsed,
          score,
          startActor: startActor?.name || '',
          targetActor: targetActor?.name || '',
          pathLength: shortestPathLength,
        },
      });

      return { move, won: true, score, timeTaken };
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
    const startActor = await prisma.actor.findUnique({ where: { id: game.startActorId } });
    await prisma.gameMove.create({
      data: {
        gameId,
        moveNumber: 1,
        entityType: 'actor',
        entityId: game.startActorId,
        entityName: startActor?.name || '',
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
    const { difficulty, mode, limit = '50' } = request.query as { difficulty?: string; mode?: string; limit?: string };

    const entries = await prisma.leaderboard.findMany({
      where: {
        ...(difficulty ? { difficulty } : {}),
        ...(mode ? { mode } : {}),
      },
      orderBy: { score: 'desc' },
      take: parseInt(limit),
    });

    return entries as any[];
  });

  // Get daily challenge
  app.get('/daily', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const challenge = await prisma.dailyChallenge.findUnique({
      where: { date: today },
      include: { startActor: true },
    });

    if (!challenge) {
      // Generate one
      const pair = await generatePair('medium');
      const newChallenge = await prisma.dailyChallenge.create({
        data: {
          date: today,
          startActorId: pair.startActorId,
          targetActorId: pair.targetActorId,
          difficulty: 'medium',
        },
        include: { startActor: true },
      });
      return newChallenge;
    }

    return challenge;
  });

  // Submit daily challenge
  app.post('/daily/submit', async (request) => {
    const { gameId } = request.body as { gameId: string };
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    return { game };
  });

  // Admin stats
  app.get('/admin/stats', async () => {
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
  app.get('/admin/moderation', async () => {
    return prisma.moderationQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Get all actors (for admin)
  app.get('/admin/actors', async (request) => {
    const { skip = '0', take = '50' } = request.query as { skip?: string; take?: string };
    return prisma.actor.findMany({
      skip: parseInt(skip),
      take: parseInt(take),
      orderBy: { popularityScore: 'desc' },
    });
  });

  // Get all movies (for admin)
  app.get('/admin/movies', async (request) => {
    const { skip = '0', take = '50' } = request.query as { skip?: string; take?: string };
    return prisma.movie.findMany({
      skip: parseInt(skip),
      take: parseInt(take),
      orderBy: { releaseYear: 'desc' },
    });
  });

  // ===== TMDB INGESTION ENDPOINTS =====

  // Check TMDB connection
  app.get('/admin/tmdb/status', async () => {
    const { checkTMDBConnection } = await import('./ingestion.js');
    return checkTMDBConnection();
  });

  // Start full TMDB ingestion
  app.post('/admin/tmdb/ingest', async (request, reply) => {
    const { ingestBollywoodFromTMDB } = await import('./ingestion.js');
    const body = request.body as {
      actorCount?: number;
      moviePages?: number;
      includeRegional?: boolean;
    };

    // Run ingestion asynchronously and return job ID
    const jobId = `ingest-${Date.now()}`;
    reply.send({ jobId, status: 'started', message: 'Ingestion started in background' });

    try {
      const result = await ingestBollywoodFromTMDB(body);
      console.log(`[${jobId}] Ingestion complete:`, result);
    } catch (err: any) {
      console.error(`[${jobId}] Ingestion failed:`, err.message);
    }
  });

  // Refresh all TMDB data (wipe and re-ingest)
  app.post('/admin/tmdb/refresh', async (request, reply) => {
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

  // ===== FULL TMDB INGESTION (Hindi only, all movies + actors) =====

  // Start full TMDB ingestion (Hindi movies + all actors from credits)
  app.post('/admin/tmdb/full-ingest', async (request, reply) => {
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
  app.get('/admin/tmdb/progress', async () => {
    const { getProgress } = await import('./tmdb-ingestion.js');
    return getProgress();
  });

  // Cancel running ingestion
  app.post('/admin/tmdb/cancel', async () => {
    const { cancelIngestion } = await import('./tmdb-ingestion.js');
    cancelIngestion();
    return { cancelled: true };
  });

  // Reset checkpoint
  app.post('/admin/tmdb/reset', async () => {
    const { resetCheckpoint } = await import('./tmdb-ingestion.js');
    resetCheckpoint();
    return { reset: true };
  });

  // ===== WIKIPEDIA INGESTION ENDPOINTS (FREE ALTERNATIVE) =====

  // Check Wikipedia dataset status
  app.get('/admin/wikipedia/status', async () => {
    const { checkWikipediaStatus } = await import('./wikipedia-ingestion.js');
    return checkWikipediaStatus();
  });

  // Ingest from pre-built Wikipedia dataset
  app.post('/admin/wikipedia/ingest', async (request, reply) => {
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

  // Run live Wikipedia scraper (background)
  app.post('/admin/wikipedia/scrape', async (request, reply) => {
    const { runWikipediaScraper } = await import('./wikipedia-ingestion.js');
    const body = request.body as { years?: string };

    const result = await runWikipediaScraper(body.years);
    return result;
  });
}
