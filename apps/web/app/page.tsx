'use client';

import { useState } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { DIFFICULTIES, GAME_MODES, REGIONS, THEMES } from '@bollywood-connect/shared';

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState('classic');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');

  const gameModeIcons: Record<string, React.ReactNode> = {
    classic: <Star className="w-6 h-6" />,
    daily: <Calendar className="w-6 h-6" />,
    speedrun: <Zap className="w-6 h-6" />,
    shortest: <Trophy className="w-6 h-6" />,
    party: <Users className="w-6 h-6" />,
    regional: <Globe className="w-6 h-6" />,
    'movie-to-movie': <Film className="w-6 h-6" />,
    theme: <Palette className="w-6 h-6" />,
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-cinema-gold rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-cinema-red rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-6">
            <Film className="w-16 h-16 text-cinema-gold" />
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
            <span className="gold-gradient">Bollywood</span>
            <br />
            <span className="text-white">Connect</span>
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
            Connect two Indian film stars through shared movies. Alternate between actors and films to find the path.
          </p>
          <p className="text-sm text-cinema-gold/80 mb-10">
            Example: Shah Rukh Khan → Dear Zindagi → Alia Bhatt
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/modes"
              className="btn-primary text-lg inline-flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Start Playing
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link href="/daily" className="btn-secondary text-lg inline-flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Daily Challenge
            </Link>
          </div>
        </motion.div>
      </section>

      {/* How to Play */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-12 gold-gradient">
            How to Play
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Star className="w-8 h-8" />, title: 'Start', desc: 'Begin with the given Bollywood actor' },
              { icon: <Film className="w-8 h-8" />, title: 'Connect', desc: 'Find a movie they starred in, then a co-actor' },
              { icon: <Trophy className="w-8 h-8" />, title: 'Win', desc: 'Reach the target actor in the fewest moves' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="cinema-card p-6 text-center hover:cinema-glow transition-all"
              >
                <div className="text-cinema-gold mb-4 flex justify-center">{step.icon}</div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Game Modes */}
      <section className="px-6 py-16 bg-cinema-800/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-4 gold-gradient">
            Game Modes
          </h2>
          <p className="text-center text-gray-400 mb-10">Choose your style of play</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GAME_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`cinema-card p-5 text-left transition-all hover:scale-105 ${
                  selectedMode === mode.id ? 'border-cinema-gold/80 cinema-glow' : ''
                }`}
              >
                <div className="text-cinema-gold mb-3">{gameModeIcons[mode.id]}</div>
                <h3 className="font-bold mb-1">{mode.name}</h3>
                <p className="text-sm text-gray-400">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Difficulties */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-4 gold-gradient">
            Difficulty Levels
          </h2>
          <p className="text-center text-gray-400 mb-10">From easy connections to legendary puzzles</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`cinema-card p-5 text-center transition-all hover:scale-105 ${
                  selectedDifficulty === diff.id ? 'border-cinema-gold/80 cinema-glow' : ''
                }`}
              >
                <div className="text-2xl mb-2">
                  {diff.id === 'easy' && '⭐'}
                  {diff.id === 'medium' && '⭐⭐'}
                  {diff.id === 'hard' && '⭐⭐⭐'}
                  {diff.id === 'legend' && '👑'}
                </div>
                <h3 className="font-bold mb-1">{diff.name}</h3>
                <p className="text-sm text-gray-400">{diff.pathRange}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Regional & Themes */}
      <section className="px-6 py-16 bg-cinema-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-display font-bold mb-6 gold-gradient">Regional Cinema</h2>
              <div className="flex flex-wrap gap-3">
                {REGIONS.map((region) => (
                  <Link
                    key={region.id}
                    href={`/play?mode=regional&region=${region.id}`}
                    className="px-4 py-2 bg-cinema-700 rounded-lg hover:bg-cinema-600 transition-colors text-sm"
                  >
                    {region.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold mb-6 gold-gradient">Theme Modes</h2>
              <div className="flex flex-wrap gap-3">
                {THEMES.map((theme) => (
                  <Link
                    key={theme.id}
                    href={`/play?mode=theme&theme=${theme.id}`}
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
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-gray-500 text-sm border-t border-cinema-700">
        <p>Bollywood Connect - Made with ❤️ for Indian cinema fans</p>
        <div className="flex justify-center gap-4 mt-3">
          <Link href="/how-to-play" className="hover:text-cinema-gold transition-colors">
            How to Play
          </Link>
          <Link href="/leaderboard" className="hover:text-cinema-gold transition-colors">
            Leaderboard
          </Link>
          <Link href="/admin" className="hover:text-cinema-gold transition-colors">
            Admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
