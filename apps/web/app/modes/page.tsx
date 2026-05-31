'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Star,
  Film,
  Trophy,
  Zap,
  Users,
  Globe,
  Palette,
  Calendar,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { GAME_MODES, DIFFICULTIES, REGIONS, THEMES } from '@bollywood-connect/shared';

const modeIcons: Record<string, React.ReactNode> = {
  classic: <Star className="w-8 h-8" />,
  daily: <Calendar className="w-8 h-8" />,
  speedrun: <Zap className="w-8 h-8" />,
  shortest: <Trophy className="w-8 h-8" />,
  party: <Users className="w-8 h-8" />,
  regional: <Globe className="w-8 h-8" />,
  'movie-to-movie': <Film className="w-8 h-8" />,
  theme: <Palette className="w-8 h-8" />,
};

export default function ModesPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-cinema-gold hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-display font-bold mb-2 gold-gradient">Choose Your Mode</h1>
        <p className="text-gray-400 mb-8">Select how you want to play Bollywood Connect</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {GAME_MODES.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={`/play?mode=${mode.id}&difficulty=medium`}
                className="cinema-card p-6 block hover:cinema-glow transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-start justify-between">
                  <div className="text-cinema-gold mb-3">{modeIcons[mode.id]}</div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cinema-gold transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-1">{mode.name}</h3>
                <p className="text-sm text-gray-400">{mode.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <h2 className="text-2xl font-display font-bold mb-4 gold-gradient">Difficulty</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {DIFFICULTIES.map((diff) => (
            <Link
              key={diff.id}
              href={`/play?mode=classic&difficulty=${diff.id}`}
              className="cinema-card p-4 text-center hover:border-cinema-gold/50 transition-all"
            >
              <div className="text-2xl mb-2">
                {diff.id === 'easy' && '⭐'}
                {diff.id === 'medium' && '⭐⭐'}
                {diff.id === 'hard' && '⭐⭐⭐'}
                {diff.id === 'legend' && '👑'}
              </div>
              <h3 className="font-bold">{diff.name}</h3>
              <p className="text-xs text-gray-400">{diff.pathRange}</p>
            </Link>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-display font-bold mb-4 gold-gradient">Regional Cinema</h2>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <Link
                  key={region.id}
                  href={`/play?mode=regional&region=${region.id}&difficulty=medium`}
                  className="px-4 py-2 bg-cinema-700 rounded-lg hover:bg-cinema-600 transition-colors text-sm"
                >
                  {region.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-display font-bold mb-4 gold-gradient">Themes</h2>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <Link
                  key={theme.id}
                  href={`/play?mode=theme&theme=${theme.id}&difficulty=medium`}
                  className="px-4 py-2 bg-cinema-700 rounded-lg hover:bg-cinema-600 transition-colors text-sm flex items-center gap-2"
                >
                  <span>{theme.icon}</span>
                  {theme.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
