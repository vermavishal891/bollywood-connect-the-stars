const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const search = (q: string) => apiFetch(`/search?q=${encodeURIComponent(q)}`);
export const getActor = (id: number) => apiFetch(`/actors/${id}`);
export const getMovie = (id: number) => apiFetch(`/movies/${id}`);

export const createGame = (data: any) =>
  apiFetch('/games', { method: 'POST', body: JSON.stringify(data) });
export const getGame = (gameId: string) =>
  apiFetch(`/games/${gameId}`, { cache: 'no-store' });
export const makeMove = (gameId: string, move: { entityType: string; entityId: number }) =>
  apiFetch(`/games/${gameId}/move`, { method: 'POST', body: JSON.stringify(move) });
export const undoMove = (gameId: string) =>
  apiFetch(`/games/${gameId}/undo`, { method: 'POST' });
export const resetGame = (gameId: string) =>
  apiFetch(`/games/${gameId}/reset`, { method: 'POST' });
export const getHint = (gameId: string, type?: string) =>
  apiFetch(`/games/${gameId}/hint`, { method: 'POST', body: JSON.stringify({ type }) });

export const getLeaderboard = (params?: { difficulty?: string; mode?: string; limit?: number }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch(`/leaderboard?${qs}`);
};

export const getDailyChallenge = () => apiFetch('/daily');
export const submitDaily = (gameId: string) =>
  apiFetch('/daily/submit', { method: 'POST', body: JSON.stringify({ gameId }) });

export const getAdminStats = () => apiFetch('/admin/stats');
export const getAdminActors = (skip = 0, take = 50) =>
  apiFetch(`/admin/actors?skip=${skip}&take=${take}`);
export const getAdminMovies = (skip = 0, take = 50) =>
  apiFetch(`/admin/movies?skip=${skip}&take=${take}`);

// Wikipedia (free) ingestion
export const getWikipediaStatus = () => apiFetch('/admin/wikipedia/status');
export const triggerWikipediaIngest = (clearExisting = false) =>
  apiFetch('/admin/wikipedia/ingest', { method: 'POST', body: JSON.stringify({ clearExisting }) });
export const triggerWikipediaScrape = (years?: string) =>
  apiFetch('/admin/wikipedia/scrape', { method: 'POST', body: JSON.stringify({ years }) });
