'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Film,
  Globe,
  Palette,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { DIFFICULTIES, GAME_MODES, REGIONS, THEMES } from '@bollywood-connect/shared';

const modeIcons: Record<string, ReactNode> = {
  classic: <Star className="h-7 w-7" />,
  daily: <Calendar className="h-7 w-7" />,
  speedrun: <Zap className="h-7 w-7" />,
  shortest: <Trophy className="h-7 w-7" />,
  party: <Users className="h-7 w-7" />,
  regional: <Globe className="h-7 w-7" />,
  'movie-to-movie': <Film className="h-7 w-7" />,
  theme: <Palette className="h-7 w-7" />,
};

const difficultyStrength: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  legend: 4,
};

function DifficultyMarks({ level }: { level: string }) {
  const count = difficultyStrength[level] || 1;
  return (
    <div className="flex justify-center gap-1 text-cinema-gold">
      {Array.from({ length: 4 }).map((_, index) => (
        <Star key={index} className={`h-4 w-4 ${index < count ? 'fill-current' : 'opacity-25'}`} />
      ))}
    </div>
  );
}

export default function ModesPage() {
  return (
    <div className="cinematic-page">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-cinema-gold transition-colors hover:text-white">
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        <header className="hero-stage mb-8 px-6 py-8 md:px-10 md:py-10">
          <div className="max-w-3xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
              <Film className="h-7 w-7" />
            </div>
            <p className="section-title">Choose Your Stardom Run</p>
            <h1 className="mt-3 font-display text-4xl font-black leading-tight text-white md:text-6xl">
              Pick your puzzle mode
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-300">
              Jump into classic play, race the clock, or narrow the film universe by region and theme.
            </p>
          </div>
        </header>

        <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GAME_MODES.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link href={`/play?mode=${mode.id}&difficulty=medium`} className="mode-card group block h-full">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
                    {modeIcons[mode.id]}
                  </span>
                  <ChevronRight className="h-5 w-5 text-gray-500 transition-colors group-hover:text-cinema-gold" />
                </div>
                <h3 className="text-xl font-black text-white">{mode.name}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">{mode.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <section className="game-card mb-10 p-6 md:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-title">Difficulty</p>
              <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Classic presets</h2>
            </div>
            <Link href="/play?mode=classic&difficulty=medium" className="btn-primary">
              Quick Play
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DIFFICULTIES.map((diff) => (
              <Link
                key={diff.id}
                href={`/play?mode=classic&difficulty=${diff.id}`}
                className="rounded-2xl border border-cinema-gold/15 bg-black/20 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-cinema-gold/60"
              >
                <DifficultyMarks level={diff.id} />
                <h3 className="mt-3 font-black text-white">{diff.name}</h3>
                <p className="mt-1 text-xs text-gray-400">{diff.pathRange}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="game-card p-6">
            <p className="section-title">Regional Cinema</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <Link
                  key={region.id}
                  href={`/play?mode=regional&region=${region.id}&difficulty=medium`}
                  className="rounded-full border border-cinema-gold/15 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
                >
                  {region.name}
                </Link>
              ))}
            </div>
          </section>

          <section className="game-card p-6">
            <p className="section-title">Themes</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <Link
                  key={theme.id}
                  href={`/play?mode=theme&theme=${theme.id}&difficulty=medium`}
                  className="rounded-full border border-cinema-gold/15 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
                >
                  {theme.name}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
