// Shared types for Bollywood Connect the Stars

export interface Actor {
  id: number;
  name: string;
  normalizedName: string;
  gender?: string;
  profileImageUrl?: string;
  popularityScore: number;
  isBollywood: boolean;
}

export interface Movie {
  id: number;
  title: string;
  normalizedTitle: string;
  releaseYear?: number;
  posterUrl?: string;
  popularityScore: number;
  isBollywood: boolean;
  region?: string;
  genre?: string;
}

export interface GameState {
  id: string;
  startActor: Actor;
  targetActor: Actor;
  difficulty: Difficulty;
  mode: GameMode;
  status: 'active' | 'completed' | 'abandoned';
  currentPath: GameNode[];
  movesCount: number;
  hintsUsed: number;
  undoCount: number;
  timeTaken?: number;
  score: number;
  createdAt: string;
}

export interface GameNode {
  type: 'actor' | 'movie';
  id: number;
  name: string;
  imageUrl?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'legend';

export type GameMode =
  | 'classic'
  | 'daily'
  | 'speedrun'
  | 'shortest'
  | 'party'
  | 'regional'
  | 'movie-to-movie'
  | 'theme';

export interface Hint {
  type: 'soft' | 'first-letter' | 'poster' | 'best-next' | 'decade';
  message: string;
}

export interface LeaderboardEntry {
  id: number;
  playerName: string;
  difficulty: string;
  mode: string;
  movesCount: number;
  timeTaken: number;
  hintsUsed: number;
  score: number;
  startActor: string;
  targetActor: string;
  createdAt: string;
}

export interface SearchResult {
  actors: Actor[];
  movies: Movie[];
}

export interface DailyChallenge {
  id: number;
  date: string;
  startActor: Actor;
  targetActor: Actor;
  difficulty: string;
  theme?: string;
  description?: string;
}

export interface ShareCardData {
  startActor: string;
  targetActor: string;
  movesCount: number;
  difficulty: string;
  path: GameNode[];
  playerName?: string;
}

export interface AdminStats {
  totalActors: number;
  totalMovies: number;
  totalGames: number;
  totalPlayers: number;
  pendingModerations: number;
  popularSearchTerms: { term: string; count: number }[];
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  filter: {
    decades?: number[];
    genres?: string[];
    studios?: string[];
    actorTags?: string[];
  };
}

export const GAME_MODES: { id: GameMode; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Connect two random Bollywood actors' },
  { id: 'daily', name: 'Daily Challenge', description: 'Same puzzle for everyone each day' },
  { id: 'speedrun', name: 'Speedrun', description: 'Fastest completion wins' },
  { id: 'shortest', name: 'Shortest Path', description: 'Fewest moves wins' },
  { id: 'party', name: 'Party Mode', description: 'One shared screen for groups' },
  { id: 'regional', name: 'Regional Mode', description: 'Hindi, Tamil, Telugu, Marathi, Malayalam, Kannada, Bengali' },
  { id: 'movie-to-movie', name: 'Movie-to-Movie', description: 'Connect one film to another through actors' },
  { id: 'theme', name: 'Theme Mode', description: '90s, villains, romance, YRF, Dharma, comedy, classics' },
];

export const DIFFICULTIES: { id: Difficulty; name: string; pathRange: string }[] = [
  { id: 'easy', name: 'Easy', pathRange: '1-3 edges' },
  { id: 'medium', name: 'Medium', pathRange: '3-5 edges' },
  { id: 'hard', name: 'Hard', pathRange: '5-7 edges' },
  { id: 'legend', name: 'Legend', pathRange: '7+ edges' },
];

export const REGIONS = [
  { id: 'hindi', name: 'Hindi / Bollywood' },
  { id: 'tamil', name: 'Tamil' },
  { id: 'telugu', name: 'Telugu' },
  { id: 'marathi', name: 'Marathi' },
  { id: 'malayalam', name: 'Malayalam' },
  { id: 'kannada', name: 'Kannada' },
  { id: 'bengali', name: 'Bengali' },
];

export const THEMES: ThemeConfig[] = [
  { id: '90s', name: '90s Nostalgia', description: 'Classic films from the 1990s', icon: '📼', filter: { decades: [1990, 1999] } },
  { id: 'romance', name: 'Romance', description: 'Love stories and romantic dramas', icon: '💕', filter: { genres: ['romance', 'romantic'] } },
  { id: 'comedy', name: 'Comedy', description: 'Laugh-out-loud comedies', icon: '😂', filter: { genres: ['comedy'] } },
  { id: 'action', name: 'Action', description: 'High-octane action films', icon: '💥', filter: { genres: ['action'] } },
  { id: 'classics', name: 'Golden Classics', description: 'Films before 1980', icon: '🎞️', filter: { decades: [1950, 1979] } },
  { id: 'villains', name: 'Villain Energy', description: 'Crime, thriller, and action-heavy puzzles', icon: '😈', filter: { genres: ['crime', 'thriller', 'action'] } },
  { id: 'yrf', name: 'YRF-Style Romance', description: 'Glossy romance and action-drama connections', icon: '🎬', filter: { genres: ['romance', 'action', 'drama'] } },
  { id: 'dharma', name: 'Dharma-Style Drama', description: 'Family, comedy, romance, and drama links', icon: '🌟', filter: { genres: ['family', 'comedy', 'romance', 'drama'] } },
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateScore(
  shortestPathLength: number,
  actualMoves: number,
  timeTaken: number,
  hintsUsed: number,
  difficulty: Difficulty
): number {
  const difficultyMultiplier = {
    easy: 1,
    medium: 1.5,
    hard: 2.5,
    legend: 4,
  };

  const baseScore = 1000;
  const movePenalty = Math.max(0, (actualMoves - shortestPathLength) * 50);
  const timePenalty = Math.floor(timeTaken / 10) * 5;
  const hintPenalty = hintsUsed * 100;

  const rawScore = baseScore - movePenalty - timePenalty - hintPenalty;
  const finalScore = Math.max(0, Math.floor(rawScore * difficultyMultiplier[difficulty]));

  return finalScore;
}
