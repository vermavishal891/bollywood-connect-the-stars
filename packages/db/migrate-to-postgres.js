const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');

const sqliteDb = new sqlite3.Database('prisma/dev.db');
const prisma = new PrismaClient();

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// SQLite stores DateTime as milliseconds since epoch, booleans as 0/1 ints.
// PostgreSQL expects ISO 8601 strings and actual booleans.
function fixDateTime(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return new Date(value).toISOString();
  return value;
}

function fixBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value !== 0;
  return value;
}

function fixRow(row, dateFields = [], boolFields = []) {
  const fixed = { ...row };
  for (const field of dateFields) {
    if (field in fixed) fixed[field] = fixDateTime(fixed[field]);
  }
  for (const field of boolFields) {
    if (field in fixed) fixed[field] = fixBoolean(fixed[field]);
  }
  return fixed;
}

async function migrateTable(tableName, dateFields, boolFields, createManyFn, batchSize = 500) {
  console.log(`\nMigrating ${tableName}...`);
  const rows = await sqliteAll(sqliteDb, `SELECT * FROM "${tableName}"`);
  console.log(`  Found ${rows.length} rows`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((r) => fixRow(r, dateFields, boolFields));
    try {
      await createManyFn(batch);
      process.stdout.write(`  ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
    } catch (err) {
      console.error(`\n  Batch error:`, err.message.slice(0, 200));
      for (const row of batch) {
        try {
          await createManyFn([row]);
        } catch (innerErr) {
          console.error(`    Skip row ${row.id || '?'}}}:`, innerErr.message.slice(0, 150));
        }
      }
    }
  }
  console.log(`  ✓ ${tableName} migrated`);
}

async function main() {
  console.log('=== SQLite → PostgreSQL Migration ===\n');

  // 1. Actor
  await migrateTable('Actor', ['birthday', 'deathday', 'createdAt'], ['isBollywood', 'isActive'], (batch) =>
    prisma.actor.createMany({ data: batch, skipDuplicates: true })
  );

  // 2. Movie
  await migrateTable('Movie', ['releaseDate', 'createdAt'], ['isHindi', 'isBollywood', 'isDocumentary'], (batch) =>
    prisma.movie.createMany({ data: batch, skipDuplicates: true })
  );

  // 3. Alias
  await migrateTable('Alias', ['createdAt'], [], (batch) =>
    prisma.alias.createMany({ data: batch, skipDuplicates: true })
  );

  // 4. MovieCast
  await migrateTable('MovieCast', [], [], (batch) =>
    prisma.movieCast.createMany({ data: batch, skipDuplicates: true })
  );

  // 5. Game
  await migrateTable('Game', ['createdAt', 'completedAt'], [], (batch) =>
    prisma.game.createMany({ data: batch, skipDuplicates: true })
  );

  // 6. GameMove
  await migrateTable('GameMove', ['createdAt'], [], (batch) =>
    prisma.gameMove.createMany({ data: batch, skipDuplicates: true })
  );

  // 7. Leaderboard
  await migrateTable('Leaderboard', ['createdAt'], [], (batch) =>
    prisma.leaderboard.createMany({ data: batch, skipDuplicates: true })
  );

  // 8. DailyChallenge
  await migrateTable('DailyChallenge', ['date', 'createdAt'], [], (batch) =>
    prisma.dailyChallenge.createMany({ data: batch, skipDuplicates: true })
  );

  // 9. Reset sequences
  console.log('\n=== Resetting sequences ===');
  const sequences = [
    { table: 'Actor', column: 'id' },
    { table: 'Movie', column: 'id' },
    { table: 'Alias', column: 'id' },
    { table: 'GameMove', column: 'id' },
    { table: 'Leaderboard', column: 'id' },
    { table: 'ModerationQueue', column: 'id' },
    { table: 'Analytics', column: 'id' },
  ];

  for (const { table, column } of sequences) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval('"${table}_${column}_seq"', COALESCE((SELECT MAX("${column}") FROM "${table}"), 1), true)`
      );
      console.log(`  ✓ ${table}_${column}_seq reset`);
    } catch (err) {
      console.log(`  ⚠ ${table}_${column}_seq: ${err.message.slice(0, 100)}`);
    }
  }

  sqliteDb.close();
  await prisma.$disconnect();
  console.log('\n=== Migration complete! ===');
}

main().catch((e) => {
  console.error(e);
  sqliteDb.close();
  prisma.$disconnect();
  process.exit(1);
});
