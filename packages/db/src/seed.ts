import { prisma } from './index';
import { seedActors, seedMovies } from './seed-data';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.alias.deleteMany();
  await prisma.movieCast.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.actor.deleteMany();
  await prisma.leaderboard.deleteMany();
  await prisma.gameMove.deleteMany();
  await prisma.game.deleteMany();
  await prisma.dailyChallenge.deleteMany();
  await prisma.moderationQueue.deleteMany();
  await prisma.analytics.deleteMany();

  // Seed actors
  const actorMap = new Map<string, number>();
  for (const actorData of seedActors) {
    const actor = await prisma.actor.create({
      data: {
        name: actorData.name,
        normalizedName: normalizeText(actorData.name),
        popularityScore: actorData.popularityScore,
        isBollywood: true,
        profileImageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(actorData.name)}&background=random&size=128`,
      },
    });
    actorMap.set(actorData.name, actor.id);

    // Create aliases
    for (const alias of actorData.aliases) {
      await prisma.alias.create({
        data: {
          entityType: 'actor',
          actorId: actor.id,
          alias,
          normalizedAlias: normalizeText(alias),
        },
      });
    }
  }

  console.log(`Seeded ${seedActors.length} actors`);

  // Seed movies
  const movieMap = new Map<string, number>();
  for (const movieData of seedMovies) {
    const movie = await prisma.movie.create({
      data: {
        title: movieData.title,
        normalizedTitle: normalizeText(movieData.title),
        releaseYear: movieData.releaseYear,
        region: movieData.region,
        genre: movieData.genre,
        isBollywood: true,
        isHindi: movieData.region === 'hindi',
        posterUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(movieData.title)}&background=random&size=128`,
      },
    });
    movieMap.set(movieData.title, movie.id);

    // Create aliases
    for (const alias of (movieData.aliases || [])) {
      await prisma.alias.create({
        data: {
          entityType: 'movie',
          movieId: movie.id,
          alias,
          normalizedAlias: normalizeText(alias),
        },
      });
    }

    // Create cast relationships
    for (const actorName of movieData.cast) {
      const actorId = actorMap.get(actorName);
      if (actorId) {
        await prisma.movieCast.create({
          data: {
            movieId: movie.id,
            actorId,
          },
        });
      }
    }
  }

  console.log(`Seeded ${seedMovies.length} movies`);

  // Create a daily challenge for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const srk = actorMap.get('Shah Rukh Khan')!;
  const alia = actorMap.get('Alia Bhatt')!;

  await prisma.dailyChallenge.create({
    data: {
      date: today,
      startActorId: srk,
      targetActorId: alia,
      difficulty: 'medium',
      description: 'Connect the King of Romance to the rising superstar!',
    },
  });

  console.log('Created daily challenge');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
