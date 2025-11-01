
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserSession } from '@/lib/types';

// This is now an async function to ensure the environment variable is read correctly in all runtimes.
async function getSecretKey() {
    const secretKey = process.env.SESSION_SECRET;
    if (!secretKey) {
        throw new Error('SESSION_SECRET environment variable is not set. Please add it to your .env.local file.');
    }
    return new TextEncoder().encode(secretKey);
}

export async function encrypt(payload: any) {
  const key = await getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Session expires in 1 day
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const key = await getSecretKey();
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // This can happen if the token is expired or invalid
    console.log("JWT verification failed:", error);
    return null;
  }
}

export async function getSession(): Promise<UserSession | null> {
  const sessionCookies = await cookies();
  const session = sessionCookies.get('session')?.value;
  if (!session) return null;
  
  const decryptedPayload = await decrypt(session);
  if (!decryptedPayload) {
    return null;
  }
  
  // The 'expires' field is automatically checked by jwtVerify, but we can double check
  if (decryptedPayload.exp && decryptedPayload.exp * 1000 < Date.now()) {
      console.log("Session expired.");
      return null;
  }

  return decryptedPayload as UserSession;
}
