'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Minus, Plus, RotateCcw, Sparkles, Trophy, Users } from 'lucide-react';

interface PartyPlayer {
  id: number;
  name: string;
  score: number;
  rounds: number;
}

function defaultPlayers(): PartyPlayer[] {
  return [
    { id: 1, name: 'Player 1', score: 0, rounds: 0 },
    { id: 2, name: 'Player 2', score: 0, rounds: 0 },
  ];
}

export default function PartyPage() {
  const [players, setPlayers] = useState<PartyPlayer[]>(defaultPlayers);
  const [activeIndex, setActiveIndex] = useState(0);
  const [difficulty, setDifficulty] = useState('medium');

  const activePlayer = players[activeIndex] || players[0];
  const winner = useMemo(() => [...players].sort((a, b) => b.score - a.score)[0], [players]);

  const updatePlayer = (id: number, patch: Partial<PartyPlayer>) => {
    setPlayers((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const nextRound = (scoreDelta = 0) => {
    setPlayers((items) =>
      items.map((item, index) =>
        index === activeIndex ? { ...item, score: item.score + scoreDelta, rounds: item.rounds + 1 } : item
      )
    );
    setActiveIndex((index) => (index + 1) % players.length);
  };

  const addPlayer = () => {
    if (players.length >= 8) return;
    const nextId = Math.max(...players.map((player) => player.id)) + 1;
    setPlayers((items) => [...items, { id: nextId, name: `Player ${nextId}`, score: 0, rounds: 0 }]);
  };

  const removePlayer = (id: number) => {
    if (players.length <= 2) return;
    setPlayers((items) => items.filter((item) => item.id !== id));
    setActiveIndex(0);
  };

  return (
    <div className="cinematic-page">
      <div className="mx-auto max-w-6xl">
        <Link href="/modes" className="mb-7 inline-flex items-center gap-2 text-cinema-gold transition-colors hover:text-white">
          <ArrowLeft className="h-5 w-5" />
          Back to Modes
        </Link>

        <header className="hero-stage mb-8 px-6 py-8 md:px-10">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-cinema-gold/35 bg-cinema-gold/10 text-cinema-gold">
            <Users className="h-7 w-7" />
          </div>
          <p className="section-title">Party Mode</p>
          <h1 className="mt-3 font-display text-4xl font-black text-white md:text-6xl">Shared-screen showdown</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-300">
            Add 2-8 players, pass the screen around, and start a real puzzle for the active player each round.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="game-card p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Active Player</p>
                <h2 className="mt-2 text-3xl font-black text-white">{activePlayer.name}</h2>
              </div>
              <Trophy className="h-10 w-10 text-cinema-gold" />
            </div>

            <label className="mb-2 block text-sm font-bold text-gray-300">Difficulty</label>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="search-input mb-5"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="legend">Legend</option>
            </select>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/play?mode=party&difficulty=${difficulty}&playerName=${encodeURIComponent(activePlayer.name)}`}
                className="btn-primary"
              >
                <Sparkles className="h-5 w-5" />
                Start Round
              </Link>
              <button onClick={() => nextRound(0)} className="btn-secondary">
                Skip
              </button>
              <button onClick={() => setPlayers(defaultPlayers())} className="btn-secondary">
                <RotateCcw className="h-5 w-5" />
                Reset
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => nextRound(100)} className="btn-primary">
                Award Win
              </button>
              <button onClick={() => nextRound(50)} className="btn-secondary">
                Award Assist
              </button>
            </div>
          </section>

          <section className="game-card p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Scoreboard</p>
                <h2 className="mt-2 text-2xl font-black text-white">Current leader: {winner.name}</h2>
              </div>
              <button onClick={addPlayer} disabled={players.length >= 8} className="icon-button" aria-label="Add player">
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`grid gap-3 rounded-2xl border p-4 md:grid-cols-[minmax(0,1fr)_110px_80px_auto] md:items-center ${
                    index === activeIndex ? 'border-cinema-gold/60 bg-cinema-gold/10' : 'border-cinema-gold/15 bg-black/20'
                  }`}
                >
                  <input
                    value={player.name}
                    onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                    className="min-w-0 bg-transparent text-lg font-black text-white outline-none"
                  />
                  <div className="stat-pill justify-center">
                    <Trophy className="h-4 w-4 text-cinema-gold" />
                    <span>{player.score}</span>
                  </div>
                  <div className="text-sm text-gray-400">{player.rounds} rounds</div>
                  <button onClick={() => removePlayer(player.id)} disabled={players.length <= 2} className="icon-button h-9 w-9">
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
