# 🎬 Bollywood Connect — *Connect the Stars*

> *"Six Degrees of Separation, but make it Bollywood."*

[![Bollywood](https://img.shields.io/badge/%F0%9F%8E%AC-Bollywood-gold?style=for-the-badge)](https://github.com/vermavishal891/bollywood-connect-the-stars)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?style=for-the-badge&logo=fastify)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io)

**Can you connect Shah Rukh Khan to Deepika Padukone in 3 movies?**

Bollywood Connect is a daily trivia web game where players link two Indian film stars through shared movies — alternating between **actors** ⭐ and **movies** 🎬 until you bridge the gap. Think *Wordle* meets *Six Degrees of Kevin Bacon*, but with a Filmfare red-carpet aesthetic.

---

## 🌐 Live Demo

- **Frontend:** [https://bollywood-connect-the-stars-web.vercel.app](https://bollywood-connect-the-stars-web.vercel.app)
- **API:** [https://bollywood-connect-api.onrender.com](https://bollywood-connect-api.onrender.com)

---

## 🚀 Quick Start — *Play in 60 Seconds*

### Prerequisites
- [Node.js 18+](https://nodejs.org)
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)

### 1. Clone & Install
```bash
git clone https://github.com/vermavishal891/bollywood-connect-the-stars.git
cd bollywood-connect-the-stars
npm install
```

### 2. Set Up Environment
```bash
# Copy the example env file
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and add your TMDB_API_KEY
```

Your `apps/api/.env` should look like:
```env
TMDB_API_KEY=your_tmdb_api_key_here
PORT=4000
```

### 3. Database Setup
```bash
cd packages/db
npx prisma generate
npx prisma db push
```

### 4. Ingest Data *(one-time)*
```bash
# Start the API server first
cd apps/api
npm run dev

# In another terminal — ingest all Hindi movies from TMDB
curl -X POST http://localhost:4000/admin/tmdb/full-ingest
# This takes ~1–2 hours. Check progress at:
# http://localhost:3000/admin/ingestion
```

### 5. Run the Game
```bash
# Terminal 1 — API (port 4000)
npm run dev -w apps/api

# Terminal 2 — Frontend (port 3000)
npm run dev -w apps/web
```

Open **http://localhost:3000** and start connecting stars! 🌟

---

## 🎮 How to Play

```
Salman Khan ──► Hum Aapke Hain Koun..! ──► Madhuri Dixit ──► Dedh Ishqiya ──► Naseeruddin Shah
     Actor              Movie                  Actor              Movie                Actor
```

1. **Start** with a Bollywood actor (e.g., Salman Khan)
2. **Pick a movie** they've starred in
3. **Pick another actor** from that movie
4. **Repeat** until you reach the target actor
5. **Win!** Score = speed × accuracy × difficulty bonus

### Difficulty Levels

| Level | Start/Target Pool | Path Length | Example Pair |
|-------|------------------|-------------|--------------|
| 🟢 **Easy** | Megastars (SRK, Salman, Deepika) | 1–3 hops | Akshay Kumar → Hrithik Roshan |
| 🟡 **Medium** | Recognizable faces | 2–5 hops | Riteish Deshmukh → Nimrat Kaur |
| 🔴 **Hard** | Character actors | 3–7 hops | Sumeet Vyas → Kumkum |
| 🔥 **Legend** | Anyone goes | 5–12 hops | The ultimate test |

### Game Modes

- 🎲 **Classic** — Random pair, your pace
- 📅 **Daily Challenge** — Same puzzle for everyone, refreshed every 24h
- ⚡ **Speedrun** — Fastest time wins
- 🎯 **Shortest Path** — Fewest moves wins
- 🎉 **Party Mode** — One screen, multiple players
- 🌍 **Regional** — Tamil, Telugu, Marathi, Malayalam, Kannada, Bengali
- 🎬 **Movie-to-Movie** — Connect films instead of actors
- 🎭 **Theme Mode** — 90s, villains, romance, YRF, Dharma, comedy, classics

### Power-Ups

| Hint | What It Does |
|------|-------------|
| 💡 **Soft** | Genre + decade clue |
| 🔤 **First Letter** | Reveals the first letter |
| 📅 **Decade** | Tells you what era the connection is from |
| 🧭 **Best Next** | Reveals the optimal next step |

---

## 🏗️ Architecture Deep Dive

### The Graph

At its core, Bollywood Connect is a **bipartite graph**:

```
        ┌─────────┐         ┌─────────┐         ┌─────────┐
   SRK ─┤  Dilwale ├── Kajol ┤  K3G    ├─── Amitabh ┤  Sholay  ├── Dharmendra
        └─────────┘         └─────────┘         └─────────┘
```

- **~8,200 actor nodes** — filtered to `knownForDepartment === 'Acting'`
- **~1,700 movie nodes** — Hindi films from TMDB
- **~24,600 edges** — cast relationships via `MovieCast` junction table

The graph lives in **SQLite** (dev) and is traversed with **Breadth-First Search** (BFS) for shortest-path finding, move validation, and hint generation.

### Data Pipeline

```
TMDB API ──► discoverAllHindiMovies() ──► fetchMovieDetailsAndCredits()
     │                                          │
     │                                    Collects unique actor IDs
     │                                          │
     └────────────────────────────────────► fetchActorDetails()
                                                  │
                                           upsertAllData()
                                                  │
                                           SQLite (Prisma)
```

**TMDB Ingestion Engine** (`apps/api/src/tmdb-ingestion.ts`):
- Discovers **all** Hindi movies page-by-page from TMDB
- Fetches full metadata + credits for each film
- Collects unique actor IDs, then fetches actor profiles
- Header-aware rate limiting (reads `x-ratelimit-remaining`)
- **Checkpoint resume** — if it crashes, it picks up where it left off
- `tmdb_checkpoint.json` tracks progress across phases

### Game Engine (`apps/api/src/game-engine.ts`)

```ts
buildGraph()        → adjacency lists from DB
findShortestPath()  → BFS between two actors
generatePair()      → random valid pair by difficulty
getHint()           → shortest-path hint from current position
isValidMove()       → checks cast link in graph
```

**Difficulty filtering:**
- Easy pool: `popularityScore >= 2` + `>= 5 movies` + `knownForDepartment === 'Acting'`
- Medium pool: `0.5 <= popularityScore < 2` + `>= 3 movies` + acting only
- Hard pool: `popularityScore < 0.5` + acting only

**Popularity scores come from TMDB** (0–10 scale for Indian actors). SRK ≈ 3.4, Akshay ≈ 4.6.

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| 🎨 **Frontend** | Next.js 14 + TypeScript + Tailwind CSS | App Router, server components, cinematic dark theme |
| ⚡ **Backend** | Fastify (Node.js) | Fast, low overhead, great plugin system |
| 🗄️ **Database** | SQLite (dev) / PostgreSQL (prod) | Prisma ORM, zero-config local dev |
| 🔗 **ORM** | Prisma 5 | Type-safe queries, migrations, schema management |
| 🎭 **Animations** | Framer Motion | Smooth transitions, AnimatePresence for move list |
| 🔍 **Icons** | Lucide React | Clean, consistent iconography |
| 🍞 **Toasts** | react-hot-toast | Non-blocking user feedback |

### Project Structure

```
bollywood-connect-the-stars/
├── apps/
│   ├── web/                    # 🎨 Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── play/           # Game screen (the main event)
│   │   │   ├── leaderboard/    # Hall of fame
│   │   │   ├── daily/          # Daily challenge
│   │   │   ├── admin/          # Ingestion dashboard
│   │   │   └── ...
│   │   ├── components/Navbar.tsx
│   │   └── lib/api.ts          # API client (fetch wrapper)
│   └── api/                    # ⚡ Fastify backend
│       ├── src/
│       │   ├── main.ts         # Server bootstrap
│       │   ├── routes.ts       # All REST endpoints
│       │   ├── game-engine.ts  # BFS, scoring, hints
│       │   ├── tmdb-ingestion.ts  # Full TMDB pipeline
│       │   ├── tmdb.ts         # TMDB API client
│       │   └── wikipedia-ingestion.ts  # Free fallback data
│       └── .env                # TMDB_API_KEY
├── packages/
│   ├── db/                     # 🗄️ Prisma schema + seed
│   │   ├── prisma/schema.prisma
│   │   └── src/seed.ts
│   └── shared/                 # 🔗 Shared types & utils
│       └── src/index.ts
├── .env.example
├── package.json                # npm workspaces
└── turbo.json                  # Turborepo config
```

---

## 🛠️ Development Guide

### Common Commands

```bash
# Install all dependencies
npm install

# Generate Prisma client
npx prisma generate --schema packages/db/prisma/schema.prisma

# Reset database
npx prisma db push --force-reset --schema packages/db/prisma/schema.prisma

# Seed with basic data
npm run seed -w packages/db

# Run API dev server
npm run dev -w apps/api

# Run frontend dev server
npm run dev -w apps/web

# Run both (if configured with Turbo)
npm run dev
```

### Environment Files

**`apps/api/.env`**
```env
TMDB_API_KEY=your_key_here
PORT=4000
```

**`packages/db/.env`** *(already configured)*
```env
DATABASE_URL="file:./dev.db"
```

> ⚠️ **Do NOT** add `DATABASE_URL` to `apps/api/.env` — it causes SQLite path resolution issues on Windows.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q=srk` | Search actors & movies with aliases |
| `POST` | `/games` | Create a new game |
| `GET` | `/games/:id` | Get full game state |
| `POST` | `/games/:id/move` | Submit a move |
| `POST` | `/games/:id/undo` | Undo last move |
| `POST` | `/games/:id/reset` | Reset to start |
| `POST` | `/games/:id/hint` | Get a hint |
| `GET` | `/leaderboard` | Top scores |
| `GET` | `/daily` | Today's challenge |
| `POST` | `/admin/tmdb/full-ingest` | Start full TMDB ingestion |
| `GET` | `/admin/tmdb/progress` | Check ingestion status |

### Adding New Data

1. **Via Admin UI**: Go to `http://localhost:3000/admin/ingestion`
2. **Via API**: `POST /admin/tmdb/full-ingest`
3. **Manual**: Edit `packages/db/prisma/schema.prisma` → run `npx prisma db push`

---

## 🎨 Design System

- **Primary**: Gold (`#d4af37`) — Filmfare trophy energy
- **Accent**: Red-carpet red (`#e50914`)
- **Background**: Deep cinematic black (`#0a0a0f`)
- **Typography**: Clean sans-serif with gold gradients for headings
- **Cards**: Frosted glass with subtle borders
- **Avatars**: Rounded full with fallback initials
- **Posters**: Rounded-lg with film icon fallback

---

## 📜 License

MIT — Built for Bollywood fans worldwide. 🎥🍿

> *"Picture abhi baaki hai, mere dost."* 🎬
