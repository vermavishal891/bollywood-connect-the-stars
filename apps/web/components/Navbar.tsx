'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Calendar, Settings, Home, Sparkles, HelpCircle, User, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import GoogleLoginButton from './GoogleLoginButton';
import BrandLogo from './BrandLogo';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { href: '/', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { href: '/how-to-play', label: 'How to Play', icon: <HelpCircle className="w-4 h-4" /> },
    { href: '/daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
    { href: '/admin', label: 'Admin', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-cinema-600/40 bg-cinema-900/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 md:px-6">
        <Link href="/" className="group flex shrink-0 items-center rounded-lg px-1 py-1">
          <BrandLogo variant="primary" imageClassName="h-14 w-14 sm:h-16 sm:w-16 drop-shadow-[0_0_18px_rgba(255,43,214,0.35)]" />
          <span className="sr-only">Bollywood Connect</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-cinema-600/40 bg-black/20 p-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all ${
                pathname === link.href
                  ? 'bg-cinema-gold text-cinema-900 shadow-sm shadow-cinema-gold/20'
                  : 'text-gray-400 hover:bg-cinema-800/80 hover:text-white'
              }`}
            >
              {link.icon}
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          ))}
          </div>

          <Link
            href="/play"
            className="btn-primary shrink-0 px-4 py-2.5"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Play</span>
          </Link>

          <div className="flex shrink-0 items-center">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-lg border border-cinema-600/40 bg-black/20 px-2 py-2 text-sm text-gray-300 transition-all hover:bg-cinema-800/80 hover:text-white"
                  title="Settings"
                >
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt={user.username} className="w-6 h-6 rounded-full" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="hidden md:inline font-medium">{user.username}</span>
                </Link>
                <button
                  onClick={logout}
                  className="icon-button h-10 w-10 text-gray-400 hover:text-cinema-red-light"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="scale-90 origin-right">
                <GoogleLoginButton />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
