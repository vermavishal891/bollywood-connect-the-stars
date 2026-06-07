'use client';

import { Fragment, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Film,
  Home,
  Info,
  Lightbulb,
  Loader2,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Star,
  Trophy,
  Undo2,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { createGame, getGame, getHint, makeMove, resetGame, search, undoMove } from '@/lib/api';

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
  startActor?: {
    id: number;
    name: string;
    profileImageUrl?: string | null;
    description?: string | null;
    trivia?: string | null;
  } | null;
  targetActor?: {
    id: number;
    name: string;
    profileImageUrl?: string | null;
    description?: string | null;
    trivia?: string | null;
  } | null;
  startMovie?: MovieResult | null;
  targetMovie?: MovieResult | null;
  difficulty: string;
  mode: string;
  status: string;
  score: number;
  movesCount: number;
  hintsUsed: number;
  timeTaken?: number;
  optimalMoves?: number | null;
  isPerfect?: boolean;
  dailyDate?: string | null;
  moves: GameMove[];
}

interface ActorResult {
  id: number;
  name: string;
  profileImageUrl?: string | null;
  description?: string | null;
}

interface MovieResult {
  id: number;
  title: string;
  posterUrl?: string | null;
  releaseYear?: number | null;
  genre?: string | null;
}

type SearchResults = {
  actors: ActorResult[];
  movies: MovieResult[];
};

const springFast = { type: 'spring' as const, stiffness: 500, damping: 28 };
const springPop = { type: 'spring' as const, stiffness: 600, damping: 20 };

const hintOptions = [
  { id: 'soft', label: 'Soft Hint' },
  { id: 'first-letter', label: 'First Letter' },
  { id: 'decade', label: 'Decade' },
  { id: 'best-next', label: 'Best Next' },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function toTitle(value: string) {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEndpoint(game: GameData, endpoint: 'start' | 'target'): EndpointEntity {
  const actor = endpoint === 'start' ? game.startActor : game.targetActor;
  if (actor) {
    return {
      type: 'actor',
      id: actor.id,
      name: actor.name,
      imageUrl: actor.profileImageUrl,
      description: actor.description,
      trivia: actor.trivia,
    };
  }

  const movie = endpoint === 'start' ? game.startMovie : game.targetMovie;
  if (movie) {
    return {
      type: 'movie',
      id: movie.id,
      name: movie.title,
      imageUrl: movie.posterUrl,
      description: movie.genre || undefined,
    };
  }

  return { type: 'actor', id: 0, name: 'Unknown' };
}

function getEndpointName(game: GameData, endpoint: 'start' | 'target') {
  return getEndpoint(game, endpoint).name;
}

function parseTrivia(trivia?: string | null) {
  if (!trivia) return [];
  try {
    const parsed = JSON.parse(trivia);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [trivia];
  }
}

function ActorAvatar({ url, name, size = 96, featured = false }: { url?: string | null; name: string; size?: number; featured?: boolean }) {
  const [failed, setFailed] = useState(false);
  const commonStyle = { width: size, height: size };

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        className={`${featured ? 'hero-avatar' : 'move-avatar'} shrink-0 bg-cinema-700`}
        style={commonStyle}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${featured ? 'hero-avatar' : 'move-avatar'} flex shrink-0 items-center justify-center bg-gradient-to-br from-cinema-600 to-cinema-900 font-bold text-cinema-gold`}
      style={{ ...commonStyle, fontSize: size * 0.32 }}
    >
      {getInitials(name)}
    </div>
  );
}

function MoviePoster({ url, title, size = 96 }: { url?: string | null; title: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const width = Math.round(size * 0.72);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={title}
        className="move-poster shrink-0 bg-cinema-700"
        style={{ width, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="move-poster flex shrink-0 items-center justify-center bg-gradient-to-br from-cinema-700 to-cinema-900"
      style={{ width, height: size }}
    >
      <img src="/brand/03_app_icons/neon_glamour_primary_icon_64x64.png" alt="" className="h-9 w-9 object-contain opacity-80" />
    </div>
  );
}

function StatPill({ icon, label, value, accent = 'gold' }: { icon: ReactNode; label: string; value: ReactNode; accent?: 'gold' | 'red' | 'teal' }) {
  const accentClass = {
    gold: 'text-cinema-gold',
    red: 'text-cinema-red-light',
    teal: 'text-cinema-teal',
  }[accent];

  return (
    <div className="stat-pill min-w-[98px] justify-center">
      <span className={accentClass}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</span>
        <span className="block truncate font-semibold leading-tight text-white">{value}</span>
      </span>
    </div>
  );
}

function TriviaCard({
  title,
  description,
  trivia,
  onClose,
}: {
  title: string;
  description?: string | null;
  trivia?: string | null;
  onClose: () => void;
}) {
  const facts = parseTrivia(trivia);
  const randomFact = facts.length > 0 ? facts[Math.floor(Math.random() * facts.length)] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={springFast}
      className="game-card mb-5 overflow-hidden border-l-4 border-l-cinema-gold p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="section-title mb-2">Spotlight</p>
          <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
          {description && <p className="mb-2 line-clamp-3 text-sm leading-6 text-gray-300">{description}</p>}
          {randomFact && (
            <p className="text-sm leading-6 text-cinema-gold-light">
              <span className="font-semibold text-cinema-gold">Did you know?</span> {randomFact}
            </p>
          )}
        </div>
        <button onClick={onClose} className="icon-button h-9 w-9 shrink-0 text-gray-400" aria-label="Close trivia">
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

type EndpointEntity =
  | { type: 'actor'; id: number; name: string; imageUrl?: string | null; description?: string | null; trivia?: string | null }
  | { type: 'movie'; id: number; name: string; imageUrl?: string | null; description?: string | null; trivia?: string | null };

function EndpointSpotlight({
  entity,
  label,
  tone,
}: {
  entity: EndpointEntity;
  label: 'Start' | 'Target';
  tone: 'gold' | 'red';
}) {
  const accent = tone === 'gold' ? 'text-cinema-gold border-cinema-gold/40' : 'text-cinema-red-light border-cinema-red-light/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springPop}
      className="flex min-w-0 flex-col items-center text-center"
    >
      <span className={`mb-3 rounded-lg border bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${accent}`}>
        {label}
      </span>
      {entity.type === 'actor' ? (
        <ActorAvatar url={entity.imageUrl} name={entity.name} size={112} featured />
      ) : (
        <MoviePoster url={entity.imageUrl} title={entity.name} size={128} />
      )}
      <h2 className="mt-3 max-w-[230px] text-balance text-xl font-bold leading-tight text-white md:text-2xl">{entity.name}</h2>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{entity.type}</p>
    </motion.div>
  );
}

function PathNode({ move, index, onTrivia }: { move: GameMove; index: number; onTrivia: () => void }) {
  const isActor = move.entityType === 'actor';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={springFast}
      className={`group relative flex w-[156px] shrink-0 flex-col items-center rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 ${
        isActor
          ? 'border-cinema-gold/45 bg-cinema-gold/10 hover:border-cinema-gold/75'
          : 'border-cinema-red-light/45 bg-cinema-red/15 hover:border-cinema-red-light/70'
      }`}
    >
      <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[0.65rem] font-black text-gray-300">
        {index === 0 ? 'Start' : index + 1}
      </span>
      {isActor ? <ActorAvatar url={move.imageUrl} name={move.entityName} size={70} /> : <MoviePoster url={move.imageUrl} title={move.entityName} size={82} />}
      <span className="mt-2 line-clamp-2 min-h-[2.25rem] text-sm font-black leading-5 text-white">{move.entityName}</span>
      <span className={`mt-2 text-[0.66rem] font-bold uppercase tracking-[0.2em] ${isActor ? 'text-cinema-gold/80' : 'text-cinema-red-light/80'}`}>
        {move.entityType}
      </span>
      {move.trivia && (
        <button
          onClick={onTrivia}
          className="absolute right-2 top-2 rounded-full p-1.5 text-gray-400 opacity-100 transition-colors hover:bg-black/30 hover:text-cinema-gold md:opacity-0 md:group-hover:opacity-100"
          aria-label={`Show trivia for ${move.entityName}`}
        >
          <Info className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

function CommandButton({
  icon,
  label,
  onClick,
  disabled,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`${danger ? 'btn-danger' : 'btn-secondary'} min-w-[104px] px-4 py-3`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function SearchResultsPanel({
  results,
  isSearching,
  isMovieTurn,
  onMove,
}: {
  results: SearchResults;
  isSearching: boolean;
  isMovieTurn: boolean;
  onMove: (entityType: 'actor' | 'movie', entityId: number) => void;
}) {
  if (isSearching) {
    return (
      <div className="p-6 text-center text-gray-400">
        <Loader2 className="mr-2 inline h-5 w-5 animate-spin text-cinema-gold" />
        Searching...
      </div>
    );
  }

  if (results.actors.length === 0 && results.movies.length === 0) {
    return <div className="p-6 text-center text-gray-400">No results found</div>;
  }

  const actorSection = results.actors.length > 0 && (
    <div className="p-3">
          <p className="section-title px-2 pb-2">Actors</p>
          {results.actors.map((actor) => (
            <motion.button
              key={actor.id}
              whileHover={{ scale: isMovieTurn ? 1 : 1.01 }}
              whileTap={{ scale: isMovieTurn ? 1 : 0.98 }}
              onClick={() => onMove('actor', actor.id)}
              disabled={isMovieTurn}
              className="flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-35"
            >
              <ActorAvatar url={actor.profileImageUrl} name={actor.name} size={58} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">{actor.name}</span>
                {actor.description && <span className="line-clamp-1 text-sm text-gray-400">{actor.description}</span>}
              </span>
            </motion.button>
          ))}
    </div>
  );

  const movieSection = results.movies.length > 0 && (
    <div className="p-3">
          <p className="section-title px-2 pb-2">Movies</p>
          {results.movies.map((movie) => (
            <motion.button
              key={movie.id}
              whileHover={{ scale: !isMovieTurn ? 1 : 1.01 }}
              whileTap={{ scale: !isMovieTurn ? 1 : 0.98 }}
              onClick={() => onMove('movie', movie.id)}
              disabled={!isMovieTurn}
              className="flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-35"
            >
              <MoviePoster url={movie.posterUrl} title={movie.title} size={64} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">{movie.title}</span>
                <span className="text-sm text-gray-400">
                  {movie.releaseYear || 'Year unknown'}{movie.genre ? ` - ${movie.genre}` : ''}
                </span>
              </span>
            </motion.button>
          ))}
    </div>
  );

  return isMovieTurn ? (
    <>
      {movieSection}
      {actorSection}
    </>
  ) : (
    <>
      {actorSection}
      {movieSection}
    </>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'classic';
  const difficulty = searchParams.get('difficulty') || 'medium';
  const region = searchParams.get('region') || undefined;
  const theme = searchParams.get('theme') || undefined;
  const playerName = searchParams.get('playerName') || undefined;
  const startActorId = Number(searchParams.get('startActorId')) || undefined;
  const targetActorId = Number(searchParams.get('targetActorId')) || undefined;

  const [game, setGame] = useState<GameData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({ actors: [], movies: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [shareText, setShareText] = useState('');
  const [triviaEntity, setTriviaEntity] = useState<{ name: string; description?: string | null; trivia?: string | null } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const startGame = useCallback(
    async (announce = false) => {
      setIsProcessing(true);
      setLoadError(null);
      try {
        const newGame = await createGame({ mode, difficulty, region, theme, playerName, startActorId, targetActorId });
        const fullGame = await getGame(newGame.id);
        setGame(fullGame);
        setTimer(0);
        setShowShare(false);
        setTriviaEntity(null);
        setSearchQuery('');
        setSearchResults({ actors: [], movies: [] });
        if (announce) toast.success('New game started');
      } catch (err: any) {
        const message = err.message || 'Failed to start game';
        setLoadError(message);
        toast.error(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [difficulty, mode, playerName, region, startActorId, targetActorId, theme]
  );

  useEffect(() => {
    startGame();
  }, [startGame]);

  useEffect(() => {
    if (!game || game.status !== 'active') return;
    const interval = setInterval(() => setTimer((time) => time + 1), 1000);
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
        const results = await search(searchQuery, { region, theme });
        setSearchResults(results);
      } catch {
        setSearchResults({ actors: [], movies: [] });
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleMove = async (entityType: 'actor' | 'movie', entityId: number) => {
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
        toast.success(`You won! Score: ${result.score}`, { duration: 4000 });
        setShareText(
          `I connected ${getEndpointName(updated, 'start')} -> ${getEndpointName(updated, 'target')} in ${updated.movesCount} moves!\n\nCan you beat me?`
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
      toast(hint.message, { duration: 3500 });
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
    await startGame(true);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        {loadError ? (
          <div className="game-card max-w-md p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-red-light/40 bg-cinema-red/20 text-cinema-red-light">
              <X className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">Could not start the game</h1>
            <p className="mt-3 text-sm leading-6 text-gray-400">{loadError}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => startGame(true)} disabled={isProcessing} className="btn-primary">
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                Try Again
              </button>
              <Link href="/" className="btn-secondary">
                <Home className="h-5 w-5" />
                Home
              </Link>
            </div>
          </div>
        ) : (
          <motion.div
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="game-card flex flex-col items-center gap-3 px-6 py-5 text-lg font-bold text-cinema-gold"
          >
            <Sparkles className="h-8 w-8" />
            <span>Loading game...</span>
          </motion.div>
        )}
      </div>
    );
  }

  const isWon = game.status === 'completed';
  const lastPlacedNode = game.moves[game.moves.length - 1];
  const nextEntityType = lastPlacedNode?.entityType === 'movie' ? 'actor' : 'movie';
  const isMovieTurn = nextEntityType === 'movie';
  const turnLabel = isMovieTurn ? 'Pick a movie' : 'Pick an actor';
  const turnHelp = isMovieTurn
    ? 'Connect the last actor in your path to a film.'
    : 'Choose a cast member from the previous movie.';
  const progress = isWon ? 100 : Math.min(100, (game.moves.length / 8) * 100);
  const startEndpoint = getEndpoint(game, 'start');
  const targetEndpoint = getEndpoint(game, 'target');

  return (
    <div className="cinematic-page">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#121017',
            border: '1px solid rgba(240, 199, 94, 0.24)',
            color: '#fff',
            fontSize: '14px',
          },
        }}
      />

      <div className="mx-auto max-w-7xl">
        <header className="hero-stage mb-6 grid gap-4 px-4 py-5 md:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="icon-button" aria-label="Go home">
              <Home className="h-5 w-5" />
            </Link>
            <div className="stat-pill max-w-full">
              <Film className="h-4 w-4 text-cinema-gold" />
              <span className="truncate font-semibold">{toTitle(game.mode)} - {toTitle(game.difficulty)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold shadow-lg shadow-cinema-red/10">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mt-2 text-xl font-black text-white">Connection Board</h1>
            <p className="mt-1 text-sm text-gray-400">Build the cleanest path from first frame to final star.</p>
          </div>

          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <StatPill icon={<Clock className="h-5 w-5" />} label="Time" value={formatTime(timer)} />
            <StatPill icon={<Trophy className="h-5 w-5" />} label="Score" value={game.score} accent="teal" />
            <StatPill icon={<Star className="h-5 w-5" />} label="Moves" value={game.movesCount} accent="red" />
          </div>
        </header>

        {!isWon && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              <span>Path progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/30">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cinema-gold via-cinema-gold-light to-cinema-red-light"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={springFast}
              />
            </div>
          </div>
        )}

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

        <section className="game-card mb-4 overflow-hidden p-4 md:p-6">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] lg:items-center">
            <EndpointSpotlight entity={startEndpoint} label="Start" tone="gold" />

            <div className="flex flex-col items-center gap-4">
              <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-cinema-gold/70 to-transparent lg:block" />
              <motion.div
                animate={isWon ? { scale: [1, 1.08, 1] } : { x: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold"
              >
                {isWon ? <Sparkles className="h-8 w-8" /> : <ArrowRight className="h-8 w-8" />}
              </motion.div>
              <div className="rounded-2xl border border-cinema-gold/20 bg-black/20 px-4 py-2 text-center">
                <p className="section-title">Your Path</p>
                <p className="mt-1 text-sm text-gray-400">{game.moves.length} nodes placed</p>
              </div>
              <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-cinema-red-light/50 to-transparent lg:block" />
            </div>

            <EndpointSpotlight entity={targetEndpoint} label="Target" tone="red" />
          </div>
        </section>

        <section className="hero-stage mb-4 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-title">Your Path</p>
              <h2 className="mt-1 text-xl font-black text-white">Current connection rail</h2>
            </div>
            <div
              className={`rounded-full border px-3 py-2 text-sm font-black ${
                isMovieTurn
                  ? 'border-cinema-red-light/40 bg-cinema-red/20 text-cinema-red-light'
                  : 'border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold'
              }`}
            >
              {turnLabel}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-center gap-3">
              <AnimatePresence mode="popLayout">
                {game.moves.map((move, index) => (
                  <Fragment key={move.id}>
                    <PathNode
                      move={move}
                      index={index}
                      onTrivia={() =>
                        setTriviaEntity({
                          name: move.entityName,
                          description: move.description,
                          trivia: move.trivia,
                        })
                      }
                    />
                    {index < game.moves.length - 1 && <div className="timeline-connector" />}
                  </Fragment>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {isWon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springPop}
                className="win-burst mt-7 rounded-[1.5rem] border border-cinema-gold/40 bg-cinema-gold/10 p-6 text-center"
              >
                <Sparkles className="mx-auto mb-3 h-12 w-12 text-cinema-gold" />
                <h2 className="gold-gradient mb-2 text-3xl font-black md:text-4xl">Connection made</h2>
                <p className="mx-auto max-w-2xl text-gray-300">
                  You connected <span className="font-semibold text-cinema-gold">{startEndpoint.name}</span> to{' '}
                  <span className="font-semibold text-cinema-red-light">{targetEndpoint.name}</span> in {game.movesCount} moves.
                </p>
                {typeof game.optimalMoves === 'number' && (
                  <p className="mt-3 text-sm font-semibold text-gray-300">
                    Optimal path: <span className="text-cinema-gold">{game.optimalMoves}</span> moves ·{' '}
                    <span className={game.isPerfect ? 'text-cinema-teal' : 'text-cinema-red-light'}>
                      {game.isPerfect ? 'Perfect path' : 'Not shortest'}
                    </span>
                  </p>
                )}
                <div className="mt-5 text-5xl font-black text-cinema-gold">{game.score}</div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {showShare && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareText);
                        toast.success('Copied to clipboard');
                      }}
                      className="btn-primary"
                    >
                      <Share2 className="h-5 w-5" />
                      Share Result
                    </button>
                  )}
                  <button onClick={handleNewGame} disabled={isProcessing} className="btn-primary">
                    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    New Game
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {!isWon && (
          <section className="command-panel p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
              <div className="border-b border-cinema-600/40 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
                <p className={`text-xl font-black ${isMovieTurn ? 'text-cinema-red-light' : 'text-cinema-gold'}`}>{turnLabel}</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">{turnHelp}</p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isMovieTurn ? 'Search for a movie' : 'Search for an actor'}
                  className="search-input pl-12 text-base md:text-lg"
                />
                {searchQuery.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springFast}
                    className="game-card absolute bottom-full z-50 mb-2 max-h-96 w-full overflow-auto"
                  >
                    <SearchResultsPanel
                      results={searchResults}
                      isSearching={isSearching}
                      isMovieTurn={isMovieTurn}
                      onMove={handleMove}
                    />
                  </motion.div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <CommandButton
                  icon={isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  label="Undo"
                  onClick={handleUndo}
                  disabled={isProcessing || game.moves.length <= 1}
                />
                <CommandButton
                  icon={isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  label="Reset"
                  onClick={handleReset}
                  disabled={isProcessing}
                  danger
                />

                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowHints((open) => !open)}
                    className="btn-secondary min-w-[104px] px-4 py-3"
                  >
                    <Lightbulb className="h-4 w-4 text-cinema-teal" />
                    Hints
                    <ChevronDown className={`h-4 w-4 transition-transform ${showHints ? 'rotate-180' : ''}`} />
                  </motion.button>
                  <AnimatePresence>
                    {showHints && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={springFast}
                        className="game-card absolute right-0 z-50 mt-2 w-52 p-2"
                      >
                        {hintOptions.map((hint) => (
                          <button
                            key={hint.id}
                            onClick={() => handleHint(hint.id)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                          >
                            {hint.label}
                            <Lightbulb className="h-4 w-4 text-cinema-teal" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <motion.div
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="game-card flex flex-col items-center gap-3 px-6 py-5 text-lg font-bold text-cinema-gold"
          >
            <Sparkles className="h-8 w-8" />
            <span>Loading...</span>
          </motion.div>
        </div>
      }
    >
      <PlayPageContent />
    </Suspense>
  );
}
