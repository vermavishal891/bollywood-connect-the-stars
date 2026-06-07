'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Film, Home, Loader2, Medal, Star, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaderboard } from '@/lib/api';

const filters = ['all', 'easy', 'medium', 'hard', 'legend'];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = filter !== 'all' ? { difficulty: filter } : {};
    setLoading(true);
    getLeaderboard(params)
      .then(setEntries)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="cinematic-page">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="icon-button" aria-label="Go home">
            <Home className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
              <Trophy className="h-6 w-6" />
            </div>
            <p className="section-title">High Scores</p>
            <h1 className="mt-1 font-display text-3xl font-black text-white md:text-5xl">Star Leaderboard</h1>
          </div>
          <div className="h-11 w-11" />
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {filters.map((difficulty) => (
            <button
              key={difficulty}
              onClick={() => setFilter(difficulty)}
              className={`rounded-full border px-4 py-2 text-sm font-bold capitalize transition-all ${
                filter === difficulty
                  ? 'border-cinema-gold bg-cinema-gold text-cinema-950'
                  : 'border-cinema-gold/15 bg-black/25 text-gray-200 hover:border-cinema-gold/50 hover:text-white'
              }`}
            >
              {difficulty}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="game-card flex items-center justify-center gap-3 p-8 text-cinema-gold">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-bold">Loading scores...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="game-card p-10 text-center">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-cinema-gold/50" />
            <h2 className="text-xl font-bold text-white">No entries yet</h2>
            <p className="mt-2 text-gray-400">Be the first player to claim this board.</p>
            <Link href="/play" className="btn-primary mt-6">
              Start Playing
            </Link>
          </div>
        ) : (
          <div className="game-card overflow-hidden p-3 md:p-5">
            <div className="hidden grid-cols-[80px_minmax(0,1fr)_260px] gap-4 border-b border-cinema-gold/10 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-cinema-gold md:grid">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-center">Scoreline</span>
            </div>
            <div className="space-y-3 pt-3">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`grid gap-4 rounded-2xl border bg-black/20 p-4 md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center ${
                  index < 3 ? 'border-cinema-gold/40' : ''
                }`}
              >
                <div className="flex items-center justify-start md:justify-center">
                  {index < 3 ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold">
                      <Medal className="h-7 w-7" />
                    </div>
                  ) : (
                    <span className="text-lg font-black text-gray-400">#{index + 1}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-black text-white">{entry.playerName}</p>
                    <span className="rounded-full border border-cinema-gold/15 bg-black/20 px-2 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                      {entry.difficulty}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <Star className="h-3.5 w-3.5 text-cinema-gold" />
                    <span>{entry.startActor}</span>
                    <Film className="h-3.5 w-3.5 text-cinema-red-light" />
                    <span>{entry.targetActor}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm md:min-w-[260px]">
                  <div className="stat-pill justify-center">
                    <Trophy className="h-4 w-4 text-cinema-gold" />
                    <span className="font-bold text-white">{entry.score}</span>
                  </div>
                  <div className="stat-pill justify-center">
                    <Film className="h-4 w-4 text-cinema-red-light" />
                    <span>{entry.movesCount}</span>
                  </div>
                  <div className="stat-pill justify-center">
                    <Clock className="h-4 w-4 text-cinema-teal" />
                    <span>{formatTime(entry.timeTaken)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
