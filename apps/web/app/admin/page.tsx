'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Users, Film, Trophy, AlertCircle, TrendingUp, Cloud, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminStats, getAdminActors, getAdminMovies } from '@/lib/api';

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [actors, setActors] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminStats(), getAdminActors(0, 20), getAdminMovies(0, 20)])
      .then(([s, a, m]) => {
        setStats(s);
        setActors(a);
        setMovies(m);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cinema-gold animate-pulse text-xl">Loading admin...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient">Admin Dashboard</h1>
          <div className="w-6" />
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Actors', value: stats.totalActors, icon: <Users className="w-6 h-6" /> },
              { label: 'Movies', value: stats.totalMovies, icon: <Film className="w-6 h-6" /> },
              { label: 'Games', value: stats.totalGames, icon: <Trophy className="w-6 h-6" /> },
              { label: 'Pending', value: stats.pendingModerations, icon: <AlertCircle className="w-6 h-6" /> },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="cinema-card p-4 text-center"
              >
                <div className="text-cinema-gold mb-2 flex justify-center">{stat.icon}</div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* TMDB Ingestion Link */}
        <Link
          href="/admin/ingestion"
          className="cinema-card p-4 flex items-center justify-between mb-6 hover:border-cinema-gold/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cinema-700 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-cinema-gold" />
            </div>
            <div>
              <h3 className="font-bold">TMDB Ingestion</h3>
              <p className="text-sm text-gray-400">Import live Bollywood data from The Movie Database</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cinema-gold transition-colors" />
        </Link>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-cinema-700 pb-2">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'actors', label: 'Actors' },
            { id: 'movies', label: 'Movies' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-cinema-gold text-cinema-900 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="cinema-card p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cinema-gold" />
              Platform Overview
            </h2>
            <div className="space-y-3 text-gray-300">
              <p>Welcome to the Bollywood Connect admin dashboard.</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Use the Actors tab to review and manage actor entries</li>
                <li>Use the Movies tab to review and manage movie entries</li>
                <li>Monitor pending moderation items for quality control</li>
                <li>Track game engagement through total games played</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'actors' && (
          <div className="space-y-3">
            {actors.map((actor) => (
              <div key={actor.id} className="cinema-card p-4 flex items-center gap-4">
                {actor.profileImageUrl ? (
                  <img src={actor.profileImageUrl} alt={actor.name} className="w-10 h-10 rounded-full object-cover border border-cinema-gold/50" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cinema-600 flex items-center justify-center text-cinema-gold font-bold">
                    {actor.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{actor.name}</p>
                  <p className="text-sm text-gray-400">
                    Popularity: {actor.popularityScore} · {actor.isBollywood ? 'Bollywood' : 'Other'}
                  </p>
                  {actor.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{actor.description}</p>}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(actor.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'movies' && (
          <div className="space-y-3">
            {movies.map((movie) => (
              <div key={movie.id} className="cinema-card p-4 flex items-center gap-4">
                {movie.posterUrl ? (
                  <img src={movie.posterUrl} alt={movie.title} className="w-10 h-14 rounded object-cover border border-cinema-red-light/30" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-cinema-600 flex items-center justify-center text-cinema-red-light font-bold">
                    {movie.title[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{movie.title}</p>
                  <p className="text-sm text-gray-400">
                    {movie.releaseYear} · {movie.genre || 'Unknown'} · {movie.region}
                  </p>
                  {movie.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{movie.description}</p>}
                </div>
                <div className="text-xs text-gray-500">
                  {movie.isBollywood ? 'Bollywood' : 'Other'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
