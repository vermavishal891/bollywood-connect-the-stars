# Bollywood Connect - Connect the Stars

A daily and endless Bollywood trivia web game where players connect two Indian film stars through shared movies. Built with a dark cinematic theme inspired by Filmfare, IMDb, and Wordle.

![Bollywood Connect](https://img.shields.io/badge/Bollywood-Connect-gold)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Fastify](https://img.shields.io/badge/Fastify-4-black)
![Prisma](https://img.shields.io/badge/Prisma-5-blue)

## Features

### Core Game
- **Connect the Stars**: Alternate between actors and movies to connect two Bollywood stars
- **Autocomplete Search**: Smart search with aliases (SRK, Big B, DDLJ, K3G, etc.)
- **Move Validation**: Real-time validation ensuring actors actually starred in selected movies
- **Hints System**: Soft clues, first-letter hints, decade clues, and best-next-step hints
- **Undo & Reset**: Go back or restart anytime
- **Share Results**: Copy shareable text with your path and challenge friends

### Game Modes
- **Classic**: Connect two random Bollywood actors
- **Daily Challenge**: Same puzzle for everyone each day
- **Speedrun**: Fastest completion wins
- **Shortest Path**: Fewest moves wins
- **Party Mode**: One shared screen for groups
- **Regional Mode**: Hindi, Tamil, Telugu, Marathi, Malayalam, Kannada, Bengali
- **Movie-to-Movie**: Connect one film to another through actors
- **Theme Mode**: 90s, villains, romance, YRF, Dharma, comedy, classics

### Difficulty Levels
- **Easy**: Top 100 actors, 1-3 edges
- **Medium**: Top 300 actors, 3-5 edges
- **Hard**: Top 1000 actors, 5-7 edges
- **Legend**: Large historical pool, 7+ edges

### Admin Dashboard
- View platform stats (actors, movies, games)
- Browse and manage actor/movie database
- Moderation queue for quality control

### Design
- Dark cinematic background with gold and red-carpet accents
- Film reel and spotlight effects
- Poster-card style for movies
- Premium Filmfare + IMDb + Wordle vibe
- Fully responsive for mobile and desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | Fastify (Node.js) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Prisma |
| Animation | Framer Motion |
| Icons | Lucide React |

## Project Structure

```
bollywood-connect/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router pages
│   │   ├── components/   # Shared components
│   │   └── lib/          # API client utilities
│   └── api/              # Fastify backend
│       └── src/
│           ├── main.ts       # Server entry
│           ├── routes.ts     # API endpoints
│           └── game-engine.ts # BFS, validation, hints
├── packages/
│   ├── db/               # Prisma schema & seed
│   └── shared/           # Shared TypeScript types
└── package.json          # Root workspace config
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push

# Seed database with Bollywood data
pnpm db:seed
```

### Development

Run both frontend and backend concurrently:

```bash
# Start backend (port 4000)
cd apps/api
pnpm dev

# Start frontend (port 3000)
cd apps/web
pnpm dev
```

Or use Turbo:
```bash
pnpm dev
```

### Environment Variables

Create `.env` files as needed:

**apps/api/.env**
```
DATABASE_URL="file:../../packages/db/dev.db"
PORT=4000
```

**apps/web/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?q=srk` | Search actors and movies |
| POST | `/games` | Create new game |
| GET | `/games/:id` | Get game state |
| POST | `/games/:id/move` | Make a move |
| POST | `/games/:id/undo` | Undo last move |
| POST | `/games/:id/reset` | Reset game |
| POST | `/games/:id/hint` | Get hint |
| GET | `/leaderboard` | Get leaderboard |
| GET | `/daily` | Get daily challenge |
| GET | `/admin/stats` | Admin statistics |

## Game Logic

The game graph is bipartite: actors connect to movies, and movies connect to actors.

```
Actor <-> Movie <-> Actor <-> Movie <-> Actor
```

- **Shortest Path**: BFS algorithm finds optimal route
- **Move Validation**: Checks if actor actually starred in selected movie
- **Scoring**: Based on shortest path length, actual moves, time taken, hints used, and difficulty multiplier

## Data

The seed dataset includes:
- **145+ Bollywood actors** with aliases and popularity scores
- **90+ Bollywood movies** with cast relationships
- Coverage from 1975 to 2024

## License

MIT License - Built for Bollywood cinema fans worldwide.
