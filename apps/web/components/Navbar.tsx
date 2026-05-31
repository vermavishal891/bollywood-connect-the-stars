'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Trophy, Calendar, Settings, Home, Sparkles, HelpCircle } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { href: '/how-to-play', label: 'How to Play', icon: <HelpCircle className="w-4 h-4" /> },
    { href: '/daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
    { href: '/admin', label: 'Admin', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-cinema-900/90 backdrop-blur-md border-b border-cinema-700/50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Film className="w-6 h-6 text-cinema-gold group-hover:rotate-12 transition-transform" />
          <span className="font-display font-bold text-lg gold-gradient hidden sm:inline">
            Bollywood Connect
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                pathname === link.href
                  ? 'bg-cinema-gold/20 text-cinema-gold'
                  : 'text-gray-400 hover:text-white hover:bg-cinema-800'
              }`}
            >
              {link.icon}
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
          <Link
            href="/play"
            className="flex items-center gap-1.5 px-4 py-2 bg-cinema-gold text-cinema-900 font-bold rounded-lg text-sm hover:bg-yellow-400 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Play
          </Link>
        </div>
      </div>
    </nav>
  );
}
