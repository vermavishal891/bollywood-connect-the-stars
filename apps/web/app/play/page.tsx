'use client';

import { useState, useEffect, Suspense } from 'react';
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
  ChevronDown,
  Flame,
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

function ActorAvatar({ url, name, size = 96 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover border-4 border-cinema-gold shrink-0"
        style={{
          width: size,
          height: size,
          boxShadow: '0 0 24px rgba(212, 175, 55, 0.35), 0 0 60px rgba(212, 175, 55, 0.1)',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-cinema-600 to-cinema-800 flex items-center justify-center text-cinema-gold font-bold shrink-0 border-4 border-cinema-gold/60"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {getInitials(name)}
    </div>
  );
}

function MoviePoster({ url, title, size = 96 }: { url?: string | null; title: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className="rounded-xl object-cover border-2 border-cinema-red-light/60 shrink-0"
        style={{
          width: size * 0.72,
          height: size,
          boxShadow: '0 8px 24px rgba(229, 9, 20, 0.15)',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-gradient-to-br from-cinema-700 to-cinema-900 flex items-center justify-center text-cinema-red-light shrink-0 border-2 border-cinema-red-light/30"
      style={{ width: size * 0.72, height: size }}
    >
      <Film className="w-8 h-8 opacity-60" />
    </div>
  );
}

function TriviaCard({ title, description, trivia, onClose }: { title: string; description?: string | null; trivia?: string | null; onClose: () => void }) {
  const facts: string[] = trivia ? (typeof trivia === 'string' ? JSON.parse(trivia) : trivia) : [];
  const randomFact = facts.length > 0 ? facts[Math.floor(Math.random() * facts.length)] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="game-card p-5 mb-5 border-l-4 border-cinema-gold"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-cinema-gold text-base mb-1">{title}</h3>
          {description && <p className="text-sm text-gray-300 mb-2 line-clamp-3">{description}</p>}
          {randomFact && (
            <p className="text-sm text-cinema-gold-light">
              <span className="font-semibold">Did you know?</span> {randomFact}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

const springFast = { type: 'spring' as const, stiffness: 500, damping: 28 };
const springPop = { type: 'spring' as const, stiffness: 600, damping: 20 };

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
  const [showHints, setShowHints] = useState(false);

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
        toast.success(`🎉 You won! Score: ${result.score}`, { duration: 4000 });
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
    setShowHints(false);
    try {
      const hint = await getHint(game.id, type);
      toast(hint.message, { icon: '💡', duration: 3000 });
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
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-cinema-gold text-2xl font-bold"
        >
          Loading game...
        </motion.div>
      </div>
    );
  }

  const isWon = game.status === 'completed';
  const isMovieTurn = game.moves.length % 2 === 1;
  const progress = isWon ? 100 : Math.min(100, (game.moves.length / 8) * 100);

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a25', color: '#fff', fontSize: '14px' } }} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors p-2 hover:bg-cinema-800 rounded-xl">
            <Home className="w-6 h-6" />
          </Link>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-display font-bold gold-gradient">Bollywood Connect</h1>
            <p className="text-xs text-gray-400 capitalize tracking-wide mt-1">{game.mode} · {game.difficulty}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-cinema-gold bg-cinema-800/60 px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-semibold">{formatTime(timer)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-cinema-gold-light bg-cinema-800/60 px-3 py-1.5 rounded-full">
              <Trophy className="w-4 h-4" />
              <span className="font-semibold">{game.score}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {!isWon && (
          <div className="mb-6">
            <div className="h-2 bg-cinema-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cinema-gold to-yellow-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={springFast}
              />
            </div>
          </div>
        )}

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

        {/* Hero: Start & Target */}
        <div className="game-card p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between gap-4 md:gap-8">
            {/* Start Actor */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springPop}
              className="flex flex-col items-center text-center flex-1"
            >
              <ActorAvatar url={game.startActor.profileImageUrl} name={game.startActor.name} size={120} />
              <div className="mt-3 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-cinema-gold" />
                <span className="font-bold text-sm md:text-base">{game.startActor.name}</span>
              </div>
              <span className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Start</span>
            </motion.div>

            {/* Arrow */}
            <div className="flex flex-col items-center shrink-0">
              <motion.div
                animate={{ x: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowRight className="w-8 h-8 md:w-10 md:h-10 text-cinema-gold" />
              </motion.div>
            </div>

            {/* Target Actor */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springPop}
              className="flex flex-col items-center text-center flex-1"
            >
              <div className="relative">
                <ActorAvatar url={game.targetActor.profileImageUrl} name={game.targetActor.name} size={120} />
                {!isWon && (
                  <motion.div
                    className="absolute -top-1 -right-1 bg-cinema-red text-white text-xs font-bold px-2 py-0.5 rounded-full"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    TARGET
                  </motion.div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-cinema-red-light" />
                <span className="font-bold text-sm md:text-base">{game.targetActor.name}</span>
              </div>
              <span className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Target</span>
            </motion.div>
          </div>
        </div>

        {/* Moves Timeline */}
        <div className="game-card p-6 md:p-8 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Your Path</h3>

          <div className="relative">
            {/* Vertical connector line */}
            {game.moves.length > 1 && (
              <div className="absolute left-6 md:left-9 top-8 bottom-8 w-0.5 bg-gradient-to-b from-cinema-gold/40 via-cinema-red-light/30 to-cinema-gold/40 rounded-full" />
            )}

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {game.moves.map((move, index) => (
                  <motion.div
                    key={move.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, x: 40 }}
                    transition={springFast}
                    className={`flex items-center gap-4 ${move.entityType === 'actor' ? '' : ''}`}
                  >
                    {/* Number badge */}
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-sm md:text-base z-10 ${
                      move.entityType === 'actor'
                        ? 'bg-cinema-gold/20 text-cinema-gold border-2 border-cinema-gold/50'
                        : 'bg-cinema-red/20 text-cinema-red-light border-2 border-cinema-red-light/50'
                    }`}>
                      {index === 0 ? <Star className="w-4 h-4" /> : index + 1}
                    </div>

                    {/* Card */}
                    <div className={`flex items-center gap-4 flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                      move.entityType === 'actor'
                        ? 'bg-cinema-700/60 border-cinema-gold/40 hover:border-cinema-gold/80'
                        : 'bg-cinema-700/40 border-cinema-red-light/30 hover:border-cinema-red-light/60'
                    }`}>
                      {move.entityType === 'actor' ? (
                        <ActorAvatar url={move.imageUrl} name={move.entityName} size={72} />
                      ) : (
                        <MoviePoster url={move.imageUrl} title={move.entityName} size={72} />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-base md:text-lg block truncate">{move.entityName}</span>
                        <span className={`text-xs uppercase tracking-wider ${move.entityType === 'actor' ? 'text-cinema-gold/70' : 'text-cinema-red-light/70'}`}>
                          {move.entityType}
                        </span>
                      </div>
                      {move.trivia && (
                        <button
                          onClick={() => setTriviaEntity({ name: move.entityName, description: move.description, trivia: move.trivia })}
                          className="text-cinema-gold hover:text-white p-2 hover:bg-cinema-600 rounded-lg transition-colors shrink-0"
                        >
                          <Info className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Win celebration */}
          <AnimatePresence>
            {isWon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="mt-8 text-center p-8 rounded-2xl border border-cinema-gold/40 bg-gradient-to-b from-cinema-gold/10 to-transparent"
              >
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <Sparkles className="w-14 h-14 text-cinema-gold mx-auto mb-4" />
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-bold gold-gradient mb-3">Congratulations!</h2>
                <p className="text-gray-300 mb-2 text-lg">
                  You connected <span className="text-cinema-gold font-semibold">{game.startActor.name}</span> to <span className="text-cinema-red-light font-semibold">{game.targetActor.name}</span>
                </p>
                <p className="text-gray-400 mb-6">in {game.movesCount} moves</p>
                <div className="text-5xl font-bold text-cinema-gold mb-8">{game.score}</div>
                <div className="flex flex-wrap gap-4 justify-center">
                  {showShare && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        navigator.clipboard.writeText(shareText);
                        toast.success('Copied to clipboard!');
                      }}
                      className="btn-primary inline-flex items-center gap-2 text-lg"
                    >
                      <Share2 className="w-5 h-5" />
                      Share Result
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNewGame}
                    disabled={isProcessing}
                    className="btn-primary inline-flex items-center gap-2 text-lg disabled:opacity-40"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    New Game
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Controls */}
        {!isWon && (
          <>
            {/* Search */}
            <div className="relative mb-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isMovieTurn ? 'Search for a movie...' : 'Search for an actor...'}
                  className="search-input pl-12 py-4 text-lg"
                />
              </div>
              {searchQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springFast}
                  className="absolute z-50 w-full mt-2 game-card max-h-96 overflow-auto"
                >
                  {isSearching ? (
                    <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Searching...
                    </div>
                  ) : (
                    <>
                      {searchResults.actors.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs text-gray-400 uppercase px-2 mb-2 font-semibold tracking-wider">Actors</p>
                          {searchResults.actors.map((actor) => (
                            <motion.button
                              key={actor.id}
                              whileHover={{ scale: 1.02, backgroundColor: 'rgba(60,60,80,0.8)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleMove('actor', actor.id, actor.name)}
                              disabled={isMovieTurn}
                              className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-4 disabled:opacity-30 transition-colors"
                            >
                              <ActorAvatar url={actor.profileImageUrl} name={actor.name} size={64} />
                              <div className="flex-1 min-w-0">
                                <span className="block font-medium">{actor.name}</span>
                                {actor.description && (
                                  <span className="text-sm text-gray-400 line-clamp-1">{actor.description}</span>
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {searchResults.movies.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs text-gray-400 uppercase px-2 mb-2 font-semibold tracking-wider">Movies</p>
                          {searchResults.movies.map((movie) => (
                            <motion.button
                              key={movie.id}
                              whileHover={{ scale: 1.02, backgroundColor: 'rgba(60,60,80,0.8)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleMove('movie', movie.id, movie.title)}
                              disabled={!isMovieTurn}
                              className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-4 disabled:opacity-30 transition-colors"
                            >
                              <MoviePoster url={movie.posterUrl} title={movie.title} size={64} />
                              <div className="flex-1 min-w-0">
                                <span className="block font-medium">{movie.title}</span>
                                <span className="text-sm text-gray-400">{movie.releaseYear} · {movie.genre}</span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {searchResults.actors.length === 0 && searchResults.movies.length === 0 && (
                        <div className="p-6 text-center text-gray-400">No results found</div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUndo}
                  disabled={isProcessing || game.moves.length <= 1}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 text-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                  Undo
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 text-sm"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset
                </motion.button>

                {/* Hint Dropdown */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowHints(!showHints)}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Hints
                    <ChevronDown className={`w-4 h-4 transition-transform ${showHints ? 'rotate-180' : ''}`} />
                  </motion.button>
                  <AnimatePresence>
                    {showHints && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={springFast}
                        className="absolute z-50 mt-2 left-0 game-card py-2 min-w-[180px]"
                      >
                        {[
                          { id: 'soft', label: 'Soft Hint', icon: '💡' },
                          { id: 'first-letter', label: 'First Letter', icon: '🔤' },
                          { id: 'decade', label: 'Decade', icon: '📅' },
                          { id: 'best-next', label: 'Best Next', icon: '🧭' },
                        ].map((hint) => (
                          <button
                            key={hint.id}
                            onClick={() => handleHint(hint.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-cinema-700/60 transition-colors flex items-center gap-3 text-sm"
                          >
                            <span>{hint.icon}</span>
                            {hint.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Turn Indicator */}
              <motion.div
                key={isMovieTurn ? 'movie' : 'actor'}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springFast}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
                  isMovieTurn
                    ? 'bg-cinema-red/20 text-cinema-red-light border border-cinema-red-light/30'
                    : 'bg-cinema-gold/20 text-cinema-gold border border-cinema-gold/30'
                }`}
              >
                {isMovieTurn ? <Film className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                {isMovieTurn ? 'Pick a movie' : 'Pick an actor'}
              </motion.div>
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
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-cinema-gold text-2xl font-bold"
        >
          Loading...
        </motion.div>
      </div>
    }>
      <PlayPageContent />
    </Suspense>
  );
}
