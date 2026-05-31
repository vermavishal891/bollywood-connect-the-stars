'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Trophy, Clock, Star, Film, Medal } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaderboard } from '@/lib/api';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = filter !== 'all' ? { difficulty: filter } : {};
    getLeaderboard(params)
      .then(setEntries)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient">Leaderboard</h1>
          <div className="w-6" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {['all', 'easy', 'medium', 'hard', 'legend'].map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === d
                  ? 'bg-cinema-gold text-cinema-900 font-bold'
                  : 'bg-cinema-700 text-white hover:bg-cinema-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-cinema-gold animate-pulse">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="cinema-card p-8 text-center text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-cinema-gold/50" />
            <p>No entries yet. Be the first to play!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`cinema-card p-4 flex items-center gap-4 ${
                  index < 3 ? 'border-cinema-gold/30' : ''
                }`}
              >
                <div className="w-10 text-center">
                  {index === 0 && <Medal className="w-8 h-8 text-yellow-400 mx-auto" />}
                  {index === 1 && <Medal className="w-8 h-8 text-gray-300 mx-auto" />}
                  {index === 2 && <Medal className="w-8 h-8 text-amber-600 mx-auto" />}
                  {index > 2 && <span className="text-lg font-bold text-gray-400">#{index + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{entry.playerName}</p>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Star className="w-3 h-3" />
                    {entry.startActor}
                    <Film className="w-3 h-3" />
                    {entry.targetActor}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <div className="flex items-center gap-1 text-cinema-gold">
                    <Trophy className="w-4 h-4" />
                    <span className="font-bold">{entry.score}</span>
                  </div>
                  <div className="text-gray-400">
                    {entry.movesCount} moves · {formatTime(entry.timeTaken)}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {entry.difficulty} · {entry.mode}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
