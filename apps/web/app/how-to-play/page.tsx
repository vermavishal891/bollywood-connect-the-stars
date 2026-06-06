'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Film, Lightbulb, RotateCcw, Share2, Star, Trophy, Undo2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

export default function HowToPlayPage() {
  const steps = [
    {
      icon: <Star className="h-8 w-8 text-cinema-gold" />,
      title: 'Start',
      description: 'Each game gives you a starting actor and a target actor.',
    },
    {
      icon: <Film className="h-8 w-8 text-cinema-red-light" />,
      title: 'Connect',
      description: 'Pick a movie the current actor starred in, then pick a co-actor from that movie.',
    },
    {
      icon: <Trophy className="h-8 w-8 text-cinema-gold" />,
      title: 'Win',
      description: 'Reach the target actor with fewer moves and less time for a higher score.',
    },
  ];

  const features = [
    {
      icon: <Lightbulb className="h-6 w-6" />,
      title: 'Hints',
      description: 'Use soft clues, first-letter hints, decade clues, or a best-next reveal.',
    },
    {
      icon: <Undo2 className="h-6 w-6" />,
      title: 'Undo',
      description: 'Step back from a wrong route and try another connection.',
    },
    {
      icon: <RotateCcw className="h-6 w-6" />,
      title: 'Reset',
      description: 'Restart the same actor pair without changing the puzzle.',
    },
    {
      icon: <Share2 className="h-6 w-6" />,
      title: 'Share',
      description: 'Copy your final path and challenge friends to beat your result.',
    },
  ];

  return (
    <div className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-cinema-gold transition-colors hover:text-white">
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        <div className="mb-10">
          <BrandLogo variant="gold" className="mb-4 justify-start" imageClassName="h-24 w-24 object-contain" />
          <p className="section-title">Rules</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">How to Play</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-400">
            Link two Indian film stars through movies they share. The path alternates actor, movie, actor until the target is reached.
          </p>
        </div>

        <div className="mb-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="cinema-card p-5"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-cinema-gold/30 bg-cinema-gold/10">
                {step.icon}
              </div>
              <span className="section-title">Step {index + 1}</span>
              <h3 className="mt-2 text-xl font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <section className="game-card mb-12 p-6">
          <p className="section-title">Example Path</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-base">
            <span className="node-actor">
              <Star className="h-4 w-4 fill-current text-cinema-gold" />
              Shah Rukh Khan
            </span>
            <ArrowRight className="h-5 w-5 text-gray-500" />
            <span className="node-movie">
              <Film className="h-4 w-4 text-cinema-red-light" />
              Dear Zindagi
            </span>
            <ArrowRight className="h-5 w-5 text-gray-500" />
            <span className="node-actor">
              <Star className="h-4 w-4 fill-current text-cinema-gold" />
              Alia Bhatt
            </span>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Shah Rukh Khan starred in Dear Zindagi with Alia Bhatt, creating a direct connection.
          </p>
        </section>

        <section className="mb-12">
          <p className="section-title">Controls</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.06 }}
                className="cinema-card p-5"
              >
                <div className="mb-3 text-cinema-gold">{feature.icon}</div>
                <h3 className="font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="text-center">
          <Link href="/modes" className="btn-primary text-base">
            <Trophy className="h-5 w-5" />
            Start Playing
          </Link>
        </div>
      </div>
    </div>
  );
}
