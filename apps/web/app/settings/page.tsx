'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, User, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function SettingsPage() {
  const { user, token, updateUser, logout } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Settings</h1>
          <p className="text-gray-400 mb-6">Sign in to manage your account</p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !username.trim() || username.trim() === user.username) return;

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
        const err = await res.json().catch(() => ({ error: 'Failed to update' }));
        throw new Error(err.error);
      }

      const data = await res.json();
      updateUser(data.user, data.token);
      toast.success('Username updated!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-cinema-gold hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient">Settings</h1>
          <div className="w-6" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cinema-card p-6 space-y-6"
        >
          {/* Profile header */}
          <div className="flex items-center gap-4">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt={user.username} className="w-16 h-16 rounded-full border-2 border-cinema-gold" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-cinema-gold/20 flex items-center justify-center border-2 border-cinema-gold">
                <User className="w-8 h-8 text-cinema-gold" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-lg">{user.name || user.username}</h2>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>

          <hr className="border-cinema-700" />

          {/* Username form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-4 py-3 bg-cinema-800 border border-cinema-700 rounded-lg text-white focus:outline-none focus:border-cinema-gold"
                  minLength={3}
                  maxLength={30}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || username.trim() === user.username || username.trim().length < 3}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Saving</span>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Letters, numbers, underscores only. 3-30 chars.
              </p>
            </div>
          </form>

          <hr className="border-cinema-700" />

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full py-3 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Log Out
          </button>
        </motion.div>
      </div>
    </div>
  );
}
