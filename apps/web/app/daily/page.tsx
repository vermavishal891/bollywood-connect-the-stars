'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock, Home, Loader2, Star, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDailyChallenge } from '@/lib/api';

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ActorToken({ name, imageUrl, mystery = false }: { name?: string; imageUrl?: string | null; mystery?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {imageUrl && !mystery ? (
        <img src={imageUrl} alt={name || 'Actor'} className="hero-avatar h-24 w-24 bg-cinema-700" />
      ) : (
        <div
          className={`hero-avatar flex h-24 w-24 items-center justify-center bg-gradient-to-br from-cinema-700 to-cinema-900 text-2xl font-bold ${
            mystery ? 'text-cinema-red-light' : 'text-cinema-gold'
          }`}
        >
          {mystery ? '?' : initials(name)}
        </div>
      )}
      <span className="mt-3 max-w-[180px] text-balance text-lg font-black text-white">{mystery ? 'Mystery Target' : name}</span>
    </div>
  );
}

export default function DailyPage() {
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailyChallenge()
      .then(setChallenge)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="game-card flex items-center gap-3 px-6 py-5 text-cinema-gold">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-bold">Loading daily challenge...</span>
        </div>
      </div>
    );
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="cinematic-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="icon-button" aria-label="Go home">
            <Home className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="section-title">Daily Challenge</p>
            <h1 className="mt-1 text-3xl font-black text-white">{dateLabel}</h1>
          </div>
          <div className="h-11 w-11" />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-stage overflow-hidden p-6 text-center md:p-10"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-cinema-gold/40 bg-cinema-gold/10 text-cinema-gold">
            <Calendar className="h-7 w-7" />
          </div>

          <h2 className="font-display text-4xl font-black text-white md:text-5xl">One puzzle, everyone playing</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-gray-300">A fresh actor connection for the day, with the target hidden until you solve the route.</p>

          {challenge && (
            <>
              <div className="my-10 grid items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
                <ActorToken name={challenge.startActor?.name} imageUrl={challenge.startActor?.profileImageUrl} />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-cinema-gold/40 bg-black/30 text-cinema-gold shadow-lg shadow-cinema-gold/15">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <ActorToken
                  name={challenge.completedToday ? challenge.targetActor?.name : undefined}
                  imageUrl={challenge.completedToday ? challenge.targetActor?.profileImageUrl : undefined}
                  mystery={!challenge.completedToday}
                />
              </div>

              {challenge.description && (
                <p className="mx-auto mb-6 max-w-2xl rounded-2xl border border-cinema-gold/15 bg-black/25 px-4 py-3 text-sm leading-6 text-gray-300">
                  {challenge.description}
                </p>
              )}

              <div className="mb-7 flex flex-wrap justify-center gap-2">
                <div className="stat-pill">
                  <Star className="h-4 w-4 text-cinema-gold" />
                  <span className="capitalize">{challenge.difficulty}</span>
                </div>
                <div className="stat-pill">
                  <Trophy className="h-4 w-4 text-cinema-teal" />
                  <span>{challenge.completedToday ? `Completed · ${challenge.completedToday.score}` : 'Daily board'}</span>
                </div>
              </div>

              <Link href={`/play?mode=daily&difficulty=${challenge.difficulty}`} className={challenge.completedToday ? 'btn-secondary text-base' : 'btn-primary text-base'}>
                <Clock className="h-5 w-5" />
                {challenge.completedToday ? 'Improve Today' : 'Play Daily Challenge'}
              </Link>
            </>
          )}
        </motion.section>
      </div>
    </div>
  );
}
