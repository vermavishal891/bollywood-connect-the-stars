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
import BrandLogo from '@/components/BrandLogo';

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
    <div className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-cinema-gold transition-colors hover:text-white">
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        <div className="mb-8">
          <BrandLogo variant="primary" className="mb-4 justify-start" imageClassName="h-28 w-28 object-contain drop-shadow-[0_0_24px_rgba(255,43,214,0.32)]" />
          <p className="section-title">Pick your showtime</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Choose Your Mode</h1>
          <p className="mt-3 max-w-2xl text-gray-400">Jump into classic play, race the clock, or narrow the film universe by region and theme.</p>
        </div>

        <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GAME_MODES.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={`/play?mode=${mode.id}&difficulty=medium`}
                className="cinema-card group block h-full p-5 transition-all hover:-translate-y-1 hover:border-cinema-gold/60"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-cinema-gold/30 bg-cinema-gold/10 text-cinema-gold">
                    {modeIcons[mode.id]}
                  </span>
                  <ChevronRight className="h-5 w-5 text-gray-500 transition-colors group-hover:text-cinema-gold" />
                </div>
                <h3 className="text-xl font-bold text-white">{mode.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{mode.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <section className="game-card mb-10 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-title">Difficulty</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Classic presets</h2>
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
                className="rounded-lg border border-cinema-600/50 bg-black/20 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-cinema-gold/60"
              >
                <DifficultyMarks level={diff.id} />
                <h3 className="mt-3 font-bold text-white">{diff.name}</h3>
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
                  className="rounded-lg border border-cinema-600/50 bg-black/20 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
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
                  className="rounded-lg border border-cinema-600/50 bg-black/20 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
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
