// TMDB API Client for Bollywood Connect
// Documentation: https://developer.themoviedb.org/reference/

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

export interface TMDBPerson {
  id: number;
  name: string;
  popularity: number;
  profile_path: string | null;
  known_for_department: string;
  gender: number; // 0=unspecified, 1=female, 2=male
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  popularity: number;
  poster_path: string | null;
  original_language: string;
  genre_ids: number[];
  overview: string;
}

export interface TMDBMovieCredits {
  cast: {
    id: number;
    name: string;
    character: string;
    order: number;
    profile_path: string | null;
  }[];
  crew: {
    id: number;
    name: string;
    job: string;
    department: string;
  }[];
}

export interface TMDBPersonCredits {
  cast: {
    id: number;
    title: string;
    original_title: string;
    release_date: string;
    character: string;
    popularity: number;
    poster_path: string | null;
    original_language: string;
    genre_ids: number[];
  }[];
}

class TMDBError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!TMDB_API_KEY) {
    throw new TMDBError(401, 'TMDB_API_KEY not configured. Set it in apps/api/.env');
  }

  const qs = new URLSearchParams({ api_key: TMDB_API_KEY, ...params }).toString();
  const url = `${TMDB_BASE_URL}${path}?${qs}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new TMDBError(res.status, body.status_message || `TMDB HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Discover Hindi/Bollywood movies
export async function discoverBollywoodMovies(
  page = 1,
  year?: number,
  withGenres?: string
): Promise<{ page: number; results: TMDBMovie[]; total_pages: number; total_results: number }> {
  const params: Record<string, string> = {
    language: 'hi-IN',
    region: 'IN',
    sort_by: 'popularity.desc',
    page: String(page),
    'vote_count.gte': '10',
    with_original_language: 'hi',
  };

  if (year) {
    params['primary_release_year'] = String(year);
  }

  if (withGenres) {
    params['with_genres'] = withGenres;
  }

  return tmdbFetch('/discover/movie', params);
}

// Discover regional Indian movies (Tamil, Telugu, etc.)
export async function discoverRegionalMovies(
  language: string,
  page = 1,
  year?: number
): Promise<{ page: number; results: TMDBMovie[]; total_pages: number; total_results: number }> {
  const params: Record<string, string> = {
    language: `${language}-IN`,
    region: 'IN',
    sort_by: 'popularity.desc',
    page: String(page),
    'vote_count.gte': '5',
    with_original_language: language,
  };

  if (year) {
    params['primary_release_year'] = String(year);
  }

  return tmdbFetch('/discover/movie', params);
}

// Search for a person (actor)
export async function searchPerson(
  query: string,
  page = 1
): Promise<{ page: number; results: TMDBPerson[]; total_pages: number; total_results: number }> {
  return tmdbFetch('/search/person', {
    query,
    page: String(page),
    include_adult: 'false',
    region: 'IN',
  });
}

// Get person details
export async function getPersonDetails(personId: number): Promise<TMDBPerson & { biography?: string; birthday?: string; place_of_birth?: string; also_known_as?: string[] }> {
  return tmdbFetch(`/person/${personId}`);
}

// Get movie credits for a person
export async function getPersonMovieCredits(personId: number): Promise<TMDBPersonCredits> {
  return tmdbFetch(`/person/${personId}/movie_credits`);
}

// Get movie details
export async function getMovieDetails(movieId: number): Promise<TMDBMovie & { genres?: { id: number; name: string }[]; runtime?: number; tagline?: string; status?: string }> {
  return tmdbFetch(`/movie/${movieId}`);
}

// Get movie credits (cast)
export async function getMovieCredits(movieId: number): Promise<TMDBMovieCredits> {
  return tmdbFetch(`/movie/${movieId}/credits`);
}

// Get popular Indian actors
export async function getPopularIndianActors(page = 1): Promise<{ page: number; results: TMDBPerson[]; total_pages: number; total_results: number }> {
  // We search for known Bollywood actors by querying popular Indian names
  // TMDB doesn't have a direct "popular by region" endpoint for people
  return tmdbFetch('/person/popular', {
    page: String(page),
    region: 'IN',
  });
}

// Get movie images
export async function getMovieImages(movieId: number): Promise<{ id: number; posters: { file_path: string }[]; backdrops: { file_path: string }[] }> {
  return tmdbFetch(`/movie/${movieId}/images`);
}

// Get person images
export async function getPersonImages(personId: number): Promise<{ id: number; profiles: { file_path: string }[] }> {
  return tmdbFetch(`/person/${personId}/images`);
}

// Build image URL
export function getImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Genre ID to name mapping (common Indian cinema genres)
export const TMDB_GENRES: Record<number, string> = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  36: 'history',
  27: 'horror',
  10402: 'music',
  9648: 'mystery',
  10749: 'romance',
  878: 'sci-fi',
  10770: 'tv movie',
  53: 'thriller',
  10752: 'war',
  37: 'western',
  10748: 'historical',
};

export function normalizeGenre(genreIds: number[]): string {
  const names = genreIds.map((id) => TMDB_GENRES[id]).filter(Boolean);
  return names[0] || 'drama';
}

export { TMDBError };
