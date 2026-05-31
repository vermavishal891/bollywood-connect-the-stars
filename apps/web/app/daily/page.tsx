'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Home, ArrowRight, Star, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDailyChallenge } from '@/lib/api';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cinema-gold animate-pulse text-xl">Loading daily challenge...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient">Daily Challenge</h1>
          <div className="w-6" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cinema-card p-8 text-center"
        >
          <Calendar className="w-12 h-12 text-cinema-gold mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <p className="text-gray-400 mb-6">Same puzzle for everyone. Can you solve it?</p>

          {challenge && (
            <>
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="flex flex-col items-center">
                  {challenge.startActor?.profileImageUrl && (
                    <img src={challenge.startActor.profileImageUrl} alt={challenge.startActor.name} className="w-14 h-14 rounded-full object-cover border-2 border-cinema-gold mb-2" />
                  )}
                  <div className="node-actor">
                    <Star className="w-5 h-5 text-cinema-gold" />
                    <span className="font-bold">{challenge.startActor?.name || 'Loading...'}</span>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-cinema-gold" />
                <div className="node-actor border-cinema-red-light">
                  <Star className="w-5 h-5 text-cinema-red-light" />
                  <span className="font-bold">???</span>
                </div>
              </div>

              {challenge.description && (
                <p className="text-sm text-gray-300 mb-6 italic">{challenge.description}</p>
              )}

              <Link
                href={`/play?mode=daily&difficulty=${challenge.difficulty}`}
                className="btn-primary inline-flex items-center gap-2 text-lg"
              >
                <Clock className="w-5 h-5" />
                Play Daily Challenge
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
