import { prisma } from '@bollywood-connect/db';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface WikipediaDataset {
  actors: { name: string; aliases: string[]; movies: string[]; profileImageUrl?: string | null; description?: string | null; trivia?: string[] }[];
  movies: { title: string; year: number | null; genre: string; cast: string[]; posterUrl?: string | null; description?: string | null; trivia?: string[] }[];
}

function getDatasetPath(): string {
  // Try a few paths to find the JSON
  const candidates = [
    path.join(process.cwd(), '..', '..', 'packages', 'db', 'scripts', 'wikipedia_data.json'),
    path.join(process.cwd(), '..', '..', '..', 'packages', 'db', 'scripts', 'wikipedia_data.json'),
    path.join(process.cwd(), 'packages', 'db', 'scripts', 'wikipedia_data.json'),
    path.join(process.cwd(), '..', 'packages', 'db', 'scripts', 'wikipedia_data.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('wikipedia_data.json not found. Run generate_wiki_data.py first.');
}

export function loadWikipediaDataset(): WikipediaDataset {
  const p = getDatasetPath();
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as WikipediaDataset;
}

export async function ingestFromWikipediaDataset(
  options: { clearExisting?: boolean } = {}
): Promise<{
  actorsCreated: number;
  moviesCreated: number;
  castLinksCreated: number;
  aliasesCreated: number;
  errors: string[];
}> {
  const { clearExisting = false } = options;
  const errors: string[] = [];

  if (clearExisting) {
    await prisma.gameMove.deleteMany();
    await prisma.game.deleteMany();
    await prisma.leaderboard.deleteMany();
    await prisma.dailyChallenge.deleteMany();
    await prisma.moderationQueue.deleteMany();
    await prisma.alias.deleteMany();
    await prisma.movieCast.deleteMany();
    await prisma.movie.deleteMany();
    await prisma.actor.deleteMany();
  }

  const data = loadWikipediaDataset();

  // Compute popularity scores based on filmography size + predefined top-tier bonus
  const topTier = new Set([
    'Shah Rukh Khan','Amitabh Bachchan','Salman Khan','Aamir Khan','Akshay Kumar',
    'Hrithik Roshan','Ranbir Kapoor','Deepika Padukone','Priyanka Chopra','Katrina Kaif',
    'Kareena Kapoor','Alia Bhatt','Ranveer Singh','Ajay Devgn','Sanjay Dutt',
    'Anil Kapoor','Madhuri Dixit','Kajol','Rani Mukerji','Juhi Chawla',
    'Shahid Kapoor','Varun Dhawan','Tiger Shroff','Sunny Deol','Dharmendra',
    'Rajesh Khanna','Dilip Kumar','Dev Anand','Shashi Kapoor','Jeetendra',
    'Mithun Chakraborty','Govinda','Jackie Shroff','Nana Patekar','Paresh Rawal',
    'Anupam Kher','Om Puri','Naseeruddin Shah','Irrfan Khan','Manoj Bajpayee',
    'Nawazuddin Siddiqui','Pankaj Tripathi','Rajkummar Rao','Ayushmann Khurrana','Vicky Kaushal'
  ]);

  const actorMovieCount = new Map<string, number>();
  for (const a of data.actors) {
    actorMovieCount.set(a.name, a.movies.length);
  }

  // Create actors
  const actorNameToId = new Map<string, number>();
  let actorsCreated = 0;

  for (const actorData of data.actors) {
    try {
      const existing = await prisma.actor.findFirst({
        where: { normalizedName: normalizeText(actorData.name) },
      });

      if (existing) {
        actorNameToId.set(actorData.name, existing.id);
        continue;
      }

      const movieCount = actorMovieCount.get(actorData.name) || 0;
      let popularityScore = Math.min(50 + movieCount * 2, 85); // base from filmography
      if (topTier.has(actorData.name)) popularityScore = Math.min(popularityScore + 15, 100); // bonus for megastars

      const actor = await prisma.actor.create({
        data: {
          name: actorData.name,
          normalizedName: normalizeText(actorData.name),
          profileImageUrl: actorData.profileImageUrl || null,
          description: actorData.description || null,
          trivia: actorData.trivia ? JSON.stringify(actorData.trivia) : null,
          popularityScore,
          isBollywood: true,
          isActive: true,
        },
      });

      actorNameToId.set(actorData.name, actor.id);
      actorsCreated++;
    } catch (err: any) {
      errors.push(`Actor "${actorData.name}": ${err.message}`);
    }
  }

  // Create movies
  const movieTitleToId = new Map<string, number>();
  let moviesCreated = 0;

  for (const movieData of data.movies) {
    try {
      const existing = await prisma.movie.findFirst({
        where: { normalizedTitle: normalizeText(movieData.title) },
      });

      if (existing) {
        movieTitleToId.set(movieData.title, existing.id);
        continue;
      }

      const movie = await prisma.movie.create({
        data: {
          title: movieData.title,
          normalizedTitle: normalizeText(movieData.title),
          releaseYear: movieData.year,
          genre: movieData.genre || 'drama',
          posterUrl: movieData.posterUrl || null,
          description: movieData.description || null,
          trivia: movieData.trivia ? JSON.stringify(movieData.trivia) : null,
          popularityScore: 0,
          isHindi: true,
          isBollywood: true,
          isDocumentary: false,
          region: 'hindi',
        },
      });

      movieTitleToId.set(movieData.title, movie.id);
      moviesCreated++;
    } catch (err: any) {
      errors.push(`Movie "${movieData.title}": ${err.message}`);
    }
  }

  // Create cast links
  let castLinksCreated = 0;

  for (const movieData of data.movies) {
    const movieId = movieTitleToId.get(movieData.title);
    if (!movieId) continue;

    for (const castName of movieData.cast) {
      const actorId = actorNameToId.get(castName);
      if (!actorId) continue;

      try {
        const existing = await prisma.movieCast.findFirst({
          where: { movieId, actorId },
        });

        if (!existing) {
          await prisma.movieCast.create({
            data: { movieId, actorId },
          });
          castLinksCreated++;
        }
      } catch (err: any) {
        errors.push(`Cast link "${movieData.title}" <-> "${castName}": ${err.message}`);
      }
    }
  }

  // Also link from actor filmographies
  for (const actorData of data.actors) {
    const actorId = actorNameToId.get(actorData.name);
    if (!actorId) continue;

    for (const movieTitle of actorData.movies) {
      const movieId = movieTitleToId.get(movieTitle);
      if (!movieId) continue;

      try {
        const existing = await prisma.movieCast.findFirst({
          where: { movieId, actorId },
        });

        if (!existing) {
          await prisma.movieCast.create({
            data: { movieId, actorId },
          });
          castLinksCreated++;
        }
      } catch (err: any) {
        errors.push(`Cast link "${movieTitle}" <-> "${actorData.name}": ${err.message}`);
      }
    }
  }

  // Create aliases
  let aliasesCreated = 0;

  for (const actorData of data.actors) {
    const actorId = actorNameToId.get(actorData.name);
    if (!actorId) continue;

    for (const alias of actorData.aliases) {
      const normalized = normalizeText(alias);
      if (normalized.length < 2) continue;

      try {
        const existing = await prisma.alias.findFirst({
          where: { entityType: 'actor', actorId, normalizedAlias: normalized },
        });

        if (!existing) {
          await prisma.alias.create({
            data: {
              entityType: 'actor',
              actorId,
              alias,
              normalizedAlias: normalized,
            },
          });
          aliasesCreated++;
        }
      } catch (err: any) {
        errors.push(`Alias "${alias}" for "${actorData.name}": ${err.message}`);
      }
    }
  }

  return {
    actorsCreated,
    moviesCreated,
    castLinksCreated,
    aliasesCreated,
    errors,
  };
}

export async function runWikipediaScraper(
  years?: string
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(
      process.cwd(),
      '..',
      '..',
      'packages',
      'db',
      'scripts',
      'wikipedia_scraper.py'
    );

    const args = ['--output', 'wikipedia_data.json'];
    if (years) args.push('--years', years);

    const child = spawn('python', [scriptPath, ...args], {
      cwd: path.dirname(scriptPath),
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (err) => {
      resolve({ ok: false, message: `Failed to start scraper: ${err.message}` });
    });

    child.unref();
    resolve({ ok: true, message: 'Wikipedia scraper started in background' });
  });
}

export async function checkWikipediaStatus(): Promise<{
  ok: boolean;
  datasetExists: boolean;
  actorCount: number;
  movieCount: number;
  message: string;
}> {
  try {
    const data = loadWikipediaDataset();
    return {
      ok: true,
      datasetExists: true,
      actorCount: data.actors.length,
      movieCount: data.movies.length,
      message: `Dataset ready: ${data.actors.length} actors, ${data.movies.length} movies`,
    };
  } catch (err: any) {
    return {
      ok: false,
      datasetExists: false,
      actorCount: 0,
      movieCount: 0,
      message: err.message,
    };
  }
}
