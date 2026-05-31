'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Database,
  Cloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Zap,
  Globe,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface TMDBStatus {
  ok: boolean;
  message: string;
  rateLimit?: {
    remaining: number;
    reset: number;
  };
}

interface WikipediaStatus {
  ok: boolean;
  datasetExists: boolean;
  actorCount: number;
  movieCount: number;
  message: string;
}

export default function IngestionPage() {
  const [tmdbStatus, setTmdbStatus] = useState<TMDBStatus | null>(null);
  const [wikiStatus, setWikiStatus] = useState<WikipediaStatus | null>(null);
  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [ingestingTmdb, setIngestingTmdb] = useState(false);
  const [refreshingTmdb, setRefreshingTmdb] = useState(false);
  const [ingestingWiki, setIngestingWiki] = useState(false);
  const [fullIngesting, setFullIngesting] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [config, setConfig] = useState({
    actorCount: 100,
    moviePages: 20,
    includeRegional: true,
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchTmdbStatus = useCallback(async () => {
    setLoadingTmdb(true);
    try {
      const res = await fetch(`${API_URL}/admin/tmdb/status`);
      const data = await res.json();
      setTmdbStatus(data);
    } catch {
      setTmdbStatus({ ok: false, message: 'Cannot reach API server' });
    }
    setLoadingTmdb(false);
  }, [API_URL]);

  const fetchWikiStatus = useCallback(async () => {
    setLoadingWiki(true);
    try {
      const res = await fetch(`${API_URL}/admin/wikipedia/status`);
      const data = await res.json();
      setWikiStatus(data);
    } catch {
      setWikiStatus({ ok: false, datasetExists: false, actorCount: 0, movieCount: 0, message: 'Cannot reach API server' });
    }
    setLoadingWiki(false);
  }, [API_URL]);

  useEffect(() => {
    fetchTmdbStatus();
    fetchWikiStatus();
  }, [fetchTmdbStatus, fetchWikiStatus]);

  // Poll progress when full ingestion is running
  useEffect(() => {
    if (!fullIngesting) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/admin/tmdb/progress`);
        const data = await res.json();
        setProgress(data);
        if (data.phase === 'complete') {
          setFullIngesting(false);
          toast.success('Full TMDB ingestion complete!');
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [fullIngesting, API_URL]);

  const handleTmdbIngest = async () => {
    setIngestingTmdb(true);
    try {
      const res = await fetch(`${API_URL}/admin/tmdb/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'TMDB ingestion started!');
      } else {
        toast.error(data.error || data.message || 'Failed to start ingestion');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    }
    setIngestingTmdb(false);
  };

  const handleTmdbRefresh = async () => {
    if (!confirm('This will DELETE all existing actors, movies, and cast data, then re-download from TMDB. Are you sure?')) {
      return;
    }
    setRefreshingTmdb(true);
    try {
      const res = await fetch(`${API_URL}/admin/tmdb/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'TMDB refresh started!');
      } else {
        toast.error(data.error || data.message || 'Failed to start refresh');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    }
    setRefreshingTmdb(false);
  };

  const handleWikiIngest = async (clearExisting = false) => {
    setIngestingWiki(true);
    try {
      const res = await fetch(`${API_URL}/admin/wikipedia/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearExisting }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Wikipedia ingestion started!');
      } else {
        toast.error(data.error || data.message || 'Failed to start ingestion');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    }
    setIngestingWiki(false);
  };

  const handleFullIngest = async () => {
    if (!confirm('This will discover ALL Hindi movies from TMDB and may take 1-2 hours. Continue?')) return;
    setFullIngesting(true);
    setProgress(null);
    try {
      const res = await fetch(`${API_URL}/admin/tmdb/full-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearExisting: false }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Full ingestion started!');
      } else {
        toast.error(data.error || data.message || 'Failed to start');
        setFullIngesting(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
      setFullIngesting(false);
    }
  };

  const handleCancelIngest = async () => {
    try {
      await fetch(`${API_URL}/admin/tmdb/cancel`, { method: 'POST' });
      setFullIngesting(false);
      toast.success('Ingestion cancelled');
    } catch {}
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a25', color: '#fff' } }} />
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-cinema-gold hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Admin
        </Link>

        <h1 className="text-3xl font-display font-bold mb-2 gold-gradient">Data Ingestion</h1>
        <p className="text-gray-400 mb-8">Import Bollywood actor and movie data from free sources</p>

        {/* WIKIPEDIA SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="cinema-card p-6 mb-8 border-l-4 border-l-green-500"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-400" />
              Wikipedia Dataset (FREE - No API Key)
            </h2>
            <button
              onClick={fetchWikiStatus}
              disabled={loadingWiki}
              className="text-sm text-cinema-gold hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWiki ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingWiki ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking dataset...
            </div>
          ) : wikiStatus ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 ${wikiStatus.datasetExists ? 'text-green-400' : 'text-red-400'}`}>
                {wikiStatus.datasetExists ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="font-medium">{wikiStatus.message}</span>
              </div>

              {wikiStatus.datasetExists && (
                <div className="text-sm text-gray-400">
                  <p>Pre-built dataset available with {wikiStatus.actorCount} actors and {wikiStatus.movieCount} movies</p>
                </div>
              )}

              {!wikiStatus.datasetExists && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">
                    <strong>Dataset not found.</strong> Run the generator script first.
                  </p>
                  <code className="block mt-2 p-2 bg-cinema-900 rounded text-cinema-gold text-sm">
                    cd packages/db/scripts && python generate_wiki_data.py
                  </code>
                </div>
              )}
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <button
              onClick={() => handleWikiIngest(false)}
              disabled={ingestingWiki || !wikiStatus?.datasetExists}
              className="cinema-card p-4 text-left hover:border-green-500/50 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-3">
                <Zap className="w-8 h-8 text-green-400" />
                {ingestingWiki && <Loader2 className="w-5 h-5 animate-spin text-green-400" />}
              </div>
              <h3 className="text-lg font-bold mb-1">Load Wikipedia Data</h3>
              <p className="text-sm text-gray-400">
                Import from pre-built dataset. Adds new entries without deleting existing data.
              </p>
            </button>

            <button
              onClick={() => handleWikiIngest(true)}
              disabled={ingestingWiki || !wikiStatus?.datasetExists}
              className="cinema-card p-4 text-left hover:border-cinema-red-light/50 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-3">
                <RefreshCw className={`w-8 h-8 text-cinema-red-light ${ingestingWiki ? 'animate-spin' : ''}`} />
              </div>
              <h3 className="text-lg font-bold mb-1">Replace with Wikipedia</h3>
              <p className="text-sm text-gray-400">
                Wipe existing data and load fresh from the Wikipedia dataset.
              </p>
            </button>
          </div>

          <div className="mt-4 p-4 bg-green-900/10 border border-green-500/20 rounded-lg">
            <h3 className="font-bold text-green-300 mb-2 text-sm">Why use Wikipedia data?</h3>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Completely free - no API key or rate limits</li>
              <li>Pre-curated dataset of 100+ actors and 400+ movies</li>
              <li>Includes popular aliases (SRK, Big B, Bebo, etc.)</li>
              <li>Instant loading - no network scraping delays</li>
              <li>Covers Bollywood from 1970s to 2025</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              Data sourced from Wikipedia filmographies and manually verified for accuracy.
              For live scraping, use the Python script at <code>packages/db/scripts/wikipedia_scraper.py</code>.
            </p>
          </div>
        </motion.div>

        {/* TMDB SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="cinema-card p-6 mb-8 opacity-80"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Cloud className="w-5 h-5 text-cinema-gold" />
              TMDB Ingestion (Requires API Key)
            </h2>
            <button
              onClick={fetchTmdbStatus}
              disabled={loadingTmdb}
              className="text-sm text-cinema-gold hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTmdb ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingTmdb ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking connection...
            </div>
          ) : tmdbStatus ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 ${tmdbStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
                {tmdbStatus.ok ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="font-medium">{tmdbStatus.message}</span>
              </div>

              {tmdbStatus.ok && tmdbStatus.rateLimit && (
                <div className="text-sm text-gray-400">
                  <p>Rate limit remaining: {tmdbStatus.rateLimit.remaining} requests</p>
                  <p>Resets at: {new Date(tmdbStatus.rateLimit.reset * 1000).toLocaleString()}</p>
                </div>
              )}

              {!tmdbStatus.ok && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">
                    <strong>Action required:</strong> Add your TMDB API key to <code>apps/api/.env</code> as:
                  </p>
                  <code className="block mt-2 p-2 bg-cinema-900 rounded text-cinema-gold text-sm">
                    TMDB_API_KEY=your_key_here
                  </code>
                  <p className="text-sm text-gray-400 mt-2">
                    Get a free key at{' '}
                    <a
                      href="https://www.themoviedb.org/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cinema-gold underline inline-flex items-center gap-1"
                    >
                      themoviedb.org/settings/api
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* TMDB Configuration */}
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-cinema-gold" />
              TMDB Settings
            </h3>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Actor Count</label>
                <input
                  type="number"
                  value={config.actorCount}
                  onChange={(e) => setConfig({ ...config, actorCount: parseInt(e.target.value) || 0 })}
                  min={10}
                  max={200}
                  className="search-input"
                />
                <p className="text-xs text-gray-500 mt-1">How many actors to import (10-200)</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Movie Pages</label>
                <input
                  type="number"
                  value={config.moviePages}
                  onChange={(e) => setConfig({ ...config, moviePages: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={100}
                  className="search-input"
                />
                <p className="text-xs text-gray-500 mt-1">TMDB pages to fetch (20 movies per page)</p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={config.includeRegional}
                onChange={(e) => setConfig({ ...config, includeRegional: e.target.checked })}
                className="w-4 h-4 rounded border-cinema-600 bg-cinema-700 text-cinema-gold"
              />
              <span className="text-sm flex items-center gap-1">
                <Globe className="w-4 h-4" />
                Include regional cinema (Tamil, Telugu, Marathi, Malayalam, Kannada, Bengali)
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={handleTmdbIngest}
                disabled={ingestingTmdb || !tmdbStatus?.ok}
                className="cinema-card p-4 text-left hover:border-cinema-gold/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-8 h-8 text-cinema-gold" />
                  {ingestingTmdb && <Loader2 className="w-5 h-5 animate-spin text-cinema-gold" />}
                </div>
                <h3 className="text-lg font-bold mb-1">Incremental Ingest</h3>
                <p className="text-sm text-gray-400">
                  Add new actors and movies without deleting existing data.
                </p>
              </button>

              <button
                onClick={handleTmdbRefresh}
                disabled={refreshingTmdb || !tmdbStatus?.ok}
                className="cinema-card p-4 text-left hover:border-cinema-red-light/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <RefreshCw className={`w-8 h-8 text-cinema-red-light ${refreshingTmdb ? 'animate-spin' : ''}`} />
                </div>
                <h3 className="text-lg font-bold mb-1">Full Refresh</h3>
                <p className="text-sm text-gray-400">
                  Wipe all existing data and re-download everything from TMDB.
                </p>
              </button>
            </div>
          </div>

          {/* FULL TMDB INGEST SECTION */}
          <div className="mt-6 pt-6 border-t border-cinema-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-cinema-gold-light">
              <Database className="w-5 h-5" />
              Full TMDB Ingest — Hindi Cinema
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Discovers <strong>every Hindi movie</strong> TMDB has, fetches all actors from credits,
              and stores rich metadata (biography, runtime, ratings, budgets, etc.).
              Supports resume if interrupted.
            </p>

            {progress && (
              <div className="mb-4 p-4 bg-cinema-700/50 rounded-lg">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-cinema-gold capitalize">{progress.phase.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400">{progress.percentComplete}%</span>
                </div>
                <div className="w-full bg-cinema-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-cinema-gold h-2 rounded-full transition-all"
                    style={{ width: `${progress.percentComplete}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span>Movies: {progress.processedMovies} / {progress.discoveredMovies}</span>
                  <span>Actors: {progress.processedActors} / {progress.totalActors}</span>
                  {progress.errors > 0 && <span className="text-red-400">Errors: {progress.errors}</span>}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleFullIngest}
                disabled={fullIngesting || !tmdbStatus?.ok}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {fullIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {fullIngesting ? 'Running...' : 'Start Full Ingest'}
              </button>
              {fullIngesting && (
                <button
                  onClick={handleCancelIngest}
                  className="btn-secondary inline-flex items-center gap-2 text-red-400 border-red-400/30"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <div className="mt-8 cinema-card p-6">
          <h3 className="font-bold mb-2">What gets imported?</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>Actor profiles (name, normalized name, aliases)</li>
            <li>Movie details (title, release year, genre)</li>
            <li>Cast relationships (who acted in what)</li>
            <li>Search aliases for nicknames (SRK, Big B, etc.)</li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            Wikipedia data is pre-built and requires no API key. TMDB free tier allows 40 requests per 10 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
