import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';

const app = fastify({ logger: true });

async function start() {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await registerRoutes(app);

  const port = parseInt(process.env.PORT || '4000');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API server running on http://localhost:${port}`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
