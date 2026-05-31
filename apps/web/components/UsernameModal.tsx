'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function UsernameModal() {
  const { user, token, isNewUser, updateUser, clearNewUser } = useAuth();
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !username.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/username`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update username' }));
        throw new Error(err.error);
      }

      const data = await res.json();
      updateUser(data.user, data.token);
      clearNewUser();
      toast.success('Username set!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    clearNewUser();
  };

  return (
    <AnimatePresence>
      {isNewUser && user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="cinema-card w-full max-w-md p-6 relative"
          >
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-cinema-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-cinema-gold" />
              </div>
              <h2 className="text-xl font-bold mb-1">Welcome, {user.name || 'Player'}!</h2>
              <p className="text-gray-400 text-sm">
                Choose a username for the leaderboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. srk_fan42"
                  className="w-full px-4 py-3 bg-cinema-800 border border-cinema-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cinema-gold"
                  minLength={3}
                  maxLength={30}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  3-30 chars. Letters, numbers, underscores only.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || username.trim().length < 3}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Set Username
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-sm text-gray-500 hover:text-gray-300 py-2"
              >
                Skip for now
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
