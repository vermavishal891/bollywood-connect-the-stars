'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Film,
  Undo2,
  RotateCcw,
  Lightbulb,
  Share2,
  Trophy,
  Clock,
  ArrowRight,
  Home,
  Sparkles,
  Search,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { createGame, getGame, makeMove, undoMove, resetGame, getHint, search } from '@/lib/api';

interface GameMove {
  id: number;
  entityType: 'actor' | 'movie';
  entityId: number;
  entityName: string;
  imageUrl?: string | null;
  trivia?: string | null;
  description?: string | null;
}

interface GameData {
  id: string;
  startActor: { id: number; name: string; profileImageUrl?: string | null; description?: string | null; trivia?: string | null };
  targetActor: { id: number; name: string; profileImageUrl?: string | null; description?: string | null; trivia?: string | null };
  difficulty: string;
  mode: string;
  status: string;
  score: number;
  movesCount: number;
  hintsUsed: number;
  timeTaken?: number;
  moves: GameMove[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ActorAvatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover border-2 border-cinema-gold shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-cinema-600 flex items-center justify-center text-cinema-gold font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials(name)}
    </div>
  );
}

function MoviePoster({ url, title, size = 40 }: { url?: string | null; title: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className="rounded-lg object-cover border border-cinema-red-light/50 shrink-0"
        style={{ width: size * 0.75, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className="rounded-lg bg-cinema-700 flex items-center justify-center text-cinema-red-light shrink-0"
      style={{ width: size * 0.75, height: size }}
    >
      <Film className="w-5 h-5" />
    </div>
  );
}

function TriviaCard({ title, description, trivia, onClose }: { title: string; description?: string | null; trivia?: string | null; onClose: () => void }) {
  const facts: string[] = trivia ? (typeof trivia === 'string' ? JSON.parse(trivia) : trivia) : [];
  const randomFact = facts.length > 0 ? facts[Math.floor(Math.random() * facts.length)] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="cinema-card p-4 mb-4 border-l-4 border-cinema-gold"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-cinema-gold text-sm mb-1">{title}</h3>
          {description && <p className="text-xs text-gray-300 mb-2 line-clamp-3">{description}</p>}
          {randomFact && (
            <p className="text-xs text-cinema-gold-light">
              <span className="font-semibold">Did you know?</span> {randomFact}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'classic';
  const difficulty = searchParams.get('difficulty') || 'medium';
  const region = searchParams.get('region') || undefined;
  const theme = searchParams.get('theme') || undefined;

  const [game, setGame] = useState<GameData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ actors: any[]; movies: any[] }>({ actors: [], movies: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [shareText, setShareText] = useState('');
  const [triviaEntity, setTriviaEntity] = useState<{ name: string; description?: string | null; trivia?: string | null } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const newGame = await createGame({ mode, difficulty, region, theme });
        const fullGame = await getGame(newGame.id);
        setGame(fullGame);
      } catch (err: any) {
        toast.error(err.message || 'Failed to start game');
      }
    };
    init();
  }, [mode, difficulty, region, theme]);

  useEffect(() => {
    if (!game || game.status !== 'active') return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [game?.status]);

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery.length < 2) {
        setSearchResults({ actors: [], movies: [] });
        return;
      }
      setIsSearching(true);
      try {
        const results = await search(searchQuery);
        setSearchResults(results);
      } catch {}
      setIsSearching(false);
    };
    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleMove = async (entityType: 'actor' | 'movie', entityId: number, entityName: string) => {
    if (!game || game.status !== 'active' || isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await makeMove(game.id, { entityType, entityId });
      const updated = await getGame(game.id);
      setGame(updated);
      setSearchQuery('');
      setSearchResults({ actors: [], movies: [] });

      const lastMove = updated.moves[updated.moves.length - 1];
      if (lastMove) {
        setTriviaEntity({
          name: lastMove.entityName,
          description: lastMove.description,
          trivia: lastMove.trivia,
        });
      }

      if (result.won) {
        toast.success(`🎉 You won! Score: ${result.score}`, { duration: 5000 });
        setShareText(
          `I connected ${updated.startActor.name} → ${updated.targetActor.name} in ${updated.movesCount} moves!\n\nCan you beat me?`
        );
        setShowShare(true);
      }
    } catch (err: any) {
      console.error('Move error:', err);
      toast.error(err.message || 'Invalid move');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = async () => {
    if (!game || game.moves.length <= 1 || isProcessing) return;
    setIsProcessing(true);
    try {
      await undoMove(game.id);
      const updated = await getGame(game.id);
      setGame(updated);
      toast.success('Move undone');
    } catch (err: any) {
      console.error('Undo error:', err);
      toast.error(err.message || 'Cannot undo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!game || isProcessing) return;
    setIsProcessing(true);
    try {
      await resetGame(game.id);
      const updated = await getGame(game.id);
      setGame(updated);
      setTimer(0);
      setShowShare(false);
      setTriviaEntity(null);
      setSearchQuery('');
      setSearchResults({ actors: [], movies: [] });
      toast.success('Game reset');
    } catch (err: any) {
      console.error('Reset error:', err);
      toast.error(err.message || 'Cannot reset');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHint = async (type: string) => {
    if (!game || game.status !== 'active' || isProcessing) return;
    setIsProcessing(true);
    try {
      const hint = await getHint(game.id, type);
      toast(hint.message, { icon: '💡', duration: 4000 });
      const updated = await getGame(game.id);
      setGame(updated);
    } catch (err: any) {
      console.error('Hint error:', err);
      toast.error(err.message || 'No hint available');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewGame = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const newGame = await createGame({ mode, difficulty, region, theme });
      const fullGame = await getGame(newGame.id);
      setGame(fullGame);
      setTimer(0);
      setShowShare(false);
      setTriviaEntity(null);
      setSearchQuery('');
      setSearchResults({ actors: [], movies: [] });
      toast.success('New game started!');
    } catch (err: any) {
      console.error('New game error:', err);
      toast.error(err.message || 'Failed to start new game');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cinema-gold animate-pulse text-xl">Loading game...</div>
      </div>
    );
  }

  const isWon = game.status === 'completed';
  // Game starts with 1 move (start actor). User must pick a movie next.
  // Odd move count = just placed an actor, need movie next.
  // Even move count = just placed a movie, need actor next.
  const isMovieTurn = game.moves.length % 2 === 1;

  return (
    <div className="min-h-screen px-4 py-6">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a25', color: '#fff' } }} />

      <div className="max-w-3xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-bold gold-gradient">Bollywood Connect</h1>
            <p className="text-xs text-gray-400 capitalize">{game.mode} · {game.difficulty}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1 text-cinema-gold">
              <Clock className="w-4 h-4" />
              {formatTime(timer)}
            </div>
            <div className="flex items-center gap-1 text-cinema-gold-light">
              <Trophy className="w-4 h-4" />
              {game.score}
            </div>
          </div>
        </div>

        {/* Trivia Panel */}
        <AnimatePresence>
          {triviaEntity && (
            <TriviaCard
              title={triviaEntity.name}
              description={triviaEntity.description}
              trivia={triviaEntity.trivia}
              onClose={() => setTriviaEntity(null)}
            />
          )}
        </AnimatePresence>

        <div className="cinema-card p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-center">
              <div className="flex flex-col items-center mb-2">
                <ActorAvatar url={game.startActor.profileImageUrl} name={game.startActor.name} size={56} />
                <div className="node-actor inline-flex mt-2">
                  <Star className="w-5 h-5 text-cinema-gold" />
                  <span className="font-bold">{game.startActor.name}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Start</p>
            </div>
            <div className="flex-1 mx-4 flex items-center justify-center">
              <div className="h-0.5 bg-gradient-to-r from-cinema-gold via-cinema-red-light to-cinema-gold flex-1" />
              <ArrowRight className="w-5 h-5 text-cinema-gold mx-2" />
              <div className="h-0.5 bg-gradient-to-r from-cinema-gold via-cinema-red-light to-cinema-gold flex-1" />
            </div>
            <div className="text-center">
              <div className="flex flex-col items-center mb-2">
                <ActorAvatar url={game.targetActor.profileImageUrl} name={game.targetActor.name} size={56} />
                <div className="node-actor inline-flex mt-2 border-cinema-red-light">
                  <Star className="w-5 h-5 text-cinema-red-light" />
                  <span className="font-bold">{game.targetActor.name}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Target</p>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {game.moves.map((move, index) => (
                <motion.div
                  key={move.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                  className={move.entityType === 'actor' ? 'node-actor' : 'node-movie'}
                >
                  {move.entityType === 'actor' ? (
                    <>
                      <ActorAvatar url={move.imageUrl} name={move.entityName} size={36} />
                      <span className="font-medium">{move.entityName}</span>
                    </>
                  ) : (
                    <>
                      <MoviePoster url={move.imageUrl} title={move.entityName} size={36} />
                      <span className="font-medium">{move.entityName}</span>
                    </>
                  )}
                  <span className="ml-auto text-xs text-gray-400">#{index + 1}</span>
                  {move.trivia && (
                    <button
                      onClick={() => setTriviaEntity({ name: move.entityName, description: move.description, trivia: move.trivia })}
                      className="ml-2 text-cinema-gold hover:text-white"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {isWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 text-center p-6 bg-cinema-gold/10 rounded-xl border border-cinema-gold/30"
            >
              <Sparkles className="w-10 h-10 text-cinema-gold mx-auto mb-3" />
              <h2 className="text-2xl font-bold gold-gradient mb-2">Congratulations!</h2>
              <p className="text-gray-300 mb-4">
                You connected {game.startActor.name} to {game.targetActor.name} in {game.movesCount} moves!
              </p>
              <div className="text-3xl font-bold text-cinema-gold mb-4">Score: {game.score}</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {showShare && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareText);
                      toast.success('Copied to clipboard!');
                    }}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Result
                  </button>
                )}
                <button
                  onClick={handleNewGame}
                  disabled={isProcessing}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-40"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  New Game
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {!isWon && (
          <>
            <div className="relative mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isMovieTurn ? 'Search for a movie...' : 'Search for an actor...'}
                  className="search-input pl-10"
                />
              </div>
              {searchQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-2 cinema-card max-h-80 overflow-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-400">Searching...</div>
                  ) : (
                    <>
                      {searchResults.actors.length > 0 && (
                        <div className="p-2">
                          <p className="text-xs text-gray-400 uppercase px-2 mb-1">Actors</p>
                          {searchResults.actors.map((actor) => (
                            <button
                              key={actor.id}
                              onClick={() => handleMove('actor', actor.id, actor.name)}
                              disabled={isMovieTurn}
                              className="w-full text-left px-3 py-2 hover:bg-cinema-700 rounded-lg flex items-center gap-3 disabled:opacity-30"
                            >
                              <ActorAvatar url={actor.profileImageUrl} name={actor.name} size={32} />
                              <div className="flex-1 min-w-0">
                                <span className="block">{actor.name}</span>
                                {actor.description && (
                                  <span className="text-xs text-gray-400 line-clamp-1">{actor.description}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.movies.length > 0 && (
                        <div className="p-2">
                          <p className="text-xs text-gray-400 uppercase px-2 mb-1">Movies</p>
                          {searchResults.movies.map((movie) => (
                            <button
                              key={movie.id}
                              onClick={() => handleMove('movie', movie.id, movie.title)}
                              disabled={!isMovieTurn}
                              className="w-full text-left px-3 py-2 hover:bg-cinema-700 rounded-lg flex items-center gap-3 disabled:opacity-30"
                            >
                              <MoviePoster url={movie.posterUrl} title={movie.title} size={36} />
                              <div className="flex-1 min-w-0">
                                <span className="block">{movie.title}</span>
                                <span className="text-xs text-gray-400">{movie.releaseYear} · {movie.genre}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.actors.length === 0 && searchResults.movies.length === 0 && (
                        <div className="p-4 text-center text-gray-400">No results found</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleUndo}
                disabled={isProcessing || game.moves.length <= 1}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                Undo
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reset
              </button>
              <button onClick={() => handleHint('soft')} className="btn-secondary inline-flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Soft Hint
              </button>
              <button onClick={() => handleHint('first-letter')} className="btn-secondary inline-flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                First Letter
              </button>
              <button onClick={() => handleHint('decade')} className="btn-secondary inline-flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Decade Hint
              </button>
              <button onClick={() => handleHint('best-next')} className="btn-secondary inline-flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Best Next
              </button>
            </div>

            {/* Turn indicator */}
            <div className="text-center mt-4">
              <span className="text-sm text-cinema-gold-light">
                {isMovieTurn ? '🎬 Pick a movie' : '⭐ Pick an actor'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cinema-gold animate-pulse text-xl">Loading...</div>
      </div>
    }>
      <PlayPageContent />
    </Suspense>
  );
}
