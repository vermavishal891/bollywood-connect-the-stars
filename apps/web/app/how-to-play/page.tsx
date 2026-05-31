'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Film, Trophy, Lightbulb, Undo2, RotateCcw, Share2 } from 'lucide-react';

export default function HowToPlayPage() {
  const steps = [
    {
      icon: <Star className="w-8 h-8 text-cinema-gold" />,
      title: 'Start',
      description: 'Each game gives you two Bollywood actors - a starting actor and a target actor.',
    },
    {
      icon: <Film className="w-8 h-8 text-cinema-red-light" />,
      title: 'Connect',
      description: 'Find a movie the current actor starred in, then pick a co-actor from that movie. Keep alternating between movies and actors.',
    },
    {
      icon: <Trophy className="w-8 h-8 text-cinema-gold" />,
      title: 'Win',
      description: 'Reach the target actor! Fewer moves and less time means a higher score.',
    },
  ];

  const features = [
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: 'Hints',
      description: 'Stuck? Use soft clues, first-letter hints, decade clues, or reveal the best next step.',
    },
    {
      icon: <Undo2 className="w-6 h-6" />,
      title: 'Undo',
      description: 'Made a wrong move? Undo and try a different path.',
    },
    {
      icon: <RotateCcw className="w-6 h-6" />,
      title: 'Reset',
      description: 'Start fresh anytime with the same actor pair.',
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: 'Share',
      description: 'Challenge friends by sharing your path and score.',
    },
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-cinema-gold hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-display font-bold mb-4 gold-gradient">How to Play</h1>
        <p className="text-gray-400 mb-10 text-lg">
          Bollywood Connect is a trivia game where you link two Indian film stars through their shared movies.
        </p>

        <div className="space-y-6 mb-12">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="cinema-card p-6 flex items-start gap-4"
            >
              <div className="shrink-0 w-12 h-12 bg-cinema-700 rounded-full flex items-center justify-center">
                {step.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-gray-400">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="cinema-card p-6 mb-12">
          <h2 className="text-2xl font-bold mb-4 gold-gradient">Example Path</h2>
          <div className="flex flex-wrap items-center gap-3 text-lg">
            <span className="node-actor inline-flex">
              <Star className="w-4 h-4 text-cinema-gold" />
              Shah Rukh Khan
            </span>
            <ArrowLeft className="w-4 h-4 rotate-180 text-gray-500" />
            <span className="node-movie inline-flex">
              <Film className="w-4 h-4 text-cinema-red-light" />
              Dear Zindagi
            </span>
            <ArrowLeft className="w-4 h-4 rotate-180 text-gray-500" />
            <span className="node-actor inline-flex">
              <Star className="w-4 h-4 text-cinema-gold" />
              Alia Bhatt
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            SRK starred in Dear Zindagi with Alia Bhatt — a direct 1-move connection!
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-4 gold-gradient">Features</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="cinema-card p-5"
            >
              <div className="text-cinema-gold mb-3">{feature.icon}</div>
              <h3 className="font-bold mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/modes" className="btn-primary text-lg inline-flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Start Playing
          </Link>
        </div>
      </div>
    </div>
  );
}
