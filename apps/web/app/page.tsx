'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
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

function PreviewNode({ icon, label, tone = 'gold' }: { icon: ReactNode; label: string; tone?: 'gold' | 'red' }) {
  return (
    <div
      className={`min-w-[136px] rounded-lg border p-3 text-center ${
        tone === 'gold' ? 'border-cinema-gold/40 bg-cinema-gold/10' : 'border-cinema-red-light/40 bg-cinema-red/20'
      }`}
    >
      <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border ${tone === 'gold' ? 'border-cinema-gold/50 text-cinema-gold' : 'border-cinema-red-light/50 text-cinema-red-light'}`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-white">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState('classic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');

  return (
    <div className="min-h-screen">
      <section className="px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
          <div>
            <BrandLogo
              variant="primary"
              className="mb-2 justify-start"
              imageClassName="h-56 w-56 md:h-72 md:w-72 drop-shadow-[0_0_42px_rgba(255,43,214,0.34)]"
            />
            <h1 className="sr-only">Bollywood Connect</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300 md:text-xl">
              Link Indian film stars through shared movies. Every move alternates between actor and film until the target star is on your path.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/modes" className="btn-primary text-base">
                <Sparkles className="h-5 w-5" />
                Start Playing
                <ChevronRight className="h-5 w-5" />
              </Link>
              <Link href="/daily" className="btn-secondary text-base">
                <Calendar className="h-5 w-5" />
                Daily Challenge
              </Link>
            </div>
          </div>

          <div className="game-card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Sample Path</p>
                <h2 className="mt-1 text-2xl font-bold text-white">Find the bridge</h2>
              </div>
              <div className="stat-pill">
                <Trophy className="h-4 w-4 text-cinema-teal" />
                <span>3 moves</span>
              </div>
            </div>

            <div className="space-y-3">
              <PreviewNode
                icon={<img src="/brand/03_app_icons/golden_star_connected_nodes_icon_64x64.png" alt="" className="h-9 w-9 object-contain" />}
                label="Shah Rukh Khan"
              />
              <div className="ml-16 h-8 w-px bg-gradient-to-b from-cinema-gold/80 to-cinema-red-light/50" />
              <PreviewNode
                icon={<img src="/brand/03_app_icons/neon_glamour_primary_icon_64x64.png" alt="" className="h-9 w-9 object-contain" />}
                label="Dear Zindagi"
                tone="red"
              />
              <div className="ml-16 h-8 w-px bg-gradient-to-b from-cinema-red-light/70 to-cinema-gold/70" />
              <PreviewNode
                icon={<img src="/brand/03_app_icons/golden_star_connected_nodes_icon_64x64.png" alt="" className="h-9 w-9 object-contain" />}
                label="Alia Bhatt"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-title">Choose a format</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Game Modes</h2>
            </div>
            <Link href={`/play?mode=${selectedMode}&difficulty=${selectedDifficulty}`} className="btn-primary">
              Play Selected
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GAME_MODES.map((mode, index) => (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => setSelectedMode(mode.id)}
                className={`cinema-card p-5 text-left transition-all hover:-translate-y-1 ${
                  selectedMode === mode.id ? 'border-cinema-gold/70 cinema-glow' : ''
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-cinema-gold/30 bg-cinema-gold/10 text-cinema-gold">
                    {gameModeIcons[mode.id]}
                  </span>
                  {selectedMode === mode.id && <span className="h-2 w-2 rounded-full bg-cinema-gold" />}
                </div>
                <h3 className="text-lg font-bold text-white">{mode.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{mode.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="game-card p-6">
            <p className="section-title">Tune the puzzle</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Difficulty</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`rounded-lg border p-4 text-center transition-all hover:-translate-y-0.5 ${
                    selectedDifficulty === diff.id
                      ? 'border-cinema-gold/70 bg-cinema-gold/10'
                      : 'border-cinema-600/50 bg-black/20 hover:border-cinema-gold/40'
                  }`}
                >
                  <DifficultyMarks level={diff.id} />
                  <h3 className="mt-3 font-bold text-white">{diff.name}</h3>
                  <p className="mt-1 text-xs text-gray-400">{diff.pathRange}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="game-card p-6">
              <p className="section-title">Regional Cinema</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <Link
                    key={region.id}
                    href={`/play?mode=regional&region=${region.id}&difficulty=${selectedDifficulty}`}
                    className="rounded-lg border border-cinema-600/50 bg-black/20 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
                  >
                    {region.name}
                  </Link>
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
                    className="rounded-lg border border-cinema-600/50 bg-black/20 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-cinema-gold/50 hover:text-white"
                  >
                    {theme.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-cinema-600/40 px-4 py-8 text-center text-sm text-gray-500">
        <BrandLogo variant="footer" className="mx-auto mb-3" imageClassName="h-24 w-24 object-contain" />
        <p>Made for Indian cinema fans.</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/how-to-play" className="transition-colors hover:text-cinema-gold">
            How to Play
          </Link>
          <Link href="/leaderboard" className="transition-colors hover:text-cinema-gold">
            Leaderboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
