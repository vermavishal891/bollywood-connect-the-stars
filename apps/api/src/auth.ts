import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@bollywood-connect/db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthUser {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  username: string;
  imageUrl: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Verify a Google ID token and return the payload
 */
export async function verifyGoogleToken(idToken: string) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Invalid Google token');
  return payload;
}

/**
 * Sign a JWT for the given user
 */
export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      googleId: user.googleId,
      email: user.email,
      username: user.username,
      name: user.name,
      imageUrl: user.imageUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify a JWT and return the user payload
 */
export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  return {
    id: decoded.id,
    googleId: decoded.googleId,
    email: decoded.email,
    username: decoded.username,
    name: decoded.name || null,
    imageUrl: decoded.imageUrl || null,
  };
}

/**
 * Fastify preHandler hook: checks Authorization header and attaches req.user
 */
export async function authenticateHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    request.user = verifyToken(token);
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

/**
 * Optional auth hook: attaches req.user if token present, doesn't error if missing
 */
export async function optionalAuthHook(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  const token = authHeader.slice(7);
  try {
    request.user = verifyToken(token);
  } catch {
    // ignore invalid tokens for optional auth
  }
}

const ADMIN_EMAILS = ['vermavishal891@gmail.com'];

export async function adminHook(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  let user: AuthUser;
  try {
    user = verifyToken(token);
    request.user = user;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }

  if (!ADMIN_EMAILS.includes(user.email)) {
    return reply.status(403).send({ error: 'Forbidden: Admin access only' });
  }
}

/**
 * Find or create a user from Google OAuth payload
 */
export async function upsertUserFromGoogle(payload: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<{ user: AuthUser; isNew: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { googleId: payload.sub },
  });

  if (existing) {
    // Update image if changed
    if (payload.picture && existing.imageUrl !== payload.picture) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { imageUrl: payload.picture },
      });
    }
    return {
      user: {
        id: existing.id,
        googleId: existing.googleId,
        email: existing.email,
        name: existing.name,
        username: existing.username,
        imageUrl: existing.imageUrl,
      },
      isNew: false,
    };
  }

  // New user — generate a default username from email prefix
  const baseUsername = payload.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  let username = baseUsername;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${suffix}`;
    suffix++;
  }

  const created = await prisma.user.create({
    data: {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || null,
      username,
      imageUrl: payload.picture || null,
    },
  });

  return {
    user: {
      id: created.id,
      googleId: created.googleId,
      email: created.email,
      name: created.name,
      username: created.username,
      imageUrl: created.imageUrl,
    },
    isNew: true,
  };
}

/**
 * Register auth routes on the Fastify instance
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  // POST /auth/google — exchange Google ID token for app JWT
  app.post('/auth/google', async (request, reply) => {
    const { idToken } = request.body as { idToken?: string };
    if (!idToken) {
      return reply.status(400).send({ error: 'idToken required' });
    }

    try {
      const googlePayload = await verifyGoogleToken(idToken);
      if (!googlePayload.email) {
        return reply.status(400).send({ error: 'Google account has no email' });
      }
      const { user, isNew } = await upsertUserFromGoogle({
        sub: googlePayload.sub,
        email: googlePayload.email,
        name: googlePayload.name,
        picture: googlePayload.picture,
      });
      const token = signToken(user);
      return { token, user, isNew };
    } catch (err: any) {
      app.log.error('Google auth error:', err.message);
      return reply.status(401).send({ error: 'Authentication failed' });
    }
  });

  // GET /auth/me — get current user from JWT
  app.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const user = verifyToken(authHeader.slice(7));
      // Refresh from DB to get latest username
      const fresh = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fresh) return reply.status(401).send({ error: 'User not found' });
      return {
        id: fresh.id,
        googleId: fresh.googleId,
        email: fresh.email,
        name: fresh.name,
        username: fresh.username,
        imageUrl: fresh.imageUrl,
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // PATCH /auth/username — update username (authenticated)
  app.patch('/auth/username', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let user: AuthUser;
    try {
      user = verifyToken(authHeader.slice(7));
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const { username } = request.body as { username?: string };
    if (!username || username.length < 3 || username.length > 30) {
      return reply.status(400).send({ error: 'Username must be 3-30 characters' });
    }

    const normalized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized !== username.toLowerCase()) {
      return reply.status(400).send({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    const existing = await prisma.user.findUnique({ where: { username: normalized } });
    if (existing && existing.id !== user.id) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username: normalized },
    });

    // Re-sign token with new username
    const token = signToken({
      id: updated.id,
      googleId: updated.googleId,
      email: updated.email,
      name: updated.name,
      username: updated.username,
      imageUrl: updated.imageUrl,
    });

    return { token, user: updated };
  });
}
