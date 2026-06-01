/**
 * Backfill ActorMovieCredit for all existing actors.
 * Fetches each actor's full movie credits from TMDB and stores them.
 * Can be resumed if interrupted.
 */
import { prisma } from '@bollywood-connect/db';
import { getPersonMovieCredits } from './tmdb';
import * as fs from 'fs';
import * as path from 'path';

const PROGRESS_PATH = path.join(process.cwd(), 'backfill_actor_credits.json');
const MIN_REQUEST_INTERVAL_MS = 250; // 4 req/sec max

let _lastRequestTime = 0;

function loadProgress(): { processedActorIds: number[]; errors: string[] } {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    } catch {
      // corrupt
    }
  }
  return { processedActorIds: [], errors: [] };
}

function saveProgress(progress: { processedActorIds: number[]; errors: string[] }) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch<T>(fetchFn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  _lastRequestTime = Date.now();
  return fetchFn();
}

export async function backfillActorCredits(onProgress?: (msg: string) => void) {
  const progress = loadProgress();

  const actors = await prisma.actor.findMany({
    where: { isBollywood: true, isActive: true },
    select: { id: true, tmdbId: true, name: true },
  });

  const remaining = actors.filter((a) => !progress.processedActorIds.includes(a.id));
  onProgress?.(`Backfilling credits for ${remaining.length} / ${actors.length} actors...`);

  for (let i = 0; i < remaining.length; i++) {
    const actor = remaining[i];

    if (!actor.tmdbId) {
      progress.processedActorIds.push(actor.id);
      continue;
    }

    try {
      const credits = await rateLimitedFetch(() => getPersonMovieCredits(actor.tmdbId!));

      // Delete existing credits for this actor to avoid duplicates
      await prisma.actorMovieCredit.deleteMany({ where: { actorId: actor.id } });

      // Insert new credits
      const creditData = credits.cast.map((c) => ({
        actorId: actor.id,
        tmdbMovieId: c.id,
        title: c.title,
        popularity: c.popularity ?? 0,
        character: c.character || null,
        releaseDate: c.release_date || null,
      }));

      if (creditData.length > 0) {
        await prisma.actorMovieCredit.createMany({ data: creditData });
      }

      progress.processedActorIds.push(actor.id);

      if (i % 10 === 0) {
        saveProgress(progress);
        onProgress?.(`Progress: ${i + 1}/${remaining.length} — ${actor.name} (${creditData.length} credits)`);
      }
    } catch (err: any) {
      progress.errors.push(`Actor ${actor.name} (tmdbId ${actor.tmdbId}): ${err.message}`);
      // Don't mark as processed so it can be retried on next run
      saveProgress(progress);
      onProgress?.(`Error for ${actor.name}: ${err.message}`);
    }
  }

  saveProgress(progress);
  onProgress?.(`Backfill complete. ${progress.processedActorIds.length} actors processed, ${progress.errors.length} errors.`);
  return { processed: progress.processedActorIds.length, errors: progress.errors.length };
}

// Run directly if executed as a script
if (require.main === module) {
  backfillActorCredits((msg) => console.log(`[backfill] ${msg}`))
    .then((result) => {
      console.log('Done:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
