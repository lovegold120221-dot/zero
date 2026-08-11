import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Firebase ID token verification without a service account:
// Firebase Auth ID tokens are standard RS256 JWTs signed by Google's
// public keys (https://www.googleapis.com/oauth2/v3/certs). We fetch and
// cache those keys and verify signatures locally with node:crypto.

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface IdTokenPayload {
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
  uid?: string;
  email?: string | null;
}

let cachedKeys: Record<string, crypto.KeyObject> | null = null;
let keysFetchedAt = 0;
const KEYS_TTL_MS = 15 * 60 * 1000;

async function getPublicKeys(): Promise<Record<string, crypto.KeyObject>> {
  if (cachedKeys && Date.now() - keysFetchedAt < KEYS_TTL_MS) return cachedKeys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const data: any = await res.json();
  const keys: Record<string, crypto.KeyObject> = {};
  for (const key of Array.isArray(data.keys) ? data.keys : []) {
    if (key.kid && key.n && key.e) {
      keys[key.kid] = crypto.createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' });
    }
  }
  cachedKeys = keys;
  keysFetchedAt = Date.now();
  return keys;
}

export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string | null } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header: JwtHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload: IdTokenPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    if (header.alg !== 'RS256' || !header.kid) return null;
    if (!payload.exp || Date.now() >= payload.exp * 1000) return null;
    const expectedIssuers = [
      'https://securetoken.google.com/eburon-ai-beatrice',
      'https://securetoken.google.com/eburon-bd040',
    ];
    if (process.env.FIREBASE_PROJECT_ID) {
      expectedIssuers.push(`https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`);
    }
    if (!expectedIssuers.includes(String(payload.iss || ''))) return null;

    const keys = await getPublicKeys();
    const key = keys[header.kid];
    if (!key) return null;

    const signature = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(`${parts[0]}.${parts[1]}`);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    verifier.end();
    if (!verifier.verify(key, signature)) return null;

    const uid = payload.uid || payload.sub;
    if (!uid) return null;
    return { uid, email: payload.email ?? null };
  } catch (err) {
    console.error('[auth] ID token verification failed:', err);
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { uid: string; email?: string | null };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const user = await verifyIdToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired ID token' });
    return;
  }

  req.user = user;
  next();
};

export const allowedOrigins = (): string[] => {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:4200',
    'https://voxx-zero.vercel.app',
  ]);
  for (const key of ['APP_URL', 'VITE_BACKEND_URL']) {
    const value = process.env[key];
    if (value && value.startsWith('http')) origins.add(value.replace(/\/$/, ''));
  }
  return [...origins];
};
