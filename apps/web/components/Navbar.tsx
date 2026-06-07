'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Calendar, Settings, Home, Sparkles, HelpCircle, User, LogOut, Gamepad2 } from 'lucide-react';
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

  const mobileLinks = [
    { href: '/', label: 'Home', icon: <Home className="h-5 w-5" /> },
    { href: '/modes', label: 'Modes', icon: <Gamepad2 className="h-5 w-5" /> },
    { href: '/play', label: 'Play', icon: <Sparkles className="h-5 w-5" /> },
    { href: '/leaderboard', label: 'Rank', icon: <Trophy className="h-5 w-5" /> },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-cinema-gold/10 bg-cinema-950/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 md:px-6">
        <Link href="/" className="group flex shrink-0 items-center rounded-2xl px-1 py-1 transition-all hover:bg-white/[0.03]">
          <BrandLogo
            variant="mark"
            showWordmark
            imageClassName="h-9 w-9 p-1 sm:h-10 sm:w-10 drop-shadow-[0_0_16px_rgba(255,43,214,0.34)]"
          />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="hidden min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-cinema-gold/15 bg-black/25 p-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                pathname === link.href
                  ? 'bg-cinema-gold text-cinema-950 shadow-sm shadow-cinema-gold/20'
                  : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {link.icon}
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          ))}
          </div>

          <Link
            href="/play"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-cinema-gold/70 bg-cinema-gold px-4 text-sm font-black text-cinema-950 shadow-lg shadow-cinema-gold/15 transition-all hover:-translate-y-0.5 hover:bg-cinema-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-gold/60"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Play</span>
          </Link>

          <div className="flex shrink-0 items-center">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-full border border-cinema-gold/15 bg-black/25 px-2 py-2 text-sm text-gray-300 transition-all hover:bg-white/[0.06] hover:text-white"
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
              <div className="hidden origin-right scale-90 sm:block">
                <GoogleLoginButton />
              </div>
            )}
          </div>
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[1.35rem] border border-cinema-gold/20 bg-cinema-950/88 p-1.5 shadow-2xl shadow-black/55 backdrop-blur-2xl md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {mobileLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-bold transition-all ${
                  active
                    ? 'bg-cinema-gold text-cinema-950 shadow-lg shadow-cinema-gold/20'
                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
