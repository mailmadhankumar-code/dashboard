
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getSession(cookies());

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: session }, { status: 200 });
}
