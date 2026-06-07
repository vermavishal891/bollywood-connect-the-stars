'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Film,
  Globe,
  Palette,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { DIFFICULTIES, GAME_MODES, REGIONS, THEMES } from '@bollywood-connect/shared';
import BrandLogo from '@/components/BrandLogo';
import { getRegions } from '@/lib/api';

const FEATURED_PUZZLE_HREF = '/play?mode=shortest&difficulty=medium&startActorId=93&targetActorId=205';

function getModeHref(modeId: string, difficulty: string) {
  if (modeId === 'daily') return '/daily';
  if (modeId === 'party') return '/party';
  if (modeId === 'regional') return `/play?mode=regional&region=hindi&difficulty=${difficulty}`;
  if (modeId === 'theme') return `/play?mode=theme&theme=romance&difficulty=${difficulty}`;
  return `/play?mode=${modeId}&difficulty=${difficulty}`;
}

const gameModeIcons: Record<string, ReactNode> = {
  classic: <Star className="h-6 w-6" />,
  daily: <Calendar className="h-6 w-6" />,
  speedrun: <Zap className="h-6 w-6" />,
  shortest: <Trophy className="h-6 w-6" />,
  party: <Users className="h-6 w-6" />,
  regional: <Globe className="h-6 w-6" />,
  'movie-to-movie': <Film className="h-6 w-6" />,
  theme: <Palette className="h-6 w-6" />,
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

function NodeMap() {
  return (
    <div className="node-map">
      <span className="stellar-node left-[5%] top-[52%]">
        <Star className="h-6 w-6 fill-current" />
      </span>
      <span className="stellar-node left-[26%] top-[30%] border-cinema-red-light/40 text-cinema-red-light">
        <Film className="h-6 w-6" />
      </span>
      <span className="stellar-node left-[48%] top-[58%] border-cinema-blue/40 text-cinema-blue">
        <Sparkles className="h-6 w-6" />
      </span>
      <span className="stellar-node left-[70%] top-[28%]">
        <Trophy className="h-6 w-6" />
      </span>
      <span className="stellar-node right-[4%] top-[52%] border-cinema-red-light/40 text-cinema-red-light">
        <Star className="h-6 w-6 fill-current" />
      </span>
    </div>
  );
}

function ModeCard({
  title,
  description,
  icon,
  href,
  accent = 'gold',
}: {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  accent?: 'gold' | 'pink' | 'blue' | 'cyan';
}) {
  const accentClass = {
    gold: 'text-cinema-gold border-cinema-gold/35 bg-cinema-gold/10',
    pink: 'text-cinema-red-light border-cinema-red-light/35 bg-cinema-red/10',
    blue: 'text-cinema-blue border-cinema-blue/35 bg-cinema-blue/10',
    cyan: 'text-cinema-teal border-cinema-teal/35 bg-cinema-teal/10',
  }[accent];

  return (
    <Link href={href} className="mode-card group block">
      <div className={`mb-8 flex h-14 w-14 items-center justify-center rounded-full border ${accentClass}`}>
        {icon}
      </div>
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-3 min-h-[4.75rem] text-sm leading-6 text-gray-400">{description}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-cinema-gold transition-transform group-hover:translate-x-1">
        Enter <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState('classic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [availableRegionIds, setAvailableRegionIds] = useState<Set<string>>(new Set(['hindi']));

  const featuredModes = GAME_MODES.slice(0, 4);

  useEffect(() => {
    getRegions()
      .then((regions) => {
        setAvailableRegionIds(new Set(regions.filter((region: any) => region.available).map((region: any) => region.id)));
      })
      .catch(() => setAvailableRegionIds(new Set(['hindi'])));
  }, []);

  return (
    <div className="cinematic-page">
      <section className="mx-auto max-w-7xl">
        <div className="hero-stage grid min-h-[calc(100vh-7rem)] gap-10 px-5 py-8 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)] lg:items-center">
          <div>
            <div className="mb-8 inline-flex">
              <BrandLogo
                variant="mark"
                showWordmark
                imageClassName="h-12 w-12 p-1.5"
                wordmarkClassName="text-left"
              />
            </div>
            <h1 className="max-w-3xl font-display text-5xl font-black leading-[1.02] text-cinema-gold-light md:text-7xl">
              Bollywood <span className="gold-gradient">Connect</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300 md:text-xl">
              Trace cinematic links between stars, films, directors, and songs in a glowing puzzle universe built for quick plays and daily rivalries.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/modes" className="btn-primary text-base">
                Play
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/daily" className="btn-secondary text-base">
                <Calendar className="h-5 w-5" />
                Daily Challenge
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ['120K', 'player routes'],
                ['4 modes', 'built for pace'],
                ['3 min', 'average solve'],
              ].map(([value, label]) => (
                <div key={label} className="cinema-card rounded-2xl p-4">
                  <p className="text-2xl font-black text-cinema-gold">{value}</p>
                  <p className="mt-1 text-sm text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="film-reel absolute -right-2 top-6 h-24 w-24 opacity-70 md:h-32 md:w-32" />
            <div className="game-card relative overflow-hidden p-5 md:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-title">Featured Puzzle</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Shah Rukh Khan to Deepika Padukone</h2>
                </div>
                <Sparkles className="h-8 w-8 text-cinema-gold" />
              </div>
              <NodeMap />
              <p className="mt-6 text-sm leading-6 text-gray-400">
                Find the shortest cinematic bridge through shared movies, co-stars, and creators.
              </p>
              <Link href={FEATURED_PUZZLE_HREF} className="btn-primary mt-6">
                Solve Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-title">Choose Your Stardom Run</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-5xl">Game Modes</h2>
          </div>
          <Link href={getModeHref(selectedMode, selectedDifficulty)} className="btn-primary">
            Play Selected
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredModes.map((mode, index) => (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setSelectedMode(mode.id)}
              className={`mode-card text-left ${selectedMode === mode.id ? 'border-cinema-gold/70 cinema-glow' : ''}`}
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
                  {gameModeIcons[mode.id]}
                </span>
                {selectedMode === mode.id && <span className="h-2.5 w-2.5 rounded-full bg-cinema-gold shadow-lg shadow-cinema-gold/50" />}
              </div>
              <h3 className="text-xl font-black text-white">{mode.name}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-400">{mode.description}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1fr]">
        <div className="game-card p-6 md:p-8">
          <p className="section-title">Tune The Puzzle</p>
          <h2 className="mt-2 text-3xl font-black text-white">Difficulty</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`rounded-2xl border p-4 text-center transition-all hover:-translate-y-0.5 ${
                  selectedDifficulty === diff.id
                    ? 'border-cinema-gold/70 bg-cinema-gold/10'
                    : 'border-cinema-gold/15 bg-black/20 hover:border-cinema-gold/40'
                }`}
              >
                <DifficultyMarks level={diff.id} />
                <h3 className="mt-3 font-black text-white">{diff.name}</h3>
                <p className="mt-1 text-xs text-gray-400">{diff.pathRange}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <ModeCard
            title="Daily Challenge"
            description="One global puzzle each day with streaks, hints, and cinematic trivia."
            icon={<Calendar className="h-6 w-6" />}
            href="/daily"
          />
          <ModeCard
            title="Speedrun"
            description="Beat the clock through fast celebrity links and combo bonuses."
            icon={<Zap className="h-6 w-6" />}
            href="/play?mode=speedrun&difficulty=medium"
            accent="pink"
          />
          <ModeCard
            title="Shortest Path"
            description="Craft the cleanest connection and compare exact move counts."
            icon={<Trophy className="h-6 w-6" />}
            href="/play?mode=shortest&difficulty=medium"
            accent="blue"
          />
        </div>
      </section>

      <section className="mx-auto mt-14 grid max-w-7xl gap-5 lg:grid-cols-2">
        <div className="game-card p-6">
          <p className="section-title">Regional Cinema</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              availableRegionIds.has(region.id) ? (
                <Link
                  key={region.id}
                  href={`/play?mode=regional&region=${region.id}&difficulty=${selectedDifficulty}`}
                  className="rounded-full border border-cinema-gold/15 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
                >
                  {region.name}
                </Link>
              ) : (
                <span
                  key={region.id}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-500"
                  title="Regional data is not available yet"
                >
                  {region.name} · Data soon
                </span>
              )
            ))}
          </div>
        </div>

        <div className="game-card p-6">
          <p className="section-title">Theme Modes</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <Link
                key={theme.id}
                href={`/play?mode=theme&theme=${theme.id}&difficulty=${selectedDifficulty}`}
                className="rounded-full border border-cinema-gold/15 bg-black/25 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
              >
                {theme.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-16 max-w-7xl border-t border-cinema-gold/10 pt-8 text-sm text-gray-500">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <BrandLogo variant="mark" showWordmark imageClassName="h-10 w-10 p-1" />
          <div className="flex flex-wrap gap-4">
            <Link href="/how-to-play" className="transition-colors hover:text-cinema-gold">
              How to Play
            </Link>
            <Link href="/leaderboard" className="transition-colors hover:text-cinema-gold">
              Leaderboard
            </Link>
            <Link href="/modes" className="transition-colors hover:text-cinema-gold">
              Modes
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
