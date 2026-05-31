import { prisma } from '@bollywood-connect/db';
import {
  discoverBollywoodMovies,
  discoverRegionalMovies,
  searchPerson,
  getPersonDetails,
  getPersonMovieCredits,
  getMovieDetails,
  getMovieCredits,
  getImageUrl,
  normalizeGenre,
  TMDBError,
} from './tmdb';

// Normalize text for search
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Known Bollywood actors to seed from TMDB (popular names to search)
const PRIORITY_ACTORS = [
  'Shah Rukh Khan', 'Salman Khan', 'Aamir Khan', 'Amitabh Bachchan', 'Akshay Kumar',
  'Hrithik Roshan', 'Ranbir Kapoor', 'Deepika Padukone', 'Priyanka Chopra', 'Katrina Kaif',
  'Kareena Kapoor', 'Alia Bhatt', 'Ranveer Singh', 'Ajay Devgn', 'Shahid Kapoor',
  'Anushka Sharma', 'Varun Dhawan', 'Sidharth Malhotra', 'Tiger Shroff', 'Shraddha Kapoor',
  'Kriti Sanon', 'Kiara Advani', 'Janhvi Kapoor', 'Sara Ali Khan', 'Ananya Panday',
  'Ayushmann Khurrana', 'Rajkummar Rao', 'Vicky Kaushal', 'Kartik Aaryan', 'Nawazuddin Siddiqui',
  'Pankaj Tripathi', 'Irrfan Khan', 'Manoj Bajpayee', 'Bhumi Pednekar', 'Taapsee Pannu',
  'Kangana Ranaut', 'Sonam Kapoor', 'Jacqueline Fernandez', 'Disha Patani', 'Madhuri Dixit',
  'Kajol', 'Rani Mukerji', 'Preity Zinta', 'Aishwarya Rai', 'Saif Ali Khan',
  'Sanjay Dutt', 'Sunny Deol', 'Suniel Shetty', 'Bobby Deol', 'John Abraham',
  'Abhishek Bachchan', 'Boman Irani', 'Anupam Kher', 'Om Puri', 'Naseeruddin Shah',
  'Paresh Rawal', 'Johnny Lever', 'Arshad Warsi', 'Riteish Deshmukh', 'Neetu Singh',
  'Rekha', 'Hema Malini', 'Sridevi', 'Juhi Chawla', 'Karishma Kapoor',
  'Tabu', 'Urmila Matondkar', 'Shilpa Shetty', 'Bipasha Basu', 'Lara Dutta',
  'Sushmita Sen', 'Raveena Tandon', 'Sonakshi Sinha', 'Parineeti Chopra', 'Ileana DCruz',
  'Genelia DSouza', 'Vidya Balan', 'Konkona Sen Sharma', 'Radhika Apte', 'Swara Bhasker',
  'Kalki Koechlin', 'Dimple Kapadia', 'Ratna Pathak Shah', 'Shefali Shah', 'Neena Gupta',
  'Gajraj Rao', 'Jitendra Kumar', 'Vijay Raaz', 'Deepak Dobriyal', 'Sanjay Mishra',
  'Shabana Azmi', 'Jaya Bachchan', 'Waheeda Rehman', 'Asha Parekh', 'Helen',
  'Farida Jalal', 'Kirron Kher', 'Smita Patil', 'Nandita Das', 'Divya Dutta',
  'Dharmendra', 'Rishi Kapoor', 'Amrish Puri', 'Anil Kapoor', 'Jackie Shroff',
  'Mithun Chakraborty', 'Govinda', 'Shakti Kapoor', 'Kader Khan', 'Asrani',
  'Rajpal Yadav', 'Kay Kay Menon', 'Vinay Pathak', 'Ranvir Shorey', 'Saurabh Shukla',
  'Ronit Roy', 'Rajat Kapoor', 'Aparshakti Khurana', 'Mohammed Zeeshan Ayyub', 'Kunal Khemu',
  'Sharman Joshi', 'R Madhavan', 'Arjun Rampal', 'Zayed Khan', 'Fardeen Khan',
  'Tusshar Kapoor', 'Aftab Shivdasani', 'Uday Chopra', 'Jimmy Sheirgill', 'Ali Zafar',
  'Aditya Roy Kapur', 'Abhay Deol', 'Farhan Akhtar', 'Arjun Kapoor', 'Sushant Singh Rajput',
  'Diljit Dosanjh', 'Nushrratt Bharuccha', 'Yami Gautam', 'Nargis Fakhri', 'Vaani Kapoor',
  'Mrunal Thakur', 'Sanya Malhotra', 'Fatima Sana Shaikh', 'Zaira Wasim', 'Rashmika Mandanna',
  'Nayanthara', 'Tripti Dimri', 'Nimrat Kaur', 'Samantha Ruth Prabhu', 'Tamannaah Bhatia',
  'Kajal Aggarwal', 'Rakul Preet Singh', 'Pooja Hegde', 'Nora Fatehi', 'Prabhas',
  'Ram Charan', 'N T Rama Rao Jr', 'Allu Arjun', 'Mahesh Babu', 'Vijay Deverakonda',
  'Dulquer Salmaan', 'Fahadh Faasil', 'Rana Daggubati', 'Naga Chaitanya', 'Vijay Sethupathi',
  'Suriya', 'Karthi', 'Dhanush', 'Sivakarthikeyan',
];

// Map TMDB language codes to our region codes
const LANGUAGE_TO_REGION: Record<string, string> = {
  'hi': 'hindi',
  'ta': 'tamil',
  'te': 'telugu',
  'mr': 'marathi',
  'ml': 'malayalam',
  'kn': 'kannada',
  'bn': 'bengali',
  'pa': 'punjabi',
  'gu': 'gujarati',
};

export interface IngestionProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: IngestionProgress) => void;

export async function ingestBollywoodFromTMDB(
  options: {
    actorCount?: number;
    moviePages?: number;
    includeRegional?: boolean;
    yearFrom?: number;
    yearTo?: number;
  } = {},
  onProgress?: ProgressCallback
): Promise<{
  actorsCreated: number;
  moviesCreated: number;
  castLinksCreated: number;
  aliasesCreated: number;
  errors: string[];
}> {
  const {
    actorCount = 100,
    moviePages = 20,
    includeRegional = true,
    yearFrom = 1970,
    yearTo = 2026,
  } = options;

  const errors: string[] = [];
  let actorsCreated = 0;
  let moviesCreated = 0;
  let castLinksCreated = 0;
  let aliasesCreated = 0;

  const actorMap = new Map<number, number>(); // tmdbId -> ourId
  const movieMap = new Map<number, number>(); // tmdbId -> ourId

  // Track progress
  const totalSteps = 4; // actors, movies, cast links, aliases
  let currentStep = 0;

  function report(stage: string, current: number, total: number, message: string) {
    onProgress?.({ stage, current, total, message });
  }

  report('actors', 0, actorCount, 'Searching for actors on TMDB...');

  // STEP 1: Fetch actors
  const tmdbActorIds = new Set<number>();
  const tmdbActorData = new Map<number, any>();

  for (let i = 0; i < Math.min(actorCount, PRIORITY_ACTORS.length); i++) {
    const name = PRIORITY_ACTORS[i];
    try {
      const search = await searchPerson(name);
      const match = search.results.find(
        (p) => p.name.toLowerCase() === name.toLowerCase() || p.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
      ) || search.results[0];

      if (match) {
        tmdbActorIds.add(match.id);
        tmdbActorData.set(match.id, match);
        report('actors', i + 1, actorCount, `Found: ${match.name}`);
      }
    } catch (err: any) {
      errors.push(`Actor search "${name}": ${err.message}`);
    }

    // Rate limit: TMDB allows 40 requests per 10 seconds for free tier
    if (i % 30 === 0 && i > 0) {
      await sleep(11000);
    }
  }

  // Also try popular person endpoint for more actors
  if (tmdbActorIds.size < actorCount) {
    try {
      const popular = await getPersonDetails(0 as any); // This won't work directly, we'll search for more
    } catch {
      // Popular endpoint doesn't exist for people directly in the same way
    }
  }

  report('actors', tmdbActorIds.size, actorCount, 'Saving actors to database...');

  for (const tmdbId of tmdbActorIds) {
    const data = tmdbActorData.get(tmdbId);
    if (!data) continue;

    try {
      const existing = await prisma.actor.findFirst({ where: { tmdbId } });
      if (existing) {
        actorMap.set(tmdbId, existing.id);
        continue;
      }

      const actor = await prisma.actor.create({
        data: {
          tmdbId: data.id,
          name: data.name,
          normalizedName: normalizeText(data.name),
          gender: data.gender === 1 ? 'female' : data.gender === 2 ? 'male' : null,
          profileImageUrl: getImageUrl(data.profile_path, 'w185'),
          popularityScore: data.popularity,
          isBollywood: true,
          isActive: true,
        },
      });

      actorMap.set(tmdbId, actor.id);
      actorsCreated++;
    } catch (err: any) {
      errors.push(`Actor "${data.name}": ${err.message}`);
    }
  }

  report('movies', 0, moviePages, 'Fetching Bollywood movies...');

  // STEP 2: Fetch movies
  const tmdbMovieIds = new Set<number>();
  const tmdbMovieData = new Map<number, any>();

  for (let page = 1; page <= moviePages; page++) {
    try {
      const result = await discoverBollywoodMovies(page);
      for (const movie of result.results) {
        if (movie.original_language === 'hi' || movie.original_language === 'ta' || movie.original_language === 'te') {
          tmdbMovieIds.add(movie.id);
          tmdbMovieData.set(movie.id, movie);
        }
      }
      report('movies', page, moviePages, `Fetched page ${page}, found ${tmdbMovieIds.size} movies total`);
    } catch (err: any) {
      errors.push(`Movie page ${page}: ${err.message}`);
    }

    // Rate limit
    if (page % 30 === 0) {
      await sleep(11000);
    }
  }

  // Fetch regional movies if enabled
  if (includeRegional) {
    const regionalLangs = ['ta', 'te', 'mr', 'ml', 'kn', 'bn'];
    for (const lang of regionalLangs) {
      try {
        const result = await discoverRegionalMovies(lang, 1);
        for (const movie of result.results.slice(0, 20)) {
          tmdbMovieIds.add(movie.id);
          tmdbMovieData.set(movie.id, movie);
        }
        report('movies', moviePages, moviePages, `Added ${lang.toUpperCase()} regional movies`);
      } catch (err: any) {
        errors.push(`Regional ${lang}: ${err.message}`);
      }
    }
  }

  report('movies', tmdbMovieIds.size, tmdbMovieIds.size, 'Saving movies to database...');

  for (const tmdbId of tmdbMovieIds) {
    const data = tmdbMovieData.get(tmdbId);
    if (!data) continue;

    try {
      const existing = await prisma.movie.findFirst({ where: { tmdbId } });
      if (existing) {
        movieMap.set(tmdbId, existing.id);
        continue;
      }

      // Fetch full details for genre info
      let genre = normalizeGenre(data.genre_ids || []);
      let region = LANGUAGE_TO_REGION[data.original_language] || 'hindi';

      try {
        const details = await getMovieDetails(tmdbId);
        if (details.genres && details.genres.length > 0) {
          genre = details.genres[0].name.toLowerCase();
        }
      } catch {
        // Use basic info
      }

      const year = data.release_date ? parseInt(data.release_date.split('-')[0]) : null;

      const movie = await prisma.movie.create({
        data: {
          tmdbId: data.id,
          title: data.title,
          normalizedTitle: normalizeText(data.title),
          releaseYear: year,
          originalLanguage: data.original_language,
          posterUrl: getImageUrl(data.poster_path, 'w342'),
          popularityScore: data.popularity,
          isHindi: data.original_language === 'hi',
          isBollywood: true,
          isDocumentary: genre === 'documentary',
          region,
          genre,
        },
      });

      movieMap.set(tmdbId, movie.id);
      moviesCreated++;
    } catch (err: any) {
      errors.push(`Movie "${data.title}": ${err.message}`);
    }
  }

  report('cast', 0, actorMap.size, 'Fetching cast links...');

  // STEP 3: Fetch cast for each movie
  let castProcessed = 0;
  for (const [tmdbMovieId, ourMovieId] of movieMap) {
    try {
      const credits = await getMovieCredits(tmdbMovieId);

      for (const castMember of credits.cast.slice(0, 20)) {
        const ourActorId = actorMap.get(castMember.id);
        if (!ourActorId) {
          // Actor not in our database, optionally add them
          continue;
        }

        const existing = await prisma.movieCast.findFirst({
          where: { movieId: ourMovieId, actorId: ourActorId },
        });

        if (!existing) {
          await prisma.movieCast.create({
            data: {
              movieId: ourMovieId,
              actorId: ourActorId,
              characterName: castMember.character || null,
              billingOrder: castMember.order,
            },
          });
          castLinksCreated++;
        }
      }

      castProcessed++;
      if (castProcessed % 10 === 0) {
        report('cast', castProcessed, movieMap.size, `Processed ${castProcessed} movies`);
      }
    } catch (err: any) {
      errors.push(`Cast for movie ${tmdbMovieId}: ${err.message}`);
    }

    // Rate limit
    if (castProcessed % 30 === 0) {
      await sleep(11000);
    }
  }

  report('aliases', 0, actorMap.size + movieMap.size, 'Generating aliases...');

  // STEP 4: Generate aliases
  for (const [tmdbId, ourId] of actorMap) {
    try {
      const details = await getPersonDetails(tmdbId);
      if (details.also_known_as) {
        for (const alias of details.also_known_as) {
          const normalized = normalizeText(alias);
          if (normalized.length < 2) continue;

          const existing = await prisma.alias.findFirst({
            where: { entityType: 'actor', actorId: ourId, normalizedAlias: normalized },
          });

          if (!existing) {
            await prisma.alias.create({
              data: {
                entityType: 'actor',
                actorId: ourId,
                alias,
                normalizedAlias: normalized,
              },
            });
            aliasesCreated++;
          }
        }
      }
    } catch {
      // Skip aliases if person details fail
    }
  }

  report('complete', 100, 100, 'Ingestion complete!');

  return {
    actorsCreated,
    moviesCreated,
    castLinksCreated,
    aliasesCreated,
    errors,
  };
}

// Full TMDB refresh - wipe existing and re-ingest
export async function refreshTMDBData(
  options?: Parameters<typeof ingestBollywoodFromTMDB>[0],
  onProgress?: ProgressCallback
) {
  // Clear existing TMDB-sourced data
  await prisma.alias.deleteMany();
  await prisma.movieCast.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.actor.deleteMany();

  return ingestBollywoodFromTMDB(options, onProgress);
}

// Incremental update - only add new items
export async function incrementalTMDBUpdate(
  options?: Parameters<typeof ingestBollywoodFromTMDB>[0],
  onProgress?: ProgressCallback
) {
  return ingestBollywoodFromTMDB(options, onProgress);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Health check for TMDB API key
export async function checkTMDBConnection(): Promise<{ ok: boolean; message: string; rateLimit?: { remaining: number; reset: number } }> {
  try {
    const res = await fetch('https://api.themoviedb.org/3/configuration?api_key=' + process.env.TMDB_API_KEY);
    if (res.ok) {
      const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '0');
      const reset = parseInt(res.headers.get('x-ratelimit-reset') || '0');
      return {
        ok: true,
        message: 'TMDB API connected successfully',
        rateLimit: { remaining, reset },
      };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body.status_message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}
