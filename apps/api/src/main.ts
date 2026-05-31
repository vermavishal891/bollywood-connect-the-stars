import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';

const app = fastify({ logger: true });

// Parse CORS origins from env (comma-separated) or allow all in dev
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

async function start() {
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  // Log full stack traces for 500 errors
  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');
    reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
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
